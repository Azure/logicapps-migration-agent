/**
 * Common IR Types
 *
 * Shared type definitions used across the IR schema.
 * These provide the foundational building blocks for all IR components.
 *
 * @module ir/types/common
 */

// =============================================================================
// Platform Types
// =============================================================================

/**
 * Source platforms supported by the migration agent.
 * Each platform has specialized parsers that convert platform-specific
 * artifacts into the normalized IR format.
 */
export type SourcePlatformType = 'biztalk' | 'mulesoft' | 'tibco' | 'generic'; // For generic XML/JSON inputs

/**
 * Target platforms for conversion output.
 * Currently supports Azure Logic Apps in both hosting models.
 */
export type TargetPlatformType = 'logic-apps-standard' | 'logic-apps-consumption';

// =============================================================================
// Migration Status Types
// =============================================================================

/**
 * Migration stage status values.
 * Tracks the progress of an artifact through the 8-stage migration workflow.
 */
export type MigrationStatus =
    | 'discovered'
    | 'assessed'
    | 'planned'
    | 'designed'
    | 'converted'
    | 'validated'
    | 'deployed'
    | 'verified';

/**
 * Complexity levels for migration artifacts.
 * Used to categorize and prioritize migration work.
 */
export type ComplexityLevel = 'low' | 'medium' | 'high' | 'very-high';

/**
 * Confidence levels for estimates and assessments.
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

// =============================================================================
// Artifact Types
// =============================================================================

/**
 * Types of artifacts that can be migrated from source platforms.
 * Maps to the primary integration artifact in each platform.
 */
export type ArtifactType =
    | 'orchestration' // BizTalk orchestration (.odx)
    | 'flow' // MuleSoft flow
    | 'project' // Project file
    | 'schema' // Schema definition
    | 'pipeline' // Pipeline
    | 'binding' // Binding configuration
    | 'map'; // Data transformation map

/**
 * File types for source artifacts.
 */
export type SourceFileType =
    | 'odx' // BizTalk orchestration
    | 'btm' // BizTalk map
    | 'xsd' // XML Schema
    | 'btp' // BizTalk pipeline
    | 'xml' // Generic XML (MuleSoft flows, etc.)
    | 'dwl' // DataWeave
    | 'raml' // RAML API spec
    | 'json' // JSON (various)
    | 'yaml' // YAML config
    // Semantic types (for parser use)
    | 'orchestration' // Workflow/orchestration artifact
    | 'map' // Data transformation map
    | 'schema' // Schema definition
    | 'pipeline' // Pipeline definition
    | 'binding' // Binding configuration
    | 'project' // Project file
    | 'flow' // Flow definition (generic)
    | 'transform' // Transformation (generic)
    | 'config' // Configuration file
    | 'api-spec' // API specification
    | 'connector'; // Connector configuration

// =============================================================================
// Workflow Types
// =============================================================================

/**
 * Logic Apps workflow type.
 * Determines state management and durability characteristics.
 */
export type WorkflowType = 'stateful' | 'stateless';

// =============================================================================
// Gap Types
// =============================================================================

/**
 * Severity levels for migration gaps.
 * Determines priority and impact assessment.
 */
export type GapSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Categories of migration gaps.
 * Classifies the type of feature or capability that cannot be directly migrated.
 */
export type GapCategory =
    | 'unsupported-feature' // Feature not available in target
    | 'unsupported-adapter' // Connector not available
    | 'complex-logic' // Business logic too complex for direct conversion
    | 'custom-code' // Custom code (assemblies, scripts)
    | 'transaction' // Transaction/compensation patterns
    | 'correlation' // Message correlation patterns
    | 'performance' // Performance-sensitive features
    | 'pipeline' // Pipeline component gaps
    | 'tracking' // BAM/tracking gaps
    | 'b2b' // EDI/B2B gaps
    | 'rules' // Business rules engine gaps
    | 'other'; // Uncategorized gaps

/**
 * Resolution strategies for addressing migration gaps.
 */
export type GapResolutionStrategy =
    | 'auto-generate' // Automatically generate solution (scaffold/stub)
    | 'alternative' // Use recommended alternative pattern
    | 'azure-function' // Implement as Azure Function
    | 'manual' // Requires manual implementation
    | 'skip'; // Skip and document for later

/**
 * Status of gap resolution work.
 */
export type GapStatus = 'pending' | 'in-progress' | 'resolved' | 'deferred';

// =============================================================================
// Override Types
// =============================================================================

/**
 * Sources of user overrides.
 * Tracks where corrections to assessments originated.
 */
export type OverrideSource = 'chat' | 'ui' | 'api';

// =============================================================================
// Transport and Protocol Types
// =============================================================================

/**
 * Transport protocols for endpoints and connections.
 */
export type TransportType =
    | 'http'
    | 'https'
    | 'ftp'
    | 'sftp'
    | 'file'
    | 'mq'
    | 'jms'
    | 'kafka'
    | 'service-bus'
    | 'event-hub'
    | 'storage-queue'
    | 'storage-blob'
    | 'smtp'
    | 'pop3'
    | 'imap'
    | 'soap'
    | 'sap-rfc'
    | 'sap-idoc'
    | 'database'
    | 'custom';

/**
 * Communication patterns for endpoints.
 */
export type CommunicationPattern =
    | 'one-way' // Fire and forget
    | 'request-response' // Synchronous request/response
    | 'solicit-response' // Solicit response from downstream
    | 'polling' // Poll for messages
    | 'subscription' // Subscribe to events/topics
    | 'webhook'; // Webhook callback

// =============================================================================
// Data Types
// =============================================================================

/**
 * Schema format types.
 */
export type SchemaType = 'xml' | 'json' | 'flatfile' | 'avro' | 'protobuf' | 'custom';

/**
 * Map/transformation types.
 */
export type MapType = 'xslt' | 'liquid' | 'dataweave' | 'jolt' | 'xquery' | 'custom-code';

/**
 * Variable data types.
 */
export type VariableType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

// =============================================================================
// Authentication Types
// =============================================================================

/**
 * Authentication mechanisms for connections and endpoints.
 */
export type AuthenticationType =
    | 'none'
    | 'api-key'
    | 'basic'
    | 'oauth2'
    | 'certificate'
    | 'managed-identity'
    | 'sas'
    | 'windows'
    | 'kerberos';

/**
 * Credential storage locations.
 */
export type CredentialStorageType = 'key-vault' | 'inline' | 'managed-identity' | 'sso';

// =============================================================================
// Error Handling Types
// =============================================================================

/**
 * Error handling handler types.
 */
export type ErrorHandlerType = 'catch' | 'finally' | 'compensation';

/**
 * Error handling strategies.
 */
export type ErrorStrategy = 'propagate' | 'catch' | 'ignore' | 'retry';

/**
 * Retry policy types.
 */
export type RetryPolicyType = 'none' | 'fixed' | 'exponential';

/**
 * Run-after states for action dependencies.
 */
export type RunAfterState = 'Succeeded' | 'Failed' | 'Skipped' | 'TimedOut';

// =============================================================================
// B2B/EDI Types
// =============================================================================

/**
 * EDI protocol types.
 */
export type EDIProtocol = 'x12' | 'edifact' | 'as2' | 'rosettanet';

// =============================================================================
// Infrastructure Types
// =============================================================================

/**
 * Azure infrastructure resource types.
 */
export type InfrastructureType =
    | 'logic-app'
    | 'integration-account'
    | 'azure-function-app'
    | 'on-premises-data-gateway'
    | 'key-vault'
    | 'storage-account'
    | 'service-bus'
    | 'event-hub'
    | 'api-management';

/**
 * Integration Account tiers.
 */
export type IntegrationAccountTier = 'free' | 'basic' | 'standard' | 'premium';

/**
 * Azure Function runtime versions.
 */
export type FunctionRuntime =
    | 'dotnet6'
    | 'dotnet7'
    | 'dotnet8'
    | 'node18'
    | 'node20'
    | 'python39'
    | 'python310'
    | 'python311';

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Generic key-value record for configuration and extension data.
 */
export type ConfigRecord = Record<string, unknown>;

/**
 * Source mapping record for platform-specific details.
 * Maps platform name to platform-specific configuration.
 */
export type SourceMappingRecord = Partial<Record<SourcePlatformType, ConfigRecord>>;

/**
 * ISO 8601 duration string (e.g., "PT30S", "PT1H").
 */
export type ISODuration = string;

/**
 * ISO 8601 timestamp string.
 */
export type ISOTimestamp = string;

/**
 * JSON Pointer reference (e.g., "#/schemas/OrderRequest").
 */
export type JSONPointer = string;

/**
 * Expression string used in workflows.
 */
export type Expression = string;

/**
 * XPath expression string.
 */
export type XPathExpression = string;

/**
 * JSONPath expression string.
 */
export type JSONPathExpression = string;
