/**
 * Migration Language Model Tools
 *
 * Registers VS Code LM Tools (`vscode.lm.registerTool`) that give the
 * @migration chat participant's underlying model **on-demand** access
 * to the workspace's integration artifacts.  Instead of stuffing the
 * entire artifact inventory into every prompt, the model calls these
 * tools when it needs data, keeping prompts small and focused.
 *
 * Tools:
 *   migration_listArtifacts   — List all discovered artifacts (name, type, id)
 *   migration_getArtifactDetails — Get rich IR metadata for one or more artifacts
 *   migration_readSourceFile  — Read raw source file contents of an artifact
 *   migration_searchArtifacts — Search artifacts by name, type, schema, endpoint
 *
 * @module copilot/MigrationLMTools
 */

import * as vscode from 'vscode';
import { InventoryService } from '../stages/discovery/InventoryService';
import { ParsedArtifact } from '../stages/discovery/types';
import { LoggingService } from '../services/LoggingService';
import { ContextBuilder, ContextScope } from './ContextBuilder';
import { SourceFlowVisualizer } from '../views/discovery/SourceFlowVisualizer';
import { GeneratedFlowResult, LLMFlowGenerator, FlowGroup } from '../services/LLMFlowGenerator';
import { ReferenceDocRegistry } from '../services/ReferenceDocRegistry';
import { ReferenceWorkflowRegistry } from '../services/ReferenceWorkflowRegistry';
import { PlanningCacheService, FlowPlanningResult } from '../stages/planning/PlanningCacheService';
import { PlanningService } from '../stages/planning/PlanningService';
import { PlanningFileService, PLANNING_FILES } from '../stages/planning/PlanningFileService';
import { validateWorkflowDefinition } from '../workflowSchema';
import { ConversionService } from '../stages/conversion/ConversionService';
import { ConversionFileService } from '../stages/conversion/ConversionFileService';
import { MermaidValidationService } from '../services/MermaidValidationService';
import type { ConversionTask, ConversionTaskOutput } from '../stages/conversion/types';

// ============================================================================
// Tool Input Types
// ============================================================================

interface ListArtifactsInput {
    category?: string;
    limit?: number;
}

interface GetArtifactDetailsInput {
    artifactIds: string[];
}

interface ReadSourceFileInput {
    artifactId: string;
    maxChars?: number;
}

interface SearchArtifactsInput {
    query: string;
    searchIn?: ('name' | 'schema' | 'endpoint' | 'map' | 'connection')[];
}

interface GetMigrationContextInput {
    scope?: 'minimal' | 'standard' | 'full';
}

interface DetectFlowGroupsInput {
    /** Optional: If provided, return cached data for this specific flow group */
    groupId?: string;
}

interface ReadReferenceDocInput {
    action: 'list' | 'read' | 'search';
    docId?: string;
    platform?: string;
    category?: string;
    query?: string;
}

interface SearchReferenceWorkflowsInput {
    /** Search query — matches against action types, trigger types, connector IDs, folder names, tags */
    query: string;
    /** Optional category filter */
    category?: 'workflow' | 'connection';
    /** Max results to return (default: 10) */
    limit?: number;
}

interface ReadReferenceWorkflowInput {
    /** Catalog entry ID (e.g. 'workflows/PurchaseOrder', 'connections/ServiceBusServiceProvider', 'ServiceProviders/v4/ServiceBusTrigger') */
    entryId: string;
    /** For entries with multiple files, specify which file to read */
    fileName?: string;
}

interface GetDiscoveryAnalysisInput {
    /** The flow group ID to retrieve discovery analysis for */
    groupId: string;
    /** Which aspects of the analysis to return. Defaults to all. */
    aspects?: ('architecture' | 'messageFlow' | 'components' | 'gaps' | 'patterns')[];
}

interface StoreFlowGroupsInput {
    /** Array of flow groups detected from the artifact connection graph */
    groups: {
        id: string;
        name: string;
        description: string;
        category?: string;
        artifactIds: string[];
        entryPoint?: { type: string; name: string; messageType?: string };
        exitPoints?: { type: string; name: string; messageType?: string }[];
    }[];
    /** IDs of artifacts not belonging to any group */
    ungroupedArtifactIds?: string[];
    /** Explanation of how groups were determined */
    explanation?: string;
}

// ============================================================================
// Discovery Multi-Step Tool Inputs
// ============================================================================

interface DiscoveryStoreMetaInput {
    /** Flow group ID this analysis belongs to */
    flowId: string;
    /** Plain-language explanation of the architecture */
    explanation?: string;
    /** Summary of components by type */
    summary?: Record<string, unknown>;
    /** Title for the visualization */
    title?: string;
    /** Additional notes */
    notes?: string[];
}

interface DiscoveryStoreArchitectureInput {
    /** Flow group ID */
    flowId: string;
    /** Mermaid flowchart TB diagram string */
    mermaid: string;
}

interface DiscoveryStoreMessageFlowInput {
    /** Flow group ID */
    flowId: string;
    /** Array of message flow steps */
    messageFlow: Record<string, unknown>[];
}

interface DiscoveryStoreComponentsInput {
    /** Flow group ID */
    flowId: string;
    /** Array of component details */
    componentDetails: Record<string, unknown>[];
}

interface DiscoveryStoreGapsInput {
    /** Flow group ID */
    flowId: string;
    /** Array of gap analysis entries */
    gapAnalysis: Record<string, unknown>[];
}

interface DiscoveryStorePatternsInput {
    /** Flow group ID */
    flowId: string;
    /** Array of migration pattern entries */
    migrationPatterns: Record<string, unknown>[];
}

interface DiscoveryStoreDependenciesInput {
    /** Flow group ID */
    flowId: string;
    /** Array of missing dependency entries */
    missingDependencies: Record<string, unknown>[];
    /** Overall health summary */
    summary?: string;
    /** Whether all critical dependencies are resolved */
    allCriticalResolved?: boolean;
    /** Count by severity */
    counts?: { critical: number; warning: number; info: number };
}

interface DiscoveryFinalizeInput {
    /** Flow group ID to finalize */
    flowId: string;
}

// ============================================================================
// Planning File Tool Inputs (multi-file architecture)
// ============================================================================

interface PlanningStoreMetaInput {
    flowId: string;
    flowName: string;
    explanation: string;
    summary: string;
}

interface PlanningStoreArchitectureInput {
    flowId: string;
    mermaid: string;
}

interface PlanningStoreWorkflowDefinitionInput {
    flowId: string;
    name: string;
    description: string;
    triggerType: string;
    actions?: string[];
    sourceArtifactIds?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workflowDefinition: Record<string, any>;
    /** Per-workflow Mermaid architecture diagram */
    mermaid?: string;
}

interface PlanningStoreAzureComponentsInput {
    flowId: string;
    components: {
        name: string;
        type: string;
        reason: string;
        configNotes?: string;
    }[];
}

interface PlanningStoreActionMappingsInput {
    flowId: string;
    mappings: {
        source: string;
        target: string;
        notes?: string;
        /** Which workflow this mapping belongs to (for multi-workflow views) */
        workflowName?: string;
    }[];
}

interface PlanningStoreGapsInput {
    flowId: string;
    gaps: {
        component: string;
        gap: string;
        severity: 'high' | 'medium' | 'low';
        recommendation: string;
    }[];
}

interface PlanningStorePatternsInput {
    flowId: string;
    patterns: {
        name: string;
        sourceApproach: string;
        logicAppsApproach: string;
        complexity: 'high' | 'medium' | 'low';
    }[];
}

interface PlanningFinalizeInput {
    flowId: string;
    flowName?: string;
}

interface PlanningStoreArtifactDispositionsInput {
    flowId: string;
    dispositions: {
        artifactName: string;
        artifactType: string;
        conversionRequired: boolean;
        conversionFrom?: string;
        conversionTo?: string;
        conversionNotes?: string;
        uploadDestination:
            | 'integration-account'
            | 'logic-app-artifact-folder'
            | 'azure-function'
            | 'not-applicable';
        uploadPath?: string;
        uploadNotes?: string;
    }[];
}

// Conversion Tool Inputs
interface ConversionGetPlanningResultsInput {
    flowId: string;
}

interface ConversionStoreTaskPlanInput {
    flowId: string;
    flowName?: string;
    summary: string;
    prerequisites?: string[];
    tasks: {
        id: string;
        type: string;
        name: string;
        description: string;
        executionPrompt?: string;
        dependsOn: string[];
        order: number;
        artifactIds?: string[];
        estimatedMinutes?: number;
    }[];
}

interface ConversionStoreTaskOutputInput {
    flowId: string;
    taskId: string;
    summary: string;
    generatedFiles?: string[];
    warnings?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
}

interface ConversionFinalizeInput {
    flowId: string;
}

// ============================================================================
// Helper: Compact Artifact Summary
// ============================================================================

function buildCompactSummary(a: ParsedArtifact): Record<string, unknown> {
    const summary: Record<string, unknown> = {
        id: a.id,
        name: a.name,
        type: a.type,
        sourcePath: a.sourcePath,
    };

    // Schemas
    if (a.ir.schemas && a.ir.schemas.length > 0) {
        summary.schemas = a.ir.schemas.map((s) => ({
            name: s.name,
            targetNamespace: s.targetNamespace,
        }));
    }

    // Endpoints
    if (a.ir.endpoints?.receive && a.ir.endpoints.receive.length > 0) {
        summary.receiveEndpoints = a.ir.endpoints.receive.map((ep) => ({
            name: ep.name,
            transport: ep.transport,
        }));
    }
    if (a.ir.endpoints?.send && a.ir.endpoints.send.length > 0) {
        summary.sendEndpoints = a.ir.endpoints.send.map((ep) => {
            const result: Record<string, unknown> = { name: ep.name };
            if ('transport' in ep) {
                result.transport = (ep as { transport: string }).transport;
            }
            return result;
        });
    }

    // Maps
    if (a.ir.maps && a.ir.maps.length > 0) {
        summary.maps = a.ir.maps.map((m) => ({
            source: m.source?.schemaRef,
            target: m.target?.schemaRef,
        }));
    }

    // Triggers
    if (a.ir.triggers && a.ir.triggers.length > 0) {
        summary.triggers = a.ir.triggers.map((t) => ({
            type: t.type,
            name: t.name,
        }));
    }

    // Connections
    if (a.ir.connections && a.ir.connections.length > 0) {
        summary.connections = a.ir.connections.map((c) => ({
            type: c.type,
            name: c.name,
        }));
    }

    // Actions (top-level summary)
    if (a.ir.actions && a.ir.actions.length > 0) {
        summary.actionCount = a.ir.actions.length;
        summary.actionTypes = [...new Set(a.ir.actions.map((act) => act.type))];
    }

    return summary;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeValueShape(value: unknown): string {
    if (Array.isArray(value)) {
        return 'array';
    }
    if (value === null) {
        return 'null';
    }
    return typeof value;
}

function getMessageFlowStepLabel(step: Record<string, unknown>, index: number): string {
    const stepNumber = typeof step.step === 'number' ? step.step : index + 1;
    const componentName =
        typeof step.component === 'string' && step.component.trim().length > 0
            ? ` (${step.component.trim()})`
            : '';
    return `step ${stepNumber}${componentName}`;
}

function validateMessageFlowStepShape(step: unknown, index: number): string[] {
    if (!isPlainObject(step)) {
        return [`messageFlow[${index}] must be an object, not ${describeValueShape(step)}.`];
    }

    const label = getMessageFlowStepLabel(step, index);
    const issues: string[] = [];

    if (typeof step.step !== 'number' || Number.isNaN(step.step)) {
        issues.push(`${label}: "step" must be a number.`);
    }
    if (typeof step.component !== 'string' || step.component.trim().length === 0) {
        issues.push(`${label}: "component" must be a non-empty string.`);
    }
    if (typeof step.componentType !== 'string' || step.componentType.trim().length === 0) {
        issues.push(`${label}: "componentType" must be a non-empty string.`);
    }
    if (typeof step.action !== 'string' || step.action.trim().length === 0) {
        issues.push(`${label}: "action" must be a non-empty string.`);
    }
    if (typeof step.description !== 'string' || step.description.trim().length === 0) {
        issues.push(`${label}: "description" must be a non-empty string.`);
    }
    if (step.messageType !== undefined && typeof step.messageType !== 'string') {
        issues.push(`${label}: "messageType" must be a string when provided.`);
    }

    if (step.pipelineComponents !== undefined) {
        if (!Array.isArray(step.pipelineComponents)) {
            issues.push(`${label}: "pipelineComponents" must be an array.`);
        } else {
            step.pipelineComponents.forEach((component, componentIndex) => {
                if (!isPlainObject(component)) {
                    issues.push(
                        `${label}: pipelineComponents[${componentIndex}] must be an object, not ${describeValueShape(component)}.`
                    );
                    return;
                }

                if (typeof component.name !== 'string' || component.name.trim().length === 0) {
                    issues.push(
                        `${label}: pipelineComponents[${componentIndex}].name must be a non-empty string.`
                    );
                }
                if (typeof component.stage !== 'string' || component.stage.trim().length === 0) {
                    issues.push(
                        `${label}: pipelineComponents[${componentIndex}].stage must be a non-empty string.`
                    );
                }
                if (
                    typeof component.description !== 'string' ||
                    component.description.trim().length === 0
                ) {
                    issues.push(
                        `${label}: pipelineComponents[${componentIndex}].description must be a non-empty string.`
                    );
                }
            });
        }
    }

    if (step.properties !== undefined) {
        if (!Array.isArray(step.properties)) {
            issues.push(`${label}: "properties" must be an array.`);
        } else {
            step.properties.forEach((property, propertyIndex) => {
                if (!isPlainObject(property)) {
                    issues.push(
                        `${label}: properties[${propertyIndex}] must be an object, not ${describeValueShape(property)}.`
                    );
                    return;
                }

                if (typeof property.name !== 'string' || property.name.trim().length === 0) {
                    issues.push(
                        `${label}: properties[${propertyIndex}].name must be a non-empty string.`
                    );
                }
                if (typeof property.type !== 'string' || property.type.trim().length === 0) {
                    issues.push(
                        `${label}: properties[${propertyIndex}].type must be a non-empty string.`
                    );
                }
                if (property.namespace !== undefined && typeof property.namespace !== 'string') {
                    issues.push(
                        `${label}: properties[${propertyIndex}].namespace must be a string when provided.`
                    );
                }
                if (property.source !== undefined && typeof property.source !== 'string') {
                    issues.push(
                        `${label}: properties[${propertyIndex}].source must be a string when provided.`
                    );
                }
                if (property.value !== undefined && typeof property.value !== 'string') {
                    issues.push(
                        `${label}: properties[${propertyIndex}].value must be a string when provided.`
                    );
                }
            });
        }
    }

    if (step.subscriptionFilter !== undefined) {
        if (!isPlainObject(step.subscriptionFilter)) {
            issues.push(`${label}: "subscriptionFilter" must be an object.`);
        } else {
            const hasExpression =
                typeof step.subscriptionFilter.expression === 'string' &&
                step.subscriptionFilter.expression.trim().length > 0;
            const hasReadableExpression =
                typeof step.subscriptionFilter.readableExpression === 'string' &&
                step.subscriptionFilter.readableExpression.trim().length > 0;

            if (!hasExpression && !hasReadableExpression) {
                issues.push(
                    `${label}: "subscriptionFilter" must include "expression" or "readableExpression".`
                );
            }

            if (step.subscriptionFilter.conditions !== undefined) {
                if (!Array.isArray(step.subscriptionFilter.conditions)) {
                    issues.push(`${label}: subscriptionFilter.conditions must be an array.`);
                } else {
                    step.subscriptionFilter.conditions.forEach((condition, conditionIndex) => {
                        if (!isPlainObject(condition)) {
                            issues.push(
                                `${label}: subscriptionFilter.conditions[${conditionIndex}] must be an object, not ${describeValueShape(condition)}.`
                            );
                            return;
                        }

                        if (
                            typeof condition.property !== 'string' ||
                            condition.property.trim().length === 0
                        ) {
                            issues.push(
                                `${label}: subscriptionFilter.conditions[${conditionIndex}].property must be a non-empty string.`
                            );
                        }
                        if (
                            typeof condition.operator !== 'string' ||
                            condition.operator.trim().length === 0
                        ) {
                            issues.push(
                                `${label}: subscriptionFilter.conditions[${conditionIndex}].operator must be a non-empty string.`
                            );
                        }
                        if (typeof condition.value !== 'string') {
                            issues.push(
                                `${label}: subscriptionFilter.conditions[${conditionIndex}].value must be a string.`
                            );
                        }
                    });
                }
            }
        }
    }

    if (step.additionalDetails === undefined) {
        issues.push(
            `${label}: "additionalDetails" is required. Use an object of key/value pairs, or use {} when there are no extra structured details.`
        );
    } else if (!isPlainObject(step.additionalDetails)) {
        const suggestedNote =
            typeof step.additionalDetails === 'string' && step.additionalDetails.trim().length > 0
                ? ` Use additionalDetails: { note: ${JSON.stringify(step.additionalDetails)} } instead, or move that text to "description".`
                : ' Use {} when there are no extra structured details.';
        issues.push(
            `${label}: "additionalDetails" must be an object of key/value pairs, not ${describeValueShape(step.additionalDetails)}.${suggestedNote}`
        );
    }

    return issues;
}

function getMessageFlowCorrectionGuidance(): string {
    return (
        'Each messageFlow step must be an object like ' +
        '{ step: 1, component: "...", componentType: "...", action: "...", description: "...", ' +
        'messageType?: "...", pipelineComponents?: [{ name: "...", stage: "Decode|Disassemble|Validate|ResolveParty|PreAssemble|Assemble|Encode", description: "..." }], ' +
        'properties?: [{ name: "...", type: "promoted|written|demoted", source?: "...", value?: "..." }], ' +
        'subscriptionFilter?: { expression?: "...", readableExpression?: "...", conditions?: [{ property: "...", operator: "...", value: "..." }] }, ' +
        'additionalDetails: { note?: "..." } }. Always include additionalDetails. If there is only one free-text detail, put it in "description" or wrap it as additionalDetails.note. If there are no extra structured details, send additionalDetails: {}.'
    );
}

// ============================================================================
// Component / Gap / Pattern / Dependency Validators
// ============================================================================

function validateComponentShape(comp: unknown, index: number): string[] {
    if (!isPlainObject(comp)) {
        return [`componentDetails[${index}] must be an object, not ${describeValueShape(comp)}.`];
    }
    const label = `componentDetails[${index}]${typeof comp.name === 'string' ? ` (${comp.name})` : ''}`;
    const issues: string[] = [];

    if (typeof comp.id !== 'string' || comp.id.trim().length === 0) {
        issues.push(`${label}: "id" must be a non-empty string.`);
    }
    if (typeof comp.name !== 'string' || comp.name.trim().length === 0) {
        issues.push(`${label}: "name" must be a non-empty string.`);
    }
    if (typeof comp.type !== 'string' || comp.type.trim().length === 0) {
        issues.push(`${label}: "type" must be a non-empty string.`);
    }
    if (typeof comp.description !== 'string' || comp.description.trim().length === 0) {
        issues.push(`${label}: "description" must be a non-empty string.`);
    }
    if (typeof comp.isLogicAppsNative !== 'boolean') {
        issues.push(`${label}: "isLogicAppsNative" must be a boolean (true/false).`);
    }
    if (typeof comp.azureEquivalent !== 'string') {
        issues.push(
            `${label}: "azureEquivalent" must be a plain string describing the Azure equivalent, not ${describeValueShape(comp.azureEquivalent)}. Example: "Stateful Workflow with HTTP Request trigger and built-in HTTP actions".`
        );
    }
    if (comp.connectedTo !== undefined && !Array.isArray(comp.connectedTo)) {
        issues.push(`${label}: "connectedTo" must be an array of component ID strings.`);
    }
    return issues;
}

function validateGapShape(gap: unknown, index: number): string[] {
    if (!isPlainObject(gap)) {
        return [`gapAnalysis[${index}] must be an object, not ${describeValueShape(gap)}.`];
    }
    const label = `gapAnalysis[${index}]${typeof gap.component === 'string' ? ` (${gap.component})` : ''}`;
    const issues: string[] = [];

    if (typeof gap.component !== 'string' || gap.component.trim().length === 0) {
        issues.push(`${label}: "component" must be a non-empty string.`);
    }
    if (typeof gap.componentType !== 'string' || gap.componentType.trim().length === 0) {
        issues.push(`${label}: "componentType" must be a non-empty string.`);
    }
    if (typeof gap.gap !== 'string' || gap.gap.trim().length === 0) {
        issues.push(`${label}: "gap" must be a non-empty string describing the gap.`);
    }
    const validSeverities = ['high', 'medium', 'low'];
    if (typeof gap.severity !== 'string' || !validSeverities.includes(gap.severity)) {
        issues.push(`${label}: "severity" must be one of: ${validSeverities.join(', ')}.`);
    }
    if (!Array.isArray(gap.options)) {
        issues.push(`${label}: "options" must be an array of resolution option strings.`);
    } else {
        gap.options.forEach((o, i) => {
            if (typeof o !== 'string') {
                issues.push(
                    `${label}: options[${i}] must be a string, not ${describeValueShape(o)}.`
                );
            }
        });
    }
    if (typeof gap.recommendation !== 'string' || gap.recommendation.trim().length === 0) {
        issues.push(
            `${label}: "recommendation" must be a plain string, not ${describeValueShape(gap.recommendation)}.`
        );
    }
    return issues;
}

function validatePatternShape(pattern: unknown, index: number): string[] {
    if (!isPlainObject(pattern)) {
        return [
            `migrationPatterns[${index}] must be an object, not ${describeValueShape(pattern)}.`,
        ];
    }
    const label = `migrationPatterns[${index}]${typeof pattern.pattern === 'string' ? ` (${pattern.pattern})` : ''}`;
    const issues: string[] = [];

    if (typeof pattern.pattern !== 'string' || pattern.pattern.trim().length === 0) {
        issues.push(`${label}: "pattern" must be a non-empty string.`);
    }
    if (typeof pattern.description !== 'string' || pattern.description.trim().length === 0) {
        issues.push(`${label}: "description" must be a non-empty string.`);
    }
    const validComplexities = ['high', 'medium', 'low'];
    if (typeof pattern.complexity !== 'string' || !validComplexities.includes(pattern.complexity)) {
        issues.push(`${label}: "complexity" must be one of: ${validComplexities.join(', ')}.`);
    }
    if (
        typeof pattern.biztalkApproach !== 'string' ||
        pattern.biztalkApproach.trim().length === 0
    ) {
        issues.push(`${label}: "biztalkApproach" must be a non-empty string.`);
    }
    if (
        typeof pattern.logicAppsApproach !== 'string' ||
        pattern.logicAppsApproach.trim().length === 0
    ) {
        issues.push(`${label}: "logicAppsApproach" must be a non-empty string.`);
    }
    if (!Array.isArray(pattern.components)) {
        issues.push(`${label}: "components" must be an array of component name strings.`);
    }
    return issues;
}

function validateDependencyShape(dep: unknown, index: number): string[] {
    if (!isPlainObject(dep)) {
        return [`missingDependencies[${index}] must be an object, not ${describeValueShape(dep)}.`];
    }
    const label = `missingDependencies[${index}]${typeof dep.name === 'string' ? ` (${dep.name})` : ''}`;
    const issues: string[] = [];

    if (typeof dep.name !== 'string' || dep.name.trim().length === 0) {
        issues.push(`${label}: "name" must be a non-empty string.`);
    }
    if (typeof dep.type !== 'string' || dep.type.trim().length === 0) {
        issues.push(`${label}: "type" must be a non-empty string.`);
    }
    const validOrigins = [
        'standard-framework',
        'standard-biztalk',
        'standard-platform',
        'third-party',
        'custom',
        'unknown',
    ];
    if (typeof dep.origin !== 'string' || !validOrigins.includes(dep.origin)) {
        issues.push(`${label}: "origin" must be one of: ${validOrigins.join(', ')}.`);
    }
    const validSeverities = ['critical', 'warning', 'info'];
    if (typeof dep.severity !== 'string' || !validSeverities.includes(dep.severity)) {
        issues.push(`${label}: "severity" must be one of: ${validSeverities.join(', ')}.`);
    }
    if (!Array.isArray(dep.referencedBy)) {
        issues.push(`${label}: "referencedBy" must be an array of artifact name strings.`);
    }
    if (typeof dep.reason !== 'string' || dep.reason.trim().length === 0) {
        issues.push(`${label}: "reason" must be a non-empty string.`);
    }
    if (typeof dep.blocksMigration !== 'boolean') {
        issues.push(`${label}: "blocksMigration" must be a boolean.`);
    }
    if (typeof dep.migrationRelevant !== 'boolean') {
        issues.push(`${label}: "migrationRelevant" must be a boolean.`);
    }
    if (typeof dep.resolution !== 'string' || dep.resolution.trim().length === 0) {
        issues.push(
            `${label}: "resolution" must be a non-empty string describing the suggested fix.`
        );
    }
    return issues;
}

// ============================================================================
// Tool Implementations
// ============================================================================

const FLOWCHART_MERMAID_TYPES = ['flowchart', 'flowchart-v2'];

/**
 * migration_listArtifacts — List all discovered artifacts.
 */
class ListArtifactsTool implements vscode.LanguageModelTool<ListArtifactsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ListArtifactsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { category, limit } = options.input;

        const inventoryService = InventoryService.getInstance();
        let artifacts = await inventoryService.getAllParsedArtifacts();

        if (category) {
            artifacts = artifacts.filter((a) => a.type.toLowerCase() === category.toLowerCase());
        }

        // Build compact listing
        const listing = artifacts.slice(0, limit || artifacts.length).map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            sourcePath: a.sourcePath,
            fileSize: a.fileSize,
        }));

        // Also provide category summary
        const categoryCounts: Record<string, number> = {};
        for (const a of artifacts) {
            categoryCounts[a.type] = (categoryCounts[a.type] || 0) + 1;
        }

        const result = {
            totalCount: artifacts.length,
            categoryCounts,
            artifacts: listing,
        };

        logger.info(`[LMTool] migration_listArtifacts: returned ${listing.length} artifacts`);
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
        ]);
    }
}

/**
 * migration_getArtifactDetails — Get rich IR metadata for specific artifacts.
 */
class GetArtifactDetailsTool implements vscode.LanguageModelTool<GetArtifactDetailsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetArtifactDetailsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { artifactIds } = options.input;

        const inventoryService = InventoryService.getInstance();
        const allArtifacts = await inventoryService.getAllParsedArtifacts();
        const idSet = new Set(artifactIds);

        const matched = allArtifacts.filter((a) => idSet.has(a.id));
        const details = matched.map((a) => buildCompactSummary(a));

        logger.info(
            `[LMTool] migration_getArtifactDetails: ${artifactIds.length} requested, ${matched.length} found`
        );

        // Diagnostic: when nothing matches, log sample IDs from both sides
        // so ID mismatches (e.g. stale cache after re-scan) are easy to spot.
        if (matched.length === 0 && artifactIds.length > 0 && allArtifacts.length > 0) {
            logger.warn(
                '[LMTool] migration_getArtifactDetails: ID MISMATCH — requested IDs do not exist in inventory. ' +
                    'This usually means the flow group cache has stale artifact IDs from a previous scan.',
                {
                    requestedSample: artifactIds.slice(0, 3).join(', '),
                    inventorySample: allArtifacts
                        .slice(0, 3)
                        .map((a) => a.id)
                        .join(', '),
                    inventorySize: allArtifacts.length,
                }
            );
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(details, null, 2)),
        ]);
    }
}

/**
 * migration_readSourceFile — Read raw source file of an artifact.
 */
class ReadSourceFileTool implements vscode.LanguageModelTool<ReadSourceFileInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ReadSourceFileInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { artifactId, maxChars } = options.input;
        const charLimit = maxChars || 60_000;

        const inventoryService = InventoryService.getInstance();
        const allArtifacts = await inventoryService.getAllParsedArtifacts();
        const artifact = allArtifacts.find((a) => a.id === artifactId);

        if (!artifact) {
            logger.error(`[LMTool] migration_readSourceFile: artifact '${artifactId}' not found`);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: `Artifact '${artifactId}' not found` })
                ),
            ]);
        }

        const filePath = artifact.absolutePath;
        if (!filePath) {
            logger.error(
                `[LMTool] migration_readSourceFile: no absolute path for artifact '${artifactId}'`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `No absolute path for artifact '${artifactId}'`,
                    })
                ),
            ]);
        }

        try {
            const fileBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            let content = Buffer.from(fileBytes).toString('utf-8');
            const truncated = content.length > charLimit;
            if (truncated) {
                content = content.substring(0, charLimit);
            }

            const result = {
                artifactId: artifact.id,
                name: artifact.name,
                type: artifact.type,
                sourcePath: artifact.sourcePath,
                fileSize: artifact.fileSize,
                truncated,
                content,
            };

            logger.info(
                `[LMTool] migration_readSourceFile: read ${content.length} chars for '${artifact.name}'`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
        } catch (err) {
            logger.error(
                '[LMTool] migration_readSourceFile failed',
                err instanceof Error ? err : new Error(String(err))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }
}

/**
 * migration_searchArtifacts — Search artifacts by name, schema, endpoint, etc.
 */
class SearchArtifactsTool implements vscode.LanguageModelTool<SearchArtifactsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<SearchArtifactsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { query, searchIn } = options.input;
        const fields = searchIn || ['name', 'schema', 'endpoint', 'map', 'connection'];
        const lowerQuery = query.toLowerCase();

        const inventoryService = InventoryService.getInstance();
        const allArtifacts = await inventoryService.getAllParsedArtifacts();

        const matches: ParsedArtifact[] = [];

        for (const a of allArtifacts) {
            let matched = false;

            if (fields.includes('name')) {
                if (
                    a.name.toLowerCase().includes(lowerQuery) ||
                    a.sourcePath.toLowerCase().includes(lowerQuery)
                ) {
                    matched = true;
                }
            }

            if (!matched && fields.includes('schema') && a.ir.schemas) {
                for (const s of a.ir.schemas) {
                    if (
                        s.name?.toLowerCase().includes(lowerQuery) ||
                        s.targetNamespace?.toLowerCase().includes(lowerQuery)
                    ) {
                        matched = true;
                        break;
                    }
                }
            }

            if (!matched && fields.includes('endpoint')) {
                const allEndpoints = [
                    ...(a.ir.endpoints?.receive || []),
                    ...(a.ir.endpoints?.send || []),
                ];
                for (const ep of allEndpoints) {
                    if (ep.name?.toLowerCase().includes(lowerQuery)) {
                        matched = true;
                        break;
                    }
                }
            }

            if (!matched && fields.includes('map') && a.ir.maps) {
                for (const m of a.ir.maps) {
                    if (
                        m.source?.schemaRef?.toLowerCase().includes(lowerQuery) ||
                        m.target?.schemaRef?.toLowerCase().includes(lowerQuery)
                    ) {
                        matched = true;
                        break;
                    }
                }
            }

            if (!matched && fields.includes('connection') && a.ir.connections) {
                for (const c of a.ir.connections) {
                    if (
                        c.name?.toLowerCase().includes(lowerQuery) ||
                        c.type?.toLowerCase().includes(lowerQuery)
                    ) {
                        matched = true;
                        break;
                    }
                }
            }

            if (matched) {
                matches.push(a);
            }
        }

        const results = matches.map((a) => buildCompactSummary(a));

        logger.info(
            `[LMTool] migration_searchArtifacts: query='${query}', found ${results.length} matches`
        );

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
                JSON.stringify({ query, matchCount: results.length, results }, null, 2)
            ),
        ]);
    }
}

// ============================================================================
// Tool: migration_getMigrationContext
// ============================================================================

/**
 * migration_getMigrationContext — Get current migration state, inventory, and analysis.
 */
class GetMigrationContextTool implements vscode.LanguageModelTool<GetMigrationContextInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetMigrationContextInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const scope = options.input.scope || 'standard';

        const contextBuilder = new ContextBuilder();
        const scopeEnum =
            scope === 'full'
                ? ContextScope.Full
                : scope === 'minimal'
                  ? ContextScope.Minimal
                  : ContextScope.Standard;

        const ctx = await contextBuilder.buildContext(scopeEnum);

        const result: Record<string, unknown> = {
            currentStage: ctx.stageSummary,
            sourcePlatform: ctx.sourcePlatform,
            targetPlatform: ctx.targetPlatform,
            sourceFolderPath: ctx.sourceFolderPath,
        };

        if (ctx.inventorySummary) {
            result.inventorySummary = ctx.inventorySummary;
        }
        if (ctx.artifactDetails) {
            result.artifactDetails = ctx.artifactDetails;
        }

        logger.info(`[LMTool] migration_getMigrationContext: scope=${scope}`);
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
        ]);
    }
}

// ============================================================================
// Tool: migration_detectFlowGroups
// ============================================================================

/**
 * migration_detectFlowGroups — Builds a deterministic connection graph from
 * all discovered artifacts and returns it along with artifact summaries.
 * The Agent uses this data to determine logical flow groups itself.
 */
class DetectFlowGroupsTool implements vscode.LanguageModelTool<DetectFlowGroupsInput> {
    async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<DetectFlowGroupsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const input = _options.input;

        // If a groupId is provided, try to return cached flow group data
        if (input.groupId) {
            const cachedFlowGroups = SourceFlowVisualizer.getStaticCachedFlowGroups();
            if (cachedFlowGroups) {
                const group = cachedFlowGroups.groups.find((g) => g.id === input.groupId);
                if (group) {
                    logger.info(
                        `[LMTool] migration_detectFlowGroups: returning cached group "${group.name}" (${group.artifactIds.length} artifacts)`
                    );

                    // Get artifact summaries for just this group's artifacts
                    const inventoryService = InventoryService.getInstance();
                    const parsedArtifacts = await inventoryService.getAllParsedArtifacts();
                    const groupArtifactIds = new Set(group.artifactIds);
                    const groupArtifacts = (parsedArtifacts || []).filter((a) =>
                        groupArtifactIds.has(a.id)
                    );

                    // Diagnostic: warn when cached group IDs don't match any inventory artifacts
                    if (
                        groupArtifacts.length === 0 &&
                        group.artifactIds.length > 0 &&
                        parsedArtifacts.length > 0
                    ) {
                        logger.warn(
                            `[LMTool] migration_detectFlowGroups: cached group "${group.name}" has ${group.artifactIds.length} artifact IDs but NONE match current inventory. ` +
                                'Flow group cache may be stale (artifact IDs regenerated after re-scan).',
                            {
                                cachedIdSample: group.artifactIds.slice(0, 3).join(', '),
                                inventoryIdSample: parsedArtifacts
                                    .slice(0, 3)
                                    .map((a) => a.id)
                                    .join(', '),
                                inventorySize: parsedArtifacts.length,
                            }
                        );
                    }

                    // Build compact summaries for only this group's artifacts
                    const artifactSummaries = groupArtifacts.map((a) => {
                        const summary: Record<string, unknown> = {
                            id: a.id,
                            name: a.name,
                            type: a.type,
                        };
                        if (a.ir.endpoints?.receive && a.ir.endpoints.receive.length > 0) {
                            summary.receiveEndpoints = a.ir.endpoints.receive.map((ep) => {
                                const sourceMapping = ep.sourceMapping as
                                    | { biztalk?: { receivePortName?: string } }
                                    | undefined;
                                return {
                                    name: ep.name,
                                    transport: ep.transport,
                                    receivePortName:
                                        sourceMapping?.biztalk?.receivePortName || ep.name,
                                };
                            });
                        }
                        if (a.ir.endpoints?.send && a.ir.endpoints.send.length > 0) {
                            summary.sendEndpoints = a.ir.endpoints.send.map((ep) => {
                                const result: Record<string, unknown> = { name: ep.name };
                                if ('transport' in ep) {
                                    result.transport = ep.transport;
                                }
                                const sourceMapping = ep.sourceMapping as
                                    | { biztalk?: { filter?: string } }
                                    | undefined;
                                if (sourceMapping?.biztalk?.filter) {
                                    result.filter = sourceMapping.biztalk.filter;
                                }
                                return result;
                            });
                        }
                        if (a.ir.schemas && a.ir.schemas.length > 0) {
                            summary.schemas = a.ir.schemas.map((s) => ({
                                name: s.name,
                                targetNamespace: s.targetNamespace,
                            }));
                        }
                        if (a.ir.maps && a.ir.maps.length > 0) {
                            summary.maps = a.ir.maps.map((m) => ({
                                name: m.name,
                                source: m.source?.schemaRef,
                                target: m.target?.schemaRef,
                            }));
                        }
                        return summary;
                    });

                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify({
                                success: true,
                                cached: true,
                                group: {
                                    id: group.id,
                                    name: group.name,
                                    description: group.description,
                                    category: group.category,
                                    artifactIds: group.artifactIds,
                                },
                                totalArtifactsInGroup: group.artifactIds.length,
                                artifacts: artifactSummaries,
                                allGroups: cachedFlowGroups.groups.map((g) => ({
                                    id: g.id,
                                    name: g.name,
                                    artifactCount: g.artifactIds.length,
                                })),
                                instructions:
                                    'This is a CACHED flow group. The artifacts listed belong to this group. ' +
                                    'Call migration_getArtifactDetails and migration_readSourceFile for each artifact to extract configuration details, ' +
                                    'then generate the Mermaid diagram and proceed with your workflow.',
                            })
                        ),
                    ]);
                } else {
                    logger.warn(
                        `[LMTool] migration_detectFlowGroups: cached group ID "${input.groupId}" not found`
                    );
                }
            } else {
                logger.info(
                    '[LMTool] migration_detectFlowGroups: no cached flow groups available, performing full detection'
                );
            }
        }

        const inventoryService = InventoryService.getInstance();
        const parsedArtifacts = await inventoryService.getAllParsedArtifacts();

        if (!parsedArtifacts || parsedArtifacts.length === 0) {
            logger.warn('[LMTool] migration_detectFlowGroups: no parsed artifacts found');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'No parsed artifacts found. Run discovery first.' })
                ),
            ]);
        }

        try {
            const llmGenerator = LLMFlowGenerator.getInstance();

            // Build deterministic connection graph (no LLM calls)
            const connectionGraph = llmGenerator.buildArtifactConnectionGraph(parsedArtifacts);

            // Build compact artifact summaries with endpoint/schema/map info
            const artifactSummaries = parsedArtifacts.map((a) => {
                const summary: Record<string, unknown> = {
                    id: a.id,
                    name: a.name,
                    type: a.type,
                };

                // Include receive endpoints
                if (a.ir.endpoints?.receive && a.ir.endpoints.receive.length > 0) {
                    summary.receiveEndpoints = a.ir.endpoints.receive.map((ep) => {
                        const sourceMapping = ep.sourceMapping as
                            | { biztalk?: { receivePortName?: string } }
                            | undefined;
                        return {
                            name: ep.name,
                            transport: ep.transport,
                            receivePortName: sourceMapping?.biztalk?.receivePortName || ep.name,
                        };
                    });
                }

                // Include send endpoints with filters
                if (a.ir.endpoints?.send && a.ir.endpoints.send.length > 0) {
                    summary.sendEndpoints = a.ir.endpoints.send.map((ep) => {
                        const result: Record<string, unknown> = { name: ep.name };
                        if ('transport' in ep) {
                            result.transport = ep.transport;
                        }
                        const sourceMapping = ep.sourceMapping as
                            | { biztalk?: { filter?: string } }
                            | undefined;
                        if (sourceMapping?.biztalk?.filter) {
                            result.filter = sourceMapping.biztalk.filter;
                        }
                        return result;
                    });
                }

                // Include schemas
                if (a.ir.schemas && a.ir.schemas.length > 0) {
                    summary.schemas = a.ir.schemas.map((s) => ({
                        name: s.name,
                        targetNamespace: s.targetNamespace,
                    }));
                }

                // Include maps
                if (a.ir.maps && a.ir.maps.length > 0) {
                    summary.maps = a.ir.maps.map((m) => ({
                        name: m.name,
                        source: m.source?.schemaRef,
                        target: m.target?.schemaRef,
                    }));
                }

                return summary;
            });

            // Format connection graph for the agent
            const connections = connectionGraph.connections.map((c) => ({
                from: c.fromId,
                to: c.toId,
                type: c.type,
                evidence: c.evidence,
            }));

            // Count receive locations (each receive endpoint is a receive location;
            // a single receive port can have multiple receive locations)
            const receiveLocationCount = parsedArtifacts.reduce((count, a) => {
                return count + (a.ir.endpoints?.receive?.length ?? 0);
            }, 0);

            logger.info(
                `[LMTool] migration_detectFlowGroups: ${parsedArtifacts.length} artifacts, ${connections.length} connections, ${receiveLocationCount} receive location(s)`
            );

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        totalArtifacts: parsedArtifacts.length,
                        receiveLocationCount,
                        artifacts: artifactSummaries,
                        connectionGraph: connections,
                        instructions:
                            'Use the artifacts and connectionGraph to determine logical flow groups. ' +
                            'CRITICAL: The connectionGraph includes orchestration-calls edges when one orchestration calls/starts another (Call Orchestration or Start Orchestration). ' +
                            'Orchestrations linked by orchestration-calls edges (directly or transitively) MUST be in the SAME group — do NOT create separate groups for caller and callee orchestrations. ' +
                            'Example: If Orch-A calls Orch-B and Orch-B calls Orch-C, all three belong in ONE group with all their related schemas/maps/pipelines. ' +
                            'Each group should follow: exactly ONE Receive Location → Receive Port → MessageBox → Orchestration(s) → Send Port(s). ' +
                            'A single Receive Port can contain multiple Receive Locations — each Receive Location becomes its own flow group. ' +
                            'Transitively connected artifacts (A→B→C in the graph) belong in the SAME group. ' +
                            'If there are N receive locations, expect at least N flow groups. ' +
                            'If receiveLocationCount is 0, DO NOT return empty groups: use fallback grouping in this order — orchestration-root grouping (one group per connected orchestration cluster based on orchestration-calls edges), then trigger-capability grouping, then connected-component grouping. ' +
                            'Only mark artifacts ungrouped if truly isolated. For fallback groups, use entryPoint types such as orchestration, trigger, adapter, or internal-entry (not receive-location). ' +
                            'Proceed with your workflow using the detected flow groups.',
                    })
                ),
            ]);
        } catch (err) {
            logger.error(
                '[LMTool] migration_detectFlowGroups failed',
                err instanceof Error ? err : new Error(String(err))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to analyze artifacts: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<DetectFlowGroupsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const groupId = _options.input?.groupId;
        if (groupId) {
            const cached = SourceFlowVisualizer.getStaticCachedFlowGroups();
            const groupName = cached?.groups.find((g) => g.id === groupId)?.name;
            return {
                invocationMessage: groupName
                    ? `Retrieving cached flow group "${groupName}"...`
                    : `Looking up flow group "${groupId}"...`,
            };
        }
        return {
            invocationMessage: 'Analyzing artifact connections and building connection graph...',
        };
    }
}

// ============================================================================
// Tool: migration_discovery_storeFlowGroups
// ============================================================================

/**
 * migration_discovery_storeFlowGroups — Stores detected flow groups and shows the flow selector.
 */
class StoreFlowGroupsTool implements vscode.LanguageModelTool<StoreFlowGroupsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<StoreFlowGroupsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const input = options.input;

        if (!input.groups || input.groups.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'groups array is required and must not be empty' })
                ),
            ]);
        }

        // Validate that groups have artifactIds
        const emptyGroups = input.groups.filter(
            (g) => !g.artifactIds || g.artifactIds.length === 0
        );
        if (emptyGroups.length > 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `groups with empty artifactIds: ${emptyGroups.map((g) => g.name).join(', ')}. Every group MUST include its artifactIds.`,
                    })
                ),
            ]);
        }

        const inventoryService = InventoryService.getInstance();
        const parsedArtifacts: ParsedArtifact[] = await inventoryService.getAllParsedArtifacts();
        const inventoryArtifactIds = new Set(parsedArtifacts.map((a) => a.id));
        const receiveLocationCount = parsedArtifacts.reduce((count, a) => {
            return count + (a.ir.endpoints?.receive?.length ?? 0);
        }, 0);

        const groupedArtifactIds = new Set(input.groups.flatMap((g) => g.artifactIds || []));
        const unknownGroupedIds = Array.from(groupedArtifactIds).filter(
            (id) => !inventoryArtifactIds.has(id)
        );
        if (unknownGroupedIds.length > 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `groups contain artifactIds not found in inventory: ${unknownGroupedIds.slice(0, 10).join(', ')}`,
                    })
                ),
            ]);
        }

        // Enforce group independence for testing:
        // reject group sets that introduce cross-group runtime/design dependencies.
        const groupByArtifactId = new Map<string, { id: string; name: string }>();
        for (const group of input.groups) {
            for (const artifactId of group.artifactIds || []) {
                groupByArtifactId.set(artifactId, { id: group.id, name: group.name });
            }
        }

        const connectionGraph =
            LLMFlowGenerator.getInstance().buildArtifactConnectionGraph(parsedArtifacts);
        const blockingConnectionTypes = new Set([
            'subscription-filter',
            'message-type-subscription',
            'map-source-schema',
            'map-target-schema',
            'orchestration-uses-map',
            'orchestration-calls',
            'binding-references',
        ]);

        const crossGroupDependencies = connectionGraph.connections.filter((c) => {
            if (!blockingConnectionTypes.has(c.type)) {
                return false;
            }
            const fromGroup = groupByArtifactId.get(c.fromId);
            const toGroup = groupByArtifactId.get(c.toId);
            if (!fromGroup || !toGroup) {
                return false;
            }
            return fromGroup.id !== toGroup.id;
        });

        if (crossGroupDependencies.length > 0) {
            const dependencySample = crossGroupDependencies.slice(0, 12).map((c) => {
                const fromGroup = groupByArtifactId.get(c.fromId);
                const toGroup = groupByArtifactId.get(c.toId);
                return {
                    fromGroup: fromGroup?.name || fromGroup?.id || 'unknown',
                    toGroup: toGroup?.name || toGroup?.id || 'unknown',
                    fromArtifactId: c.fromId,
                    toArtifactId: c.toId,
                    dependencyType: c.type,
                    evidence: c.evidence,
                };
            });

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'Group independence validation failed: one or more groups depend on artifacts in another group. Groups must be independently testable. Merge dependent artifacts into the same group or move shared dependencies to external mocks/stubs.',
                        dependencyCount: crossGroupDependencies.length,
                        dependencies: dependencySample,
                    })
                ),
            ]);
        }

        if (receiveLocationCount === 0) {
            const invalidEntryPointGroups = input.groups.filter((g) => {
                const entryType = g.entryPoint?.type?.toLowerCase() || '';
                if (!entryType) {
                    return true;
                }
                return entryType === 'receive-location' || entryType === 'receivelocation';
            });

            if (invalidEntryPointGroups.length > 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: 'Fallback grouping validation failed: receiveLocationCount is 0, so each group must have a non-receive entryPoint (e.g., orchestration, trigger, adapter, internal-entry).',
                            invalidGroups: invalidEntryPointGroups.map((g) => g.name),
                        })
                    ),
                ]);
            }

            if (groupedArtifactIds.size === 0 && parsedArtifacts.length > 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: 'Fallback grouping validation failed: no receive locations were found, but no grouped artifacts were provided. Build groups using orchestration-root, trigger-capability, or connected-component fallback before storing.',
                        })
                    ),
                ]);
            }
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            const discoveryCacheService = DiscoveryCacheService.getInstance();

            // Store flow groups
            await discoveryCacheService.storeFlowGroups({
                groups: input.groups.map((g) => ({
                    id: g.id,
                    name: g.name,
                    description: g.description,
                    category: (g.category || 'message-flow') as FlowGroup['category'],
                    artifactIds: g.artifactIds,
                    entryPoint: g.entryPoint as FlowGroup['entryPoint'],
                    exitPoints: g.exitPoints as FlowGroup['exitPoints'],
                })),
                ungroupedArtifactIds: input.ungroupedArtifactIds ?? [],
                explanation: input.explanation ?? '',
            });

            // Also store in SourceFlowVisualizer static cache for backward compat
            SourceFlowVisualizer.setStaticCachedFlowGroups({
                groups: input.groups.map((g) => ({
                    id: g.id,
                    name: g.name,
                    description: g.description,
                    category: (g.category || 'message-flow') as FlowGroup['category'],
                    artifactIds: g.artifactIds,
                })),
                ungroupedArtifactIds: input.ungroupedArtifactIds ?? [],
                explanation: input.explanation ?? '',
            });

            // Show flow group selector in the webview
            const extensionUri =
                vscode.extensions.getExtension('logicapps-migration-assistant')?.extensionUri ??
                vscode.Uri.file(__dirname);

            SourceFlowVisualizer.showFlowGroupSelector(extensionUri);

            // Clear generation flags
            SourceFlowVisualizer.isInitialGenerating = false;

            logger.info(
                `[LMTool] migration_discovery_storeFlowGroups: stored ${input.groups.length} groups`
            );

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        message: `Stored ${input.groups.length} flow groups. The user will select individual flows for detailed analysis in the webview.`,
                        flowGroupCount: input.groups.length,
                        groupNames: input.groups.map((g) => g.name),
                    })
                ),
            ]);
        } catch (err) {
            SourceFlowVisualizer.isInitialGenerating = false;
            logger.error(
                '[LMTool] migration_discovery_storeFlowGroups failed',
                err instanceof Error ? err : new Error(String(err))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store flow groups: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<StoreFlowGroupsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: 'Storing detected flow groups...',
        };
    }
}

// ============================================================================
// Discovery Multi-Step Tools
// ============================================================================

/**
 * migration_discovery_storeMeta — Stores the explanation, summary, title, and notes for a flow.
 * Call this FIRST when analysing a flow group.
 */
class DiscoveryStoreMetaTool implements vscode.LanguageModelTool<DiscoveryStoreMetaInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DiscoveryStoreMetaInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, explanation, summary, title, notes } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        // Validate summary has at least some non-empty arrays
        if (summary) {
            const s = summary as Record<string, unknown[]>;
            const allEmpty =
                (!s.receiveLocations || (s.receiveLocations as unknown[]).length === 0) &&
                (!s.receivePorts || (s.receivePorts as unknown[]).length === 0) &&
                (!s.orchestrations || (s.orchestrations as unknown[]).length === 0) &&
                (!s.maps || (s.maps as unknown[]).length === 0) &&
                (!s.schemas || (s.schemas as unknown[]).length === 0) &&
                (!s.sendPorts || (s.sendPorts as unknown[]).length === 0);
            if (allEmpty) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: 'summary has all empty arrays — populate at least receivePorts, orchestrations, maps, and sendPorts with the component names from the diagram.',
                            instruction:
                                'Provide the actual component names discovered from source files.',
                        })
                    ),
                ]);
            }
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            DiscoveryCacheService.getInstance().storeMeta(flowId, {
                explanation: explanation || '',
                summary: summary || {},
                title: title || 'Integration Flow',
                notes: notes || [],
            });

            logger.info(`[LMTool] migration_discovery_storeMeta: stored for "${flowId}"`);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ success: true, flowId })),
            ]);
        } catch (err) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: 'Storing discovery metadata...' };
    }
}

/**
 * migration_discovery_storeArchitecture — Stores the Mermaid architecture diagram for a flow.
 */
class DiscoveryStoreArchitectureTool implements vscode.LanguageModelTool<DiscoveryStoreArchitectureInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DiscoveryStoreArchitectureInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, mermaid } = options.input;

        if (!flowId || !mermaid) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'flowId and mermaid are required' })
                ),
            ]);
        }

        const validation = await MermaidValidationService.getInstance().validate(mermaid, {
            expectedDiagramTypes: FLOWCHART_MERMAID_TYPES,
        });
        if (!validation.valid) {
            logger.warn(
                `[LMTool] migration_discovery_storeArchitecture: Mermaid validation failed for "${flowId}" — ${validation.error}`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'Invalid Mermaid diagram. Fix the parser error below and call this tool again.',
                        parserError: validation.error,
                        diagramType: validation.diagramType,
                        hint: 'Use a flowchart TB/TD/LR/RL diagram. Keep labels inside node brackets or quoted edge labels, and avoid raw unescaped double quotes in label text.',
                    })
                ),
            ]);
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            DiscoveryCacheService.getInstance().storeArchitecture(flowId, validation.normalized);

            logger.info(`[LMTool] migration_discovery_storeArchitecture: stored for "${flowId}"`);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        diagramType: validation.diagramType,
                    })
                ),
            ]);
        } catch (err) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: 'Storing architecture diagram...' };
    }
}

/**
 * migration_discovery_storeMessageFlow — Stores the message flow steps for a flow.
 */
class DiscoveryStoreMessageFlowTool implements vscode.LanguageModelTool<DiscoveryStoreMessageFlowInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DiscoveryStoreMessageFlowInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, messageFlow } = options.input;

        if (!flowId || !messageFlow || messageFlow.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'flowId and non-empty messageFlow array are required' })
                ),
            ]);
        }

        const shapeErrors = messageFlow.flatMap((step, index) =>
            validateMessageFlowStepShape(step, index)
        );
        if (shapeErrors.length > 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Invalid messageFlow step shape detected (${shapeErrors.length} issue${shapeErrors.length === 1 ? '' : 's'}).`,
                        details: shapeErrors.slice(0, 10),
                        suggestion: getMessageFlowCorrectionGuidance(),
                    })
                ),
            ]);
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            DiscoveryCacheService.getInstance().storeMessageFlow(flowId, messageFlow);

            logger.info(
                `[LMTool] migration_discovery_storeMessageFlow: stored ${messageFlow.length} steps for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ success: true, flowId, stepCount: messageFlow.length })
                ),
            ]);
        } catch (err) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: 'Storing message flow steps...' };
    }
}

/**
 * migration_discovery_storeComponents — Stores the component details for a flow.
 */
class DiscoveryStoreComponentsTool implements vscode.LanguageModelTool<DiscoveryStoreComponentsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DiscoveryStoreComponentsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, componentDetails } = options.input;

        if (!flowId || !componentDetails || componentDetails.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'flowId and non-empty componentDetails array are required',
                    })
                ),
            ]);
        }

        // Validate each component against the strict schema
        const allIssues: string[] = [];
        componentDetails.forEach((comp, i) => {
            allIssues.push(...validateComponentShape(comp, i));
        });
        if (allIssues.length > 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `${allIssues.length} validation issue(s) in componentDetails. Fix and retry.`,
                        issues: allIssues.slice(0, 20),
                        guidance:
                            'Each component must have: id (string), name (string), type (string), description (string), isLogicAppsNative (boolean), azureEquivalent (string — plain text, NOT an object). Optional: purpose, connectedTo (string[]), sourcePath.',
                    })
                ),
            ]);
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            DiscoveryCacheService.getInstance().storeComponents(flowId, componentDetails);

            logger.info(
                `[LMTool] migration_discovery_storeComponents: stored ${componentDetails.length} components for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        componentCount: componentDetails.length,
                    })
                ),
            ]);
        } catch (err) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: 'Storing component details...' };
    }
}

/**
 * migration_discovery_storeGaps — Stores the gap analysis for a flow.
 */
class DiscoveryStoreGapsTool implements vscode.LanguageModelTool<DiscoveryStoreGapsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DiscoveryStoreGapsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, gapAnalysis } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        // Validate each gap against the strict schema
        const gaps = gapAnalysis || [];
        if (gaps.length > 0) {
            const allIssues: string[] = [];
            gaps.forEach((gap, i) => {
                allIssues.push(...validateGapShape(gap, i));
            });
            if (allIssues.length > 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `${allIssues.length} validation issue(s) in gapAnalysis. Fix and retry.`,
                            issues: allIssues.slice(0, 20),
                            guidance:
                                'Each gap must have: component (string), componentType (string), gap (string), severity ("high"|"medium"|"low"), options (string[]), recommendation (string — plain text, NOT an object).',
                        })
                    ),
                ]);
            }
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            DiscoveryCacheService.getInstance().storeGaps(flowId, gaps);

            logger.info(
                `[LMTool] migration_discovery_storeGaps: stored ${(gapAnalysis || []).length} gaps for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ success: true, flowId, gapCount: (gapAnalysis || []).length })
                ),
            ]);
        } catch (err) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: 'Storing gap analysis...' };
    }
}

/**
 * migration_discovery_storePatterns — Stores the migration patterns for a flow.
 */
class DiscoveryStorePatternsTool implements vscode.LanguageModelTool<DiscoveryStorePatternsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DiscoveryStorePatternsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, migrationPatterns } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        // Validate each pattern against the strict schema
        const patterns = migrationPatterns || [];
        if (patterns.length > 0) {
            const allIssues: string[] = [];
            patterns.forEach((pattern, i) => {
                allIssues.push(...validatePatternShape(pattern, i));
            });
            if (allIssues.length > 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `${allIssues.length} validation issue(s) in migrationPatterns. Fix and retry.`,
                            issues: allIssues.slice(0, 20),
                            guidance:
                                'Each pattern must have: pattern (string), description (string), complexity ("high"|"medium"|"low"), biztalkApproach (string), logicAppsApproach (string), components (string[]).',
                        })
                    ),
                ]);
            }
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            DiscoveryCacheService.getInstance().storePatterns(flowId, patterns);

            logger.info(
                `[LMTool] migration_discovery_storePatterns: stored ${(migrationPatterns || []).length} patterns for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        patternCount: (migrationPatterns || []).length,
                    })
                ),
            ]);
        } catch (err) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: 'Storing migration patterns...' };
    }
}

/**
 * migration_discovery_storeDependencies — Stores missing dependency analysis for a flow.
 * Identifies DLLs, assemblies, schemas, and other resources that are missing
 * and would block concrete (non-stub) implementation by the conversion agent.
 */
class DiscoveryStoreDependenciesTool implements vscode.LanguageModelTool<DiscoveryStoreDependenciesInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DiscoveryStoreDependenciesInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, missingDependencies, summary, allCriticalResolved, counts } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        // Validate each dependency against the strict schema
        if (missingDependencies && missingDependencies.length > 0) {
            const allIssues: string[] = [];
            missingDependencies.forEach((dep, i) => {
                allIssues.push(...validateDependencyShape(dep, i));
            });
            if (allIssues.length > 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `${allIssues.length} validation issue(s) in missingDependencies. Fix and retry.`,
                            issues: allIssues.slice(0, 20),
                            guidance:
                                'Each dependency must have: name (string), type (string), origin ("standard-framework"|"standard-biztalk"|"standard-platform"|"third-party"|"custom"|"unknown"), severity ("critical"|"warning"|"info"), referencedBy (string[]), reason (string), blocksMigration (boolean), migrationRelevant (boolean).',
                        })
                    ),
                ]);
            }
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');

            // Compute counts if not provided
            const deps = missingDependencies || [];
            const computedCounts = counts || {
                critical: deps.filter((d) => d.severity === 'critical').length,
                warning: deps.filter((d) => d.severity === 'warning').length,
                info: deps.filter((d) => d.severity === 'info').length,
            };
            const computedAllCriticalResolved =
                allCriticalResolved ?? computedCounts.critical === 0;

            const dependencyAnalysis = {
                missingDependencies: deps,
                summary:
                    summary ||
                    `${deps.length} missing dependencies found (${computedCounts.critical} critical, ${computedCounts.warning} warnings, ${computedCounts.info} info)`,
                allCriticalResolved: computedAllCriticalResolved,
                counts: computedCounts,
            };

            DiscoveryCacheService.getInstance().storeDependencies(flowId, dependencyAnalysis);

            logger.info(
                `[LMTool] migration_discovery_storeDependencies: stored ${deps.length} dependencies for "${flowId}" (${computedCounts.critical} critical, ${computedCounts.warning} warning)`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        dependencyCount: deps.length,
                        counts: computedCounts,
                        allCriticalResolved: computedAllCriticalResolved,
                    })
                ),
            ]);
        } catch (err) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: 'Storing missing dependency analysis...' };
    }
}

/**
 * migration_discovery_finalize — Assembles all partial files into analysis.json and opens the webview.
 */
class DiscoveryFinalizeTool implements vscode.LanguageModelTool<DiscoveryFinalizeInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<DiscoveryFinalizeInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        try {
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            const discoveryCacheService = DiscoveryCacheService.getInstance();

            // Validate partials
            const validation = discoveryCacheService.validatePartials(flowId);
            if (!validation.valid) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Cannot finalize: missing files: ${validation.missing.join(', ')}. Store them first using the individual tools.`,
                            missing: validation.missing,
                        })
                    ),
                ]);
            }

            // Assemble and store final analysis.json
            const result = await discoveryCacheService.assembleAndStore(flowId);
            if (!result) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: 'Failed to assemble analysis — partial files may be corrupt.',
                        })
                    ),
                ]);
            }

            // Also store in old SourceFlowVisualizer caches for backward compat

            // Set flow groups in static cache if not already set
            const flowGroupsResult = discoveryCacheService.getFlowGroups();
            if (flowGroupsResult) {
                SourceFlowVisualizer.setStaticCachedFlowGroups({
                    groups: flowGroupsResult.groups.map((g) => ({
                        id: g.id,
                        name: g.name,
                        description: g.description,
                        category: g.category,
                        artifactIds: g.artifactIds,
                    })),
                    ungroupedArtifactIds: flowGroupsResult.ungroupedArtifactIds,
                    explanation: flowGroupsResult.explanation,
                });
            }

            // Open the webview with the assembled result
            const extensionUri =
                vscode.extensions.getExtension('logicapps-migration-assistant')?.extensionUri ??
                vscode.Uri.file(__dirname);

            const group = discoveryCacheService.getFlowGroup(flowId);
            const title = group?.name || flowId;

            // Clear generation flags first so the button shows correctly
            SourceFlowVisualizer.isInitialGenerating = false;
            SourceFlowVisualizer.generatingGroupIds.delete(flowId);

            // Refresh flow group selector to show "✓ Analysed" button
            if (SourceFlowVisualizer.currentPanel) {
                SourceFlowVisualizer.showFlowGroupSelector(extensionUri);
            }

            // Cache group result for fast switching
            SourceFlowVisualizer.cacheGroupResult(flowId, result as GeneratedFlowResult);

            // Open the analysis in a separate panel (keep flow group page open)
            try {
                const { InventoryService: InvSvc } =
                    await import('../stages/discovery/InventoryService');
                const parsedArtifacts = await InvSvc.getInstance().getAllParsedArtifacts();
                const EXCLUDED_CATEGORIES = new Set(['custom-code', 'other']);
                const integrationArtifacts = parsedArtifacts.filter(
                    (a) => !EXCLUDED_CATEGORIES.has(a.type)
                );

                // Open analysis in the separate panel using the static helper
                SourceFlowVisualizer.openAnalysisPanel(
                    flowId,
                    title,
                    extensionUri,
                    integrationArtifacts,
                    result as GeneratedFlowResult
                );
            } catch (vizErr) {
                logger.warn(`[LMTool] Failed to auto-open analysis panel: ${vizErr}`);
            }

            logger.info(`[LMTool] migration_discovery_finalize: opened webview for "${flowId}"`);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        message: `Flow visualization for "${title}" assembled and opened.`,
                        componentCount: (result.componentDetails as unknown[])?.length || 0,
                        flowSteps: (result.messageFlow as unknown[])?.length || 0,
                    })
                ),
            ]);
        } catch (err) {
            SourceFlowVisualizer.isInitialGenerating = false;
            SourceFlowVisualizer.generatingGroupIds.delete(flowId);

            logger.error(
                '[LMTool] migration_discovery_finalize failed',
                err instanceof Error ? err : new Error(String(err))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: 'Assembling discovery analysis and opening visualization...' };
    }
}

// ============================================================================
// migration_readReferenceDoc — Read reference documentation from disk
// ============================================================================

/**
 * migration_readReferenceDoc — List, search, or read reference docs shipped
 * as markdown files under resources/referenceDocs/ in the VSIX.
 *
 * Actions:
 *   - list:   Return metadata (id, title, platform, category) for all docs.
 *              Optionally filter by platform and/or category.
 *   - read:   Return the full content of a single doc by its id.
 *   - search: Search doc titles and content by keyword.
 */
class ReadReferenceDocTool implements vscode.LanguageModelTool<ReadReferenceDocInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ReadReferenceDocInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { action, docId, platform, category, query } = options.input;

        try {
            const registry = ReferenceDocRegistry.getInstance();

            switch (action) {
                case 'list': {
                    const docs = await registry.listDocs(platform, category);
                    logger.info(
                        `[LMTool] migration_readReferenceDoc: list returned ${docs.length} docs`
                    );
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify({
                                totalDocs: docs.length,
                                docs: docs.map((d) => ({
                                    id: d.id,
                                    title: d.title,
                                    platform: d.platform,
                                    category: d.category,
                                })),
                            })
                        ),
                    ]);
                }

                case 'read': {
                    if (!docId) {
                        return new vscode.LanguageModelToolResult([
                            new vscode.LanguageModelTextPart(
                                JSON.stringify({
                                    error: 'docId is required when action is "read"',
                                })
                            ),
                        ]);
                    }
                    const doc = await registry.readDoc(docId);
                    if (!doc) {
                        // Try fuzzy match
                        const suggestions = await registry.findSuggestions(docId);
                        return new vscode.LanguageModelToolResult([
                            new vscode.LanguageModelTextPart(
                                JSON.stringify({
                                    error: `Doc not found: "${docId}"`,
                                    suggestions: suggestions.map((d) => ({
                                        id: d.id,
                                        title: d.title,
                                    })),
                                })
                            ),
                        ]);
                    }
                    logger.info(
                        `[LMTool] migration_readReferenceDoc: read "${docId}" (${doc.lineCount} lines)`
                    );
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify({
                                id: doc.id,
                                title: doc.title,
                                platform: doc.platform,
                                category: doc.category,
                                lineCount: doc.lineCount,
                                content: doc.content,
                            })
                        ),
                    ]);
                }

                case 'search': {
                    if (!query) {
                        return new vscode.LanguageModelToolResult([
                            new vscode.LanguageModelTextPart(
                                JSON.stringify({
                                    error: 'query is required when action is "search"',
                                })
                            ),
                        ]);
                    }
                    const results = await registry.searchDocs(query);
                    logger.info(
                        `[LMTool] migration_readReferenceDoc: search "${query}" found ${results.length} docs`
                    );
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify({
                                query,
                                totalResults: results.length,
                                docs: results.slice(0, 10).map((d) => ({
                                    id: d.id,
                                    title: d.title,
                                    platform: d.platform,
                                    category: d.category,
                                    score: d.score,
                                    snippet: d.snippet,
                                })),
                            })
                        ),
                    ]);
                }

                default:
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify({
                                error: `Unknown action: "${action}". Use "list", "read", or "search".`,
                            })
                        ),
                    ]);
            }
        } catch (err) {
            logger.error(
                '[LMTool] migration_readReferenceDoc failed',
                err instanceof Error ? err : new Error(String(err))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ReadReferenceDocInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const { action, docId, query } = options.input;
        let message = 'Reading reference documentation...';
        if (action === 'list') {
            message = 'Listing available reference docs...';
        } else if (action === 'read' && docId) {
            message = `Reading reference doc: ${docId}`;
        } else if (action === 'search' && query) {
            message = `Searching reference docs for: ${query}`;
        }
        return { invocationMessage: message };
    }
}

// ============================================================================
// migration_searchReferenceWorkflows — Search reference workflow/connection catalog
// ============================================================================

/**
 * migration_searchReferenceWorkflows — Search the catalog of real Logic Apps
 * Standard reference workflows and connections. Returns matching entries with
 * metadata (trigger types, action types, connector IDs, etc.) so the model
 * can pick the most relevant example before reading its full JSON.
 */
class SearchReferenceWorkflowsTool implements vscode.LanguageModelTool<SearchReferenceWorkflowsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<SearchReferenceWorkflowsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { query, category, limit } = options.input;
        const maxResults = limit || 10;

        try {
            const registry = ReferenceWorkflowRegistry.getInstance();

            if (!query || query.trim().length === 0) {
                // No query — list entries
                const entries = await registry.list(category);
                logger.info(
                    `[LMTool] migration_searchReferenceWorkflows: list returned ${entries.length} entries`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            totalEntries: entries.length,
                            entries: entries.slice(0, maxResults).map((e) => ({
                                id: e.id,
                                category: e.category,
                                folder: e.folder,
                                tags: e.tags,
                            })),
                        })
                    ),
                ]);
            }

            const results = await registry.search(query, category);
            logger.info(
                `[LMTool] migration_searchReferenceWorkflows: search "${query}" found ${results.length} results`
            );

            const output = results.slice(0, maxResults).map((r) => {
                const base: Record<string, unknown> = {
                    id: r.entry.id,
                    category: r.entry.category,
                    folder: r.entry.folder,
                    score: Math.round(r.score * 10) / 10,
                    tags: r.entry.tags,
                };

                if (r.entry.category === 'workflow') {
                    const w =
                        r.entry as import('../services/ReferenceWorkflowRegistry').WorkflowCatalogEntry;
                    base.triggerTypes = w.triggerTypes;
                    base.actionTypes = w.actionTypes;
                    base.serviceProviderIds = w.serviceProviderIds;
                    base.operationIds = w.operationIds;
                    if (w.apiConnectionRefs.length > 0) {
                        base.apiConnectionRefs = w.apiConnectionRefs;
                    }
                    base.actionCount = w.actionCount;
                    if (w.kind) {
                        base.kind = w.kind;
                    }
                } else if (r.entry.category === 'connection') {
                    const c =
                        r.entry as import('../services/ReferenceWorkflowRegistry').ConnectionCatalogEntry;
                    if (c.managedApis.length > 0) {
                        base.managedApis = c.managedApis;
                    }
                    if (c.serviceProviders.length > 0) {
                        base.serviceProviders = c.serviceProviders;
                    }
                }

                return base;
            });

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        { query, totalResults: results.length, results: output },
                        null,
                        2
                    )
                ),
            ]);
        } catch (err) {
            logger.error(
                '[LMTool] migration_searchReferenceWorkflows failed',
                err instanceof Error ? err : new Error(String(err))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<SearchReferenceWorkflowsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const { query } = options.input;
        return {
            invocationMessage: query
                ? `Searching reference workflows for: ${query}`
                : 'Listing reference workflow catalog...',
        };
    }
}

// ============================================================================
// migration_readReferenceWorkflow — Read a specific reference workflow/connection file
// ============================================================================

/**
 * migration_readReferenceWorkflow — Read the full JSON content of a reference
 * workflow.json or connections.json file by its catalog ID.
 */
class ReadReferenceWorkflowTool implements vscode.LanguageModelTool<ReadReferenceWorkflowInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ReadReferenceWorkflowInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { entryId, fileName } = options.input;

        try {
            const registry = ReferenceWorkflowRegistry.getInstance();
            const result = await registry.readFile(entryId, fileName);

            if (!result) {
                // Try fuzzy suggestions
                const suggestions = await registry.findSuggestions(entryId);
                logger.warn(
                    `[LMTool] migration_readReferenceWorkflow: entry "${entryId}" not found`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Entry not found: "${entryId}"`,
                            suggestions: suggestions.map((e) => ({
                                id: e.id,
                                folder: e.folder,
                                category: e.category,
                            })),
                        })
                    ),
                ]);
            }

            logger.info(
                `[LMTool] migration_readReferenceWorkflow: read "${result.path}" (${result.content.length} chars)`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        id: result.id,
                        path: result.path,
                        content: result.content,
                    })
                ),
            ]);
        } catch (err) {
            logger.error(
                '[LMTool] migration_readReferenceWorkflow failed',
                err instanceof Error ? err : new Error(String(err))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ReadReferenceWorkflowInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const { entryId, fileName } = options.input;
        const target = fileName ? `${entryId}/${fileName}` : entryId;
        return {
            invocationMessage: `Reading reference file: ${target}`,
        };
    }
}

// ============================================================================
// Tool: migration_getDiscoveryAnalysis
// ============================================================================

/**
 * migration_getDiscoveryAnalysis — Retrieves cached discovery analysis results
 * for a specific flow group. Returns the architecture (mermaid + explanation),
 * message flow sequence, component details, gap analysis, and migration patterns
 * that were already produced during the discovery stage — avoiding the need
 * to re-read and re-analyze all source artifacts during planning.
 */
class GetDiscoveryAnalysisTool implements vscode.LanguageModelTool<GetDiscoveryAnalysisInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetDiscoveryAnalysisInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { groupId, aspects } = options.input;

        if (!groupId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'groupId is required' })),
            ]);
        }

        // Get the cached discovery analysis for this group
        const cachedResult = SourceFlowVisualizer.getGroupAnalysis(groupId);
        if (!cachedResult) {
            // Also check if flow groups exist at all
            const flowGroups = SourceFlowVisualizer.getStaticCachedFlowGroups();
            const group = flowGroups?.groups.find((g) => g.id === groupId);

            logger.warn(
                `[LMTool] migration_getDiscoveryAnalysis: no cached analysis for group "${groupId}"` +
                    (group
                        ? ' (group exists but was not analyzed during discovery — user must click Analyse on this group first)'
                        : ' (group not found in cache)')
            );

            // Provide the group's artifact IDs so the agent can proceed efficiently
            const artifactIds = group?.artifactIds ?? [];
            const availableGroupsWithAnalysis: string[] = [];
            if (flowGroups) {
                for (const g of flowGroups.groups) {
                    if (SourceFlowVisualizer.getGroupAnalysis(g.id)) {
                        availableGroupsWithAnalysis.push(g.id);
                    }
                }
            }

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error:
                            `No cached discovery analysis found for group "${groupId}". ` +
                            (group
                                ? 'This group exists but was not individually analyzed during the discovery stage. '
                                : 'This group ID was not found in the flow groups cache. ') +
                            'Proceed by calling migration_getArtifactDetails and migration_readSourceFile for EACH artifact to understand the source architecture, then design the target.',
                        groupExists: !!group,
                        groupArtifactIds: artifactIds,
                        groupsWithCachedAnalysis: availableGroupsWithAnalysis,
                        availableGroups: flowGroups?.groups.map((g) => ({
                            id: g.id,
                            name: g.name,
                            artifactCount: g.artifactIds.length,
                        })),
                    })
                ),
            ]);
        }

        // Determine which aspects to include
        const allAspects: ('architecture' | 'messageFlow' | 'components' | 'gaps' | 'patterns')[] =
            ['architecture', 'messageFlow', 'components', 'gaps', 'patterns'];
        const requestedAspects = aspects && aspects.length > 0 ? aspects : allAspects;

        const result: Record<string, unknown> = {
            groupId,
            cached: true,
        };

        if (requestedAspects.includes('architecture')) {
            result.architecture = {
                mermaid: cachedResult.mermaid,
                explanation: cachedResult.explanation,
                summary: cachedResult.summary,
            };
        }

        if (requestedAspects.includes('messageFlow')) {
            result.messageFlow = cachedResult.messageFlow ?? [];
        }

        if (requestedAspects.includes('components')) {
            result.components = cachedResult.componentDetails ?? [];
        }

        if (requestedAspects.includes('gaps')) {
            result.gapAnalysis = cachedResult.gapAnalysis ?? [];
        }

        if (requestedAspects.includes('patterns')) {
            result.migrationPatterns = cachedResult.migrationPatterns ?? [];
        }

        // Add summary counts
        result.counts = {
            messageFlowSteps: (cachedResult.messageFlow ?? []).length,
            components: (cachedResult.componentDetails ?? []).length,
            gaps: (cachedResult.gapAnalysis ?? []).length,
            patterns: (cachedResult.migrationPatterns ?? []).length,
        };

        logger.info(
            `[LMTool] migration_getDiscoveryAnalysis: returned ${requestedAspects.join(', ')} for group "${groupId}" ` +
                `(${(cachedResult.componentDetails ?? []).length} components, ` +
                `${(cachedResult.messageFlow ?? []).length} flow steps, ` +
                `${(cachedResult.gapAnalysis ?? []).length} gaps, ` +
                `${(cachedResult.migrationPatterns ?? []).length} patterns)`
        );

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<GetDiscoveryAnalysisInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const aspects = options.input?.aspects;
        const aspectStr = aspects && aspects.length > 0 ? aspects.join(', ') : 'all aspects';
        return {
            invocationMessage: `Retrieving cached discovery analysis (${aspectStr}) for flow group...`,
        };
    }
}

// ============================================================================
// Planning File Tools (multi-file architecture)
// ============================================================================

/**
 * Stores the plan metadata (flowId, flowName, explanation, summary).
 * Creates the flow planning folder and writes plan-meta.json.
 */
class PlanningStoreMetaTool implements vscode.LanguageModelTool<PlanningStoreMetaInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningStoreMetaInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, flowName, explanation, summary } = options.input;

        if (!flowId || !flowName) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'flowId and flowName are required' })
                ),
            ]);
        }

        try {
            const fileService = PlanningFileService.getInstance();
            const now = new Date().toISOString();
            const filePath = fileService.storeMeta(flowId, {
                flowId,
                flowName,
                explanation: explanation || '',
                summary: summary || '',
                generatedAt: now,
                updatedAt: now,
            });

            logger.info(`[LMTool] migration_planning_storeMeta: stored for "${flowId}"`);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        file: PLANNING_FILES.META,
                        path: filePath,
                        message: `Plan metadata stored for "${flowName}". Now store individual planning files: architecture, workflow definition, azure components, action mappings, gaps, and patterns.`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_storeMeta failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store metadata: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningStoreMetaInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: `Storing plan metadata for flow: ${options.input.flowName || options.input.flowId}`,
        };
    }
}

class PlanningStoreArchitectureTool implements vscode.LanguageModelTool<PlanningStoreArchitectureInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningStoreArchitectureInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, mermaid } = options.input;

        if (!flowId || !mermaid) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'flowId and mermaid are required' })
                ),
            ]);
        }

        const validation = await MermaidValidationService.getInstance().validate(mermaid, {
            expectedDiagramTypes: FLOWCHART_MERMAID_TYPES,
        });
        if (!validation.valid) {
            logger.warn(
                `[LMTool] migration_planning_storeArchitecture: Mermaid validation failed for "${flowId}" — ${validation.error}`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'Invalid Mermaid diagram. Fix the parser error below and call this tool again.',
                        parserError: validation.error,
                        diagramType: validation.diagramType,
                        hint: 'Use a flowchart TB/TD/LR/RL diagram. Keep labels inside node brackets or quoted edge labels, and avoid raw unescaped double quotes in label text.',
                    })
                ),
            ]);
        }

        try {
            const fileService = PlanningFileService.getInstance();
            const filePath = fileService.storeArchitecture(flowId, validation.normalized);

            logger.info(`[LMTool] migration_planning_storeArchitecture: stored for "${flowId}"`);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        diagramType: validation.diagramType,
                        file: PLANNING_FILES.ARCHITECTURE,
                        path: filePath,
                        message: `Architecture diagram (Mermaid) stored for flow "${flowId}".`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_storeArchitecture failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store architecture: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningStoreArchitectureInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: `Storing architecture diagram (Mermaid) for flow...` };
    }
}

/**
 * Stores the Logic Apps Standard workflow.json definition for a flow.
 */
class PlanningStoreWorkflowDefinitionTool implements vscode.LanguageModelTool<PlanningStoreWorkflowDefinitionInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningStoreWorkflowDefinitionInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const {
            flowId,
            name,
            description,
            triggerType,
            actions,
            sourceArtifactIds,
            workflowDefinition,
        } = options.input;

        if (!flowId || !name || !workflowDefinition) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'flowId, name, and workflowDefinition are required' })
                ),
            ]);
        }

        // Validate workflow definition structure
        const def = workflowDefinition.definition || workflowDefinition;

        // Run schema validation
        const validation = validateWorkflowDefinition(def);
        if (!validation.valid) {
            logger.warn(
                `[LMTool] migration_planning_storeWorkflowDefinition: schema validation failed for "${flowId}" — ${validation.errors.length} error(s)`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'Workflow definition failed schema validation. Fix the issues below and call this tool again.',
                        validationErrors: validation.errors,
                        validationWarnings: validation.warnings,
                        hint: 'Ensure the definition has "$schema", "contentVersion" (e.g. "1.0.0.0"), and valid "triggers"/"actions" with correct "type" values.',
                    })
                ),
            ]);
        }

        // Log warnings even on success so the agent can address them
        if (validation.warnings.length > 0) {
            logger.info(
                `[LMTool] migration_planning_storeWorkflowDefinition: ${validation.warnings.length} warning(s) for "${flowId}":`
            );
            for (const w of validation.warnings) {
                logger.warn(`[LMTool]   ⚠ ${w}`);
            }
        }

        try {
            const fileService = PlanningFileService.getInstance();
            const rawMermaid = options.input.mermaid;
            let normalizedWorkflowMermaid: string | undefined;
            let workflowMermaidDiagramType: string | undefined;

            if (rawMermaid) {
                const mermaidValidation = await MermaidValidationService.getInstance().validate(
                    rawMermaid,
                    { expectedDiagramTypes: FLOWCHART_MERMAID_TYPES }
                );
                if (!mermaidValidation.valid) {
                    logger.warn(
                        `[LMTool] migration_planning_storeWorkflowDefinition: Mermaid validation failed for "${flowId}" workflow "${name}" — ${mermaidValidation.error}`
                    );
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify({
                                error: 'Invalid workflow Mermaid diagram. Fix the parser error below and call this tool again.',
                                parserError: mermaidValidation.error,
                                diagramType: mermaidValidation.diagramType,
                                hint: 'Use a flowchart TB/TD/LR/RL diagram for per-workflow Mermaid and keep all free text inside node labels.',
                            })
                        ),
                    ]);
                }

                normalizedWorkflowMermaid = mermaidValidation.normalized;
                workflowMermaidDiagramType = mermaidValidation.diagramType;
            }

            // Enforce per-workflow mermaid when multiple workflows exist
            const existingWorkflows = fileService.readAllWorkflowDefinitions(flowId);
            if (!normalizedWorkflowMermaid && existingWorkflows.length > 0) {
                // Another workflow already stored → multi-workflow scenario → mermaid is REQUIRED
                logger.warn(
                    `[LMTool] migration_planning_storeWorkflowDefinition: rejecting "${name}" — mermaid is required in multi-workflow scenarios (${existingWorkflows.length} workflow(s) already stored)`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Per-workflow mermaid diagram is REQUIRED because this flow already has ${existingWorkflows.length} other workflow(s) stored. Each workflow MUST include a "mermaid" field containing a flowchart TB diagram showing its specific triggers, actions, connectors, and data flow. Please call this tool again with the mermaid field included.`,
                            existingWorkflows: existingWorkflows.map((w) => w.name),
                            missingField: 'mermaid',
                        })
                    ),
                ]);
            }

            const filePath = fileService.storeWorkflowDefinition(flowId, {
                name,
                description: description || '',
                triggerType: triggerType || '',
                actions: actions || [],
                sourceArtifactIds: sourceArtifactIds || [],
                definition:
                    workflowDefinition as unknown as import('../workflowSchema/types').LogicAppsWorkflowDefinition,
                ...(normalizedWorkflowMermaid ? { mermaid: normalizedWorkflowMermaid } : {}),
            });

            const actionCount = def.actions ? Object.keys(def.actions).length : 0;
            const triggerCount = def.triggers ? Object.keys(def.triggers).length : 0;

            logger.info(
                `[LMTool] migration_planning_storeWorkflowDefinition: stored for "${flowId}" (${actionCount} actions, ${triggerCount} triggers)`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        workflowName: name,
                        path: filePath,
                        actionCount,
                        triggerCount,
                        hasMermaid: !!normalizedWorkflowMermaid,
                        mermaidDiagramType: workflowMermaidDiagramType,
                        message: `Workflow definition "${name}" stored for flow "${flowId}" with ${actionCount} actions and ${triggerCount} triggers. You can call this tool again for additional workflows.`,
                        ...(!normalizedWorkflowMermaid
                            ? {
                                  mermaidWarning:
                                      'No per-workflow mermaid diagram provided. If this flow has multiple workflows, each workflow MUST include a mermaid field with a flowchart TB diagram showing its triggers, actions, and data flow. Call this tool again with the mermaid field to add it.',
                              }
                            : {}),
                        ...(validation.warnings.length > 0
                            ? { warnings: validation.warnings }
                            : {}),
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_storeWorkflowDefinition failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store workflow definition: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningStoreWorkflowDefinitionInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: `Storing workflow definition "${options.input.name}" for flow...`,
        };
    }
}

/**
 * Stores the required Azure components for a flow.
 */
class PlanningStoreAzureComponentsTool implements vscode.LanguageModelTool<PlanningStoreAzureComponentsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningStoreAzureComponentsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, components } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        if (!Array.isArray(components)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'components must be an array of { name, type, reason }',
                    })
                ),
            ]);
        }

        // Validate each component has required fields
        for (let i = 0; i < components.length; i++) {
            const c = components[i];
            if (!c.name || !c.type || !c.reason) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Component at index ${i} is missing name, type, or reason`,
                        })
                    ),
                ]);
            }
        }

        try {
            const fileService = PlanningFileService.getInstance();
            const filePath = fileService.storeAzureComponents(
                flowId,
                components.map((c) => ({
                    name: c.name,
                    type: c.type,
                    reason: c.reason,
                    configNotes: c.configNotes,
                }))
            );

            logger.info(
                `[LMTool] migration_planning_storeAzureComponents: stored ${components.length} components for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        file: PLANNING_FILES.AZURE_COMPONENTS,
                        path: filePath,
                        count: components.length,
                        message: `${components.length} Azure component(s) stored for flow "${flowId}".`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_storeAzureComponents failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store Azure components: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningStoreAzureComponentsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: `Storing Azure components for flow...` };
    }
}

/**
 * Stores the action mappings (source → Logic Apps) for a flow.
 */
class PlanningStoreActionMappingsTool implements vscode.LanguageModelTool<PlanningStoreActionMappingsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningStoreActionMappingsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, mappings } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        if (!Array.isArray(mappings) || mappings.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'mappings must be a non-empty array of { source, target }',
                    })
                ),
            ]);
        }

        // Validate each mapping has required fields
        const missingNotes: number[] = [];
        for (let i = 0; i < mappings.length; i++) {
            const m = mappings[i];
            if (!m.source || !m.target) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Mapping at index ${i} is missing source or target`,
                        })
                    ),
                ]);
            }
            if (!m.notes || m.notes.trim().length === 0) {
                missingNotes.push(i);
            }
        }

        // Reject if any mappings are missing notes
        if (missingNotes.length > 0) {
            const examples = missingNotes
                .slice(0, 3)
                .map((i) => `"${mappings[i].source}"`)
                .join(', ');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error:
                            `${missingNotes.length} mapping(s) are missing the required "notes" field (e.g. ${examples}). ` +
                            'Every mapping must include notes explaining: connector type (built-in ServiceProvider vs managed ApiConnection), ' +
                            'key configuration (operationId, paths, schedules), or why the component is eliminated. ' +
                            'Please re-call with notes for every mapping.',
                    })
                ),
            ]);
        }

        try {
            const fileService = PlanningFileService.getInstance();
            const filePath = fileService.storeActionMappings(
                flowId,
                mappings.map((m) => ({
                    source: m.source,
                    target: m.target,
                    notes: m.notes,
                    workflowName: m.workflowName,
                }))
            );

            logger.info(
                `[LMTool] migration_planning_storeActionMappings: stored ${mappings.length} mappings for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        file: PLANNING_FILES.ACTION_MAPPINGS,
                        path: filePath,
                        count: mappings.length,
                        message: `${mappings.length} action mapping(s) stored for flow "${flowId}".`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_storeActionMappings failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store action mappings: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningStoreActionMappingsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: `Storing action mappings for flow...` };
    }
}

/**
 * Stores the migration gap analysis for a flow.
 */
class PlanningStoreGapsTool implements vscode.LanguageModelTool<PlanningStoreGapsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningStoreGapsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, gaps } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        if (!Array.isArray(gaps)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'gaps must be an array of { component, gap, severity, recommendation }',
                    })
                ),
            ]);
        }

        // Validate each gap entry
        for (let i = 0; i < gaps.length; i++) {
            const g = gaps[i];
            if (!g.component || !g.gap || !g.severity || !g.recommendation) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Gap at index ${i} is missing component, gap, severity, or recommendation`,
                        })
                    ),
                ]);
            }
            if (!['high', 'medium', 'low'].includes(g.severity)) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Gap at index ${i} has invalid severity "${g.severity}" — must be high, medium, or low`,
                        })
                    ),
                ]);
            }
        }

        try {
            const fileService = PlanningFileService.getInstance();
            const filePath = fileService.storeGaps(
                flowId,
                gaps.map((g) => ({
                    component: g.component,
                    gap: g.gap,
                    severity: g.severity,
                    recommendation: g.recommendation,
                }))
            );

            logger.info(
                `[LMTool] migration_planning_storeGaps: stored ${gaps.length} gaps for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        file: PLANNING_FILES.GAPS,
                        path: filePath,
                        count: gaps.length,
                        highCount: gaps.filter((g) => g.severity === 'high').length,
                        mediumCount: gaps.filter((g) => g.severity === 'medium').length,
                        lowCount: gaps.filter((g) => g.severity === 'low').length,
                        message: `${gaps.length} gap(s) stored for flow "${flowId}".`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_storeGaps failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store gaps: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningStoreGapsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: `Storing migration gaps for flow...` };
    }
}

/**
 * Stores the detected integration patterns for a flow.
 */
class PlanningStorePatternsTool implements vscode.LanguageModelTool<PlanningStorePatternsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningStorePatternsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, patterns } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        if (!Array.isArray(patterns)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'patterns must be an array of { name, sourceApproach, logicAppsApproach, complexity }',
                    })
                ),
            ]);
        }

        // Validate each pattern entry
        for (let i = 0; i < patterns.length; i++) {
            const p = patterns[i];
            if (!p.name || !p.sourceApproach || !p.logicAppsApproach || !p.complexity) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Pattern at index ${i} is missing name, sourceApproach, logicAppsApproach, or complexity`,
                        })
                    ),
                ]);
            }
            if (!['high', 'medium', 'low'].includes(p.complexity)) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Pattern at index ${i} has invalid complexity "${p.complexity}" — must be high, medium, or low`,
                        })
                    ),
                ]);
            }
        }

        try {
            const fileService = PlanningFileService.getInstance();
            const filePath = fileService.storePatterns(
                flowId,
                patterns.map((p) => ({
                    name: p.name,
                    sourceApproach: p.sourceApproach,
                    logicAppsApproach: p.logicAppsApproach,
                    complexity: p.complexity,
                }))
            );

            logger.info(
                `[LMTool] migration_planning_storePatterns: stored ${patterns.length} patterns for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        file: PLANNING_FILES.PATTERNS,
                        path: filePath,
                        count: patterns.length,
                        message: `${patterns.length} pattern(s) stored for flow "${flowId}".`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_storePatterns failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store patterns: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningStorePatternsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return { invocationMessage: `Storing integration patterns for flow...` };
    }
}

/**
 * Stores the artifact disposition assessment for a flow — what artifacts
 * need conversion (with notes explaining why) and where each artifact
 * should be uploaded (Integration Account, Logic App Artifacts folder, etc.).
 */
class PlanningStoreArtifactDispositionsTool implements vscode.LanguageModelTool<PlanningStoreArtifactDispositionsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningStoreArtifactDispositionsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, dispositions } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        if (!Array.isArray(dispositions)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: 'dispositions must be an array of { artifactName, artifactType, conversionRequired, uploadDestination, ... }',
                    })
                ),
            ]);
        }

        const validDestinations = [
            'integration-account',
            'logic-app-artifact-folder',
            'azure-function',
            'not-applicable',
        ];

        // Validate each disposition entry
        for (let i = 0; i < dispositions.length; i++) {
            const d = dispositions[i];
            if (
                !d.artifactName ||
                !d.artifactType ||
                d.conversionRequired === undefined ||
                !d.uploadDestination
            ) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Disposition at index ${i} is missing artifactName, artifactType, conversionRequired, or uploadDestination`,
                            hint: 'Each disposition must have: artifactName (string), artifactType (string), conversionRequired (boolean), uploadDestination ("integration-account" | "logic-app-artifact-folder" | "azure-function" | "not-applicable")',
                        })
                    ),
                ]);
            }
            if (!validDestinations.includes(d.uploadDestination)) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Disposition at index ${i} has invalid uploadDestination "${d.uploadDestination}" — must be one of: ${validDestinations.join(', ')}`,
                        })
                    ),
                ]);
            }
            if (d.conversionRequired && !d.conversionNotes) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Disposition at index ${i} ("${d.artifactName}") has conversionRequired=true but no conversionNotes. Please explain why conversion is needed.`,
                        })
                    ),
                ]);
            }
            if (!d.uploadNotes) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Disposition at index ${i} ("${d.artifactName}") is missing uploadNotes. Please explain why this upload destination was chosen.`,
                        })
                    ),
                ]);
            }
        }

        try {
            const fileService = PlanningFileService.getInstance();
            const filePath = fileService.storeArtifactDispositions(
                flowId,
                dispositions.map((d) => ({
                    artifactName: d.artifactName,
                    artifactType: d.artifactType,
                    conversionRequired: d.conversionRequired,
                    conversionFrom: d.conversionFrom,
                    conversionTo: d.conversionTo,
                    conversionNotes: d.conversionNotes,
                    uploadDestination: d.uploadDestination,
                    uploadPath: d.uploadPath,
                    uploadNotes: d.uploadNotes,
                }))
            );

            const conversionCount = dispositions.filter((d) => d.conversionRequired).length;
            const uploadCounts = {
                'integration-account': dispositions.filter(
                    (d) => d.uploadDestination === 'integration-account'
                ).length,
                'logic-app-artifact-folder': dispositions.filter(
                    (d) => d.uploadDestination === 'logic-app-artifact-folder'
                ).length,
                'azure-function': dispositions.filter(
                    (d) => d.uploadDestination === 'azure-function'
                ).length,
                'not-applicable': dispositions.filter(
                    (d) => d.uploadDestination === 'not-applicable'
                ).length,
            };

            logger.info(
                `[LMTool] migration_planning_storeArtifactDispositions: stored ${dispositions.length} dispositions for "${flowId}" (${conversionCount} need conversion)`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        file: PLANNING_FILES.ARTIFACT_DISPOSITIONS,
                        path: filePath,
                        count: dispositions.length,
                        conversionCount,
                        uploadCounts,
                        message: `${dispositions.length} artifact disposition(s) stored for flow "${flowId}". ${conversionCount} artifact(s) require conversion.`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_storeArtifactDispositions failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store artifact dispositions: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningStoreArtifactDispositionsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: `Storing artifact conversion & upload dispositions for flow...`,
        };
    }
}

/**
 * Finalizes the planning for a flow: validates all required files exist,
 * assembles a FlowPlanningResult, stores it in the planning cache, and
 * opens the Planning webview.
 */
class PlanningFinalizeTool implements vscode.LanguageModelTool<PlanningFinalizeInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningFinalizeInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, flowName } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        const fileService = PlanningFileService.getInstance();

        // Step 1: Validate all required files exist
        const validation = fileService.validate(flowId);
        if (!validation.valid) {
            const missing = validation.missingFiles.join(', ');
            logger.warn(
                `[LMTool] migration_planning_finalize: missing files for "${flowId}": ${missing}`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Cannot finalize: missing or invalid files: ${missing}`,
                        validation,
                        message: `Please create all required files before finalizing. Missing: ${missing}`,
                    })
                ),
            ]);
        }

        try {
            // Step 2: Read all files and assemble FlowPlanningResult
            const meta = fileService.readMeta(flowId);
            const mermaid = fileService.readArchitecture(flowId);

            if (!meta || !mermaid) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: 'Failed to read plan metadata or architecture diagram — files may be corrupted',
                        })
                    ),
                ]);
            }
            const workflowDefs = fileService.readAllWorkflowDefinitions(flowId);
            const azureComponents = fileService.readAzureComponents(flowId) ?? [];
            const actionMappings = fileService.readActionMappings(flowId) ?? [];
            const gaps = fileService.readGaps(flowId) ?? [];
            const patterns = fileService.readPatterns(flowId) ?? [];
            const artifactDispositions = fileService.readArtifactDispositions(flowId) ?? [];

            // Step 2.4: Enforce 1:1 orchestration → workflow rule.
            // Reject plans that map orchestrations to local functions instead of workflows.
            try {
                const { DiscoveryCacheService: DCS } =
                    await import('../stages/discovery/DiscoveryCacheService');
                const dAnalysis = DCS.getInstance().getAnalysis(flowId) as
                    | Record<string, unknown>
                    | undefined;
                const rawComponents = Array.isArray(dAnalysis?.componentDetails)
                    ? (dAnalysis.componentDetails as Record<string, unknown>[])
                    : [];
                const orchComponents = rawComponents.filter(
                    (c) => typeof c.type === 'string' && c.type.toLowerCase() === 'orchestration'
                );
                for (const oc of orchComponents) {
                    const orchName = (oc.name as string) || (oc.id as string) || 'unknown';
                    const equiv =
                        typeof oc.azureEquivalent === 'string'
                            ? oc.azureEquivalent.toLowerCase()
                            : '';
                    if (equiv.includes('local function') || equiv.includes('localfunction')) {
                        logger.warn(
                            `[LMTool] migration_planning_finalize: orchestration "${orchName}" mapped to local function instead of workflow`
                        );
                        return new vscode.LanguageModelToolResult([
                            new vscode.LanguageModelTextPart(
                                JSON.stringify({
                                    error: `Cannot finalize: orchestration "${orchName}" is mapped to a local function. Every orchestration (including sub-orchestrations) MUST map to its own Logic Apps workflow. Use the Workflow action type to invoke child workflows. Re-design the plan with one workflow per orchestration.`,
                                })
                            ),
                        ]);
                    }
                }
            } catch {
                // Non-critical — skip if discovery data unavailable
            }

            // Step 2.5: Enforce orchestration coverage against discovery analysis
            // Reject finalize if discovered orchestrations are not represented in planning artifacts.
            try {
                const { DiscoveryCacheService } =
                    await import('../stages/discovery/DiscoveryCacheService');
                const discoveryAnalysis = DiscoveryCacheService.getInstance().getAnalysis(
                    flowId
                ) as Record<string, unknown> | undefined;

                const normalizeText = (value: string): string =>
                    value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                const expectedOrchestrations = new Set<string>();

                const summaryObj =
                    discoveryAnalysis && typeof discoveryAnalysis.summary === 'object'
                        ? (discoveryAnalysis.summary as Record<string, unknown>)
                        : undefined;
                const summaryOrchestrations = Array.isArray(summaryObj?.orchestrations)
                    ? (summaryObj.orchestrations as unknown[])
                    : [];
                for (const name of summaryOrchestrations) {
                    if (typeof name === 'string' && name.trim().length > 0) {
                        expectedOrchestrations.add(name.trim());
                    }
                }

                const messageFlow = Array.isArray(discoveryAnalysis?.messageFlow)
                    ? (discoveryAnalysis.messageFlow as Record<string, unknown>[])
                    : [];
                for (const step of messageFlow) {
                    const componentType =
                        typeof step.componentType === 'string'
                            ? step.componentType.toLowerCase()
                            : '';
                    const componentName =
                        typeof step.component === 'string' ? step.component.trim() : '';
                    if (componentName && componentType.includes('orchestration')) {
                        expectedOrchestrations.add(componentName);
                    }
                }

                if (expectedOrchestrations.size > 0) {
                    const planningCoverageCorpus = [
                        ...workflowDefs.flatMap((wd) => [
                            wd.name,
                            wd.description,
                            ...(wd.actions || []),
                            ...(wd.sourceArtifactIds || []),
                        ]),
                        ...actionMappings.flatMap((m) => [
                            m.source,
                            m.target,
                            m.notes || '',
                            m.workflowName || '',
                        ]),
                        ...gaps.flatMap((g) => [g.component, g.gap, g.recommendation]),
                    ]
                        .filter(
                            (value): value is string =>
                                typeof value === 'string' && value.trim().length > 0
                        )
                        .map((value) => normalizeText(value));

                    const corpusText = planningCoverageCorpus.join(' ');
                    const missingOrchestrations = Array.from(expectedOrchestrations).filter(
                        (name) => {
                            const normalizedName = normalizeText(name);
                            if (!normalizedName) {
                                return false;
                            }
                            return !corpusText.includes(normalizedName);
                        }
                    );

                    if (missingOrchestrations.length > 0) {
                        logger.warn(
                            `[LMTool] migration_planning_finalize: orchestration coverage mismatch for "${flowId}" — missing: ${missingOrchestrations.join(', ')}`
                        );
                        return new vscode.LanguageModelToolResult([
                            new vscode.LanguageModelTextPart(
                                JSON.stringify({
                                    error: `Cannot finalize: planning does not cover all discovered orchestrations. Missing: ${missingOrchestrations.join(', ')}`,
                                    missingOrchestrations,
                                    expectedOrchestrations: Array.from(expectedOrchestrations),
                                    message:
                                        'Update planning artifacts before finalize: each discovered orchestration must be explicitly represented in workflow definitions, action mappings, or documented as a gap with recommendation.',
                                })
                            ),
                        ]);
                    }
                }
            } catch (coverageError) {
                logger.warn(
                    `[LMTool] migration_planning_finalize: failed to run orchestration coverage check for "${flowId}": ${coverageError instanceof Error ? coverageError.message : String(coverageError)}`
                );
            }

            const resolvedName = flowName || meta.flowName || flowId;

            // Build FlowPlanningResult
            const result: FlowPlanningResult = {
                flowId,
                flowName: resolvedName,
                generatedAt: meta.generatedAt,
                mermaid,
                explanation: meta.explanation,
                workflows: workflowDefs.map((wd) => ({
                    name: wd.name,
                    description: wd.description,
                    triggerType: wd.triggerType,
                    actions: wd.actions,
                    sourceArtifactIds: wd.sourceArtifactIds,
                    workflowDefinition: wd.definition,
                    mermaid: wd.mermaid,
                })),
                azureComponents: azureComponents.map((c) => ({
                    name: c.name,
                    type: c.type,
                    reason: c.reason,
                    configNotes: c.configNotes,
                })),
                connectorMappings: [],
                actionMappings: actionMappings.map((m) => ({
                    source: m.source,
                    target: m.target,
                    notes: m.notes,
                    workflowName: m.workflowName,
                })),
                gaps: gaps.map((g) => ({
                    component: g.component,
                    gap: g.gap,
                    severity: g.severity,
                    recommendation: g.recommendation,
                })),
                patterns: patterns.map((p) => ({
                    name: p.name,
                    sourceApproach: p.sourceApproach,
                    logicAppsApproach: p.logicAppsApproach,
                    complexity: p.complexity,
                })),
                artifactDispositions: artifactDispositions.map((d) => ({
                    artifactName: d.artifactName,
                    artifactType: d.artifactType,
                    conversionRequired: d.conversionRequired,
                    conversionFrom: d.conversionFrom,
                    conversionTo: d.conversionTo,
                    conversionNotes: d.conversionNotes,
                    uploadDestination: d.uploadDestination,
                    uploadPath: d.uploadPath,
                    uploadNotes: d.uploadNotes,
                })),
                summary: meta.summary,
            };

            // Step 3: Store in PlanningCacheService
            const cacheService = PlanningCacheService.getInstance();
            await cacheService.store(result);

            // Step 4: Store FlowMigrationPlan in PlanningService
            const planningService = PlanningService.getInstance();
            await planningService.storePlan(flowId, {
                flowId,
                flowName: resolvedName,
                generatedAt: meta.generatedAt,
                complexity: { score: 50, level: 'medium', factors: [] },
                patterns: patterns.map((p) => ({
                    name: p.name,
                    category: 'integration',
                    description: p.sourceApproach,
                    logicAppsEquivalent: p.logicAppsApproach,
                    confidence:
                        p.complexity === 'low'
                            ? 'high'
                            : p.complexity === 'high'
                              ? 'low'
                              : 'medium',
                })),
                connectorMappings: [],
                actionMappings: actionMappings.map((m) => ({
                    sourceAction: m.source,
                    targetAction: m.target,
                    mappingType: 'direct',
                    notes: m.notes,
                })),
                gaps: gaps.map((g, i) => ({
                    id: `gap-${i + 1}`,
                    component: g.component,
                    description: g.gap,
                    severity: g.severity,
                })),
                effortEstimate: {
                    totalHours: 0,
                    breakdown: { analysis: 0, conversion: 0, testing: 0, deployment: 0 },
                    confidence: 'low',
                },
                summary: meta.summary,
            });

            // Step 5: Do NOT auto-open Planning webview — let the user click "✓ Planned" from the flow group page
            // void vscode.commands.executeCommand('logicAppsMigrationAssistant.openPlanningView');

            // Step 6: Mark flow as planned in DiscoveryCacheService (for per-flow progressive UI)
            try {
                const { DiscoveryCacheService } =
                    await import('../stages/discovery/DiscoveryCacheService');
                await DiscoveryCacheService.getInstance().markFlowPlanned(flowId);
            } catch {
                // Non-critical
            }

            // Step 7: Clear planning-in-progress flag and refresh flow group selector
            try {
                const { SourceFlowVisualizer } =
                    await import('../views/discovery/SourceFlowVisualizer');
                SourceFlowVisualizer.planningGroupIds.delete(flowId);
                if (SourceFlowVisualizer.currentPanel) {
                    SourceFlowVisualizer.showFlowGroupSelector(
                        SourceFlowVisualizer.currentPanel.extensionUri
                    );
                }
            } catch {
                // Non-critical
            }

            // Step 8: Auto-open Planning webview for this flow in a new tab
            try {
                const { PlanningService } = await import('../stages/planning');
                const planningService = PlanningService.getInstance();
                if (planningService.getFlows().length === 0) {
                    planningService.buildFlowsFromDiscovery();
                }
                await planningService.selectFlow(flowId);
                const { PlanningWebviewPanel } = await import('../views/planning');
                const extensionUri2 =
                    vscode.extensions.getExtension('logicapps-migration-assistant')?.extensionUri ??
                    vscode.Uri.file(__dirname);
                PlanningWebviewPanel.createOrShow(extensionUri2);
            } catch (vizErr) {
                logger.warn(`[LMTool] Failed to auto-open planning view: ${vizErr}`);
            }

            logger.info(
                `[LMTool] migration_planning_finalize: finalized plan for "${flowId}" (${result.workflows.length} workflows, ${gaps.length} gaps, ${patterns.length} patterns, ${artifactDispositions.length} artifact dispositions)`
            );

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        flowName: resolvedName,
                        workflows: result.workflows.length,
                        azureComponents: azureComponents.length,
                        actionMappings: actionMappings.length,
                        gaps: gaps.length,
                        patterns: patterns.length,
                        artifactDispositions: artifactDispositions.length,
                        files: validation.files.map((f) => f.name),
                        message: `Planning finalized for flow "${resolvedName}". All ${validation.files.length} planning files validated. The plan is now visible in the Planning webview.`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_planning_finalize failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to finalize plan: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningFinalizeInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: `Finalizing migration plan for flow: ${options.input.flowName || options.input.flowId}`,
        };
    }
}

// ============================================================================
// Conversion Tools
// ============================================================================

// --------------- migration_conversion_getPlanningResults ---------------

class ConversionGetPlanningResultsTool implements vscode.LanguageModelTool<ConversionGetPlanningResultsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ConversionGetPlanningResultsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        try {
            const cacheService = PlanningCacheService.getInstance();
            const result = cacheService.get(flowId);

            if (!result) {
                logger.warn(
                    `[LMTool] migration_conversion_getPlanningResults: no planning results for "${flowId}"`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `No finalized planning results found for flow "${flowId}". Ensure the Planning stage is complete.`,
                        })
                    ),
                ]);
            }

            logger.info(
                `[LMTool] migration_conversion_getPlanningResults: returning plan for "${flowId}" (${result.workflows.length} workflows)`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(result)),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_conversion_getPlanningResults failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to read planning results: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ConversionGetPlanningResultsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: `Reading planning results for flow: ${options.input.flowId}`,
        };
    }
}

// --------------- migration_conversion_storeTaskPlan ---------------

class ConversionStoreTaskPlanTool implements vscode.LanguageModelTool<ConversionStoreTaskPlanInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ConversionStoreTaskPlanInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, flowName, summary, prerequisites, tasks } = options.input;

        if (!flowId || !tasks || tasks.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'flowId and a non-empty tasks array are required' })
                ),
            ]);
        }

        try {
            // Validate task IDs — reject generic sequential IDs like "task-1", "task-2" etc.
            const genericIdPattern = /^task-\d+$/i;
            const genericIds = tasks.filter((t) => genericIdPattern.test(t.id)).map((t) => t.id);
            if (genericIds.length > 0) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskPlan: REJECTED — generic task IDs found: ${genericIds.join(', ')}`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                `REJECTED: Task IDs must be descriptive, not generic sequential numbers. ` +
                                `Found generic IDs: ${genericIds.join(', ')}. ` +
                                `Replace with descriptive IDs that describe the task, e.g.: ` +
                                `"scaffold-project", "convert-schemas", "generate-workflow-receive-order", ` +
                                `"provision-servicebus", "validate-runtime", "test-workflows", "cloud-deploy-test". ` +
                                `Re-submit the task plan with descriptive IDs.`,
                        })
                    ),
                ]);
            }

            // Reject tasks whose name or description contains "stub" — all code must be fully implemented
            const stubTasks = tasks.filter((t) => {
                const nameLower = (t.name || '').toLowerCase();
                const descLower = (t.description || '').toLowerCase();
                return (
                    nameLower.includes('stub') ||
                    nameLower.includes('placeholder') ||
                    descLower.includes('stub implementation') ||
                    descLower.includes('placeholder implementation')
                );
            });
            if (stubTasks.length > 0) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskPlan: REJECTED — stub tasks found: ${stubTasks.map((t) => t.name).join(', ')}`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                `REJECTED: Task names/descriptions must NOT contain "stub" or "placeholder". ` +
                                `Found: ${stubTasks.map((t) => `"${t.name}"`).join(', ')}. ` +
                                `ALL code tasks MUST generate FULL, COMPLETE implementations with real business logic ` +
                                `translated from the source code (.cs, .vb files in the workspace or decompiled code in out/__decompiled__/). ` +
                                `Rename tasks to describe the actual full implementation (e.g., "Create .NET Local Functions" instead of "Create .NET Local Function Stubs"). ` +
                                `Re-submit the task plan with corrected names.`,
                        })
                    ),
                ]);
            }

            const summarizeForCard = (text: string): string => {
                const normalized = text.replace(/\s+/g, ' ').trim();
                if (!normalized) {
                    return 'Execute this task as planned.';
                }

                const maxChars = 420;
                const maxSentences = 5;

                if (normalized.length <= maxChars) {
                    return normalized;
                }

                const sentenceParts = normalized
                    .split(/(?<=[.!?])\s+/)
                    .map((s) => s.trim())
                    .filter(Boolean);

                const picked: string[] = [];
                let total = 0;

                for (const sentence of sentenceParts) {
                    const nextLength = total + (picked.length > 0 ? 1 : 0) + sentence.length;
                    if (nextLength > maxChars || picked.length >= maxSentences) {
                        break;
                    }
                    picked.push(sentence);
                    total = nextLength;
                }

                if (picked.length > 0) {
                    return picked.join(' ');
                }

                const clause = normalized
                    .split(/[,;]\s+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (clause.length > 0) {
                    let result = '';
                    for (const part of clause) {
                        const next = result ? `${result}, ${part}` : part;
                        if (next.length > maxChars) {
                            break;
                        }
                        result = next;
                    }
                    if (result) {
                        return result;
                    }
                }

                return normalized.slice(0, maxChars).trim();
            };

            const conversionTasks: ConversionTask[] = tasks.map((t) => {
                const rawDescription = (t.description || '').trim();
                const executionPrompt =
                    (t.executionPrompt && t.executionPrompt.trim().length > 0
                        ? t.executionPrompt
                        : rawDescription) || 'Execute this task as planned.';
                const description = summarizeForCard(rawDescription || executionPrompt);

                return {
                    id: t.id,
                    type: t.type,
                    name: t.name,
                    description,
                    executionPrompt,
                    dependsOn: t.dependsOn || [],
                    order: t.order,
                    status: 'pending' as const,
                    artifactIds: t.artifactIds,
                    estimatedMinutes: t.estimatedMinutes,
                    optional: t.type === 'cloud-deploy-test' || t.type === 'cloud-deployment-test',
                };
            });

            const taskPlan = {
                flowId,
                flowName: flowName || flowId,
                generatedAt: new Date().toISOString(),
                tasks: conversionTasks,
                summary: summary || '',
                prerequisites,
            };

            // Store to file
            const fileService = ConversionFileService.getInstance();
            fileService.storeTaskPlan(flowId, taskPlan);

            // Store in service (updates webview)
            const conversionService = ConversionService.getInstance();
            await conversionService.storeTaskPlan(flowId, taskPlan);

            // Do NOT auto-open conversion webview — let the user click "✓ Converted" from the flow group page
            // void vscode.commands.executeCommand('logicAppsMigrationAssistant.openConversionView');

            // Mark flow as converted in DiscoveryCacheService (for per-flow progressive UI)
            try {
                const { DiscoveryCacheService } =
                    await import('../stages/discovery/DiscoveryCacheService');
                await DiscoveryCacheService.getInstance().markFlowTasksCreated(flowId);
            } catch {
                // Non-critical
            }

            // Clear converting-in-progress flag and refresh flow group selector
            try {
                const { SourceFlowVisualizer } =
                    await import('../views/discovery/SourceFlowVisualizer');
                SourceFlowVisualizer.convertingGroupIds.delete(flowId);
                if (SourceFlowVisualizer.currentPanel) {
                    SourceFlowVisualizer.showFlowGroupSelector(
                        SourceFlowVisualizer.currentPanel.extensionUri
                    );
                }
            } catch {
                // Non-critical
            }

            // Auto-open Conversion webview for this flow in a new tab
            try {
                await conversionService.selectFlow(flowId);
                const { ConversionWebviewPanel } =
                    await import('../views/conversion/ConversionWebviewPanel');
                const extensionUri3 =
                    vscode.extensions.getExtension('logicapps-migration-assistant')?.extensionUri ??
                    vscode.Uri.file(__dirname);
                ConversionWebviewPanel.createOrShow(extensionUri3);
            } catch (vizErr) {
                logger.warn(`[LMTool] Failed to auto-open conversion view: ${vizErr}`);
            }

            logger.info(
                `[LMTool] migration_conversion_storeTaskPlan: stored ${tasks.length} tasks for "${flowId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        taskCount: tasks.length,
                        tasks: tasks.map((t) => ({ id: t.id, name: t.name, order: t.order })),
                        message: `Conversion task plan stored with ${tasks.length} tasks. The tasks are now visible in the Conversion webview. You can proceed to execute tasks when the user asks.`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_conversion_storeTaskPlan failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store task plan: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ConversionStoreTaskPlanInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: `Storing conversion task plan for flow: ${options.input.flowName || options.input.flowId} (${options.input.tasks?.length || 0} tasks)`,
        };
    }
}

// --------------- migration_conversion_storeTaskOutput ---------------

class ConversionStoreTaskOutputTool implements vscode.LanguageModelTool<ConversionStoreTaskOutputInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ConversionStoreTaskOutputInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId, taskId, summary, generatedFiles, warnings, data } = options.input;

        if (!flowId || !taskId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ error: 'flowId and taskId are required' })
                ),
            ]);
        }

        const summaryText = summary || '';
        const summaryLower = summaryText.toLowerCase();

        // Enforce end-to-end testing completeness for test-workflows tasks
        const conversionService = ConversionService.getInstance();
        const taskPlan = conversionService.getTaskPlan(flowId);
        const task = taskPlan?.tasks.find((t) => t.id === taskId);
        const taskContextLower =
            `${task?.id || ''} ${task?.name || ''} ${task?.type || ''} ${task?.description || ''}`.toLowerCase();

        // Reject summaries that explicitly admit incomplete implementation.
        const admittedIncompletePhrases = [
            'took a shortcut',
            'left as stub',
            'placeholder stub',
            'stubs that return mock data',
            'incomplete work',
            'not complete implementation',
            'partially implemented',
            'todo:',
            'todo ',
            'deferred',
        ];
        if (admittedIncompletePhrases.some((phrase) => summaryLower.includes(phrase))) {
            logger.warn(
                `[LMTool] migration_conversion_storeTaskOutput: REJECTED task output — summary admits incomplete implementation for task "${taskId}"`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error:
                            'REJECTED: Task output indicates incomplete implementation (shortcut/stub/deferred work). ' +
                            'Complete the implementation fully before storing output. ' +
                            'Do NOT leave local function stubs, placeholder logic, TODO paths, or deferred steps.',
                    })
                ),
            ]);
        }

        // Enforce isolated scaffold output location: out/<LogicAppName>/...
        if (
            task &&
            (task.type === 'scaffold-project' || task.type === 'scaffold' || task.order === 1)
        ) {
            const safeFlowName = (taskPlan?.flowName || flowId)
                .replace(/[^a-zA-Z0-9_-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            const normalizedGeneratedFiles = (generatedFiles || []).map((f) =>
                (f || '').replace(/\\/g, '/').replace(/^\.\//, '')
            );

            // Accept files under out/<safeFlowName>/ OR out/<safeFlowId>/ OR any out/<something>/
            const isUnderOut = normalizedGeneratedFiles.every((f) => f.startsWith('out/'));

            if (normalizedGeneratedFiles.length === 0 || !isUnderOut) {
                const expectedPrefix = `out/${safeFlowName}/`;
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                `REJECTED: Scaffold output files must be under "out/" (workspace-relative), e.g. "${expectedPrefix}". ` +
                                'Do not generate scaffold files in the source project root. ' +
                                'Regenerate the scaffold in out/<LogicAppName>/ and provide generatedFiles with that prefix.',
                        })
                    ),
                ]);
            }
        }

        if (task && (task.type === 'test-workflows' || task.type === 'test-workflow')) {
            // Get all workflow names from the task plan
            const workflowTasks =
                taskPlan?.tasks.filter(
                    (t) =>
                        t.type?.includes('workflow') &&
                        !t.type?.includes('test') &&
                        t.type !== 'test-workflows'
                ) || [];
            const workflowNames = workflowTasks
                .map((t) => {
                    // Extract workflow name from task name/description
                    const match =
                        t.name?.match(/workflow[:\s]+(\S+)/i) || t.id?.match(/workflow-(.+)/i);
                    return match ? match[1] : t.name;
                })
                .filter(Boolean);

            // Check that the summary mentions test results (pass/fail/success/error)
            const hasTestResults =
                summaryLower.includes('tested') ||
                summaryLower.includes('passed') ||
                summaryLower.includes('success') ||
                summaryLower.includes('failed') ||
                summaryLower.includes('triggered') ||
                summaryLower.includes('verified');

            // Check for multi-path testing (not just happy path)
            const hasMultiPathTesting =
                summaryLower.includes('error path') ||
                summaryLower.includes('failure path') ||
                summaryLower.includes('invalid') ||
                summaryLower.includes('malformed') ||
                summaryLower.includes('timeout') ||
                summaryLower.includes('resubmission') ||
                summaryLower.includes('cross-workflow') ||
                summaryLower.includes('chain') ||
                summaryLower.includes('all paths') ||
                summaryLower.includes('scenario');

            if (!hasTestResults) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskOutput: REJECTED test-workflows task — summary does not contain test results`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                'REJECTED: End-to-end testing task requires actual test results in the summary. ' +
                                'You MUST actually trigger each workflow, verify its execution, and report the results. ' +
                                'The summary must include for EACH workflow: (1) workflow name, (2) trigger type used, (3) test result (success/failure), (4) any errors fixed. ' +
                                'Do NOT mark this task complete without actually running the tests. ' +
                                (workflowNames.length > 0
                                    ? `Workflows to test: ${workflowNames.join(', ')}. `
                                    : '') +
                                'IMPORTANT: Test ALL paths — happy path, error/failure path, cross-workflow chains, timeout/retry paths. Do NOT test only the happy path.',
                        })
                    ),
                ]);
            }

            if (!hasMultiPathTesting) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskOutput: REJECTED test-workflows — only happy path tested, missing error/chain/timeout paths`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                'REJECTED: Testing only covers the happy path. You MUST also test: ' +
                                '(1) Error/failure path — send invalid/malformed input and verify error handling works (error reports, failed message routing, suspension). ' +
                                '(2) Cross-workflow chain — if workflows chain together (via Service Bus, HTTP, partner port), test the ENTIRE chain end-to-end with both valid and invalid inputs. ' +
                                '(3) Timeout/retry path — if any workflow has timeout or retry logic, test it by NOT sending the follow-up message. ' +
                                '(4) Resubmission path — if the flow supports resubmission, test the full resubmit cycle. ' +
                                'Include the word "error path", "scenario", "invalid", "chain", or "all paths" in your summary to confirm multi-path coverage. ' +
                                'Report EACH test scenario: name, input, expected outcome, actual outcome (Pass/Fail), and any fixes applied.',
                        })
                    ),
                ]);
            }
        }

        // Enforce SQL task completeness: no Docker deferrals and clear provisioning evidence.
        const isSqlRelatedTask =
            taskContextLower.includes('sql') ||
            taskContextLower.includes('database') ||
            taskContextLower.includes('mssql') ||
            taskContextLower.includes('wcf-sql');
        if (task && isSqlRelatedTask) {
            const hasDockerCheckEvidence =
                summaryLower.includes('docker --version') ||
                summaryLower.includes('docker version') ||
                summaryLower.includes('docker ps') ||
                summaryLower.includes('docker api');
            const hasDockerSqlProvisionEvidence =
                summaryLower.includes('docker run') ||
                summaryLower.includes('mcr.microsoft.com/mssql') ||
                summaryLower.includes('sql container') ||
                summaryLower.includes('localhost,1433');
            const hasAzureSqlProvisionEvidence =
                summaryLower.includes('az sql') ||
                summaryLower.includes('azure sql') ||
                summaryLower.includes('sql server create');
            const admitsDockerDeferral =
                summaryLower.includes('defer') ||
                summaryLower.includes('assumed docker') ||
                summaryLower.includes('docker wasn') ||
                summaryLower.includes('failed to connect to docker api');

            if (admitsDockerDeferral) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskOutput: REJECTED SQL task — summary indicates Docker/SQL deferral for task "${taskId}"`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                'REJECTED: SQL-related task cannot be deferred after a Docker/API issue. ' +
                                'Re-check Docker availability (docker --version, docker ps), retry provisioning, ' +
                                'and complete SQL setup before storing task output.',
                        })
                    ),
                ]);
            }

            if (!hasDockerCheckEvidence) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskOutput: REJECTED SQL task — missing Docker availability check evidence for task "${taskId}"`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: 'REJECTED: SQL-related task summary must include Docker availability checks (docker --version and docker ps) before deciding local vs cloud provisioning.',
                        })
                    ),
                ]);
            }

            if (!hasDockerSqlProvisionEvidence && !hasAzureSqlProvisionEvidence) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskOutput: REJECTED SQL task — no provisioning evidence for task "${taskId}"`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                'REJECTED: SQL-related task summary must include concrete provisioning evidence ' +
                                '(Docker SQL container setup or Azure SQL provisioning commands/results).',
                        })
                    ),
                ]);
            }
        }

        // Enforce runtime validation completeness
        if (task && task.type === 'validate-runtime') {
            const hasRuntimeResult =
                summaryLower.includes('func start') ||
                summaryLower.includes('runtime start') ||
                summaryLower.includes('started cleanly') ||
                summaryLower.includes('no errors') ||
                summaryLower.includes('runtime validation');

            if (!hasRuntimeResult) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskOutput: REJECTED validate-runtime task — summary does not contain runtime validation results`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                'REJECTED: Runtime validation task requires proof that "func start --verbose" was executed. ' +
                                'You MUST actually run func start in the project folder, check the output for errors, fix any issues, and re-run until clean. ' +
                                'The summary must confirm the runtime started successfully with no errors.',
                        })
                    ),
                ]);
            }
        }

        // Enforce cloud deployment testing completeness
        // This task is optional and only executed when the user explicitly clicks Execute.
        // The agent should always deploy and test — never skip on its own.
        if (task && (task.type === 'cloud-deploy-test' || task.type === 'cloud-deployment-test')) {
            const hasCloudDeployment =
                summaryLower.includes('deployed') ||
                summaryLower.includes('logicapp') ||
                summaryLower.includes('logic app') ||
                summaryLower.includes('cloud-test-report') ||
                summaryLower.includes('cloud test') ||
                summaryLower.includes('arm') ||
                summaryLower.includes('bicep');

            if (!hasCloudDeployment) {
                logger.warn(
                    `[LMTool] migration_conversion_storeTaskOutput: REJECTED cloud-deploy-test — no cloud deployment evidence`
                );
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error:
                                'REJECTED: The user explicitly chose to execute this cloud deployment task. ' +
                                'You must deploy the project to Azure and run tests. Include proof of Azure deployment ' +
                                'using ARM/Bicep template (NOT zip deploy) and cloud test results in the summary. ' +
                                'Generate CLOUD-TEST-REPORT.md with deployment details and test results.',
                        })
                    ),
                ]);
            }
        }

        try {
            const output: ConversionTaskOutput = {
                completedAt: new Date().toISOString(),
                summary: summary || 'Task completed',
                generatedFiles,
                warnings,
                data,
            };

            // Store to file
            const fileService = ConversionFileService.getInstance();
            fileService.storeTaskOutput(flowId, taskId, output);

            // Update in service (updates webview)
            const conversionService = ConversionService.getInstance();
            await conversionService.storeTaskOutput(flowId, taskId, output);

            // Determine the actual status (skipped vs completed)
            const taskPlan2 = conversionService.getTaskPlan(flowId);
            const updatedTask = taskPlan2?.tasks.find((t) => t.id === taskId);
            const actualStatus = updatedTask?.status || 'completed';

            logger.info(
                `[LMTool] migration_conversion_storeTaskOutput: stored output for task "${taskId}" in flow "${flowId}" (status: ${actualStatus})`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        taskId,
                        message: `Task "${taskId}" marked as ${actualStatus}. ${generatedFiles?.length || 0} files generated.`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_conversion_storeTaskOutput failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to store task output: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ConversionStoreTaskOutputInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: `Storing output for conversion task: ${options.input.taskId}`,
        };
    }
}

// --------------- migration_conversion_finalize ---------------

class ConversionFinalizeTool implements vscode.LanguageModelTool<ConversionFinalizeInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ConversionFinalizeInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const logger = LoggingService.getInstance();
        const { flowId } = options.input;

        if (!flowId) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify({ error: 'flowId is required' })),
            ]);
        }

        try {
            const conversionService = ConversionService.getInstance();
            const plan = conversionService.getTaskPlan(flowId);

            if (!plan) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `No conversion task plan found for flow "${flowId}".`,
                        })
                    ),
                ]);
            }

            // Check if all required tasks are complete (optional tasks can remain pending)
            const incomplete = plan.tasks.filter(
                (t) => t.status !== 'completed' && t.status !== 'skipped' && !t.optional
            );
            if (incomplete.length > 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            error: `Cannot finalize: ${incomplete.length} tasks are not yet completed`,
                            incompleteTasks: incomplete.map((t) => ({
                                id: t.id,
                                name: t.name,
                                status: t.status,
                            })),
                        })
                    ),
                ]);
            }

            // Mark the flow as completed
            const flow = conversionService.getFlows().find((f) => f.id === flowId);
            if (flow) {
                flow.status = 'completed';
            }

            // Mark flow as fully converted in DiscoveryCacheService
            try {
                const { DiscoveryCacheService } =
                    await import('../stages/discovery/DiscoveryCacheService');
                await DiscoveryCacheService.getInstance().markFlowConverted(flowId);
            } catch {
                // Non-critical
            }

            // Clear executing flag and refresh flow group selector
            try {
                const { SourceFlowVisualizer } =
                    await import('../views/discovery/SourceFlowVisualizer');
                SourceFlowVisualizer.executingGroupIds.delete(flowId);
                if (SourceFlowVisualizer.currentPanel) {
                    SourceFlowVisualizer.showFlowGroupSelector(
                        SourceFlowVisualizer.currentPanel.extensionUri
                    );
                }
            } catch {
                // Non-critical
            }

            // Open conversion webview
            void vscode.commands.executeCommand('logicAppsMigrationAssistant.openConversionView');

            logger.info(
                `[LMTool] migration_conversion_finalize: flow "${flowId}" conversion completed (${plan.tasks.length} tasks)`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        flowId,
                        totalTasks: plan.tasks.length,
                        message: `Conversion finalized for flow "${flowId}". All ${plan.tasks.length} tasks completed. The Conversion webview has been refreshed.`,
                    })
                ),
            ]);
        } catch (error) {
            logger.error(
                '[LMTool] migration_conversion_finalize failed',
                error instanceof Error ? error : new Error(String(error))
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        error: `Failed to finalize conversion: ${error instanceof Error ? error.message : String(error)}`,
                    })
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ConversionFinalizeInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: `Finalizing conversion for flow: ${options.input.flowId}`,
        };
    }
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register all migration LM tools with VS Code.
 *
 * @param context Extension context for disposable management.
 * @returns Array of disposables.
 */
export function registerMigrationLMTools(context: vscode.ExtensionContext): vscode.Disposable[] {
    const logger = LoggingService.getInstance();
    const disposables: vscode.Disposable[] = [];

    disposables.push(vscode.lm.registerTool('migration_listArtifacts', new ListArtifactsTool()));
    disposables.push(
        vscode.lm.registerTool('migration_getArtifactDetails', new GetArtifactDetailsTool())
    );
    disposables.push(vscode.lm.registerTool('migration_readSourceFile', new ReadSourceFileTool()));
    disposables.push(
        vscode.lm.registerTool('migration_searchArtifacts', new SearchArtifactsTool())
    );
    disposables.push(
        vscode.lm.registerTool('migration_getMigrationContext', new GetMigrationContextTool())
    );
    disposables.push(
        vscode.lm.registerTool('migration_detectFlowGroups', new DetectFlowGroupsTool())
    );
    disposables.push(
        vscode.lm.registerTool('migration_discovery_storeFlowGroups', new StoreFlowGroupsTool())
    );
    disposables.push(
        vscode.lm.registerTool('migration_discovery_storeMeta', new DiscoveryStoreMetaTool())
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_discovery_storeArchitecture',
            new DiscoveryStoreArchitectureTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_discovery_storeMessageFlow',
            new DiscoveryStoreMessageFlowTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_discovery_storeComponents',
            new DiscoveryStoreComponentsTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool('migration_discovery_storeGaps', new DiscoveryStoreGapsTool())
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_discovery_storePatterns',
            new DiscoveryStorePatternsTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_discovery_storeDependencies',
            new DiscoveryStoreDependenciesTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool('migration_discovery_finalize', new DiscoveryFinalizeTool())
    );
    disposables.push(
        vscode.lm.registerTool('migration_readReferenceDoc', new ReadReferenceDocTool())
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_searchReferenceWorkflows',
            new SearchReferenceWorkflowsTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool('migration_readReferenceWorkflow', new ReadReferenceWorkflowTool())
    );
    disposables.push(
        vscode.lm.registerTool('migration_getDiscoveryAnalysis', new GetDiscoveryAnalysisTool())
    );

    // Planning file tools (multi-file architecture)
    disposables.push(
        vscode.lm.registerTool('migration_planning_storeMeta', new PlanningStoreMetaTool())
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_planning_storeArchitecture',
            new PlanningStoreArchitectureTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_planning_storeWorkflowDefinition',
            new PlanningStoreWorkflowDefinitionTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_planning_storeAzureComponents',
            new PlanningStoreAzureComponentsTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_planning_storeActionMappings',
            new PlanningStoreActionMappingsTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool('migration_planning_storeGaps', new PlanningStoreGapsTool())
    );
    disposables.push(
        vscode.lm.registerTool('migration_planning_storePatterns', new PlanningStorePatternsTool())
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_planning_storeArtifactDispositions',
            new PlanningStoreArtifactDispositionsTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool('migration_planning_finalize', new PlanningFinalizeTool())
    );

    // Conversion tools
    disposables.push(
        vscode.lm.registerTool(
            'migration_conversion_getPlanningResults',
            new ConversionGetPlanningResultsTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_conversion_storeTaskPlan',
            new ConversionStoreTaskPlanTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool(
            'migration_conversion_storeTaskOutput',
            new ConversionStoreTaskOutputTool()
        )
    );
    disposables.push(
        vscode.lm.registerTool('migration_conversion_finalize', new ConversionFinalizeTool())
    );

    // Add all disposables to extension context
    for (const d of disposables) {
        context.subscriptions.push(d);
    }

    logger.info('[LMTools] Registered 25 migration language model tools');
    return disposables;
}
