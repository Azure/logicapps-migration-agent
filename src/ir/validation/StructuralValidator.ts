/**
 * IR Structural Validator
 *
 * Validates IR documents against the schema structure.
 * Checks for required fields, correct types, and valid values.
 *
 * @module ir/validation/structural
 */

import {
    IRDocument,
    IR_SCHEMA_ID,
    isIRDocument,
    MigrationStatus,
    ComplexityLevel,
    TriggerType,
    ActionType,
    ConnectionType,
    SchemaType,
    MapType,
    GapCategory,
    GapSeverity,
} from '../types';

import {
    ValidationIssue,
    ValidationResult,
    ValidationOptions,
    DEFAULT_VALIDATION_OPTIONS,
    createError,
    createWarning,
} from './types';

// =============================================================================
// Validation Codes
// =============================================================================

/**
 * Structural validation error codes.
 */
export const StructuralValidationCodes = {
    // Schema
    INVALID_SCHEMA: 'STRUCT_001',
    INVALID_VERSION: 'STRUCT_002',

    // Required fields
    MISSING_REQUIRED: 'STRUCT_010',
    NULL_VALUE: 'STRUCT_011',

    // Type errors
    INVALID_TYPE: 'STRUCT_020',
    INVALID_ARRAY: 'STRUCT_021',
    INVALID_OBJECT: 'STRUCT_022',
    INVALID_STRING: 'STRUCT_023',
    INVALID_NUMBER: 'STRUCT_024',
    INVALID_BOOLEAN: 'STRUCT_025',

    // Value errors
    INVALID_ENUM: 'STRUCT_030',
    INVALID_FORMAT: 'STRUCT_031',
    EMPTY_STRING: 'STRUCT_032',
    EMPTY_ARRAY: 'STRUCT_033',

    // ID errors
    INVALID_ID: 'STRUCT_040',
    DUPLICATE_ID: 'STRUCT_041',
} as const;

// =============================================================================
// Valid Enum Values
// =============================================================================

const VALID_MIGRATION_STATUSES: readonly MigrationStatus[] = [
    'discovered', 'assessed', 'planned', 'designed',
    'converted', 'validated', 'deployed', 'verified',
];

const VALID_COMPLEXITY_LEVELS: readonly ComplexityLevel[] = [
    'low', 'medium', 'high', 'very-high',
];

const VALID_TRIGGER_TYPES: readonly TriggerType[] = [
    'http', 'service-bus', 'storage-queue', 'storage-blob', 'timer',
    'file', 'ftp', 'sftp', 'event-grid', 'event-hub', 'kafka',
    'database', 'email', 'manual', 'custom',
];

const VALID_ACTION_TYPES: readonly ActionType[] = [
    'transform', 'compose', 'parse', 'validate',
    'set-variable', 'append-variable', 'increment-variable',
    'condition', 'switch', 'foreach', 'until', 'parallel', 'scope',
    'http-call', 'http-response', 'database-query', 'database-execute',
    'queue-send', 'queue-receive', 'file-read', 'file-write',
    'ftp-operation', 'sftp-operation', 'email-send',
    'call-workflow', 'terminate', 'delay', 'delay-until', 'wait',
    'sap-call', 'salesforce-operation', 'dynamics-operation',
    'azure-function', 'custom',
];

const VALID_CONNECTION_TYPES: readonly ConnectionType[] = [
    'sql-server', 'oracle', 'mysql', 'postgresql', 'cosmos-db', 'mongodb',
    'sap', 'salesforce', 'dynamics365',
    'service-bus', 'event-hub', 'kafka', 'rabbitmq', 'mq-series',
    'storage-blob', 'storage-queue', 'storage-table', 'sharepoint',
    'ftp', 'sftp', 'file-system',
    'smtp', 'office365-email', 'teams',
    'http', 'soap', 'rest', 'graphql', 'odata',
    'custom',
];

const VALID_SCHEMA_TYPES: readonly SchemaType[] = [
    'xml', 'json', 'flatfile', 'avro', 'protobuf', 'custom',
];

const VALID_MAP_TYPES: readonly MapType[] = [
    'xslt', 'liquid', 'dataweave', 'jolt', 'xquery', 'custom-code',
];

const VALID_GAP_CATEGORIES: readonly GapCategory[] = [
    'unsupported-feature', 'unsupported-adapter', 'complex-logic',
    'custom-code', 'transaction', 'correlation', 'performance',
    'pipeline', 'tracking', 'b2b', 'rules', 'other',
];

const VALID_GAP_SEVERITIES: readonly GapSeverity[] = [
    'low', 'medium', 'high', 'critical',
];

// =============================================================================
// StructuralValidator Class
// =============================================================================

/**
 * Validates the structural integrity of IR documents.
 *
 * Performs checks for:
 * - Required fields
 * - Correct types
 * - Valid enum values
 * - ID uniqueness
 */
export class StructuralValidator {
    private issues: ValidationIssue[] = [];
    private seenIds = new Set<string>();
    private options: Required<ValidationOptions> = DEFAULT_VALIDATION_OPTIONS;

    /**
     * Validates an IR document's structure.
     *
     * @param document - The document to validate
     * @param options - Validation options
     * @returns Validation result
     */
    public validate(
        document: unknown,
        options: ValidationOptions = {}
    ): ValidationResult {
        const startTime = performance.now();
        this.issues = [];
        this.seenIds = new Set();
        this.options = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

        const sectionsValidated: string[] = [];

        try {
            // Basic structure check
            if (!this.validateBasicStructure(document)) {
                return this.buildResult(startTime, sectionsValidated);
            }

            const doc = document as IRDocument;

            // Validate each section
            if (this.shouldValidateSection('schema')) {
                this.validateSchema(doc);
                sectionsValidated.push('schema');
            }

            if (this.shouldValidateSection('metadata')) {
                this.validateMetadata(doc);
                sectionsValidated.push('metadata');
            }

            if (this.shouldValidateSection('workflow')) {
                this.validateWorkflow(doc);
                sectionsValidated.push('workflow');
            }

            if (this.shouldValidateSection('triggers')) {
                this.validateTriggers(doc);
                sectionsValidated.push('triggers');
            }

            if (this.shouldValidateSection('actions')) {
                this.validateActions(doc);
                sectionsValidated.push('actions');
            }

            if (this.shouldValidateSection('connections')) {
                this.validateConnections(doc);
                sectionsValidated.push('connections');
            }

            if (this.shouldValidateSection('schemas')) {
                this.validateSchemas(doc);
                sectionsValidated.push('schemas');
            }

            if (this.shouldValidateSection('maps')) {
                this.validateMaps(doc);
                sectionsValidated.push('maps');
            }

            if (this.shouldValidateSection('gaps')) {
                this.validateGaps(doc);
                sectionsValidated.push('gaps');
            }
        } catch (error) {
            this.addError(
                '$',
                StructuralValidationCodes.INVALID_OBJECT,
                `Validation failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        return this.buildResult(startTime, sectionsValidated);
    }

    // =========================================================================
    // Section Validators
    // =========================================================================

    private validateBasicStructure(document: unknown): boolean {
        if (typeof document !== 'object' || document === null) {
            this.addError(
                '$',
                StructuralValidationCodes.INVALID_OBJECT,
                'Document must be an object',
                { expected: 'object', actual: typeof document }
            );
            return false;
        }

        if (!isIRDocument(document)) {
            this.addError(
                '$',
                StructuralValidationCodes.INVALID_OBJECT,
                'Document does not conform to IRDocument structure'
            );
            return false;
        }

        return true;
    }

    private validateSchema(doc: IRDocument): void {
        // $schema
        if (doc.$schema !== IR_SCHEMA_ID) {
            this.addWarning(
                '$.$schema',
                StructuralValidationCodes.INVALID_SCHEMA,
                `Invalid schema identifier`,
                { expected: IR_SCHEMA_ID, actual: doc.$schema }
            );
        }

        // $version
        if (!doc.$version || !doc.$version.match(/^\d+\.\d+\.\d+$/)) {
            this.addError(
                '$.$version',
                StructuralValidationCodes.INVALID_VERSION,
                'Invalid version format',
                { expected: 'semver (e.g., 3.0.0)', actual: doc.$version }
            );
        }
    }

    private validateMetadata(doc: IRDocument): void {
        const metadata = doc.metadata;
        const path = '$.metadata';

        // Required fields
        this.requireString(`${path}.id`, metadata.id, 'ID');
        this.requireString(`${path}.name`, metadata.name, 'Name');

        // Register ID
        this.registerIdAt(`${path}.id`, metadata.id);

        // Source metadata
        if (metadata.source) {
            this.validateSourceMetadata(metadata.source, `${path}.source`);
        } else if (!this.options.allowPartial) {
            this.addError(path, StructuralValidationCodes.MISSING_REQUIRED, 'Missing required field: source');
        }

        // Target metadata
        if (metadata.target) {
            this.validateTargetMetadata(metadata.target, `${path}.target`);
        } else if (!this.options.allowPartial) {
            this.addError(path, StructuralValidationCodes.MISSING_REQUIRED, 'Missing required field: target');
        }

        // Migration metadata
        if (metadata.migration) {
            this.validateMigrationMetadata(metadata.migration, `${path}.migration`);
        } else if (!this.options.allowPartial) {
            this.addError(path, StructuralValidationCodes.MISSING_REQUIRED, 'Missing required field: migration');
        }
    }

    private validateSourceMetadata(source: unknown, path: string): void {
        if (typeof source !== 'object' || source === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Source must be an object');
            return;
        }

        const s = source as Record<string, unknown>;

        this.requireString(`${path}.platform`, s.platform, 'Platform');
        this.requireString(`${path}.platformVersion`, s.platformVersion, 'Platform version');
        this.requireString(`${path}.application`, s.application, 'Application');
    }

    private validateTargetMetadata(target: unknown, path: string): void {
        if (typeof target !== 'object' || target === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Target must be an object');
            return;
        }

        const t = target as Record<string, unknown>;

        this.requireString(`${path}.platform`, t.platform, 'Platform');
        this.validateEnum(`${path}.workflowType`, t.workflowType, ['stateful', 'stateless']);
    }

    private validateMigrationMetadata(migration: unknown, path: string): void {
        if (typeof migration !== 'object' || migration === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Migration must be an object');
            return;
        }

        const m = migration as Record<string, unknown>;

        this.validateEnum(`${path}.status`, m.status, VALID_MIGRATION_STATUSES);
        this.validateEnum(`${path}.complexity`, m.complexity, VALID_COMPLEXITY_LEVELS);
        this.validateNumber(`${path}.complexityScore`, m.complexityScore, 0, 100);
    }

    private validateWorkflow(doc: IRDocument): void {
        const workflow = doc.workflow;
        const path = '$.workflow';

        this.validateEnum(`${path}.type`, workflow.type, ['stateful', 'stateless']);
    }

    private validateTriggers(doc: IRDocument): void {
        const triggers = doc.triggers;
        const path = '$.triggers';

        if (!Array.isArray(triggers)) {
            this.addError(path, StructuralValidationCodes.INVALID_ARRAY, 'Triggers must be an array');
            return;
        }

        triggers.forEach((trigger, index) => {
            this.validateTrigger(trigger, `${path}[${index}]`);
        });
    }

    private validateTrigger(trigger: unknown, path: string): void {
        if (typeof trigger !== 'object' || trigger === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Trigger must be an object');
            return;
        }

        const t = trigger as Record<string, unknown>;

        this.requireString(`${path}.id`, t.id, 'Trigger ID');
        this.requireString(`${path}.name`, t.name, 'Trigger name');
        this.validateEnum(`${path}.type`, t.type, VALID_TRIGGER_TYPES);
        this.registerIdAt(`${path}.id`, t.id as string);
    }

    private validateActions(doc: IRDocument): void {
        const actions = doc.actions;
        const path = '$.actions';

        if (!Array.isArray(actions)) {
            this.addError(path, StructuralValidationCodes.INVALID_ARRAY, 'Actions must be an array');
            return;
        }

        actions.forEach((action, index) => {
            this.validateAction(action, `${path}[${index}]`);
        });
    }

    private validateAction(action: unknown, path: string): void {
        if (typeof action !== 'object' || action === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Action must be an object');
            return;
        }

        const a = action as Record<string, unknown>;

        this.requireString(`${path}.id`, a.id, 'Action ID');
        this.requireString(`${path}.name`, a.name, 'Action name');
        this.validateEnum(`${path}.type`, a.type, VALID_ACTION_TYPES);
        this.registerIdAt(`${path}.id`, a.id as string);
    }

    private validateConnections(doc: IRDocument): void {
        const connections = doc.connections;
        const path = '$.connections';

        if (!Array.isArray(connections)) {
            this.addError(path, StructuralValidationCodes.INVALID_ARRAY, 'Connections must be an array');
            return;
        }

        connections.forEach((connection, index) => {
            this.validateConnection(connection, `${path}[${index}]`);
        });
    }

    private validateConnection(connection: unknown, path: string): void {
        if (typeof connection !== 'object' || connection === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Connection must be an object');
            return;
        }

        const c = connection as Record<string, unknown>;

        this.requireString(`${path}.id`, c.id, 'Connection ID');
        this.requireString(`${path}.name`, c.name, 'Connection name');
        this.validateEnum(`${path}.type`, c.type, VALID_CONNECTION_TYPES);
        this.registerIdAt(`${path}.id`, c.id as string);
    }

    private validateSchemas(doc: IRDocument): void {
        const schemas = doc.schemas;
        const path = '$.schemas';

        if (!Array.isArray(schemas)) {
            this.addError(path, StructuralValidationCodes.INVALID_ARRAY, 'Schemas must be an array');
            return;
        }

        schemas.forEach((schema, index) => {
            this.validateSchemaItem(schema, `${path}[${index}]`);
        });
    }

    private validateSchemaItem(schema: unknown, path: string): void {
        if (typeof schema !== 'object' || schema === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Schema must be an object');
            return;
        }

        const s = schema as Record<string, unknown>;

        this.requireString(`${path}.id`, s.id, 'Schema ID');
        this.requireString(`${path}.name`, s.name, 'Schema name');
        this.validateEnum(`${path}.type`, s.type, VALID_SCHEMA_TYPES);
        this.registerIdAt(`${path}.id`, s.id as string);
    }

    private validateMaps(doc: IRDocument): void {
        const maps = doc.maps;
        const path = '$.maps';

        if (!Array.isArray(maps)) {
            this.addError(path, StructuralValidationCodes.INVALID_ARRAY, 'Maps must be an array');
            return;
        }

        maps.forEach((map, index) => {
            this.validateMap(map, `${path}[${index}]`);
        });
    }

    private validateMap(map: unknown, path: string): void {
        if (typeof map !== 'object' || map === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Map must be an object');
            return;
        }

        const m = map as Record<string, unknown>;

        this.requireString(`${path}.id`, m.id, 'Map ID');
        this.requireString(`${path}.name`, m.name, 'Map name');
        this.validateEnum(`${path}.type`, m.type, VALID_MAP_TYPES);
        this.registerIdAt(`${path}.id`, m.id as string);
    }

    private validateGaps(doc: IRDocument): void {
        const gaps = doc.gaps;
        const path = '$.gaps';

        if (!Array.isArray(gaps)) {
            this.addError(path, StructuralValidationCodes.INVALID_ARRAY, 'Gaps must be an array');
            return;
        }

        gaps.forEach((gap, index) => {
            this.validateGap(gap, `${path}[${index}]`);
        });
    }

    private validateGap(gap: unknown, path: string): void {
        if (typeof gap !== 'object' || gap === null) {
            this.addError(path, StructuralValidationCodes.INVALID_OBJECT, 'Gap must be an object');
            return;
        }

        const g = gap as Record<string, unknown>;

        this.requireString(`${path}.id`, g.id, 'Gap ID');
        this.validateEnum(`${path}.category`, g.category, VALID_GAP_CATEGORIES);
        this.validateEnum(`${path}.severity`, g.severity, VALID_GAP_SEVERITIES);
        this.requireString(`${path}.title`, g.title, 'Gap title');
        this.registerIdAt(`${path}.id`, g.id as string);
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    private shouldValidateSection(section: string): boolean {
        if (this.options.sections.length === 0) {
            return true;
        }
        return this.options.sections.includes(section);
    }

    private requireString(path: string, value: unknown, fieldName: string): void {
        if (value === undefined || value === null) {
            if (!this.options.allowPartial) {
                this.addError(path, StructuralValidationCodes.MISSING_REQUIRED, `Missing required field: ${fieldName}`);
            }
            return;
        }
        if (typeof value !== 'string') {
            this.addError(path, StructuralValidationCodes.INVALID_STRING, `${fieldName} must be a string`, {
                expected: 'string',
                actual: typeof value,
            });
            return;
        }
        if (value.trim() === '') {
            this.addWarning(path, StructuralValidationCodes.EMPTY_STRING, `${fieldName} should not be empty`);
        }
    }

    private validateNumber(path: string, value: unknown, min?: number, max?: number): void {
        if (value === undefined || value === null) {
            return;
        }
        if (typeof value !== 'number' || isNaN(value)) {
            this.addError(path, StructuralValidationCodes.INVALID_NUMBER, 'Value must be a number', {
                expected: 'number',
                actual: typeof value,
            });
            return;
        }
        if (min !== undefined && value < min) {
            this.addError(path, StructuralValidationCodes.INVALID_NUMBER, `Value must be >= ${min}`, {
                expected: `>= ${min}`,
                actual: String(value),
            });
        }
        if (max !== undefined && value > max) {
            this.addError(path, StructuralValidationCodes.INVALID_NUMBER, `Value must be <= ${max}`, {
                expected: `<= ${max}`,
                actual: String(value),
            });
        }
    }

    private validateEnum<T>(path: string, value: unknown, validValues: readonly T[]): void {
        if (value === undefined || value === null) {
            return;
        }
        if (!validValues.includes(value as T)) {
            this.addError(path, StructuralValidationCodes.INVALID_ENUM, `Invalid enum value`, {
                expected: validValues.join(' | '),
                actual: String(value),
            });
        }
    }

    private registerIdAt(path: string, id: string): void {
        if (!id) {return;}

        if (this.seenIds.has(id)) {
            this.addError(path, StructuralValidationCodes.DUPLICATE_ID, `Duplicate ID: ${id}`);
        } else {
            this.seenIds.add(id);
        }
    }

    private addError(
        path: string,
        code: string,
        message: string,
        options?: Partial<Pick<ValidationIssue, 'expected' | 'actual' | 'suggestion'>>
    ): void {
        if (this.issues.length >= this.options.maxIssues) {return;}

        this.issues.push(createError(path, code, message, options));

        if (this.options.stopOnFirstError) {
            throw new Error('Validation stopped on first error');
        }
    }

    private addWarning(
        path: string,
        code: string,
        message: string,
        options?: Partial<Pick<ValidationIssue, 'expected' | 'actual' | 'suggestion'>>
    ): void {
        if (this.issues.length >= this.options.maxIssues) {return;}
        this.issues.push(createWarning(path, code, message, options));
    }

    private buildResult(startTime: number, sectionsValidated: string[]): ValidationResult {
        const errorCount = this.issues.filter(i => i.severity === 'error').length;
        const warningCount = this.issues.filter(i => i.severity === 'warning').length;
        const infoCount = this.issues.filter(i => i.severity === 'info').length;

        return {
            valid: errorCount === 0,
            issues: [...this.issues],
            errorCount,
            warningCount,
            infoCount,
            durationMs: performance.now() - startTime,
            sectionsValidated,
        };
    }
}
