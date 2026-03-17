/**
 * IR Schema and Map Types
 *
 * Type definitions for data schemas (XSD, JSON Schema, etc.)
 * and data transformations (XSLT, Liquid, DataWeave, etc.).
 *
 * @module ir/types/schemas
 */

import {
    JSONPointer,
    MapType,
    SchemaType,
    SourceMappingRecord,
} from './common';

// =============================================================================
// Schema Types
// =============================================================================

/**
 * Schema format configuration.
 */
export interface SchemaFormat {
    /** Character encoding */
    readonly encoding?: string;

    /** Root element name (for XML) */
    readonly rootElement?: string;

    /** XML namespace */
    readonly namespace?: string;

    /** Namespace prefix */
    readonly namespacePrefix?: string;
}

/**
 * Flat file schema configuration.
 */
export interface FlatFileConfig {
    /** Record structure type */
    readonly structure: 'delimited' | 'positional' | 'mixed';

    /** Record delimiter */
    readonly recordDelimiter?: string;

    /** Field delimiter */
    readonly fieldDelimiter?: string;

    /** Text qualifier */
    readonly textQualifier?: string;

    /** Whether first row is header */
    readonly headerRow?: boolean;

    /** Fixed field widths (for positional) */
    readonly fieldWidths?: readonly number[];

    /** Escape character */
    readonly escapeCharacter?: string;
}

/**
 * Schema target mapping for Logic Apps.
 */
export interface SchemaTargetMapping {
    /** Destination for the schema */
    readonly destination: 'integration-account' | 'inline' | 'artifact-folder';

    /** Whether upload is required */
    readonly uploadRequired?: boolean;

    /** Schema name in Integration Account */
    readonly schemaName?: string;

    /** Whether schema has a gap */
    readonly gap: boolean;

    /** Gap description */
    readonly gapReason?: string;
}

/**
 * Schema definition.
 * Represents a data contract (XSD, JSON Schema, etc.).
 */
export interface IRSchema {
    /** Unique identifier */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Schema type */
    readonly type: SchemaType;

    /** Schema format configuration */
    readonly format?: SchemaFormat;

    /** Flat file configuration (for flatfile type) */
    readonly flatFileConfig?: FlatFileConfig;

    /** File information */
    readonly file?: {
        /** File name */
        readonly name: string;
        /** File path */
        readonly path: string;
        /** File size in bytes */
        readonly sizeBytes?: number;
        /** Content hash */
        readonly contentHash?: string;
    };

    /** Inline schema content */
    readonly content?: string;

    /** Schema version */
    readonly version?: string;

    /** Target namespace (for XML schemas) */
    readonly targetNamespace?: string;

    /** Import/include references */
    readonly imports?: readonly JSONPointer[];

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target Logic Apps mapping */
    readonly targetMapping?: SchemaTargetMapping;

    /** Tags for organization */
    readonly tags?: readonly string[];
}

// =============================================================================
// Map/Transformation Types
// =============================================================================

/**
 * Map function/functoid definition.
 */
export interface MapFunction {
    /** Unique identifier */
    readonly id: string;

    /** Function name */
    readonly name: string;

    /** Function type */
    readonly type:
        | 'string-concat'
        | 'string-extract'
        | 'string-format'
        | 'math'
        | 'date'
        | 'logical'
        | 'lookup'
        | 'cumulative'
        | 'conversion'
        | 'scientific'
        | 'database'
        | 'custom';

    /** Function category */
    readonly category: 'built-in' | 'custom' | 'database';

    /** Complexity level */
    readonly complexity: 'low' | 'medium' | 'high';

    /** Whether function can be converted */
    readonly convertible: boolean;

    /** Equivalent Liquid template expression */
    readonly liquidEquivalent?: string;

    /** Equivalent XSLT expression */
    readonly xsltEquivalent?: string;

    /** Resolution for non-convertible functions */
    readonly resolution?: {
        readonly strategy: 'azure-function' | 'inline-script' | 'manual';
        readonly description?: string;
        readonly effort?: 'low' | 'medium' | 'high';
    };

    /** Additional notes */
    readonly notes?: string;
}

/**
 * Map parameter definition.
 */
export interface MapParameter {
    /** Parameter name */
    readonly name: string;

    /** Parameter type */
    readonly type: 'string' | 'number' | 'boolean' | 'date' | 'any';

    /** Whether parameter is required */
    readonly required?: boolean;

    /** Default value */
    readonly defaultValue?: unknown;

    /** Description */
    readonly description?: string;
}

/**
 * Map source/target specification.
 */
export interface MapEndpoint {
    /** Schema reference */
    readonly schemaRef?: JSONPointer;

    /** Data format */
    readonly format: 'xml' | 'json' | 'text' | 'csv';

    /** Root element/path */
    readonly rootPath?: string;
}

/**
 * Map target mapping for Logic Apps.
 */
export interface MapTargetMapping {
    /** Destination for the map */
    readonly destination: 'integration-account' | 'inline' | 'artifact-folder';

    /** Output map type */
    readonly type: 'xslt' | 'liquid';

    /** Whether conversion is needed */
    readonly conversionNeeded: boolean;

    /** Conversion tool to use */
    readonly conversionTool?: 'btm-to-xslt' | 'dataweave-to-liquid' | 'manual';

    /** Whether map has a gap */
    readonly gap: boolean;

    /** Gap description */
    readonly gapReason?: string;

    /** Functions that need Azure Functions */
    readonly functionsRequiringAzureFunction?: readonly string[];
}

/**
 * Map/transformation definition.
 * Represents a data transformation (XSLT, Liquid, DataWeave, etc.).
 */
export interface IRMap {
    /** Unique identifier */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Map type */
    readonly type: MapType;

    /** Map version (for XSLT 1.0/2.0/3.0, etc.) */
    readonly version?: string;

    /** Source endpoint */
    readonly source?: MapEndpoint;

    /** Target endpoint */
    readonly target?: MapEndpoint;

    /** Original source file */
    readonly file?: {
        /** Source file name */
        readonly sourceFile: string;
        /** Generated file name (after conversion) */
        readonly generatedFile?: string;
        /** File path */
        readonly path: string;
    };

    /** Inline map content */
    readonly content?: string;

    /** Functions used in the map */
    readonly functions?: readonly MapFunction[];

    /** Map parameters */
    readonly parameters?: readonly MapParameter[];

    /** Custom code references */
    readonly customCodeRefs?: readonly JSONPointer[];

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target Logic Apps mapping */
    readonly targetMapping?: MapTargetMapping;

    /** Tags for organization */
    readonly tags?: readonly string[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for XML schemas.
 */
export function isXmlSchema(schema: IRSchema): boolean {
    return schema.type === 'xml';
}

/**
 * Type guard for JSON schemas.
 */
export function isJsonSchema(schema: IRSchema): boolean {
    return schema.type === 'json';
}

/**
 * Type guard for flat file schemas.
 */
export function isFlatFileSchema(schema: IRSchema): boolean {
    return schema.type === 'flatfile';
}

/**
 * Type guard for XSLT maps.
 */
export function isXsltMap(map: IRMap): boolean {
    return map.type === 'xslt';
}

/**
 * Type guard for Liquid maps.
 */
export function isLiquidMap(map: IRMap): boolean {
    return map.type === 'liquid';
}

/**
 * Type guard for DataWeave maps.
 */
export function isDataWeaveMap(map: IRMap): boolean {
    return map.type === 'dataweave';
}

/**
 * Check if map has non-convertible functions.
 */
export function hasNonConvertibleFunctions(map: IRMap): boolean {
    return map.functions?.some(f => !f.convertible) ?? false;
}

/**
 * Get non-convertible functions from a map.
 */
export function getNonConvertibleFunctions(map: IRMap): readonly MapFunction[] {
    return map.functions?.filter(f => !f.convertible) ?? [];
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new schema with required fields.
 *
 * @param id - Unique identifier
 * @param name - Display name
 * @param type - Schema type
 * @returns A new IRSchema instance
 */
export function createSchema(
    id: string,
    name: string,
    type: SchemaType
): IRSchema {
    return {
        id,
        name,
        type,
        targetMapping: {
            destination: 'integration-account',
            uploadRequired: true,
            gap: false,
        },
    };
}

/**
 * Creates a new map with required fields.
 *
 * @param id - Unique identifier
 * @param name - Display name
 * @param type - Map type
 * @returns A new IRMap instance
 */
export function createMap(
    id: string,
    name: string,
    type: MapType
): IRMap {
    return {
        id,
        name,
        type,
        targetMapping: {
            destination: 'integration-account',
            type: type === 'dataweave' ? 'liquid' : 'xslt',
            conversionNeeded: type !== 'xslt',
            gap: false,
        },
    };
}
