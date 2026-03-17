/**
 * IR Storage and Caching
 *
 * Provides persistent storage and in-memory caching for IR documents.
 * Integrates with VS Code workspace storage and file system.
 *
 * @module ir/storage
 */

import * as vscode from 'vscode';
import { IRDocument } from '../types';
import { IRSerializer } from '../serialization';
import { IRValidator } from '../validation';

// =============================================================================
// Storage Types
// =============================================================================

/**
 * Metadata stored alongside each IR document.
 */
export interface IRStorageMetadata {
    /** Unique identifier for the stored document */
    readonly id: string;

    /** Original source file path */
    readonly sourcePath: string;

    /** When the document was first stored */
    readonly createdAt: string;

    /** When the document was last updated */
    readonly updatedAt: string;

    /** Version number for change tracking */
    readonly version: number;

    /** Size in bytes */
    readonly sizeBytes: number;

    /** Whether the document has been validated */
    readonly validated: boolean;

    /** Hash of the content for integrity checks */
    readonly contentHash: string;
}

/**
 * Result of a storage operation.
 */
export interface StorageResult<T = void> {
    /** Whether the operation succeeded */
    readonly success: boolean;

    /** Error message if failed */
    readonly error?: string;

    /** Data returned (if applicable) */
    readonly data?: T;
}

/**
 * Options for storage operations.
 */
export interface StorageOptions {
    /**
     * Whether to validate before storing.
     * @default true
     */
    readonly validateBeforeStore?: boolean;

    /**
     * Whether to update cache after storage operations.
     * @default true
     */
    readonly updateCache?: boolean;

    /**
     * Custom storage folder path.
     * @default '.vscode/migration-cache'
     */
    readonly storagePath?: string;
}

/**
 * Options for cache operations.
 */
export interface CacheOptions {
    /**
     * Maximum number of documents to cache.
     * @default 50
     */
    readonly maxSize?: number;

    /**
     * Time-to-live in milliseconds.
     * @default 300000 (5 minutes)
     */
    readonly ttlMs?: number;
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_STORAGE_OPTIONS: Required<StorageOptions> = {
    validateBeforeStore: true,
    updateCache: true,
    storagePath: '.vscode/migration-cache',
};

const DEFAULT_CACHE_OPTIONS: Required<CacheOptions> = {
    maxSize: 50,
    ttlMs: 5 * 60 * 1000, // 5 minutes
};

// =============================================================================
// LRU Cache Implementation
// =============================================================================

/**
 * Cache entry with metadata.
 */
interface CacheEntry<T> {
    value: T;
    createdAt: number;
    accessedAt: number;
    accessCount: number;
}

/**
 * LRU (Least Recently Used) cache for IR documents.
 *
 * @example
 * ```typescript
 * const cache = new IRCache({ maxSize: 100, ttlMs: 60000 });
 *
 * cache.set('doc1', document);
 * const doc = cache.get('doc1');
 *
 * cache.invalidate('doc1');
 * cache.clear();
 * ```
 */
export class IRCache {
    private cache = new Map<string, CacheEntry<IRDocument>>();
    private readonly options: Required<CacheOptions>;

    constructor(options: CacheOptions = {}) {
        this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
    }

    /**
     * Gets a document from the cache.
     *
     * @param id - Document ID
     * @returns The cached document or undefined
     */
    public get(id: string): IRDocument | undefined {
        const entry = this.cache.get(id);
        if (!entry) {
            return undefined;
        }

        // Check TTL
        const now = Date.now();
        if (now - entry.createdAt > this.options.ttlMs) {
            this.cache.delete(id);
            return undefined;
        }

        // Update access metadata
        entry.accessedAt = now;
        entry.accessCount++;

        return entry.value;
    }

    /**
     * Stores a document in the cache.
     *
     * @param id - Document ID
     * @param document - The document to cache
     */
    public set(id: string, document: IRDocument): void {
        // Evict if at capacity
        if (this.cache.size >= this.options.maxSize && !this.cache.has(id)) {
            this.evictLRU();
        }

        const now = Date.now();
        this.cache.set(id, {
            value: document,
            createdAt: now,
            accessedAt: now,
            accessCount: 1,
        });
    }

    /**
     * Checks if a document is cached.
     *
     * @param id - Document ID
     * @returns Whether the document is cached (and not expired)
     */
    public has(id: string): boolean {
        return this.get(id) !== undefined;
    }

    /**
     * Invalidates (removes) a cached document.
     *
     * @param id - Document ID
     * @returns Whether the document was removed
     */
    public invalidate(id: string): boolean {
        return this.cache.delete(id);
    }

    /**
     * Invalidates documents matching a pattern.
     *
     * @param pattern - Regex pattern to match IDs
     * @returns Number of entries invalidated
     */
    public invalidatePattern(pattern: RegExp): number {
        let count = 0;
        for (const id of this.cache.keys()) {
            if (pattern.test(id)) {
                this.cache.delete(id);
                count++;
            }
        }
        return count;
    }

    /**
     * Clears all cached documents.
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * Gets cache statistics.
     *
     * @returns Cache statistics
     */
    public getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        oldestEntry: number | null;
    } {
        let totalAccess = 0;
        let oldestTime: number | null = null;

        for (const entry of this.cache.values()) {
            totalAccess += entry.accessCount;
            if (oldestTime === null || entry.createdAt < oldestTime) {
                oldestTime = entry.createdAt;
            }
        }

        return {
            size: this.cache.size,
            maxSize: this.options.maxSize,
            hitRate: this.cache.size > 0 ? totalAccess / this.cache.size : 0,
            oldestEntry: oldestTime,
        };
    }

    /**
     * Evicts expired entries.
     *
     * @returns Number of entries evicted
     */
    public evictExpired(): number {
        const now = Date.now();
        let count = 0;

        for (const [id, entry] of this.cache) {
            if (now - entry.createdAt > this.options.ttlMs) {
                this.cache.delete(id);
                count++;
            }
        }

        return count;
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    private evictLRU(): void {
        let lruId: string | null = null;
        let lruTime = Infinity;

        for (const [id, entry] of this.cache) {
            if (entry.accessedAt < lruTime) {
                lruTime = entry.accessedAt;
                lruId = id;
            }
        }

        if (lruId) {
            this.cache.delete(lruId);
        }
    }
}

// =============================================================================
// IR Storage Class
// =============================================================================

/**
 * Persistent storage for IR documents.
 *
 * Stores documents in the workspace's `.vscode/migration-cache` folder
 * with metadata for indexing and retrieval.
 *
 * @example
 * ```typescript
 * const storage = new IRStorage(context);
 *
 * await storage.store(document);
 * const doc = await storage.load('workflow-id');
 * const all = await storage.list();
 *
 * await storage.delete('workflow-id');
 * ```
 */
export class IRStorage implements vscode.Disposable {
    private readonly options: Required<StorageOptions>;
    private readonly cache: IRCache;
    private readonly validator: IRValidator;
    private readonly serializer: IRSerializer;
    private readonly index = new Map<string, IRStorageMetadata>();
    private readonly disposables: vscode.Disposable[] = [];
    private fileWatcher?: vscode.FileSystemWatcher;

    constructor(
        _context: vscode.ExtensionContext,
        options: StorageOptions = {},
        cacheOptions: CacheOptions = {}
    ) {
        this.options = { ...DEFAULT_STORAGE_OPTIONS, ...options };
        this.cache = new IRCache(cacheOptions);
        this.validator = new IRValidator();
        this.serializer = new IRSerializer();

        // Initialize storage and index
        this.initialize();
    }

    /**
     * Initializes storage and sets up file watching.
     */
    private async initialize(): Promise<void> {
        // Create storage directory if needed
        await this.ensureStorageDirectory();

        // Load existing index
        await this.loadIndex();

        // Set up file watcher for cache invalidation
        this.setupFileWatcher();
    }

    /**
     * Stores an IR document.
     *
     * @param document - The document to store
     * @returns Storage result
     */
    public async store(document: IRDocument): Promise<StorageResult<IRStorageMetadata>> {
        try {
            // Validate if required
            if (this.options.validateBeforeStore) {
                const validation = this.validator.validate(document);
                if (!validation.valid) {
                    const firstError = validation.issues.find(i => i.severity === 'error');
                    return {
                        success: false,
                        error: `Validation failed: ${firstError?.message ?? 'Unknown error'}`,
                    };
                }
            }

            const id = document.metadata.id;
            const filePath = this.getFilePath(id);

            // Serialize
            const serializationResult = this.serializer.serialize(document, { pretty: true });
            const content = typeof serializationResult === 'string'
                ? serializationResult
                : serializationResult.json;

            // Write to file
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));

            // Create metadata
            const now = new Date().toISOString();
            const existing = this.index.get(id);
            const metadata: IRStorageMetadata = {
                id,
                sourcePath: document.metadata.source.artifact.filePath,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
                version: (existing?.version ?? 0) + 1,
                sizeBytes: content.length,
                validated: this.options.validateBeforeStore,
                contentHash: this.computeHash(content),
            };

            // Update index
            this.index.set(id, metadata);
            await this.saveIndex();

            // Update cache
            if (this.options.updateCache) {
                this.cache.set(id, document);
            }

            return { success: true, data: metadata };
        } catch (err) {
            return {
                success: false,
                error: `Failed to store document: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    /**
     * Loads an IR document by ID.
     *
     * @param id - Document ID (workflowId)
     * @returns Storage result with document
     */
    public async load(id: string): Promise<StorageResult<IRDocument>> {
        try {
            // Check cache first
            const cached = this.cache.get(id);
            if (cached) {
                return { success: true, data: cached };
            }

            // Check if exists in index
            if (!this.index.has(id)) {
                return { success: false, error: `Document not found: ${id}` };
            }

            const filePath = this.getFilePath(id);
            const uri = vscode.Uri.file(filePath);

            // Read file
            const content = await vscode.workspace.fs.readFile(uri);
            const json = Buffer.from(content).toString('utf-8');

            // Deserialize
            const deserializationResult = this.serializer.deserialize(json);
            const document = deserializationResult.document;

            // Update cache
            if (this.options.updateCache) {
                this.cache.set(id, document);
            }

            return { success: true, data: document };
        } catch (err) {
            return {
                success: false,
                error: `Failed to load document: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    /**
     * Deletes an IR document.
     *
     * @param id - Document ID
     * @returns Storage result
     */
    public async delete(id: string): Promise<StorageResult> {
        try {
            // Check if exists
            if (!this.index.has(id)) {
                return { success: false, error: `Document not found: ${id}` };
            }

            const filePath = this.getFilePath(id);
            const uri = vscode.Uri.file(filePath);

            // Delete file
            await vscode.workspace.fs.delete(uri);

            // Update index
            this.index.delete(id);
            await this.saveIndex();

            // Invalidate cache
            this.cache.invalidate(id);

            return { success: true };
        } catch (err) {
            return {
                success: false,
                error: `Failed to delete document: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    /**
     * Lists all stored documents.
     *
     * @returns Array of storage metadata
     */
    public list(): IRStorageMetadata[] {
        return Array.from(this.index.values());
    }

    /**
     * Checks if a document exists.
     *
     * @param id - Document ID
     * @returns Whether the document exists
     */
    public exists(id: string): boolean {
        return this.index.has(id);
    }

    /**
     * Gets metadata for a document.
     *
     * @param id - Document ID
     * @returns Metadata or undefined
     */
    public getMetadata(id: string): IRStorageMetadata | undefined {
        return this.index.get(id);
    }

    /**
     * Searches for documents by criteria.
     *
     * @param criteria - Search criteria
     * @returns Matching metadata entries
     */
    public search(criteria: {
        sourcePath?: string | RegExp;
        validatedOnly?: boolean;
        modifiedAfter?: Date;
        modifiedBefore?: Date;
    }): IRStorageMetadata[] {
        return Array.from(this.index.values()).filter(meta => {
            if (criteria.sourcePath) {
                const pattern = typeof criteria.sourcePath === 'string'
                    ? new RegExp(criteria.sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    : criteria.sourcePath;
                if (!pattern.test(meta.sourcePath)) {
                    return false;
                }
            }

            if (criteria.validatedOnly && !meta.validated) {
                return false;
            }

            if (criteria.modifiedAfter && new Date(meta.updatedAt) < criteria.modifiedAfter) {
                return false;
            }

            if (criteria.modifiedBefore && new Date(meta.updatedAt) > criteria.modifiedBefore) {
                return false;
            }

            return true;
        });
    }

    /**
     * Gets storage statistics.
     *
     * @returns Storage statistics
     */
    public getStats(): {
        documentCount: number;
        totalSizeBytes: number;
        cacheStats: ReturnType<IRCache['getStats']>;
    } {
        let totalSize = 0;
        for (const meta of this.index.values()) {
            totalSize += meta.sizeBytes;
        }

        return {
            documentCount: this.index.size,
            totalSizeBytes: totalSize,
            cacheStats: this.cache.getStats(),
        };
    }

    /**
     * Clears all stored documents.
     *
     * @returns Storage result
     */
    public async clearAll(): Promise<StorageResult> {
        try {
            const storageDir = this.getStorageDirectory();
            const uri = vscode.Uri.file(storageDir);

            // Delete all files in storage directory
            await vscode.workspace.fs.delete(uri, { recursive: true });

            // Recreate empty directory
            await this.ensureStorageDirectory();

            // Clear index and cache
            this.index.clear();
            this.cache.clear();

            return { success: true };
        } catch (err) {
            return {
                success: false,
                error: `Failed to clear storage: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    /**
     * Disposes resources.
     */
    public dispose(): void {
        this.fileWatcher?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.cache.clear();
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    private getStorageDirectory(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        return vscode.Uri.joinPath(workspaceFolder.uri, this.options.storagePath).fsPath;
    }

    private getFilePath(id: string): string {
        const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
        return vscode.Uri.joinPath(
            vscode.Uri.file(this.getStorageDirectory()),
            `${safeId}.ir.json`
        ).fsPath;
    }

    private getIndexPath(): string {
        return vscode.Uri.joinPath(
            vscode.Uri.file(this.getStorageDirectory()),
            '_index.json'
        ).fsPath;
    }

    private async ensureStorageDirectory(): Promise<void> {
        const dir = this.getStorageDirectory();
        const uri = vscode.Uri.file(dir);

        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            await vscode.workspace.fs.createDirectory(uri);
        }
    }

    private async loadIndex(): Promise<void> {
        const indexPath = this.getIndexPath();
        const uri = vscode.Uri.file(indexPath);

        try {
            const content = await vscode.workspace.fs.readFile(uri);
            const data = JSON.parse(Buffer.from(content).toString('utf-8')) as IRStorageMetadata[];

            this.index.clear();
            for (const meta of data) {
                this.index.set(meta.id, meta);
            }
        } catch {
            // Index doesn't exist yet, that's fine
            this.index.clear();
        }
    }

    private async saveIndex(): Promise<void> {
        const indexPath = this.getIndexPath();
        const uri = vscode.Uri.file(indexPath);
        const data = Array.from(this.index.values());
        const content = JSON.stringify(data, null, 2);

        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    }

    private setupFileWatcher(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return;}

        // Watch for external changes to IR files
        const pattern = new vscode.RelativePattern(
            workspaceFolder,
            `${this.options.storagePath}/*.ir.json`
        );

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidChange(uri => {
            // Invalidate cache when file changes externally
            const filename = uri.fsPath.split(/[/\\]/).pop() ?? '';
            const id = filename.replace('.ir.json', '');
            this.cache.invalidate(id);
        });

        this.fileWatcher.onDidDelete(uri => {
            const filename = uri.fsPath.split(/[/\\]/).pop() ?? '';
            const id = filename.replace('.ir.json', '');
            this.cache.invalidate(id);
            this.index.delete(id);
        });

        this.disposables.push(this.fileWatcher);
    }

    private computeHash(content: string): string {
        // Simple hash for content integrity (not cryptographic)
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
}

// =============================================================================
// Convenience Functions
// =============================================================================

let defaultStorage: IRStorage | undefined;

/**
 * Gets or creates the default storage instance.
 *
 * @param context - Extension context (required on first call)
 * @returns The default storage instance
 */
export function getDefaultStorage(context?: vscode.ExtensionContext): IRStorage {
    if (!defaultStorage) {
        if (!context) {
            throw new Error('Extension context required to initialize storage');
        }
        defaultStorage = new IRStorage(context);
    }
    return defaultStorage;
}

/**
 * Disposes the default storage instance.
 */
export function disposeDefaultStorage(): void {
    if (defaultStorage) {
        defaultStorage.dispose();
        defaultStorage = undefined;
    }
}
