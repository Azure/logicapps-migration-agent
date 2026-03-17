/**
 * Conversion Stage Types
 *
 * Type definitions for the Conversion stage. The conversion stage takes
 * finalized planning results and produces an ordered set of conversion
 * tasks that the agent determines dynamically based on the specific
 * needs of each flow.
 *
 * @module stages/conversion/types
 */

// =============================================================================
// Flow Selection Types
// =============================================================================

/**
 * A planned flow available for conversion.
 * Derived from planning stage results.
 */
export interface ConversionFlow {
    /** Unique flow ID (matches planning flow ID) */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Description of the flow */
    readonly description: string;

    /** Category of flow */
    readonly category: string;

    /** Number of artifacts in this flow */
    readonly artifactCount: number;

    /** IDs of artifacts belonging to this flow */
    readonly artifactIds: string[];

    /** Conversion status for this flow */
    status: ConversionFlowStatus;

    /** True while Execute All orchestration is active for this flow */
    executeAllActive?: boolean;
}

/**
 * Conversion status for a flow.
 */
export type ConversionFlowStatus =
    | 'not-started'
    | 'thinking'
    | 'tasks-ready'
    | 'in-progress'
    | 'completed'
    | 'failed';

// =============================================================================
// Conversion Task Types
// =============================================================================

/**
 * A single conversion task determined by the agent.
 * Tasks are ordered by dependencies — a task cannot start until all
 * tasks it depends on have completed.
 */
export interface ConversionTask {
    /** Unique task ID (agent-assigned, e.g. "task-1", "create-ia") */
    readonly id: string;

    /** Short task type label chosen by the agent
     *  (e.g. "create-integration-account", "convert-schemas", "generate-workflow")
     */
    readonly type: string;

    /** Human-readable task name */
    readonly name: string;

    /** Detailed description of what this task does */
    readonly description: string;

    /** Detailed agent execution prompt/instructions for this task (not intended for card display) */
    readonly executionPrompt?: string;

    /** IDs of tasks that must complete before this one can start */
    readonly dependsOn: string[];

    /** Current task status */
    status: ConversionTaskStatus;

    /** Task execution order (1-based, assigned by the agent) */
    readonly order: number;

    /** Optional: the specific artifacts this task operates on */
    readonly artifactIds?: string[];

    /** Optional: estimated effort in minutes */
    readonly estimatedMinutes?: number;

    /** Whether this task is optional (user can skip it) */
    readonly optional?: boolean;

    /** Optional: agent-supplied output/result after task execution */
    output?: ConversionTaskOutput;
}

/**
 * Status of a single conversion task.
 */
export type ConversionTaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';

/**
 * Output produced by completing a conversion task.
 * The shape depends on the task type — the agent decides what to store.
 */
export interface ConversionTaskOutput {
    /** When the task was completed */
    readonly completedAt: string;

    /** Summary of what was done */
    readonly summary: string;

    /** Files generated or modified (workspace-relative paths) */
    readonly generatedFiles?: string[];

    /** Any warnings or notes */
    readonly warnings?: string[];

    /** Arbitrary structured data the agent wants to persist */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly data?: Record<string, any>;
}

// =============================================================================
// Conversion Task Plan
// =============================================================================

/**
 * The complete task plan for converting a single flow.
 * Produced by the agent after analysing planning results.
 */
export interface ConversionTaskPlan {
    /** Flow ID this plan belongs to */
    readonly flowId: string;

    /** Flow name */
    readonly flowName: string;

    /** When the task plan was generated */
    readonly generatedAt: string;

    /** Ordered list of conversion tasks */
    readonly tasks: ConversionTask[];

    /** Agent's summary of the conversion approach */
    readonly summary: string;

    /** Agent's notes on prerequisites or assumptions */
    readonly prerequisites?: string[];
}

// =============================================================================
// Conversion Stage State
// =============================================================================

/**
 * Complete state for the conversion stage.
 */
export interface ConversionStageState {
    /** All flows available for conversion */
    readonly flows: ConversionFlow[];

    /** Task plans keyed by flow ID */
    readonly taskPlans: Record<string, ConversionTaskPlan>;

    /** Currently selected flow ID */
    selectedFlowId?: string;

    /** When conversion started */
    readonly startedAt: string;

    /** When last updated */
    updatedAt: string;
}
