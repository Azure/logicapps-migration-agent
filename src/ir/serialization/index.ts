/**
 * IR Serialization Module Index
 *
 * Exports all serialization utilities for IR documents.
 *
 * @module ir/serialization
 */

export {
    // Constants
    MAX_IR_SIZE,
    DEFAULT_INDENT,

    // Error types
    IRSerializationError,

    // Options
    SerializeOptions,
    DeserializeOptions,

    // Results
    SerializationResult,
    DeserializationResult,

    // Main class
    IRSerializer,

    // Singleton
    irSerializer,

    // Convenience functions
    serializeIR,
    deserializeIR,
} from './IRSerializer';
