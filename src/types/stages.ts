/**
 * Stage Type Definitions
 *
 * Comprehensive type definitions for the migration stage state machine.
 * These types define the 5-stage workflow from Discovery through Deployment.
 *
 * @module types/stages
 */

// ============================================================================
// CORE ENUMS
// ============================================================================

/**
 * The 5 migration stages in order.
 * Each stage represents a distinct phase in the migration workflow.
 *
 * Flow: Discovery → Planning → Conversion → Validation → Deployment
 */
export enum MigrationStage {
    /** Stage 0: Initial state before migration starts */
    NotStarted = 'NOT_STARTED',

    /** Stage 1: Find and catalog all integration artifacts from source platform */
    Discovery = 'DISCOVERY',

    /** Stage 2: Analyze, plan roadmap, and map source patterns to Logic Apps patterns */
    Planning = 'PLANNING',

    /** Stage 3: Transform source to Logic Apps artifacts */
    Conversion = 'CONVERSION',

    /** Stage 4: Test generated workflows and validate behavior */
    Validation = 'VALIDATION',

    /** Stage 5: Deploy to Azure */
    Deployment = 'DEPLOYMENT',

    /** Final state: Migration completed successfully */
    Completed = 'COMPLETED',
}

/**
 * State of a stage within the state machine.
 */
export enum StageState {
    /** Stage has not been started yet */
    NotStarted = 'NOT_STARTED',

    /** Stage is currently active/in progress */
    InProgress = 'IN_PROGRESS',

    /** Stage completed successfully */
    Completed = 'COMPLETED',

    /** Stage was skipped (optional stages only) */
    Skipped = 'SKIPPED',

    /** Stage is blocked due to unmet prerequisites */
    Blocked = 'BLOCKED',
}

/**
 * Type of exit criteria.
 */
export enum CriteriaType {
    /** Automatically validated by the system */
    Automatic = 'AUTOMATIC',

    /** Requires manual confirmation by user */
    Manual = 'MANUAL',
}

/**
 * Severity level for criteria.
 */
export enum CriteriaSeverity {
    /** Must be satisfied to proceed */
    Required = 'REQUIRED',

    /** Recommended but won't block progression */
    Recommended = 'RECOMMENDED',

    /** Optional informational criteria */
    Optional = 'OPTIONAL',
}

// ============================================================================
// STAGE INFORMATION TYPES
// ============================================================================

/**
 * Static metadata about a migration stage.
 * This information doesn't change during the migration.
 */
export interface StageMetadata {
    /** The stage identifier */
    readonly stage: MigrationStage;

    /** Display name for UI */
    readonly displayName: string;

    /** Short description of the stage purpose */
    readonly description: string;

    /** Detailed guidance text (markdown) */
    readonly guidance: string;

    /** Numeric order (1-8, 0 for NotStarted, 9 for Completed) */
    readonly order: number;

    /** Whether this stage can be skipped */
    readonly isOptional: boolean;

    /** Icon for UI display (VS Code codicon) */
    readonly icon: string;
}

/**
 * Runtime status of a stage.
 * This changes as the migration progresses.
 */
export interface StageStatus {
    /** The stage */
    stage: MigrationStage;

    /** Current state of this stage */
    state: StageState;

    /** When the stage was started (ISO timestamp) */
    startedAt?: string;

    /** When the stage was completed (ISO timestamp) */
    completedAt?: string;

    /** Duration in milliseconds (calculated) */
    duration?: number;

    /** Error message if stage failed */
    error?: string;

    /** IDs of exit criteria that have been checked/satisfied */
    satisfiedCriteria: string[];
}

// ============================================================================
// EXIT CRITERIA TYPES
// ============================================================================

/**
 * Result of validating a single exit criterion.
 */
export interface CriteriaValidationResult {
    /** The criterion ID */
    criterionId: string;

    /** Whether the criterion is satisfied */
    satisfied: boolean;

    /** Message describing the result */
    message: string;

    /** Detailed information (for debugging) */
    details?: Record<string, unknown>;
}

/**
 * Definition of an exit criterion for a stage.
 * Exit criteria must be satisfied before advancing to the next stage.
 */
export interface ExitCriterion {
    /** Unique identifier for this criterion */
    readonly id: string;

    /** The stage this criterion belongs to */
    readonly stage: MigrationStage;

    /** Human-readable description */
    readonly description: string;

    /** Detailed help text */
    readonly helpText?: string;

    /** Type: automatic (system-validated) or manual (user-confirmed) */
    readonly type: CriteriaType;

    /** Severity: required, recommended, or optional */
    readonly severity: CriteriaSeverity;

    /** Order for display */
    readonly order: number;

    /**
     * Validator function for automatic criteria.
     * Returns true if criterion is satisfied.
     * Only called for CriteriaType.Automatic.
     */
    readonly validator?: () => Promise<boolean>;

    /**
     * Optional validator dependencies.
     * List of other criterion IDs that must be satisfied first.
     */
    readonly dependsOn?: string[];
}

/**
 * Complete exit criteria validation result for a stage.
 */
export interface StageValidationResult {
    /** The stage that was validated */
    stage: MigrationStage;

    /** Overall validation passed */
    valid: boolean;

    /** Can proceed (all required criteria satisfied) */
    canProceed: boolean;

    /** Has warnings (recommended criteria not satisfied) */
    hasWarnings: boolean;

    /** Individual criterion results */
    criteriaResults: CriteriaValidationResult[];

    /** List of blocking criteria (required but not satisfied) */
    blockers: string[];

    /** List of warning criteria (recommended but not satisfied) */
    warnings: string[];

    /** Timestamp of validation */
    validatedAt: string;
}

// ============================================================================
// STATE MACHINE TYPES
// ============================================================================

/**
 * Complete state of the migration state machine.
 * This is serialized and persisted to storage.
 */
export interface StateMachineState {
    /** Current active stage */
    currentStage: MigrationStage;

    /** Status of each stage */
    stageStatuses: Map<MigrationStage, StageStatus>;

    /** History of all stage transitions */
    transitionHistory: StageTransition[];

    /** Manual criteria confirmations (criterionId → confirmed) */
    manualCriteriaState: Map<string, boolean>;

    /** When the migration was started */
    migrationStartedAt?: string;

    /** When the migration was completed */
    migrationCompletedAt?: string;

    /** Total elapsed time in milliseconds */
    totalDuration?: number;

    /** Schema version for migrations */
    schemaVersion: string;

    /** Last updated timestamp */
    lastUpdated: string;
}

/**
 * Record of a stage transition.
 */
export interface StageTransition {
    /** Unique transition ID */
    id: string;

    /** Source stage */
    fromStage: MigrationStage;

    /** Target stage */
    toStage: MigrationStage;

    /** Type of transition */
    type: TransitionType;

    /** Whether transition succeeded */
    success: boolean;

    /** Reason for failure if not successful */
    failureReason?: string;

    /** Timestamp of transition */
    timestamp: string;

    /** User who initiated (for audit) */
    initiatedBy?: string;
}

/**
 * Type of stage transition.
 */
export enum TransitionType {
    /** Normal forward progression */
    Forward = 'FORWARD',

    /** Going back to previous stage */
    Backward = 'BACKWARD',

    /** Skipping an optional stage */
    Skip = 'SKIP',

    /** Direct jump (admin/debug only) */
    Jump = 'JUMP',

    /** Reset to initial state */
    Reset = 'RESET',
}

/**
 * Result of attempting a stage transition.
 */
export interface TransitionResult {
    /** Whether transition succeeded */
    success: boolean;

    /** New stage after transition (if successful) */
    newStage?: MigrationStage;

    /** Previous stage */
    previousStage: MigrationStage;

    /** Type of transition attempted */
    transitionType: TransitionType;

    /** List of blocking issues */
    blockedBy?: string[];

    /** Warnings (non-blocking) */
    warnings?: string[];

    /** Error message if failed */
    error?: string;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event fired when stage changes.
 */
export interface StageChangeEvent {
    /** Previous stage */
    previousStage: MigrationStage;

    /** New current stage */
    currentStage: MigrationStage;

    /** Transition type */
    transitionType: TransitionType;

    /** Timestamp */
    timestamp: string;
}

/**
 * Event fired when stage state changes.
 */
export interface StageStateChangeEvent {
    /** The stage that changed */
    stage: MigrationStage;

    /** Previous state */
    previousState: StageState;

    /** New state */
    currentState: StageState;

    /** Timestamp */
    timestamp: string;
}

/**
 * Event fired when exit criteria status changes.
 */
export interface CriteriaChangeEvent {
    /** The stage */
    stage: MigrationStage;

    /** Criterion ID */
    criterionId: string;

    /** Previous satisfied state */
    wasSatisfied: boolean;

    /** Current satisfied state */
    isSatisfied: boolean;

    /** Timestamp */
    timestamp: string;
}

// ============================================================================
// NAVIGATION & QUERY TYPES
// ============================================================================

/**
 * Information about available transitions from current stage.
 */
export interface NavigationOptions {
    /** Current stage */
    currentStage: MigrationStage;

    /** Can advance to next stage */
    canAdvance: boolean;

    /** Reason why can't advance (if canAdvance is false) */
    advanceBlockedReason?: string;

    /** Can go back to previous stage */
    canGoBack: boolean;

    /** Previous stage (if canGoBack) */
    previousStage?: MigrationStage;

    /** Next stage (if canAdvance) */
    nextStage?: MigrationStage;

    /** Stages that can be jumped to (for iteration loops) */
    allowedJumps: MigrationStage[];
}

/**
 * Progress information for the migration.
 */
export interface MigrationProgress {
    /** Current stage */
    currentStage: MigrationStage;

    /** Current stage state */
    currentStageState: StageState;

    /** Completion percentage (0-100) */
    completionPercentage: number;

    /** Number of stages completed */
    stagesCompleted: number;

    /** Total number of stages (8) */
    totalStages: number;

    /** Estimated remaining time (if calculable) */
    estimatedRemainingTime?: number;

    /** Exit criteria progress for current stage */
    currentStageCriteriaProgress: {
        satisfied: number;
        total: number;
        percentage: number;
    };
}

// ============================================================================
// SERIALIZATION TYPES
// ============================================================================

/**
 * Serialized state machine state for storage.
 * Maps are converted to arrays for JSON compatibility.
 */
export interface SerializedStateMachineState {
    currentStage: MigrationStage;
    stageStatuses: [MigrationStage, StageStatus][];
    transitionHistory: StageTransition[];
    manualCriteriaState: [string, boolean][];
    migrationStartedAt?: string;
    migrationCompletedAt?: string;
    totalDuration?: number;
    schemaVersion: string;
    lastUpdated: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid MigrationStage
 */
export function isMigrationStage(value: unknown): value is MigrationStage {
    return Object.values(MigrationStage).includes(value as MigrationStage);
}

/**
 * Check if a value is a valid StageState
 */
export function isStageState(value: unknown): value is StageState {
    return Object.values(StageState).includes(value as StageState);
}

/**
 * Check if a stage is a terminal state (NotStarted or Completed)
 */
export function isTerminalStage(stage: MigrationStage): boolean {
    return stage === MigrationStage.NotStarted || stage === MigrationStage.Completed;
}

/**
 * Check if a stage is an active migration stage (1-8)
 */
export function isActiveStage(stage: MigrationStage): boolean {
    return !isTerminalStage(stage);
}
