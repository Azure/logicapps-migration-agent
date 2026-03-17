/**
 * Workflow Schema Index
 *
 * Re-exports all Logic Apps Standard workflow definition types.
 *
 * @module workflowSchema
 */

export type {
    LogicAppsWorkflowDefinition,
    WorkflowParameterType,
    WorkflowParameter,
    WorkflowOutput,
    RetryPolicyType,
    RetryPolicy,
    FlowConcurrencyConfiguration,
    FlowPaginationPolicy,
    FlowContentTransferConfiguration,
    RuntimeConfiguration,
    MonthlyOccurrence,
    RecurrenceSchedule,
    Recurrence,
    UntilLimit,
    RunAfterStatus,
    WorkflowAction,
    SplitOnConfiguration,
    TriggerCondition,
    WorkflowTrigger,
} from './types';
export { validateWorkflowDefinition } from './validation';
export type { WorkflowValidationResult } from './validation';
