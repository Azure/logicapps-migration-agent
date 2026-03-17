/**
 * IR Validation Module Index
 *
 * Exports all validation utilities for IR documents.
 *
 * @module ir/validation
 */

// Types
export {
    ValidationSeverity,
    ValidationIssue,
    ValidationResult,
    ValidationOptions,
    DEFAULT_VALIDATION_OPTIONS,
    createError,
    createWarning,
    createInfo,
    createEmptyResult,
    mergeResults,
} from './types';

// Structural validation
export {
    StructuralValidator,
    StructuralValidationCodes,
} from './StructuralValidator';

// Semantic validation
export {
    SemanticValidator,
    SemanticValidationCodes,
} from './SemanticValidator';

// Main validator
export {
    IRValidator,
    IRValidationError,
    irValidator,
    validateIR,
    assertValidIR,
    isValidIR,
} from './IRValidator';
