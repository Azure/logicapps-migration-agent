/**
 * Dell Boomi component reader
 *
 * Classifies Boomi component files, reads them into the normalized model,
 * and builds a per-project component index used to resolve cross-component
 * references (process calls, connector operations, connections, maps).
 *
 * @module parsers/boomi/BoomiComponentReader
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseXml } from '../utils/xml';
import {
    BoomiComponentKind,
    BoomiComponentRef,
    BoomiDialect,
    BoomiMap,
    BoomiProcess,
    BoomiShape,
} from './types';

/** Manifest file produced by Boomi migration corpora / export tooling. */
export const BOOMI_MANIFEST_FILE = 'migration-manifest.json';

/** Folder names commonly used to organize Boomi component exports. */
export const BOOMI_FOLDER_NAMES = [
    'processes',
    'connections',
    'operations',
    'maps',
    'profiles',
    'scripts',
    'processproperties',
    'crossreferences',
    'environmentextensions',
    'edi',
    'tradingpartners',
];

/** Native Boomi process shape types. */
export const BOOMI_SHAPE_TYPES = new Set([
    'start',
    'connectoraction',
    'map',
    'processcall',
    'processroute',
    'decision',
    'branch',
    'route',
    'trycatch',
    'catcherrors',
    'dataprocess',
    'documentproperties',
    'setproperties',
    'message',
    'notify',
    'stop',
    'returndocuments',
    'exception',
    'flowcontrol',
    'cleanse',
    'businessrules',
    'addtocache',
    'retrievefromcache',
    'removefromcache',
    'findchanges',
    'note',
]);

const SYNTHETIC_ROOTS: Record<string, BoomiComponentKind> = {
    syntheticboomiprocess: 'process',
    syntheticboomiconnection: 'connection',
    syntheticboomioperation: 'operation',
    syntheticboomimap: 'map',
    syntheticboomiprofile: 'profile',
    synthetictradingpartner: 'trading-partner',
};

const HEAD_BYTES = 8192;
const INDEX_TTL_MS = 10_000;
const MAX_INDEX_DEPTH = 8;

interface ClassificationCacheEntry {
    readonly mtimeMs: number;
    readonly size: number;
    readonly kind: BoomiComponentKind | null;
}

const classificationCache = new Map<string, ClassificationCacheEntry>();
const projectIndexCache = new Map<string, { builtAt: number; index: BoomiProjectIndex }>();
const manifestRootCache = new Map<string, string | null>();

/**
 * Clear all Boomi reader caches (used by tests and after re-scans).
 */
export function clearBoomiCaches(): void {
    classificationCache.clear();
    projectIndexCache.clear();
    manifestRootCache.clear();
    manifestCache.clear();
}

// =============================================================================
// Classification
// =============================================================================

/**
 * Map a native AtomSphere component `type` to a component kind.
 */
export function kindFromNativeType(componentType: string | undefined): BoomiComponentKind {
    const type = (componentType || '').toLowerCase();
    if (type === 'process') {
        return 'process';
    }
    if (type === 'connector-settings') {
        return 'connection';
    }
    if (type === 'connector-action') {
        return 'operation';
    }
    if (type === 'transform.map') {
        return 'map';
    }
    if (type.startsWith('profile.')) {
        return 'profile';
    }
    if (type === 'tradingpartner') {
        return 'trading-partner';
    }
    if (type.startsWith('script.')) {
        return 'script';
    }
    if (type === 'processproperty') {
        return 'process-property';
    }
    if (type === 'crossref') {
        return 'cross-reference';
    }
    return 'component';
}

/**
 * Classify an XML string as a Boomi component, or return null.
 */
export function classifyBoomiXml(content: string): BoomiComponentKind | null {
    const head = content.slice(0, HEAD_BYTES);
    const rootMatch = /<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\b([^>]*)>/.exec(
        head.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '')
    );
    if (!rootMatch) {
        return null;
    }

    const localName = rootMatch[2].toLowerCase();
    const synthetic = SYNTHETIC_ROOTS[localName];
    if (synthetic) {
        return synthetic;
    }

    if (localName === 'component') {
        const attrs = rootMatch[3];
        const isBoomi =
            /api\.platform\.boomi\.com/i.test(attrs) ||
            /boomi/i.test(rootMatch[1] || '') ||
            /\bcomponentId\s*=/.test(attrs);
        if (!isBoomi) {
            return null;
        }
        const typeMatch = /\btype\s*=\s*"([^"]*)"/.exec(attrs);
        return kindFromNativeType(typeMatch?.[1]);
    }

    return null;
}

/**
 * Classify a file as a Boomi component (cached by mtime/size).
 * Returns null when the file is not recognizably part of a Boomi project.
 */
export function classifyBoomiFile(filePath: string): BoomiComponentKind | null {
    let stat: fs.Stats;
    try {
        stat = fs.statSync(filePath);
    } catch {
        return null;
    }
    if (!stat.isFile()) {
        return null;
    }

    const cached = classificationCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return cached.kind;
    }

    const kind = classifyUncached(filePath);
    classificationCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, kind });
    return kind;
}

function classifyUncached(filePath: string): BoomiComponentKind | null {
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath).toLowerCase();

    if (ext === '.xml') {
        const head = readHead(filePath);
        return head ? classifyBoomiXml(head) : null;
    }

    if (baseName === BOOMI_MANIFEST_FILE) {
        return isBoomiManifest(filePath) ? 'manifest' : null;
    }

    // Non-XML companion files are only claimed inside a Boomi manifest root.
    if (!BOOMI_COMPANION_EXTENSIONS.has(ext)) {
        return null;
    }
    const root = findManifestRoot(filePath);
    if (!root) {
        return null;
    }

    const folders = path
        .relative(root, path.dirname(filePath))
        .split(/[\\/]/)
        .map((segment) => segment.toLowerCase());
    if (folders.some((folder) => TEST_ASSET_FOLDERS.has(folder)) || EDI_EXTENSIONS.has(ext)) {
        return 'test-asset';
    }
    if (ext === '.json') {
        const byFolder = folders.map((folder) => JSON_FOLDER_KINDS[folder]).find(Boolean);
        if (byFolder) {
            return byFolder;
        }
    }

    switch (ext) {
        case '.xsd':
            return 'profile';
        case '.properties':
            return 'process-property';
        case '.csv':
            return 'cross-reference';
        case '.groovy':
        case '.js':
            return 'script';
        default: {
            // .json / .yaml / .yml
            if (isUnderFolder(filePath, 'profiles')) {
                return ext === '.json' ? 'profile' : 'environment';
            }
            const head = readHead(filePath) || '';
            if (isUnderFolder(filePath, 'apis') || /["']?(openapi|swagger)["']?\s*:/i.test(head)) {
                return 'api';
            }
            return 'environment';
        }
    }
}

/** Non-XML files that belong to a Boomi project when found under its manifest root. */
const BOOMI_COMPANION_EXTENSIONS = new Set([
    '.json',
    '.yaml',
    '.yml',
    '.xsd',
    '.properties',
    '.csv',
    '.groovy',
    '.js',
    '.edi',
    '.x12',
]);

/** Raw EDI interchange files (sample payloads in migration corpora). */
const EDI_EXTENSIONS = new Set(['.edi', '.x12']);

/** Folders holding sample payloads, expected outputs and test definitions. */
const TEST_ASSET_FOLDERS = new Set(['samples', 'sample', 'tests', 'test', 'testdata']);

/** JSON component exports organized in well-known Boomi folders. */
const JSON_FOLDER_KINDS: Record<string, BoomiComponentKind> = {
    connections: 'connection',
    operations: 'operation',
    maps: 'map',
    tradingpartners: 'trading-partner',
    crossreferences: 'cross-reference',
    processproperties: 'process-property',
};

const manifestCache = new Map<string, boolean>();

/**
 * A `migration-manifest.json` belongs to a Boomi project when it names
 * Boomi/AtomSphere or sits next to Boomi process components.
 */
export function isBoomiManifest(manifestPath: string): boolean {
    const cached = manifestCache.get(manifestPath);
    if (cached !== undefined) {
        return cached;
    }
    const head = fs.existsSync(manifestPath) ? readHead(manifestPath) : null;
    const result =
        head !== null &&
        (/boomi|atomsphere/i.test(head) || containsBoomiProcess(path.dirname(manifestPath), 2));
    manifestCache.set(manifestPath, result);
    return result;
}

function readHead(filePath: string): string | null {
    try {
        const fd = fs.openSync(filePath, 'r');
        try {
            const buffer = Buffer.alloc(HEAD_BYTES);
            const bytesRead = fs.readSync(fd, buffer, 0, HEAD_BYTES, 0);
            return buffer.toString('utf-8', 0, bytesRead);
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
}

function isUnderFolder(filePath: string, folderName: string): boolean {
    return path
        .dirname(filePath)
        .split(/[\\/]/)
        .some((segment) => segment.toLowerCase() === folderName);
}

// =============================================================================
// Project root discovery
// =============================================================================

/**
 * Find the nearest ancestor folder (up to 5 levels) that contains a Boomi
 * migration manifest.
 */
export function findManifestRoot(filePath: string): string | null {
    let dir =
        fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
            ? filePath
            : path.dirname(filePath);
    const visited: string[] = [];
    let result: string | null = null;

    for (let i = 0; i < 6; i++) {
        const cached = manifestRootCache.get(dir);
        if (cached !== undefined) {
            result = cached;
            break;
        }
        visited.push(dir);
        if (isBoomiManifest(path.join(dir, BOOMI_MANIFEST_FILE))) {
            result = dir;
            break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }

    for (const v of visited) {
        manifestRootCache.set(v, result);
    }
    return result;
}

/**
 * Resolve the Boomi project root for a component file.
 * Prefers a manifest folder; otherwise climbs out of well-known Boomi folders.
 */
export function resolveProjectRoot(filePath: string): string {
    const manifestRoot = findManifestRoot(filePath);
    if (manifestRoot) {
        return manifestRoot;
    }

    let dir = path.dirname(filePath);
    for (let i = 0; i < 3; i++) {
        if (!BOOMI_FOLDER_NAMES.includes(path.basename(dir).toLowerCase())) {
            break;
        }
        dir = path.dirname(dir);
    }
    return dir;
}

/**
 * Check whether a folder (searched up to `maxDepth` levels) contains a Boomi process component.
 */
export function containsBoomiProcess(dir: string, maxDepth = 3, depth = 0): boolean {
    if (depth > maxDepth) {
        return false;
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return false;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
            if (classifyBoomiFile(fullPath) === 'process') {
                return true;
            }
        } else if (
            entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            entry.name !== 'node_modules' &&
            containsBoomiProcess(fullPath, maxDepth, depth + 1)
        ) {
            return true;
        }
    }
    return false;
}

// =============================================================================
// Component references
// =============================================================================

/**
 * Read the identity/reference data of a Boomi component file.
 */
export function readComponentRef(filePath: string, content?: string): BoomiComponentRef | null {
    const kind = classifyBoomiFile(filePath);
    if (!kind || kind === 'manifest') {
        return null;
    }

    const defaultName = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xml') {
        const name = defaultName.replace(/\.schema$/i, '');
        if (ext === '.json' && JSON_REF_KINDS.has(kind)) {
            return readJsonComponentRef(kind, name, filePath, content);
        }
        return { kind, name, filePath, dialect: 'file' };
    }

    const text = content ?? safeRead(filePath);
    if (!text) {
        return null;
    }
    const doc = parseXml(text);
    const root = doc?.documentElement;
    if (!root) {
        return null;
    }

    const rootName = localName(root).toLowerCase();
    if (rootName === 'component') {
        const componentType = attr(root, 'type');
        const connectorType = attr(root, 'subType');
        let operation: string | undefined;
        if (kind === 'operation') {
            const match =
                /\b(?:actionType|operationType|customOperationType)\s*=\s*"([^"]+)"/i.exec(text);
            operation = match?.[1];
        }
        return {
            kind,
            name: attr(root, 'name') || defaultName,
            componentId: attr(root, 'componentId'),
            componentType,
            connectorType,
            operation,
            filePath,
            dialect: 'native',
        };
    }

    return {
        kind,
        name: attr(root, 'name') || defaultName,
        componentType: rootName,
        connectorType: attr(root, 'type') || attr(root, 'connectorType'),
        connection: attr(root, 'connection'),
        operation: attr(root, 'operation'),
        auth: attr(root, 'auth'),
        filePath,
        dialect: 'synthetic',
    };
}

/** Component kinds whose JSON exports carry identity/reference fields. */
const JSON_REF_KINDS = new Set<BoomiComponentKind>([
    'connection',
    'operation',
    'map',
    'trading-partner',
]);

function readJsonComponentRef(
    kind: BoomiComponentKind,
    defaultName: string,
    filePath: string,
    content?: string
): BoomiComponentRef {
    let json: Record<string, unknown> = {};
    try {
        const parsed: unknown = JSON.parse(content ?? safeRead(filePath) ?? '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            json = parsed as Record<string, unknown>;
        }
    } catch {
        // Malformed JSON is reported by the component parser.
    }
    const str = (key: string): string | undefined =>
        typeof json[key] === 'string' && json[key] ? (json[key] as string) : undefined;
    const documents = Array.isArray(json['documents'])
        ? (json['documents'] as unknown[]).map(String)
        : undefined;
    return {
        kind,
        name: str('name') || defaultName,
        componentType: kind,
        connectorType: str('type') || str('connectorType') || str('communication'),
        connection: str('connection'),
        operation: str('operation') || str('actionType'),
        auth: str('auth'),
        communication: str('communication'),
        standard: str('standard'),
        ...(documents ? { documents } : {}),
        filePath,
        dialect: 'file',
    };
}

/**
 * Index of all Boomi components in a project, keyed by name and componentId.
 */
export class BoomiProjectIndex {
    private readonly byName = new Map<string, BoomiComponentRef>();
    private readonly byId = new Map<string, BoomiComponentRef>();

    constructor(
        readonly rootPath: string,
        readonly components: readonly BoomiComponentRef[]
    ) {
        for (const component of components) {
            const key = component.name.toLowerCase();
            if (!this.byName.has(key)) {
                this.byName.set(key, component);
            }
            if (component.componentId) {
                this.byId.set(component.componentId, component);
            }
        }
    }

    /** Find a component by componentId or (case-insensitive) name. */
    find(reference: string | undefined): BoomiComponentRef | undefined {
        if (!reference) {
            return undefined;
        }
        return this.byId.get(reference) || this.byName.get(reference.toLowerCase());
    }

    ofKind(kind: BoomiComponentKind): BoomiComponentRef[] {
        return this.components.filter((c) => c.kind === kind);
    }
}

/**
 * Get (or build) the component index for the project containing a file.
 */
export function getProjectIndex(filePath: string): BoomiProjectIndex {
    const root = resolveProjectRoot(filePath);
    const cached = projectIndexCache.get(root);
    if (cached && Date.now() - cached.builtAt < INDEX_TTL_MS) {
        return cached.index;
    }

    const components: BoomiComponentRef[] = [];
    collectComponents(root, 0, components);
    const index = new BoomiProjectIndex(root, components);
    projectIndexCache.set(root, { builtAt: Date.now(), index });
    return index;
}

function collectComponents(dir: string, depth: number, output: BoomiComponentRef[]): void {
    if (depth > MAX_INDEX_DEPTH) {
        return;
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                collectComponents(fullPath, depth + 1, output);
            }
            continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (!entry.isFile() || (ext !== '.xml' && !BOOMI_COMPANION_EXTENSIONS.has(ext))) {
            continue;
        }
        const ref = readComponentRef(fullPath);
        if (ref && ref.kind !== 'test-asset') {
            output.push(ref);
        }
    }
}

// =============================================================================
// Process & map readers
// =============================================================================

/**
 * Read a Boomi process (native or synthetic) from an XML document.
 */
export function readProcess(doc: Document, filePath: string): BoomiProcess | null {
    const root = doc.documentElement;
    if (!root) {
        return null;
    }
    const defaultName = path.basename(filePath, path.extname(filePath));
    const rootName = localName(root).toLowerCase();

    if (rootName === 'component') {
        const processEl = findDescendant(root, 'process');
        const shapesEl = processEl ? findDescendant(processEl, 'shapes') : undefined;
        const shapes = shapesEl
            ? childElements(shapesEl)
                  .filter((el) => localName(el) === 'shape')
                  .map((el, i) => readNativeShape(el, i))
            : [];
        return {
            name: attr(root, 'name') || defaultName,
            componentId: attr(root, 'componentId'),
            version: attr(root, 'version'),
            folder: attr(root, 'folderFullPath') || attr(root, 'folderName'),
            dialect: 'native',
            shapes,
        };
    }

    if (rootName !== 'syntheticboomiprocess') {
        return null;
    }

    const shapesEl = findDescendant(root, 'shapes') || root;
    const shapeEls = childElements(shapesEl).filter((el) => localName(el) === 'shape');
    const shapes: BoomiShape[] = shapeEls.map((el, i) => {
        const id = attr(el, 'id') || `shape${i + 1}`;
        const reference = attr(el, 'type') || attr(el, 'ref') || '';
        const declaredNext = (attr(el, 'next') || attr(el, 'to') || '')
            .split(/[\s,]+/)
            .filter(Boolean);
        const sequentialNext =
            i + 1 < shapeEls.length ? [attr(shapeEls[i + 1], 'id') || `shape${i + 2}`] : [];
        const shapeType = BOOMI_SHAPE_TYPES.has(reference.toLowerCase())
            ? reference.toLowerCase()
            : 'reference';
        return {
            id,
            shapeType,
            label: attr(el, 'name') || attr(el, 'label') || reference || id,
            reference: reference || undefined,
            next: declaredNext.length > 0 ? declaredNext : sequentialNext,
            configuration: {},
        };
    });

    return {
        name: attr(root, 'name') || defaultName,
        version: attr(root, 'version'),
        dialect: 'synthetic',
        shapes,
    };
}

function readNativeShape(el: Element, index: number): BoomiShape {
    const id = attr(el, 'name') || `shape${index + 1}`;
    const shapeType = (attr(el, 'shapetype') || attr(el, 'image') || 'unknown').toLowerCase();
    const configuration: Record<string, Record<string, string>> = {};
    const configEl = childElements(el).find((c) => localName(c) === 'configuration');
    if (configEl) {
        collectConfiguration(configEl, configuration);
    }
    const dragpointsEl = childElements(el).find((c) => localName(c) === 'dragpoints');
    const next = dragpointsEl
        ? childElements(dragpointsEl)
              .map((dp) => attr(dp, 'toShape'))
              .filter((v): v is string => !!v && v !== 'unset')
        : [];
    return {
        id,
        shapeType,
        label: attr(el, 'userlabel') || attr(el, 'label') || shapeType,
        next,
        configuration,
    };
}

function collectConfiguration(el: Element, output: Record<string, Record<string, string>>): void {
    for (const child of childElements(el)) {
        const key = localName(child);
        if (!output[key]) {
            const attrs: Record<string, string> = {};
            for (const a of Array.from(child.attributes)) {
                attrs[a.name] = a.value;
            }
            output[key] = attrs;
        }
        collectConfiguration(child, output);
    }
}

/**
 * Read a Boomi map (native or synthetic) from an XML document.
 */
export function readMap(doc: Document, filePath: string): BoomiMap | null {
    const root = doc.documentElement;
    if (!root) {
        return null;
    }
    const defaultName = path.basename(filePath, path.extname(filePath));
    const rootName = localName(root).toLowerCase();

    if (rootName === 'syntheticboomimap') {
        const fields = descendants(root, 'field').map((f) => ({
            source: attr(f, 'source') || '',
            target: attr(f, 'target') || '',
        }));
        return {
            name: attr(root, 'name') || defaultName,
            dialect: 'synthetic',
            fields,
            functionCount: descendants(root, 'function').length,
            fromProfile: attr(root, 'fromProfile'),
            toProfile: attr(root, 'toProfile'),
        };
    }

    if (rootName !== 'component') {
        return null;
    }

    const mapEl = findDescendant(root, 'Map');
    const fields = descendants(root, 'Mapping').map((m) => ({
        source: attr(m, 'fromNamePath') || attr(m, 'fromKey') || '',
        target: attr(m, 'toNamePath') || attr(m, 'toKey') || '',
    }));
    return {
        name: attr(root, 'name') || defaultName,
        componentId: attr(root, 'componentId'),
        dialect: 'native',
        fields,
        functionCount: descendants(root, 'FunctionStep').length,
        fromProfile: mapEl ? attr(mapEl, 'fromProfile') : undefined,
        toProfile: mapEl ? attr(mapEl, 'toProfile') : undefined,
    };
}

// =============================================================================
// DOM helpers (namespace-agnostic)
// =============================================================================

export function localName(el: Element): string {
    return el.localName || el.tagName.replace(/^.*:/, '');
}

export function attr(el: Element, name: string): string | undefined {
    const value = el.getAttribute(name);
    return value === null || value === '' ? undefined : value;
}

export function childElements(el: Element): Element[] {
    return Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);
}

export function findDescendant(el: Element, name: string): Element | undefined {
    for (const child of childElements(el)) {
        if (localName(child) === name) {
            return child;
        }
        const nested = findDescendant(child, name);
        if (nested) {
            return nested;
        }
    }
    return undefined;
}

export function descendants(el: Element, name: string): Element[] {
    const result: Element[] = [];
    for (const child of childElements(el)) {
        if (localName(child) === name) {
            result.push(child);
        }
        result.push(...descendants(child, name));
    }
    return result;
}

function safeRead(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
}

/** Determine the dialect of an already-classified XML root element. */
export function dialectOf(root: Element): BoomiDialect {
    return localName(root).toLowerCase() === 'component' ? 'native' : 'synthetic';
}
