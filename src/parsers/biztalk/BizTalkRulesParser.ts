/**
 * BizTalk Rules Parser
 *
 * Parses BizTalk Business Rules Engine files (.bre, .brl) into IR format.
 * These files contain policies, rules, and vocabularies exported from the
 * BizTalk Business Rules Composer.
 *
 * @module parsers/biztalk/BizTalkRulesParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { parseXml, getAttr, getAllElements, getElementText } from '../utils/xml';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// BizTalk Rules Parser
// =============================================================================

/**
 * Parser for BizTalk Business Rules Engine files (.bre / .brl).
 *
 * Extracts policy names, rule counts, vocabulary definitions,
 * and referenced schemas — providing visibility into business
 * logic that needs migration.
 */
export class BizTalkRulesParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.bre', '.brl'],
        fileTypes: ['config'],
        supportsFolder: false,
        description: 'Parses BizTalk Business Rules Engine exports (.bre/.brl) into IR metadata',
    };

    // =========================================================================
    // AbstractParser Implementation
    // =========================================================================

    protected async doParse(
        inputPath: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        const ext = path.extname(inputPath).toLowerCase();
        const fileName = path.basename(inputPath, ext);

        this.reportProgress(options.onProgress, 1, 3, `Reading rules: ${fileName}`);

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Parse XML
        const doc = parseXml(content);
        if (!doc) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'Rules file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Extracting rules metadata');

        const rootEl = doc.documentElement;
        const info = this.extractRulesInfo(rootEl, fileName);

        this.reportProgress(options.onProgress, 3, 3, 'Rules parsing complete');

        // Build IR
        const ir = createEmptyIRDocument(`rules-${fileName}`, info.name, 'biztalk');

        const notes: string[] = [`Business Rules file: ${info.name}`];
        if (info.policies.length > 0) {
            notes.push(`Policies: ${info.policies.join(', ')}`);
        }
        if (info.vocabularies.length > 0) {
            notes.push(`Vocabularies: ${info.vocabularies.join(', ')}`);
        }
        notes.push(
            `Contains ${info.ruleCount} rule(s) across ${info.policies.length} policy/policies`
        );
        notes.push(
            'Business rules need to be migrated to Logic Apps inline code, Azure Functions, or Rules Engine connector'
        );

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        name: info.name,
                        type: 'binding',
                        filePath: path.relative(options.basePath, inputPath),
                        fileType: ext.replace('.', ''),
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered',
                    notes,
                },
            },
            gaps: [
                {
                    id: `gap-bre-${fileName}`,
                    category: 'rules' as const,
                    severity: 'high' as const,
                    title: `Business Rules: ${info.name}`,
                    description:
                        `Contains ${info.ruleCount} rule(s) in ${info.policies.length} policy/policies` +
                        (info.vocabularies.length > 0
                            ? ` and ${info.vocabularies.length} vocabulary/vocabularies`
                            : '') +
                        '. BizTalk BRE rules require migration to Azure Functions, Logic Apps inline code, or a rules engine.',
                    sourceFeature: {
                        platform: 'biztalk',
                        feature: 'Business Rules Engine',
                        artifacts: [
                            ...info.policies.map((p) => `Policy: ${p}`),
                            ...info.vocabularies.map((v) => `Vocabulary: ${v}`),
                        ],
                    },
                    resolution: {
                        strategy: 'azure-function' as const,
                    },
                    status: 'pending' as const,
                },
            ],
        };
    }

    // =========================================================================
    // Rules Extraction
    // =========================================================================

    /**
     * Extract rules metadata from the XML document.
     */
    private extractRulesInfo(
        rootEl: Element,
        fallbackName: string
    ): {
        name: string;
        policies: string[];
        vocabularies: string[];
        ruleCount: number;
    } {
        const policies: string[] = [];
        const vocabularies: string[] = [];
        let ruleCount = 0;

        // Try common BRE XML shapes

        // Shape 1: <brl:ruleSet name="..."> with <brl:rule> children
        const ruleSetElements = [
            ...getAllElements(rootEl, 'ruleset'),
            ...getAllElements(rootEl, 'RuleSet'),
            ...getAllElements(rootEl, 'ruleSet'),
            ...getAllElements(rootEl, 'brl:ruleset'),
            ...getAllElements(rootEl, 'brl:ruleSet'),
        ];
        for (const rs of ruleSetElements) {
            const name = getAttr(rs, 'name') || getAttr(rs, 'Name') || 'Unnamed Policy';
            policies.push(name);
            const rules = [
                ...getAllElements(rs, 'rule'),
                ...getAllElements(rs, 'Rule'),
                ...getAllElements(rs, 'brl:rule'),
            ];
            ruleCount += rules.length;
        }

        // Shape 2: <Policy> / <Policies> wrapper
        const policyElements = [
            ...getAllElements(rootEl, 'Policy'),
            ...getAllElements(rootEl, 'policy'),
        ];
        for (const p of policyElements) {
            const name = getAttr(p, 'Name') || getAttr(p, 'name') || getElementText(p, 'Name');
            if (name && !policies.includes(name)) {
                policies.push(name);
                const rules = [...getAllElements(p, 'Rule'), ...getAllElements(p, 'rule')];
                ruleCount += rules.length;
            }
        }

        // Shape 3: <Vocabulary> elements
        const vocabElements = [
            ...getAllElements(rootEl, 'Vocabulary'),
            ...getAllElements(rootEl, 'vocabulary'),
            ...getAllElements(rootEl, 'brl:vocabulary'),
        ];
        for (const v of vocabElements) {
            const name = getAttr(v, 'Name') || getAttr(v, 'name') || getElementText(v, 'Name');
            if (name && !vocabularies.includes(name)) {
                vocabularies.push(name);
            }
        }

        // If we found no rules via nested elements, count top-level <Rule> elements
        if (ruleCount === 0) {
            ruleCount = [
                ...getAllElements(rootEl, 'Rule'),
                ...getAllElements(rootEl, 'rule'),
                ...getAllElements(rootEl, 'brl:rule'),
            ].length;
        }

        // Determine best name
        const name =
            getAttr(rootEl, 'Name') ||
            getAttr(rootEl, 'name') ||
            getElementText(rootEl, 'Name') ||
            (policies.length === 1 ? policies[0] : fallbackName);

        return { name, policies, vocabularies, ruleCount };
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath, ext);
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return { name: fileName, type: 'binding' };
        }

        const doc = parseXml(content);
        if (!doc) {
            return { name: fileName, type: 'binding' };
        }

        const info = this.extractRulesInfo(doc.documentElement, fileName);

        return {
            name: info.name,
            type: 'binding',
            elementCount: info.ruleCount,
            description:
                `${info.policies.length} policy/policies, ${info.ruleCount} rule(s)` +
                (info.vocabularies.length > 0
                    ? `, ${info.vocabularies.length} vocabulary/vocabularies`
                    : ''),
        };
    }
}
