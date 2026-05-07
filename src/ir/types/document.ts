/**
 * IR Document
 *
 * The main Intermediate Representation document interface.
 * This is the root type that contains all components of a migration IR.
 *
 * @module ir/types/document
 */

import { WorkflowType, ISODuration, SourcePlatformType } from './common';
import { IRMetadata } from './metadata';
import { IRTrigger } from './triggers';
import { IRAction } from './actions';
import { IRConnection } from './connections';
import { IRSchema, IRMap } from './schemas';
import {
    IRVariable,
    IRGap,
    IRErrorHandlingConfig,
    IRCorrelationConfig,
    IRMessageProcessingConfig,
    IREndpointsConfig,
    IRObservabilityConfig,
    IRB2BConfig,
    IRDependenciesConfig,
    IRExtensions,
} from './advanced';

// =============================================================================
// IR Schema Constants
// =============================================================================

/**
 * Current IR schema identifier.
 */
export const IR_SCHEMA_ID = 'logicapps-migration-agent/ir/v3';

/**
 * Current IR schema version.
 */
export const IR_VERSION = '3.0.0';

// =============================================================================
// Workflow Configuration
// =============================================================================

/**
 * Workflow concurrency settings.
 */
export interface WorkflowConcurrency {
    /** Maximum concurrent runs */
    readonly maximumRuns?: number;

    /** Maximum waiting runs */
    readonly maximumWaitingRuns?: number;
}

/**
 * Workflow retry policy.
 */
export interface WorkflowRetryPolicy {
    /** Retry type */
    readonly type: 'none' | 'fixed' | 'exponential';

    /** Retry count */
    readonly count?: number;

    /** Retry interval */
    readonly interval?: ISODuration;
}

/**
 * Workflow operation options.
 */
export interface WorkflowOperationOptions {
    /** Operation timeout */
    readonly timeout?: ISODuration;

    /** Retry policy */
    readonly retryPolicy?: WorkflowRetryPolicy;
}

/**
 * Workflow correlation settings.
 */
export interface WorkflowCorrelation {
    /** Whether correlation is enabled */
    readonly enabled: boolean;

    /** Correlation strategy */
    readonly strategy?: 'callback-url' | 'durable-functions' | 'custom';

    /** Correlation properties */
    readonly properties?: readonly string[];
}

/**
 * Workflow-level configuration.
 */
export interface IRWorkflowConfig {
    /** Workflow type (stateful/stateless) */
    readonly type: WorkflowType;

    /** Concurrency settings */
    readonly concurrency?: WorkflowConcurrency;

    /** Operation options */
    readonly operationOptions?: WorkflowOperationOptions;

    /** Correlation settings */
    readonly correlation?: WorkflowCorrelation;
}

// =============================================================================
// IR Document
// =============================================================================

/**
 * Complete IR Document.
 *
 * This is the root interface for the Intermediate Representation.
 * It contains all information needed to migrate an integration
 * from a source platform to Azure Logic Apps.
 *
 * @example
 * ```typescript
 * const ir: IRDocument = {
 *   $schema: IR_SCHEMA_ID,
 *   $version: IR_VERSION,
 *   metadata: { ... },
 *   workflow: { type: 'stateful' },
 *   triggers: [...],
 *   actions: [...],
 *   connections: [...],
 *   schemas: [],
 *   maps: [],
 *   gaps: [],
 * };
 * ```
 */
export interface IRDocument {
    // =========================================================================
    // Schema Information
    // =========================================================================

    /**
     * IR schema identifier.
     * Always "logicapps-migration-agent/ir/v3" for v3 documents.
     */
    readonly $schema: string;

    /**
     * IR schema version.
     * Semantic version string (e.g., "3.0.0").
     */
    readonly $version: string;

    // =========================================================================
    // Core Components
    // =========================================================================

    /**
     * Document metadata.
     * Contains source/target info, migration status, and overrides.
     */
    readonly metadata: IRMetadata;

    /**
     * Workflow configuration.
     * Settings for the Logic Apps workflow.
     */
    readonly workflow: IRWorkflowConfig;

    /**
     * Workflow triggers (entry points).
     * HTTP requests, queue messages, timers, etc.
     */
    readonly triggers: readonly IRTrigger[];

    /**
     * Workflow actions (operations).
     * Transforms, conditions, loops, integrations, etc.
     */
    readonly actions: readonly IRAction[];

    /**
     * External connections.
     * Database, API, messaging, storage connections.
     */
    readonly connections: readonly IRConnection[];

    /**
     * Data schemas.
     * XSD, JSON Schema, flat file schemas.
     */
    readonly schemas: readonly IRSchema[];

    /**
     * Data transformations.
     * XSLT, Liquid, DataWeave maps.
     */
    readonly maps: readonly IRMap[];

    /**
     * Migration gaps.
     * Features that cannot be directly migrated.
     */
    readonly gaps: readonly IRGap[];

    // =========================================================================
    // Optional Components
    // =========================================================================

    /**
     * Workflow variables.
     */
    readonly variables?: readonly IRVariable[];

    /**
     * Error handling configuration.
     */
    readonly errorHandling?: IRErrorHandlingConfig;

    /**
     * Correlation configuration.
     */
    readonly correlation?: IRCorrelationConfig;

    /**
     * Message processing (pipelines).
     */
    readonly messageProcessing?: IRMessageProcessingConfig;

    /**
     * Endpoints (ports).
     */
    readonly endpoints?: IREndpointsConfig;

    /**
     * Observability (tracking/BAM).
     */
    readonly observability?: IRObservabilityConfig;

    /**
     * B2B/EDI configuration.
     */
    readonly b2b?: IRB2BConfig;

    /**
     * Dependencies (custom code, certificates, infrastructure).
     */
    readonly dependencies?: IRDependenciesConfig;

    /**
     * Platform-specific extensions.
     */
    readonly extensions?: IRExtensions;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new empty IR document with minimal required fields.
 *
 * @param id - Unique identifier for the document
 * @param name - Display name
 * @param platform - Source platform type
 * @returns A new IRDocument instance
 *
 * @example
 * ```typescript
 * const ir = createEmptyIRDocument('flow-001', 'ProcessOrder', 'biztalk');
 * ```
 */
export function createEmptyIRDocument(
    id: string,
    name: string,
    platform: SourcePlatformType = 'biztalk'
): IRDocument {
    const now = new Date().toISOString();

    return {
        $schema: IR_SCHEMA_ID,
        $version: IR_VERSION,
        metadata: {
            id,
            name,
            source: {
                platform,
                platformVersion: '',
                application: '',
                artifact: {
                    name,
                    type: 'orchestration',
                    filePath: '',
                    fileType: '',
                },
            },
            target: {
                platform: 'logic-apps-standard',
                workflowType: 'stateful',
            },
            migration: {
                status: 'discovered',
                complexity: 'medium',
                complexityScore: 0,
                complexityFactors: [],
                estimatedEffort: { hours: 0, confidence: 'low' },
                notes: [],
            },
            overrides: [],
            excluded: false,
            createdAt: now,
            updatedAt: now,
            version: 1,
        },
        workflow: {
            type: 'stateful',
        },
        triggers: [],
        actions: [],
        connections: [],
        schemas: [],
        maps: [],
        gaps: [],
    };
}

/**
 * Creates a deep clone of an IR document.
 * Useful for creating modified copies without mutating the original.
 *
 * @param document - The document to clone
 * @returns A new IRDocument that is a deep copy of the original
 */
export function cloneIRDocument(document: IRDocument): IRDocument {
    return JSON.parse(JSON.stringify(document)) as IRDocument;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if an object is a valid IR document.
 *
 * @param obj - Object to check
 * @returns True if the object has the basic structure of an IR document
 */
export function isIRDocument(obj: unknown): obj is IRDocument {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const doc = obj as Record<string, unknown>;

    return (
        typeof doc.$schema === 'string' &&
        typeof doc.$version === 'string' &&
        typeof doc.metadata === 'object' &&
        typeof doc.workflow === 'object' &&
        Array.isArray(doc.triggers) &&
        Array.isArray(doc.actions) &&
        Array.isArray(doc.connections) &&
        Array.isArray(doc.schemas) &&
        Array.isArray(doc.maps) &&
        Array.isArray(doc.gaps)
    );
}

/**
 * Checks if an IR document uses the current schema version.
 *
 * @param document - Document to check
 * @returns True if the document uses IR v3
 */
export function isCurrentVersion(document: IRDocument): boolean {
    return document.$schema === IR_SCHEMA_ID && document.$version.startsWith('3.');
}
