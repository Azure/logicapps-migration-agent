/**
 * Planning Service
 *
 * Main orchestrator for the Planning stage. Retrieves discovered flows
 * from the Discovery stage, allows users to select flows for planning,
 * and coordinates migration plan generation.
 *
 * @module stages/planning/PlanningService
 */

import * as vscode from 'vscode';
import { LoggingService } from '../../services/LoggingService';
import { StorageService, StorageKeys } from '../../services/StorageService';
import { InventoryService } from '../discovery/InventoryService';
import { SourceFlowVisualizer } from '../../views/discovery/SourceFlowVisualizer';
import { PlanningFlow, PlanningStageState, FlowMigrationPlan } from './types';
import { PlanningCacheService } from './PlanningCacheService';

// =============================================================================
// Planning Service Events
// =============================================================================

/**
 * Fired when the planning state changes (flow selected, plan generated, etc.)
 */
interface PlanningStateChangeEvent {
    /** What changed */
    type: 'flow-selected' | 'plan-generated' | 'plan-approved' | 'flows-loaded';

    /** Flow ID if relevant */
    flowId?: string;
}

// =============================================================================
// Planning Service
// =============================================================================

/**
 * Main service for the Planning stage.
 */
export class PlanningService implements vscode.Disposable {
    private static instance: PlanningService | undefined;

    private readonly logger = LoggingService.getInstance();

    // Event emitters
    private readonly _onStateChange = new vscode.EventEmitter<PlanningStateChangeEvent>();
    public readonly onStateChange = this._onStateChange.event;

    private readonly disposables: vscode.Disposable[] = [];

    // Planning state
    private state: PlanningStageState | undefined;

    private constructor() {
        this.disposables.push(this._onStateChange);
    }

    /**
     * Get the singleton instance.
     */
    public static getInstance(): PlanningService {
        if (!PlanningService.instance) {
            PlanningService.instance = new PlanningService();
        }
        return PlanningService.instance;
    }

    /**
     * Initialize the planning service.
     */
    public async initialize(): Promise<void> {
        // Restore planning state from storage
        await this.loadStateFromStorage();

        this.logger.info('Planning service initialized');
    }

    // =========================================================================
    // Flow Management
    // =========================================================================

    /**
     * Build the list of plannable flows from discovery results.
     * Uses flow groups from SourceFlowVisualizer if available,
     * otherwise falls back to inventory items.
     */
    public buildFlowsFromDiscovery(): PlanningFlow[] {
        const inventoryService = InventoryService.getInstance();
        const inventory = inventoryService.getInventory();

        if (!inventory || inventory.items.length === 0) {
            this.logger.warn('No inventory available for planning');
            return [];
        }

        const flows: PlanningFlow[] = [];

        // Try to use flow groups from source flow visualizer (LLM-generated groups)
        const flowGroupsResult = SourceFlowVisualizer.getStaticCachedFlowGroups();

        if (flowGroupsResult && flowGroupsResult.groups.length > 0) {
            // Use structured flow groups
            for (const group of flowGroupsResult.groups) {
                const existingStatus = this.state?.flows.find((f) => f.id === group.id)?.status;
                flows.push({
                    id: group.id,
                    name: group.name,
                    description: group.description,
                    category: group.category,
                    artifactCount: group.artifactIds.length,
                    artifactIds: group.artifactIds,
                    status: existingStatus || 'not-started',
                });
            }

            // Merge all ungrouped artifacts into a single planning entry
            if (flowGroupsResult.ungroupedArtifactIds.length > 0) {
                const validIds: string[] = [];
                for (const artifactId of flowGroupsResult.ungroupedArtifactIds) {
                    const item = inventoryService.getItem(artifactId);
                    if (item) {
                        validIds.push(artifactId);
                    }
                }
                if (validIds.length > 0) {
                    const existingStatus = this.state?.flows.find(
                        (f) => f.id === 'ungrouped-artifacts'
                    )?.status;
                    flows.push({
                        id: 'ungrouped-artifacts',
                        name: 'Shared & Supporting Artifacts',
                        description: `${validIds.length} ungrouped artifacts (schemas, pipelines, dependencies, etc.) to be planned together`,
                        category: 'shared-infrastructure',
                        artifactCount: validIds.length,
                        artifactIds: validIds,
                        status: existingStatus || 'not-started',
                    });
                }
            }
        } else if (this.state?.flows && this.state.flows.length > 0) {
            // After restart the SourceFlowVisualizer in-memory cache is empty,
            // but we already have flows persisted in state (from a previous session).
            // Preserve them instead of falling back to raw inventory items which
            // would have different IDs and lose all status / plan associations.
            this.logger.info(
                `[PlanningService] Reusing ${this.state.flows.length} persisted flows (flow groups not in memory)`
            );
            flows.push(...this.state.flows);
        } else {
            // Fallback: treat each orchestration/flow/process as a plannable flow
            for (const item of inventory.items) {
                const isFlow = ['orchestration', 'flow', 'process', 'workflow'].includes(
                    item.category
                );
                if (isFlow) {
                    const existingStatus = this.state?.flows.find((f) => f.id === item.id)?.status;
                    flows.push({
                        id: item.id,
                        name: item.name,
                        description: `${item.category} artifact`,
                        category: item.category,
                        artifactCount: 1,
                        artifactIds: [item.id],
                        complexity: item.metadata.complexity,
                        status: existingStatus || 'not-started',
                    });
                }
            }

            // If no flow-type artifacts, include all items
            if (flows.length === 0) {
                for (const item of inventory.items) {
                    const existingStatus = this.state?.flows.find((f) => f.id === item.id)?.status;
                    flows.push({
                        id: item.id,
                        name: item.name,
                        description: `${item.category} artifact`,
                        category: item.category,
                        artifactCount: 1,
                        artifactIds: [item.id],
                        complexity: item.metadata.complexity,
                        status: existingStatus || 'not-started',
                    });
                }
            }
        }

        // Update state
        this.state = {
            flows,
            plans: this.state?.plans || {},
            selectedFlowId: this.state?.selectedFlowId,
            startedAt: this.state?.startedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Reconcile flow status with stored plans:
        // Check both in-memory state.plans AND the disk-based PlanningCacheService.
        // After a restart, state.plans may be empty but the cache has plans on disk.
        const plans = this.state.plans;
        const cacheService = PlanningCacheService.getInstance();
        for (const flow of this.state.flows) {
            const hasPlanInState = !!plans[flow.id];
            const hasPlanOnDisk = cacheService.has(flow.id);
            if (
                (hasPlanInState || hasPlanOnDisk) &&
                (flow.status === 'in-progress' || flow.status === 'not-started')
            ) {
                this.logger.info(
                    `[PlanningService] Correcting flow "${flow.id}" status from "${flow.status}" to "planned" (plan exists: state=${hasPlanInState}, disk=${hasPlanOnDisk})`
                );
                flow.status = 'planned';
            }
        }

        void this.saveStateToStorage();
        this._onStateChange.fire({ type: 'flows-loaded' });

        this.logger.info(`Built ${flows.length} plannable flows from discovery`);
        return flows;
    }

    /**
     * Get the current planning state.
     */
    public getState(): PlanningStageState | undefined {
        return this.state;
    }

    /**
     * Get all plannable flows.
     */
    public getFlows(): PlanningFlow[] {
        return this.state?.flows || [];
    }

    /**
     * Select a flow for planning.
     */
    public async selectFlow(flowId: string): Promise<void> {
        if (!this.state) {
            this.buildFlowsFromDiscovery();
        }

        if (this.state) {
            this.state.selectedFlowId = flowId;
            this.state.updatedAt = new Date().toISOString();

            // Mark the flow as in-progress only if it has been analyzed in Discovery
            const flow = this.state.flows.find((f) => f.id === flowId);
            if (flow && flow.status === 'not-started') {
                const isAnalyzed =
                    flow.id === 'ungrouped-artifacts' ||
                    !!SourceFlowVisualizer.getGroupAnalysis(flow.id);
                if (isAnalyzed) {
                    flow.status = 'in-progress';
                }
            }

            await this.saveStateToStorage();
            this._onStateChange.fire({ type: 'flow-selected', flowId });
        }
    }

    /**
     * Store a generated plan for a flow.
     */
    public async storePlan(flowId: string, plan: FlowMigrationPlan): Promise<void> {
        if (!this.state) {
            this.buildFlowsFromDiscovery();
        }

        if (this.state) {
            this.state.plans[flowId] = plan;
            this.state.updatedAt = new Date().toISOString();

            // Update flow status
            const flow = this.state.flows.find((f) => f.id === flowId);
            if (flow) {
                flow.status = 'planned';
            }

            await this.saveStateToStorage();
            this._onStateChange.fire({ type: 'plan-generated', flowId });
        }
    }

    /**
     * Get the plan for a specific flow.
     */
    public getPlan(flowId: string): FlowMigrationPlan | undefined {
        return this.state?.plans[flowId];
    }

    /**
     * Reset planning state.
     */
    public async reset(): Promise<void> {
        this.state = undefined;
        const storage = StorageService.getInstance();
        await storage.setWorkspace(StorageKeys.MIGRATION_PLAN, undefined);
        this.logger.info('Planning state reset');
    }

    // =========================================================================
    // Persistence
    // =========================================================================

    private async saveStateToStorage(): Promise<void> {
        if (!this.state) {
            return;
        }

        try {
            const storage = StorageService.getInstance();
            await storage.setWorkspace(StorageKeys.MIGRATION_PLAN, this.state);
            this.logger.debug('Planning state saved to storage');
        } catch (error) {
            this.logger.error('Failed to save planning state', error as Error);
        }
    }

    private async loadStateFromStorage(): Promise<void> {
        try {
            const storage = StorageService.getInstance();
            const data = storage.getWorkspace<PlanningStageState | undefined>(
                StorageKeys.MIGRATION_PLAN,
                undefined as unknown as PlanningStageState
            );
            if (data) {
                this.state = data;

                // After reload, reconcile flow status with stored plans.
                // Check both state.plans AND PlanningCacheService (disk).
                // state.plans may be empty after restart but disk cache has plans.
                if (this.state.flows) {
                    const cacheService = PlanningCacheService.getInstance();
                    for (const flow of this.state.flows) {
                        const hasPlanInState = !!(this.state.plans && this.state.plans[flow.id]);
                        const hasPlanOnDisk = cacheService.has(flow.id);
                        if ((hasPlanInState || hasPlanOnDisk) && flow.status === 'in-progress') {
                            this.logger.info(
                                `[PlanningService] loadState: correcting flow "${flow.id}" from "in-progress" to "planned" (plan exists: state=${hasPlanInState}, disk=${hasPlanOnDisk})`
                            );
                            flow.status = 'planned';
                        }
                    }
                }

                this.logger.debug('Planning state restored from storage');
            }
        } catch (error) {
            this.logger.error('Failed to load planning state', error as Error);
        }
    }

    // =========================================================================
    // Disposable
    // =========================================================================

    public dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
        PlanningService.instance = undefined;
    }
}
