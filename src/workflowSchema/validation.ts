/**
 * Workflow Definition Schema Validation
 *
 * Runtime validation of Logic Apps Standard workflow definitions against
 * the constraints from `workflowDefinitionSchema.json`.
 *
 * @module workflowSchema/validation
 */

// =============================================================================
// Valid enum values (from the schema)
// =============================================================================

const VALID_ACTION_TYPES = new Set([
    // ── Base action types (Flow.Data.Common) ──
    'Http',
    'HttpWebhook',
    'ApiConnection',
    'ApiConnectionWebhook',
    'Wait',
    'Response',
    'Compose',
    'Query',
    'Scope',
    'If',
    'Foreach',
    'Until',
    'Terminate',
    'Switch',
    'ParseJson',
    'Table',
    'Join',
    'Select',
    'InitializeVariable',
    'IncrementVariable',
    'DecrementVariable',
    'SetVariable',
    'AppendToArrayVariable',
    'AppendToStringVariable',
    'Expression',
    'ArchiveZip',
    'SendToBatch',
    'As2Decode',
    'As2Encode',
    'InvokeFunction',
    'IntegrationAccountArtifactLookup',
    'RosettaNetEncode',
    'RosettaNetDecode',
    'RosettaNetWaitForResponse',
    'OpenApiConnection',
    'OpenApiConnectionWebhook',
    'OpenApiConnectionNotification',
    'Workflow',
    'Xslt',
    'XmlValidation',
    'Liquid',
    'FlatFileDecoding',
    'FlatFileEncoding',
    'JavaScriptCode',
    'ApiManagement',
    'Function',
    'XmlParse',
    'XmlCompose',
    'ChunkText',
    'NestedAgent',
    'Agent',
    'ParseDocument',
    'ParseDocumentWithMetadata',
    'ChunkTextWithMetadata',
    // ── Consumption (Cloud) additional types ──
    'ApiApp',
    'Changeset',
    'SwiftEncode',
    'SwiftDecode',
    'AgentHandOff',
    // ── Standard (Edge) additional types ──
    'ServiceProvider',
    'CSharpScriptCode',
    'PowershellCode',
    'SwiftMTDecode',
    'SwiftMTEncode',
    'X12Encode',
    'X12BatchEncode',
    'X12Decode',
    'EdifactEncode',
    'EdifactBatchEncode',
    'EdifactDecode',
    'HL7Encode',
    'HL7Decode',
    // ── Legacy / callback-mapped types ──
    'Flow',
    'McpClientTool',
]);

const VALID_TRIGGER_TYPES = new Set([
    // ── Base trigger types (Flow.Data.Common) ──
    'Manual',
    'Http',
    'HttpWebhook',
    'Recurrence',
    'Request',
    'SlidingWindow',
    'ApiConnection',
    'ApiConnectionNotification',
    'ApiConnectionWebhook',
    'Batch',
    'OpenApiConnection',
    'OpenApiConnectionWebhook',
    'OpenApiConnectionNotification',
    // ── Consumption (Cloud) additional types ──
    'ApiApp',
    'ApiManagement',
    // ── Standard (Edge) additional types ──
    'ServiceProvider',
]);

const VALID_RUN_AFTER_STATUSES = new Set([
    'Aborted',
    'Cancelled',
    'Failed',
    'Faulted',
    'Ignored',
    'Paused',
    'Running',
    'Skipped',
    'Succeeded',
    'Suspended',
    'TimedOut',
    'Waiting',
]);

const CONTENT_VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

const EXPECTED_SCHEMA_URL =
    'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#';

// =============================================================================
// Validation result
// =============================================================================

export interface WorkflowValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Validate a workflow definition object against the Logic Apps schema.
 *
 * Returns a result with `valid: true` if no errors were found.
 * Errors are blocking issues; warnings are informational.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateWorkflowDefinition(def: any): WorkflowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!def || typeof def !== 'object') {
        return {
            valid: false,
            errors: ['workflowDefinition must be a non-null object.'],
            warnings,
        };
    }

    // ── Required top-level fields ────────────────────────────────────────

    if (!def.$schema) {
        errors.push('Missing required field "$schema". Set to: "' + EXPECTED_SCHEMA_URL + '"');
    } else if (typeof def.$schema !== 'string') {
        errors.push('"$schema" must be a string.');
    } else if (def.$schema !== EXPECTED_SCHEMA_URL) {
        warnings.push(
            `"$schema" value "${def.$schema}" differs from expected "${EXPECTED_SCHEMA_URL}".`
        );
    }

    if (!def.contentVersion) {
        errors.push(
            'Missing required field "contentVersion". Use a 4-digit version string, e.g. "1.0.0.0".'
        );
    } else if (typeof def.contentVersion !== 'string') {
        errors.push('"contentVersion" must be a string (e.g. "1.0.0.0").');
    } else if (!CONTENT_VERSION_PATTERN.test(def.contentVersion)) {
        errors.push(
            `"contentVersion" "${def.contentVersion}" does not match required pattern "X.X.X.X" (e.g. "1.0.0.0").`
        );
    }

    // ── At least one trigger or action ───────────────────────────────────

    const hasActions =
        def.actions && typeof def.actions === 'object' && Object.keys(def.actions).length > 0;
    const hasTriggers =
        def.triggers && typeof def.triggers === 'object' && Object.keys(def.triggers).length > 0;

    if (!hasActions && !hasTriggers) {
        errors.push(
            'Workflow definition must contain at least one trigger or action. Add "triggers" and/or "actions" objects.'
        );
    }

    // ── Validate triggers ────────────────────────────────────────────────

    if (def.triggers && typeof def.triggers === 'object') {
        for (const [triggerName, trigger] of Object.entries(def.triggers)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const t = trigger as any;
            if (!t || typeof t !== 'object') {
                errors.push(`Trigger "${triggerName}": must be an object.`);
                continue;
            }
            if (!t.type) {
                errors.push(
                    `Trigger "${triggerName}": missing required field "type". Valid types: ${[...VALID_TRIGGER_TYPES].join(', ')}.`
                );
            } else if (typeof t.type !== 'string') {
                errors.push(`Trigger "${triggerName}": "type" must be a string.`);
            } else if (!VALID_TRIGGER_TYPES.has(t.type)) {
                warnings.push(
                    `Trigger "${triggerName}": type "${t.type}" is not a standard trigger type. Valid types: ${[...VALID_TRIGGER_TYPES].join(', ')}.`
                );
            }
        }
    }

    // ── Validate actions (recursive) ─────────────────────────────────────

    if (def.actions && typeof def.actions === 'object') {
        validateActions(def.actions, '', errors, warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// Internal helpers
// =============================================================================

function validateActions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: Record<string, any>,
    parentPath: string,
    errors: string[],
    warnings: string[]
): void {
    for (const [actionName, action] of Object.entries(actions)) {
        const path = parentPath ? `${parentPath} > ${actionName}` : actionName;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = action as any;

        if (!a || typeof a !== 'object') {
            errors.push(`Action "${path}": must be an object.`);
            continue;
        }

        // type is required per schema
        if (!a.type) {
            errors.push(
                `Action "${path}": missing required field "type". Valid types: ${[...VALID_ACTION_TYPES].join(', ')}.`
            );
        } else if (typeof a.type !== 'string') {
            errors.push(`Action "${path}": "type" must be a string.`);
        } else if (!VALID_ACTION_TYPES.has(a.type)) {
            warnings.push(
                `Action "${path}": type "${a.type}" is not a standard action type. Valid types: ${[...VALID_ACTION_TYPES].join(', ')}.`
            );
        }

        // Validate runAfter statuses
        if (a.runAfter && typeof a.runAfter === 'object') {
            for (const [depName, statuses] of Object.entries(a.runAfter)) {
                if (!Array.isArray(statuses)) {
                    errors.push(
                        `Action "${path}": runAfter["${depName}"] must be an array of status strings.`
                    );
                    continue;
                }
                for (const status of statuses) {
                    if (typeof status !== 'string' || !VALID_RUN_AFTER_STATUSES.has(status)) {
                        errors.push(
                            `Action "${path}": runAfter["${depName}"] contains invalid status "${status}". Valid: ${[...VALID_RUN_AFTER_STATUSES].join(', ')}.`
                        );
                    }
                }
            }
        }

        // Recurse into nested action containers
        if (a.actions && typeof a.actions === 'object') {
            validateActions(a.actions, path, errors, warnings);
        }
        if (a.else?.actions && typeof a.else.actions === 'object') {
            validateActions(a.else.actions, `${path} > [else]`, errors, warnings);
        }
        if (a.default?.actions && typeof a.default.actions === 'object') {
            validateActions(a.default.actions, `${path} > [default]`, errors, warnings);
        }
        if (a.cases && typeof a.cases === 'object') {
            for (const [caseName, caseBranch] of Object.entries(a.cases)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cb = caseBranch as any;
                if (cb?.actions && typeof cb.actions === 'object') {
                    validateActions(cb.actions, `${path} > [case:${caseName}]`, errors, warnings);
                }
            }
        }
    }
}
