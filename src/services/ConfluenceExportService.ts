/**
 * Confluence export bundle service.
 *
 * This service deliberately stops at a sanitized, self-contained local bundle.
 * The bundle is published by the provisioned Confluence publisher agent through
 * the official Atlassian Rovo MCP server. Keeping the MCP interaction in the
 * agent means the extension never handles Confluence credentials or tokens.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { LoggingService } from './LoggingService';
import { MermaidImageRenderer } from './MermaidImageRenderer';
import { GeneratedFlowResult } from './LLMFlowGenerator';
import { FlowPlanningResult, PlanningCacheService } from '../stages/planning/PlanningCacheService';
import { StateManager } from './StateManager';

export type ConfluenceReportType = 'analysis' | 'planning';

export interface ConfluenceAttachmentManifest {
    readonly kind: 'architecture' | 'sequence' | 'workflow';
    readonly title: string;
    readonly relativePath: string;
    readonly sourceField: string;
    readonly status: 'ready' | 'render-failed';
}

export interface ConfluenceBundleManifest {
    readonly schemaVersion: 1;
    readonly bundleId: string;
    readonly reportType: ConfluenceReportType;
    readonly flowId: string;
    readonly flowName: string;
    readonly pageTitle: string;
    readonly createdAt: string;
    readonly mappingKey: string;
    readonly reportFile: 'report.md';
    readonly attachments: ConfluenceAttachmentManifest[];
}

export interface ConfluencePageMapping {
    readonly mappingKey: string;
    readonly reportType: ConfluenceReportType;
    readonly flowId: string;
    readonly flowName: string;
    readonly pageId: string;
    readonly pageUrl: string;
    readonly pageTitle: string;
    readonly siteUrl: string;
    readonly spaceKey: string;
    readonly parentPageId?: string;
    readonly updatedAt: string;
}

export interface ConfluencePublishReceipt {
    readonly schemaVersion: 1;
    readonly bundleId: string;
    readonly reportType: ConfluenceReportType;
    readonly flowId: string;
    readonly flowName: string;
    readonly status: 'published' | 'failed' | 'partial' | 'cancelled';
    readonly publishedAt?: string;
    readonly page?: {
        readonly id: string;
        readonly url: string;
        readonly title: string;
        readonly siteUrl: string;
        readonly spaceKey: string;
        readonly parentPageId?: string;
    };
    readonly attachments?: {
        readonly relativePath: string;
        readonly attachmentId?: string;
        readonly status: 'uploaded' | 'failed' | 'skipped';
        readonly error?: string;
    }[];
    readonly error?: string;
}

export interface ConfluenceBundle {
    readonly bundlePath: string;
    readonly manifest: ConfluenceBundleManifest;
}

export interface ConfluenceReceiptResult {
    readonly receipt: ConfluencePublishReceipt;
    readonly mapping?: ConfluencePageMapping;
}

const MAPPING_FILENAME = 'confluence-publishing.json';
const BUNDLE_DIRNAME = 'confluence-exports';
const RECEIPT_FILENAME = 'publish-receipt.json';
const REPORT_FILENAME = 'report.md';
const MAPPING_SCHEMA_VERSION = 1;
const BUNDLE_SCHEMA_VERSION = 1;
const RECEIPT_POLL_INTERVAL_MS = 1000;
const RECEIPT_TIMEOUT_MS = 15 * 60 * 1000;

interface MappingFile {
    readonly schemaVersion: 1;
    readonly mappings: ConfluencePageMapping[];
}

interface RenderedAttachment {
    readonly manifest: ConfluenceAttachmentManifest;
    readonly markdown: string;
    readonly image?: Buffer;
}

export class ConfluenceExportService {
    private static instance: ConfluenceExportService | undefined;
    private readonly logger = LoggingService.getInstance();
    private readonly mermaidRenderer = MermaidImageRenderer.getInstance();

    private constructor() {}

    public static getInstance(): ConfluenceExportService {
        if (!ConfluenceExportService.instance) {
            ConfluenceExportService.instance = new ConfluenceExportService();
        }
        return ConfluenceExportService.instance;
    }

    /**
     * Create a complete analysis bundle without storing any Confluence
     * credentials, local absolute paths, or raw secret-like values.
     */
    public async createAnalysisBundle(
        flowId: string,
        flowName: string,
        result: GeneratedFlowResult
    ): Promise<ConfluenceBundle> {
        const attachments: RenderedAttachment[] = [];
        attachments.push(
            await this.renderAttachment(
                'architecture',
                'Architecture Diagram',
                'result.mermaid',
                result.mermaid,
                'architecture.png'
            )
        );

        for (const [index, sequence] of (result.sequenceDiagrams || []).entries()) {
            attachments.push(
                await this.renderAttachment(
                    'sequence',
                    sequence.receiveLocation,
                    `result.sequenceDiagrams[${index}].mermaid`,
                    sequence.mermaid,
                    `sequence-${String(index + 1).padStart(2, '0')}-${this.slug(sequence.receiveLocation)}.png`
                )
            );
        }

        const report = this.buildAnalysisMarkdown(flowName, result, attachments);
        return this.writeBundle('analysis', flowId, flowName, report, attachments);
    }

    /**
     * Load the finalized planning result and create a complete planning bundle.
     */
    public async createPlanningBundle(flowId: string): Promise<ConfluenceBundle | undefined> {
        const result = PlanningCacheService.getInstance().get(flowId);
        if (!result) {
            return undefined;
        }

        const attachments: RenderedAttachment[] = [];
        if (result.mermaid) {
            attachments.push(
                await this.renderAttachment(
                    'architecture',
                    'Target Architecture',
                    'result.mermaid',
                    result.mermaid,
                    'architecture.png'
                )
            );
        }

        for (const [index, workflow] of result.workflows.entries()) {
            if (workflow.mermaid) {
                attachments.push(
                    await this.renderAttachment(
                        'workflow',
                        workflow.name,
                        `result.workflows[${index}].mermaid`,
                        workflow.mermaid,
                        `workflow-${String(index + 1).padStart(2, '0')}-${this.slug(workflow.name)}.png`
                    )
                );
            }
        }

        const report = this.buildPlanningMarkdown(result, attachments);
        return this.writeBundle(
            'planning',
            result.flowId,
            result.flowName,
            report,
            attachments
        );
    }

    public getMapping(reportType: ConfluenceReportType, flowId: string): ConfluencePageMapping | undefined {
        const key = this.getMappingKey(reportType, flowId);
        return this.readMappings().find((mapping) => mapping.mappingKey === key);
    }

    public listMappings(): ConfluencePageMapping[] {
        return this.readMappings();
    }

    public async findBundle(bundlePath: string): Promise<ConfluenceBundle | undefined> {
        const root = this.getBundleRoot();
        if (!root) {
            return undefined;
        }

        const resolvedRoot = path.resolve(root);
        const resolvedBundlePath = path.resolve(bundlePath);
        const relative = path.relative(resolvedRoot, resolvedBundlePath);
        if (
            !relative ||
            relative.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relative) ||
            relative.includes(path.sep)
        ) {
            return undefined;
        }

        try {
            const manifest = this.parseManifest(
                JSON.parse(
                    await fs.promises.readFile(
                        path.join(resolvedBundlePath, 'manifest.json'),
                        'utf-8'
                    )
                )
            );
            return { bundlePath: resolvedBundlePath, manifest };
        } catch (err) {
            this.logger.warn(
                `[ConfluenceExport] Unable to load bundle ${bundlePath}: ${err instanceof Error ? err.message : String(err)}`
            );
            return undefined;
        }
    }

    public async clearReceipt(bundle: ConfluenceBundle): Promise<void> {
        await fs.promises.rm(path.join(bundle.bundlePath, RECEIPT_FILENAME), {
            force: true,
        });
    }

    public async writeReceipt(
        bundle: ConfluenceBundle,
        receipt: ConfluencePublishReceipt
    ): Promise<void> {
        const validated = this.parseReceipt(receipt, bundle.manifest);
        const receiptPath = path.join(bundle.bundlePath, RECEIPT_FILENAME);
        const tempPath = `${receiptPath}.${process.pid}.tmp`;
        await fs.promises.writeFile(tempPath, JSON.stringify(validated, null, 2), 'utf-8');
        await fs.promises.rename(tempPath, receiptPath);
    }

    public async clearLink(reportType: ConfluenceReportType, flowId: string): Promise<boolean> {
        const mappingPath = this.getMappingPath();
        const mappings = this.readMappings();
        const key = this.getMappingKey(reportType, flowId);
        const remaining = mappings.filter((mapping) => mapping.mappingKey !== key);
        if (remaining.length === mappings.length) {
            return false;
        }

        await this.writeMappings(mappingPath, remaining);
        this.logger.info(`[ConfluenceExport] Cleared page link for ${key}`);
        return true;
    }

    public async listPendingBundles(): Promise<ConfluenceBundle[]> {
        const root = this.getBundleRoot();
        if (!root || !fs.existsSync(root)) {
            return [];
        }

        const bundles: ConfluenceBundle[] = [];
        for (const entry of await fs.promises.readdir(root, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }
            const bundlePath = path.join(root, entry.name);
            const manifestPath = path.join(bundlePath, 'manifest.json');
            try {
                const manifest = this.parseManifest(
                    JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'))
                );
                bundles.push({ bundlePath, manifest });
            } catch (err) {
                this.logger.warn(
                    `[ConfluenceExport] Ignoring invalid bundle ${bundlePath}: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }
        return bundles;
    }

    /**
     * Wait for the publisher agent to write a receipt. A missing receipt is
     * treated as a pending operation so the bundle remains available for retry.
     */
    public async waitForReceipt(
        bundle: ConfluenceBundle,
        timeoutMs = RECEIPT_TIMEOUT_MS
    ): Promise<ConfluenceReceiptResult | undefined> {
        const receiptPath = path.join(bundle.bundlePath, RECEIPT_FILENAME);
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            if (fs.existsSync(receiptPath)) {
                try {
                    const receipt = this.parseReceipt(
                        JSON.parse(await fs.promises.readFile(receiptPath, 'utf-8')),
                        bundle.manifest
                    );
                    return this.applyReceipt(bundle, receipt);
                } catch (err) {
                    // The agent can briefly expose a partially written JSON
                    // file. Continue polling, but report malformed final data.
                    this.logger.warn(
                        `[ConfluenceExport] Receipt is not ready: ${err instanceof Error ? err.message : String(err)}`
                    );
                }
            }
            await this.delay(RECEIPT_POLL_INTERVAL_MS);
        }

        return undefined;
    }

    public getPublisherPromptPath(bundle: ConfluenceBundle): string {
        return path.join(bundle.bundlePath, REPORT_FILENAME);
    }

    public getMappingKey(reportType: ConfluenceReportType, flowId: string): string {
        return `${reportType}:${this.sanitizeText(flowId)}`;
    }

    private async applyReceipt(
        bundle: ConfluenceBundle,
        receipt: ConfluencePublishReceipt
    ): Promise<ConfluenceReceiptResult> {
        if (receipt.status !== 'published' || !receipt.page) {
            return { receipt };
        }

        const mapping: ConfluencePageMapping = {
            mappingKey: bundle.manifest.mappingKey,
            reportType: bundle.manifest.reportType,
            flowId: bundle.manifest.flowId,
            flowName: bundle.manifest.flowName,
            pageId: receipt.page.id,
            pageUrl: receipt.page.url,
            pageTitle: receipt.page.title,
            siteUrl: receipt.page.siteUrl,
            spaceKey: receipt.page.spaceKey,
            parentPageId: receipt.page.parentPageId,
            updatedAt: receipt.publishedAt || new Date().toISOString(),
        };

        const mappings = this.readMappings().filter(
            (existing) => existing.mappingKey !== mapping.mappingKey
        );
        await this.writeMappings(this.getMappingPath(), [...mappings, mapping]);
        await fs.promises.rm(bundle.bundlePath, { recursive: true, force: true });
        return { receipt, mapping };
    }

    private async renderAttachment(
        kind: ConfluenceAttachmentManifest['kind'],
        title: string,
        sourceField: string,
        mermaid: string,
        filename: string
    ): Promise<RenderedAttachment> {
        const relativePath = `attachments/${filename}`;
        const image = await this.mermaidRenderer.renderToBuffer(mermaid);
        if (!image) {
            return {
                manifest: {
                    kind,
                    title: this.sanitizeText(title),
                    relativePath,
                    sourceField,
                    status: 'render-failed',
                },
                markdown: `> The ${this.sanitizeText(title)} could not be rendered as a PNG attachment. The Mermaid source is included below.`,
            };
        }

        return {
            manifest: {
                kind,
                title: this.sanitizeText(title),
                relativePath,
                sourceField,
                status: 'ready',
            },
            markdown: `![${this.sanitizeText(title)}](${relativePath})`,
            image,
        };
    }

    private async writeBundle(
        reportType: ConfluenceReportType,
        flowId: string,
        flowName: string,
        report: string,
        attachments: RenderedAttachment[]
    ): Promise<ConfluenceBundle> {
        const root = this.getBundleRoot();
        if (!root) {
            throw new Error('A workspace folder is required to create a Confluence export bundle.');
        }

        const safeFlowId = this.slug(flowId).slice(0, 64) || 'flow';
        const bundleId = `${reportType}-${safeFlowId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const bundlePath = path.join(root, bundleId);
        await fs.promises.mkdir(path.join(bundlePath, 'attachments'), { recursive: true });

        for (const attachment of attachments) {
            if (attachment.manifest.status !== 'ready' || !attachment.image) {
                continue;
            }
            await fs.promises.writeFile(
                path.join(bundlePath, attachment.manifest.relativePath),
                attachment.image
            );
        }

        const manifest: ConfluenceBundleManifest = {
            schemaVersion: BUNDLE_SCHEMA_VERSION,
            bundleId,
            reportType,
            flowId: this.sanitizeText(flowId),
            flowName: this.sanitizeText(flowName),
            pageTitle: this.sanitizeText(`${flowName} - ${reportType === 'analysis' ? 'Analysis' : 'Planning'} Report`),
            createdAt: new Date().toISOString(),
            mappingKey: this.getMappingKey(reportType, flowId),
            reportFile: REPORT_FILENAME,
            attachments: attachments.map((attachment) => attachment.manifest),
        };

        await fs.promises.writeFile(
            path.join(bundlePath, REPORT_FILENAME),
            report,
            'utf-8'
        );
        await fs.promises.writeFile(
            path.join(bundlePath, 'manifest.json'),
            JSON.stringify(manifest, null, 2),
            'utf-8'
        );

        return { bundlePath, manifest };
    }

    private buildAnalysisMarkdown(
        flowName: string,
        result: GeneratedFlowResult,
        attachments: RenderedAttachment[]
    ): string {
        const architecture = attachments.find((attachment) => attachment.manifest.kind === 'architecture');
        const sequenceAttachments = attachments.filter(
            (attachment) => attachment.manifest.kind === 'sequence'
        );
        const lines: string[] = [
            `# ${this.sanitizeText(flowName)} - Analysis Report`,
            '',
            `Generated: ${new Date().toISOString()}`,
            '',
            '## Executive Summary',
            '',
            this.sanitizeText(result.explanation),
            '',
            '## Architecture Diagram',
            '',
        ];

        if (architecture) {
            lines.push(`<!-- ${architecture.manifest.sourceField} -->`);
            lines.push(architecture.markdown, '');
            lines.push('### Mermaid source', '', '```mermaid', this.sanitizeText(result.mermaid), '```', '');
        }

        if (result.sequenceDiagrams && result.sequenceDiagrams.length > 0) {
            lines.push('## Message Journey Sequence Diagrams', '');
            for (const [index, sequence] of result.sequenceDiagrams.entries()) {
                const attachment = sequenceAttachments[index];
                lines.push(`### ${this.sanitizeText(sequence.receiveLocation)}`, '');
                if (sequence.description) {
                    lines.push(this.sanitizeText(sequence.description), '');
                }
                if (attachment) {
                    lines.push(`<!-- ${attachment.manifest.sourceField} -->`, attachment.markdown, '');
                }
                lines.push('```mermaid', this.sanitizeText(sequence.mermaid), '```', '');
            }
        }

        lines.push(
            '## Component Details',
            '',
            this.toMarkdownTable(
                ['Component', 'Type', 'Azure Equivalent', 'Logic Apps Native'],
                (result.componentDetails || []).map((component) => [
                    component.name,
                    component.type,
                    component.azureEquivalent || '',
                    component.isLogicAppsNative ? 'Yes' : 'No',
                ])
            ),
            '',
            '## Message Flow',
            '',
            this.toMarkdownTable(
                ['Step', 'Component', 'Action', 'Details'],
                (result.messageFlow || []).map((step, index) => [
                    String(index + 1),
                    step.component,
                    step.action,
                    step.description,
                ])
            ),
            '',
            '## Missing Dependencies',
            '',
            this.toMarkdownTable(
                ['Dependency', 'Type', 'Severity', 'Status'],
                (result.dependencyAnalysis?.missingDependencies || []).map((dependency) => [
                    dependency.name,
                    dependency.type,
                    dependency.severity,
                    dependency.blocksMigration ? 'Blocks migration' : 'Review',
                ])
            ),
            '',
            '## Gap Analysis',
            '',
            this.toMarkdownTable(
                ['Component', 'Type', 'Severity', 'Gap', 'Recommendation'],
                (result.gapAnalysis || []).map((gap) => [
                    gap.component,
                    gap.componentType,
                    gap.severity,
                    gap.gap,
                    gap.recommendation,
                ])
            ),
            '',
            '## Migration Patterns',
            '',
            this.toMarkdownTable(
                ['Pattern', 'Complexity', 'Source Approach', 'Logic Apps Approach'],
                (result.migrationPatterns || []).map((pattern) => [
                    pattern.pattern,
                    pattern.complexity,
                    pattern.biztalkApproach,
                    pattern.logicAppsApproach,
                ])
            ),
            ''
        );

        if (result.notes && result.notes.length > 0) {
            lines.push('## Notes', '', ...result.notes.map((note) => `- ${this.sanitizeText(note)}`), '');
        }
        lines.push('## Artifact Summary', '', this.toJsonBlock(result.summary));
        return lines.join('\n');
    }

    private buildPlanningMarkdown(
        result: FlowPlanningResult,
        attachments: RenderedAttachment[]
    ): string {
        const lines: string[] = [
            `# ${this.sanitizeText(result.flowName)} - Planning Report`,
            '',
            `Generated: ${this.sanitizeText(result.generatedAt)}`,
            '',
            '## Executive Summary',
            '',
            this.sanitizeText(result.explanation),
            '',
            '## Target Architecture',
            '',
        ];
        const architecture = attachments.find((attachment) => attachment.manifest.kind === 'architecture');
        if (architecture) {
            lines.push(`<!-- ${architecture.manifest.sourceField} -->`, architecture.markdown, '');
            lines.push('```mermaid', this.sanitizeText(result.mermaid), '```', '');
        }

        lines.push('## Workflows', '');
        for (const [index, workflow] of result.workflows.entries()) {
            lines.push(
                `### ${this.sanitizeText(workflow.name)}`,
                '',
                this.sanitizeText(workflow.description),
                '',
                `**Trigger:** ${this.sanitizeText(workflow.triggerType)}`,
                '',
                '**Actions:**',
                ...workflow.actions.map((action) => `- ${this.sanitizeText(action)}`),
                ''
            );
            const attachment = attachments.filter(
                (candidate) => candidate.manifest.kind === 'workflow'
            )[index];
            if (attachment) {
                lines.push(`<!-- ${attachment.manifest.sourceField} -->`, attachment.markdown, '');
                lines.push('```mermaid', this.sanitizeText(workflow.mermaid || ''), '```', '');
            }
            if (workflow.workflowDefinition) {
                lines.push('#### workflow.json', '', this.toJsonBlock(workflow.workflowDefinition), '');
            }
        }

        lines.push(
            '## Azure Components',
            '',
            this.toMarkdownTable(
                ['Name', 'Type', 'Reason', 'Configuration Notes'],
                result.azureComponents.map((component) => [
                    component.name,
                    component.type,
                    component.reason,
                    component.configNotes || '',
                ])
            ),
            '',
            '## Connector Mappings',
            '',
            this.toMarkdownTable(
                ['Source', 'Target', 'Logic Apps Native', 'Notes'],
                result.connectorMappings.map((mapping) => [
                    mapping.source,
                    mapping.target,
                    mapping.isNative ? 'Yes' : 'No',
                    mapping.notes || '',
                ])
            ),
            '',
            '## Action Mappings',
            '',
            this.toMarkdownTable(
                ['Source', 'Target', 'Workflow', 'Notes'],
                result.actionMappings.map((mapping) => [
                    mapping.source,
                    mapping.target,
                    mapping.workflowName || '',
                    mapping.notes || '',
                ])
            ),
            '',
            '## Migration Gaps',
            '',
            this.toMarkdownTable(
                ['Component', 'Severity', 'Gap', 'Recommendation'],
                result.gaps.map((gap) => [
                    gap.component,
                    gap.severity,
                    gap.gap,
                    gap.recommendation,
                ])
            ),
            '',
            '## Integration Patterns',
            '',
            this.toMarkdownTable(
                ['Pattern', 'Complexity', 'Source Approach', 'Logic Apps Approach'],
                result.patterns.map((pattern) => [
                    pattern.name,
                    pattern.complexity,
                    pattern.sourceApproach,
                    pattern.logicAppsApproach,
                ])
            ),
            ''
        );

        if (result.effortEstimate) {
            lines.push('## Effort Estimate', '', this.toJsonBlock(result.effortEstimate), '');
        }
        if (result.artifactDispositions && result.artifactDispositions.length > 0) {
            lines.push(
                '## Artifact Dispositions',
                '',
                this.toMarkdownTable(
                    ['Artifact', 'Type', 'Conversion Required', 'Destination', 'Upload Path'],
                    result.artifactDispositions.map((disposition) => [
                        disposition.artifactName,
                        disposition.artifactType,
                        disposition.conversionRequired ? 'Yes' : 'No',
                        disposition.uploadDestination,
                        disposition.uploadPath || '',
                    ])
                ),
                ''
            );
        }
        lines.push('## Summary', '', this.sanitizeText(result.summary));
        return lines.join('\n');
    }

    private toMarkdownTable(headers: string[], rows: string[][]): string {
        const escapedHeaders = headers.map((header) => this.escapeTableCell(header));
        const separator = headers.map(() => '---');
        const body = rows.map((row) => `| ${row.map((cell) => this.escapeTableCell(cell)).join(' | ')} |`);
        return [
            `| ${escapedHeaders.join(' | ')} |`,
            `| ${separator.join(' | ')} |`,
            ...body,
        ].join('\n');
    }

    private toJsonBlock(value: unknown): string {
        return ['```json', JSON.stringify(this.sanitizeValue(value), null, 2), '```'].join('\n');
    }

    private escapeTableCell(value: unknown): string {
        return this.sanitizeText(String(value ?? '')).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
    }

    private sanitizeValue(value: unknown, key?: string): unknown {
        if (key && /password|secret|token|apikey|api_key|clientsecret|accesskey|authorization|credential|connectionstring/i.test(key)) {
            return '[REDACTED]';
        }
        if (typeof value === 'string') {
            return this.sanitizeText(value);
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.sanitizeValue(item));
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([entryKey, entryValue]) => [
                    entryKey,
                    this.sanitizeValue(entryValue, entryKey),
                ])
            );
        }
        return value;
    }

    private sanitizeText(value: string): string {
        let sanitized = value
            .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
            .replace(
                /([?&](?:access_token|token|api_key|apikey|client_secret|secret|password)=)[^&\s]+/gi,
                '$1[REDACTED]'
            )
            .replace(
                /((?:password|secret|token|apikey|api_key|client_secret|access_key|connection_string)\s*[:=]\s*)["']?[^"',\s]+/gi,
                '$1[REDACTED]'
            );

        sanitized = sanitized.replace(
            /(?:[A-Za-z]:[\\/]|\\\\)[^\s"'`<>|]+/g,
            (localPath) => this.normalizeLocalPath(localPath)
        );
        return sanitized;
    }

    private normalizeLocalPath(localPath: string): string {
        const root = this.getWorkspaceRoot();
        if (!root) {
            return '<local-path>';
        }
        const normalized = localPath.replace(/\\/g, path.sep);
        const relative = path.relative(root, normalized);
        return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
            ? `<workspace-relative:${relative.split(path.sep).join('/')}>`
            : '<local-path>';
    }

    private parseManifest(value: unknown): ConfluenceBundleManifest {
        if (!value || typeof value !== 'object') {
            throw new Error('Manifest must be an object.');
        }
        const manifest = value as Partial<ConfluenceBundleManifest>;
        if (
            manifest.schemaVersion !== BUNDLE_SCHEMA_VERSION ||
            typeof manifest.bundleId !== 'string' ||
            (manifest.reportType !== 'analysis' && manifest.reportType !== 'planning') ||
            typeof manifest.flowId !== 'string' ||
            typeof manifest.flowName !== 'string' ||
            typeof manifest.pageTitle !== 'string' ||
            manifest.reportFile !== REPORT_FILENAME ||
            !Array.isArray(manifest.attachments)
        ) {
            throw new Error('Manifest does not match the supported schema.');
        }
        return manifest as ConfluenceBundleManifest;
    }

    private parseReceipt(
        value: unknown,
        manifest: ConfluenceBundleManifest
    ): ConfluencePublishReceipt {
        if (!value || typeof value !== 'object') {
            throw new Error('Receipt must be an object.');
        }
        const receipt = value as Partial<ConfluencePublishReceipt>;
        if (
            receipt.schemaVersion !== 1 ||
            receipt.bundleId !== manifest.bundleId ||
            receipt.reportType !== manifest.reportType ||
            receipt.flowId !== manifest.flowId ||
            receipt.flowName !== manifest.flowName ||
            !['published', 'failed', 'partial', 'cancelled'].includes(receipt.status || '')
        ) {
            throw new Error('Receipt does not match the bundle.');
        }
        if (receipt.status === 'published') {
            const page = receipt.page;
            if (
                !page ||
                !page.id ||
                !page.title ||
                !/^https?:\/\//i.test(page.siteUrl || '') ||
                !page.spaceKey ||
                !/^https?:\/\//i.test(page.url || '') ||
                !receipt.publishedAt ||
                !Array.isArray(receipt.attachments)
            ) {
                throw new Error('A successful receipt must contain a valid page URL and publication details.');
            }
            const readyAttachments = manifest.attachments.filter(
                (attachment) => attachment.status === 'ready'
            );
            if (manifest.attachments.some((attachment) => attachment.status !== 'ready')) {
                throw new Error('A successful receipt cannot omit a render-failed attachment.');
            }
            if (receipt.attachments.length !== readyAttachments.length) {
                throw new Error('A successful receipt must contain an outcome for every attachment.');
            }
            const expectedPaths = new Set(readyAttachments.map((attachment) => attachment.relativePath));
            const actualPaths = new Set<string>();
            for (const attachment of receipt.attachments) {
                if (
                    !attachment ||
                    attachment.status !== 'uploaded' ||
                    !attachment.attachmentId ||
                    !expectedPaths.has(attachment.relativePath) ||
                    actualPaths.has(attachment.relativePath)
                ) {
                    throw new Error('A successful receipt contains an invalid attachment outcome.');
                }
                actualPaths.add(attachment.relativePath);
            }
        } else if (!receipt.error || receipt.error.trim().length === 0) {
            throw new Error('A non-success receipt must explain the failure.');
        }

        const serialized = JSON.stringify(receipt);
        if (/(?:[A-Za-z]:[\\/]|\\\\|file:\/\/)/.test(serialized)) {
            throw new Error('Receipt contains a local absolute path.');
        }
        return receipt as ConfluencePublishReceipt;
    }

    private readMappings(): ConfluencePageMapping[] {
        const mappingPath = this.getMappingPath();
        if (!mappingPath || !fs.existsSync(mappingPath)) {
            return [];
        }
        try {
            const raw = JSON.parse(fs.readFileSync(mappingPath, 'utf-8')) as Partial<MappingFile>;
            if (raw.schemaVersion !== MAPPING_SCHEMA_VERSION || !Array.isArray(raw.mappings)) {
                this.logger.warn('[ConfluenceExport] Ignoring unsupported mapping file schema.');
                return [];
            }
            return raw.mappings.filter(
                (mapping): mapping is ConfluencePageMapping =>
                    !!mapping &&
                    typeof mapping.mappingKey === 'string' &&
                    typeof mapping.pageId === 'string' &&
                    typeof mapping.pageUrl === 'string'
            );
        } catch (err) {
            this.logger.warn(
                `[ConfluenceExport] Failed to read mappings: ${err instanceof Error ? err.message : String(err)}`
            );
            return [];
        }
    }

    private async writeMappings(
        mappingPath: string | undefined,
        mappings: ConfluencePageMapping[]
    ): Promise<void> {
        if (!mappingPath) {
            throw new Error('A workspace folder is required to persist Confluence page mappings.');
        }
        await fs.promises.mkdir(path.dirname(mappingPath), { recursive: true });
        const tempPath = `${mappingPath}.${process.pid}.tmp`;
        const content: MappingFile = {
            schemaVersion: MAPPING_SCHEMA_VERSION,
            mappings,
        };
        await fs.promises.writeFile(tempPath, JSON.stringify(content, null, 2), 'utf-8');
        await fs.promises.rename(tempPath, mappingPath);
    }

    private getMappingPath(): string | undefined {
        const root = this.getWorkspaceRoot();
        return root ? path.join(root, '.vscode', 'migration', MAPPING_FILENAME) : undefined;
    }

    private getBundleRoot(): string | undefined {
        const root = this.getWorkspaceRoot();
        return root ? path.join(root, '.vscode', 'migration', BUNDLE_DIRNAME) : undefined;
    }

    private getWorkspaceRoot(): string | undefined {
        const projectPath = StateManager.getInstance().getState().projectPath;
        const projectFolder = projectPath
            ? vscode.workspace.getWorkspaceFolder(vscode.Uri.file(projectPath))
            : undefined;
        return (
            projectFolder?.uri.fsPath ??
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
            (projectPath && fs.existsSync(projectPath) ? projectPath : undefined)
        );
    }

    private slug(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
