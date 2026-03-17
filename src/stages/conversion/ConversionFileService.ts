/**
 * Conversion File Service
 *
 * Manages per-flow conversion artifacts as individual files inside a
 * folder structure: `.vscode/migration/conversion/{flowId}/`.
 *
 * Files per flow:
 *   - task-plan.json       — Ordered conversion task plan
 *   - task-{id}-output.json — Output for each completed task
 *
 * @module stages/conversion/ConversionFileService
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { ConversionTaskPlan, ConversionTaskOutput } from './types';

// =============================================================================
// Constants
// =============================================================================

const CONVERSION_DIR = '.vscode/migration/conversion';
const TASK_PLAN_FILENAME = 'task-plan.json';

// =============================================================================
// Conversion File Service
// =============================================================================

export class ConversionFileService {
    private static instance: ConversionFileService | undefined;
    private readonly logger = LoggingService.getInstance();

    private constructor() {}

    public static getInstance(): ConversionFileService {
        if (!ConversionFileService.instance) {
            ConversionFileService.instance = new ConversionFileService();
        }
        return ConversionFileService.instance;
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Store the task plan for a flow.
     */
    public storeTaskPlan(flowId: string, plan: ConversionTaskPlan): void {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            return;
        }
        this.writeJson(path.join(dir, TASK_PLAN_FILENAME), plan);
        this.logger.info(`[ConversionFiles] Stored task-plan.json for flow "${flowId}"`);
    }

    /**
     * Read the task plan for a flow.
     */
    public readTaskPlan(flowId: string): ConversionTaskPlan | undefined {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        return this.readJson<ConversionTaskPlan>(path.join(dir, TASK_PLAN_FILENAME));
    }

    /**
     * Store output for a specific task and update its status in task-plan.json.
     */
    public storeTaskOutput(flowId: string, taskId: string, output: ConversionTaskOutput): void {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            return;
        }
        const filename = `task-${this.sanitize(taskId)}-output.json`;
        this.writeJson(path.join(dir, filename), output);

        // Determine status — skipped for cloud-deploy-test tasks that say "skipped"/"not required"
        const planPath = path.join(dir, TASK_PLAN_FILENAME);
        const plan = this.readJson<ConversionTaskPlan>(planPath);
        const task = plan?.tasks.find((t) => t.id === taskId);
        const summaryLower = (output.summary || '').toLowerCase();
        const isSkipped =
            task &&
            (task.type === 'cloud-deploy-test' || task.type === 'cloud-deployment-test') &&
            (summaryLower.includes('skipped') ||
                summaryLower.includes('not required') ||
                summaryLower.includes('not needed'));
        const status = isSkipped ? 'skipped' : 'completed';

        // Update task status in task-plan.json so it persists across restarts
        this.updateTaskStatus(flowId, taskId, status);

        this.logger.info(
            `[ConversionFiles] Stored ${filename} for flow "${flowId}" (status: ${status})`
        );
    }

    /**
     * Update a task's status in the persisted task-plan.json.
     */
    public updateTaskStatus(flowId: string, taskId: string, status: string): void {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            return;
        }
        const planPath = path.join(dir, TASK_PLAN_FILENAME);
        const plan = this.readJson<ConversionTaskPlan>(planPath);
        if (!plan) {
            return;
        }
        const task = plan.tasks.find((t) => t.id === taskId);
        if (task) {
            (task as { status: string }).status = status;
            this.writeJson(planPath, plan);
            this.logger.debug(
                `[ConversionFiles] Updated task "${taskId}" status to "${status}" in task-plan.json`
            );
        }
    }

    /**
     * Read output for a specific task.
     */
    public readTaskOutput(flowId: string, taskId: string): ConversionTaskOutput | undefined {
        const dir = this.getFlowDir(flowId);
        if (!dir) {
            return undefined;
        }
        const filename = `task-${this.sanitize(taskId)}-output.json`;
        return this.readJson<ConversionTaskOutput>(path.join(dir, filename));
    }

    /**
     * Remove all conversion files for a flow.
     */
    public removeFlow(flowId: string): void {
        const dir = this.getFlowDir(flowId);
        if (!dir || !fs.existsSync(dir)) {
            return;
        }
        fs.rmSync(dir, { recursive: true, force: true });
        this.logger.info(`[ConversionFiles] Removed conversion directory for flow "${flowId}"`);
    }

    /**
     * Remove all conversion files.
     */
    public removeAll(): void {
        const rootDir = this.getConversionRootDir();
        if (!rootDir || !fs.existsSync(rootDir)) {
            return;
        }
        fs.rmSync(rootDir, { recursive: true, force: true });
        this.logger.info('[ConversionFiles] Removed all conversion files');
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private getConversionRootDir(): string | undefined {
        const wsFolder = vscode.workspace.workspaceFolders?.[0];
        if (!wsFolder) {
            this.logger.warn('[ConversionFiles] No workspace folder');
            return undefined;
        }
        return path.join(wsFolder.uri.fsPath, CONVERSION_DIR);
    }

    private getFlowDir(flowId: string): string | undefined {
        const rootDir = this.getConversionRootDir();
        if (!rootDir) {
            return undefined;
        }
        const dir = path.join(rootDir, this.sanitize(flowId));
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    private sanitize(id: string): string {
        return id.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    private writeJson(filePath: string, data: unknown): void {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    private readJson<T>(filePath: string): T | undefined {
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw) as T;
        } catch {
            this.logger.warn(`[ConversionFiles] Failed to parse ${filePath}`);
            return undefined;
        }
    }
}
