/**
 * Source Parsers Module
 *
 * Provides parsing capabilities for various integration platforms:
 * - BizTalk Server (fully implemented)
 * - MuleSoft (fully implemented)
 * - TIBCO BusinessWorks (basic implementation)
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
    type logicAppsMigrationAgentAPI,
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
    BizTalkHidxParser,
    BizTalkRulesParser,
    BizTalkAsmxParser,
} from './biztalk';

// MuleSoft Parsers (fully implemented)
export { MuleSoftFlowParser, MuleSoftDataWeaveParser, MuleSoftProjectParser } from './mulesoft';

// TIBCO Parsers (basic implementation)
export { TIBCOProjectParser, TIBCOProcessParser } from './tibco';

// Stub Parsers (work in progress)
export { MuleSoftAPISpecParser, GenericXMLParser } from './stubs';

// Parser registration
import { defaultParserRegistry } from './ParserRegistry';
import {
    BizTalkProjectParser,
    BizTalkOrchestrationParser,
    BizTalkMapParser,
    BizTalkSchemaParser,
    BizTalkPipelineParser,
    BizTalkBindingsParser,
    BizTalkHidxParser,
    BizTalkRulesParser,
    BizTalkAsmxParser,
} from './biztalk';
import { MuleSoftFlowParser, MuleSoftDataWeaveParser, MuleSoftProjectParser } from './mulesoft';
import { TIBCOProjectParser, TIBCOProcessParser } from './tibco';
import { MuleSoftAPISpecParser, GenericXMLParser } from './stubs';

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
    defaultParserRegistry.register(new BizTalkHidxParser());
    defaultParserRegistry.register(new BizTalkRulesParser());
    defaultParserRegistry.register(new BizTalkAsmxParser());

    // MuleSoft parsers (fully implemented)
    defaultParserRegistry.register(new MuleSoftProjectParser());
    defaultParserRegistry.register(new MuleSoftFlowParser());
    defaultParserRegistry.register(new MuleSoftDataWeaveParser());

    // TIBCO parsers (basic implementation)
    defaultParserRegistry.register(new TIBCOProjectParser());
    defaultParserRegistry.register(new TIBCOProcessParser());

    // MuleSoft API spec parser (stub — RAML/OAS parsing planned)
    defaultParserRegistry.register(new MuleSoftAPISpecParser());

    // Generic XML parser (stub)
    defaultParserRegistry.register(new GenericXMLParser());
}
