/**
 * Validation Error
 *
 * Errors that occur during validation of generated artifacts.
 */

import { ErrorCode, ErrorCodes } from './ErrorCodes';
import { MigrationError } from './MigrationError';

/**
 * Validation issue details
 */
export interface ValidationIssue {
    path: string;
    message: string;
    severity: 'error' | 'warning';
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends MigrationError {
    /** List of validation issues found */
    public readonly issues: ValidationIssue[];

    /** The artifact being validated */
    public readonly artifactPath?: string;

    /** The type of validation performed */
    public readonly validationType?: string;

    constructor(options: {
        code?: ErrorCode;
        message: string;
        userMessage?: string;
        suggestion?: string;
        innerError?: Error;
        issues?: ValidationIssue[];
        artifactPath?: string;
        validationType?: string;
    }) {
        super({
            code: options.code ?? ErrorCodes.VALIDATION_ERROR,
            message: options.message,
            userMessage: options.userMessage ?? 'Validation failed.',
            suggestion:
                options.suggestion ?? 'Review the validation errors and fix the issues.',
            innerError: options.innerError,
            context: {
                artifactPath: options.artifactPath,
                validationType: options.validationType,
                issueCount: options.issues?.length ?? 0,
            },
        });

        this.name = 'ValidationError';
        this.issues = options.issues ?? [];
        this.artifactPath = options.artifactPath;
        this.validationType = options.validationType;
    }

    /**
     * Create a schema mismatch error
     */
    public static schemaMismatch(
        artifactPath: string,
        issues: ValidationIssue[]
    ): ValidationError {
        return new ValidationError({
            code: ErrorCodes.VALIDATION_SCHEMA_MISMATCH,
            message: `Schema validation failed for ${artifactPath}`,
            userMessage: `The artifact does not conform to the expected schema.`,
            suggestion: 'Review the schema requirements and fix the non-conforming elements.',
            issues,
            artifactPath,
            validationType: 'schema',
        });
    }

    /**
     * Create an invalid expression error
     */
    public static invalidExpression(
        expression: string,
        reason: string,
        artifactPath?: string
    ): ValidationError {
        return new ValidationError({
            code: ErrorCodes.VALIDATION_EXPRESSION_INVALID,
            message: `Invalid expression: ${expression}`,
            userMessage: `The expression "${expression}" is invalid: ${reason}`,
            suggestion: 'Check the expression syntax and function usage.',
            issues: [{ path: artifactPath ?? 'expression', message: reason, severity: 'error' }],
            artifactPath,
            validationType: 'expression',
        });
    }

    /**
     * Create a missing connection error
     */
    public static missingConnection(connectionName: string, artifactPath?: string): ValidationError {
        return new ValidationError({
            code: ErrorCodes.VALIDATION_CONNECTION_MISSING,
            message: `Connection not found: ${connectionName}`,
            userMessage: `The connection "${connectionName}" is referenced but not defined.`,
            suggestion: 'Add the missing connection to connections.json.',
            issues: [
                {
                    path: `connections/${connectionName}`,
                    message: 'Connection not defined',
                    severity: 'error',
                },
            ],
            artifactPath,
            validationType: 'connection',
        });
    }

    /**
     * Get error count
     */
    public getErrorCount(): number {
        return this.issues.filter((i) => i.severity === 'error').length;
    }

    /**
     * Get warning count
     */
    public getWarningCount(): number {
        return this.issues.filter((i) => i.severity === 'warning').length;
    }
}
