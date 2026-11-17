/**
 * Dell Boomi parser types
 *
 * Normalized model shared by the Boomi parsers. Supports both native
 * AtomSphere component exports (`<bns:Component type="...">`) and the
 * simplified "synthetic" Boomi XML used by migration-test corpora
 * (`<syntheticBoomiProcess>`, `<syntheticBoomiConnection>`, ...).
 *
 * @module parsers/boomi/types
 */

/**
 * Kind of Boomi component contained in a file.
 */
export type BoomiComponentKind =
    | 'process'
    | 'connection'
    | 'operation'
    | 'map'
    | 'profile'
    | 'trading-partner'
    | 'script'
    | 'process-property'
    | 'cross-reference'
    | 'api'
    | 'environment'
    | 'test-asset'
    | 'component'
    | 'manifest';

/**
 * Source dialect of a Boomi component file.
 */
export type BoomiDialect = 'native' | 'synthetic' | 'file';

/**
 * Lightweight identity of a Boomi component (used for cross-references).
 */
export interface BoomiComponentRef {
    readonly kind: BoomiComponentKind;
    readonly name: string;
    readonly componentId?: string;
    /** Raw Boomi component type (e.g. `process`, `connector-settings`, `transform.map`) */
    readonly componentType?: string;
    readonly filePath: string;
    readonly dialect: BoomiDialect;
    /** Connector type for connections/operations (e.g. `http`, `database`, `Salesforce`) */
    readonly connectorType?: string;
    /** Connection referenced by an operation (name or componentId) */
    readonly connection?: string;
    /** Operation action (e.g. QUERY, UPSERT, POST, SEND, Listen, Get) */
    readonly operation?: string;
    /** Authentication mode declared by a connection */
    readonly auth?: string;
    /** Trading partner communication channel (AS2, SFTP, ...) */
    readonly communication?: string;
    /** Trading partner B2B standard (X12, EDIFACT, ...) */
    readonly standard?: string;
    /** Trading partner document/transaction types (e.g. 850, 810) */
    readonly documents?: readonly string[];
}

/**
 * A process shape after normalization.
 */
export interface BoomiShape {
    readonly id: string;
    /** Native Boomi shape type (start, connectoraction, map, processcall, ...) or `reference` */
    readonly shapeType: string;
    /** Display label */
    readonly label: string;
    /** Raw `type` value from synthetic XML (component reference or shape type) */
    readonly reference?: string;
    /** Shapes reached from this shape via dragpoints */
    readonly next: string[];
    /** Native `<configuration>` attributes flattened by element local name */
    readonly configuration: Record<string, Record<string, string>>;
}

/**
 * Normalized Boomi process.
 */
export interface BoomiProcess {
    readonly name: string;
    readonly componentId?: string;
    readonly version?: string;
    readonly folder?: string;
    readonly dialect: BoomiDialect;
    readonly shapes: BoomiShape[];
}

/**
 * Normalized Boomi map.
 */
export interface BoomiMap {
    readonly name: string;
    readonly componentId?: string;
    readonly dialect: BoomiDialect;
    readonly fields: { source: string; target: string }[];
    readonly functionCount: number;
    readonly fromProfile?: string;
    readonly toProfile?: string;
    /** Cross-reference tables used by the map */
    readonly lookups?: readonly string[];
    /** Declarative validation rules attached to the map */
    readonly validations?: readonly string[];
}
