/**
 * Planning File Service
 *
 * Manages per-flow planning artifacts as individual files inside a
 * folder structure: `.vscode/migration/planning/{flowId}/`.
 *
 * Each planning artifact is stored as a separate file:
 *   - architecture.mmd          — Mermaid diagram
 *   - workflow-definition.json  — Logic Apps Standard workflow definition
 *   - azure-components.json     — Required Azure components
 *   - action-mappings.json      — Source → Logic Apps action mappings
 *   - gaps.json                 — Migration gap analysis
 *   - patterns.json             — Detected integration patterns
 *   - plan-meta.json            — Metadata (flowId, flowName, explanation, summary, timestamps)
 *
 * @module stages/planning/PlanningFileService
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import type { LogicAppsWorkflowDefinition } from '../../workflowSchema';

// =============================================================================
// File Names
// =============================================================================

export const PLANNING_FILES = {
    ARCHITECTURE: 'architecture.mmd',
    WORKFLOW_DEFINITION: 'workflow-definition.json',
    /** @deprecated Use WORKFLOW_PREFIX pattern instead for multi-workflow support */
    WORKFLOW_PREFIX: 'workflow-',
    AZURE_COMPONENTS: 'azure-components.json',
    ACTION_MAPPINGS: 'action-mappings.json',
    GAPS: 'gaps.json',
    PATTERNS: 'patterns.json',
    ARTIFACT_DISPOSITIONS: 'artifact-dispositions.json',
    META: 'plan-meta.json',
} as const;

/** All required files that must exist before finalization */
export const REQUIRED_PLANNING_FILES = [
    PLANNING_FILES.ARCHITECTURE,
    // Note: workflow-definition.json is checked separately via hasWorkflowDefinitions()
    PLANNING_FILES.ACTION_MAPPINGS,
    PLANNING_FILES.GAPS,
    PLANNING_FILES.PATTERNS,
    PLANNING_FILES.ARTIFACT_DISPOSITIONS,
    PLANNING_FILES.META,
] as const;

// =============================================================================
// Type Definitions
// =============================================================================

/** plan-meta.json shape */
export interface PlanMeta {
    flowId: string;
    flowName: string;
    explanation: string;
    summary: string;
    generatedAt: string;
    updatedAt: string;
}

/** workflow-definition.json / workflow-{name}.json shape */
export interface WorkflowDefinitionFile {
    name: string;
    description: string;
    triggerType: string;
    actions: string[];
    sourceArtifactIds: string[];
    definition: LogicAppsWorkflowDefinition;
    /** Per-workflow Mermaid architecture diagram */
    mermaid?: string;
}

/** azure-components.json shape */
export interface AzureComponentEntry {
    name: string;
    type: string;
    reason: string;
    configNotes?: string;
}

/** action-mappings.json shape */
export interface ActionMappingEntry {
    source: string;
    target: string;
    isNative?: boolean;
    notes?: string;
    /** Which workflow this mapping belongs to (for multi-workflow views) */
    workflowName?: string;
}

/** gaps.json shape */
export interface GapEntry {
    component: string;
    gap: string;
    severity: 'high' | 'medium' | 'low';
    recommendation: string;
}

/** patterns.json shape */
export interface PatternEntry {
    name: string;
    sourceApproach: string;
    logicAppsApproach: string;
    complexity: 'high' | 'medium' | 'low';
}

/** artifact-dispositions.json shape */
/**
 * Artifact disposition entry — describes how a deployable artifact
 * (schema, map, EDI agreement, custom code, etc.) should be converted
 * and where it should be uploaded for Logic Apps Standard.
 *
 * Only include artifacts that need conversion or upload (schemas, maps,
 * EDI agreements, custom code, certificates). Do NOT include orchestrations,
 * pipelines, or bindings — those are handled by workflow generation.
 */
interface ArtifactDispositionEntry {
    /** Artifact name (e.g., 'TransformCustomerOrder.btm', 'CustomerOrder.xsd', 'Helper.dll') */
    artifactName: string;
    /** Artifact file type / extension (e.g., '.btm', '.xsd', '.dwl', '.cs', '.dll', 'edi-agreement') */
    artifactType: string;
    /** Whether conversion is required before deployment */
    conversionRequired: boolean;
    /** Source format (e.g., '.btm', 'BizTalk .xsd with annotations', 'DataWeave .dwl') */
    conversionFrom?: string;
    /** Target format (e.g., 'XSLT', 'Liquid template', 'clean .xsd', '.NET local function') */
    conversionTo?: string;
    /** Why the conversion is needed or why it is not needed */
    conversionNotes?: string;
    /** Where the artifact should be deployed / uploaded */
    uploadDestination:
        | 'integration-account'
        | 'logic-app-artifact-folder'
        | 'azure-function'
        | 'not-applicable';
    /** Specific sub-path within the destination (e.g., 'Artifacts/Maps', 'Artifacts/Schemas') */
    uploadPath?: string;
    /** Why this destination was chosen */
    uploadNotes?: string;
}

// =============================================================================
// Validation results
// =============================================================================

export interface PlanningFileValidation {
    valid: boolean;
    flowId: string;
    files: {
        name: string;
        exists: boolean;
        error?: string;
    }[];
    missingFiles: string[];
}

// =============================================================================
// Service
// =============================================================================

const PLANNING_BASE_DIR = '.vscode/migration/planning';

export class PlanningFileService {
    private static instance: PlanningFileService | undefined;
    private readonly logger = LoggingService.getInstance();

    private constructor() {}

    public static getInstance(): PlanningFileService {
        if (!PlanningFileService.instance) {
            PlanningFileService.instance = new PlanningFileService();
        }
        return PlanningFileService.instance;
    }

    // =========================================================================
    // Directory helpers
    // =========================================================================

    /** Get the base planning directory for all flows */
    private getBaseDir(): string | undefined {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return undefined;
        }
        return path.join(workspaceFolder.uri.fsPath, PLANNING_BASE_DIR);
    }

    /** Get the planning folder for a specific flow */
    public getFlowDir(flowId: string): string | undefined {
        const baseDir = this.getBaseDir();
        if (!baseDir) {
            return undefined;
        }
        const safe = flowId.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(baseDir, safe);
    }

    /** Ensure flow directory exists */
    private ensureFlowDir(flowId: string): string | undefined {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            this.logger.warn('[PlanningFiles] No workspace folder — cannot persist');
            return undefined;
        }
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    // =========================================================================
    // Write individual files
    // =========================================================================

    /** Store architecture diagram (Mermaid) */
    public storeArchitecture(flowId: string, mermaid: string): string | undefined {
        const dir = this.ensureFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, PLANNING_FILES.ARCHITECTURE);
        fs.writeFileSync(filePath, mermaid, 'utf-8');
        this.logger.info(`[PlanningFiles] Stored architecture.mmd for "${flowId}"`);
        return filePath;
    }

    /** Store workflow definition — supports multi-workflow by storing as workflow-{safeName}.json */
    public storeWorkflowDefinition(
        flowId: string,
        data: WorkflowDefinitionFile
    ): string | undefined {
        const dir = this.ensureFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        // Use per-workflow file name: workflow-{safeName}.json
        const safeName = data.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
        const fileName = `${PLANNING_FILES.WORKFLOW_PREFIX}${safeName}.json`;
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        this.logger.info(`[PlanningFiles] Stored ${fileName} for "${flowId}"`);
        return filePath;
    }

    /** Store azure components */
    public storeAzureComponents(
        flowId: string,
        components: AzureComponentEntry[]
    ): string | undefined {
        const dir = this.ensureFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, PLANNING_FILES.AZURE_COMPONENTS);
        fs.writeFileSync(filePath, JSON.stringify(components, null, 2), 'utf-8');
        this.logger.info(`[PlanningFiles] Stored azure-components.json for "${flowId}"`);
        return filePath;
    }

    /** Store action mappings */
    public storeActionMappings(flowId: string, mappings: ActionMappingEntry[]): string | undefined {
        const dir = this.ensureFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, PLANNING_FILES.ACTION_MAPPINGS);
        fs.writeFileSync(filePath, JSON.stringify(mappings, null, 2), 'utf-8');
        this.logger.info(`[PlanningFiles] Stored action-mappings.json for "${flowId}"`);
        return filePath;
    }

    /** Store gaps */
    public storeGaps(flowId: string, gaps: GapEntry[]): string | undefined {
        const dir = this.ensureFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, PLANNING_FILES.GAPS);
        fs.writeFileSync(filePath, JSON.stringify(gaps, null, 2), 'utf-8');
        this.logger.info(`[PlanningFiles] Stored gaps.json for "${flowId}"`);
        return filePath;
    }

    /** Store patterns */
    public storePatterns(flowId: string, patterns: PatternEntry[]): string | undefined {
        const dir = this.ensureFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, PLANNING_FILES.PATTERNS);
        fs.writeFileSync(filePath, JSON.stringify(patterns, null, 2), 'utf-8');
        this.logger.info(`[PlanningFiles] Stored patterns.json for "${flowId}"`);
        return filePath;
    }

    /** Store artifact dispositions */
    public storeArtifactDispositions(
        flowId: string,
        dispositions: ArtifactDispositionEntry[]
    ): string | undefined {
        const dir = this.ensureFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, PLANNING_FILES.ARTIFACT_DISPOSITIONS);
        fs.writeFileSync(filePath, JSON.stringify(dispositions, null, 2), 'utf-8');
        this.logger.info(`[PlanningFiles] Stored artifact-dispositions.json for "${flowId}"`);
        return filePath;
    }

    /** Store plan metadata */
    public storeMeta(flowId: string, meta: PlanMeta): string | undefined {
        const dir = this.ensureFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, PLANNING_FILES.META);
        fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf-8');
        this.logger.info(`[PlanningFiles] Stored plan-meta.json for "${flowId}"`);
        return filePath;
    }

    // =========================================================================
    // Read individual files
    // =========================================================================

    /** Read architecture diagram */
    public readArchitecture(flowId: string): string | undefined {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, PLANNING_FILES.ARCHITECTURE);
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        return fs.readFileSync(filePath, 'utf-8');
    }

    /** Read workflow definition — reads all workflow-*.json files (multi-workflow support) */
    public readWorkflowDefinition(flowId: string): WorkflowDefinitionFile | undefined {
        // Legacy: try single workflow-definition.json first
        const legacy = this.readJsonFile<WorkflowDefinitionFile>(
            flowId,
            PLANNING_FILES.WORKFLOW_DEFINITION
        );
        if (legacy) {
            return legacy;
        }
        // Multi-workflow: return the first workflow-*.json found
        const all = this.readAllWorkflowDefinitions(flowId);
        return all.length > 0 ? all[0] : undefined;
    }

    /** Read all workflow definition files for a flow (multi-workflow support) */
    public readAllWorkflowDefinitions(flowId: string): WorkflowDefinitionFile[] {
        const dir = this.getFlowDir(flowId);
        if (!dir || !fs.existsSync(dir)) {
            return [];
        }
        const results: WorkflowDefinitionFile[] = [];
        try {
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                if (entry.startsWith(PLANNING_FILES.WORKFLOW_PREFIX) && entry.endsWith('.json')) {
                    const data = this.readJsonFile<WorkflowDefinitionFile>(flowId, entry);
                    if (data) {
                        results.push(data);
                    }
                }
            }
            // Also check legacy single file
            if (results.length === 0) {
                const legacy = this.readJsonFile<WorkflowDefinitionFile>(
                    flowId,
                    PLANNING_FILES.WORKFLOW_DEFINITION
                );
                if (legacy) {
                    results.push(legacy);
                }
            }
        } catch {
            this.logger.warn(`[PlanningFiles] Failed to read workflow files for "${flowId}"`);
        }
        return results;
    }

    /** Check if at least one workflow definition exists */
    public hasWorkflowDefinitions(flowId: string): boolean {
        return this.readAllWorkflowDefinitions(flowId).length > 0;
    }

    /** Read azure components */
    public readAzureComponents(flowId: string): AzureComponentEntry[] | undefined {
        return this.readJsonFile<AzureComponentEntry[]>(flowId, PLANNING_FILES.AZURE_COMPONENTS);
    }

    /** Read action mappings */
    public readActionMappings(flowId: string): ActionMappingEntry[] | undefined {
        return this.readJsonFile<ActionMappingEntry[]>(flowId, PLANNING_FILES.ACTION_MAPPINGS);
    }

    /** Read gaps */
    public readGaps(flowId: string): GapEntry[] | undefined {
        return this.readJsonFile<GapEntry[]>(flowId, PLANNING_FILES.GAPS);
    }

    /** Read patterns */
    public readPatterns(flowId: string): PatternEntry[] | undefined {
        return this.readJsonFile<PatternEntry[]>(flowId, PLANNING_FILES.PATTERNS);
    }

    /** Read artifact dispositions */
    public readArtifactDispositions(flowId: string): ArtifactDispositionEntry[] | undefined {
        return this.readJsonFile<ArtifactDispositionEntry[]>(
            flowId,
            PLANNING_FILES.ARTIFACT_DISPOSITIONS
        );
    }

    /** Read plan metadata */
    public readMeta(flowId: string): PlanMeta | undefined {
        return this.readJsonFile<PlanMeta>(flowId, PLANNING_FILES.META);
    }

    // =========================================================================
    // Validation
    // =========================================================================

    /** Validate that all required planning files exist for a flow */
    public validate(flowId: string): PlanningFileValidation {
        const dir = this.getFlowDir(flowId);
        const files: PlanningFileValidation['files'] = [];
        const missingFiles: string[] = [];

        for (const fileName of REQUIRED_PLANNING_FILES) {
            if (!dir) {
                files.push({ name: fileName, exists: false, error: 'No workspace folder' });
                missingFiles.push(fileName);
                continue;
            }

            const filePath = path.join(dir, fileName);
            const exists = fs.existsSync(filePath);

            if (exists) {
                // Validate JSON files can be parsed
                if (fileName.endsWith('.json')) {
                    try {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        JSON.parse(content);
                        files.push({ name: fileName, exists: true });
                    } catch (e) {
                        files.push({
                            name: fileName,
                            exists: true,
                            error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
                        });
                        missingFiles.push(fileName);
                    }
                } else {
                    // .mmd file — check it's non-empty
                    const content = fs.readFileSync(filePath, 'utf-8');
                    if (content.trim().length === 0) {
                        files.push({ name: fileName, exists: true, error: 'File is empty' });
                        missingFiles.push(fileName);
                    } else {
                        files.push({ name: fileName, exists: true });
                    }
                }
            } else {
                files.push({ name: fileName, exists: false });
                missingFiles.push(fileName);
            }
        }

        // Also check optional azure-components.json (not required but report it)
        if (dir) {
            const azurePath = path.join(dir, PLANNING_FILES.AZURE_COMPONENTS);
            if (fs.existsSync(azurePath)) {
                try {
                    const content = fs.readFileSync(azurePath, 'utf-8');
                    JSON.parse(content);
                    files.push({ name: PLANNING_FILES.AZURE_COMPONENTS, exists: true });
                } catch (e) {
                    files.push({
                        name: PLANNING_FILES.AZURE_COMPONENTS,
                        exists: true,
                        error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
                    });
                }
            } else {
                files.push({ name: PLANNING_FILES.AZURE_COMPONENTS, exists: false });
            }
        }

        // Check for at least one workflow-*.json file
        const workflowDefs = this.readAllWorkflowDefinitions(flowId);
        if (workflowDefs.length === 0) {
            files.push({
                name: 'workflow-*.json',
                exists: false,
                error: 'No workflow definitions found',
            });
            missingFiles.push('workflow-*.json');
        } else {
            files.push({ name: `workflow-*.json (${workflowDefs.length} found)`, exists: true });
        }

        return {
            valid: missingFiles.length === 0,
            flowId,
            files,
            missingFiles,
        };
    }

    /** Check if a specific file has been stored for a flow */
    public hasFile(flowId: string, fileName: string): boolean {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            return false;
        }
        return fs.existsSync(path.join(dir, fileName));
    }

    // =========================================================================
    // List flows
    // =========================================================================

    /** List all flow IDs that have planning folders */
    public listFlowIds(): string[] {
        const baseDir = this.getBaseDir();
        if (!baseDir || !fs.existsSync(baseDir)) {
            return [];
        }
        try {
            return fs
                .readdirSync(baseDir, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);
        } catch {
            return [];
        }
    }

    // =========================================================================
    // Cleanup
    // =========================================================================

    /** Remove all planning files for a flow */
    public removeFlow(flowId: string): void {
        const dir = this.getFlowDir(flowId);
        if (!dir || !fs.existsSync(dir)) {
            return;
        }
        try {
            fs.rmSync(dir, { recursive: true, force: true });
            this.logger.info(`[PlanningFiles] Removed planning folder for "${flowId}"`);
        } catch (error) {
            this.logger.warn(`[PlanningFiles] Failed to remove planning folder for "${flowId}"`, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /** Remove the entire planning base directory (all flows) */
    public removeAll(): void {
        const baseDir = this.getBaseDir();
        if (!baseDir || !fs.existsSync(baseDir)) {
            return;
        }
        try {
            fs.rmSync(baseDir, { recursive: true, force: true });
            this.logger.info('[PlanningFiles] Removed entire planning directory');
        } catch (error) {
            this.logger.warn('[PlanningFiles] Failed to remove planning directory', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    // =========================================================================
    // Internals
    // =========================================================================

    private readJsonFile<T>(flowId: string, fileName: string): T | undefined {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, fileName);
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content) as T;
        } catch (e) {
            this.logger.warn(
                `[PlanningFiles] Failed to parse ${fileName} for "${flowId}": ${e instanceof Error ? e.message : String(e)}`
            );
            return undefined;
        }
    }

    /** Reset singleton (for tests) */
    public static resetInstance(): void {
        PlanningFileService.instance = undefined;
    }
}
