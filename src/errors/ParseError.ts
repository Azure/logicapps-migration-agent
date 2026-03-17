/**
 * Parse Error
 *
 * Errors that occur during parsing of source integration artifacts.
 */

import { ErrorCode, ErrorCodes } from './ErrorCodes';
import { MigrationError } from './MigrationError';

/**
 * Error thrown when parsing source files fails
 */
export class ParseError extends MigrationError {
    /** The file path that failed to parse */
    public readonly filePath?: string;

    /** The line number where the error occurred */
    public readonly line?: number;

    /** The column number where the error occurred */
    public readonly column?: number;

    /** The source platform being parsed */
    public readonly platform?: string;

    constructor(options: {
        code?: ErrorCode;
        message: string;
        userMessage?: string;
        suggestion?: string;
        innerError?: Error;
        filePath?: string;
        line?: number;
        column?: number;
        platform?: string;
    }) {
        super({
            code: options.code ?? ErrorCodes.PARSE_ERROR,
            message: options.message,
            userMessage: options.userMessage ?? `Failed to parse file: ${options.filePath ?? 'unknown'}`,
            suggestion: options.suggestion ?? 'Check the file format and ensure it is valid.',
            innerError: options.innerError,
            context: {
                filePath: options.filePath,
                line: options.line,
                column: options.column,
                platform: options.platform,
            },
        });

        this.name = 'ParseError';
        this.filePath = options.filePath;
        this.line = options.line;
        this.column = options.column;
        this.platform = options.platform;
    }

    /**
     * Create a file not found error
     */
    public static fileNotFound(filePath: string): ParseError {
        return new ParseError({
            code: ErrorCodes.PARSE_FILE_NOT_FOUND,
            message: `File not found: ${filePath}`,
            userMessage: `The file "${filePath}" could not be found.`,
            suggestion: 'Verify the file path is correct and the file exists.',
            filePath,
        });
    }

    /**
     * Create an invalid format error
     */
    public static invalidFormat(filePath: string, expectedFormat: string): ParseError {
        return new ParseError({
            code: ErrorCodes.PARSE_INVALID_FORMAT,
            message: `Invalid file format: ${filePath}`,
            userMessage: `The file "${filePath}" is not in the expected ${expectedFormat} format.`,
            suggestion: `Ensure the file is a valid ${expectedFormat} file.`,
            filePath,
        });
    }

    /**
     * Create an unsupported version error
     */
    public static unsupportedVersion(
        filePath: string,
        version: string,
        supportedVersions: string[]
    ): ParseError {
        return new ParseError({
            code: ErrorCodes.PARSE_UNSUPPORTED_VERSION,
            message: `Unsupported version ${version} in ${filePath}`,
            userMessage: `The file uses version ${version} which is not supported.`,
            suggestion: `Supported versions are: ${supportedVersions.join(', ')}`,
            filePath,
        });
    }
}
