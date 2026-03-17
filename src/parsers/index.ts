/**
 * Source Parsers Module
 *
 * Provides parsing capabilities for various integration platforms:
 * - BizTalk Server (fully implemented)
 * - MuleSoft (stub)
 *
 * @module parsers
 */

// Core types
export * from './types';

// Interfaces
export * from './IParser';

// Base classes
export { AbstractParser, ParseErrorAccumulator } from './AbstractParser';

// Registry and Factory
export { ParserRegistry, defaultParserRegistry } from './ParserRegistry';
export { ParserFactory, defaultParserFactory } from './ParserFactory';

// Plugin Loader (for external parsers)
export {
    ParserPluginLoader,
    createExtensionAPI,
    type LogicAppsMigrationAssistantAPI,
    type ParserRegistrationOptions,
    type ParserRegistrationResult,
    type ExternalParserInfo,
} from './ParserPluginLoader';

// XML utilities
export * as xmlUtils from './utils/xml';

// BizTalk Parsers (fully implemented)
export {
    BizTalkProjectParser,
    BizTalkOrchestrationParser,
    BizTalkMapParser,
    BizTalkSchemaParser,
    BizTalkPipelineParser,
    BizTalkBindingsParser,
} from './biztalk';

// Stub Parsers (work in progress)
export {
    MuleSoftFlowParser,
    MuleSoftDataWeaveParser,
    MuleSoftAPISpecParser,
    GenericXMLParser,
} from './stubs';

// Parser registration
import { defaultParserRegistry } from './ParserRegistry';
import {
    BizTalkProjectParser,
    BizTalkOrchestrationParser,
    BizTalkMapParser,
    BizTalkSchemaParser,
    BizTalkPipelineParser,
    BizTalkBindingsParser,
} from './biztalk';
import {
    MuleSoftFlowParser,
    MuleSoftDataWeaveParser,
    MuleSoftAPISpecParser,
    GenericXMLParser,
} from './stubs';

/**
 * Initialize all parsers and register them with the default registry.
 * Call this during extension activation.
 */
export function initializeParsers(): void {
    // BizTalk parsers (fully implemented)
    defaultParserRegistry.register(new BizTalkProjectParser());
    defaultParserRegistry.register(new BizTalkOrchestrationParser());
    defaultParserRegistry.register(new BizTalkMapParser());
    defaultParserRegistry.register(new BizTalkSchemaParser());
    defaultParserRegistry.register(new BizTalkPipelineParser());
    defaultParserRegistry.register(new BizTalkBindingsParser());

    // MuleSoft parsers (stubs)
    defaultParserRegistry.register(new MuleSoftFlowParser());
    defaultParserRegistry.register(new MuleSoftDataWeaveParser());
    defaultParserRegistry.register(new MuleSoftAPISpecParser());

    // Generic XML parser (stub)
    defaultParserRegistry.register(new GenericXMLParser());
}
