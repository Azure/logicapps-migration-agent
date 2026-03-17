/**
 * IR Storage module exports.
 *
 * @module ir/storage
 */

export {
    // Types
    IRStorageMetadata,
    StorageResult,
    StorageOptions,
    CacheOptions,

    // Classes
    IRCache,
    IRStorage,

    // Convenience functions
    getDefaultStorage,
    disposeDefaultStorage,
} from './IRStorage';
