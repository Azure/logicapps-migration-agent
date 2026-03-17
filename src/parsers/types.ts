/**
 * Parser Types
 *
 * Core type definitions for the parser infrastructure.
 *
 * @module parsers/types
 */

import { CancellationToken } from 'vscode';
import { IRDocument } from '../ir/types';
import { SourcePlatformType, SourceFileType } from '../ir/types/common';

// =============================================================================
// Parse Progress
// =============================================================================

/**
 * Progress information for parsing operations.
 */
export interface ParseProgress {
    /** Current item being processed (1-based) */
    readonly current: number;

    /** Total items to process */
    readonly total: number;

    /** Description of current operation */
    readonly message: string;

    /** Optional percentage (0-100) */
    readonly percentage?: number;
}

/**
 * Progress callback type.
 */
export type ProgressCallback = (progress: ParseProgress) => void;

// =============================================================================
// Parse Options
// =============================================================================

/**
 * Options for parsing operations.
 */
export interface ParseOptions {
    /**
     * Progress callback for reporting progress.
     */
    readonly onProgress?: ProgressCallback;

    /**
     * Cancellation token for aborting the operation.
     */
    readonly cancellationToken?: CancellationToken;

    /**
     * Whether to continue on non-fatal errors.
     * @default true
     */
    readonly continueOnError?: boolean;

    /**
     * Maximum errors before stopping.
     * @default 100
     */
    readonly maxErrors?: number;

    /**
     * Whether to include verbose source mapping details.
     * @default false
     */
    readonly verboseSourceMapping?: boolean;

    /**
     * Base path for resolving relative paths.
     * If not specified, defaults to the parent directory of the input path.
     */
    readonly basePath?: string;
}

/**
 * Default parse options.
 */
export const DEFAULT_PARSE_OPTIONS: Required<
    Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>
> = {
    continueOnError: true,
    maxErrors: 100,
    verboseSourceMapping: false,
};

// =============================================================================
// Parse Errors
// =============================================================================

/**
 * Severity level for parse errors.
 */
export type ParseErrorSeverity = 'error' | 'warning' | 'info';

/**
 * A single parse error or warning.
 */
export interface ParseError {
    /** Error severity */
    readonly severity: ParseErrorSeverity;

    /** Error code for programmatic handling */
    readonly code: string;

    /** Human-readable error message */
    readonly message: string;

    /** File path where the error occurred */
    readonly filePath?: string;

    /** Line number (1-based) */
    readonly line?: number;

    /** Column number (1-based) */
    readonly column?: number;

    /** Additional context for the error */
    readonly context?: Record<string, unknown>;

    /** Original error if wrapping */
    readonly cause?: Error;
}

/**
 * Parse error codes.
 */
export const ParseErrorCodes = {
    // General errors
    FILE_NOT_FOUND: 'PARSE_FILE_NOT_FOUND',
    FILE_READ_ERROR: 'PARSE_FILE_READ_ERROR',
    INVALID_XML: 'PARSE_INVALID_XML',
    INVALID_JSON: 'PARSE_INVALID_JSON',
    UNSUPPORTED_FORMAT: 'PARSE_UNSUPPORTED_FORMAT',
    CANCELLED: 'PARSE_CANCELLED',
    MAX_ERRORS_REACHED: 'PARSE_MAX_ERRORS_REACHED',

    // Project errors
    PROJECT_NOT_FOUND: 'PARSE_PROJECT_NOT_FOUND',
    INVALID_PROJECT: 'PARSE_INVALID_PROJECT',
    MISSING_REFERENCE: 'PARSE_MISSING_REFERENCE',

    // BizTalk-specific errors
    INVALID_ORCHESTRATION: 'PARSE_INVALID_ORCHESTRATION',
    INVALID_MAP: 'PARSE_INVALID_MAP',
    INVALID_SCHEMA: 'PARSE_INVALID_SCHEMA',
    INVALID_PIPELINE: 'PARSE_INVALID_PIPELINE',
    INVALID_BINDING: 'PARSE_INVALID_BINDING',
    UNKNOWN_SHAPE: 'PARSE_UNKNOWN_SHAPE',
    UNKNOWN_FUNCTOID: 'PARSE_UNKNOWN_FUNCTOID',
    UNKNOWN_ADAPTER: 'PARSE_UNKNOWN_ADAPTER',
    EXPRESSION_PARSE_ERROR: 'PARSE_EXPRESSION_ERROR',

    // MuleSoft-specific errors
    INVALID_FLOW: 'PARSE_INVALID_FLOW',
    INVALID_DATAWEAVE: 'PARSE_INVALID_DATAWEAVE',

    // Generic errors
    NOT_IMPLEMENTED: 'PARSE_NOT_IMPLEMENTED',
    UNKNOWN_ERROR: 'PARSE_UNKNOWN_ERROR',
} as const;

export type ParseErrorCode = (typeof ParseErrorCodes)[keyof typeof ParseErrorCodes];

// =============================================================================
// Parse Results
// =============================================================================

/**
 * Result of a parsing operation.
 */
export interface ParseResult {
    /** Whether parsing was successful (no blocking errors) */
    readonly success: boolean;

    /** The parsed IR document (may be partial if errors occurred) */
    readonly ir: IRDocument | null;

    /** All errors and warnings encountered */
    readonly errors: readonly ParseError[];

    /** Statistics about the parsing operation */
    readonly stats: ParseStats;
}

/**
 * Statistics about a parsing operation.
 */
export interface ParseStats {
    /** Total files discovered */
    readonly filesDiscovered: number;

    /** Files successfully parsed */
    readonly filesParsed: number;

    /** Files that failed to parse */
    readonly filesFailed: number;

    /** Files skipped (unsupported or cancelled) */
    readonly filesSkipped: number;

    /** Time taken in milliseconds */
    readonly durationMs: number;

    /** Breakdown by artifact type */
    readonly byArtifactType: Record<string, number>;
}

/**
 * Create an empty parse stats object.
 */
export function createEmptyParseStats(): ParseStats {
    return {
        filesDiscovered: 0,
        filesParsed: 0,
        filesFailed: 0,
        filesSkipped: 0,
        durationMs: 0,
        byArtifactType: {},
    };
}

// =============================================================================
// File Detection
// =============================================================================

/**
 * Information about a detected file.
 */
export interface DetectedFile {
    /** Absolute file path */
    readonly path: string;

    /** File type */
    readonly type: SourceFileType;

    /** Platform this file belongs to */
    readonly platform: SourcePlatformType;

    /** File size in bytes */
    readonly size: number;

    /** Last modified timestamp */
    readonly lastModified: Date;
}

// =============================================================================
// Parser Capabilities
// =============================================================================

/**
 * Describes what a parser can handle.
 */
export interface ParserCapabilities {
    /** Source platform this parser handles */
    readonly platform: SourcePlatformType;

    /** File extensions this parser can handle */
    readonly fileExtensions: readonly string[];

    /** File types this parser produces */
    readonly fileTypes: readonly SourceFileType[];

    /** Whether this parser can handle folders */
    readonly supportsFolder: boolean;

    /** Description of the parser */
    readonly description: string;
}

// =============================================================================
// Parser Registration
// =============================================================================

/**
 * Parser registration info.
 */
export interface ParserRegistration {
    /** Unique parser identifier */
    readonly id: string;

    /** Parser capabilities */
    readonly capabilities: ParserCapabilities;

    /** Priority for parser selection (higher = preferred) */
    readonly priority: number;
}
