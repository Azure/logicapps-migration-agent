/**
 * IR Diff and Merge module exports.
 *
 * @module ir/diff
 */

export {
    // Types
    ChangeType,
    ChangeOperation,
    IRChange,
    IRDiffResult,
    DiffOptions,
    MergeConflict,
    IRMergeResult,
    ConflictResolution,
    MergeOptions,

    // Classes
    IRDiff,
    IRMerge,

    // Singleton instances
    irDiff,
    irMerge,

    // Convenience functions
    compareIR,
    mergeIR,
} from './IRDiff';
