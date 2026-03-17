/**
 * Dependency Graph Service
 *
 * Builds and manages dependency graphs for discovered artifacts.
 * Identifies relationships between workflows, maps, schemas, and
 * shared resources.
 *
 * @module stages/discovery/DependencyGraphService
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import {
    DependencyGraph,
    DependencyNode,
    DependencyEdge,
    CircularDependency,
    SharedResource,
    ArtifactInventory,
    InventoryItem,
} from './types';
import { IRDocument } from '../../ir/types/document';

// =============================================================================
// Dependency Graph Builder
// =============================================================================

/**
 * Builds dependency graphs from inventory and IR data.
 */
export class DependencyGraphBuilder {
    private readonly logger = LoggingService.getInstance();
    // IR documents map (passed from caller)
    private irDocuments = new Map<string, IRDocument>();

    /**
     * Set IR documents for dependency analysis.
     */
    public setIRDocuments(documents: Map<string, IRDocument>): void {
        this.irDocuments = documents;
    }

    /**
     * Build dependency graph from inventory.
     */
    public async build(inventory: ArtifactInventory): Promise<DependencyGraph> {
        this.logger.info('Building dependency graph', { itemCount: inventory.items.length });

        const nodes = new Map<string, DependencyNode>();
        const edges: DependencyEdge[] = [];

        // Create nodes for all items
        for (const item of inventory.items) {
            nodes.set(item.id, {
                id: item.id,
                name: item.name,
                category: item.category,
                inDegree: 0,
                outDegree: 0,
                depth: 0,
            });
        }

        // Create name-to-id mapping for reference resolution
        const nameToIds = this.createNameToIdMapping(inventory.items);

        // Diagnostic: count items with/without irId and with/without IR docs
        let itemsWithIrDoc = 0;

        // Extract dependencies from each item
        for (const item of inventory.items) {
            if (!item.irId) {
                continue;
            }

            try {
                const ir = this.irDocuments.get(item.irId);
                if (ir) {
                    itemsWithIrDoc++;
                    const itemEdges = this.extractDependencies(item, ir, nameToIds);
                    edges.push(...itemEdges);
                }
            } catch (error) {
                this.logger.warn('Failed to extract dependencies for item', {
                    id: item.id,
                    error: String(error),
                });
            }
        }

        this.logger.info('Dependency extraction summary', {
            totalItems: inventory.items.length,
            itemsWithIrDoc,
            nameMapSize: nameToIds.size,
            edgesFound: edges.length,
        });

        // Update node degrees
        for (const edge of edges) {
            const sourceNode = nodes.get(edge.source);
            const targetNode = nodes.get(edge.target);

            if (sourceNode) {
                (sourceNode as { outDegree: number }).outDegree++;
            }
            if (targetNode) {
                (targetNode as { inDegree: number }).inDegree++;
            }
        }

        // Find root and leaf nodes
        const rootNodeIds: string[] = [];
        const leafNodeIds: string[] = [];

        for (const [id, node] of nodes) {
            if (node.inDegree === 0) {
                rootNodeIds.push(id);
            }
            if (node.outDegree === 0) {
                leafNodeIds.push(id);
            }
        }

        // Calculate depths using BFS from roots
        this.calculateDepths(nodes, edges, rootNodeIds);

        // Detect circular dependencies
        const circularDependencies = this.detectCircularDependencies(
            Array.from(nodes.values()),
            edges
        );

        // Identify shared resources
        const sharedResources = this.identifySharedResources(nodes, edges);

        this.logger.info('Dependency graph built', {
            nodes: nodes.size,
            edges: edges.length,
            roots: rootNodeIds.length,
            leaves: leafNodeIds.length,
            circular: circularDependencies.length,
            shared: sharedResources.length,
        });

        return {
            nodes: Array.from(nodes.values()),
            edges,
            rootNodeIds,
            leafNodeIds,
            circularDependencies,
            sharedResources,
        };
    }

    /**
     * Create mapping from artifact names to IDs.
     */
    private createNameToIdMapping(items: InventoryItem[]): Map<string, string[]> {
        const mapping = new Map<string, string[]>();

        const addMapping = (name: string, id: string) => {
            if (!name || name.length < 2) {
                return;
            }
            const key = name.toLowerCase();
            const existing = mapping.get(key) || [];
            if (!existing.includes(id)) {
                existing.push(id);
            }
            mapping.set(key, existing);
        };

        for (const item of items) {
            // Map by display name
            addMapping(item.name, item.id);

            // Map by file basename (without extension)
            addMapping(path.basename(item.sourcePath, path.extname(item.sourcePath)), item.id);

            // Map by source path (relative) — useful for project reference resolution
            addMapping(item.sourcePath, item.id);

            // Also index by fully-qualified name from IR metadata if available
            if (item.irId) {
                const ir = this.irDocuments.get(item.irId);
                if (ir) {
                    // IR metadata name (may be fully-qualified)
                    if (ir.metadata?.name) {
                        addMapping(ir.metadata.name, item.id);
                    }
                    // Source artifact name from IR
                    const artifactName = ir.metadata?.source?.artifact?.name;
                    if (artifactName) {
                        addMapping(artifactName, item.id);
                    }
                    // BizTalk namespace-qualified name (e.g. "MyProject.MyOrchestration")
                    const biztalkExt = (ir.extensions as Record<string, unknown> | undefined)
                        ?.biztalk as Record<string, unknown> | undefined;
                    if (biztalkExt) {
                        const ns = biztalkExt.projectNamespace as string;
                        const projName = biztalkExt.projectName as string;
                        if (ns && item.name) {
                            addMapping(`${ns}.${item.name}`, item.id);
                        }
                        if (projName && item.name && projName !== ns) {
                            addMapping(`${projName}.${item.name}`, item.id);
                        }
                        if (projName) {
                            addMapping(projName, item.id);
                        }
                    }
                    // Schema target namespace → may be used as reference key
                    if (ir.schemas) {
                        for (const schema of ir.schemas) {
                            if (schema.targetNamespace) {
                                addMapping(schema.targetNamespace, item.id);
                            }
                            if (schema.name) {
                                addMapping(schema.name, item.id);
                            }
                        }
                    }
                }
            }
        }

        return mapping;
    }

    /**
     * Extract dependencies from an IR document.
     */
    private extractDependencies(
        item: InventoryItem,
        ir: IRDocument,
        nameToIds: Map<string, string[]>
    ): DependencyEdge[] {
        const edges: DependencyEdge[] = [];

        // Extract map references
        if (ir.maps) {
            for (const map of ir.maps) {
                // Maps reference schemas via endpoints
                if (map.source?.schemaRef) {
                    const targetIds = this.resolveReference(map.source.schemaRef, nameToIds);
                    for (const targetId of targetIds) {
                        if (targetId !== item.id) {
                            edges.push({
                                source: item.id,
                                target: targetId,
                                type: 'references',
                                reference: `Source schema: ${map.source.schemaRef}`,
                            });
                        }
                    }
                }
                if (map.target?.schemaRef) {
                    const targetIds = this.resolveReference(map.target.schemaRef, nameToIds);
                    for (const targetId of targetIds) {
                        if (targetId !== item.id) {
                            edges.push({
                                source: item.id,
                                target: targetId,
                                type: 'references',
                                reference: `Target schema: ${map.target.schemaRef}`,
                            });
                        }
                    }
                }
            }
        }

        // Extract action dependencies (recursively to handle nested scopes/conditions/loops)
        if (ir.actions) {
            const allActions = this.collectAllActions(
                ir.actions as unknown as Record<string, unknown>[]
            );

            for (const action of allActions) {
                const actionType = action.type as string | undefined;
                const config = action.config as Record<string, unknown> | undefined;
                const sourceMapping = action.sourceMapping as
                    | { biztalk?: Record<string, string> }
                    | undefined;

                // Transform actions may reference maps
                if (actionType === 'transform') {
                    const mapRef =
                        (config?.mapReference as string) ||
                        (config?.transformType === 'xslt'
                            ? (config?.mapReference as string)
                            : undefined) ||
                        sourceMapping?.biztalk?.mapTypeName;
                    if (mapRef) {
                        const targetIds = this.resolveReference(mapRef, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'uses',
                                    reference: `Transform map: ${mapRef}`,
                                });
                            }
                        }
                    }
                }

                // Call/Start Orchestration actions reference other workflows
                if (actionType === 'call-workflow') {
                    const callRef =
                        (config?.workflowName as string) ||
                        sourceMapping?.biztalk?.calledOrchestration ||
                        sourceMapping?.biztalk?.startedOrchestration;
                    if (callRef) {
                        const targetIds = this.resolveReference(callRef, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'calls',
                                    reference: `Calls: ${callRef}`,
                                });
                            }
                        }
                    }
                }

                // Also catch CallOrchestration / StartOrchestration that fell to default 'custom' type
                if (actionType === 'custom') {
                    const shapeType = sourceMapping?.biztalk?.shapeType;
                    const callRef =
                        (shapeType === 'CallOrchestration'
                            ? sourceMapping?.biztalk?.calledOrchestration
                            : undefined) ||
                        (shapeType === 'StartOrchestration'
                            ? sourceMapping?.biztalk?.startedOrchestration
                            : undefined);
                    if (callRef) {
                        const targetIds = this.resolveReference(callRef, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'calls',
                                    reference: `Calls: ${callRef}`,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Extract schema imports (for XSD)
        if (ir.schemas) {
            for (const schema of ir.schemas) {
                const imports = (schema as { imports?: string[] }).imports;
                if (imports) {
                    for (const importRef of imports) {
                        const targetIds = this.resolveReference(importRef, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'imports',
                                    reference: `Imports: ${importRef}`,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Extract message processing references
        if (ir.messageProcessing) {
            // Check inbound processors for references
            if (ir.messageProcessing.inbound) {
                for (const processor of ir.messageProcessing.inbound) {
                    const processorRef = processor.name;
                    if (processorRef) {
                        const targetIds = this.resolveReference(processorRef, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'uses',
                                    reference: `Inbound processor: ${processorRef}`,
                                });
                            }
                        }
                    }
                }
            }
            // Check outbound processors
            if (ir.messageProcessing.outbound) {
                for (const processor of ir.messageProcessing.outbound) {
                    const processorRef = processor.name;
                    if (processorRef) {
                        const targetIds = this.resolveReference(processorRef, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'uses',
                                    reference: `Outbound processor: ${processorRef}`,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Extract endpoint/binding references (orchestrations, pipelines, transport refs)
        if (ir.endpoints) {
            const allEndpoints = [...(ir.endpoints.receive || []), ...(ir.endpoints.send || [])];
            for (const ep of allEndpoints) {
                const sourceMapping = ep.sourceMapping as
                    | { biztalk?: Record<string, unknown> }
                    | undefined;
                if (sourceMapping?.biztalk) {
                    const bt = sourceMapping.biztalk;
                    // Binding references orchestrations via orchestration bindings
                    const orchRefs = [
                        bt.orchestrationAssemblyName,
                        bt.orchestrationTypeName,
                        bt.orchestration,
                    ].filter(Boolean) as string[];
                    for (const ref of orchRefs) {
                        const targetIds = this.resolveReference(ref, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'uses',
                                    reference: `Endpoint references orchestration: ${ref}`,
                                });
                            }
                        }
                    }
                    // Binding references pipelines
                    const pipeRefs = [
                        bt.receivePipelineName,
                        bt.sendPipelineName,
                        bt.receivePipeline,
                        bt.sendPipeline,
                    ].filter(Boolean) as string[];
                    for (const ref of pipeRefs) {
                        const targetIds = this.resolveReference(ref, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'uses',
                                    reference: `Endpoint references pipeline: ${ref}`,
                                });
                            }
                        }
                    }
                    // Binding references maps/transforms
                    const mapRefs = [
                        bt.inboundTransformName,
                        bt.outboundTransformName,
                        bt.transformType,
                    ].filter(Boolean) as string[];
                    for (const ref of mapRefs) {
                        const targetIds = this.resolveReference(ref, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'uses',
                                    reference: `Endpoint references transform: ${ref}`,
                                });
                            }
                        }
                    }
                    // Extract any string property value that could be a reference to another artifact
                    const stringVals = Object.values(bt).filter(
                        (v): v is string => typeof v === 'string' && v.length > 3 && v.length < 300
                    );
                    for (const val of stringVals) {
                        // Check if value looks like a CLR type name (contains dots, no spaces, no special chars)
                        if (/^[A-Za-z][A-Za-z0-9_.]+$/.test(val) && val.includes('.')) {
                            const targetIds = this.resolveReference(val, nameToIds);
                            for (const targetId of targetIds) {
                                if (targetId !== item.id) {
                                    edges.push({
                                        source: item.id,
                                        target: targetId,
                                        type: 'references',
                                        reference: `Endpoint binding property references: ${val}`,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Extract connection references
        if (ir.connections) {
            for (const conn of ir.connections) {
                // Connection references may point to other artifacts
                const refs = [
                    conn.name,
                    ...(conn.sourceMapping
                        ? Object.values(
                              (conn.sourceMapping as Record<string, unknown>).biztalk || {}
                          ).filter((v): v is string => typeof v === 'string')
                        : []),
                ];
                for (const ref of refs) {
                    if (ref && ref.length > 3) {
                        const targetIds = this.resolveReference(ref, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'references',
                                    reference: `Connection references: ${ref}`,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Extract dependency/custom code references from IR
        if (ir.dependencies) {
            const deps = ir.dependencies as {
                customCode?: { name?: string; assemblyRef?: string }[];
                certificates?: { name?: string }[];
                infrastructure?: { name?: string }[];
            };
            for (const customCode of deps.customCode || []) {
                const refs = [customCode.name, customCode.assemblyRef].filter(Boolean) as string[];
                for (const ref of refs) {
                    const targetIds = this.resolveReference(ref, nameToIds);
                    for (const targetId of targetIds) {
                        if (targetId !== item.id) {
                            edges.push({
                                source: item.id,
                                target: targetId,
                                type: 'references',
                                reference: `Custom code dependency: ${ref}`,
                            });
                        }
                    }
                }
            }
        }

        // Extract references from platform extensions (e.g. biztalk project references, assembly references)
        if (ir.extensions) {
            const biztalkExt = (ir.extensions as Record<string, unknown>).biztalk as
                | Record<string, unknown>
                | undefined;
            if (biztalkExt) {
                // Orchestration message types → schema references
                const messageTypes = biztalkExt.messageTypes as string[] | undefined;
                if (messageTypes) {
                    for (const msgType of messageTypes) {
                        const targetIds = this.resolveReference(msgType, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'references',
                                    reference: `Message type: ${msgType}`,
                                });
                            }
                        }
                    }
                }
                // Orchestration port types → may reference other artifacts
                const ports = biztalkExt.ports as { portTypeName?: string }[] | undefined;
                if (ports) {
                    for (const port of ports) {
                        if (port.portTypeName) {
                            const targetIds = this.resolveReference(port.portTypeName, nameToIds);
                            for (const targetId of targetIds) {
                                if (targetId !== item.id) {
                                    edges.push({
                                        source: item.id,
                                        target: targetId,
                                        type: 'references',
                                        reference: `Port type: ${port.portTypeName}`,
                                    });
                                }
                            }
                        }
                    }
                }
                // Project references
                const projectRefs = (biztalkExt.projectReferences ||
                    biztalkExt.projectReference) as string[] | string | undefined;
                if (projectRefs) {
                    const refs = Array.isArray(projectRefs) ? projectRefs : [projectRefs];
                    for (const ref of refs) {
                        const targetIds = this.resolveReference(ref, nameToIds);
                        for (const targetId of targetIds) {
                            if (targetId !== item.id) {
                                edges.push({
                                    source: item.id,
                                    target: targetId,
                                    type: 'references',
                                    reference: `Project reference: ${ref}`,
                                });
                            }
                        }
                    }
                }
                // Assembly references (may reference other BizTalk project assemblies)
                const asmRefs = biztalkExt.assemblyReferences as
                    | { name?: string; hintPath?: string }[]
                    | undefined;
                if (asmRefs) {
                    for (const asmRef of asmRefs) {
                        const refs = [asmRef.name, asmRef.hintPath].filter(Boolean) as string[];
                        for (const ref of refs) {
                            const targetIds = this.resolveReference(ref, nameToIds);
                            for (const targetId of targetIds) {
                                if (targetId !== item.id) {
                                    edges.push({
                                        source: item.id,
                                        target: targetId,
                                        type: 'references',
                                        reference: `Assembly reference: ${ref}`,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Deduplicate edges
        return this.deduplicateEdges(edges);
    }

    /**
     * Recursively collect all actions from an action tree (including nested
     * actions inside conditions, scopes, loops, parallel branches, etc.).
     */
    private collectAllActions(
        actions: readonly Record<string, unknown>[]
    ): Record<string, unknown>[] {
        const result: Record<string, unknown>[] = [];
        for (const action of actions) {
            result.push(action);
            // Recurse into nested action arrays (scope body)
            if (Array.isArray(action.actions)) {
                result.push(...this.collectAllActions(action.actions));
            }
            // Condition branches — check BOTH possible locations:
            // Location 1: action.branches.true / action.branches.false (BizTalk parser format)
            const branches = action.branches as { true?: unknown[]; false?: unknown[] } | undefined;
            if (branches) {
                if (Array.isArray(branches.true)) {
                    result.push(
                        ...this.collectAllActions(branches.true as Record<string, unknown>[])
                    );
                }
                if (Array.isArray(branches.false)) {
                    result.push(
                        ...this.collectAllActions(branches.false as Record<string, unknown>[])
                    );
                }
            }
            // Location 2: config.trueActions / config.falseActions (IR standard format)
            if (action.type === 'condition') {
                const config = action.config as
                    | { trueActions?: unknown[]; falseActions?: unknown[] }
                    | undefined;
                if (Array.isArray(config?.trueActions)) {
                    result.push(
                        ...this.collectAllActions(config.trueActions as Record<string, unknown>[])
                    );
                }
                if (Array.isArray(config?.falseActions)) {
                    result.push(
                        ...this.collectAllActions(config.falseActions as Record<string, unknown>[])
                    );
                }
            }
            // Switch cases — check config.cases[].actions
            if (action.type === 'switch') {
                const switchConfig = action.config as
                    | { cases?: { actions?: unknown[] }[] }
                    | undefined;
                if (Array.isArray(switchConfig?.cases)) {
                    for (const c of switchConfig.cases) {
                        if (Array.isArray(c.actions)) {
                            result.push(
                                ...this.collectAllActions(c.actions as Record<string, unknown>[])
                            );
                        }
                    }
                }
            }
            // Scope / foreach / until — check config.actions
            const innerConfig = action.config as { actions?: unknown[] } | undefined;
            if (Array.isArray(innerConfig?.actions)) {
                result.push(
                    ...this.collectAllActions(innerConfig.actions as Record<string, unknown>[])
                );
            }
        }
        return result;
    }

    /**
     * Resolve a reference to item IDs.
     * Handles fully-qualified names (e.g. Namespace.ClassName), file basenames,
     * assembly-qualified names, and namespace URIs.
     */
    private resolveReference(reference: string, nameToIds: Map<string, string[]>): string[] {
        if (!reference) {
            return [];
        }

        const normalizedRef = reference.toLowerCase().trim();
        if (!normalizedRef) {
            return [];
        }

        // 1. Try exact match
        const exactMatch = nameToIds.get(normalizedRef);
        if (exactMatch) {
            return exactMatch;
        }

        // 2. Try without extension
        const withoutExt = path.basename(normalizedRef, path.extname(normalizedRef));
        const noExtMatch = nameToIds.get(withoutExt);
        if (noExtMatch) {
            return noExtMatch;
        }

        // 3. Try last segment of dotted name (e.g. "Sat.Scade.PagosCore.MyOrch" → "myorch")
        const dotParts = normalizedRef.split('.');
        if (dotParts.length > 1) {
            const lastSegment = dotParts[dotParts.length - 1];
            const segmentMatch = nameToIds.get(lastSegment);
            if (segmentMatch) {
                return segmentMatch;
            }
            // Try last two segments (e.g. "Maps.OrderToInvoice" → "maps.ordertoinvoice" or just "ordertoinvoice")
            if (dotParts.length > 2) {
                const lastTwo = dotParts.slice(-2).join('.');
                const lastTwoMatch = nameToIds.get(lastTwo);
                if (lastTwoMatch) {
                    return lastTwoMatch;
                }
            }
        }

        // 4. Try extracting name from URI-style references (e.g. "http://schemas.example.com/OrderSchema#Root")
        const hashIdx = normalizedRef.indexOf('#');
        if (hashIdx !== -1) {
            const beforeHash = normalizedRef.substring(0, hashIdx);
            const afterHash = normalizedRef.substring(hashIdx + 1);
            // Try the fragment
            if (afterHash) {
                const fragmentMatch = nameToIds.get(afterHash);
                if (fragmentMatch) {
                    return fragmentMatch;
                }
            }
            // Try the last path segment before #
            const slashParts = beforeHash.split('/');
            const lastPath = slashParts[slashParts.length - 1];
            if (lastPath) {
                const pathMatch = nameToIds.get(lastPath);
                if (pathMatch) {
                    return pathMatch;
                }
            }
        }

        // 5. Try extracting from slash-separated paths
        const slashParts = normalizedRef.split('/');
        if (slashParts.length > 1) {
            const lastSlashPart = slashParts[slashParts.length - 1];
            if (lastSlashPart) {
                const slashMatch = nameToIds.get(lastSlashPart);
                if (slashMatch) {
                    return slashMatch;
                }
            }
        }

        // 6. Try stripping assembly-qualified name parts (e.g. "MyAssembly, Version=1.0...")
        const commaIdx = normalizedRef.indexOf(',');
        if (commaIdx !== -1) {
            const assemblyName = normalizedRef.substring(0, commaIdx).trim();
            if (assemblyName) {
                const asmMatch = nameToIds.get(assemblyName);
                if (asmMatch) {
                    return asmMatch;
                }
                // Also try last dotted segment of assembly name
                const asmDotParts = assemblyName.split('.');
                if (asmDotParts.length > 1) {
                    const asmLast = asmDotParts[asmDotParts.length - 1];
                    const asmLastMatch = nameToIds.get(asmLast);
                    if (asmLastMatch) {
                        return asmLastMatch;
                    }
                }
            }
        }

        // 7. Partial match as last resort — check if any inventory name appears at the END of the reference
        //    (e.g. reference "Sat.Scade.PagosCore.MyOrch" ends with inventory name "myorch")
        //    or if the reference appears at the end of an inventory name
        for (const [name, ids] of nameToIds) {
            if (name.length < 3) {
                continue; // Skip very short names to avoid false matches
            }
            if (
                normalizedRef.endsWith('.' + name) ||
                normalizedRef.endsWith('/' + name) ||
                normalizedRef.endsWith('\\' + name)
            ) {
                return ids;
            }
            if (name.endsWith('.' + normalizedRef) || name.endsWith('/' + normalizedRef)) {
                return ids;
            }
        }

        return [];
    }

    /**
     * Remove duplicate edges.
     */
    private deduplicateEdges(edges: DependencyEdge[]): DependencyEdge[] {
        const seen = new Set<string>();
        return edges.filter((edge) => {
            const key = `${edge.source}:${edge.target}:${edge.type}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Calculate depths using BFS from roots.
     */
    private calculateDepths(
        nodes: Map<string, DependencyNode>,
        edges: DependencyEdge[],
        rootIds: string[]
    ): void {
        // Build adjacency list
        const adjacency = new Map<string, string[]>();
        for (const edge of edges) {
            const deps = adjacency.get(edge.source) || [];
            deps.push(edge.target);
            adjacency.set(edge.source, deps);
        }

        // BFS from each root
        const visited = new Set<string>();
        const queue: { id: string; depth: number }[] = rootIds.map((id) => ({ id, depth: 0 }));

        while (queue.length > 0) {
            const entry = queue.shift();
            if (!entry) {
                break;
            }
            const { id, depth } = entry;

            if (visited.has(id)) {
                continue;
            }
            visited.add(id);

            const node = nodes.get(id);
            if (node) {
                (node as { depth: number }).depth = Math.max(node.depth, depth);
            }

            const deps = adjacency.get(id) || [];
            for (const depId of deps) {
                if (!visited.has(depId)) {
                    queue.push({ id: depId, depth: depth + 1 });
                }
            }
        }
    }

    /**
     * Detect circular dependencies using Tarjan's algorithm.
     */
    private detectCircularDependencies(
        nodes: DependencyNode[],
        edges: DependencyEdge[]
    ): CircularDependency[] {
        const cycles: CircularDependency[] = [];

        // Build adjacency list
        const adjacency = new Map<string, string[]>();
        const edgeMap = new Map<string, DependencyEdge>();

        for (const edge of edges) {
            const deps = adjacency.get(edge.source) || [];
            deps.push(edge.target);
            adjacency.set(edge.source, deps);
            edgeMap.set(`${edge.source}->${edge.target}`, edge);
        }

        // Tarjan's algorithm state
        let index = 0;
        const nodeIndex = new Map<string, number>();
        const lowLink = new Map<string, number>();
        const onStack = new Set<string>();
        const stack: string[] = [];

        const strongConnect = (nodeId: string): void => {
            nodeIndex.set(nodeId, index);
            lowLink.set(nodeId, index);
            index++;
            stack.push(nodeId);
            onStack.add(nodeId);

            const deps = adjacency.get(nodeId) || [];
            for (const depId of deps) {
                if (!nodeIndex.has(depId)) {
                    strongConnect(depId);
                    lowLink.set(
                        nodeId,
                        Math.min(lowLink.get(nodeId) ?? 0, lowLink.get(depId) ?? 0)
                    );
                } else if (onStack.has(depId)) {
                    lowLink.set(
                        nodeId,
                        Math.min(lowLink.get(nodeId) ?? 0, nodeIndex.get(depId) ?? 0)
                    );
                }
            }

            // If node is root of SCC
            if (lowLink.get(nodeId) === nodeIndex.get(nodeId)) {
                const scc: string[] = [];
                let w: string;
                do {
                    w = stack.pop() ?? '';
                    onStack.delete(w);
                    scc.push(w);
                } while (w !== nodeId);

                // Only report cycles (SCC with more than 1 node or self-loop)
                if (scc.length > 1) {
                    const cycleEdges: DependencyEdge[] = [];
                    for (let i = 0; i < scc.length; i++) {
                        const from = scc[i];
                        const to = scc[(i + 1) % scc.length];
                        const edge = edgeMap.get(`${from}->${to}`);
                        if (edge) {
                            cycleEdges.push(edge);
                        }
                    }
                    cycles.push({ nodeIds: scc, edges: cycleEdges });
                } else if (scc.length === 1) {
                    // Check for self-loop
                    const selfEdge = edgeMap.get(`${scc[0]}->${scc[0]}`);
                    if (selfEdge) {
                        cycles.push({ nodeIds: scc, edges: [selfEdge] });
                    }
                }
            }
        };

        for (const node of nodes) {
            if (!nodeIndex.has(node.id)) {
                strongConnect(node.id);
            }
        }

        return cycles;
    }

    /**
     * Identify shared resources (nodes with multiple dependents).
     */
    private identifySharedResources(
        nodes: Map<string, DependencyNode>,
        edges: DependencyEdge[]
    ): SharedResource[] {
        // Count incoming edges per node
        const incomingCount = new Map<string, Set<string>>();

        for (const edge of edges) {
            const sources = incomingCount.get(edge.target) || new Set();
            sources.add(edge.source);
            incomingCount.set(edge.target, sources);
        }

        // Find nodes used by multiple sources
        const sharedResources: SharedResource[] = [];

        for (const [id, sources] of incomingCount) {
            if (sources.size > 1) {
                const node = nodes.get(id);
                if (node) {
                    sharedResources.push({
                        id: node.id,
                        name: node.name,
                        category: node.category,
                        usedBy: Array.from(sources),
                        usageCount: sources.size,
                    });
                }
            }
        }

        // Sort by usage count
        sharedResources.sort((a, b) => b.usageCount - a.usageCount);

        return sharedResources;
    }
}

// =============================================================================
// Dependency Graph Service
// =============================================================================

/**
 * Service for managing dependency graphs.
 */
export class DependencyGraphService implements vscode.Disposable {
    private static instance: DependencyGraphService | undefined;

    private readonly logger = LoggingService.getInstance();
    private readonly builder = new DependencyGraphBuilder();

    // Current graph
    private graph: DependencyGraph | undefined;

    private constructor() {}

    /**
     * Get the singleton instance.
     */
    public static getInstance(): DependencyGraphService {
        if (!DependencyGraphService.instance) {
            DependencyGraphService.instance = new DependencyGraphService();
        }
        return DependencyGraphService.instance;
    }

    /**
     * Set IR documents for dependency analysis.
     */
    public setIRDocuments(documents: Map<string, IRDocument>): void {
        this.builder.setIRDocuments(documents);
    }

    /**
     * Build graph from inventory.
     */
    public async buildGraph(inventory: ArtifactInventory): Promise<DependencyGraph> {
        this.graph = await this.builder.build(inventory);
        await this.saveToStorage();
        return this.graph;
    }

    /**
     * Get current graph.
     */
    public getGraph(): DependencyGraph | undefined {
        return this.graph;
    }

    /**
     * Get dependencies for a node.
     */
    public getDependencies(nodeId: string): DependencyEdge[] {
        if (!this.graph) {
            return [];
        }
        return this.graph.edges.filter((e) => e.source === nodeId);
    }

    /**
     * Get dependents of a node.
     */
    public getDependents(nodeId: string): DependencyEdge[] {
        if (!this.graph) {
            return [];
        }
        return this.graph.edges.filter((e) => e.target === nodeId);
    }

    /**
     * Get transitive dependencies (all dependencies recursively).
     */
    public getTransitiveDependencies(nodeId: string): string[] {
        if (!this.graph) {
            return [];
        }

        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                break;
            }
            if (visited.has(current)) {
                continue;
            }
            visited.add(current);

            const deps = this.getDependencies(current);
            for (const dep of deps) {
                if (!visited.has(dep.target)) {
                    queue.push(dep.target);
                }
            }
        }

        visited.delete(nodeId); // Remove self
        return Array.from(visited);
    }

    /**
     * Get subgraph for a node and its dependencies.
     */
    public getSubgraph(nodeId: string): DependencyGraph {
        if (!this.graph) {
            return {
                nodes: [],
                edges: [],
                rootNodeIds: [],
                leafNodeIds: [],
                circularDependencies: [],
                sharedResources: [],
            };
        }

        const nodeIds = new Set([nodeId, ...this.getTransitiveDependencies(nodeId)]);

        const nodes = this.graph.nodes.filter((n) => nodeIds.has(n.id));
        const edges = this.graph.edges.filter(
            (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );
        const circularDeps = this.graph.circularDependencies.filter((c) =>
            c.nodeIds.some((id) => nodeIds.has(id))
        );
        const sharedResources = this.graph.sharedResources.filter((r) => nodeIds.has(r.id));

        const roots = nodes.filter((n) => !edges.some((e) => e.target === n.id)).map((n) => n.id);
        const leaves = nodes.filter((n) => !edges.some((e) => e.source === n.id)).map((n) => n.id);

        return {
            nodes,
            edges,
            rootNodeIds: roots,
            leafNodeIds: leaves,
            circularDependencies: circularDeps,
            sharedResources,
        };
    }

    /**
     * Get topological sort order (for migration ordering).
     */
    public getTopologicalOrder(): string[] {
        if (!this.graph) {
            return [];
        }

        const inDegree = new Map<string, number>();
        const adjacency = new Map<string, string[]>();

        // Initialize
        for (const node of this.graph.nodes) {
            inDegree.set(node.id, 0);
            adjacency.set(node.id, []);
        }

        // Build adjacency (reversed - dependencies before dependents)
        for (const edge of this.graph.edges) {
            adjacency.get(edge.target)?.push(edge.source);
            inDegree.set(edge.source, (inDegree.get(edge.source) || 0) + 1);
        }

        // Kahn's algorithm
        const queue = Array.from(inDegree.entries())
            .filter(([_, deg]) => deg === 0)
            .map(([id, _]) => id);

        const result: string[] = [];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                break;
            }
            result.push(current);

            for (const next of adjacency.get(current) || []) {
                const newDegree = (inDegree.get(next) || 0) - 1;
                inDegree.set(next, newDegree);
                if (newDegree === 0) {
                    queue.push(next);
                }
            }
        }

        return result;
    }

    /**
     * Export graph to D3.js compatible format.
     */
    public exportToD3Format(): { nodes: object[]; links: object[] } {
        if (!this.graph) {
            return { nodes: [], links: [] };
        }

        return {
            nodes: this.graph.nodes.map((n) => ({
                id: n.id,
                name: n.name,
                group: n.category,
                depth: n.depth,
            })),
            links: this.graph.edges.map((e) => ({
                source: e.source,
                target: e.target,
                type: e.type,
            })),
        };
    }

    /**
     * Clear graph.
     */
    public clearGraph(): void {
        this.graph = undefined;
        this.removeFromStorage();
    }

    // =========================================================================
    // Storage
    // =========================================================================

    private async saveToStorage(): Promise<void> {
        if (!this.graph) {
            return;
        }

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const migrationDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'migration');
            await fs.promises.mkdir(migrationDir, { recursive: true });

            const graphPath = path.join(migrationDir, 'dependency-graph.json');
            await fs.promises.writeFile(graphPath, JSON.stringify(this.graph, null, 2), 'utf-8');

            this.logger.debug('Dependency graph saved to storage');
        } catch (error) {
            this.logger.error('Failed to save dependency graph', error as Error);
        }
    }

    private async removeFromStorage(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const graphPath = path.join(
                workspaceFolder.uri.fsPath,
                '.vscode',
                'migration',
                'dependency-graph.json'
            );

            if (fs.existsSync(graphPath)) {
                await fs.promises.unlink(graphPath);
            }
        } catch {
            // Ignore errors
        }
    }

    /**
     * Dispose of resources.
     */
    public dispose(): void {
        DependencyGraphService.instance = undefined;
    }
}
