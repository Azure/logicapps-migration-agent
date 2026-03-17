/**
 * Artifact Connection Graph & Flow Types Service
 *
 * Provides deterministic connection graph analysis for integration artifacts
 * and type definitions for flow visualization. The Agent chat uses
 * `buildArtifactConnectionGraph()` to discover artifact relationships,
 * then determines flow groups and generates diagrams itself.
 *
 * @module services/LLMFlowGenerator
 */

import { ParsedArtifact } from '../stages/discovery/types';

/**
 * Component detail for educational view
 */
export interface ComponentDetail {
    id: string;
    name: string;
    type: string;
    description: string;
    purpose: string;
    inputMessageType?: string;
    outputMessageType?: string;
    connectedTo?: string[];
    properties?: Record<string, string>;
    azureEquivalent?: string;
    /** True if equivalent is a native Logic Apps Standard connector/action */
    isLogicAppsNative?: boolean;
}

/**
 * Pipeline component detail for message flow
 */
interface PipelineComponentDetail {
    name: string;
    stage:
        | 'Decode'
        | 'Disassemble'
        | 'Validate'
        | 'ResolveParty'
        | 'PreAssemble'
        | 'Assemble'
        | 'Encode';
    description: string;
    properties?: Record<string, string>;
}

/**
 * Property promotion/demotion detail
 */
interface PropertyDetail {
    name: string;
    namespace?: string;
    type: 'promoted' | 'written' | 'demoted';
    source?: string;
    value?: string;
}

/**
 * Subscription filter detail
 */
interface SubscriptionFilterDetail {
    expression: string;
    readableExpression: string;
    conditions: {
        property: string;
        operator: string;
        value: string;
    }[];
}

/**
 * Message flow step
 */
export interface MessageFlowStep {
    step: number;
    component: string;
    componentType: string;
    action: string;
    messageType?: string;
    description: string;
    /** Pipeline components and their stages (for pipeline steps) */
    pipelineComponents?: PipelineComponentDetail[];
    /** Properties promoted, written, or demoted */
    properties?: PropertyDetail[];
    /** Subscription filter details (for steps that subscribe to MessageBox) */
    subscriptionFilter?: SubscriptionFilterDetail;
    /** Additional details specific to this step type */
    additionalDetails?: Record<string, unknown>;
}

/**
 * A logical grouping of related artifacts (detected by LLM)
 */
export interface FlowGroup {
    /** Unique group ID */
    id: string;
    /** Display name for the group */
    name: string;
    /** Description of what this group represents */
    description: string;
    /** Business domain or integration pattern */
    category:
        | 'message-flow'
        | 'business-process'
        | 'integration-pattern'
        | 'adapter-group'
        | 'domain'
        | 'shared-infrastructure'
        | 'other';
    /** Artifact IDs in this group */
    artifactIds: string[];
    /** Mermaid diagram for just this group */
    mermaid?: string;
    /** Summary for this group */
    summary?: {
        receivePorts: number;
        orchestrations: number;
        maps: number;
        sendPorts: number;
    };
    /** Entry point for this flow (if message-flow category) */
    entryPoint?: {
        type: 'receive-location' | 'receive-port' | 'orchestration';
        name: string;
        messageType?: string;
    };
    /** Exit points for this flow */
    exitPoints?: {
        type: 'send-port' | 'orchestration';
        name: string;
        messageType?: string;
    }[];
}

/**
 * Result of flow group detection
 */
export interface FlowGroupsResult {
    /** Detected flow groups */
    groups: FlowGroup[];
    /** Artifacts not assigned to any group */
    ungroupedArtifactIds: string[];
    /** Overall explanation of the grouping */
    explanation: string;
}

/**
 * A deterministic connection between two artifacts discovered from IR data
 */
interface ArtifactConnection {
    fromId: string;
    toId: string;
    type:
        | 'subscription-filter'
        | 'message-type-subscription'
        | 'map-source-schema'
        | 'map-target-schema'
        | 'orchestration-uses-map'
        | 'orchestration-calls'
        | 'shared-namespace'
        | 'binding-references';
    evidence: string;
}

/**
 * Pre-computed connection graph between artifacts
 */
interface ArtifactConnectionGraph {
    connections: ArtifactConnection[];
}

/**
 * A missing dependency identified during deep analysis
 */
/**
 * Dependency types across all supported source platforms.
 *
 * Platform coverage:
 *   BizTalk  — dll, assembly, schema, map, pipeline, orchestration, binding
 *   MuleSoft — jar, connector, module (DataWeave), api-spec (RAML/OAS), subflow
 *   General  — package (Maven/NuGet/npm), resource, configuration, other
 */
type MissingDependencyType =
    // .NET / BizTalk
    | 'dll'
    | 'assembly'
    // Java / cross-platform
    | 'jar'
    // Artifact references (cross-platform)
    | 'schema'
    | 'map'
    | 'pipeline'
    | 'orchestration'
    | 'binding'
    // Reusable components
    | 'connector'
    | 'library'
    | 'module'
    | 'subflow'
    // Specifications & config
    | 'api-spec'
    | 'resource'
    | 'configuration'
    | 'policy'
    // Build / packaging
    | 'package'
    // Code
    | 'custom-code'
    | 'recipe'
    // Catch-all
    | 'other';

/**
 * Classification of a dependency's origin.
 * Used to distinguish standard/framework dependencies from custom ones.
 */
type DependencyOrigin =
    | 'standard-framework' // .NET Framework (System.*, mscorlib)
    | 'standard-biztalk' // BizTalk Runtime (Microsoft.BizTalk.*, Microsoft.XLANGs.*)
    | 'standard-platform' // Other platform runtimes (Mule runtime modules, IIB built-in nodes, etc.)
    | 'third-party' // Known third-party libraries (Newtonsoft.Json, NLog, log4net, etc.)
    | 'custom' // Organization-specific / unknown DLLs
    | 'unknown'; // Cannot determine origin

interface MissingDependency {
    /** Unique identifier */
    id: string;
    /** Name of the missing dependency */
    name: string;
    /** Type of dependency (platform-agnostic — see MissingDependencyType) */
    type: MissingDependencyType;
    /** Origin classification — standard, third-party, custom, or unknown */
    origin: DependencyOrigin;
    /** Source platform this dependency belongs to (if known) */
    platform?: string;
    /** Version referenced in the source project (if known) */
    version?: string;
    /** Which artifact(s) reference this dependency */
    referencedBy: string[];
    /** Flow group(s) this dependency affects */
    affectedFlowGroups?: string[];
    /** Why this dependency is needed */
    reason: string;
    /** Severity of the missing dependency */
    severity: 'critical' | 'warning' | 'info';
    /** Expected file path or assembly name */
    expectedLocation?: string;
    /** Suggestion for resolving */
    resolution?: string;
    /** Whether this blocks migration to the next stage */
    blocksMigration: boolean;
    /** Whether this dependency is relevant to Logic Apps Standard migration.
     *  false for: build artifacts (.snk), standard platform assemblies, standard framework assemblies,
     *  design-time-only files, etc. */
    migrationRelevant: boolean;
}

/**
 * Result of dependency analysis for a flow group or full project
 */
interface DependencyAnalysisResult {
    /** List of missing dependencies found */
    missingDependencies: MissingDependency[];
    /** Overall health summary */
    summary: string;
    /** Whether all critical dependencies are resolved */
    allCriticalResolved: boolean;
    /** Count by severity */
    counts: {
        critical: number;
        warning: number;
        info: number;
    };
}

/**
 * Generated flow result
 */
export interface GeneratedFlowResult {
    /** Mermaid diagram syntax */
    mermaid: string;
    /** Human-readable explanation */
    explanation: string;
    /** Artifact summary */
    summary: {
        receiveLocations: string[];
        receivePipelines: string[];
        receivePorts: string[];
        orchestrations: string[];
        maps: string[];
        schemas: string[];
        sendPorts: string[];
        sendPipelines: string[];
    };
    /** Detailed component information for education */
    componentDetails?: ComponentDetail[];
    /** Step-by-step message flow */
    messageFlow?: MessageFlowStep[];
    /** Warnings or notes */
    notes?: string[];
    /** Flow groups for large artifact sets (optional) */
    flowGroups?: FlowGroupsResult;
    /** Missing dependency analysis */
    dependencyAnalysis?: DependencyAnalysisResult;
    /** Gap analysis: components that can't be easily migrated */
    gapAnalysis?: {
        component: string;
        componentType: string;
        gap: string;
        severity: 'high' | 'medium' | 'low';
        options: string[];
        recommendation: string;
    }[];
    /** Migration patterns: BizTalk patterns hard to migrate to Logic Apps */
    migrationPatterns?: {
        pattern: string;
        description: string;
        complexity: 'high' | 'medium' | 'low';
        biztalkApproach: string;
        logicAppsApproach: string;
        components: string[];
    }[];
}

/**
 * Artifact Connection Graph & Flow Types Service
 *
 * Builds deterministic connection graphs from parsed integration artifacts
 * by analyzing subscription filters, schema references, map source/target,
 * pipeline references, and orchestration correlations.
 */
export class LLMFlowGenerator {
    private static instance: LLMFlowGenerator;

    private constructor() {}

    public static getInstance(): LLMFlowGenerator {
        if (!LLMFlowGenerator.instance) {
            LLMFlowGenerator.instance = new LLMFlowGenerator();
        }
        return LLMFlowGenerator.instance;
    }

    /**
     * Recursively collect all actions from an action tree (including nested
     * actions inside conditions, scopes, loops, parallel branches, etc.).
     */
    private collectAllActions(actions: readonly unknown[]): readonly Record<string, unknown>[] {
        const result: Record<string, unknown>[] = [];
        for (const action of actions) {
            const a = action as Record<string, unknown>;
            result.push(a);
            // Recurse into nested action arrays (scope body)
            if (Array.isArray(a.actions)) {
                result.push(...this.collectAllActions(a.actions));
            }
            // Condition branches — check BOTH possible locations:
            // Location 1: action.branches.true / action.branches.false (BizTalk parser format)
            const branches = a.branches as { true?: unknown[]; false?: unknown[] } | undefined;
            if (branches) {
                if (Array.isArray(branches.true)) {
                    result.push(...this.collectAllActions(branches.true));
                }
                if (Array.isArray(branches.false)) {
                    result.push(...this.collectAllActions(branches.false));
                }
            }
            // Location 2: config.trueActions / config.falseActions (IR standard format)
            if (a.type === 'condition') {
                const config = a.config as
                    | { trueActions?: unknown[]; falseActions?: unknown[] }
                    | undefined;
                if (Array.isArray(config?.trueActions)) {
                    result.push(...this.collectAllActions(config.trueActions));
                }
                if (Array.isArray(config?.falseActions)) {
                    result.push(...this.collectAllActions(config.falseActions));
                }
            }
            // Switch cases — check config.cases[].actions
            if (a.type === 'switch') {
                const switchConfig = a.config as { cases?: { actions?: unknown[] }[] } | undefined;
                if (Array.isArray(switchConfig?.cases)) {
                    for (const c of switchConfig.cases) {
                        if (Array.isArray(c.actions)) {
                            result.push(...this.collectAllActions(c.actions));
                        }
                    }
                }
            }
            // Scope / foreach / until — check config.actions
            const innerConfig = a.config as { actions?: unknown[] } | undefined;
            if (Array.isArray(innerConfig?.actions)) {
                result.push(...this.collectAllActions(innerConfig.actions));
            }
        }
        return result;
    }

    /**
     * Deterministically build a connection graph between artifacts by analyzing
     * actual IR data: subscription filters, schema references, map source/target,
     * pipeline references, and orchestration correlations.
     */
    public buildArtifactConnectionGraph(artifacts: ParsedArtifact[]): ArtifactConnectionGraph {
        const connections: ArtifactConnection[] = [];
        const artifactById = new Map<string, ParsedArtifact>();
        const artifactsBySchema = new Map<string, string[]>(); // schema key → artifact IDs
        const artifactsByNamespace = new Map<string, string[]>(); // namespace → artifact IDs
        const receivePortArtifacts = new Map<string, string>(); // portName → artifact ID

        // Index all artifacts
        for (const a of artifacts) {
            artifactById.set(a.id, a);

            // Index by schema name and namespace
            if (a.ir.schemas) {
                for (const schema of a.ir.schemas) {
                    if (schema.name) {
                        const key = schema.name;
                        if (!artifactsBySchema.has(key)) {
                            artifactsBySchema.set(key, []);
                        }
                        artifactsBySchema.get(key)?.push(a.id);
                    }
                    if (schema.targetNamespace) {
                        const nsKey = schema.targetNamespace;
                        if (!artifactsByNamespace.has(nsKey)) {
                            artifactsByNamespace.set(nsKey, []);
                        }
                        artifactsByNamespace.get(nsKey)?.push(a.id);
                    }
                }
            }

            // Index receive ports
            if (a.ir.endpoints?.receive) {
                for (const ep of a.ir.endpoints.receive) {
                    const sourceMapping = ep.sourceMapping as
                        | { biztalk?: { receivePortName?: string } }
                        | undefined;
                    const portName = sourceMapping?.biztalk?.receivePortName || ep.name;
                    if (portName) {
                        receivePortArtifacts.set(portName, a.id);
                    }
                }
            }
        }

        // ── Connection Type 1: Send port subscription filters referencing receive ports ──
        for (const a of artifacts) {
            if (a.ir.endpoints?.send) {
                for (const ep of a.ir.endpoints.send) {
                    if ('transport' in ep) {
                        const sourceMapping = ep.sourceMapping as
                            | { biztalk?: { filter?: string } }
                            | undefined;
                        const filter = sourceMapping?.biztalk?.filter;
                        if (filter) {
                            // Check if filter references a receive port
                            for (const [portName, rpArtifactId] of receivePortArtifacts) {
                                if (filter.includes(portName) && rpArtifactId !== a.id) {
                                    connections.push({
                                        fromId: rpArtifactId,
                                        toId: a.id,
                                        type: 'subscription-filter',
                                        evidence: `Send port filter references ReceivePortName="${portName}"`,
                                    });
                                }
                            }
                            // Check if filter references a message type/schema
                            for (const [schemaKey, schemaArtifactIds] of artifactsBySchema) {
                                if (filter.includes(schemaKey)) {
                                    for (const saId of schemaArtifactIds) {
                                        if (saId !== a.id) {
                                            connections.push({
                                                fromId: saId,
                                                toId: a.id,
                                                type: 'message-type-subscription',
                                                evidence: `Send port filter references schema/message type "${schemaKey}"`,
                                            });
                                        }
                                    }
                                }
                            }
                            // Check namespace references in filter
                            for (const [ns, nsArtifactIds] of artifactsByNamespace) {
                                if (filter.includes(ns)) {
                                    for (const nsId of nsArtifactIds) {
                                        if (nsId !== a.id) {
                                            connections.push({
                                                fromId: nsId,
                                                toId: a.id,
                                                type: 'message-type-subscription',
                                                evidence: `Send port filter references namespace "${ns}"`,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Connection Type 2: Map source/target schema references ──
        for (const a of artifacts) {
            if (a.ir.maps) {
                for (const map of a.ir.maps) {
                    const sourceRef = map.source?.schemaRef;
                    const targetRef = map.target?.schemaRef;

                    if (sourceRef) {
                        // Find artifacts that define this source schema
                        for (const [schemaKey, schemaArtifactIds] of artifactsBySchema) {
                            if (
                                sourceRef.includes(schemaKey) ||
                                schemaKey.includes(sourceRef.replace(/.*\//, ''))
                            ) {
                                for (const saId of schemaArtifactIds) {
                                    if (saId !== a.id) {
                                        connections.push({
                                            fromId: saId,
                                            toId: a.id,
                                            type: 'map-source-schema',
                                            evidence: `Map uses source schema "${sourceRef}" defined in this artifact`,
                                        });
                                    }
                                }
                            }
                        }
                    }

                    if (targetRef) {
                        for (const [schemaKey, schemaArtifactIds] of artifactsBySchema) {
                            if (
                                targetRef.includes(schemaKey) ||
                                schemaKey.includes(targetRef.replace(/.*\//, ''))
                            ) {
                                for (const saId of schemaArtifactIds) {
                                    if (saId !== a.id) {
                                        connections.push({
                                            fromId: a.id,
                                            toId: saId,
                                            type: 'map-target-schema',
                                            evidence: `Map produces output to schema "${targetRef}" defined in this artifact`,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Connection Type 3: Orchestrations referencing maps ──
        for (const a of artifacts) {
            if (a.type === 'orchestration' && a.ir.maps) {
                for (const mapRef of a.ir.maps) {
                    for (const other of artifacts) {
                        if (other.id === a.id) {
                            continue;
                        }
                        if (
                            other.type === 'map' &&
                            other.ir.maps?.some((m) => m.name === mapRef.name)
                        ) {
                            connections.push({
                                fromId: a.id,
                                toId: other.id,
                                type: 'orchestration-uses-map',
                                evidence: `Orchestration uses map "${mapRef.name}"`,
                            });
                        }
                    }
                }
            }
        }

        // ── Connection Type 4: Shared schema namespace connections ──
        for (const [ns, artifactIds] of artifactsByNamespace) {
            if (artifactIds.length > 1 && artifactIds.length <= 6) {
                // Connect artifacts sharing the same namespace (likely same business domain)
                for (let i = 0; i < artifactIds.length; i++) {
                    for (let j = i + 1; j < artifactIds.length; j++) {
                        connections.push({
                            fromId: artifactIds[i],
                            toId: artifactIds[j],
                            type: 'shared-namespace',
                            evidence: `Both artifacts use namespace "${ns}"`,
                        });
                    }
                }
            }
        }

        // ── Connection Type 5: Binding → Pipeline/Schema associations ──
        for (const a of artifacts) {
            if (a.type === 'binding' && a.ir.endpoints) {
                const allEndpoints = [
                    ...(a.ir.endpoints.receive || []),
                    ...(a.ir.endpoints.send || []),
                ];
                for (const ep of allEndpoints) {
                    // Check if endpoint references schemas from other artifacts
                    const epSourceMapping = ep.sourceMapping as
                        | { biztalk?: Record<string, unknown> }
                        | undefined;
                    if (epSourceMapping?.biztalk) {
                        const btProps = epSourceMapping.biztalk;
                        // Look for pipeline or schema references in binding properties
                        for (const [, val] of Object.entries(btProps)) {
                            if (typeof val === 'string') {
                                for (const other of artifacts) {
                                    if (other.id === a.id) {
                                        continue;
                                    }
                                    if (
                                        (other.type === 'pipeline' ||
                                            other.type === 'orchestration') &&
                                        val.includes(other.name)
                                    ) {
                                        connections.push({
                                            fromId: a.id,
                                            toId: other.id,
                                            type: 'binding-references',
                                            evidence: `Binding references "${other.name}" in endpoint configuration`,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Connection Type 6: Orchestration-to-orchestration calls ──
        // Detect Call Orchestration / Start Orchestration from IR actions
        for (const a of artifacts) {
            if (a.type !== 'orchestration') {
                continue;
            }
            const allActions = this.collectAllActions(a.ir.actions || []);
            for (const action of allActions) {
                const sourceMapping = action.sourceMapping as
                    | {
                          biztalk?: {
                              shapeType?: string;
                              calledOrchestration?: string;
                              startedOrchestration?: string;
                          };
                      }
                    | undefined;
                const biztalk = sourceMapping?.biztalk;
                if (!biztalk) {
                    continue;
                }

                let targetOrchName: string | undefined;
                if (biztalk.shapeType === 'CallOrchestration' && biztalk.calledOrchestration) {
                    targetOrchName = biztalk.calledOrchestration;
                } else if (
                    biztalk.shapeType === 'StartOrchestration' &&
                    biztalk.startedOrchestration
                ) {
                    targetOrchName = biztalk.startedOrchestration;
                } else if (action.type === 'call-workflow') {
                    const config = (action as { config?: { workflowName?: string } }).config;
                    targetOrchName = config?.workflowName;
                }

                if (targetOrchName) {
                    // Match by artifact name (short or fully-qualified)
                    for (const other of artifacts) {
                        if (other.id === a.id || other.type !== 'orchestration') {
                            continue;
                        }
                        // Match: exact name, or target ends with the artifact name, or artifact name ends with the target
                        const otherName = other.name;
                        if (
                            targetOrchName === otherName ||
                            targetOrchName.endsWith('.' + otherName) ||
                            targetOrchName.endsWith('/' + otherName) ||
                            otherName.endsWith('.' + targetOrchName) ||
                            targetOrchName.includes(otherName) ||
                            otherName.includes(targetOrchName)
                        ) {
                            connections.push({
                                fromId: a.id,
                                toId: other.id,
                                type: 'orchestration-calls',
                                evidence: `Orchestration "${a.name}" calls orchestration "${other.name}" (${biztalk.shapeType || 'call-workflow'}: "${targetOrchName}")`,
                            });
                        }
                    }
                }
            }
        }

        // Deduplicate connections
        const seen = new Set<string>();
        const uniqueConnections = connections.filter((c) => {
            const key = `${c.fromId}→${c.toId}:${c.type}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });

        return { connections: uniqueConnections };
    }
}
