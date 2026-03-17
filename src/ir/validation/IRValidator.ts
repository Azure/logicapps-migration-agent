/**
 * IR Validator
 *
 * Main entry point for IR validation.
 * Combines structural and semantic validation.
 *
 * @module ir/validation
 */

import { IRDocument, isIRDocument } from '../types';
import {
    ValidationResult,
    ValidationOptions,
    DEFAULT_VALIDATION_OPTIONS,
    mergeResults,
    ValidationIssue,
    createError,
} from './types';
import { StructuralValidator } from './StructuralValidator';
import { SemanticValidator } from './SemanticValidator';

// =============================================================================
// Validation Error
// =============================================================================

/**
 * Error thrown when validation fails.
 */
export class IRValidationError extends Error {
    constructor(
        message: string,
        public readonly result: ValidationResult
    ) {
        super(message);
        this.name = 'IRValidationError';

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, IRValidationError);
        }
    }

    /**
     * Gets all error-level issues.
     */
    public get errors(): readonly ValidationIssue[] {
        return this.result.issues.filter(i => i.severity === 'error');
    }

    /**
     * Gets a formatted error summary.
     */
    public getSummary(): string {
        const lines = [
            `IR Validation Failed: ${this.result.errorCount} error(s), ${this.result.warningCount} warning(s)`,
            '',
            'Errors:',
        ];

        for (const issue of this.errors) {
            lines.push(`  - [${issue.code}] ${issue.path}: ${issue.message}`);
        }

        return lines.join('\n');
    }
}

// =============================================================================
// IRValidator Class
// =============================================================================

/**
 * Main IR validator.
 *
 * Combines structural and semantic validation to provide
 * comprehensive validation of IR documents.
 *
 * @example
 * ```typescript
 * const validator = new IRValidator();
 *
 * // Validate and get result
 * const result = validator.validate(document);
 * if (!result.valid) {
 *   console.log('Errors:', result.issues.filter(i => i.severity === 'error'));
 * }
 *
 * // Validate and throw on error
 * validator.assertValid(document);
 * ```
 */
export class IRValidator {
    private readonly structuralValidator = new StructuralValidator();
    private readonly semanticValidator = new SemanticValidator();

    /**
     * Validates an IR document.
     *
     * @param document - The document to validate
     * @param options - Validation options
     * @returns Validation result
     *
     * @example
     * ```typescript
     * const result = validator.validate(document);
     * console.log(`Valid: ${result.valid}`);
     * console.log(`Errors: ${result.errorCount}`);
     * ```
     */
    public validate(
        document: unknown,
        options: ValidationOptions = {}
    ): ValidationResult {
        const startTime = performance.now();
        const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
        const results: ValidationResult[] = [];

        // Quick check for basic object structure
        if (typeof document !== 'object' || document === null) {
            return {
                valid: false,
                issues: [createError('$', 'VAL_001', 'Document must be a non-null object')],
                errorCount: 1,
                warningCount: 0,
                infoCount: 0,
                durationMs: performance.now() - startTime,
                sectionsValidated: [],
            };
        }

        // Structural validation
        if (opts.structural) {
            const structuralResult = this.structuralValidator.validate(document, opts);
            results.push(structuralResult);

            // If structural validation failed badly, skip semantic validation
            if (structuralResult.errorCount > 10 || !isIRDocument(document)) {
                return mergeResults(results);
            }
        }

        // Semantic validation (only if document passes basic structure check)
        if (opts.semantic && isIRDocument(document)) {
            const semanticResult = this.semanticValidator.validate(document, opts);
            results.push(semanticResult);
        }

        return mergeResults(results);
    }

    /**
     * Validates an IR document and throws if validation fails.
     *
     * @param document - The document to validate
     * @param options - Validation options
     * @throws IRValidationError if validation fails
     *
     * @example
     * ```typescript
     * try {
     *   validator.assertValid(document);
     *   // Document is valid
     * } catch (error) {
     *   if (error instanceof IRValidationError) {
     *     console.log(error.getSummary());
     *   }
     * }
     * ```
     */
    public assertValid(
        document: unknown,
        options: ValidationOptions = {}
    ): asserts document is IRDocument {
        const result = this.validate(document, options);

        if (!result.valid) {
            throw new IRValidationError(
                `IR validation failed with ${result.errorCount} error(s)`,
                result
            );
        }
    }

    /**
     * Checks if an IR document is valid without collecting detailed issues.
     *
     * @param document - The document to check
     * @returns True if valid, false otherwise
     *
     * @example
     * ```typescript
     * if (validator.isValid(document)) {
     *   // Safe to use as IRDocument
     * }
     * ```
     */
    public isValid(document: unknown): document is IRDocument {
        const result = this.validate(document, {
            maxIssues: 1,
            stopOnFirstError: true,
        });
        return result.valid;
    }

    /**
     * Validates only structural aspects of the document.
     *
     * @param document - The document to validate
     * @param options - Validation options (semantic always false)
     * @returns Validation result
     */
    public validateStructure(
        document: unknown,
        options: Omit<ValidationOptions, 'semantic'> = {}
    ): ValidationResult {
        return this.validate(document, { ...options, semantic: false });
    }

    /**
     * Validates only semantic aspects of the document.
     * Assumes structural validation has already passed.
     *
     * @param document - The document to validate
     * @param options - Validation options (structural always false)
     * @returns Validation result
     */
    public validateSemantics(
        document: IRDocument,
        options: Omit<ValidationOptions, 'structural'> = {}
    ): ValidationResult {
        return this.semanticValidator.validate(document, {
            ...DEFAULT_VALIDATION_OPTIONS,
            ...options,
        });
    }

    /**
     * Validates a partial IR document (work in progress).
     *
     * @param document - The partial document to validate
     * @param sections - Specific sections to validate
     * @returns Validation result
     */
    public validatePartial(
        document: unknown,
        sections?: readonly string[]
    ): ValidationResult {
        return this.validate(document, {
            allowPartial: true,
            sections,
        });
    }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Default IR validator instance.
 */
export const irValidator: IRValidator = new IRValidator();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Validates an IR document.
 *
 * @param document - The document to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateIR(
    document: unknown,
    options?: ValidationOptions
): ValidationResult {
    return irValidator.validate(document, options);
}

/**
 * Validates an IR document and throws if invalid.
 *
 * @param document - The document to validate
 * @param options - Validation options
 * @throws IRValidationError if validation fails
 */
export function assertValidIR(
    document: unknown,
    options?: ValidationOptions
): asserts document is IRDocument {
    irValidator.assertValid(document, options);
}

/**
 * Checks if an IR document is valid.
 *
 * @param document - The document to check
 * @returns True if valid
 */
export function isValidIR(document: unknown): document is IRDocument {
    return irValidator.isValid(document);
}
