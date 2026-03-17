/**
 * Tool Type Definitions
 *
 * Type definitions for the tool registry system.
 * Tools are functions that can be invoked during specific migration stages.
 *
 * @module types/tools
 */

import { MigrationStage } from './stages';

// ============================================================================
// TOOL CATEGORY ENUM
// ============================================================================

/**
 * Categories of migration tools.
 * Used for organization and filtering.
 */
export enum ToolCategory {
    /** Tools for parsing source platforms */
    Parser = 'PARSER',

    /** Tools for analyzing/assessing artifacts */
    Analyzer = 'ANALYZER',

    /** Tools for generating target artifacts */
    Generator = 'GENERATOR',

    /** Tools for validating artifacts */
    Validator = 'VALIDATOR',

    /** Tools for deploying to Azure */
    Deployer = 'DEPLOYER',

    /** Tools for verification and testing */
    Verifier = 'VERIFIER',

    /** Tools for planning and design */
    Planner = 'PLANNER',

    /** Utility tools available across stages */
    Utility = 'UTILITY',
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Parameters accepted by a tool.
 */
export interface ToolParameter {
    /** Parameter name */
    name: string;

    /** Parameter type */
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';

    /** Human-readable description */
    description: string;

    /** Whether the parameter is required */
    required: boolean;

    /** Default value if not provided */
    defaultValue?: unknown;

    /** Enum of valid values (for string type) */
    enum?: string[];
}

/**
 * Result returned by a tool execution.
 */
export interface ToolResult<T = unknown> {
    /** Whether the tool executed successfully */
    success: boolean;

    /** The result data */
    data?: T;

    /** Error message if not successful */
    error?: string;

    /** Warnings generated during execution */
    warnings?: string[];

    /** Execution time in milliseconds */
    executionTime: number;

    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Tool handler function signature.
 */
export type ToolHandler<TInput = unknown, TOutput = unknown> = (
    input: TInput,
    context: ToolExecutionContext
) => Promise<ToolResult<TOutput>>;

/**
 * Context provided to tool handlers during execution.
 */
export interface ToolExecutionContext {
    /** Current migration stage */
    currentStage: MigrationStage;

    /** Path to the workspace */
    workspacePath: string;

    /** Path to the source project */
    projectPath?: string;

    /** Cancellation token */
    cancellationToken?: { isCancellationRequested: boolean };

    /** Progress reporter */
    progress?: {
        report: (increment: number, message?: string) => void;
    };

    /** Logger function */
    log: (message: string, level?: 'info' | 'warn' | 'error' | 'debug') => void;
}

/**
 * Definition of a migration tool.
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
    /** Unique identifier for the tool */
    readonly id: string;

    /** Display name for UI */
    readonly name: string;

    /** Description of what the tool does */
    readonly description: string;

    /** Category for organization */
    readonly category: ToolCategory;

    /** Stages where this tool is enabled */
    readonly stages: MigrationStage[] | '*';

    /** Parameters the tool accepts */
    readonly parameters: ToolParameter[];

    /** Handler function */
    readonly handler: ToolHandler<TInput, TOutput>;

    /** Whether the tool can be invoked from chat */
    readonly chatEnabled: boolean;

    /** Icon for UI (VS Code codicon) */
    readonly icon?: string;

    /** Keywords for search/discovery */
    readonly keywords?: string[];

    /** Example usage */
    readonly example?: {
        input: TInput;
        description: string;
    };
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Information about a registered tool.
 */
export interface RegisteredTool {
    /** The tool definition */
    definition: ToolDefinition;

    /** Whether the tool is currently enabled */
    isEnabled: boolean;

    /** Current enablement reason */
    enablementReason?: string;

    /** When the tool was registered */
    registeredAt: string;

    /** Number of times invoked */
    invocationCount: number;

    /** Last invocation timestamp */
    lastInvokedAt?: string;
}

/**
 * Tool enablement state.
 */
export interface ToolEnablementState {
    /** Tool ID */
    toolId: string;

    /** Is the tool enabled */
    enabled: boolean;

    /** Reason for current state */
    reason: string;

    /** Which stages enable this tool */
    enabledInStages: MigrationStage[];
}

// ============================================================================
// TOOL INVOCATION
// ============================================================================

/**
 * Request to invoke a tool.
 */
export interface ToolInvocationRequest {
    /** Tool ID to invoke */
    toolId: string;

    /** Input parameters */
    input: unknown;

    /** Source of invocation */
    source: ToolInvocationSource;

    /** Correlation ID for tracking */
    correlationId?: string;
}

/**
 * Sources from which a tool can be invoked.
 */
export enum ToolInvocationSource {
    /** Invoked via VS Code command */
    Command = 'COMMAND',

    /** Invoked via chat participant */
    Chat = 'CHAT',

    /** Invoked via UI button/action */
    UI = 'UI',

    /** Invoked by another tool */
    Tool = 'TOOL',

    /** Invoked by the system automatically */
    System = 'SYSTEM',
}

/**
 * Record of a tool invocation.
 */
export interface ToolInvocationRecord {
    /** Unique invocation ID */
    id: string;

    /** Tool ID */
    toolId: string;

    /** Input provided */
    input: unknown;

    /** Result returned */
    result: ToolResult;

    /** Source of invocation */
    source: ToolInvocationSource;

    /** Stage when invoked */
    stage: MigrationStage;

    /** Timestamp */
    timestamp: string;

    /** User who invoked (if applicable) */
    user?: string;

    /** Correlation ID */
    correlationId?: string;
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Event fired when tools enablement changes.
 */
export interface ToolsEnablementChangeEvent {
    /** Tools that are now enabled */
    enabledTools: string[];

    /** Tools that are now disabled */
    disabledTools: string[];

    /** The stage that triggered the change */
    stage: MigrationStage;

    /** Timestamp */
    timestamp: string;
}

/**
 * Event fired when a tool is registered.
 */
export interface ToolRegisteredEvent {
    /** The registered tool */
    tool: RegisteredTool;

    /** Timestamp */
    timestamp: string;
}

/**
 * Event fired when a tool is invoked.
 */
export interface ToolInvokedEvent {
    /** Invocation record */
    invocation: ToolInvocationRecord;

    /** Timestamp */
    timestamp: string;
}

// ============================================================================
// TOOL CATALOG
// ============================================================================

/**
 * Summary of all registered tools.
 */
export interface ToolCatalog {
    /** Total number of registered tools */
    totalTools: number;

    /** Tools by category */
    byCategory: Map<ToolCategory, string[]>;

    /** Tools by stage */
    byStage: Map<MigrationStage, string[]>;

    /** Global tools (available in all stages) */
    globalTools: string[];

    /** Currently enabled tools */
    enabledTools: string[];

    /** Currently disabled tools */
    disabledTools: string[];
}

/**
 * Filter options for querying tools.
 */
export interface ToolFilter {
    /** Filter by category */
    category?: ToolCategory;

    /** Filter by stage */
    stage?: MigrationStage;

    /** Filter by enabled state */
    enabled?: boolean;

    /** Filter by chat-enabled */
    chatEnabled?: boolean;

    /** Filter by keyword search */
    keyword?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid ToolCategory
 */
export function isToolCategory(value: unknown): value is ToolCategory {
    return Object.values(ToolCategory).includes(value as ToolCategory);
}

/**
 * Check if a tool definition has global scope
 */
export function isGlobalTool(tool: ToolDefinition): boolean {
    return tool.stages === '*';
}

/**
 * Check if a tool is enabled for a specific stage
 */
export function isToolEnabledForStage(tool: ToolDefinition, stage: MigrationStage): boolean {
    if (tool.stages === '*') {
        return true;
    }
    return tool.stages.includes(stage);
}
