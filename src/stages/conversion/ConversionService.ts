/**
 * Conversion Service
 *
 * Main orchestrator for the Conversion stage. Retrieves planned flows
 * from the Planning stage, allows users to select flows for conversion,
 * and coordinates the agent-driven conversion task workflow.
 *
 * @module stages/conversion/ConversionService
 */

import * as vscode from 'vscode';
import { LoggingService } from '../../services/LoggingService';
import { StorageService, StorageKeys } from '../../services/StorageService';
import { PlanningService } from '../planning/PlanningService';
import { PlanningCacheService } from '../planning/PlanningCacheService';
import {
    ConversionFlow,
    ConversionStageState,
    ConversionTaskPlan,
    ConversionTask,
    ConversionTaskOutput,
} from './types';

// =============================================================================
// Conversion Service Events
// =============================================================================

/**
 * Fired when the conversion state changes.
 */
interface ConversionStateChangeEvent {
    /** What changed */
    type:
        | 'flow-selected'
        | 'task-plan-generated'
        | 'task-updated'
        | 'flow-completed'
        | 'flows-loaded';

    /** Flow ID if relevant */
    flowId?: string;

    /** Task ID if relevant */
    taskId?: string;
}

// =============================================================================
// Conversion Service
// =============================================================================

/**
 * Main service for the Conversion stage.
 */
export class ConversionService implements vscode.Disposable {
    private static instance: ConversionService | undefined;

    private readonly logger = LoggingService.getInstance();

    // Event emitters
    private readonly _onStateChange = new vscode.EventEmitter<ConversionStateChangeEvent>();
    public readonly onStateChange = this._onStateChange.event;

    private readonly disposables: vscode.Disposable[] = [];

    // Conversion state
    private state: ConversionStageState | undefined;
    private readonly executeAllActiveFlows = new Set<string>();

    private constructor() {
        this.disposables.push(this._onStateChange);
    }

    /**
     * Get the singleton instance.
     */
    public static getInstance(): ConversionService {
        if (!ConversionService.instance) {
            ConversionService.instance = new ConversionService();
        }
        return ConversionService.instance;
    }

    /**
     * Initialize the conversion service.
     */
    public async initialize(): Promise<void> {
        await this.loadStateFromStorage();
        this.logger.info('Conversion service initialized');
    }

    // =========================================================================
    // Flow Management
    // =========================================================================

    /**
     * Build the list of convertible flows from planning results.
     * Only flows that have finalized planning results are eligible.
     */
    public buildFlowsFromPlanning(): ConversionFlow[] {
        const planningService = PlanningService.getInstance();
        const planningCacheService = PlanningCacheService.getInstance();
        const planningFlows = planningService.getFlows();

        if (planningFlows.length === 0) {
            this.logger.warn('No planning flows available for conversion');
            return [];
        }

        const flows: ConversionFlow[] = [];

        for (const pf of planningFlows) {
            // Only include flows that have been planned (have a cached result)
            const hasPlan =
                pf.status === 'planned' ||
                pf.status === 'approved' ||
                !!planningCacheService.get(pf.id);

            if (!hasPlan) {
                continue;
            }

            const existingStatus = this.state?.flows.find((f) => f.id === pf.id)?.status;
            const existingExecuteAllActive = this.state?.flows.find(
                (f) => f.id === pf.id
            )?.executeAllActive;
            flows.push({
                id: pf.id,
                name: pf.name,
                description: pf.description,
                category: pf.category,
                artifactCount: pf.artifactCount,
                artifactIds: pf.artifactIds,
                status: existingStatus || 'not-started',
                executeAllActive:
                    this.executeAllActiveFlows.has(pf.id) || existingExecuteAllActive || false,
            });
        }

        // Update state
        this.state = {
            flows,
            taskPlans: this.state?.taskPlans || {},
            selectedFlowId: this.state?.selectedFlowId,
            startedAt: this.state?.startedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        void this.saveStateToStorage();
        this._onStateChange.fire({ type: 'flows-loaded' });

        this.logger.info(`Built ${flows.length} convertible flows from planning`);
        return flows;
    }

    /**
     * Get the current conversion state.
     */
    public getState(): ConversionStageState | undefined {
        return this.state;
    }

    /**
     * Get all convertible flows.
     */
    public getFlows(): ConversionFlow[] {
        return this.state?.flows || [];
    }

    /**
     * Select a flow for conversion.
     */
    public async selectFlow(flowId: string): Promise<void> {
        if (!this.state) {
            this.buildFlowsFromPlanning();
        }

        if (this.state) {
            this.state.selectedFlowId = flowId;
            this.state.updatedAt = new Date().toISOString();

            await this.saveStateToStorage();
            this._onStateChange.fire({ type: 'flow-selected', flowId });
        }
    }

    /**
     * Store a task plan generated by the agent for a flow.
     */
    public async storeTaskPlan(flowId: string, taskPlan: ConversionTaskPlan): Promise<void> {
        if (!this.state) {
            this.buildFlowsFromPlanning();
        }

        if (this.state) {
            this.state.taskPlans[flowId] = taskPlan;
            this.state.updatedAt = new Date().toISOString();

            // Update flow status
            const flow = this.state.flows.find((f) => f.id === flowId);
            if (flow) {
                flow.status = 'tasks-ready';
            }

            await this.saveStateToStorage();
            this._onStateChange.fire({ type: 'task-plan-generated', flowId });
        }
    }

    /**
     * Update a specific task within a flow's task plan.
     */
    public async updateTask(
        flowId: string,
        taskId: string,
        updates: Partial<Pick<ConversionTask, 'status' | 'output'>>
    ): Promise<void> {
        const plan = this.state?.taskPlans[flowId];
        if (!plan) {
            this.logger.warn(`No task plan for flow ${flowId}`);
            return;
        }

        const task = plan.tasks.find((t) => t.id === taskId);
        if (!task) {
            this.logger.warn(`Task ${taskId} not found in flow ${flowId}`);
            return;
        }

        if (updates.status !== undefined) {
            (task as { status: string }).status = updates.status;

            // Also persist task status to disk (task-plan.json)
            try {
                const { ConversionFileService } = require('./ConversionFileService'); // eslint-disable-line
                ConversionFileService.getInstance().updateTaskStatus(
                    flowId,
                    taskId,
                    updates.status
                );
            } catch {
                // Non-critical — disk persistence is best-effort
            }
        }
        if (updates.output !== undefined) {
            task.output = updates.output;
        }

        if (this.state) {
            this.state.updatedAt = new Date().toISOString();

            const flow = this.state.flows.find((f) => f.id === flowId);
            const allCompleted = plan.tasks.every(
                (t) => t.status === 'completed' || t.status === 'skipped'
            );
            const requiredAllCompleted = plan.tasks.every(
                (t) => t.optional || t.status === 'completed' || t.status === 'skipped'
            );
            const hasRunning = plan.tasks.some((t) => t.status === 'in-progress');

            if (allCompleted) {
                if (flow) {
                    flow.status = 'completed';
                    flow.executeAllActive = false;
                }
                this.executeAllActiveFlows.delete(flowId);
                this._onStateChange.fire({ type: 'flow-completed', flowId });
            } else if (hasRunning) {
                if (flow) {
                    flow.status = 'in-progress';
                }
            } else {
                // No task currently running and not fully completed.
                // Keep flow in-progress during Execute All orchestration, otherwise actionable.
                if (flow) {
                    if (flow.executeAllActive) {
                        if (requiredAllCompleted) {
                            flow.executeAllActive = false;
                            this.executeAllActiveFlows.delete(flowId);
                            flow.status = 'tasks-ready';
                        } else {
                            flow.status = 'in-progress';
                        }
                    } else {
                        flow.status = 'tasks-ready';
                    }
                }
            }

            await this.saveStateToStorage();
            this._onStateChange.fire({ type: 'task-updated', flowId, taskId });
        }
    }

    /**
     * Store output for a specific task.
     * If the task summary indicates it was skipped, sets status to 'skipped' instead of 'completed'.
     */
    public async storeTaskOutput(
        flowId: string,
        taskId: string,
        output: ConversionTaskOutput
    ): Promise<void> {
        const taskPlan = this.state?.taskPlans[flowId];
        const task = taskPlan?.tasks.find((t) => t.id === taskId);
        const summaryLower = (output.summary || '').toLowerCase();
        const isSkipped =
            task &&
            (task.type === 'cloud-deploy-test' || task.type === 'cloud-deployment-test') &&
            (summaryLower.includes('skipped') ||
                summaryLower.includes('not required') ||
                summaryLower.includes('not needed'));
        const status = isSkipped ? 'skipped' : 'completed';
        await this.updateTask(flowId, taskId, { status, output });
    }

    /**
     * Get the task plan for a specific flow.
     */
    public getTaskPlan(flowId: string): ConversionTaskPlan | undefined {
        return this.state?.taskPlans[flowId];
    }

    /**
     * Set Execute All orchestration mode for a flow.
     */
    public async setExecuteAllActive(flowId: string, active: boolean): Promise<void> {
        if (!this.state) {
            return;
        }

        if (active) {
            this.executeAllActiveFlows.add(flowId);
        } else {
            this.executeAllActiveFlows.delete(flowId);
        }

        let flow = this.state.flows.find((f) => f.id === flowId);
        if (!flow) {
            this.buildFlowsFromPlanning();
            flow = this.state.flows.find((f) => f.id === flowId);
        }
        if (!flow) {
            this.logger.warn(
                `[ConversionService] setExecuteAllActive: flow "${flowId}" not found in state`
            );
            return;
        }

        flow.executeAllActive = active;
        if (active) {
            flow.status = 'in-progress';
        }
        this.state.updatedAt = new Date().toISOString();

        await this.saveStateToStorage();
        this._onStateChange.fire({ type: 'task-updated', flowId });
    }

    /**
     * Check whether Execute All mode is currently active for a flow.
     */
    public isExecuteAllActive(flowId: string): boolean {
        return this.executeAllActiveFlows.has(flowId);
    }

    /**
     * Reset conversion state.
     */
    public async reset(): Promise<void> {
        this.state = undefined;
        const storage = StorageService.getInstance();
        await storage.setWorkspace(StorageKeys.CONVERSION_STATE, undefined);
        this.logger.info('Conversion state reset');
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
            await storage.setWorkspace(StorageKeys.CONVERSION_STATE, this.state);
            this.logger.debug('Conversion state saved to storage');
        } catch (error) {
            this.logger.error('Failed to save conversion state', error as Error);
        }
    }

    private async loadStateFromStorage(): Promise<void> {
        try {
            const storage = StorageService.getInstance();
            const data = storage.getWorkspace<ConversionStageState | undefined>(
                StorageKeys.CONVERSION_STATE,
                undefined as unknown as ConversionStageState
            );
            if (data) {
                this.state = data;

                // After reload, reconcile flow status with stored task plans.
                // If a flow has a task plan but status is 'thinking', correct it
                // to 'tasks-ready'. If any task was in-progress or completed,
                // correct to 'in-progress'. This handles stale status after restarts.
                if (this.state.flows && this.state.taskPlans) {
                    for (const flow of this.state.flows) {
                        const taskPlan = this.state.taskPlans[flow.id];
                        if (!taskPlan) {
                            // No task plan — if stuck at 'thinking', reset to 'not-started'
                            if (flow.status === 'thinking') {
                                this.logger.info(
                                    `[ConversionService] loadState: correcting flow "${flow.id}" from "thinking" to "not-started" (no task plan)`
                                );
                                flow.status = 'not-started';
                            }
                            continue;
                        }
                        // Has task plan — reconcile based on task statuses
                        const allDone = taskPlan.tasks.every(
                            (t) => t.status === 'completed' || t.status === 'skipped'
                        );
                        const hasRunning = taskPlan.tasks.some((t) => t.status === 'in-progress');
                        if (allDone && flow.status !== 'completed') {
                            this.logger.info(
                                `[ConversionService] loadState: correcting flow "${flow.id}" from "${flow.status}" to "completed"`
                            );
                            flow.status = 'completed';
                            flow.executeAllActive = false;
                            this.executeAllActiveFlows.delete(flow.id);
                        } else if (
                            hasRunning &&
                            (flow.status === 'thinking' || flow.status === 'tasks-ready')
                        ) {
                            this.logger.info(
                                `[ConversionService] loadState: correcting flow "${flow.id}" from "${flow.status}" to "in-progress"`
                            );
                            flow.status = 'in-progress';
                        } else if (flow.status === 'thinking' || flow.status === 'in-progress') {
                            this.logger.info(
                                `[ConversionService] loadState: correcting flow "${flow.id}" from "${flow.status}" to "tasks-ready" (no running tasks)`
                            );
                            flow.status = 'tasks-ready';
                            if (!hasRunning) {
                                flow.executeAllActive = false;
                                this.executeAllActiveFlows.delete(flow.id);
                            }
                        }
                    }
                }

                // Rehydrate runtime execute-all set from persisted flow flags
                for (const flow of this.state.flows) {
                    if (flow.executeAllActive) {
                        this.executeAllActiveFlows.add(flow.id);
                    }
                }

                this.logger.debug('Conversion state restored from storage');
            }
        } catch (error) {
            this.logger.error('Failed to load conversion state', error as Error);
        }
    }

    // =========================================================================
    // Disposable
    // =========================================================================

    public dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.executeAllActiveFlows.clear();
        ConversionService.instance = undefined;
    }
}
