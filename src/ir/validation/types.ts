/**
 * IR Validation Result Types
 *
 * Type definitions for validation results.
 *
 * @module ir/validation/types
 */

// =============================================================================
// Validation Severity
// =============================================================================

/**
 * Severity levels for validation issues.
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

// =============================================================================
// Validation Issue
// =============================================================================

/**
 * A single validation issue.
 */
export interface ValidationIssue {
    /** Severity level */
    readonly severity: ValidationSeverity;

    /** JSON path to the problematic element */
    readonly path: string;

    /** Issue code for programmatic handling */
    readonly code: string;

    /** Human-readable message */
    readonly message: string;

    /** Expected value/type (if applicable) */
    readonly expected?: string;

    /** Actual value/type found */
    readonly actual?: string;

    /** Suggested fix */
    readonly suggestion?: string;
}

/**
 * Creates a validation error.
 */
export function createError(
    path: string,
    code: string,
    message: string,
    options?: Partial<Pick<ValidationIssue, 'expected' | 'actual' | 'suggestion'>>
): ValidationIssue {
    return {
        severity: 'error',
        path,
        code,
        message,
        ...options,
    };
}

/**
 * Creates a validation warning.
 */
export function createWarning(
    path: string,
    code: string,
    message: string,
    options?: Partial<Pick<ValidationIssue, 'expected' | 'actual' | 'suggestion'>>
): ValidationIssue {
    return {
        severity: 'warning',
        path,
        code,
        message,
        ...options,
    };
}

/**
 * Creates a validation info.
 */
export function createInfo(
    path: string,
    code: string,
    message: string,
    options?: Partial<Pick<ValidationIssue, 'expected' | 'actual' | 'suggestion'>>
): ValidationIssue {
    return {
        severity: 'info',
        path,
        code,
        message,
        ...options,
    };
}

// =============================================================================
// Validation Result
// =============================================================================

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
    /** Whether validation passed (no errors) */
    readonly valid: boolean;

    /** All issues found */
    readonly issues: readonly ValidationIssue[];

    /** Error count */
    readonly errorCount: number;

    /** Warning count */
    readonly warningCount: number;

    /** Info count */
    readonly infoCount: number;

    /** Validation duration in milliseconds */
    readonly durationMs: number;

    /** Validated sections */
    readonly sectionsValidated: readonly string[];
}

/**
 * Creates an empty validation result.
 */
export function createEmptyResult(): Omit<ValidationResult, 'durationMs'> & { durationMs?: number } {
    return {
        valid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        sectionsValidated: [],
    };
}

/**
 * Merges multiple validation results.
 */
export function mergeResults(results: readonly ValidationResult[]): ValidationResult {
    const issues: ValidationIssue[] = [];
    const sectionsValidated: string[] = [];
    let totalDuration = 0;

    for (const result of results) {
        issues.push(...result.issues);
        sectionsValidated.push(...result.sectionsValidated);
        totalDuration += result.durationMs;
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    return {
        valid: errorCount === 0,
        issues,
        errorCount,
        warningCount,
        infoCount,
        durationMs: totalDuration,
        sectionsValidated: [...new Set(sectionsValidated)],
    };
}

// =============================================================================
// Validation Options
// =============================================================================

/**
 * Options for IR validation.
 */
export interface ValidationOptions {
    /**
     * Whether to perform structural validation.
     * @default true
     */
    readonly structural?: boolean;

    /**
     * Whether to perform semantic validation.
     * @default true
     */
    readonly semantic?: boolean;

    /**
     * Whether to allow partial/incomplete IRs.
     * @default false
     */
    readonly allowPartial?: boolean;

    /**
     * Specific sections to validate.
     * If not provided, all sections are validated.
     */
    readonly sections?: readonly string[];

    /**
     * Maximum number of issues to collect.
     * @default 100
     */
    readonly maxIssues?: number;

    /**
     * Whether to stop on first error.
     * @default false
     */
    readonly stopOnFirstError?: boolean;
}

/**
 * Default validation options.
 */
export const DEFAULT_VALIDATION_OPTIONS: Required<ValidationOptions> = {
    structural: true,
    semantic: true,
    allowPartial: false,
    sections: [],
    maxIssues: 100,
    stopOnFirstError: false,
};
