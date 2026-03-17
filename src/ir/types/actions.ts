/**
 * IR Action Types
 *
 * Type definitions for workflow actions (operations).
 * Uses discriminated unions to provide type-safe action configurations.
 *
 * @module ir/types/actions
 */

import {
    ConfigRecord,
    Expression,
    ISODuration,
    JSONPointer,
    RetryPolicyType,
    RunAfterState,
    SourceMappingRecord,
} from './common';

// =============================================================================
// Action Type Discriminators
// =============================================================================

/**
 * All supported action types.
 * Used as discriminator for the action union type.
 */
export type ActionType =
    // Data operations
    | 'transform'
    | 'compose'
    | 'parse'
    | 'validate'
    | 'set-variable'
    | 'append-variable'
    | 'increment-variable'
    // Control flow
    | 'condition'
    | 'switch'
    | 'foreach'
    | 'until'
    | 'parallel'
    | 'scope'
    // Integration
    | 'http-call'
    | 'http-response'
    | 'database-query'
    | 'database-execute'
    | 'queue-send'
    | 'queue-receive'
    | 'file-read'
    | 'file-write'
    | 'ftp-operation'
    | 'sftp-operation'
    | 'email-send'
    // Workflow
    | 'call-workflow'
    | 'terminate'
    | 'delay'
    | 'delay-until'
    | 'wait'
    // Specialized
    | 'sap-call'
    | 'salesforce-operation'
    | 'dynamics-operation'
    | 'azure-function'
    | 'custom';

/**
 * Action categories for grouping and filtering.
 */
export type ActionCategory =
    | 'data'          // Data transformation and manipulation
    | 'control-flow'  // Branching, looping, scoping
    | 'integration'   // External system calls
    | 'utility'       // Variables, delays, termination
    | 'workflow';     // Sub-workflow calls

// =============================================================================
// Run After Configuration
// =============================================================================

/**
 * Run-after dependency specification.
 * Defines when an action should execute based on predecessor states.
 */
export type RunAfterConfig = Record<string, readonly RunAfterState[]>;

// =============================================================================
// Retry Policy
// =============================================================================

/**
 * Retry policy configuration for actions.
 */
export interface ActionRetryPolicy {
    /** Retry policy type */
    readonly type: RetryPolicyType;

    /** Number of retry attempts */
    readonly count?: number;

    /** Interval between retries */
    readonly interval?: ISODuration;

    /** Maximum interval for exponential backoff */
    readonly maximumInterval?: ISODuration;

    /** Minimum interval for exponential backoff */
    readonly minimumInterval?: ISODuration;
}

// =============================================================================
// Action Input/Output Types
// =============================================================================

/**
 * Action input specification.
 */
export interface ActionInputs {
    /** Primary content/body */
    readonly content?: Expression | unknown;

    /** HTTP headers */
    readonly headers?: Record<string, Expression | string>;

    /** Query parameters */
    readonly queries?: Record<string, Expression | string>;

    /** Path parameters */
    readonly path?: Record<string, Expression | string>;

    /** Additional parameters */
    readonly parameters?: Record<string, unknown>;

    /** Body content */
    readonly body?: Expression | unknown;
}

/**
 * Action output specification.
 */
export interface ActionOutputs {
    /** Body/payload */
    readonly body?: {
        readonly type: 'xml' | 'json' | 'text' | 'binary';
        readonly schemaRef?: JSONPointer;
    };

    /** Status code */
    readonly statusCode?: number;

    /** Headers */
    readonly headers?: Record<string, string>;
}

// =============================================================================
// Target Mapping
// =============================================================================

/**
 * Logic Apps target mapping for actions.
 */
export interface ActionTargetMapping {
    /** Logic Apps action type */
    readonly logicAppsAction?: string;

    /** Connector identifier */
    readonly connector?: string;

    /** Recommended pattern */
    readonly pattern?: string;

    /** Whether this action has a gap */
    readonly gap: boolean;

    /** Gap description */
    readonly gapReason?: string;

    /** Suggested alternative */
    readonly alternative?: string;

    /** Requires Integration Account */
    readonly requiresIntegrationAccount?: boolean;

    /** Additional notes */
    readonly notes?: string;
}

// =============================================================================
// Error Handling Configuration
// =============================================================================

/**
 * Action-level error handling configuration.
 */
export interface ActionErrorHandling {
    /** Error handling strategy */
    readonly strategy: 'propagate' | 'catch' | 'ignore';

    /** Reference to error handler */
    readonly catchRef?: JSONPointer;

    /** Secure inputs (don't log) */
    readonly secureInputs?: boolean;

    /** Secure outputs (don't log) */
    readonly secureOutputs?: boolean;
}

// =============================================================================
// Base Action Interface
// =============================================================================

/**
 * Base interface for all action types.
 */
export interface IRActionBase {
    /** Unique identifier */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Action type discriminator */
    readonly type: ActionType;

    /** Action category */
    readonly category: ActionCategory;

    /** Run-after dependencies */
    runAfter?: RunAfterConfig;

    /** Action inputs */
    readonly inputs?: ActionInputs;

    /** Action outputs */
    readonly outputs?: ActionOutputs;

    /** Retry policy */
    readonly retryPolicy?: ActionRetryPolicy;

    /** Error handling */
    readonly errorHandling?: ActionErrorHandling;

    /** Timeout duration */
    readonly timeout?: ISODuration;

    /** Operation options */
    readonly operationOptions?: {
        readonly disableAsyncPattern?: boolean;
        readonly suppressWorkflowHeaders?: boolean;
        readonly suppressWorkflowHeadersOnResponse?: boolean;
    };

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target Logic Apps mapping */
    targetMapping?: ActionTargetMapping;

    /** Tracked properties */
    readonly trackedProperties?: Record<string, Expression>;
}

// =============================================================================
// Data Action Types
// =============================================================================

/**
 * Transform action configuration.
 */
export interface TransformActionConfig {
    /** Transform type */
    readonly transformType: 'xslt' | 'liquid' | 'dataweave' | 'jolt' | 'custom';

    /** Reference to map */
    readonly mapRef?: JSONPointer;

    /** Source schema reference */
    readonly sourceSchemaRef?: JSONPointer;

    /** Target schema reference */
    readonly targetSchemaRef?: JSONPointer;

    /** Transform parameters */
    readonly parameters?: Record<string, Expression | unknown>;
}

/**
 * Transform action.
 */
export interface TransformAction extends IRActionBase {
    readonly type: 'transform';
    readonly category: 'data';
    readonly config: TransformActionConfig;
}

/**
 * Compose action configuration.
 */
export interface ComposeActionConfig {
    /** Value to compose */
    readonly inputs: Expression | unknown;
}

/**
 * Compose action.
 */
export interface ComposeAction extends IRActionBase {
    readonly type: 'compose';
    readonly category: 'data';
    readonly config: ComposeActionConfig;
}

/**
 * Parse action configuration.
 */
export interface ParseActionConfig {
    /** Content to parse */
    readonly content: Expression;

    /** Schema for parsing */
    readonly schema: Record<string, unknown> | JSONPointer;

    /** Content type */
    readonly contentType?: 'json' | 'xml';
}

/**
 * Parse action.
 */
export interface ParseAction extends IRActionBase {
    readonly type: 'parse';
    readonly category: 'data';
    readonly config: ParseActionConfig;
}

/**
 * Validate action configuration.
 */
export interface ValidateActionConfig {
    /** Content to validate */
    readonly content: Expression;

    /** Schema reference */
    readonly schemaRef: JSONPointer;

    /** Validation mode */
    readonly mode?: 'strict' | 'loose';
}

/**
 * Validate action.
 */
export interface ValidateAction extends IRActionBase {
    readonly type: 'validate';
    readonly category: 'data';
    readonly config: ValidateActionConfig;
}

/**
 * Set variable action configuration.
 */
export interface SetVariableActionConfig {
    /** Variable name */
    readonly name: string;

    /** Value to set */
    readonly value: Expression | unknown;
}

/**
 * Set variable action.
 */
export interface SetVariableAction extends IRActionBase {
    readonly type: 'set-variable';
    readonly category: 'utility';
    readonly config: SetVariableActionConfig;
}

/**
 * Append to variable action configuration.
 */
export interface AppendVariableActionConfig {
    /** Variable name */
    readonly name: string;

    /** Value to append */
    readonly value: Expression | unknown;
}

/**
 * Append to variable action.
 */
export interface AppendVariableAction extends IRActionBase {
    readonly type: 'append-variable';
    readonly category: 'utility';
    readonly config: AppendVariableActionConfig;
}

/**
 * Increment variable action configuration.
 */
export interface IncrementVariableActionConfig {
    /** Variable name */
    readonly name: string;

    /** Value to increment by */
    readonly value: number;
}

/**
 * Increment variable action.
 */
export interface IncrementVariableAction extends IRActionBase {
    readonly type: 'increment-variable';
    readonly category: 'utility';
    readonly config: IncrementVariableActionConfig;
}

// =============================================================================
// Control Flow Action Types
// =============================================================================

/**
 * Condition expression.
 */
export interface ConditionExpression {
    /** Expression type */
    readonly type: 'simple' | 'compound';

    /** Logical operator for compound conditions */
    readonly operator?: 'and' | 'or' | 'not';

    /** Left operand */
    readonly left?: Expression;

    /** Comparison operator */
    readonly comparison?: 'equals' | 'not-equals' | 'greater' | 'greater-or-equal' | 'less' | 'less-or-equal' | 'contains' | 'starts-with' | 'ends-with';

    /** Right operand */
    readonly right?: Expression | unknown;

    /** Sub-conditions for compound expressions */
    readonly conditions?: readonly ConditionExpression[];
}

/**
 * Action branch (for condition/parallel actions).
 */
export interface ActionBranch {
    /** Actions in this branch */
    readonly actions: readonly string[];
}

/**
 * Condition action configuration.
 */
export interface ConditionActionConfig {
    /** Condition expression */
    readonly expression: ConditionExpression | Expression;
}

/**
 * Condition action.
 */
export interface ConditionAction extends IRActionBase {
    readonly type: 'condition';
    readonly category: 'control-flow';
    readonly config: ConditionActionConfig;
    /** True branch */
    readonly branches: {
        readonly true: ActionBranch;
        readonly false: ActionBranch;
    };
}

/**
 * Switch case.
 */
export interface SwitchCase {
    /** Case value */
    readonly case: string | number | boolean;

    /** Actions for this case */
    readonly actions: readonly string[];
}

/**
 * Switch action configuration.
 */
export interface SwitchActionConfig {
    /** Expression to switch on */
    readonly expression: Expression;
}

/**
 * Switch action.
 */
export interface SwitchAction extends IRActionBase {
    readonly type: 'switch';
    readonly category: 'control-flow';
    readonly config: SwitchActionConfig;
    /** Switch cases */
    readonly cases: Record<string, ActionBranch>;
    /** Default case */
    readonly default?: ActionBranch;
}

/**
 * ForEach action configuration.
 */
export interface ForEachActionConfig {
    /** Items to iterate over */
    readonly items: Expression;

    /** Concurrency settings */
    readonly concurrency?: {
        readonly degree?: number;
        readonly sequential?: boolean;
    };
}

/**
 * ForEach action.
 */
export interface ForEachAction extends IRActionBase {
    readonly type: 'foreach';
    readonly category: 'control-flow';
    readonly config: ForEachActionConfig;
    /** Actions to execute for each item */
    readonly actions: readonly string[];
}

/**
 * Until action configuration.
 */
export interface UntilActionConfig {
    /** Loop exit expression */
    readonly expression: Expression;

    /** Maximum iterations */
    readonly limit?: {
        readonly count?: number;
        readonly timeout?: ISODuration;
    };
}

/**
 * Until (do-while) action.
 */
export interface UntilAction extends IRActionBase {
    readonly type: 'until';
    readonly category: 'control-flow';
    readonly config: UntilActionConfig;
    /** Actions to execute in loop */
    readonly actions: readonly string[];
}

/**
 * Parallel action configuration.
 */
export interface ParallelActionConfig {
    /** Maximum parallel branches */
    readonly maxConcurrency?: number;
}

/**
 * Parallel (fork-join) action.
 */
export interface ParallelAction extends IRActionBase {
    readonly type: 'parallel';
    readonly category: 'control-flow';
    readonly config?: ParallelActionConfig;
    /** Parallel branches */
    readonly branches: Record<string, ActionBranch>;
}

/**
 * Scope action configuration.
 */
export interface ScopeActionConfig {
    /** Whether scope is transactional */
    readonly transactional?: boolean;

    /** Transaction isolation level */
    readonly isolation?: 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';
}

/**
 * Scope action (for grouping and error handling).
 */
export interface ScopeAction extends IRActionBase {
    readonly type: 'scope';
    readonly category: 'control-flow';
    readonly config?: ScopeActionConfig;
    /** Actions within scope */
    readonly actions: readonly string[];
    /** Error handling for scope */
    readonly scopeErrorHandling?: {
        readonly catch?: {
            readonly actions: readonly string[];
        };
        readonly finally?: {
            readonly actions: readonly string[];
        };
    };
}

// =============================================================================
// Integration Action Types
// =============================================================================

/**
 * HTTP call action configuration.
 */
export interface HttpCallActionConfig {
    /** HTTP method */
    readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

    /** Target URI */
    readonly uri: Expression | string;

    /** Request headers */
    readonly headers?: Record<string, Expression | string>;

    /** Query parameters */
    readonly queries?: Record<string, Expression | string>;

    /** Request body */
    readonly body?: Expression | unknown;

    /** Authentication */
    readonly authentication?: {
        readonly type: 'None' | 'Basic' | 'ClientCertificate' | 'ActiveDirectoryOAuth' | 'Raw' | 'ManagedServiceIdentity';
        readonly config?: ConfigRecord;
    };

    /** Cookie handling */
    readonly cookie?: {
        readonly enabled?: boolean;
    };

    /** Retry policy specific to this call */
    readonly retryPolicy?: ActionRetryPolicy;
}

/**
 * HTTP call action.
 */
export interface HttpCallAction extends IRActionBase {
    readonly type: 'http-call';
    readonly category: 'integration';
    readonly config: HttpCallActionConfig;
}

/**
 * HTTP response action configuration.
 */
export interface HttpResponseActionConfig {
    /** Response status code */
    readonly statusCode: number | Expression;

    /** Response headers */
    readonly headers?: Record<string, Expression | string>;

    /** Response body */
    readonly body?: Expression | unknown;

    /** Response schema */
    readonly schema?: Record<string, unknown>;
}

/**
 * HTTP response action.
 */
export interface HttpResponseAction extends IRActionBase {
    readonly type: 'http-response';
    readonly category: 'integration';
    readonly config: HttpResponseActionConfig;
}

/**
 * Database query action configuration.
 */
export interface DatabaseQueryActionConfig {
    /** Connection reference */
    readonly connectionRef: JSONPointer;

    /** Query text */
    readonly query: string;

    /** Query parameters */
    readonly parameters?: Record<string, Expression | unknown>;
}

/**
 * Database query action.
 */
export interface DatabaseQueryAction extends IRActionBase {
    readonly type: 'database-query';
    readonly category: 'integration';
    readonly config: DatabaseQueryActionConfig;
}

/**
 * Database execute action configuration.
 */
export interface DatabaseExecuteActionConfig {
    /** Connection reference */
    readonly connectionRef: JSONPointer;

    /** Stored procedure or statement */
    readonly procedure?: string;
    readonly statement?: string;

    /** Parameters */
    readonly parameters?: Record<string, Expression | unknown>;
}

/**
 * Database execute action.
 */
export interface DatabaseExecuteAction extends IRActionBase {
    readonly type: 'database-execute';
    readonly category: 'integration';
    readonly config: DatabaseExecuteActionConfig;
}

/**
 * Queue send action configuration.
 */
export interface QueueSendActionConfig {
    /** Connection reference */
    readonly connectionRef: JSONPointer;

    /** Queue/topic name */
    readonly destination: string;

    /** Message content */
    readonly content: Expression | unknown;

    /** Message properties */
    readonly properties?: Record<string, Expression | unknown>;

    /** Content type */
    readonly contentType?: string;
}

/**
 * Queue send action.
 */
export interface QueueSendAction extends IRActionBase {
    readonly type: 'queue-send';
    readonly category: 'integration';
    readonly config: QueueSendActionConfig;
}

// =============================================================================
// Workflow Action Types
// =============================================================================

/**
 * Call workflow action configuration.
 */
export interface CallWorkflowActionConfig {
    /** Workflow name to call */
    readonly workflowName: string;

    /** Workflow trigger path */
    readonly triggerPath?: string;

    /** Call mode */
    readonly mode?: 'sync' | 'async';

    /** Request body */
    readonly body?: Expression | unknown;
}

/**
 * Call workflow action.
 */
export interface CallWorkflowAction extends IRActionBase {
    readonly type: 'call-workflow';
    readonly category: 'workflow';
    readonly config: CallWorkflowActionConfig;
}

/**
 * Terminate action configuration.
 */
export interface TerminateActionConfig {
    /** Termination status */
    readonly status: 'Succeeded' | 'Failed' | 'Cancelled';

    /** Termination code */
    readonly code?: string;

    /** Termination message */
    readonly message?: string;
}

/**
 * Terminate action.
 */
export interface TerminateAction extends IRActionBase {
    readonly type: 'terminate';
    readonly category: 'utility';
    readonly config: TerminateActionConfig;
}

/**
 * Delay action configuration.
 */
export interface DelayActionConfig {
    /** Delay duration */
    readonly duration: ISODuration;
}

/**
 * Delay action.
 */
export interface DelayAction extends IRActionBase {
    readonly type: 'delay';
    readonly category: 'utility';
    readonly config: DelayActionConfig;
}

/**
 * Delay until action configuration.
 */
export interface DelayUntilActionConfig {
    /** Target timestamp */
    readonly timestamp: Expression;
}

/**
 * Delay until action.
 */
export interface DelayUntilAction extends IRActionBase {
    readonly type: 'delay-until';
    readonly category: 'utility';
    readonly config: DelayUntilActionConfig;
}

/**
 * Azure Function action configuration.
 */
export interface AzureFunctionActionConfig {
    /** Function app ID or name */
    readonly functionApp: string;

    /** Function name */
    readonly functionName: string;

    /** Function trigger path */
    readonly triggerPath?: string;

    /** Request body */
    readonly body?: Expression | unknown;

    /** Request method */
    readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

/**
 * Azure Function action.
 */
export interface AzureFunctionAction extends IRActionBase {
    readonly type: 'azure-function';
    readonly category: 'integration';
    readonly config: AzureFunctionActionConfig;
}

/**
 * Custom action configuration.
 */
export interface CustomActionConfig {
    /** Custom action type identifier */
    readonly customType: string;

    /** Configuration properties */
    readonly properties: ConfigRecord;
}

/**
 * Custom action.
 */
export interface CustomAction extends IRActionBase {
    readonly type: 'custom';
    readonly config: CustomActionConfig;
}

// =============================================================================
// Action Union Type
// =============================================================================

/**
 * Union of all action types.
 * Use type guards to narrow to specific action types.
 */
export type IRAction =
    // Data actions
    | TransformAction
    | ComposeAction
    | ParseAction
    | ValidateAction
    | SetVariableAction
    | AppendVariableAction
    | IncrementVariableAction
    // Control flow actions
    | ConditionAction
    | SwitchAction
    | ForEachAction
    | UntilAction
    | ParallelAction
    | ScopeAction
    // Integration actions
    | HttpCallAction
    | HttpResponseAction
    | DatabaseQueryAction
    | DatabaseExecuteAction
    | QueueSendAction
    // Workflow actions
    | CallWorkflowAction
    | TerminateAction
    | DelayAction
    | DelayUntilAction
    | AzureFunctionAction
    | CustomAction;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for transform action.
 */
export function isTransformAction(action: IRAction): action is TransformAction {
    return action.type === 'transform';
}

/**
 * Type guard for condition action.
 */
export function isConditionAction(action: IRAction): action is ConditionAction {
    return action.type === 'condition';
}

/**
 * Type guard for switch action.
 */
export function isSwitchAction(action: IRAction): action is SwitchAction {
    return action.type === 'switch';
}

/**
 * Type guard for foreach action.
 */
export function isForEachAction(action: IRAction): action is ForEachAction {
    return action.type === 'foreach';
}

/**
 * Type guard for parallel action.
 */
export function isParallelAction(action: IRAction): action is ParallelAction {
    return action.type === 'parallel';
}

/**
 * Type guard for scope action.
 */
export function isScopeAction(action: IRAction): action is ScopeAction {
    return action.type === 'scope';
}

/**
 * Type guard for control flow actions.
 */
export function isControlFlowAction(action: IRAction): boolean {
    return action.category === 'control-flow';
}

/**
 * Type guard for integration actions.
 */
export function isIntegrationAction(action: IRAction): boolean {
    return action.category === 'integration';
}

/**
 * Type guard for actions with nested actions.
 */
export function hasNestedActions(action: IRAction): action is ConditionAction | SwitchAction | ForEachAction | UntilAction | ParallelAction | ScopeAction {
    return ['condition', 'switch', 'foreach', 'until', 'parallel', 'scope'].includes(action.type);
}
