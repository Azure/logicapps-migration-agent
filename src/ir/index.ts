/**
 * IR (Intermediate Representation) Module
 *
 * This module provides the complete IR v3 implementation for the
 * Logic Apps Migration Assistant. It includes:
 *
 * - **Types**: Complete TypeScript definitions for the IR schema
 * - **Serialization**: JSON serialization/deserialization with type safety
 * - **Validation**: Structural and semantic validation
 * - **Diff/Merge**: Change detection and document merging
 * - **Storage**: Persistent storage with caching
 *
 * @module ir
 *
 * @example
 * ```typescript
 * import {
 *   IRDocument,
 *   createEmptyIRDocument,
 *   IRSerializer,
 *   IRValidator,
 *   IRStorage,
 *   compareIR,
 * } from './ir';
 *
 * // Create a new IR document
 * const doc = createEmptyIRDocument({
 *   workflowId: 'my-workflow',
 *   workflowName: 'My Workflow',
 *   sourcePlatform: 'biztalk',
 *   originalFilePath: '/path/to/source.xml',
 * });
 *
 * // Validate the document
 * const validator = new IRValidator();
 * const result = validator.validate(doc);
 *
 * // Serialize to JSON
 * const serializer = new IRSerializer();
 * const json = serializer.serialize(doc);
 *
 * // Store the document
 * const storage = new IRStorage(context);
 * await storage.store(doc);
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export * from './types';

// =============================================================================
// Serialization
// =============================================================================

export {
    IRSerializer,
    IRSerializationError,
    type SerializeOptions,
    type DeserializeOptions,
} from './serialization';

// =============================================================================
// Validation
// =============================================================================

export {
    // Types
    type ValidationSeverity,
    type ValidationIssue,
    type ValidationResult,
    type ValidationOptions,

    // Codes
    StructuralValidationCodes,
    SemanticValidationCodes,

    // Validators
    StructuralValidator,
    SemanticValidator,
    IRValidator,
    IRValidationError,

    // Convenience
    validateIR,
    assertValidIR,
    isValidIR,
} from './validation';

// =============================================================================
// Diff and Merge
// =============================================================================

export {
    // Types
    type ChangeType,
    type ChangeOperation,
    type IRChange,
    type IRDiffResult,
    type DiffOptions,
    type MergeConflict,
    type IRMergeResult,
    type ConflictResolution,
    type MergeOptions,

    // Classes
    IRDiff,
    IRMerge,

    // Singletons
    irDiff,
    irMerge,

    // Convenience
    compareIR,
    mergeIR,
} from './diff';

// =============================================================================
// Storage
// =============================================================================

export {
    // Types
    type IRStorageMetadata,
    type StorageResult,
    type StorageOptions,
    type CacheOptions,

    // Classes
    IRCache,
    IRStorage,

    // Convenience
    getDefaultStorage,
    disposeDefaultStorage,
} from './storage';

// =============================================================================
// Version Information
// =============================================================================

/**
 * Current IR module version.
 */
export const IR_MODULE_VERSION = '3.0.0';

/**
 * Supported IR schema versions.
 */
export const SUPPORTED_SCHEMA_VERSIONS = ['3.0', '3.0.0'] as const;
