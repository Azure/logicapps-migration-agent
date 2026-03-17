/**
 * Abstract Parser Base Class
 *
 * Provides common functionality for all parsers including error handling,
 * progress reporting, and cancellation support.
 *
 * @module parsers/AbstractParser
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IParser, IArtifactParser, ArtifactSummary } from './IParser';
import {
    ParseOptions,
    ParseResult,
    ParseError,
    ParseErrorSeverity,
    ParseErrorCode,
    ParseErrorCodes,
    ParseStats,
    ParserCapabilities,
    DetectedFile,
    ProgressCallback,
    DEFAULT_PARSE_OPTIONS,
    createEmptyParseStats,
} from './types';
import { IRDocument, createEmptyIRDocument } from '../ir/types';
import { SourceFileType } from '../ir/types/common';

// =============================================================================
// Error Accumulator
// =============================================================================

/**
 * Accumulates parse errors during parsing operations.
 */
export class ParseErrorAccumulator {
    private readonly _errors: ParseError[] = [];
    private readonly maxErrors: number;
    private _hasBlockingError = false;

    constructor(maxErrors = 100) {
        this.maxErrors = maxErrors;
    }

    /**
     * Add an error to the accumulator.
     */
    addError(
        code: ParseErrorCode,
        message: string,
        options?: {
            severity?: ParseErrorSeverity;
            filePath?: string;
            line?: number;
            column?: number;
            context?: Record<string, unknown>;
            cause?: Error;
        }
    ): void {
        const severity = options?.severity ?? 'error';

        if (severity === 'error') {
            this._hasBlockingError = true;
        }

        this._errors.push({
            severity,
            code,
            message,
            filePath: options?.filePath,
            line: options?.line,
            column: options?.column,
            context: options?.context,
            cause: options?.cause,
        });
    }

    /**
     * Add a warning.
     */
    addWarning(
        code: ParseErrorCode,
        message: string,
        options?: Omit<Parameters<ParseErrorAccumulator['addError']>[2], 'severity'>
    ): void {
        this.addError(code, message, { ...options, severity: 'warning' });
    }

    /**
     * Add an info message.
     */
    addInfo(
        code: ParseErrorCode,
        message: string,
        options?: Omit<Parameters<ParseErrorAccumulator['addError']>[2], 'severity'>
    ): void {
        this.addError(code, message, { ...options, severity: 'info' });
    }

    /**
     * Check if max errors reached.
     */
    get maxErrorsReached(): boolean {
        return this._errors.filter((e) => e.severity === 'error').length >= this.maxErrors;
    }

    /**
     * Check if there are any blocking errors.
     */
    get hasBlockingError(): boolean {
        return this._hasBlockingError;
    }

    /**
     * Get all collected errors.
     */
    get errors(): readonly ParseError[] {
        return this._errors;
    }

    /**
     * Get error count.
     */
    get errorCount(): number {
        return this._errors.filter((e) => e.severity === 'error').length;
    }

    /**
     * Get warning count.
     */
    get warningCount(): number {
        return this._errors.filter((e) => e.severity === 'warning').length;
    }

    /**
     * Check if should continue parsing.
     */
    shouldContinue(continueOnError: boolean): boolean {
        if (this.maxErrorsReached) {
            return false;
        }
        if (!continueOnError && this._hasBlockingError) {
            return false;
        }
        return true;
    }
}

// =============================================================================
// Abstract Parser
// =============================================================================

/**
 * Abstract base class for all parsers.
 *
 * Provides:
 * - Error accumulation and handling
 * - Progress reporting
 * - Cancellation support
 * - File system utilities
 * - Common parsing infrastructure
 */
export abstract class AbstractParser implements IParser, IArtifactParser {
    // =========================================================================
    // Abstract Members
    // =========================================================================

    /**
     * Parser capabilities.
     * Subclasses must provide their capabilities.
     */
    abstract readonly capabilities: ParserCapabilities;

    /**
     * Perform the actual parsing.
     * Subclasses implement this method.
     */
    protected abstract doParse(
        path: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null>;

    // =========================================================================
    // IParser Implementation
    // =========================================================================

    /**
     * Check if this parser can handle the given path.
     */
    canParse(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.capabilities.fileExtensions.includes(ext);
    }

    /**
     * Get supported files from a folder.
     */
    async getSupportedFiles(folderPath: string): Promise<DetectedFile[]> {
        const files: DetectedFile[] = [];

        if (!fs.existsSync(folderPath)) {
            return files;
        }

        const stat = await fs.promises.stat(folderPath);
        if (!stat.isDirectory()) {
            return files;
        }

        await this.scanFolder(folderPath, files);
        return files;
    }

    /**
     * Recursively scan a folder for supported files.
     */
    private async scanFolder(folderPath: string, files: DetectedFile[]): Promise<void> {
        const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);

            if (entry.isDirectory()) {
                // Skip common non-source directories
                if (!this.shouldSkipDirectory(entry.name)) {
                    await this.scanFolder(fullPath, files);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (this.capabilities.fileExtensions.includes(ext)) {
                    const stat = await fs.promises.stat(fullPath);
                    files.push({
                        path: fullPath,
                        type: this.getFileType(ext),
                        platform: this.capabilities.platform,
                        size: stat.size,
                        lastModified: stat.mtime,
                    });
                }
            }
        }
    }

    /**
     * Check if a directory should be skipped during scanning.
     */
    protected shouldSkipDirectory(name: string): boolean {
        const skipDirs = ['node_modules', 'bin', 'obj', 'target', '.git', '.svn', '.vs', '.vscode'];
        return skipDirs.includes(name.toLowerCase());
    }

    /**
     * Get the file type for a given extension.
     * Subclasses can override for custom mapping.
     */
    protected getFileType(_extension: string): SourceFileType {
        // Default implementation - subclasses should override
        return this.capabilities.fileTypes[0] ?? 'xml';
    }

    /**
     * Parse the given file or folder.
     */
    async parse(inputPath: string, options?: ParseOptions): Promise<ParseResult> {
        const startTime = Date.now();
        const stats = createEmptyParseStats();
        const errors = new ParseErrorAccumulator(
            options?.maxErrors ?? DEFAULT_PARSE_OPTIONS.maxErrors
        );

        // Merge options with defaults
        const mergedOptions = {
            ...DEFAULT_PARSE_OPTIONS,
            ...options,
            basePath: options?.basePath ?? path.dirname(inputPath),
        };

        // Check cancellation
        if (options?.cancellationToken?.isCancellationRequested) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return this.createResult(null, errors, stats, startTime);
        }

        // Check if path exists
        if (!fs.existsSync(inputPath)) {
            errors.addError(
                ParseErrorCodes.FILE_NOT_FOUND,
                `File or folder not found: ${inputPath}`,
                { filePath: inputPath }
            );
            return this.createResult(null, errors, stats, startTime);
        }

        try {
            // Perform parsing with merged options
            const ir = await this.doParse(inputPath, mergedOptions, errors);

            return this.createResult(ir, errors, stats, startTime);
        } catch (error) {
            errors.addError(
                ParseErrorCodes.UNKNOWN_ERROR,
                `Unexpected error during parsing: ${error instanceof Error ? error.message : String(error)}`,
                {
                    filePath: inputPath,
                    cause: error instanceof Error ? error : undefined,
                }
            );
            return this.createResult(null, errors, stats, startTime);
        }
    }

    /**
     * Get artifact summary (optional implementation).
     */
    async getArtifactSummary?(filePath: string): Promise<ArtifactSummary> {
        // Default implementation - subclasses can override
        const name = path.basename(filePath, path.extname(filePath));
        return {
            name,
            type: this.capabilities.fileTypes[0] ?? 'unknown',
        };
    }

    /**
     * Dispose of resources.
     */
    dispose(): void {
        // Default: nothing to dispose
    }

    // =========================================================================
    // Protected Utilities
    // =========================================================================

    /**
     * Read file contents as string, handling various encodings including UTF-16.
     */
    protected async readFile(
        filePath: string,
        errors: ParseErrorAccumulator
    ): Promise<string | null> {
        try {
            // First read as buffer to detect encoding
            const buffer = await fs.promises.readFile(filePath);

            // Check for BOM (Byte Order Mark) to detect UTF-16
            if (buffer.length >= 2) {
                // UTF-16 LE BOM: FF FE
                if (buffer[0] === 0xff && buffer[1] === 0xfe) {
                    return buffer.toString('utf16le').slice(1); // Skip BOM
                }
                // UTF-16 BE BOM: FE FF
                if (buffer[0] === 0xfe && buffer[1] === 0xff) {
                    // Node doesn't have built-in UTF-16 BE support, swap bytes and use LE
                    const swapped = Buffer.alloc(buffer.length - 2);
                    for (let i = 2; i < buffer.length - 1; i += 2) {
                        swapped[i - 2] = buffer[i + 1];
                        swapped[i - 1] = buffer[i];
                    }
                    return swapped.toString('utf16le');
                }
                // UTF-8 BOM: EF BB BF
                if (
                    buffer.length >= 3 &&
                    buffer[0] === 0xef &&
                    buffer[1] === 0xbb &&
                    buffer[2] === 0xbf
                ) {
                    return buffer.toString('utf-8').slice(1); // Skip BOM
                }
            }

            // Default to UTF-8
            return buffer.toString('utf-8');
        } catch (error) {
            errors.addError(
                ParseErrorCodes.FILE_READ_ERROR,
                `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
                { filePath, cause: error instanceof Error ? error : undefined }
            );
            return null;
        }
    }

    /**
     * Read file contents as buffer.
     */
    protected async readFileBuffer(
        filePath: string,
        errors: ParseErrorAccumulator
    ): Promise<Buffer | null> {
        try {
            return await fs.promises.readFile(filePath);
        } catch (error) {
            errors.addError(
                ParseErrorCodes.FILE_READ_ERROR,
                `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
                { filePath, cause: error instanceof Error ? error : undefined }
            );
            return null;
        }
    }

    /**
     * Resolve a relative path against a base path.
     */
    protected resolvePath(relativePath: string, basePath: string): string {
        if (path.isAbsolute(relativePath)) {
            return relativePath;
        }
        return path.resolve(basePath, relativePath);
    }

    /**
     * Check if operation is cancelled.
     */
    protected isCancelled(token?: vscode.CancellationToken): boolean {
        return token?.isCancellationRequested ?? false;
    }

    /**
     * Report progress if callback provided.
     */
    protected reportProgress(
        onProgress: ProgressCallback | undefined,
        current: number,
        total: number,
        message: string
    ): void {
        if (onProgress) {
            onProgress({
                current,
                total,
                message,
                percentage: total > 0 ? Math.round((current / total) * 100) : 0,
            });
        }
    }

    /**
     * Create a parse result.
     */
    protected createResult(
        ir: IRDocument | null,
        errors: ParseErrorAccumulator,
        stats: ParseStats,
        startTime: number
    ): ParseResult {
        const updatedStats: ParseStats = {
            ...stats,
            durationMs: Date.now() - startTime,
        };

        return {
            success: ir !== null && !errors.hasBlockingError,
            ir,
            errors: errors.errors,
            stats: updatedStats,
        };
    }

    /**
     * Create an empty IR document for this parser's platform.
     */
    protected createBaseIR(id: string, name: string): IRDocument {
        return createEmptyIRDocument(id, name, this.capabilities.platform);
    }
}
