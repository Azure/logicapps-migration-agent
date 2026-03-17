/**
 * IR Diff and Merge Utilities
 *
 * Provides functionality to compare and merge IR documents.
 * Useful for tracking changes, collaborative editing, and incremental updates.
 *
 * @module ir/diff
 */

import { IRDocument } from '../types';

// =============================================================================
// Change Types
// =============================================================================

/**
 * Types of changes that can occur.
 */
export type ChangeType = 'added' | 'removed' | 'modified';

/**
 * Change operation types (RFC 6902 compatible).
 */
export type ChangeOperation = 'add' | 'remove' | 'replace' | 'move' | 'copy';

/**
 * A single change in a diff.
 */
export interface IRChange {
    /** Change operation */
    readonly operation: ChangeOperation;

    /** JSON path to the changed element */
    readonly path: string;

    /** Previous value (for remove/replace) */
    readonly oldValue?: unknown;

    /** New value (for add/replace) */
    readonly newValue?: unknown;

    /** Element type for context */
    readonly elementType?: 'trigger' | 'action' | 'connection' | 'schema' | 'map' | 'gap' | 'metadata' | 'other';

    /** Human-readable description */
    readonly description?: string;
}

/**
 * Result of comparing two IR documents.
 */
export interface IRDiffResult {
    /** Whether the documents are identical */
    readonly identical: boolean;

    /** All changes found */
    readonly changes: readonly IRChange[];

    /** Number of additions */
    readonly additions: number;

    /** Number of removals */
    readonly removals: number;

    /** Number of modifications */
    readonly modifications: number;

    /** Diff duration in milliseconds */
    readonly durationMs: number;
}

/**
 * Options for diff operation.
 */
export interface DiffOptions {
    /**
     * Whether to include metadata changes.
     * @default true
     */
    readonly includeMetadata?: boolean;

    /**
     * Whether to do deep comparison of objects.
     * @default true
     */
    readonly deep?: boolean;

    /**
     * Paths to ignore in comparison.
     */
    readonly ignorePaths?: readonly string[];

    /**
     * Maximum changes to track.
     * @default 1000
     */
    readonly maxChanges?: number;
}

// =============================================================================
// Merge Types
// =============================================================================

/**
 * Conflict in a merge operation.
 */
export interface MergeConflict {
    /** JSON path to conflicting element */
    readonly path: string;

    /** Value from base document */
    readonly baseValue: unknown;

    /** Value from "ours" document */
    readonly oursValue: unknown;

    /** Value from "theirs" document */
    readonly theirsValue: unknown;

    /** Resolved value (if auto-resolved) */
    resolvedValue?: unknown;

    /** Resolution strategy used */
    resolution?: 'ours' | 'theirs' | 'base' | 'merged' | 'manual';
}

/**
 * Result of a merge operation.
 */
export interface IRMergeResult {
    /** Merged document */
    readonly document: IRDocument;

    /** Whether merge completed without conflicts */
    readonly success: boolean;

    /** Conflicts found (empty if success=true) */
    readonly conflicts: readonly MergeConflict[];

    /** Changes applied */
    readonly changesApplied: number;

    /** Merge duration in milliseconds */
    readonly durationMs: number;
}

/**
 * Strategy for resolving conflicts.
 */
export type ConflictResolution = 'ours' | 'theirs' | 'base';

/**
 * Options for merge operation.
 */
export interface MergeOptions {
    /**
     * Default conflict resolution strategy.
     * @default 'ours'
     */
    readonly defaultResolution?: ConflictResolution;

    /**
     * Custom conflict resolver function.
     */
    readonly conflictResolver?: (conflict: MergeConflict) => unknown;

    /**
     * Whether to merge arrays by ID.
     * @default true
     */
    readonly mergeArraysById?: boolean;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_DIFF_OPTIONS: Required<DiffOptions> = {
    includeMetadata: true,
    deep: true,
    ignorePaths: [],
    maxChanges: 1000,
};

const DEFAULT_MERGE_OPTIONS: Required<MergeOptions> = {
    defaultResolution: 'ours',
    conflictResolver: () => undefined,
    mergeArraysById: true,
};

// =============================================================================
// IRDiff Class
// =============================================================================

/**
 * Utility for computing differences between IR documents.
 *
 * @example
 * ```typescript
 * const diff = new IRDiff();
 *
 * const result = diff.compare(oldDocument, newDocument);
 *
 * console.log(`Changes: ${result.changes.length}`);
 * console.log(`Added: ${result.additions}`);
 * console.log(`Removed: ${result.removals}`);
 * ```
 */
export class IRDiff {
    private changes: IRChange[] = [];
    private options: Required<DiffOptions> = DEFAULT_DIFF_OPTIONS;

    /**
     * Compares two IR documents and returns the differences.
     *
     * @param oldDoc - The original document
     * @param newDoc - The modified document
     * @param options - Diff options
     * @returns Diff result
     */
    public compare(
        oldDoc: IRDocument,
        newDoc: IRDocument,
        options: DiffOptions = {}
    ): IRDiffResult {
        const startTime = performance.now();
        this.changes = [];
        this.options = { ...DEFAULT_DIFF_OPTIONS, ...options };

        // Compare metadata
        if (this.options.includeMetadata) {
            this.compareObjects(oldDoc.metadata, newDoc.metadata, '$.metadata', 'metadata');
        }

        // Compare workflow config
        this.compareObjects(oldDoc.workflow, newDoc.workflow, '$.workflow', 'other');

        // Compare arrays
        this.compareArraysById(oldDoc.triggers, newDoc.triggers, '$.triggers', 'trigger');
        this.compareArraysById(oldDoc.actions, newDoc.actions, '$.actions', 'action');
        this.compareArraysById(oldDoc.connections, newDoc.connections, '$.connections', 'connection');
        this.compareArraysById(oldDoc.schemas, newDoc.schemas, '$.schemas', 'schema');
        this.compareArraysById(oldDoc.maps, newDoc.maps, '$.maps', 'map');
        this.compareArraysById(oldDoc.gaps, newDoc.gaps, '$.gaps', 'gap');

        // Compare optional sections
        if (oldDoc.variables || newDoc.variables) {
            this.compareArraysById(oldDoc.variables ?? [], newDoc.variables ?? [], '$.variables', 'other');
        }

        const changes = this.changes.slice(0, this.options.maxChanges);
        const additions = changes.filter(c => c.operation === 'add').length;
        const removals = changes.filter(c => c.operation === 'remove').length;
        const modifications = changes.filter(c => c.operation === 'replace').length;

        return {
            identical: changes.length === 0,
            changes,
            additions,
            removals,
            modifications,
            durationMs: performance.now() - startTime,
        };
    }

    /**
     * Creates a human-readable summary of changes.
     *
     * @param result - Diff result
     * @returns Summary string
     */
    public summarize(result: IRDiffResult): string {
        if (result.identical) {
            return 'Documents are identical.';
        }

        const lines = [
            `Found ${result.changes.length} change(s):`,
            `  - ${result.additions} addition(s)`,
            `  - ${result.removals} removal(s)`,
            `  - ${result.modifications} modification(s)`,
            '',
            'Changes:',
        ];

        for (const change of result.changes.slice(0, 20)) {
            const desc = change.description || `${change.operation} at ${change.path}`;
            lines.push(`  ${change.operation.toUpperCase()}: ${desc}`);
        }

        if (result.changes.length > 20) {
            lines.push(`  ... and ${result.changes.length - 20} more`);
        }

        return lines.join('\n');
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    private compareObjects(
        oldObj: unknown,
        newObj: unknown,
        path: string,
        elementType: IRChange['elementType']
    ): void {
        if (this.shouldIgnore(path)) {return;}
        if (this.changes.length >= this.options.maxChanges) {return;}

        if (oldObj === newObj) {return;}

        if (oldObj === undefined && newObj !== undefined) {
            this.addChange('add', path, undefined, newObj, elementType);
            return;
        }

        if (oldObj !== undefined && newObj === undefined) {
            this.addChange('remove', path, oldObj, undefined, elementType);
            return;
        }

        if (typeof oldObj !== typeof newObj) {
            this.addChange('replace', path, oldObj, newObj, elementType);
            return;
        }

        if (typeof oldObj !== 'object' || oldObj === null) {
            if (oldObj !== newObj) {
                this.addChange('replace', path, oldObj, newObj, elementType);
            }
            return;
        }

        if (!this.options.deep) {
            if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
                this.addChange('replace', path, oldObj, newObj, elementType);
            }
            return;
        }

        // Deep object comparison
        const oldRec = oldObj as Record<string, unknown>;
        const newRec = newObj as Record<string, unknown>;
        const allKeys = new Set([...Object.keys(oldRec), ...Object.keys(newRec)]);

        for (const key of allKeys) {
            this.compareObjects(oldRec[key], newRec[key], `${path}.${key}`, elementType);
        }
    }

    private compareArraysById<T extends { id: string }>(
        oldArr: readonly T[],
        newArr: readonly T[],
        path: string,
        elementType: IRChange['elementType']
    ): void {
        if (this.shouldIgnore(path)) {return;}

        const oldMap = new Map(oldArr.map(item => [item.id, item]));
        const newMap = new Map(newArr.map(item => [item.id, item]));

        // Find removals
        for (const [id, oldItem] of oldMap) {
            if (!newMap.has(id)) {
                this.addChange('remove', `${path}[id=${id}]`, oldItem, undefined, elementType, `Removed ${elementType}: ${id}`);
            }
        }

        // Find additions and modifications
        for (const [id, newItem] of newMap) {
            const oldItem = oldMap.get(id);
            if (!oldItem) {
                this.addChange('add', `${path}[id=${id}]`, undefined, newItem, elementType, `Added ${elementType}: ${id}`);
            } else {
                // Compare items
                const itemPath = `${path}[id=${id}]`;
                this.compareObjects(oldItem, newItem, itemPath, elementType);
            }
        }
    }

    private shouldIgnore(path: string): boolean {
        return this.options.ignorePaths.some(
            ignorePath => path.startsWith(ignorePath) || path === ignorePath
        );
    }

    private addChange(
        operation: ChangeOperation,
        path: string,
        oldValue: unknown,
        newValue: unknown,
        elementType: IRChange['elementType'],
        description?: string
    ): void {
        if (this.changes.length >= this.options.maxChanges) {return;}

        this.changes.push({
            operation,
            path,
            oldValue,
            newValue,
            elementType,
            description,
        });
    }
}

// =============================================================================
// IRMerge Class
// =============================================================================

/**
 * Utility for merging IR documents.
 *
 * Supports three-way merge (base, ours, theirs) with conflict detection.
 *
 * @example
 * ```typescript
 * const merge = new IRMerge();
 *
 * // Two-way merge
 * const result = merge.twoWay(original, modified);
 *
 * // Three-way merge
 * const result = merge.threeWay(base, ours, theirs);
 * ```
 */
export class IRMerge {
    private conflicts: MergeConflict[] = [];
    private options: Required<MergeOptions> = DEFAULT_MERGE_OPTIONS;

    /**
     * Performs a two-way merge (applies changes from modified to original).
     *
     * @param original - The original document
     * @param modified - The modified document with changes to apply
     * @param options - Merge options
     * @returns Merge result
     */
    public twoWay(
        original: IRDocument,
        modified: IRDocument,
        options: MergeOptions = {}
    ): IRMergeResult {
        const startTime = performance.now();
        this.options = { ...DEFAULT_MERGE_OPTIONS, ...options };

        // Clone original to avoid mutation
        const result = JSON.parse(JSON.stringify(original)) as IRDocument;

        // Get diff
        const diff = new IRDiff();
        const diffResult = diff.compare(original, modified);

        // Apply changes
        let changesApplied = 0;
        for (const change of diffResult.changes) {
            if (this.applyChange(result, change)) {
                changesApplied++;
            }
        }

        return {
            document: result,
            success: true,
            conflicts: [],
            changesApplied,
            durationMs: performance.now() - startTime,
        };
    }

    /**
     * Performs a three-way merge.
     *
     * @param base - The common ancestor document
     * @param ours - Our modified version
     * @param theirs - Their modified version
     * @param options - Merge options
     * @returns Merge result
     */
    public threeWay(
        base: IRDocument,
        ours: IRDocument,
        theirs: IRDocument,
        options: MergeOptions = {}
    ): IRMergeResult {
        const startTime = performance.now();
        this.conflicts = [];
        this.options = { ...DEFAULT_MERGE_OPTIONS, ...options };

        // Clone base to start
        const result = JSON.parse(JSON.stringify(base)) as IRDocument;

        // Get diffs
        const diff = new IRDiff();
        const ourChanges = diff.compare(base, ours);
        const theirChanges = diff.compare(base, theirs);

        // Build change maps by path
        const ourChangeMap = new Map(ourChanges.changes.map(c => [c.path, c]));
        const theirChangeMap = new Map(theirChanges.changes.map(c => [c.path, c]));

        // Find all affected paths
        const allPaths = new Set([
            ...ourChanges.changes.map(c => c.path),
            ...theirChanges.changes.map(c => c.path),
        ]);

        let changesApplied = 0;

        for (const path of allPaths) {
            const ourChange = ourChangeMap.get(path);
            const theirChange = theirChangeMap.get(path);

            if (ourChange && !theirChange) {
                // Only we changed it
                if (this.applyChange(result, ourChange)) {
                    changesApplied++;
                }
            } else if (!ourChange && theirChange) {
                // Only they changed it
                if (this.applyChange(result, theirChange)) {
                    changesApplied++;
                }
            } else if (ourChange && theirChange) {
                // Both changed it - potential conflict
                if (JSON.stringify(ourChange.newValue) === JSON.stringify(theirChange.newValue)) {
                    // Same change - no conflict
                    if (this.applyChange(result, ourChange)) {
                        changesApplied++;
                    }
                } else {
                    // Conflict!
                    const conflict: MergeConflict = {
                        path,
                        baseValue: ourChange.oldValue,
                        oursValue: ourChange.newValue,
                        theirsValue: theirChange.newValue,
                    };

                    // Try to resolve
                    const resolved = this.resolveConflict(conflict);
                    if (resolved !== undefined) {
                        conflict.resolvedValue = resolved;
                        conflict.resolution = this.options.defaultResolution;
                        this.applyChange(result, {
                            ...ourChange,
                            newValue: resolved,
                        });
                        changesApplied++;
                    }

                    this.conflicts.push(conflict);
                }
            }
        }

        return {
            document: result,
            success: this.conflicts.filter(c => c.resolvedValue === undefined).length === 0,
            conflicts: [...this.conflicts],
            changesApplied,
            durationMs: performance.now() - startTime,
        };
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    private applyChange(doc: IRDocument, change: IRChange): boolean {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mutableDoc = doc as any;

            // Parse path (simple implementation)
            const pathParts = this.parsePath(change.path);

            if (change.operation === 'add' || change.operation === 'replace') {
                this.setValueAtPath(mutableDoc, pathParts, change.newValue);
                return true;
            }

            if (change.operation === 'remove') {
                this.removeValueAtPath(mutableDoc, pathParts);
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    private parsePath(path: string): string[] {
        // Remove leading $.
        const cleanPath = path.startsWith('$.') ? path.slice(2) : path;

        // Split by . and handle array notation
        const parts: string[] = [];
        let current = '';

        for (const char of cleanPath) {
            if (char === '.' && !current.includes('[')) {
                if (current) {parts.push(current);}
                current = '';
            } else if (char === '[') {
                if (current) {parts.push(current);}
                current = '[';
            } else if (char === ']') {
                current += ']';
                parts.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        if (current) {parts.push(current);}

        return parts;
    }

    private setValueAtPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
        let current = obj;

        for (let i = 0; i < path.length - 1; i++) {
            const part = path[i];
            const match = part.match(/\[id=([^\]]+)\]/);

            if (match) {
                // Array with id lookup
                const arr = current as unknown as { id: string }[];
                const item = arr.find(a => a.id === match[1]);
                if (item) {
                    current = item as unknown as Record<string, unknown>;
                }
            } else if (part.match(/\[\d+\]/)) {
                // Array index
                const index = parseInt(part.slice(1, -1));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const arr = current as unknown as any[];
                current = arr[index] as Record<string, unknown>;
            } else {
                // Object property
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part] as Record<string, unknown>;
            }
        }

        const lastPart = path[path.length - 1];
        current[lastPart] = value;
    }

    private removeValueAtPath(obj: Record<string, unknown>, path: string[]): void {
        // Similar to setValueAtPath but deletes at the end
        let current = obj;

        for (let i = 0; i < path.length - 1; i++) {
            const part = path[i];
            current = current[part] as Record<string, unknown>;
            if (!current) {return;}
        }

        const lastPart = path[path.length - 1];
        delete current[lastPart];
    }

    private resolveConflict(conflict: MergeConflict): unknown {
        // Try custom resolver first
        const customResolution = this.options.conflictResolver(conflict);
        if (customResolution !== undefined) {
            return customResolution;
        }

        // Apply default resolution strategy
        switch (this.options.defaultResolution) {
            case 'ours':
                return conflict.oursValue;
            case 'theirs':
                return conflict.theirsValue;
            case 'base':
                return conflict.baseValue;
            default:
                return undefined;
        }
    }
}

// =============================================================================
// Singleton Instances
// =============================================================================

/**
 * Default IR diff instance.
 */
export const irDiff = new IRDiff();

/**
 * Default IR merge instance.
 */
export const irMerge = new IRMerge();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Compares two IR documents.
 *
 * @param oldDoc - The original document
 * @param newDoc - The modified document
 * @param options - Diff options
 * @returns Diff result
 */
export function compareIR(
    oldDoc: IRDocument,
    newDoc: IRDocument,
    options?: DiffOptions
): IRDiffResult {
    return irDiff.compare(oldDoc, newDoc, options);
}

/**
 * Merges two IR documents.
 *
 * @param original - The original document
 * @param modified - The modified document
 * @param options - Merge options
 * @returns Merge result
 */
export function mergeIR(
    original: IRDocument,
    modified: IRDocument,
    options?: MergeOptions
): IRMergeResult {
    return irMerge.twoWay(original, modified, options);
}
