/**
 * IR Metadata Types
 *
 * Type definitions for the metadata section of the IR document.
 * Contains source/target platform information, migration status,
 * complexity analysis, and user overrides.
 *
 * @module ir/types/metadata
 */

import {
    SourcePlatformType,
    TargetPlatformType,
    MigrationStatus,
    ComplexityLevel,
    ConfidenceLevel,
    ArtifactType,
    SourceFileType,
    WorkflowType,
    OverrideSource,
    ISOTimestamp,
} from './common';

// =============================================================================
// Source Metadata
// =============================================================================

/**
 * Metadata about a source artifact.
 * Captures the physical file information and artifact classification.
 */
export interface SourceArtifact {
    /** Display name of the artifact */
    readonly name: string;

    /** Classification of the artifact type */
    readonly type: ArtifactType;

    /** Absolute or relative path to the source file */
    readonly filePath: string;

    /** File extension/type */
    readonly fileType: SourceFileType | string;

    /** Last modification timestamp (ISO 8601) */
    readonly lastModified?: ISOTimestamp;

    /** File size in bytes */
    readonly sizeBytes?: number;

    /** Hash of file contents for change detection */
    readonly contentHash?: string;
}

/**
 * Source environment metadata.
 * Describes the environment where the source artifact was discovered.
 */
export interface SourceEnvironment {
    /** Environment name (e.g., "production", "staging") */
    readonly name: string;

    /** Geographic region */
    readonly region?: string;

    /** Server or instance name */
    readonly server?: string;

    /** Additional environment properties */
    readonly properties?: Record<string, string>;
}

/**
 * Complete source metadata.
 * Captures all information about the source platform and artifact.
 */
export interface SourceMetadata {
    /** Source platform type */
    readonly platform: SourcePlatformType;

    /** Platform version (e.g., "2020", "4.4.0") */
    readonly platformVersion: string;

    /** Application or project name */
    readonly application: string;

    /** Artifact details */
    readonly artifact: SourceArtifact;

    /** Environment information */
    readonly environment?: SourceEnvironment;

    /** Additional platform-specific metadata */
    readonly platformMetadata?: Record<string, unknown>;
}

// =============================================================================
// Target Metadata
// =============================================================================

/**
 * Target platform metadata.
 * Describes the desired Azure Logic Apps configuration.
 */
export interface TargetMetadata {
    /** Target platform type */
    readonly platform: TargetPlatformType;

    /** Workflow type (stateful/stateless) */
    readonly workflowType: WorkflowType;

    /** Azure resource group name */
    readonly resourceGroup?: string;

    /** Logic App resource name */
    readonly logicAppName?: string;

    /** Azure subscription ID */
    readonly subscriptionId?: string;

    /** Azure region/location */
    readonly location?: string;

    /** Integration Account name (if required) */
    readonly integrationAccountName?: string;
}

// =============================================================================
// Complexity Analysis
// =============================================================================

/**
 * A single factor contributing to complexity score.
 */
export interface ComplexityFactor {
    /** Factor name/identifier */
    readonly factor: string;

    /** Weight/contribution to overall score (0-100) */
    readonly weight: number;

    /** Human-readable description */
    readonly description?: string;

    /** Specific artifacts contributing to this factor */
    readonly affectedArtifacts?: readonly string[];
}

/**
 * Effort estimate for migration work.
 */
export interface EffortEstimate {
    /** Estimated hours of work */
    readonly hours: number;

    /** Confidence level in the estimate */
    readonly confidence: ConfidenceLevel;

    /** Minimum hours (optimistic) */
    readonly minHours?: number;

    /** Maximum hours (pessimistic) */
    readonly maxHours?: number;

    /** Breakdown by phase */
    readonly breakdown?: {
        readonly conversion?: number;
        readonly testing?: number;
        readonly deployment?: number;
        readonly validation?: number;
    };
}

/**
 * Migration status and tracking metadata.
 */
export interface MigrationMetadata {
    /** Current migration stage status */
    status: MigrationStatus;

    /** Complexity level classification */
    complexity: ComplexityLevel;

    /** Numeric complexity score (0-100) */
    complexityScore: number;

    /** Factors contributing to complexity */
    complexityFactors: ComplexityFactor[];

    /** Effort estimate */
    estimatedEffort: EffortEstimate;

    /** Assigned team member */
    assignedTo?: string;

    /** Free-form notes */
    notes: string[];

    /** Migration wave assignment */
    wave?: number;

    /** Priority within wave (lower = higher priority) */
    priority?: number;

    /** Target completion date */
    targetDate?: ISOTimestamp;

    /** Actual completion date */
    completedDate?: ISOTimestamp;
}

// =============================================================================
// User Overrides
// =============================================================================

/**
 * Record of a user override to an assessment or finding.
 * All corrections made via chat or UI are tracked for audit.
 */
export interface IROverride {
    /** Unique override identifier */
    readonly id: string;

    /** JSON path to the overridden field */
    readonly field: string;

    /** Original value before override */
    readonly originalValue: unknown;

    /** New value set by user */
    readonly newValue: unknown;

    /** User's reason for the override */
    readonly reason: string;

    /** Source of the override */
    readonly source: OverrideSource;

    /** When the override was made */
    readonly timestamp: ISOTimestamp;

    /** User who made the override */
    readonly user?: string;

    /** Whether this override is still active */
    readonly active?: boolean;

    /** Reference to chat message (if from chat) */
    readonly chatMessageId?: string;
}

// =============================================================================
// Complete Metadata
// =============================================================================

/**
 * Complete IR metadata section.
 * Contains all information about the source, target, migration status,
 * and user modifications.
 */
export interface IRMetadata {
    /** Unique identifier for this IR document */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Description of the integration flow */
    readonly description?: string;

    /** Source platform and artifact information */
    readonly source: SourceMetadata;

    /** Target platform configuration */
    target: TargetMetadata;

    /** Migration status and tracking */
    migration: MigrationMetadata;

    /** History of user overrides */
    overrides: IROverride[];

    /** Whether this artifact is excluded from migration */
    excluded: boolean;

    /** Reason for exclusion (if excluded) */
    excludedReason?: string;

    /** Tags for organization and filtering */
    tags?: readonly string[];

    /** When this IR was first created */
    readonly createdAt?: ISOTimestamp;

    /** When this IR was last modified */
    updatedAt?: ISOTimestamp;

    /** Version number for optimistic locking */
    version?: number;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new source artifact with required fields.
 *
 * @param name - Artifact display name
 * @param type - Artifact type classification
 * @param filePath - Path to the source file
 * @param fileType - File extension/type
 * @returns A new SourceArtifact instance
 */
export function createSourceArtifact(
    name: string,
    type: ArtifactType,
    filePath: string,
    fileType: SourceFileType | string
): SourceArtifact {
    return {
        name,
        type,
        filePath,
        fileType,
    };
}

/**
 * Creates a new source metadata with required fields.
 *
 * @param platform - Source platform type
 * @param platformVersion - Platform version string
 * @param application - Application name
 * @param artifact - Source artifact details
 * @returns A new SourceMetadata instance
 */
export function createSourceMetadata(
    platform: SourcePlatformType,
    platformVersion: string,
    application: string,
    artifact: SourceArtifact
): SourceMetadata {
    return {
        platform,
        platformVersion,
        application,
        artifact,
    };
}

/**
 * Creates a new target metadata with defaults.
 *
 * @param workflowType - Workflow type (defaults to 'stateful')
 * @returns A new TargetMetadata instance
 */
export function createTargetMetadata(
    workflowType: WorkflowType = 'stateful'
): TargetMetadata {
    return {
        platform: 'logic-apps-standard',
        workflowType,
    };
}

/**
 * Creates a new migration metadata with defaults.
 *
 * @returns A new MigrationMetadata instance in 'discovered' status
 */
export function createMigrationMetadata(): MigrationMetadata {
    return {
        status: 'discovered',
        complexity: 'medium',
        complexityScore: 0,
        complexityFactors: [],
        estimatedEffort: { hours: 0, confidence: 'low' },
        notes: [],
    };
}

/**
 * Creates a new IR override record.
 *
 * @param field - JSON path to the field being overridden
 * @param originalValue - Original value
 * @param newValue - New value
 * @param reason - User's reason for the change
 * @param source - Override source (chat/ui/api)
 * @returns A new IROverride instance
 */
export function createOverride(
    field: string,
    originalValue: unknown,
    newValue: unknown,
    reason: string,
    source: OverrideSource
): IROverride {
    return {
        id: `override-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        field,
        originalValue,
        newValue,
        reason,
        source,
        timestamp: new Date().toISOString(),
        active: true,
    };
}
