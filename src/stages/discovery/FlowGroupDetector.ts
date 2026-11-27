/**
 * Flow Group Detector
 *
 * Groups discovered artifacts into logical flows without Copilot:
 * - orchestrations / flows / processes linked by call chains form one flow;
 * - maps, schemas, pipelines, ports, projects and code attach to the flows that use them;
 * - artifacts used by several flows are marked shared instead of forcing those flows to merge.
 *
 * The same inventory always produces the same groups, IDs and names.
 *
 * @module stages/discovery/FlowGroupDetector
 */

import * as path from 'path';
import { createHash } from 'crypto';
import type { ParsedArtifact } from './types';
import type {
    ArtifactConnection,
    FlowGroup,
    FlowGroupsResult,
    MissingProjectReference,
} from '../../services/LLMFlowGenerator';

type JsonObject = Record<string, unknown>;

const ROOT_TYPES: ReadonlySet<string> = new Set(['orchestration', 'flow', 'process', 'workflow']);
const MAP_TYPES: ReadonlySet<string> = new Set(['map']);
const SCHEMA_TYPES: ReadonlySet<string> = new Set(['schema']);
const PIPELINE_TYPES: ReadonlySet<string> = new Set(['pipeline']);
const PROJECT_EXTENSIONS: ReadonlySet<string> = new Set(['.btproj', '.csproj', '.vbproj']);
const MAX_LISTED = 5;

/** Connection types that make two groups depend on each other. */
export const BLOCKING_CONNECTION_TYPES: ReadonlySet<string> = new Set([
    'subscription-filter',
    'message-type-subscription',
    'map-source-schema',
    'map-target-schema',
    'orchestration-uses-map',
    'orchestration-calls',
    'binding-references',
]);

export type FlowGroupingMode = 'deterministic' | 'copilot';

/** Resolve the `discovery.groupingMode` setting; `auto` groups BizTalk deterministically. */
export function resolveGroupingMode(
    setting: unknown,
    platform: string | undefined
): FlowGroupingMode {
    if (setting === 'deterministic' || setting === 'copilot') {
        return setting;
    }
    return (platform || 'biztalk').toLowerCase() === 'biztalk' ? 'deterministic' : 'copilot';
}

// =============================================================================
// Small helpers
// =============================================================================

function asObject(value: unknown): JsonObject | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as JsonObject)
        : undefined;
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map(asString).filter((item): item is string => item !== undefined)
        : [];
}

function objectsOf(value: unknown): JsonObject[] {
    return Array.isArray(value)
        ? value.map(asObject).filter((item): item is JsonObject => item !== undefined)
        : [];
}

function biztalkExtension(artifact: ParsedArtifact): JsonObject {
    return asObject(asObject(artifact.ir?.extensions)?.biztalk) ?? {};
}

function byName(a: string, b: string): number {
    return a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b);
}

/** Reduce a type name, assembly-qualified name or file path to its lower-case simple name. */
export function simpleName(reference: string): string {
    const typeName = reference.split(',')[0].split('+')[0].trim();
    const fileName = typeName.split(/[\\/]/).pop() ?? typeName;
    const withoutExtension = fileName.replace(
        /\.(xsd|btm|odx|btp|xslt?|dwl|bwp|process|xml|cs|btproj|csproj)$/i,
        ''
    );
    const segments = withoutExtension.split('.');
    return (segments[segments.length - 1] ?? '').trim().toLowerCase();
}

function normalizePath(filePath: string): string {
    // BizTalk projects record Windows separators; normalize them on every OS
    return path
        .resolve(filePath.replace(/[\\/]+/g, path.sep))
        .replace(/[\\/]+$/, '')
        .toLowerCase();
}

function isWithin(filePath: string, directory: string): boolean {
    return normalizePath(filePath).startsWith(normalizePath(directory) + path.sep);
}

function artifactPath(artifact: ParsedArtifact): string {
    return artifact.absolutePath || artifact.sourcePath;
}

function isProject(artifact: ParsedArtifact): boolean {
    return PROJECT_EXTENSIONS.has(path.extname(artifactPath(artifact)).toLowerCase());
}

function slug(value: string): string {
    const result = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/g, '');
    return result || 'flow';
}

function shortHash(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 6);
}

/** Turn `Orch_OrderNotification` or `Company.Sales.OrderNotification` into `Order Notification`. */
export function humanizeName(name: string): string {
    const base = name.split(/[.\\/]/).pop() || name;
    const words = base
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s_-]+/)
        .filter(Boolean);
    const meaningful = words.filter((word) => !/^(orch|orchestration|odx)$/i.test(word));
    return (meaningful.length > 0 ? meaningful : words)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function listNames(names: readonly string[]): string {
    const shown = names.slice(0, MAX_LISTED).join(', ');
    return names.length > MAX_LISTED ? `${shown} (+${names.length - MAX_LISTED} more)` : shown;
}

/** Visit every nested object of an IR fragment (actions, branches, scopes, source mappings). */
function visitObjects(value: unknown, visit: (node: JsonObject) => void, depth = 0): void {
    if (depth > 60 || value === null || typeof value !== 'object') {
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            visitObjects(item, visit, depth + 1);
        }
        return;
    }
    const node = value as JsonObject;
    visit(node);
    for (const child of Object.values(node)) {
        if (child !== null && typeof child === 'object') {
            visitObjects(child, visit, depth + 1);
        }
    }
}

// =============================================================================
// Artifact lookup by referenced type/file name
// =============================================================================

class ArtifactIndex {
    private readonly entries = new Map<string, ParsedArtifact[]>();

    constructor(artifacts: readonly ParsedArtifact[]) {
        for (const artifact of artifacts) {
            const names = new Set<string>([simpleName(artifact.name)]);
            for (const schema of artifact.ir?.schemas ?? []) {
                if (schema.name) {
                    names.add(simpleName(schema.name));
                }
            }
            for (const map of artifact.ir?.maps ?? []) {
                if (map.name) {
                    names.add(simpleName(map.name));
                }
            }
            const orchestrationName = asString(biztalkExtension(artifact).orchestrationName);
            if (orchestrationName) {
                names.add(simpleName(orchestrationName));
            }
            for (const name of names) {
                if (name) {
                    const list = this.entries.get(name) ?? [];
                    list.push(artifact);
                    this.entries.set(name, list);
                }
            }
        }
    }

    find(reference: string, types: ReadonlySet<string>): ParsedArtifact[] {
        const candidates = (this.entries.get(simpleName(reference)) ?? []).filter((artifact) =>
            types.has(artifact.type)
        );
        return this.disambiguate(reference, candidates);
    }

    /** Prefer candidates whose folders match the namespace of a qualified reference. */
    private disambiguate(reference: string, candidates: ParsedArtifact[]): ParsedArtifact[] {
        if (candidates.length <= 1) {
            return candidates;
        }
        const qualifiers = reference
            .split(',')[0]
            .split('+')[0]
            .trim()
            .toLowerCase()
            .split('.')
            .slice(0, -1);
        if (qualifiers.length === 0) {
            return candidates;
        }
        const scored = candidates.map((candidate) => {
            const location = artifactPath(candidate)
                .toLowerCase()
                .split(/[\\/.]/);
            return {
                candidate,
                score: qualifiers.filter((qualifier) => location.includes(qualifier)).length,
            };
        });
        const best = Math.max(...scored.map((entry) => entry.score));
        return best === 0
            ? candidates
            : scored.filter((entry) => entry.score === best).map((entry) => entry.candidate);
    }
}

// =============================================================================
// BizTalk binding model
// =============================================================================

interface ReceivePortModel {
    port: string;
    locations: { name: string; adapter?: string }[];
    pipelines: string[];
    maps: string[];
}

interface SendPortModel {
    port: string;
    adapter?: string;
    filter: string;
    pipelines: string[];
    maps: string[];
}

interface BindingModel {
    artifact: ParsedArtifact;
    receivePorts: Map<string, ReceivePortModel>;
    sendPorts: Map<string, SendPortModel>;
    sendGroups: Map<string, { members: string[]; filter: string }>;
    orchestrationBindings: { orchestrationName: string; boundTo: string[] }[];
}

function readBinding(artifact: ParsedArtifact): BindingModel {
    const endpoints = asObject((artifact.ir as unknown as JsonObject)?.endpoints) ?? {};
    const extension = biztalkExtension(artifact);

    const receivePorts = new Map<string, ReceivePortModel>();
    const receivePort = (name: string): ReceivePortModel => {
        const existing = receivePorts.get(name);
        if (existing) {
            return existing;
        }
        const created: ReceivePortModel = { port: name, locations: [], pipelines: [], maps: [] };
        receivePorts.set(name, created);
        return created;
    };
    for (const endpoint of objectsOf(endpoints.receive)) {
        const biztalk = asObject(asObject(endpoint.sourceMapping)?.biztalk) ?? {};
        const location = asString(endpoint.name) ?? asString(biztalk.receiveLocationName);
        const portName = asString(biztalk.receivePortName) ?? location;
        if (!portName) {
            continue;
        }
        const port = receivePort(portName);
        if (location) {
            port.locations.push({
                name: location,
                adapter: asString(biztalk.adapterType) ?? asString(endpoint.transport),
            });
        }
        port.pipelines.push(...asStringArray([biztalk.pipeline, biztalk.sendPipeline]));
    }
    for (const detail of objectsOf(extension.receivePortDetails)) {
        const name = asString(detail.name);
        if (name) {
            receivePort(name).maps.push(
                ...asStringArray(detail.inboundMaps),
                ...asStringArray(detail.outboundMaps)
            );
        }
    }

    const sendPorts = new Map<string, SendPortModel>();
    for (const endpoint of objectsOf(endpoints.send)) {
        const biztalk = asObject(asObject(endpoint.sourceMapping)?.biztalk) ?? {};
        const name = asString(endpoint.name) ?? asString(biztalk.sendPortName);
        if (!name) {
            continue;
        }
        sendPorts.set(name, {
            port: name,
            adapter: asString(biztalk.adapterType) ?? asString(endpoint.transport),
            filter: asString(biztalk.filter) ?? '',
            pipelines: asStringArray([biztalk.pipeline, biztalk.receivePipeline]),
            maps: [...asStringArray(biztalk.inboundMaps), ...asStringArray(biztalk.outboundMaps)],
        });
    }

    const sendGroups = new Map<string, { members: string[]; filter: string }>();
    for (const group of objectsOf(endpoints.sendGroups)) {
        const name = asString(group.name);
        if (name) {
            const filter = objectsOf(group.filters)
                .map((item) => asString(item.value) ?? '')
                .join(' ');
            sendGroups.set(name, { members: asStringArray(group.sendEndpoints), filter });
        }
    }

    const orchestrationBindings = objectsOf(extension.orchestrationBindings).map((binding) => ({
        orchestrationName: asString(binding.orchestrationName) ?? '',
        boundTo: objectsOf(binding.portBindings)
            .map((portBinding) => asString(portBinding.boundTo))
            .filter((name): name is string => name !== undefined),
    }));

    return { artifact, receivePorts, sendPorts, sendGroups, orchestrationBindings };
}

/** Receive ports a BizTalk subscription filter routes from (`BTS.ReceivePortName == X`). */
export function subscribedReceivePorts(filter: string): string[] {
    const ports = new Set<string>();
    for (const statement of filter.match(/<Statement\b[^>]*>/gi) ?? []) {
        const attribute = (name: string) =>
            new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(statement)?.[1];
        const operator = attribute('Operator') ?? '0';
        const value = attribute('Value');
        if (
            attribute('Property')?.toLowerCase() === 'bts.receiveportname' &&
            operator === '0' &&
            value
        ) {
            ports.add(value);
        }
    }
    for (const match of filter.matchAll(/BTS\.ReceivePortName\s*==\s*["']?([^"'\s)]+)["']?/gi)) {
        ports.add(match[1]);
    }
    return [...ports];
}

// =============================================================================
// Detection
// =============================================================================

interface Cluster {
    key: string;
    roots: ParsedArtifact[];
    routePort?: string;
    seeds: Set<string>;
    members: Set<string>;
    bindings: Set<string>;
    receiveLocations: Map<string, string | undefined>;
    receivePorts: Set<string>;
    sendPorts: Map<string, string | undefined>;
    sendGroups: Set<string>;
}

function newCluster(key: string, roots: ParsedArtifact[], routePort?: string): Cluster {
    return {
        key,
        roots,
        routePort,
        seeds: new Set(roots.map((root) => root.id)),
        members: new Set(),
        bindings: new Set(),
        receiveLocations: new Map(),
        receivePorts: new Set(),
        sendPorts: new Map(),
        sendGroups: new Set(),
    };
}

/**
 * Find project references (recorded by `.btproj` files) whose projects were not scanned.
 */
export function findMissingProjectReferences(
    artifacts: readonly ParsedArtifact[]
): MissingProjectReference[] {
    const scanned = new Set(artifacts.map((artifact) => normalizePath(artifactPath(artifact))));
    const missing = new Map<string, MissingProjectReference>();
    for (const artifact of artifacts) {
        for (const reference of asStringArray(biztalkExtension(artifact).projectReferences)) {
            const key = normalizePath(reference);
            if (scanned.has(key)) {
                continue;
            }
            const entry = missing.get(key) ?? {
                project: (reference.split(/[\\/]/).pop() ?? reference).replace(/\.[^.]+$/, ''),
                path: reference,
                referencedBy: [],
            };
            if (!entry.referencedBy.includes(artifact.name)) {
                entry.referencedBy.push(artifact.name);
                entry.referencedBy.sort(byName);
            }
            missing.set(key, entry);
        }
    }
    return [...missing.values()].sort((a, b) => byName(a.project, b.project));
}

/**
 * Deterministically group artifacts into logical flows.
 */
export function detectFlowGroups(artifacts: readonly ParsedArtifact[]): FlowGroupsResult {
    const sorted = [...artifacts].sort((a, b) => byName(a.id, b.id));
    const byId = new Map(sorted.map((artifact) => [artifact.id, artifact]));
    const index = new ArtifactIndex(sorted);
    const roots = sorted.filter((artifact) => ROOT_TYPES.has(artifact.type));

    // ── Call chains: union roots that call or start each other (exact names only) ──
    const parent = new Map(roots.map((root) => [root.id, root.id]));
    const find = (id: string): string => {
        let current = id;
        while (parent.get(current) !== current) {
            current = parent.get(current) as string;
        }
        parent.set(id, current);
        return current;
    };
    const union = (a: string, b: string) => {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) {
            if (rootA < rootB) {
                parent.set(rootB, rootA);
            } else {
                parent.set(rootA, rootB);
            }
        }
    };

    const uses = new Map<string, Set<string>>();
    const addUse = (from: string, to: string) => {
        if (from !== to) {
            const set = uses.get(from) ?? new Set<string>();
            set.add(to);
            uses.set(from, set);
        }
    };
    const calledRoots = new Set<string>();

    for (const root of roots) {
        const callTargets = new Set<string>();
        const mapReferences = new Set<string>();
        visitObjects(root.ir?.actions, (node) => {
            const shapeType = asString(node.shapeType);
            if (shapeType === 'CallOrchestration' && asString(node.calledOrchestration)) {
                callTargets.add(asString(node.calledOrchestration) as string);
            }
            if (shapeType === 'StartOrchestration' && asString(node.startedOrchestration)) {
                callTargets.add(asString(node.startedOrchestration) as string);
            }
            if (node.type === 'call-workflow') {
                const workflowName = asString(asObject(node.config)?.workflowName);
                if (workflowName) {
                    callTargets.add(workflowName);
                }
            }
            for (const reference of [asString(node.mapReference), asString(node.mapTypeName)]) {
                if (reference) {
                    mapReferences.add(reference);
                }
            }
        });
        for (const target of callTargets) {
            for (const callee of index.find(target, ROOT_TYPES)) {
                if (callee.id !== root.id) {
                    union(root.id, callee.id);
                    calledRoots.add(callee.id);
                }
            }
        }
        for (const reference of mapReferences) {
            for (const map of index.find(reference, MAP_TYPES)) {
                addUse(root.id, map.id);
            }
        }
        for (const messageType of asStringArray(biztalkExtension(root).messageTypes)) {
            for (const schema of index.find(messageType, SCHEMA_TYPES)) {
                addUse(root.id, schema.id);
            }
        }
    }

    // ── Maps use their source and target schemas ──
    for (const artifact of sorted) {
        for (const map of artifact.ir?.maps ?? []) {
            const btm = map as unknown as JsonObject;
            const references = [
                asString(btm.sourceSchema),
                asString(btm.targetSchema),
                asString(map.source?.schemaRef),
                asString(map.target?.schemaRef),
            ].filter((reference): reference is string => reference !== undefined);
            for (const reference of references) {
                for (const schema of index.find(reference, SCHEMA_TYPES)) {
                    addUse(artifact.id, schema.id);
                }
            }
        }
    }

    // ── Build clusters from call chains ──
    const clustersByRoot = new Map<string, Cluster>();
    const clusters: Cluster[] = [];
    for (const root of roots) {
        const key = find(root.id);
        let cluster = clustersByRoot.get(key);
        if (!cluster) {
            cluster = newCluster(key, []);
            clustersByRoot.set(key, cluster);
            clusters.push(cluster);
        }
        cluster.roots.push(root);
        cluster.seeds.add(root.id);
    }
    const clusterOfRoot = (rootId: string) => clustersByRoot.get(find(rootId));

    // ── Attribute binding ports to flows ──
    const bindings = sorted
        .filter((artifact) => artifact.type === 'binding')
        .map((artifact) => readBinding(artifact));
    const attributedReceivePorts = new Set<string>();
    const attributedSendPorts = new Set<string>();
    const findRootForBinding = (orchestrationName: string): ParsedArtifact | undefined => {
        const qualified = orchestrationName.toLowerCase();
        const exact = roots.find((root) => {
            const extension = biztalkExtension(root);
            const namespace = asString(extension.namespace);
            const name = asString(extension.orchestrationName) ?? root.name;
            return namespace ? `${namespace}.${name}`.toLowerCase() === qualified : false;
        });
        return exact ?? index.find(orchestrationName, ROOT_TYPES)[0];
    };

    const attributePort = (cluster: Cluster, binding: BindingModel, portName: string) => {
        cluster.bindings.add(binding.artifact.id);
        const receive = binding.receivePorts.get(portName);
        if (receive) {
            cluster.receivePorts.add(receive.port);
            attributedReceivePorts.add(`${binding.artifact.id}:${receive.port}`);
            for (const location of receive.locations) {
                cluster.receiveLocations.set(location.name, location.adapter);
            }
            for (const pipeline of receive.pipelines) {
                index.find(pipeline, PIPELINE_TYPES).forEach((a) => cluster.seeds.add(a.id));
            }
            for (const map of receive.maps) {
                index.find(map, MAP_TYPES).forEach((a) => cluster.seeds.add(a.id));
            }
            return;
        }
        const send = binding.sendPorts.get(portName);
        if (send) {
            cluster.sendPorts.set(send.port, send.adapter);
            attributedSendPorts.add(`${binding.artifact.id}:${send.port}`);
            for (const pipeline of send.pipelines) {
                index.find(pipeline, PIPELINE_TYPES).forEach((a) => cluster.seeds.add(a.id));
            }
            for (const map of send.maps) {
                index.find(map, MAP_TYPES).forEach((a) => cluster.seeds.add(a.id));
            }
            return;
        }
        const group = binding.sendGroups.get(portName);
        if (group) {
            cluster.sendGroups.add(portName);
            for (const member of group.members) {
                if (binding.sendPorts.has(member)) {
                    attributePort(cluster, binding, member);
                }
            }
        }
    };

    const attributeSubscribers = (cluster: Cluster, binding: BindingModel) => {
        for (const send of binding.sendPorts.values()) {
            if (subscribedReceivePorts(send.filter).some((p) => cluster.receivePorts.has(p))) {
                attributePort(cluster, binding, send.port);
            }
        }
        for (const [name, group] of binding.sendGroups) {
            if (subscribedReceivePorts(group.filter).some((p) => cluster.receivePorts.has(p))) {
                attributePort(cluster, binding, name);
            }
        }
    };

    for (const binding of bindings) {
        for (const orchestrationBinding of binding.orchestrationBindings) {
            const root = findRootForBinding(orchestrationBinding.orchestrationName);
            const cluster = root ? clusterOfRoot(root.id) : undefined;
            if (!cluster) {
                continue;
            }
            for (const portName of orchestrationBinding.boundTo) {
                attributePort(cluster, binding, portName);
            }
        }
        for (const cluster of clusters) {
            if (cluster.bindings.has(binding.artifact.id)) {
                attributeSubscribers(cluster, binding);
            }
        }
    }

    // ── Messaging-only routes: receive ports subscribed by send ports, no orchestration ──
    for (const binding of bindings) {
        const subscribed = new Set<string>();
        for (const send of binding.sendPorts.values()) {
            subscribedReceivePorts(send.filter).forEach((port) => subscribed.add(port));
        }
        for (const group of binding.sendGroups.values()) {
            subscribedReceivePorts(group.filter).forEach((port) => subscribed.add(port));
        }
        for (const portName of [...binding.receivePorts.keys()].sort(byName)) {
            if (
                !subscribed.has(portName) ||
                attributedReceivePorts.has(`${binding.artifact.id}:${portName}`)
            ) {
                continue;
            }
            const route = newCluster(`route:${binding.artifact.id}:${portName}`, [], portName);
            clusters.push(route);
            attributePort(route, binding, portName);
            attributeSubscribers(route, binding);
        }
    }

    // ── Attach what each flow uses (transitively), then bindings ──
    for (const cluster of clusters) {
        const queue = [...cluster.seeds];
        while (queue.length > 0) {
            const id = queue.shift() as string;
            if (cluster.members.has(id) || !byId.has(id)) {
                continue;
            }
            cluster.members.add(id);
            for (const used of uses.get(id) ?? []) {
                if (!ROOT_TYPES.has(byId.get(used)?.type ?? '')) {
                    queue.push(used);
                }
            }
        }
        cluster.bindings.forEach((id) => cluster.members.add(id));
    }

    // ── Attach projects containing members, the projects they reference, and their code ──
    const projects = sorted.filter(isProject);
    const projectByPath = new Map(projects.map((p) => [normalizePath(artifactPath(p)), p]));
    const codeFiles = sorted.filter(
        (artifact) => artifact.type === 'custom-code' && !isProject(artifact)
    );
    for (const cluster of clusters) {
        const memberPaths = [...cluster.members]
            .map((id) => byId.get(id))
            .filter((artifact): artifact is ParsedArtifact => artifact !== undefined)
            .map(artifactPath);
        const attached = new Set<ParsedArtifact>(
            projects.filter((project) => {
                const directory = path.dirname(artifactPath(project));
                return memberPaths.some((memberPath) => isWithin(memberPath, directory));
            })
        );
        const pending = [...attached];
        while (pending.length > 0) {
            const project = pending.shift() as ParsedArtifact;
            for (const reference of asStringArray(biztalkExtension(project).projectReferences)) {
                const referenced = projectByPath.get(normalizePath(reference));
                if (referenced && !attached.has(referenced)) {
                    attached.add(referenced);
                    pending.push(referenced);
                }
            }
        }
        for (const project of attached) {
            cluster.members.add(project.id);
            const directory = path.dirname(artifactPath(project));
            for (const code of codeFiles) {
                if (isWithin(artifactPath(code), directory)) {
                    cluster.members.add(code.id);
                }
            }
        }
    }

    const populated = clusters.filter((cluster) => cluster.members.size > 0);

    // ── Shared artifacts: used by more than one flow ──
    const usage = new Map<string, number>();
    for (const cluster of populated) {
        for (const id of cluster.members) {
            usage.set(id, (usage.get(id) ?? 0) + 1);
        }
    }
    const sharedArtifactIds = [...usage]
        .filter(([, count]) => count > 1)
        .map(([id]) => id)
        .sort(byName);

    // ── Name and describe each flow ──
    const groups = buildGroups(populated, byId, calledRoots);
    const grouped = new Set(groups.flatMap((group) => group.artifactIds));
    const ungroupedArtifactIds = sorted
        .filter((artifact) => !grouped.has(artifact.id))
        .map((artifact) => artifact.id);

    const unattributedPorts = bindings.flatMap((binding) => [
        ...[...binding.receivePorts.keys()].filter(
            (port) => !attributedReceivePorts.has(`${binding.artifact.id}:${port}`)
        ),
        ...[...binding.sendPorts.keys()].filter(
            (port) => !attributedSendPorts.has(`${binding.artifact.id}:${port}`)
        ),
    ]);
    const missingProjects = findMissingProjectReferences(sorted);

    return {
        groups,
        ungroupedArtifactIds,
        sharedArtifactIds,
        missingProjects,
        detectionMode: 'deterministic',
        explanation: explain({
            artifactCount: sorted.length,
            groups,
            routes: populated.filter((cluster) => cluster.roots.length === 0).length,
            rootCount: roots.length,
            sharedCount: sharedArtifactIds.length,
            ungroupedCount: ungroupedArtifactIds.length,
            unattributedPorts: [...new Set(unattributedPorts)].sort(byName),
            missingProjects,
        }),
    };
}

function buildGroups(
    clusters: Cluster[],
    byId: Map<string, ParsedArtifact>,
    calledRoots: Set<string>
): FlowGroup[] {
    const candidates = clusters.map((cluster) => {
        const roots = [...cluster.roots].sort((a, b) => byName(a.name, b.name));
        const entryRoots = roots.filter((root) => !calledRoots.has(root.id));
        const primary = entryRoots[0] ?? roots[0];
        const baseName = primary ? primary.name : (cluster.routePort ?? 'flow');
        // Stable identity: the entry orchestration/flow, or the route's binding and port
        const identity = primary ? primary.id : cluster.key;
        return { cluster, roots, primary, baseName, identity };
    });
    const slugCounts = new Map<string, number>();
    for (const candidate of candidates) {
        const base = slug(candidate.baseName);
        slugCounts.set(base, (slugCounts.get(base) ?? 0) + 1);
    }

    const groups = candidates.map(({ cluster, roots, primary, baseName, identity }) => {
        // Flows sharing a name are all suffixed from their own identity, so re-detection
        // can never hand one flow's ID (and saved progress) to another flow.
        const base = slug(baseName);
        const id =
            (slugCounts.get(base) ?? 0) > 1
                ? `flow-${base}-${shortHash(identity)}`
                : `flow-${base}`;

        const artifactIds = [...cluster.members].sort(byName);
        const maps = artifactIds
            .map((artifactId) => byId.get(artifactId))
            .filter((artifact): artifact is ParsedArtifact => artifact?.type === 'map')
            .map((artifact) => artifact.name)
            .sort(byName);
        const receiveLocations = [...cluster.receiveLocations.keys()].sort(byName);
        const sendPorts = [...cluster.sendPorts.keys()].sort(byName);
        const endpointNames = [
            ...new Set([
                ...receiveLocations,
                ...cluster.receivePorts,
                ...sendPorts,
                ...cluster.sendGroups,
            ]),
        ].sort(byName);

        const withAdapter = (name: string, adapter: string | undefined) =>
            adapter ? `${name} (${adapter})` : name;
        const parts: string[] = [];
        if (roots.length > 0) {
            const label =
                primary?.type === 'orchestration'
                    ? 'Orchestrations'
                    : primary?.type === 'process'
                      ? 'Processes'
                      : primary?.type === 'workflow'
                        ? 'Workflows'
                        : 'Flows';
            parts.push(`${label}: ${listNames(roots.map((root) => root.name))}.`);
        } else {
            parts.push(
                `Messaging route without an orchestration (receive port ${cluster.routePort}).`
            );
        }
        if (receiveLocations.length > 0) {
            parts.push(
                `Receives: ${listNames(receiveLocations.map((name) => withAdapter(name, cluster.receiveLocations.get(name))))}.`
            );
        }
        if (sendPorts.length > 0) {
            parts.push(
                `Sends: ${listNames(sendPorts.map((name) => withAdapter(name, cluster.sendPorts.get(name))))}.`
            );
        }
        if (maps.length > 0) {
            parts.push(`Maps: ${listNames(maps)}.`);
        }

        let entryPoint: FlowGroup['entryPoint'];
        if (receiveLocations.length > 0) {
            entryPoint = { type: 'receive-location', name: receiveLocations[0] };
        } else if (cluster.routePort) {
            entryPoint = { type: 'receive-port', name: cluster.routePort };
        } else if (primary) {
            entryPoint = {
                type: primary.type === 'orchestration' ? 'orchestration' : 'flow',
                name: primary.name,
            };
        }

        const group: FlowGroup = {
            id,
            name: roots.length > 0 ? humanizeName(baseName) : `${humanizeName(baseName)} Route`,
            description: parts.join(' '),
            category:
                receiveLocations.length > 0 || cluster.routePort
                    ? 'message-flow'
                    : 'business-process',
            artifactIds,
            summary: {
                receivePorts: receiveLocations.length || cluster.receivePorts.size,
                orchestrations: roots.length,
                maps: maps.length,
                sendPorts: sendPorts.length,
            },
            ...(entryPoint ? { entryPoint } : {}),
            ...(sendPorts.length > 0
                ? {
                      exitPoints: sendPorts.map((name) => ({
                          type: 'send-port' as const,
                          name,
                      })),
                  }
                : {}),
            ...(endpointNames.length > 0 ? { endpointNames } : {}),
        };
        return group;
    });
    return groups.sort((a, b) => byName(a.name, b.name) || byName(a.id, b.id));
}

function explain(details: {
    artifactCount: number;
    groups: FlowGroup[];
    routes: number;
    rootCount: number;
    sharedCount: number;
    ungroupedCount: number;
    unattributedPorts: string[];
    missingProjects: MissingProjectReference[];
}): string {
    const sentences = [
        `Grouped ${details.artifactCount} artifacts deterministically into ${details.groups.length} flow(s): ` +
            `${details.groups.length - details.routes} built from ${details.rootCount} orchestration(s)/flow(s) ` +
            `joined only by Call/Start Orchestration chains, and ${details.routes} messaging-only route(s).`,
        `Maps, schemas, pipelines, ports and projects belong to the flows that reference them; ` +
            `${details.sharedCount} artifact(s) used by several flows are shared and listed in each of them.`,
    ];
    if (details.ungroupedCount > 0) {
        sentences.push(`${details.ungroupedCount} artifact(s) are not referenced by any flow.`);
    }
    if (details.unattributedPorts.length > 0) {
        sentences.push(
            `Ports not linked to a flow by orchestration bindings or subscription filters: ${listNames(details.unattributedPorts)}.`
        );
    }
    if (details.missingProjects.length > 0) {
        sentences.push(
            `Referenced projects missing from the source folder: ${listNames(details.missingProjects.map((p) => p.project))}. Add them and rescan.`
        );
    }
    return sentences.join(' ');
}

// =============================================================================
// Validation and scoping helpers
// =============================================================================

export interface CrossGroupDependency {
    fromGroup: string;
    toGroup: string;
    fromArtifactId: string;
    toArtifactId: string;
    dependencyType: string;
    evidence: string;
}

interface GroupMembership {
    id: string;
    name: string;
    artifactIds?: readonly string[];
}

/** Artifacts placed in more than one group without being declared shared. */
export function findUndeclaredSharedArtifacts(
    groups: readonly GroupMembership[],
    sharedArtifactIds: ReadonlySet<string>
): { artifactId: string; groups: string[] }[] {
    const memberships = new Map<string, string[]>();
    for (const group of groups) {
        for (const artifactId of new Set(group.artifactIds ?? [])) {
            if (!sharedArtifactIds.has(artifactId)) {
                memberships.set(artifactId, [...(memberships.get(artifactId) ?? []), group.name]);
            }
        }
    }
    return [...memberships]
        .filter(([, names]) => names.length > 1)
        .map(([artifactId, names]) => ({ artifactId, groups: names }));
}

/** Dependencies between groups; edges touching shared artifacts are allowed. */
export function findCrossGroupDependencies(
    groups: readonly GroupMembership[],
    connections: readonly ArtifactConnection[],
    sharedArtifactIds: ReadonlySet<string>
): CrossGroupDependency[] {
    const groupOf = new Map<string, GroupMembership>();
    for (const group of groups) {
        for (const artifactId of group.artifactIds ?? []) {
            if (!sharedArtifactIds.has(artifactId)) {
                groupOf.set(artifactId, group);
            }
        }
    }
    return connections
        .filter((connection) => BLOCKING_CONNECTION_TYPES.has(connection.type))
        .map((connection) => ({
            connection,
            from: groupOf.get(connection.fromId),
            to: groupOf.get(connection.toId),
        }))
        .filter(({ from, to }) => from !== undefined && to !== undefined && from.id !== to.id)
        .map(({ connection, from, to }) => ({
            fromGroup: from?.name || from?.id || 'unknown',
            toGroup: to?.name || to?.id || 'unknown',
            fromArtifactId: connection.fromId,
            toArtifactId: connection.toId,
            dependencyType: connection.type,
            evidence: connection.evidence,
        }));
}

/**
 * Artifacts added to or removed from the inventory since the groups were detected.
 */
export function compareInventoryWithGroups(
    inventoryIds: readonly string[],
    result: Pick<FlowGroupsResult, 'groups' | 'ungroupedArtifactIds' | 'sharedArtifactIds'>
): { added: string[]; removed: string[] } {
    const known = new Set([
        ...result.groups.flatMap((group) => group.artifactIds ?? []),
        ...(result.ungroupedArtifactIds ?? []),
        ...(result.sharedArtifactIds ?? []),
    ]);
    const current = new Set(inventoryIds);
    return {
        added: [...current].filter((id) => !known.has(id)).sort(byName),
        removed: [...known].filter((id) => !current.has(id)).sort(byName),
    };
}

/**
 * Keep only the endpoints of an artifact that belong to a flow. Without endpoint names
 * (non-BizTalk platforms or legacy groups) every endpoint is kept.
 */
export function scopeEndpointsToFlow<R, S>(
    receive: readonly R[],
    send: readonly S[],
    endpointNames: readonly string[] | undefined
): { receive: R[]; send: S[]; omitted: number } {
    if (!endpointNames || endpointNames.length === 0) {
        return { receive: [...receive], send: [...send], omitted: 0 };
    }
    const names = new Set(endpointNames.map((name) => name.toLowerCase()));
    const belongs = (endpoint: unknown, extraName: string) => {
        const node = asObject(endpoint) ?? {};
        const biztalk = asObject(asObject(node.sourceMapping)?.biztalk) ?? {};
        return [asString(node.name), asString(biztalk[extraName])].some(
            (name) => typeof name === 'string' && names.has(name.toLowerCase())
        );
    };
    const scopedReceive = receive.filter((endpoint) => belongs(endpoint, 'receivePortName'));
    const scopedSend = send.filter((endpoint) => belongs(endpoint, 'sendPortName'));
    return {
        receive: scopedReceive,
        send: scopedSend,
        omitted: receive.length - scopedReceive.length + (send.length - scopedSend.length),
    };
}
