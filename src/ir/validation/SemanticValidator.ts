/**
 * IR Semantic Validator
 *
 * Validates semantic integrity of IR documents.
 * Checks for valid references, consistent relationships, and logical correctness.
 *
 * @module ir/validation/semantic
 */

import {
    IRDocument,
    IRAction,
    hasNestedActions,
} from '../types';

import {
    ValidationIssue,
    ValidationResult,
    ValidationOptions,
    DEFAULT_VALIDATION_OPTIONS,
    createError,
    createWarning,
    createInfo,
} from './types';

// =============================================================================
// Validation Codes
// =============================================================================

/**
 * Semantic validation error codes.
 */
export const SemanticValidationCodes = {
    // Reference errors
    INVALID_REF: 'SEM_001',
    BROKEN_REF: 'SEM_002',
    CIRCULAR_REF: 'SEM_003',
    ORPHAN_ELEMENT: 'SEM_004',

    // Dependency errors
    MISSING_DEPENDENCY: 'SEM_010',
    INVALID_RUN_AFTER: 'SEM_011',
    UNREACHABLE_ACTION: 'SEM_012',

    // Connection errors
    UNUSED_CONNECTION: 'SEM_020',
    MISSING_CONNECTION_REF: 'SEM_021',

    // Schema/Map errors
    UNUSED_SCHEMA: 'SEM_030',
    UNUSED_MAP: 'SEM_031',
    MISSING_SCHEMA_REF: 'SEM_032',
    MISSING_MAP_REF: 'SEM_033',

    // Workflow errors
    NO_TRIGGER: 'SEM_040',
    MULTIPLE_TRIGGERS: 'SEM_041',
    NO_ACTIONS: 'SEM_042',

    // Gap errors
    UNRESOLVED_GAP: 'SEM_050',
    GAP_REF_INVALID: 'SEM_051',
} as const;

// =============================================================================
// SemanticValidator Class
// =============================================================================

/**
 * Validates semantic correctness of IR documents.
 *
 * Performs checks for:
 * - Valid references between elements
 * - Consistent run-after dependencies
 * - Reachable actions
 * - Connection usage
 * - Schema and map references
 */
export class SemanticValidator {
    private issues: ValidationIssue[] = [];
    private options: Required<ValidationOptions> = DEFAULT_VALIDATION_OPTIONS;

    // Lookup maps
    private triggerIds = new Set<string>();
    private actionIds = new Set<string>();
    private connectionIds = new Set<string>();
    private schemaIds = new Set<string>();
    private mapIds = new Set<string>();

    /**
     * Validates an IR document's semantic correctness.
     *
     * @param document - The document to validate
     * @param options - Validation options
     * @returns Validation result
     */
    public validate(
        document: IRDocument,
        options: ValidationOptions = {}
    ): ValidationResult {
        const startTime = performance.now();
        this.issues = [];
        this.options = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

        const sectionsValidated: string[] = [];

        try {
            // Build lookup maps
            this.buildLookupMaps(document);

            // Validate workflow structure
            if (this.shouldValidateSection('workflow')) {
                this.validateWorkflowStructure(document);
                sectionsValidated.push('workflow');
            }

            // Validate action dependencies
            if (this.shouldValidateSection('actions')) {
                this.validateActionDependencies(document);
                this.validateActionReachability(document);
                sectionsValidated.push('action-dependencies');
            }

            // Validate connection references
            if (this.shouldValidateSection('connections')) {
                this.validateConnectionReferences(document);
                sectionsValidated.push('connections');
            }

            // Validate schema references
            if (this.shouldValidateSection('schemas')) {
                this.validateSchemaReferences(document);
                sectionsValidated.push('schemas');
            }

            // Validate map references
            if (this.shouldValidateSection('maps')) {
                this.validateMapReferences(document);
                sectionsValidated.push('maps');
            }

            // Validate gap references
            if (this.shouldValidateSection('gaps')) {
                this.validateGapReferences(document);
                sectionsValidated.push('gaps');
            }
        } catch (error) {
            this.addError(
                '$',
                SemanticValidationCodes.INVALID_REF,
                `Semantic validation failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        return this.buildResult(startTime, sectionsValidated);
    }

    // =========================================================================
    // Lookup Map Building
    // =========================================================================

    private buildLookupMaps(document: IRDocument): void {
        this.triggerIds = new Set(document.triggers.map(t => t.id));
        this.actionIds = new Set(document.actions.map(a => a.id));
        this.connectionIds = new Set(document.connections.map(c => c.id));
        this.schemaIds = new Set(document.schemas.map(s => s.id));
        this.mapIds = new Set(document.maps.map(m => m.id));
    }

    // =========================================================================
    // Workflow Structure Validation
    // =========================================================================

    private validateWorkflowStructure(document: IRDocument): void {
        // Check for triggers
        if (document.triggers.length === 0 && !this.options.allowPartial) {
            this.addWarning(
                '$.triggers',
                SemanticValidationCodes.NO_TRIGGER,
                'Workflow has no triggers defined'
            );
        }

        // Check for multiple HTTP triggers (common mistake)
        const httpTriggers = document.triggers.filter(t => t.type === 'http');
        if (httpTriggers.length > 1) {
            this.addInfo(
                '$.triggers',
                SemanticValidationCodes.MULTIPLE_TRIGGERS,
                `Workflow has ${httpTriggers.length} HTTP triggers. Consider using a single trigger with routing.`
            );
        }

        // Check for actions
        if (document.actions.length === 0 && document.triggers.length > 0 && !this.options.allowPartial) {
            this.addWarning(
                '$.actions',
                SemanticValidationCodes.NO_ACTIONS,
                'Workflow has triggers but no actions defined'
            );
        }
    }

    // =========================================================================
    // Action Dependency Validation
    // =========================================================================

    private validateActionDependencies(document: IRDocument): void {
        for (let i = 0; i < document.actions.length; i++) {
            const action = document.actions[i];
            const path = `$.actions[${i}]`;

            // Check runAfter references
            if (action.runAfter) {
                for (const [refId, states] of Object.entries(action.runAfter)) {
                    // Check if reference exists
                    if (!this.triggerIds.has(refId) && !this.actionIds.has(refId)) {
                        this.addError(
                            `${path}.runAfter.${refId}`,
                            SemanticValidationCodes.BROKEN_REF,
                            `Invalid runAfter reference: ${refId} does not exist`,
                            { suggestion: 'Ensure the referenced trigger or action ID exists' }
                        );
                    }

                    // Check for self-reference
                    if (refId === action.id) {
                        this.addError(
                            `${path}.runAfter.${refId}`,
                            SemanticValidationCodes.CIRCULAR_REF,
                            'Action cannot reference itself in runAfter'
                        );
                    }

                    // Validate states
                    const validStates = ['Succeeded', 'Failed', 'Skipped', 'TimedOut'];
                    for (const state of states) {
                        if (!validStates.includes(state)) {
                            this.addWarning(
                                `${path}.runAfter.${refId}`,
                                SemanticValidationCodes.INVALID_RUN_AFTER,
                                `Invalid runAfter state: ${state}`,
                                { expected: validStates.join(' | ') }
                            );
                        }
                    }
                }
            }

            // Check nested action references for control flow actions
            if (hasNestedActions(action)) {
                this.validateNestedActionRefs(action, path);
            }
        }
    }

    private validateNestedActionRefs(action: IRAction, basePath: string): void {
        // Handle different control flow action types
        const actionRecord = action as unknown as Record<string, unknown>;

        // Check 'actions' array
        if ('actions' in actionRecord && Array.isArray(actionRecord.actions)) {
            for (const nestedId of actionRecord.actions as string[]) {
                if (!this.actionIds.has(nestedId)) {
                    this.addError(
                        `${basePath}.actions`,
                        SemanticValidationCodes.BROKEN_REF,
                        `Invalid nested action reference: ${nestedId} does not exist`
                    );
                }
            }
        }

        // Check 'branches' object
        if ('branches' in actionRecord && typeof actionRecord.branches === 'object') {
            const branches = actionRecord.branches as Record<string, { actions?: string[] }>;
            for (const [branchName, branch] of Object.entries(branches)) {
                if (branch?.actions) {
                    for (const nestedId of branch.actions) {
                        if (!this.actionIds.has(nestedId)) {
                            this.addError(
                                `${basePath}.branches.${branchName}.actions`,
                                SemanticValidationCodes.BROKEN_REF,
                                `Invalid nested action reference: ${nestedId} does not exist`
                            );
                        }
                    }
                }
            }
        }

        // Check 'cases' object (for switch actions)
        if ('cases' in actionRecord && typeof actionRecord.cases === 'object') {
            const cases = actionRecord.cases as Record<string, { actions?: string[] }>;
            for (const [caseName, caseValue] of Object.entries(cases)) {
                if (caseValue?.actions) {
                    for (const nestedId of caseValue.actions) {
                        if (!this.actionIds.has(nestedId)) {
                            this.addError(
                                `${basePath}.cases.${caseName}.actions`,
                                SemanticValidationCodes.BROKEN_REF,
                                `Invalid nested action reference: ${nestedId} does not exist`
                            );
                        }
                    }
                }
            }
        }
    }

    private validateActionReachability(document: IRDocument): void {
        // Build graph of action dependencies
        const reachable = new Set<string>();

        // Triggers are always reachable entry points
        for (const trigger of document.triggers) {
            reachable.add(trigger.id);
        }

        // Find actions directly after triggers
        for (const action of document.actions) {
            if (!action.runAfter || Object.keys(action.runAfter).length === 0) {
                // Actions with no runAfter are reachable (run after triggers)
                reachable.add(action.id);
            } else {
                // Check if any runAfter target is a trigger
                for (const refId of Object.keys(action.runAfter)) {
                    if (this.triggerIds.has(refId)) {
                        reachable.add(action.id);
                        break;
                    }
                }
            }
        }

        // Propagate reachability
        let changed = true;
        while (changed) {
            changed = false;
            for (const action of document.actions) {
                if (reachable.has(action.id)) {continue;}

                if (action.runAfter) {
                    for (const refId of Object.keys(action.runAfter)) {
                        if (reachable.has(refId)) {
                            reachable.add(action.id);
                            changed = true;
                            break;
                        }
                    }
                }
            }
        }

        // Report unreachable actions
        for (let i = 0; i < document.actions.length; i++) {
            const action = document.actions[i];
            if (!reachable.has(action.id)) {
                this.addWarning(
                    `$.actions[${i}]`,
                    SemanticValidationCodes.UNREACHABLE_ACTION,
                    `Action '${action.name}' (${action.id}) is not reachable from any trigger`,
                    { suggestion: 'Check runAfter dependencies or add this action to a control flow branch' }
                );
            }
        }
    }

    // =========================================================================
    // Connection Reference Validation
    // =========================================================================

    private validateConnectionReferences(document: IRDocument): void {
        const usedConnections = new Set<string>();

        // Check triggers for connection references
        for (let i = 0; i < document.triggers.length; i++) {
            const trigger = document.triggers[i] as unknown as Record<string, unknown>;
            const config = trigger.config as Record<string, unknown> | undefined;

            if (config?.connectionRef) {
                const refId = this.extractRefId(config.connectionRef as string);
                if (refId) {
                    usedConnections.add(refId);
                    if (!this.connectionIds.has(refId)) {
                        this.addError(
                            `$.triggers[${i}].config.connectionRef`,
                            SemanticValidationCodes.MISSING_CONNECTION_REF,
                            `Invalid connection reference: ${refId} does not exist`
                        );
                    }
                }
            }
        }

        // Check actions for connection references
        for (let i = 0; i < document.actions.length; i++) {
            const action = document.actions[i] as unknown as Record<string, unknown>;
            const config = action.config as Record<string, unknown> | undefined;

            if (config?.connectionRef) {
                const refId = this.extractRefId(config.connectionRef as string);
                if (refId) {
                    usedConnections.add(refId);
                    if (!this.connectionIds.has(refId)) {
                        this.addError(
                            `$.actions[${i}].config.connectionRef`,
                            SemanticValidationCodes.MISSING_CONNECTION_REF,
                            `Invalid connection reference: ${refId} does not exist`
                        );
                    }
                }
            }
        }

        // Report unused connections
        for (let i = 0; i < document.connections.length; i++) {
            const connection = document.connections[i];
            if (!usedConnections.has(connection.id)) {
                this.addInfo(
                    `$.connections[${i}]`,
                    SemanticValidationCodes.UNUSED_CONNECTION,
                    `Connection '${connection.name}' (${connection.id}) is not referenced by any trigger or action`
                );
            }
        }
    }

    // =========================================================================
    // Schema Reference Validation
    // =========================================================================

    private validateSchemaReferences(document: IRDocument): void {
        const usedSchemas = new Set<string>();

        // Check maps for schema references
        for (let i = 0; i < document.maps.length; i++) {
            const map = document.maps[i];

            if (map.source?.schemaRef) {
                const refId = this.extractRefId(map.source.schemaRef);
                if (refId) {
                    usedSchemas.add(refId);
                    if (!this.schemaIds.has(refId)) {
                        this.addWarning(
                            `$.maps[${i}].source.schemaRef`,
                            SemanticValidationCodes.MISSING_SCHEMA_REF,
                            `Invalid schema reference: ${refId} does not exist`
                        );
                    }
                }
            }

            if (map.target?.schemaRef) {
                const refId = this.extractRefId(map.target.schemaRef);
                if (refId) {
                    usedSchemas.add(refId);
                    if (!this.schemaIds.has(refId)) {
                        this.addWarning(
                            `$.maps[${i}].target.schemaRef`,
                            SemanticValidationCodes.MISSING_SCHEMA_REF,
                            `Invalid schema reference: ${refId} does not exist`
                        );
                    }
                }
            }
        }

        // Report unused schemas
        for (let i = 0; i < document.schemas.length; i++) {
            const schema = document.schemas[i];
            if (!usedSchemas.has(schema.id)) {
                this.addInfo(
                    `$.schemas[${i}]`,
                    SemanticValidationCodes.UNUSED_SCHEMA,
                    `Schema '${schema.name}' (${schema.id}) is not referenced by any map`
                );
            }
        }
    }

    // =========================================================================
    // Map Reference Validation
    // =========================================================================

    private validateMapReferences(document: IRDocument): void {
        const usedMaps = new Set<string>();

        // Check actions for map references (transform actions)
        for (let i = 0; i < document.actions.length; i++) {
            const action = document.actions[i];
            if (action.type === 'transform') {
                const config = (action as unknown as { config?: { mapRef?: string } }).config;
                if (config?.mapRef) {
                    const refId = this.extractRefId(config.mapRef);
                    if (refId) {
                        usedMaps.add(refId);
                        if (!this.mapIds.has(refId)) {
                            this.addError(
                                `$.actions[${i}].config.mapRef`,
                                SemanticValidationCodes.MISSING_MAP_REF,
                                `Invalid map reference: ${refId} does not exist`
                            );
                        }
                    }
                }
            }
        }

        // Report unused maps
        for (let i = 0; i < document.maps.length; i++) {
            const map = document.maps[i];
            if (!usedMaps.has(map.id)) {
                this.addInfo(
                    `$.maps[${i}]`,
                    SemanticValidationCodes.UNUSED_MAP,
                    `Map '${map.name}' (${map.id}) is not referenced by any transform action`
                );
            }
        }
    }

    // =========================================================================
    // Gap Reference Validation
    // =========================================================================

    private validateGapReferences(document: IRDocument): void {
        for (let i = 0; i < document.gaps.length; i++) {
            const gap = document.gaps[i];
            const path = `$.gaps[${i}]`;

            // Check affected elements references
            if (gap.affectedElements) {
                for (const elementRef of gap.affectedElements) {
                    const refId = this.extractRefId(elementRef);
                    if (refId && !this.isValidElementRef(refId)) {
                        this.addWarning(
                            `${path}.affectedElements`,
                            SemanticValidationCodes.GAP_REF_INVALID,
                            `Invalid element reference in gap: ${elementRef}`
                        );
                    }
                }
            }

            // Check for unresolved high-severity gaps
            if (gap.severity === 'high' || gap.severity === 'critical') {
                if (gap.status === 'pending' && !gap.resolution) {
                    this.addWarning(
                        path,
                        SemanticValidationCodes.UNRESOLVED_GAP,
                        `High-severity gap '${gap.title}' has no resolution defined`,
                        { suggestion: 'Define a resolution strategy for critical gaps' }
                    );
                }
            }
        }
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

    private extractRefId(ref: string): string | null {
        if (!ref) {return null;}

        // Handle JSON pointer format: #/section/id
        if (ref.startsWith('#/')) {
            const parts = ref.split('/');
            return parts[parts.length - 1] || null;
        }

        // Handle direct ID reference
        return ref;
    }

    private isValidElementRef(refId: string): boolean {
        return (
            this.triggerIds.has(refId) ||
            this.actionIds.has(refId) ||
            this.connectionIds.has(refId) ||
            this.schemaIds.has(refId) ||
            this.mapIds.has(refId)
        );
    }

    private addError(
        path: string,
        code: string,
        message: string,
        options?: Partial<Pick<ValidationIssue, 'expected' | 'actual' | 'suggestion'>>
    ): void {
        if (this.issues.length >= this.options.maxIssues) {return;}
        this.issues.push(createError(path, code, message, options));
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

    private addInfo(
        path: string,
        code: string,
        message: string,
        options?: Partial<Pick<ValidationIssue, 'expected' | 'actual' | 'suggestion'>>
    ): void {
        if (this.issues.length >= this.options.maxIssues) {return;}
        this.issues.push(createInfo(path, code, message, options));
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
