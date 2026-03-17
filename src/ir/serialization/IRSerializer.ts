/**
 * IR Serialization Module
 *
 * Handles serialization and deserialization of IR documents to/from JSON.
 * Supports circular reference handling, type preservation, and schema versioning.
 *
 * @module ir/serialization
 */

import {
    IRDocument,
    IR_VERSION,
    isIRDocument,
} from '../types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum allowed IR document size in bytes (10MB).
 */
export const MAX_IR_SIZE = 10 * 1024 * 1024;

/**
 * Indentation for pretty-printed output.
 */
export const DEFAULT_INDENT = 2;

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown during IR serialization/deserialization.
 */
export class IRSerializationError extends Error {
    public override readonly cause?: Error;

    constructor(
        message: string,
        cause?: Error
    ) {
        super(message);
        this.name = 'IRSerializationError';
        this.cause = cause;

        // Maintains proper stack trace for where error was thrown (V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, IRSerializationError);
        }
    }
}

// =============================================================================
// Serialization Options
// =============================================================================

/**
 * Options for IR serialization.
 */
export interface SerializeOptions {
    /**
     * Whether to pretty-print the output.
     * @default true
     */
    readonly pretty?: boolean;

    /**
     * Indentation level for pretty printing.
     * @default 2
     */
    readonly indent?: number;

    /**
     * Whether to include null values.
     * @default false
     */
    readonly includeNulls?: boolean;

    /**
     * Whether to include undefined values.
     * @default false
     */
    readonly includeUndefined?: boolean;

    /**
     * Whether to sort object keys alphabetically.
     * @default false
     */
    readonly sortKeys?: boolean;

    /**
     * Custom replacer function for JSON.stringify.
     */
    readonly replacer?: (key: string, value: unknown) => unknown;
}

/**
 * Options for IR deserialization.
 */
export interface DeserializeOptions {
    /**
     * Whether to validate the schema after deserialization.
     * @default true
     */
    readonly validate?: boolean;

    /**
     * Whether to allow older schema versions.
     * @default true
     */
    readonly allowOlderVersions?: boolean;

    /**
     * Custom reviver function for JSON.parse.
     */
    readonly reviver?: (key: string, value: unknown) => unknown;
}

// =============================================================================
// Serialization Result
// =============================================================================

/**
 * Result of a serialization operation.
 */
export interface SerializationResult {
    /** Serialized JSON string */
    readonly json: string;

    /** Size in bytes */
    readonly sizeBytes: number;

    /** Whether result was minified */
    readonly minified: boolean;

    /** Serialization duration in milliseconds */
    readonly durationMs: number;
}

/**
 * Result of a deserialization operation.
 */
export interface DeserializationResult {
    /** Deserialized IR document */
    readonly document: IRDocument;

    /** Schema version found in document */
    readonly schemaVersion: string;

    /** Deserialization duration in milliseconds */
    readonly durationMs: number;

    /** Warnings encountered during deserialization */
    readonly warnings: readonly string[];
}

// =============================================================================
// IRSerializer Class
// =============================================================================

/**
 * Serializer for IR documents.
 *
 * Handles conversion between IRDocument objects and JSON strings
 * with proper handling of special types and schema versioning.
 *
 * @example
 * ```typescript
 * const serializer = new IRSerializer();
 *
 * // Serialize
 * const result = serializer.serialize(irDocument);
 * console.log(result.json);
 *
 * // Deserialize
 * const { document } = serializer.deserialize(jsonString);
 * ```
 */
export class IRSerializer {
    private readonly defaultSerializeOptions: Required<SerializeOptions> = {
        pretty: true,
        indent: DEFAULT_INDENT,
        includeNulls: false,
        includeUndefined: false,
        sortKeys: false,
        replacer: (_, v) => v,
    };

    private readonly defaultDeserializeOptions: Required<DeserializeOptions> = {
        validate: true,
        allowOlderVersions: true,
        reviver: (_, v) => v,
    };

    /**
     * Serializes an IR document to a JSON string.
     *
     * @param document - The IR document to serialize
     * @param options - Serialization options
     * @returns Serialization result containing the JSON string
     * @throws IRSerializationError if serialization fails
     *
     * @example
     * ```typescript
     * const result = serializer.serialize(document, { pretty: false });
     * ```
     */
    public serialize(
        document: IRDocument,
        options: SerializeOptions = {}
    ): SerializationResult {
        const startTime = performance.now();
        const opts = { ...this.defaultSerializeOptions, ...options };

        try {
            // Create replacer that handles special cases
            const replacer = this.createReplacer(opts);

            // Serialize to JSON
            const json = opts.pretty
                ? JSON.stringify(document, replacer, opts.indent)
                : JSON.stringify(document, replacer);

            const sizeBytes = new TextEncoder().encode(json).length;

            // Check size limit
            if (sizeBytes > MAX_IR_SIZE) {
                throw new IRSerializationError(
                    `Serialized IR exceeds maximum size of ${MAX_IR_SIZE} bytes (actual: ${sizeBytes} bytes)`
                );
            }

            const durationMs = performance.now() - startTime;

            return {
                json,
                sizeBytes,
                minified: !opts.pretty,
                durationMs,
            };
        } catch (error) {
            if (error instanceof IRSerializationError) {
                throw error;
            }
            throw new IRSerializationError(
                `Failed to serialize IR document: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Deserializes a JSON string to an IR document.
     *
     * @param json - The JSON string to deserialize
     * @param options - Deserialization options
     * @returns Deserialization result containing the IR document
     * @throws IRSerializationError if deserialization fails
     *
     * @example
     * ```typescript
     * const { document, warnings } = serializer.deserialize(jsonString);
     * ```
     */
    public deserialize(
        json: string,
        options: DeserializeOptions = {}
    ): DeserializationResult {
        const startTime = performance.now();
        const opts = { ...this.defaultDeserializeOptions, ...options };
        const warnings: string[] = [];

        try {
            // Check input size
            const inputSize = new TextEncoder().encode(json).length;
            if (inputSize > MAX_IR_SIZE) {
                throw new IRSerializationError(
                    `Input JSON exceeds maximum size of ${MAX_IR_SIZE} bytes (actual: ${inputSize} bytes)`
                );
            }

            // Create reviver that handles special cases
            const reviver = this.createReviver(opts);

            // Parse JSON
            const parsed = JSON.parse(json, reviver);

            // Validate basic structure
            if (opts.validate && !isIRDocument(parsed)) {
                throw new IRSerializationError(
                    'Parsed JSON does not conform to IRDocument structure'
                );
            }

            const document = parsed as IRDocument;

            // Check schema version
            const schemaVersion = document.$version;
            if (!this.isCompatibleVersion(schemaVersion, opts.allowOlderVersions)) {
                throw new IRSerializationError(
                    `Incompatible IR schema version: ${schemaVersion}. Expected: ${IR_VERSION}`
                );
            }

            // Add warning for older versions
            if (schemaVersion !== IR_VERSION) {
                warnings.push(
                    `IR document uses older schema version ${schemaVersion}. Current version is ${IR_VERSION}.`
                );
            }

            const durationMs = performance.now() - startTime;

            return {
                document,
                schemaVersion,
                durationMs,
                warnings,
            };
        } catch (error) {
            if (error instanceof IRSerializationError) {
                throw error;
            }
            if (error instanceof SyntaxError) {
                throw new IRSerializationError(
                    `Invalid JSON syntax: ${error.message}`,
                    error
                );
            }
            throw new IRSerializationError(
                `Failed to deserialize IR document: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Validates that a JSON string can be deserialized to a valid IR document
     * without performing the full deserialization.
     *
     * @param json - The JSON string to validate
     * @returns True if the JSON is valid IR, false otherwise
     */
    public isValidIR(json: string): boolean {
        try {
            const parsed = JSON.parse(json);
            return isIRDocument(parsed);
        } catch {
            return false;
        }
    }

    /**
     * Creates a minified version of an IR document.
     *
     * @param document - The IR document to minify
     * @returns Minified JSON string
     */
    public minify(document: IRDocument): string {
        return this.serialize(document, { pretty: false }).json;
    }

    /**
     * Creates a pretty-printed version of an IR JSON string.
     *
     * @param json - The JSON string to format
     * @param indent - Indentation level (default: 2)
     * @returns Pretty-printed JSON string
     * @throws IRSerializationError if JSON is invalid
     */
    public prettify(json: string, indent: number = DEFAULT_INDENT): string {
        try {
            const parsed = JSON.parse(json);
            return JSON.stringify(parsed, null, indent);
        } catch (error) {
            throw new IRSerializationError(
                `Failed to prettify JSON: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Calculates the size of an IR document when serialized.
     *
     * @param document - The IR document
     * @param minified - Whether to calculate minified size
     * @returns Size in bytes
     */
    public calculateSize(document: IRDocument, minified = true): number {
        const json = this.serialize(document, { pretty: !minified }).json;
        return new TextEncoder().encode(json).length;
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Creates a replacer function for JSON.stringify.
     */
    private createReplacer(
        opts: Required<SerializeOptions>
    ): (key: string, value: unknown) => unknown {
        return (key: string, value: unknown): unknown => {
            // Skip undefined values
            if (value === undefined && !opts.includeUndefined) {
                return undefined;
            }

            // Skip null values if configured
            if (value === null && !opts.includeNulls) {
                return undefined;
            }

            // Handle Date objects
            if (value instanceof Date) {
                return value.toISOString();
            }

            // Handle Map objects
            if (value instanceof Map) {
                return Object.fromEntries(value);
            }

            // Handle Set objects
            if (value instanceof Set) {
                return Array.from(value);
            }

            // Sort keys if configured
            if (opts.sortKeys && value !== null && typeof value === 'object' && !Array.isArray(value)) {
                const sorted: Record<string, unknown> = {};
                const keys = Object.keys(value as Record<string, unknown>).sort();
                for (const k of keys) {
                    sorted[k] = (value as Record<string, unknown>)[k];
                }
                return sorted;
            }

            // Apply custom replacer
            return opts.replacer(key, value);
        };
    }

    /**
     * Creates a reviver function for JSON.parse.
     */
    private createReviver(
        opts: Required<DeserializeOptions>
    ): (key: string, value: unknown) => unknown {
        return (key: string, value: unknown): unknown => {
            // Restore Date objects from ISO strings
            if (typeof value === 'string' && this.isISODateString(value)) {
                return value; // Keep as string - IR uses ISO strings
            }

            // Apply custom reviver
            return opts.reviver(key, value);
        };
    }

    /**
     * Checks if a string is an ISO 8601 date string.
     */
    private isISODateString(value: string): boolean {
        // ISO 8601 date pattern
        const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        return isoDatePattern.test(value);
    }

    /**
     * Checks if a schema version is compatible.
     */
    private isCompatibleVersion(version: string, allowOlder: boolean): boolean {
        if (version === IR_VERSION) {
            return true;
        }

        if (!allowOlder) {
            return false;
        }

        // Allow v3.x.x versions
        const majorVersion = version.split('.')[0];
        const currentMajor = IR_VERSION.split('.')[0];
        return majorVersion === currentMajor;
    }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Default IR serializer instance.
 *
 * @example
 * ```typescript
 * import { irSerializer } from './serialization';
 *
 * const result = irSerializer.serialize(document);
 * ```
 */
export const irSerializer = new IRSerializer();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Serializes an IR document to JSON.
 *
 * @param document - The IR document to serialize
 * @param options - Serialization options
 * @returns JSON string
 */
export function serializeIR(
    document: IRDocument,
    options?: SerializeOptions
): string {
    return irSerializer.serialize(document, options).json;
}

/**
 * Deserializes JSON to an IR document.
 *
 * @param json - The JSON string to deserialize
 * @param options - Deserialization options
 * @returns IR document
 */
export function deserializeIR(
    json: string,
    options?: DeserializeOptions
): IRDocument {
    return irSerializer.deserialize(json, options).document;
}
