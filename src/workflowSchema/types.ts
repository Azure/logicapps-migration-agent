/**
 * Logic Apps Standard Workflow Definition Types
 *
 * TypeScript interfaces matching the structure defined in
 * `workflowDefinitionSchema.json` (Microsoft.Logic/schemas/2016-06-01).
 *
 * @module workflowSchema/types
 */

// =============================================================================
// Top-level definition
// =============================================================================

/**
 * Logic Apps Standard workflow definition — matches the structure defined in
 * `workflowDefinitionSchema.json`.
 *
 * Required fields: `$schema`, `contentVersion`.
 */
export interface LogicAppsWorkflowDefinition {
    /** Must be `"https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#"` */
    $schema: string;
    /** 4-digit version string, e.g. `"1.0.0.0"` */
    contentVersion: string;
    /** Workflow actions keyed by action name */
    actions?: Record<string, WorkflowAction>;
    /** Workflow triggers keyed by trigger name */
    triggers?: Record<string, WorkflowTrigger>;
    /** Workflow parameters */
    parameters?: Record<string, WorkflowParameter>;
    /** Workflow outputs */
    outputs?: Record<string, WorkflowOutput>;
    /** Optional description */
    description?: string;
    /** Definition metadata */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
    /** Static results for testing */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    staticResults?: Record<string, any>;
}

// =============================================================================
// Parameter / Output sub-types
// =============================================================================

/** Valid parameter/output data types per the schema */
export type WorkflowParameterType =
    | 'Array'
    | 'Bool'
    | 'Float'
    | 'Int'
    | 'Object'
    | 'SecureObject'
    | 'SecureString'
    | 'String';

/** A single workflow parameter (input) */
export interface WorkflowParameter {
    /** Parameter data type */
    type?: WorkflowParameterType;
    /** Parameter value */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value?: any;
    /** Default value when none supplied */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValue?: any;
    /** Allowed values constraint */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allowedValues?: any[];
    /** Parameter metadata */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
    /** Parameter description */
    description?: string;
}

/** A single workflow output */
export interface WorkflowOutput {
    /** Output data type */
    type?: WorkflowParameterType;
    /** Output value */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value?: any;
    /** Output metadata */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
    /** Output description */
    description?: string;
    /** Output error */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error?: any;
}

// =============================================================================
// Runtime / Retry sub-types
// =============================================================================

/** Valid retry policy types per the schema */
export type RetryPolicyType = 'None' | 'Fixed' | 'Exponential';

/** Retry policy — appears inside `inputs` for retryable actions (ApiConnection, Http, etc.) */
export interface RetryPolicy {
    /** Retry strategy */
    type?: RetryPolicyType;
    /** ISO 8601 duration between retries, e.g. `"PT20S"` */
    interval?: string;
    /** Number of retry attempts */
    count?: number;
    /** Minimum delay for exponential back-off */
    minimumInterval?: string;
    /** Maximum delay for exponential back-off */
    maximumInterval?: string;
}

/** Concurrency configuration for actions / triggers */
export interface FlowConcurrencyConfiguration {
    /** Concurrency repetitions (Foreach) */
    repetitions?: number;
    /** Concurrent runs (triggers) */
    runs?: number;
    /** Maximum queued runs */
    maximumWaitingRuns?: number;
}

/** Pagination policy */
export interface FlowPaginationPolicy {
    /** Minimum item count before pagination stops */
    minimumItemCount?: number;
}

/** Content transfer configuration */
export interface FlowContentTransferConfiguration {
    /** Transfer mode — `Chunked` */
    transferMode?: 'Chunked' | string;
}

/** Runtime configuration — shared by actions and triggers */
export interface RuntimeConfiguration {
    /** Pagination policy */
    paginationPolicy?: FlowPaginationPolicy;
    /** Content transfer settings */
    contentTransfer?: FlowContentTransferConfiguration;
    /** Concurrency settings */
    concurrency?: FlowConcurrencyConfiguration;
    /** Secure-inputs / secure-outputs flags and other arbitrary settings */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

// =============================================================================
// Recurrence sub-types
// =============================================================================

/** Monthly occurrence within a recurrence schedule */
export interface MonthlyOccurrence {
    dayOfWeek: string;
    occurrence: number;
}

/** Recurrence schedule details */
export interface RecurrenceSchedule {
    /** Minutes on which the job fires */
    minutes?: (number | string)[];
    /** Hours on which the job fires */
    hours?: (number | string)[];
    /** Days of the week */
    weekDays?: string[];
    /** Days of the month */
    monthDays?: number[];
    /** Monthly occurrences */
    monthlyOccurrences?: MonthlyOccurrence[];
}

/** Full recurrence configuration (used by Recurrence, SlidingWindow, ApiConnection triggers, etc.) */
export interface Recurrence {
    /** Frequency — `Second`, `Minute`, `Hour`, `Day`, `Week`, `Month`, `Year` */
    frequency?: string;
    /** Recurrence interval */
    interval?: number;
    /** Maximum trigger count */
    count?: number;
    /** ISO 8601 start time */
    startTime?: string;
    /** ISO 8601 end time */
    endTime?: string;
    /** IANA time zone, e.g. `"UTC"` */
    timeZone?: string;
    /** Detailed schedule */
    schedule?: RecurrenceSchedule;
}

// =============================================================================
// Until limit
// =============================================================================

/** Limit configuration for `Until` loops */
export interface UntilLimit {
    /** Maximum iteration count */
    count?: number | string;
    /** ISO 8601 timeout duration, e.g. `"PT1H"` */
    timeout?: string;
}

// =============================================================================
// RunAfter status enum
// =============================================================================

/** Valid status values for `runAfter` dependencies */
export type RunAfterStatus =
    | 'Aborted'
    | 'Cancelled'
    | 'Failed'
    | 'Faulted'
    | 'Ignored'
    | 'Paused'
    | 'Running'
    | 'Skipped'
    | 'Succeeded'
    | 'Suspended'
    | 'TimedOut'
    | 'Waiting';

// =============================================================================
// Action
// =============================================================================

/** A single action inside the workflow definition */
export interface WorkflowAction {
    /** Action type — e.g. `ApiConnection`, `Http`, `If`, `Switch`, `Foreach`, `Compose`, etc. */
    type: string;
    /** Action kind — e.g. `Http`, `ApiConnection`, `JsonToJson`, etc. */
    kind?: string;
    /** Description of what this action does */
    description?: string;
    /** Dependencies — keys are action names, values are required status arrays */
    runAfter?: Record<string, RunAfterStatus[]>;
    /** Action inputs (shape varies by type) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputs?: any;
    /** For `If` actions — true-branch nested actions */
    actions?: Record<string, WorkflowAction>;
    /** For `If` actions — false-branch */
    else?: { actions?: Record<string, WorkflowAction> };
    /** For `Switch` actions — named cases */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cases?: Record<string, { case?: any; actions?: Record<string, WorkflowAction> }>;
    /** For `Switch`/`If` — the condition expression */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expression?: any;
    /** For `Foreach` — the iterable expression (string or array) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    foreach?: string | any[];
    /** For `Until` — the limit configuration */
    limit?: UntilLimit;
    /** Default case for `Switch` */
    default?: { actions?: Record<string, WorkflowAction> };
    /** Tracked properties */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackedProperties?: any;
    /** Operation options */
    operationOptions?: string;
    /** Runtime configuration (pagination, concurrency, content transfer) */
    runtimeConfiguration?: RuntimeConfiguration;
    /** Metadata */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
    /** Recurrence schedule (mainly for triggers, but can appear on actions) */
    recurrence?: Recurrence;
}

// =============================================================================
// Trigger-specific sub-types
// =============================================================================

/** SplitOn correlation configuration */
export interface SplitOnConfiguration {
    correlation?: {
        clientTrackingId?: string;
    };
}

/** Trigger condition expression */
export interface TriggerCondition {
    expression?: string;
    dependsOn?: string;
}

// =============================================================================
// Trigger
// =============================================================================

/** A single trigger inside the workflow definition */
export interface WorkflowTrigger {
    /** Trigger type — e.g. `Request`, `ApiConnection`, `Recurrence`, etc. */
    type: string;
    /** Trigger kind */
    kind?: string;
    /** Description */
    description?: string;
    /** Trigger inputs */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputs?: any;
    /** Recurrence schedule */
    recurrence?: Recurrence;
    /** Conditions */
    conditions?: TriggerCondition[];
    /** SplitOn expression — triggers batch debatching */
    splitOn?: string;
    /** SplitOn correlation configuration */
    splitOnConfiguration?: SplitOnConfiguration;
    /** Correlation properties */
    correlation?: {
        clientTrackingId?: string;
    };
    /** Operation options */
    operationOptions?: string;
    /** Runtime configuration (pagination, concurrency, content transfer) */
    runtimeConfiguration?: RuntimeConfiguration;
    /** Metadata */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
}
