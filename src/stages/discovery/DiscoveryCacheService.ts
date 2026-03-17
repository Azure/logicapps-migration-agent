/**
 * Discovery Cache Service
 *
 * Manages per-flow discovery result caching on disk.
 * Each flow's analysis result is stored as a separate JSON file under
 * `.vscode/migration/discovery/{flowId}/analysis.json`.
 * Flow group definitions (with per-flow discovery status) are stored
 * in `.vscode/migration/discovery/flow-groups.json`.
 *
 * @module stages/discovery/DiscoveryCacheService
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { FlowGroupsResult, FlowGroup } from '../../services/LLMFlowGenerator';
import { PlanningCacheService } from '../planning/PlanningCacheService';
import { ConversionFileService } from '../conversion/ConversionFileService';

// =============================================================================
// Types
// =============================================================================

/**
 * Extended flow group with discovery status.
 */
export interface DiscoveryFlowGroup extends FlowGroup {
    /** Whether this flow has been analysed / discovered */
    discovered: boolean;
    /** Whether this flow has a finalized migration plan */
    planned?: boolean;
    /** Whether this flow has conversion tasks created (task plan generated) */
    tasksCreated?: boolean;
    /** Whether this flow has completed all conversion tasks */
    converted?: boolean;
}

/**
 * Flow groups result with per-flow discovery status.
 */
export interface DiscoveryFlowGroupsResult {
    groups: DiscoveryFlowGroup[];
    ungroupedArtifactIds: string[];
    explanation: string;
}

/**
 * A cached per-flow analysis result (the GeneratedFlowResult shape).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DiscoveryAnalysisResult = Record<string, any>;

// =============================================================================
// Constants
// =============================================================================

const DISCOVERY_DIR = '.vscode/migration/discovery';
const FLOW_GROUPS_FILENAME = 'flow-groups.json';
const ANALYSIS_FILENAME = 'analysis.json';

// Partial file names for multi-step discovery storage
const META_FILENAME = 'meta.json';
const ARCHITECTURE_FILENAME = 'architecture.mmd';
const MESSAGE_FLOW_FILENAME = 'messageFlow.json';
const COMPONENTS_FILENAME = 'components.json';
const GAPS_FILENAME = 'gaps.json';
const PATTERNS_FILENAME = 'patterns.json';
const DEPENDENCIES_FILENAME = 'dependencies.json';

// =============================================================================
// Discovery Cache Service
// =============================================================================

export class DiscoveryCacheService {
    private static instance: DiscoveryCacheService | undefined;
    private readonly logger = LoggingService.getInstance();

    /** In-memory cache of flow groups */
    private flowGroupsCache: DiscoveryFlowGroupsResult | undefined;
    /** In-memory cache of per-flow analysis results */
    private analysisCache = new Map<string, DiscoveryAnalysisResult>();

    private loaded = false;

    private constructor() {}

    public static getInstance(): DiscoveryCacheService {
        if (!DiscoveryCacheService.instance) {
            DiscoveryCacheService.instance = new DiscoveryCacheService();
        }
        return DiscoveryCacheService.instance;
    }

    // =========================================================================
    // Flow Groups
    // =========================================================================

    /**
     * Store flow groups (from initial detection).
     * Sets all flows to `discovered: false` unless they already have analysis on disk.
     */
    public async storeFlowGroups(flowGroupsResult: FlowGroupsResult): Promise<void> {
        const discoveryGroups: DiscoveryFlowGroup[] = flowGroupsResult.groups.map((g) => ({
            ...g,
            discovered: this.hasAnalysis(g.id),
        }));

        this.flowGroupsCache = {
            groups: discoveryGroups,
            ungroupedArtifactIds: flowGroupsResult.ungroupedArtifactIds,
            explanation: flowGroupsResult.explanation,
        };

        await this.saveFlowGroupsToDisk();
        this.logger.info(`[DiscoveryCache] Stored ${discoveryGroups.length} flow groups`);
    }

    /**
     * Get the flow groups (lazy-loads from disk on first access).
     */
    public getFlowGroups(): DiscoveryFlowGroupsResult | undefined {
        this.ensureLoaded();
        return this.flowGroupsCache;
    }

    /**
     * Check if flow groups have been detected.
     */
    public hasFlowGroups(): boolean {
        this.ensureLoaded();
        return !!this.flowGroupsCache && this.flowGroupsCache.groups.length > 0;
    }

    /**
     * Get a specific flow group by ID.
     */
    public getFlowGroup(flowId: string): DiscoveryFlowGroup | undefined {
        this.ensureLoaded();
        return this.flowGroupsCache?.groups.find((g) => g.id === flowId);
    }

    /**
     * Mark a flow as discovered and persist.
     */
    public async markFlowDiscovered(flowId: string): Promise<void> {
        this.ensureLoaded();
        if (!this.flowGroupsCache) {
            return;
        }

        const group = this.flowGroupsCache.groups.find((g) => g.id === flowId);
        if (group) {
            group.discovered = true;
            await this.saveFlowGroupsToDisk();
            this.logger.info(`[DiscoveryCache] Marked flow "${flowId}" as discovered`);
        }
    }

    /**
     * Mark a flow as planned and persist.
     */
    public async markFlowPlanned(flowId: string): Promise<void> {
        this.ensureLoaded();
        if (!this.flowGroupsCache) {
            return;
        }

        const group = this.flowGroupsCache.groups.find((g) => g.id === flowId);
        if (group) {
            group.planned = true;
            await this.saveFlowGroupsToDisk();
            this.logger.info(`[DiscoveryCache] Marked flow "${flowId}" as planned`);
        }
    }

    /**
     * Mark a flow as having conversion tasks created and persist.
     */
    public async markFlowTasksCreated(flowId: string): Promise<void> {
        this.ensureLoaded();
        if (!this.flowGroupsCache) {
            return;
        }

        const group = this.flowGroupsCache.groups.find((g) => g.id === flowId);
        if (group) {
            group.tasksCreated = true;
            await this.saveFlowGroupsToDisk();
            this.logger.info(`[DiscoveryCache] Marked flow "${flowId}" as tasksCreated`);
        }
    }

    /**
     * Mark a flow as fully converted (all tasks completed) and persist.
     */
    public async markFlowConverted(flowId: string): Promise<void> {
        this.ensureLoaded();
        if (!this.flowGroupsCache) {
            return;
        }

        const group = this.flowGroupsCache.groups.find((g) => g.id === flowId);
        if (group) {
            group.converted = true;
            await this.saveFlowGroupsToDisk();
            this.logger.info(`[DiscoveryCache] Marked flow "${flowId}" as converted`);
        }
    }

    /**
     * Check if at least one flow is discovered.
     */
    public hasAnyDiscoveredFlow(): boolean {
        this.ensureLoaded();
        return !!this.flowGroupsCache?.groups.some((g) => g.discovered);
    }

    // =========================================================================
    // Per-Flow Analysis
    // =========================================================================

    /**
     * Store analysis result for a flow. Writes to disk immediately.
     */
    public async storeAnalysis(flowId: string, result: DiscoveryAnalysisResult): Promise<void> {
        this.analysisCache.set(flowId, result);

        const dir = this.getDiscoveryDir();
        if (!dir) {
            this.logger.warn('[DiscoveryCache] No workspace folder — cannot persist to disk');
            return;
        }

        try {
            const flowDir = path.join(dir, this.sanitizeId(flowId));
            if (!fs.existsSync(flowDir)) {
                fs.mkdirSync(flowDir, { recursive: true });
            }

            const filePath = path.join(flowDir, ANALYSIS_FILENAME);
            fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
            this.logger.info(`[DiscoveryCache] Saved analysis for flow "${flowId}" → ${filePath}`);
        } catch (error) {
            this.logger.error('[DiscoveryCache] Failed to save analysis', error as Error);
        }

        // Also mark as discovered in flow groups
        await this.markFlowDiscovered(flowId);
    }

    /**
     * Get the cached analysis result for a flow.
     * Loads from disk on first access.
     */
    public getAnalysis(flowId: string): DiscoveryAnalysisResult | undefined {
        this.ensureLoaded();

        // Check memory first
        if (this.analysisCache.has(flowId)) {
            return this.analysisCache.get(flowId);
        }

        // Try loading from disk
        const dir = this.getDiscoveryDir();
        if (!dir) {
            return undefined;
        }

        const filePath = path.join(dir, this.sanitizeId(flowId), ANALYSIS_FILENAME);
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                this.analysisCache.set(flowId, data);
                return data;
            }
        } catch (error) {
            this.logger.warn(`[DiscoveryCache] Failed to read analysis for "${flowId}": ${error}`);
        }

        return undefined;
    }

    /**
     * Check if analysis exists for a flow (memory or disk).
     */
    public hasAnalysis(flowId: string): boolean {
        if (this.analysisCache.has(flowId)) {
            return true;
        }

        const dir = this.getDiscoveryDir();
        if (!dir) {
            return false;
        }

        const filePath = path.join(dir, this.sanitizeId(flowId), ANALYSIS_FILENAME);
        return fs.existsSync(filePath);
    }

    /**
     * Remove analysis for a flow.
     */
    public async removeAnalysis(flowId: string): Promise<void> {
        this.analysisCache.delete(flowId);

        const dir = this.getDiscoveryDir();
        if (!dir) {
            return;
        }

        const flowDir = path.join(dir, this.sanitizeId(flowId));
        try {
            if (fs.existsSync(flowDir)) {
                fs.rmSync(flowDir, { recursive: true, force: true });
                this.logger.info(`[DiscoveryCache] Removed analysis for flow "${flowId}"`);
            }
        } catch (error) {
            this.logger.warn(`[DiscoveryCache] Failed to remove analysis: ${error}`);
        }

        // Update flow group status
        this.ensureLoaded();
        const group = this.flowGroupsCache?.groups.find((g) => g.id === flowId);
        if (group) {
            group.discovered = false;
            await this.saveFlowGroupsToDisk();
        }
    }

    // =========================================================================
    // Partial (Multi-Step) Storage
    // =========================================================================

    /**
     * Write a partial file for a flow (meta, messageFlow, components, gaps, patterns).
     */
    public storePartial(flowId: string, filename: string, data: unknown): void {
        const dir = this.getDiscoveryDir();
        if (!dir) {
            return;
        }
        const flowDir = path.join(dir, this.sanitizeId(flowId));
        if (!fs.existsSync(flowDir)) {
            fs.mkdirSync(flowDir, { recursive: true });
        }
        const filePath = path.join(flowDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        this.logger.info(`[DiscoveryCache] Stored partial ${filename} for flow "${flowId}"`);
    }

    /**
     * Read a partial file for a flow.
     */
    public readPartial<T = unknown>(flowId: string, filename: string): T | undefined {
        const dir = this.getDiscoveryDir();
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, this.sanitizeId(flowId), filename);
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
            }
        } catch {
            // ignore corrupt files
        }
        return undefined;
    }

    /** Store discovery meta (explanation, summary, title). */
    public storeMeta(flowId: string, meta: Record<string, unknown>): void {
        this.storePartial(flowId, META_FILENAME, meta);
    }

    /** Read discovery meta. */
    public readMeta(flowId: string): Record<string, unknown> | undefined {
        return this.readPartial(flowId, META_FILENAME);
    }

    /** Store architecture Mermaid diagram as raw .mmd file. */
    public storeArchitecture(flowId: string, mermaid: string): void {
        const dir = this.getDiscoveryDir();
        if (!dir) {
            return;
        }
        const flowDir = path.join(dir, this.sanitizeId(flowId));
        if (!fs.existsSync(flowDir)) {
            fs.mkdirSync(flowDir, { recursive: true });
        }
        const filePath = path.join(flowDir, ARCHITECTURE_FILENAME);
        fs.writeFileSync(filePath, mermaid, 'utf-8');
        this.logger.info(`[DiscoveryCache] Stored architecture.mmd for flow "${flowId}"`);
    }

    /** Read architecture Mermaid diagram from .mmd file. */
    public readArchitecture(flowId: string): string | undefined {
        const dir = this.getDiscoveryDir();
        if (!dir) {
            return undefined;
        }
        const filePath = path.join(dir, this.sanitizeId(flowId), ARCHITECTURE_FILENAME);
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }
        } catch {
            // ignore
        }
        return undefined;
    }

    /** Store message flow steps. */
    public storeMessageFlow(flowId: string, messageFlow: unknown[]): void {
        this.storePartial(flowId, MESSAGE_FLOW_FILENAME, messageFlow);
    }

    /** Read message flow steps. */
    public readMessageFlow(flowId: string): unknown[] | undefined {
        return this.readPartial(flowId, MESSAGE_FLOW_FILENAME);
    }

    /** Store component details. */
    public storeComponents(flowId: string, components: unknown[]): void {
        this.storePartial(flowId, COMPONENTS_FILENAME, components);
    }

    /** Read component details. */
    public readComponents(flowId: string): unknown[] | undefined {
        return this.readPartial(flowId, COMPONENTS_FILENAME);
    }

    /** Store gap analysis. */
    public storeGaps(flowId: string, gaps: unknown[]): void {
        this.storePartial(flowId, GAPS_FILENAME, gaps);
    }

    /** Read gap analysis. */
    public readGaps(flowId: string): unknown[] | undefined {
        return this.readPartial(flowId, GAPS_FILENAME);
    }

    /** Store migration patterns. */
    public storePatterns(flowId: string, patterns: unknown[]): void {
        this.storePartial(flowId, PATTERNS_FILENAME, patterns);
    }

    /** Read migration patterns. */
    public readPatterns(flowId: string): unknown[] | undefined {
        return this.readPartial(flowId, PATTERNS_FILENAME);
    }

    /** Store dependency analysis (missing dependencies that block implementation). */
    public storeDependencies(flowId: string, dependencyAnalysis: Record<string, unknown>): void {
        this.storePartial(flowId, DEPENDENCIES_FILENAME, dependencyAnalysis);
    }

    /** Read dependency analysis. */
    public readDependencies(flowId: string): Record<string, unknown> | undefined {
        return this.readPartial(flowId, DEPENDENCIES_FILENAME);
    }

    /**
     * Validate that all required partial files exist for a flow.
     */
    public validatePartials(flowId: string): { valid: boolean; missing: string[] } {
        const missing: string[] = [];
        if (!this.readMeta(flowId)) {
            missing.push('meta');
        }
        if (!this.readArchitecture(flowId)) {
            missing.push('architecture');
        }
        if (!this.readMessageFlow(flowId)) {
            missing.push('messageFlow');
        }
        if (!this.readComponents(flowId)) {
            missing.push('components');
        }
        // gaps and patterns are optional
        return { valid: missing.length === 0, missing };
    }

    /**
     * Assemble all partial files into a complete analysis.json and persist.
     * Returns the assembled result or undefined if partials are incomplete.
     */
    public async assembleAndStore(flowId: string): Promise<DiscoveryAnalysisResult | undefined> {
        const validation = this.validatePartials(flowId);
        if (!validation.valid) {
            this.logger.warn(
                `[DiscoveryCache] Cannot assemble analysis for "${flowId}": missing ${validation.missing.join(', ')}`
            );
            return undefined;
        }

        const meta = this.readMeta(flowId) || {};
        const mermaid = this.readArchitecture(flowId) || '';
        const rawMessageFlow = (this.readMessageFlow(flowId) || []) as Record<string, unknown>[];
        const rawComponents = (this.readComponents(flowId) || []) as Record<string, unknown>[];
        const rawGaps = (this.readGaps(flowId) || []) as Record<string, unknown>[];
        const rawPatterns = (this.readPatterns(flowId) || []) as Record<string, unknown>[];
        const rawDependencies = this.readDependencies(flowId) || {};

        // Normalize component details (match GeneratedFlowResult.componentDetails shape)
        const componentDetails = rawComponents.map((c) => ({
            id: (c.id as string) || '',
            name: (c.name as string) || '',
            type: (c.type as string) || '',
            description: (c.description as string) ?? '',
            purpose: (c.purpose as string) ?? '',
            inputMessageType: (c.inputMessageType as string) ?? '',
            outputMessageType: (c.outputMessageType as string) ?? '',
            connectedTo: (c.connectedTo as string[]) ?? [],
            azureEquivalent: (c.azureEquivalent as string) ?? '',
            isLogicAppsNative: (c.isLogicAppsNative as boolean) ?? false,
            properties: c.properties,
        }));

        // Normalize message flow steps (match GeneratedFlowResult.messageFlow shape)
        const messageFlow = rawMessageFlow.map((m) => ({
            step: m.step as number,
            component: (m.component as string) || '',
            componentType: (m.componentType as string) || '',
            action: (m.action as string) || '',
            messageType: (m.messageType as string) ?? '',
            description: (m.description as string) ?? '',
            pipelineComponents: Array.isArray(m.pipelineComponents)
                ? (m.pipelineComponents as Record<string, unknown>[]).map((p) => ({
                      name: (p.name as string) || '',
                      stage: (p.stage as string) || 'Validate',
                      description: (p.description as string) ?? '',
                      properties: p.properties,
                  }))
                : undefined,
            properties: Array.isArray(m.properties)
                ? (m.properties as Record<string, unknown>[]).map((p) => ({
                      name: (p.name as string) || '',
                      namespace: p.namespace as string,
                      type: (p.type as string) || 'promoted',
                      source: p.source as string,
                      value: p.value as string,
                  }))
                : undefined,
            subscriptionFilter: m.subscriptionFilter
                ? {
                      expression:
                          ((m.subscriptionFilter as Record<string, unknown>)
                              .expression as string) ?? '',
                      readableExpression:
                          ((m.subscriptionFilter as Record<string, unknown>)
                              .readableExpression as string) ?? '',
                      conditions: Array.isArray(
                          (m.subscriptionFilter as Record<string, unknown>).conditions
                      )
                          ? (
                                (m.subscriptionFilter as Record<string, unknown>)
                                    .conditions as Record<string, unknown>[]
                            ).map((c) => ({
                                property: c.property as string,
                                operator: c.operator as string,
                                value: c.value as string,
                            }))
                          : [],
                  }
                : undefined,
            additionalDetails: m.additionalDetails,
        }));

        // Normalize gap analysis
        const gapAnalysis = rawGaps.map((g) => ({
            component: (g.component as string) || '',
            componentType: g.componentType as string,
            gap: (g.gap as string) || '',
            severity: (g.severity as string) || 'medium',
            options: (g.options as string[]) || [],
            recommendation: (g.recommendation as string) || '',
        }));

        // Normalize migration patterns
        const migrationPatterns = rawPatterns.map((p) => ({
            pattern: (p.pattern as string) || '',
            description: (p.description as string) || '',
            complexity: (p.complexity as string) || 'medium',
            biztalkApproach: (p.biztalkApproach as string) || '',
            logicAppsApproach: (p.logicAppsApproach as string) || '',
            components: (p.components as string[]) || [],
        }));

        // Normalize summary
        const rawSummary = (meta.summary || {}) as Record<string, unknown>;
        const summary = {
            receiveLocations: (rawSummary.receiveLocations as string[]) ?? [],
            receivePipelines: (rawSummary.receivePipelines as string[]) ?? [],
            receivePorts: (rawSummary.receivePorts as string[]) ?? [],
            orchestrations: (rawSummary.orchestrations as string[]) ?? [],
            maps: (rawSummary.maps as string[]) ?? [],
            schemas: (rawSummary.schemas as string[]) ?? [],
            sendPorts: (rawSummary.sendPorts as string[]) ?? [],
            sendPipelines: (rawSummary.sendPipelines as string[]) ?? [],
        };

        // Normalize dependency analysis
        const rawMissingDeps = Array.isArray(rawDependencies.missingDependencies)
            ? (rawDependencies.missingDependencies as Record<string, unknown>[])
            : [];
        const dependencyAnalysis =
            rawMissingDeps.length > 0
                ? {
                      missingDependencies: rawMissingDeps.map((d) => ({
                          id: (d.id as string) || '',
                          name: (d.name as string) || '',
                          type: (d.type as string) || 'other',
                          origin: (d.origin as string) || 'unknown',
                          platform: d.platform as string,
                          version: d.version as string,
                          referencedBy: (d.referencedBy as string[]) || [],
                          affectedFlowGroups: d.affectedFlowGroups as string[],
                          reason: (d.reason as string) || '',
                          severity: (d.severity as string) || 'warning',
                          expectedLocation: d.expectedLocation as string,
                          resolution: d.resolution as string,
                          blocksMigration: (d.blocksMigration as boolean) ?? false,
                          migrationRelevant: (d.migrationRelevant as boolean) ?? true,
                      })),
                      summary: (rawDependencies.summary as string) || '',
                      allCriticalResolved: (rawDependencies.allCriticalResolved as boolean) ?? true,
                      counts: (rawDependencies.counts as Record<string, number>) || {
                          critical: 0,
                          warning: 0,
                          info: 0,
                      },
                  }
                : undefined;

        const result: DiscoveryAnalysisResult = {
            mermaid,
            explanation: (meta.explanation as string) || '',
            summary,
            componentDetails,
            messageFlow,
            notes: meta.notes || [],
            gapAnalysis,
            migrationPatterns,
            ...(dependencyAnalysis ? { dependencyAnalysis } : {}),
        };

        await this.storeAnalysis(flowId, result);
        return result;
    }

    // =========================================================================
    // Reset / Clear
    // =========================================================================

    /**
     * Clear all discovery cache (memory + disk).
     */
    public async clearAll(): Promise<void> {
        this.flowGroupsCache = undefined;
        this.analysisCache.clear();
        this.loaded = false;

        const dir = this.getDiscoveryDir();
        if (dir && fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
                this.logger.info('[DiscoveryCache] Cleared all discovery cache');
            } catch (error) {
                this.logger.warn(`[DiscoveryCache] Failed to clear cache: ${error}`);
            }
        }
    }

    // =========================================================================
    // Internal
    // =========================================================================

    private ensureLoaded(): void {
        if (this.loaded) {
            return;
        }
        this.loaded = true;
        this.loadFromDisk();
        this.reconcileFlowStates();
    }

    /**
     * Reconcile planned/converted flags by checking PlanningCacheService and ConversionFileService.
     * This handles the case where planning/conversion happened outside the flow group UI.
     */
    private reconcileFlowStates(): void {
        if (!this.flowGroupsCache) {
            return;
        }

        let dirty = false;
        for (const group of this.flowGroupsCache.groups) {
            // Check if planned (lazy — imports on demand)
            if (!group.planned) {
                try {
                    const planningCache = PlanningCacheService.getInstance();
                    if (planningCache.has(group.id)) {
                        group.planned = true;
                        dirty = true;
                        this.logger.debug(
                            `[DiscoveryCache] Reconciled: flow "${group.id}" is planned`
                        );
                    }
                } catch {
                    // PlanningCacheService not available
                }
            }

            // Check if tasks created / converted
            if (!group.tasksCreated || !group.converted) {
                try {
                    const convFileService = ConversionFileService.getInstance();
                    const diskPlan = convFileService.readTaskPlan(group.id);
                    if (diskPlan) {
                        if (!group.tasksCreated) {
                            group.tasksCreated = true;
                            dirty = true;
                            this.logger.debug(
                                `[DiscoveryCache] Reconciled: flow "${group.id}" has tasksCreated`
                            );
                        }
                        // Check if all required tasks are completed
                        const allDone = diskPlan.tasks.every(
                            (t: { status: string; optional?: boolean }) =>
                                t.status === 'completed' ||
                                t.status === 'skipped' ||
                                (t.optional && t.status === 'pending')
                        );
                        if (allDone && !group.converted) {
                            group.converted = true;
                            dirty = true;
                            this.logger.debug(
                                `[DiscoveryCache] Reconciled: flow "${group.id}" is converted`
                            );
                        }
                    }
                } catch {
                    // ConversionFileService not available
                }
            }
        }

        if (dirty) {
            // Fire-and-forget save
            void this.saveFlowGroupsToDisk();
        }
    }

    private loadFromDisk(): void {
        const dir = this.getDiscoveryDir();
        if (!dir) {
            return;
        }

        // Load flow groups
        const flowGroupsPath = path.join(dir, FLOW_GROUPS_FILENAME);
        try {
            if (fs.existsSync(flowGroupsPath)) {
                const data = JSON.parse(fs.readFileSync(flowGroupsPath, 'utf-8'));
                this.flowGroupsCache = data;
                this.logger.info(
                    `[DiscoveryCache] Loaded flow groups from disk (${data?.groups?.length ?? 0} groups)`
                );
            }
        } catch (error) {
            this.logger.warn(`[DiscoveryCache] Failed to load flow groups: ${error}`);
        }

        // Scan for per-flow analysis directories
        try {
            if (fs.existsSync(dir)) {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const analysisPath = path.join(dir, entry.name, ANALYSIS_FILENAME);
                        if (fs.existsSync(analysisPath)) {
                            try {
                                const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
                                this.analysisCache.set(entry.name, data);
                            } catch {
                                // skip corrupt files
                            }
                        }
                    }
                }
                if (this.analysisCache.size > 0) {
                    this.logger.info(
                        `[DiscoveryCache] Loaded ${this.analysisCache.size} flow analyses from disk`
                    );
                }
            }
        } catch (error) {
            this.logger.warn(`[DiscoveryCache] Failed to scan analysis dirs: ${error}`);
        }
    }

    private async saveFlowGroupsToDisk(): Promise<void> {
        if (!this.flowGroupsCache) {
            return;
        }

        const dir = this.getDiscoveryDir();
        if (!dir) {
            return;
        }

        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const filePath = path.join(dir, FLOW_GROUPS_FILENAME);
            fs.writeFileSync(filePath, JSON.stringify(this.flowGroupsCache, null, 2), 'utf-8');
        } catch (error) {
            this.logger.error('[DiscoveryCache] Failed to save flow groups', error as Error);
        }
    }

    private getDiscoveryDir(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        return path.join(workspaceFolders[0].uri.fsPath, DISCOVERY_DIR);
    }

    private sanitizeId(id: string): string {
        return id.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    /**
     * Reset singleton (for tests).
     */
    public static resetInstance(): void {
        DiscoveryCacheService.instance = undefined;
    }
}
