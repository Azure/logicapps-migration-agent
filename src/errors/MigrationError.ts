/**
 * Migration Error - Base Error Class
 *
 * Base class for all custom errors in the extension.
 * Provides error codes, user-friendly messages, and recovery suggestions.
 */

import { ErrorCode, ErrorCodes } from './ErrorCodes';

/**
 * Base error class for all migration errors
 */
export class MigrationError extends Error {
    /** Unique error code for programmatic handling */
    public readonly code: ErrorCode;

    /** User-friendly message suitable for display */
    public readonly userMessage: string;

    /** Suggested action to resolve the error */
    public readonly suggestion?: string;

    /** Original error that caused this error */
    public readonly innerError?: Error;

    /** Additional context/metadata */
    public readonly context?: Record<string, unknown>;

    constructor(options: {
        code: ErrorCode;
        message: string;
        userMessage?: string;
        suggestion?: string;
        innerError?: Error;
        context?: Record<string, unknown>;
    }) {
        super(options.message);

        this.name = 'MigrationError';
        this.code = options.code;
        this.userMessage = options.userMessage ?? options.message;
        this.suggestion = options.suggestion;
        this.innerError = options.innerError;
        this.context = options.context;

        // Maintains proper stack trace for where error was thrown (only in V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MigrationError);
        }
    }

    /**
     * Create a formatted string representation of the error
     */
    public toFormattedString(): string {
        let result = `[${this.code}] ${this.message}`;

        if (this.suggestion) {
            result += `\n\nSuggestion: ${this.suggestion}`;
        }

        if (this.innerError) {
            result += `\n\nCaused by: ${this.innerError.message}`;
        }

        return result;
    }

    /**
     * Create an error from an unknown error type
     */
    public static fromUnknown(error: unknown, context?: string): MigrationError {
        if (error instanceof MigrationError) {
            return error;
        }

        if (error instanceof Error) {
            return new MigrationError({
                code: ErrorCodes.UNKNOWN_ERROR,
                message: error.message,
                userMessage: `An unexpected error occurred${context ? ` in ${context}` : ''}.`,
                suggestion: 'Please check the logs for more details.',
                innerError: error,
                context: { originalContext: context },
            });
        }

        return new MigrationError({
            code: ErrorCodes.UNKNOWN_ERROR,
            message: String(error),
            userMessage: `An unexpected error occurred${context ? ` in ${context}` : ''}.`,
            suggestion: 'Please check the logs for more details.',
            context: { originalContext: context, rawError: String(error) },
        });
    }
}
