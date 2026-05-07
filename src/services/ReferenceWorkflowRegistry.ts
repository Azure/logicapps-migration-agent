/**
 * ReferenceWorkflowRegistry
 *
 * Provides access to real Logic Apps Standard reference workflow.json and
 * connections.json files shipped inside the VSIX under
 * `resources/referenceWorkflowsAndConnections/`.
 *
 * At startup the registry loads a pre-built `catalog.json` (produced by
 * `scripts/build-reference-workflow-catalog.js`) that contains extracted
 * metadata (trigger types, action types, connector IDs, tags, etc.) for
 * every reference file.  Runtime search is performed against this catalog —
 * individual JSON files are only read on-demand when `readFile()` is called.
 *
 * Features:
 *   - Keyword search against tags, folder names, types and connector IDs
 *   - Filter by category (workflow / connection)
 *   - Read individual workflow.json / connections.json on demand
 *
 * @module services/ReferenceWorkflowRegistry
 */

import * as vscode from 'vscode';
import { LoggingService } from './LoggingService';

// ── Catalog Types ─────────────────────────────────────────────────────

/** Shared fields across all catalog entries. */
interface CatalogEntryBase {
    id: string;
    category: 'workflow' | 'connection';
    folder: string;
    path: string;
    tags: string[];
}

/** Catalog entry for a workflow.json file. */
export interface WorkflowCatalogEntry extends CatalogEntryBase {
    category: 'workflow';
    kind: string | null;
    triggerTypes: string[];
    actionTypes: string[];
    serviceProviderIds: string[];
    operationIds: string[];
    apiConnectionRefs: string[];
    hasSplitOn: boolean;
    actionCount: number;
}

/** Catalog entry for a connections.json file. */
export interface ConnectionCatalogEntry extends CatalogEntryBase {
    category: 'connection';
    managedApis: { name: string; apiType: string }[];
    serviceProviders: {
        name: string;
        serviceProviderId: string;
        parameterSetName: string | null;
    }[];
    hasAgentConnections: boolean;
}

export type CatalogEntry = WorkflowCatalogEntry | ConnectionCatalogEntry;

/** Search result returned by `search()`. */
export interface ReferenceWorkflowSearchResult {
    /** Catalog entry */
    entry: CatalogEntry;
    /** Relevance score (higher = more relevant) */
    score: number;
}

// ── Catalog JSON shape ────────────────────────────────────────────────

interface CatalogJson {
    version: number;
    generatedAt: string;
    totalEntries: number;
    entries: CatalogEntry[];
}

// ── Singleton ─────────────────────────────────────────────────────────

let _instance: ReferenceWorkflowRegistry | undefined;

/**
 * Registry for reference workflow and connection files.
 *
 * Call `ReferenceWorkflowRegistry.getInstance(extensionUri)` once at startup
 * (the extensionUri is remembered). Subsequent calls can omit it.
 */
export class ReferenceWorkflowRegistry {
    private readonly root: vscode.Uri;
    private catalog: CatalogEntry[] | undefined;
    private catalogLoadPromise: Promise<void> | undefined;

    private constructor(extensionUri: vscode.Uri) {
        this.root = vscode.Uri.joinPath(
            extensionUri,
            'resources',
            'referenceWorkflowsAndConnections'
        );
    }

    /** Get or create the singleton. Pass `extensionUri` on first call. */
    static getInstance(extensionUri?: vscode.Uri): ReferenceWorkflowRegistry {
        if (!_instance) {
            if (!extensionUri) {
                const ext = vscode.extensions.getExtension('ms-azuretools.logicapps-migration-agent');
                extensionUri = ext?.extensionUri;
            }
            if (!extensionUri) {
                throw new Error(
                    'ReferenceWorkflowRegistry: extensionUri is required on first call'
                );
            }
            _instance = new ReferenceWorkflowRegistry(extensionUri);
        }
        return _instance;
    }

    /** Reset the singleton (for tests). */
    static resetInstance(): void {
        _instance = undefined;
    }

    // ── Public API ────────────────────────────────────────────────────

    /**
     * Load the catalog from disk (lazy — first call reads, subsequent return cached).
     */
    async ensureCatalog(): Promise<CatalogEntry[]> {
        if (this.catalog) {
            return this.catalog;
        }
        if (!this.catalogLoadPromise) {
            this.catalogLoadPromise = this.loadCatalog();
        }
        await this.catalogLoadPromise;
        return this.catalog ?? [];
    }

    /**
     * List catalog entries, optionally filtered by category.
     */
    async list(category?: 'workflow' | 'connection'): Promise<CatalogEntry[]> {
        const catalog = await this.ensureCatalog();
        if (!category) {
            return catalog;
        }
        return catalog.filter((e) => e.category === category);
    }

    /**
     * Search catalog entries by keyword query.
     *
     * Matches against: tags, folder name, trigger types, action types,
     * service provider IDs, operation IDs, API connection refs, file names.
     *
     * Returns results sorted by relevance score (descending).
     */
    async search(
        query: string,
        category?: 'workflow' | 'connection'
    ): Promise<ReferenceWorkflowSearchResult[]> {
        const catalog = await this.ensureCatalog();
        const queryTerms = this.tokenize(query);
        if (queryTerms.length === 0) {
            return [];
        }

        const results: ReferenceWorkflowSearchResult[] = [];

        for (const entry of catalog) {
            if (category && entry.category !== category) {
                continue;
            }
            const score = this.scoreEntry(entry, queryTerms);
            if (score > 0) {
                results.push({ entry, score });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results;
    }

    /**
     * Read the raw JSON content of a reference file by its catalog path.
     *
     * For workflow/connection entries, reads the file at `entry.path`.
     */
    async readFile(
        entryId: string,
        _fileName?: string
    ): Promise<{ id: string; path: string; content: string } | undefined> {
        const catalog = await this.ensureCatalog();
        const entry = catalog.find((e) => e.id === entryId);
        if (!entry) {
            return undefined;
        }

        const filePath = entry.path;

        const fileUri = vscode.Uri.joinPath(this.root, filePath);
        try {
            const bytes = await vscode.workspace.fs.readFile(fileUri);
            const content = Buffer.from(bytes).toString('utf-8');
            return { id: entry.id, path: filePath, content };
        } catch {
            return undefined;
        }
    }

    /**
     * Find suggestions when an exact ID lookup fails.
     */
    async findSuggestions(partialId: string, limit = 5): Promise<CatalogEntry[]> {
        const catalog = await this.ensureCatalog();
        const lower = partialId.toLowerCase();
        return catalog
            .filter(
                (e) => e.id.toLowerCase().includes(lower) || e.folder.toLowerCase().includes(lower)
            )
            .slice(0, limit);
    }

    // ── Private ───────────────────────────────────────────────────────

    private async loadCatalog(): Promise<void> {
        const logger = LoggingService.getInstance();
        const startTime = Date.now();

        const catalogUri = vscode.Uri.joinPath(this.root, 'catalog.json');
        try {
            const bytes = await vscode.workspace.fs.readFile(catalogUri);
            const json: CatalogJson = JSON.parse(Buffer.from(bytes).toString('utf-8'));
            this.catalog = json.entries;
            const elapsed = Date.now() - startTime;
            logger.info(
                `[RefWorkflowRegistry] Loaded catalog in ${elapsed}ms: ${json.totalEntries} entries`
            );
        } catch (err) {
            logger.error(
                '[RefWorkflowRegistry] Failed to load catalog.json',
                err instanceof Error ? err : new Error(String(err))
            );
            this.catalog = [];
        }
    }

    /**
     * Score an entry against a set of query terms.
     * Higher score = more relevant.
     */
    private scoreEntry(entry: CatalogEntry, queryTerms: string[]): number {
        let score = 0;

        // Build a searchable text bag from the entry
        const textBag = this.buildTextBag(entry);

        for (const term of queryTerms) {
            // Exact tag match (highest weight)
            if (entry.tags.some((t) => t === term)) {
                score += 10;
            }
            // Tag prefix match
            else if (entry.tags.some((t) => t.startsWith(term) || term.startsWith(t))) {
                score += 5;
            }

            // Folder name match
            if (entry.folder.toLowerCase().includes(term)) {
                score += 8;
            }

            // ID match
            if (entry.id.toLowerCase().includes(term)) {
                score += 6;
            }

            // Text bag match (types, SP IDs, operation IDs, etc.)
            const bagMatches = textBag.filter((t) => t.includes(term) || term.includes(t)).length;
            score += bagMatches * 3;
        }

        // Bonus for multi-term coverage
        if (queryTerms.length > 1) {
            const termsMatched = queryTerms.filter((term) => {
                return (
                    entry.tags.some((t) => t.includes(term) || term.includes(t)) ||
                    entry.folder.toLowerCase().includes(term) ||
                    entry.id.toLowerCase().includes(term) ||
                    textBag.some((t) => t.includes(term) || term.includes(t))
                );
            }).length;
            const coverage = termsMatched / queryTerms.length;
            score *= 1 + coverage; // 1x-2x multiplier
        }

        return score;
    }

    /**
     * Build a flat array of searchable strings from a catalog entry.
     */
    private buildTextBag(entry: CatalogEntry): string[] {
        const bag: string[] = [];

        if (entry.category === 'workflow') {
            const w = entry as WorkflowCatalogEntry;
            bag.push(...w.triggerTypes.map((t) => t.toLowerCase()));
            bag.push(...w.actionTypes.map((t) => t.toLowerCase()));
            bag.push(
                ...w.serviceProviderIds.map((id) => {
                    const name = id.split('/').pop() || id;
                    return name.toLowerCase();
                })
            );
            bag.push(...w.operationIds.map((id) => id.toLowerCase()));
            bag.push(...w.apiConnectionRefs.map((r) => r.toLowerCase()));
            if (w.kind) {
                bag.push(w.kind.toLowerCase());
            }
        } else if (entry.category === 'connection') {
            const c = entry as ConnectionCatalogEntry;
            for (const api of c.managedApis) {
                bag.push(api.apiType.toLowerCase());
                bag.push(api.name.toLowerCase());
            }
            for (const sp of c.serviceProviders) {
                const name = sp.serviceProviderId.split('/').pop() || sp.serviceProviderId;
                bag.push(name.toLowerCase());
                bag.push(sp.name.toLowerCase());
            }
        }

        return bag;
    }

    /**
     * Tokenize a query string into lowercase terms.
     */
    private tokenize(text: string): string[] {
        return (
            text
                .toLowerCase()
                .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g)
                ?.filter((t) => t.length >= 2) || []
        );
    }
}
