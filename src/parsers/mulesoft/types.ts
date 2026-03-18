/**
 * MuleSoft Parser Types
 *
 * Type definitions specific to MuleSoft Mule 4 parsing.
 *
 * @module parsers/mulesoft/types
 */

// =============================================================================
// MuleSoft Version
// =============================================================================

/**
 * Supported Mule runtime versions.
 */
export type MuleRuntimeVersion = '3' | '4' | 'unknown';

/**
 * MuleSoft project type.
 */
export type MuleProjectType = 'mule-application' | 'mule-domain' | 'mule-policy' | 'unknown';

// =============================================================================
// Project Structure
// =============================================================================

/**
 * MuleSoft project information extracted from pom.xml and mule-artifact.json.
 */
export interface MuleProjectInfo {
    /** Project file path (pom.xml) */
    readonly projectPath: string;

    /** Project name (artifactId) */
    readonly name: string;

    /** Group ID */
    readonly groupId: string;

    /** Project version */
    readonly version: string;

    /** Mule runtime version */
    readonly muleVersion: string;

    /** Detected runtime major version */
    readonly runtimeVersion: MuleRuntimeVersion;

    /** Project type (application, domain, policy) */
    readonly projectType: MuleProjectType;

    /** Project directory */
    readonly projectDirectory: string;

    /** Referenced artifacts grouped by type */
    readonly artifacts: MuleArtifactReferences;

    /** Maven dependencies */
    readonly dependencies: readonly MuleDependency[];

    /** Properties from pom.xml */
    readonly properties: Record<string, string>;

    /** CloudHub deployment config if present */
    readonly cloudHubConfig?: MuleCloudHubConfig;
}

/**
 * Artifact references grouped by type.
 */
export interface MuleArtifactReferences {
    /** Mule flow XML files */
    readonly flows: readonly string[];

    /** DataWeave transformation files (.dwl) */
    readonly dataweaveFiles: readonly string[];

    /** RAML API specification files */
    readonly ramlFiles: readonly string[];

    /** OpenAPI/Swagger specification files */
    readonly openApiFiles: readonly string[];

    /** Property files */
    readonly propertyFiles: readonly string[];

    /** Other configuration files */
    readonly others: readonly string[];
}

/**
 * Maven dependency information.
 */
export interface MuleDependency {
    /** Group ID */
    readonly groupId: string;

    /** Artifact ID */
    readonly artifactId: string;

    /** Version */
    readonly version?: string;

    /** Classifier (e.g., 'mule-plugin') */
    readonly classifier?: string;

    /** Scope */
    readonly scope?: string;
}

/**
 * CloudHub deployment configuration.
 */
export interface MuleCloudHubConfig {
    /** Number of workers */
    readonly workers?: number;

    /** Worker size (e.g., '0.1', '0.2', '1', '2') */
    readonly workerSize?: string;

    /** Region (e.g., 'us-east-1') */
    readonly region?: string;

    /** Object Store V2 enabled */
    readonly objectStoreV2?: boolean;

    /** Runtime version for CloudHub */
    readonly muleVersion?: string;
}

// =============================================================================
// Flow Structure
// =============================================================================

/**
 * Mule application info extracted from XML files.
 */
export interface MuleApplicationInfo {
    /** Flow XML file path */
    readonly filePath: string;

    /** Application name (derived from file name) */
    readonly name: string;

    /** All flows in this XML file */
    readonly flows: readonly MuleFlow[];

    /** All sub-flows in this XML file */
    readonly subFlows: readonly MuleSubFlow[];

    /** Global configurations (connector configs) */
    readonly globalConfigs: readonly MuleGlobalConfig[];

    /** Global error handler (if defined) */
    readonly globalErrorHandler?: MuleErrorHandler;

    /** XML namespaces used */
    readonly namespaces: Record<string, string>;
}

/**
 * A Mule flow with a source (trigger) and processors.
 */
export interface MuleFlow {
    /** Flow name */
    readonly name: string;

    /** Source element (trigger) */
    readonly source?: MuleSource;

    /** Processors (steps) */
    readonly processors: readonly MuleProcessor[];

    /** Error handler for this flow */
    readonly errorHandler?: MuleErrorHandler;

    /** Max concurrency */
    readonly maxConcurrency?: number;

    /** Initial state (started/stopped) */
    readonly initialState?: string;
}

/**
 * A Mule sub-flow (no source, reusable fragment).
 */
export interface MuleSubFlow {
    /** Sub-flow name */
    readonly name: string;

    /** Processors (steps) */
    readonly processors: readonly MuleProcessor[];
}

// =============================================================================
// Source (Trigger) Types
// =============================================================================

/**
 * Mule source (trigger) element at the start of a flow.
 */
export interface MuleSource {
    /** Source type (e.g., 'http:listener', 'jms:listener', 'scheduler') */
    readonly type: string;

    /** Namespace prefix (e.g., 'http', 'jms', 'scheduler') */
    readonly namespace: string;

    /** Local name (e.g., 'listener', 'subscriber') */
    readonly localName: string;

    /** Config reference (e.g., 'HTTP_Listener_config') */
    readonly configRef?: string;

    /** All attributes */
    readonly attributes: Record<string, string>;

    /** Child element content (for complex configs) */
    readonly children: readonly MuleElement[];

    /** Raw XML content */
    readonly rawXml?: string;
}

// =============================================================================
// Processor Types
// =============================================================================

/**
 * Base processor type for all Mule processors.
 */
export type MuleProcessorType =
    // Core processors
    | 'logger'
    | 'set-payload'
    | 'set-variable'
    | 'remove-variable'
    | 'flow-ref'
    | 'raise-error'
    | 'parse-template'
    // DataWeave transform
    | 'ee:transform'
    // Control flow
    | 'choice'
    | 'scatter-gather'
    | 'foreach'
    | 'until-successful'
    | 'first-successful'
    | 'round-robin'
    | 'try'
    // HTTP
    | 'http:request'
    // Database
    | 'db:select'
    | 'db:insert'
    | 'db:update'
    | 'db:delete'
    | 'db:stored-procedure'
    | 'db:bulk-insert'
    | 'db:bulk-update'
    | 'db:bulk-delete'
    // File
    | 'file:read'
    | 'file:write'
    | 'file:copy'
    | 'file:move'
    | 'file:delete'
    | 'file:list'
    // FTP/SFTP
    | 'ftp:read'
    | 'ftp:write'
    | 'ftp:copy'
    | 'ftp:move'
    | 'ftp:delete'
    | 'ftp:list'
    | 'sftp:read'
    | 'sftp:write'
    | 'sftp:copy'
    | 'sftp:move'
    | 'sftp:delete'
    | 'sftp:list'
    // JMS
    | 'jms:publish'
    | 'jms:consume'
    | 'jms:publish-consume'
    // VM
    | 'vm:publish'
    | 'vm:consume'
    | 'vm:publish-consume'
    // Web services
    | 'wsc:consume'
    // Object Store
    | 'os:store'
    | 'os:retrieve'
    | 'os:contains'
    | 'os:remove'
    // Email
    | 'email:send'
    // Validation
    | 'validation:is-true'
    | 'validation:is-false'
    | 'validation:is-not-null'
    | 'validation:is-null'
    | 'validation:validates-size'
    | 'validation:is-not-blank-string'
    | 'validation:matches-regex'
    | 'validation:is-email'
    // SAP
    | 'sap:sync-rfc'
    | 'sap:async-rfc'
    | 'sap:send-idoc'
    // Salesforce
    | 'salesforce:create'
    | 'salesforce:update'
    | 'salesforce:query'
    | 'salesforce:delete'
    | 'salesforce:upsert'
    // Generic / unknown
    | 'unknown';

/**
 * A Mule processor (step in a flow).
 */
export interface MuleProcessor {
    /** Processor type */
    readonly type: MuleProcessorType;

    /** Qualified tag name (e.g., 'http:request', 'ee:transform') */
    readonly qualifiedName: string;

    /** Namespace prefix */
    readonly namespace: string;

    /** Local name */
    readonly localName: string;

    /** Doc name (display name) */
    readonly docName?: string;

    /** Config reference */
    readonly configRef?: string;

    /** All attributes */
    readonly attributes: Record<string, string>;

    /** Child elements */
    readonly children: readonly MuleElement[];

    /** Nested processors (for container types like choice, scatter-gather, try) */
    readonly nestedProcessors?: readonly MuleProcessor[];

    /** Branches (for choice, scatter-gather) */
    readonly branches?: readonly MuleBranch[];

    /** Error handler (for try scope) */
    readonly errorHandler?: MuleErrorHandler;

    /** Collection expression (for foreach) */
    readonly collection?: string;

    /** DataWeave content (for ee:transform) */
    readonly dataweaveContent?: MuleDataWeaveContent;
}

/**
 * Generic child element.
 */
export interface MuleElement {
    /** Tag name */
    readonly tagName: string;

    /** Attributes */
    readonly attributes: Record<string, string>;

    /** Text content */
    readonly textContent?: string;

    /** Child elements */
    readonly children: readonly MuleElement[];
}

/**
 * DataWeave content within an ee:transform processor.
 */
export interface MuleDataWeaveContent {
    /** Payload transformation script */
    readonly setPayload?: string;

    /** Variable transformations (name → script) */
    readonly setVariables?: Record<string, string>;

    /** Attribute transformation script */
    readonly setAttributes?: string;
}

// =============================================================================
// Branch Types
// =============================================================================

/**
 * A branch in a choice or scatter-gather.
 */
export interface MuleBranch {
    /** Branch label/identifier */
    readonly label?: string;

    /** Condition expression (for choice when clauses) */
    readonly expression?: string;

    /** Whether this is the otherwise/default branch */
    readonly isDefault?: boolean;

    /** Processors in this branch */
    readonly processors: readonly MuleProcessor[];
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Mule error handler definition.
 */
export interface MuleErrorHandler {
    /** Error handler strategies */
    readonly strategies: readonly MuleErrorStrategy[];
}

/**
 * Error handling strategy (on-error-propagate or on-error-continue).
 */
export interface MuleErrorStrategy {
    /** Strategy type */
    readonly type: 'on-error-propagate' | 'on-error-continue';

    /** Error type filter (e.g., 'HTTP:CONNECTIVITY', 'ANY') */
    readonly errorType?: string;

    /** When condition expression */
    readonly when?: string;

    /** Whether to log the exception */
    readonly logException?: boolean;

    /** Whether to enable notifications */
    readonly enableNotifications?: boolean;

    /** Processors in this error handler */
    readonly processors: readonly MuleProcessor[];
}

// =============================================================================
// Global Configuration Types
// =============================================================================

/**
 * Global connector configuration.
 */
export interface MuleGlobalConfig {
    /** Config type (e.g., 'http:listener-config', 'db:config') */
    readonly type: string;

    /** Config name attribute */
    readonly name: string;

    /** Namespace prefix */
    readonly namespace: string;

    /** All attributes */
    readonly attributes: Record<string, string>;

    /** Connection element details */
    readonly connection?: MuleConnectionConfig;

    /** Child elements */
    readonly children: readonly MuleElement[];
}

/**
 * Connection sub-element within a global config.
 */
export interface MuleConnectionConfig {
    /** Connection type tag (e.g., 'http:listener-connection', 'db:my-sql-connection') */
    readonly type: string;

    /** All connection attributes */
    readonly attributes: Record<string, string>;

    /** Child elements (e.g., TLS, authentication) */
    readonly children: readonly MuleElement[];
}

// =============================================================================
// Processor → IR Mapping Reference
// =============================================================================

/**
 * Mapping from MuleSoft processor types to Logic Apps action types.
 */
export const MULE_TO_LA_ACTION_MAP: Record<string, { action: string; gap: boolean; notes?: string }> = {
    'http:listener': { action: 'When_a_HTTP_request_is_received', gap: false },
    'http:request': { action: 'HTTP', gap: false },
    'ee:transform': { action: 'Compose', gap: true, notes: 'DataWeave requires conversion to Liquid' },
    'choice': { action: 'Switch', gap: false },
    'scatter-gather': { action: 'Parallel_branches', gap: false },
    'foreach': { action: 'For_each', gap: false },
    'until-successful': { action: 'Until', gap: false },
    'try': { action: 'Scope', gap: false },
    'flow-ref': { action: 'Call_a_child_Logic_Apps_workflow', gap: false },
    'set-variable': { action: 'Set_variable', gap: false },
    'set-payload': { action: 'Compose', gap: false },
    'logger': { action: 'Compose', gap: false, notes: 'Use tracked properties for logging' },
    'raise-error': { action: 'Terminate', gap: false },
    'db:select': { action: 'Execute_a_SQL_query_(V2)', gap: false },
    'db:insert': { action: 'Execute_a_SQL_query_(V2)', gap: false },
    'db:update': { action: 'Execute_a_SQL_query_(V2)', gap: false },
    'db:delete': { action: 'Execute_a_SQL_query_(V2)', gap: false },
    'db:stored-procedure': { action: 'Execute_stored_procedure_(V2)', gap: false },
    'file:read': { action: 'Get_file_content', gap: false },
    'file:write': { action: 'Create_file', gap: false },
    'ftp:read': { action: 'Get_file_content_(FTP)', gap: false },
    'ftp:write': { action: 'Create_file_(FTP)', gap: false },
    'sftp:read': { action: 'Get_file_content_(SFTP)', gap: false },
    'sftp:write': { action: 'Create_file_(SFTP)', gap: false },
    'jms:publish': { action: 'Send_message_(Service_Bus)', gap: true, notes: 'JMS requires Service Bus or custom connector' },
    'jms:consume': { action: 'Get_messages_from_queue_(Service_Bus)', gap: true, notes: 'JMS requires Service Bus mapping' },
    'vm:publish': { action: 'Send_message_(Service_Bus)', gap: true, notes: 'VM queues map to Service Bus queues' },
    'vm:consume': { action: 'Get_messages_from_queue_(Service_Bus)', gap: true, notes: 'VM queues map to Service Bus queues' },
    'wsc:consume': { action: 'HTTP', gap: true, notes: 'SOAP calls need HTTP action with XML body' },
    'email:send': { action: 'Send_an_email_(V2)', gap: false },
    'os:store': { action: 'Insert_or_Replace_Entity_(Table_Storage)', gap: true, notes: 'Object Store maps to Azure Table Storage or Cache' },
    'os:retrieve': { action: 'Get_Entity_(Table_Storage)', gap: true, notes: 'Object Store maps to Azure Table Storage or Cache' },
    'validation:is-true': { action: 'Condition', gap: false },
    'validation:is-false': { action: 'Condition', gap: false },
    'validation:is-not-null': { action: 'Condition', gap: false },
    'validation:is-null': { action: 'Condition', gap: false },
    'salesforce:query': { action: 'Salesforce_Connector', gap: false },
    'salesforce:create': { action: 'Salesforce_Connector', gap: false },
    'salesforce:update': { action: 'Salesforce_Connector', gap: false },
    'salesforce:delete': { action: 'Salesforce_Connector', gap: false },
    'salesforce:upsert': { action: 'Salesforce_Connector', gap: false },
    'sap:sync-rfc': { action: 'SAP_Connector', gap: true, notes: 'SAP RFC requires on-premises data gateway' },
    'sap:async-rfc': { action: 'SAP_Connector', gap: true, notes: 'SAP RFC requires on-premises data gateway' },
    'sap:send-idoc': { action: 'SAP_Connector', gap: true, notes: 'SAP IDoc requires on-premises data gateway' },
};

/**
 * Mapping from MuleSoft source types to IR trigger types.
 */
export const MULE_SOURCE_TO_TRIGGER_MAP: Record<string, { triggerType: string; category: string }> = {
    'http:listener': { triggerType: 'http', category: 'request-response' },
    'jms:listener': { triggerType: 'service-bus', category: 'messaging' },
    'vm:listener': { triggerType: 'storage-queue', category: 'messaging' },
    'scheduler': { triggerType: 'timer', category: 'schedule' },
    'file:listener': { triggerType: 'file', category: 'file' },
    'ftp:listener': { triggerType: 'ftp', category: 'file' },
    'sftp:listener': { triggerType: 'sftp', category: 'file' },
    'email:listener-imap': { triggerType: 'email', category: 'email' },
    'email:listener-pop3': { triggerType: 'email', category: 'email' },
    'db:listener': { triggerType: 'database', category: 'database' },
};

/**
 * Known Mule namespace URIs.
 */
export const MULE_NAMESPACES: Record<string, string> = {
    'http://www.mulesoft.org/schema/mule/core': 'core',
    'http://www.mulesoft.org/schema/mule/http': 'http',
    'http://www.mulesoft.org/schema/mule/ee/core': 'ee',
    'http://www.mulesoft.org/schema/mule/db': 'db',
    'http://www.mulesoft.org/schema/mule/file': 'file',
    'http://www.mulesoft.org/schema/mule/ftp': 'ftp',
    'http://www.mulesoft.org/schema/mule/sftp': 'sftp',
    'http://www.mulesoft.org/schema/mule/jms': 'jms',
    'http://www.mulesoft.org/schema/mule/vm': 'vm',
    'http://www.mulesoft.org/schema/mule/email': 'email',
    'http://www.mulesoft.org/schema/mule/os': 'os',
    'http://www.mulesoft.org/schema/mule/wsc': 'wsc',
    'http://www.mulesoft.org/schema/mule/validation': 'validation',
    'http://www.mulesoft.org/schema/mule/sap': 'sap',
    'http://www.mulesoft.org/schema/mule/salesforce': 'salesforce',
    'http://www.mulesoft.org/schema/mule/apikit': 'apikit',
};
