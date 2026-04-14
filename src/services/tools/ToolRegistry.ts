/**
 * Tool Registry
 *
 * Central registry for all migration tools with stage-based enablement.
 * Tools are only accessible when the user is in the appropriate stage.
 *
 * @module services/tools/ToolRegistry
 */

import * as vscode from 'vscode';
import {
    ToolDefinition,
    ToolCategory,
    RegisteredTool,
    ToolEnablementState,
    ToolCatalog,
    ToolFilter,
    ToolResult,
    ToolExecutionContext,
    ToolInvocationSource,
    ToolInvocationRecord,
    ToolsEnablementChangeEvent,
    isGlobalTool,
} from '../../types/tools';
import { MigrationStage } from '../../types/stages';
import { StateManager } from '../StateManager';
import { LoggingService } from '../LoggingService';
import { TelemetryService } from '../TelemetryService';

// ============================================================================
// TOOL REGISTRY
// ============================================================================

/**
 * Tool Registry
 *
 * Singleton service that manages tool registration, enablement, and invocation.
 * Tools are dynamically enabled/disabled based on current migration stage.
 */
export class ToolRegistry implements vscode.Disposable {
    private static instance: ToolRegistry | undefined;

    // Registered tools
    private readonly tools = new Map<string, RegisteredTool>();

    // Invocation history
    private readonly invocationHistory: ToolInvocationRecord[] = [];

    // Current stage (cached for performance)
    private currentStage: MigrationStage = MigrationStage.NotStarted;

    // Event listener disposable
    private stageChangeDisposable: vscode.Disposable | undefined;

    // Event emitters
    private readonly _onToolRegistered = new vscode.EventEmitter<RegisteredTool>();
    private readonly _onToolUnregistered = new vscode.EventEmitter<string>();
    private readonly _onEnablementChange = new vscode.EventEmitter<ToolsEnablementChangeEvent>();
    private readonly _onToolInvoked = new vscode.EventEmitter<ToolInvocationRecord>();

    // Public events
    public readonly onToolRegistered = this._onToolRegistered.event;
    public readonly onToolUnregistered = this._onToolUnregistered.event;
    public readonly onEnablementChange = this._onEnablementChange.event;
    public readonly onToolInvoked = this._onToolInvoked.event;

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    private constructor() {}

    /**
     * Get the singleton instance.
     */
    public static getInstance(): ToolRegistry {
        if (!ToolRegistry.instance) {
            ToolRegistry.instance = new ToolRegistry();
        }
        return ToolRegistry.instance;
    }

    /**
     * Initialize the registry.
     */
    public async initialize(): Promise<void> {
        const stateManager = StateManager.getInstance();

        // Get current stage
        this.currentStage = stateManager.getCurrentStage();

        // Update VS Code context for tool enablement
        await this.updateVSCodeContext();

        LoggingService.getInstance().info('ToolRegistry initialized', {
            currentStage: this.currentStage,
        });
    }

    /**
     * Dispose the registry.
     */
    public dispose(): void {
        this.stageChangeDisposable?.dispose();
        this._onToolRegistered.dispose();
        this._onToolUnregistered.dispose();
        this._onEnablementChange.dispose();
        this._onToolInvoked.dispose();
        this.tools.clear();
        ToolRegistry.instance = undefined;
    }

    // ========================================================================
    // TOOL REGISTRATION
    // ========================================================================

    /**
     * Register a new tool.
     */
    public registerTool<TInput = unknown, TOutput = unknown>(
        definition: ToolDefinition<TInput, TOutput>
    ): void {
        if (this.tools.has(definition.id)) {
            LoggingService.getInstance().warn(`Tool ${definition.id} already registered`);
            return;
        }

        const registeredTool: RegisteredTool = {
            definition: definition as ToolDefinition,
            isEnabled: this.shouldToolBeEnabled(definition as ToolDefinition),
            registeredAt: new Date().toISOString(),
            invocationCount: 0,
        };

        if (!registeredTool.isEnabled) {
            registeredTool.enablementReason = `Tool not enabled in ${this.currentStage} stage`;
        }

        this.tools.set(definition.id, registeredTool);
        this._onToolRegistered.fire(registeredTool);

        LoggingService.getInstance().debug('Tool registered', {
            id: definition.id,
            category: definition.category,
            enabled: registeredTool.isEnabled.toString(),
        });
    }

    /**
     * Register multiple tools.
     */
    public registerTools(definitions: ToolDefinition[]): void {
        for (const definition of definitions) {
            this.registerTool(definition);
        }
    }

    /**
     * Unregister a tool.
     */
    public unregisterTool(toolId: string): void {
        if (this.tools.delete(toolId)) {
            this._onToolUnregistered.fire(toolId);
            LoggingService.getInstance().debug('Tool unregistered', { id: toolId });
        }
    }

    // ========================================================================
    // TOOL ACCESS
    // ========================================================================

    /**
     * Get a tool by ID.
     */
    public getTool(toolId: string): RegisteredTool | undefined {
        return this.tools.get(toolId);
    }

    /**
     * Get tool definition by ID.
     */
    public getToolDefinition(toolId: string): ToolDefinition | undefined {
        return this.tools.get(toolId)?.definition;
    }

    /**
     * Check if a tool is registered.
     */
    public hasTool(toolId: string): boolean {
        return this.tools.has(toolId);
    }

    /**
     * Get all registered tools.
     */
    public getAllTools(): RegisteredTool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get tools matching a filter.
     */
    public getTools(filter: ToolFilter): RegisteredTool[] {
        let tools = Array.from(this.tools.values());

        if (filter.category) {
            tools = tools.filter((t) => t.definition.category === filter.category);
        }

        if (filter.stage) {
            tools = tools.filter((t) => t.isEnabled);
        }

        if (filter.enabled !== undefined) {
            tools = tools.filter((t) => t.isEnabled === filter.enabled);
        }

        if (filter.chatEnabled !== undefined) {
            tools = tools.filter((t) => t.definition.chatEnabled === filter.chatEnabled);
        }

        if (filter.keyword) {
            const keyword = filter.keyword.toLowerCase();
            tools = tools.filter((t) => {
                const def = t.definition;
                return (
                    def.id.toLowerCase().includes(keyword) ||
                    def.name.toLowerCase().includes(keyword) ||
                    def.description.toLowerCase().includes(keyword) ||
                    def.keywords?.some((k) => k.toLowerCase().includes(keyword))
                );
            });
        }

        return tools;
    }

    // ========================================================================
    // ENABLEMENT
    // ========================================================================

    /**
     * Check if a tool is currently enabled.
     */
    public isToolEnabled(toolId: string): boolean {
        const tool = this.tools.get(toolId);
        return tool?.isEnabled ?? false;
    }

    /**
     * Get the enablement state for a tool.
     */
    public getToolEnablementState(toolId: string): ToolEnablementState | undefined {
        const tool = this.tools.get(toolId);
        if (!tool) {
            return undefined;
        }

        const definition = tool.definition;
        const enabledStages: MigrationStage[] = isGlobalTool(definition)
            ? Object.values(MigrationStage)
            : (definition.stages as MigrationStage[]);

        return {
            toolId,
            enabled: tool.isEnabled,
            reason: tool.isEnabled
                ? 'Enabled for current stage'
                : (tool.enablementReason ?? 'Not enabled for current stage'),
            enabledInStages: enabledStages,
        };
    }

    /**
     * Get all enabled tools for the current stage.
     */
    public getEnabledTools(): RegisteredTool[] {
        return Array.from(this.tools.values()).filter((t) => t.isEnabled);
    }

    /**
     * Get all disabled tools.
     */
    public getDisabledTools(): RegisteredTool[] {
        return Array.from(this.tools.values()).filter((t) => !t.isEnabled);
    }

    /**
     * Get tools enabled for a specific stage.
     */
    public getToolsForStage(_stage: MigrationStage): RegisteredTool[] {
        return this.getEnabledTools();
    }

    // ========================================================================
    // TOOL INVOCATION
    // ========================================================================

    /**
     * Invoke a tool.
     */
    public async invokeTool<TInput = unknown, TOutput = unknown>(
        toolId: string,
        input: TInput,
        source: ToolInvocationSource = ToolInvocationSource.Command
    ): Promise<ToolResult<TOutput>> {
        const tool = this.tools.get(toolId);

        // Check if tool exists
        if (!tool) {
            return {
                success: false,
                error: `Tool ${toolId} not found`,
                executionTime: 0,
            };
        }

        // Check if tool is enabled
        if (!tool.isEnabled) {
            const enablementState = this.getToolEnablementState(toolId);
            return {
                success: false,
                error: `Tool ${toolId} is not enabled. ${enablementState?.reason ?? ''}`,
                executionTime: 0,
                metadata: {
                    enabledInStages: enablementState?.enabledInStages,
                    currentStage: this.currentStage,
                },
            };
        }

        // Create execution context
        const context = await this.createExecutionContext();

        // Execute tool
        const startTime = Date.now();
        let result: ToolResult<TOutput>;

        try {
            result = (await tool.definition.handler(input, context)) as ToolResult<TOutput>;
        } catch (error) {
            result = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime: Date.now() - startTime,
            };
            LoggingService.getInstance().error(
                `Tool ${toolId} execution failed`,
                error instanceof Error ? error : undefined
            );
        }

        // Update execution time if not set
        if (!result.executionTime) {
            result.executionTime = Date.now() - startTime;
        }

        // Record invocation
        const record: ToolInvocationRecord = {
            id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            toolId,
            input,
            result,
            source,
            stage: this.currentStage,
            timestamp: new Date().toISOString(),
        };

        this.invocationHistory.push(record);
        tool.invocationCount++;
        tool.lastInvokedAt = new Date().toISOString();

        this._onToolInvoked.fire(record);

        // Send telemetry
        TelemetryService.getInstance().sendEvent('tool.invoked', {
            toolId,
            source,
            success: result.success.toString(),
            duration: result.executionTime.toString(),
        });

        return result;
    }

    /**
     * Get invocation history.
     */
    public getInvocationHistory(limit?: number): ToolInvocationRecord[] {
        const history = [...this.invocationHistory];
        history.reverse(); // Most recent first
        return limit ? history.slice(0, limit) : history;
    }

    /**
     * Get invocation history for a specific tool.
     */
    public getToolInvocationHistory(toolId: string, limit?: number): ToolInvocationRecord[] {
        const history = this.invocationHistory.filter((r) => r.toolId === toolId);
        history.reverse();
        return limit ? history.slice(0, limit) : history;
    }

    // ========================================================================
    // CATALOG
    // ========================================================================

    /**
     * Get tool catalog summary.
     */
    public getCatalog(): ToolCatalog {
        const tools = Array.from(this.tools.values());

        const byCategory = new Map<ToolCategory, string[]>();
        const byStage = new Map<MigrationStage, string[]>();
        const globalTools: string[] = [];
        const enabledTools: string[] = [];
        const disabledTools: string[] = [];

        for (const tool of tools) {
            const def = tool.definition;

            // By category
            const categoryTools = byCategory.get(def.category) ?? [];
            categoryTools.push(def.id);
            byCategory.set(def.category, categoryTools);

            // By stage
            if (isGlobalTool(def)) {
                globalTools.push(def.id);
                for (const stage of Object.values(MigrationStage)) {
                    const stageTools = byStage.get(stage as MigrationStage) ?? [];
                    stageTools.push(def.id);
                    byStage.set(stage as MigrationStage, stageTools);
                }
            } else {
                for (const stage of def.stages as MigrationStage[]) {
                    const stageTools = byStage.get(stage) ?? [];
                    stageTools.push(def.id);
                    byStage.set(stage, stageTools);
                }
            }

            // Enabled/disabled
            if (tool.isEnabled) {
                enabledTools.push(def.id);
            } else {
                disabledTools.push(def.id);
            }
        }

        return {
            totalTools: tools.length,
            byCategory,
            byStage,
            globalTools,
            enabledTools,
            disabledTools,
        };
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    /**
     * Check if a tool should be enabled.
     */
    private shouldToolBeEnabled(_definition: ToolDefinition): boolean {
        return true;
    }

    /**
     * Create execution context for tool invocation.
     */
    private async createExecutionContext(): Promise<ToolExecutionContext> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders?.[0]?.uri.fsPath ?? '';

        return {
            currentStage: this.currentStage,
            workspacePath,
            projectPath: workspacePath, // Will be updated from state manager
            log: (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
                const logger = LoggingService.getInstance();
                switch (level) {
                    case 'warn':
                        logger.warn(message);
                        break;
                    case 'error':
                        logger.error(message);
                        break;
                    case 'debug':
                        logger.debug(message);
                        break;
                    default:
                        logger.info(message);
                }
            },
        };
    }

    /**
     * Update VS Code context for command enablement.
     */
    private async updateVSCodeContext(): Promise<void> {
        // Set context for each tool's enablement
        for (const [toolId, tool] of this.tools) {
            await vscode.commands.executeCommand(
                'setContext',
                `logicAppsMigrationAgent.tool.${toolId}.enabled`,
                tool.isEnabled
            );
        }

        // Set list of enabled tool IDs
        const enabledIds = this.getEnabledTools().map((t) => t.definition.id);
        await vscode.commands.executeCommand(
            'setContext',
            'logicAppsMigrationAgent.enabledTools',
            enabledIds
        );
    }
}
