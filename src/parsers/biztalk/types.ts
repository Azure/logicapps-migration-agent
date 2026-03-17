/**
 * BizTalk Parser Types
 *
 * Type definitions specific to BizTalk Server parsing.
 *
 * @module parsers/biztalk/types
 */

// =============================================================================
// BizTalk Version
// =============================================================================

/**
 * Supported BizTalk Server versions.
 */
export type BizTalkVersion = '2016' | '2020' | 'unknown';

/**
 * BizTalk project type.
 */
export type BizTalkProjectType = 'standard' | 'web' | 'wcf' | 'unknown';

// =============================================================================
// Project Structure
// =============================================================================

/**
 * BizTalk project information extracted from .btproj.
 */
export interface BizTalkProjectInfo {
    /** Project file path */
    readonly projectPath: string;

    /** Project name (from AssemblyName) */
    readonly name: string;

    /** Project namespace */
    readonly namespace: string;

    /** Assembly version */
    readonly version: string;

    /** BizTalk Server version */
    readonly bizTalkVersion: BizTalkVersion;

    /** Output assembly name */
    readonly assemblyName: string;

    /** Project type */
    readonly projectType: BizTalkProjectType;

    /** Directory containing the project */
    readonly projectDirectory: string;

    /** Referenced artifacts grouped by type */
    readonly artifacts: BizTalkArtifactReferences;

    /** Project references to other projects */
    readonly projectReferences: readonly string[];

    /** Assembly references */
    readonly assemblyReferences: readonly BizTalkAssemblyReference[];
}

/**
 * Artifact references grouped by type.
 */
export interface BizTalkArtifactReferences {
    /** Orchestration files (.odx) */
    readonly orchestrations: readonly string[];

    /** Map files (.btm) */
    readonly maps: readonly string[];

    /** Schema files (.xsd) */
    readonly schemas: readonly string[];

    /** Pipeline files (.btp) */
    readonly pipelines: readonly string[];

    /** Binding files */
    readonly bindings: readonly string[];

    /** Other files */
    readonly others: readonly string[];
}

/**
 * Assembly reference information.
 */
export interface BizTalkAssemblyReference {
    /** Assembly name */
    readonly name: string;

    /** Assembly version */
    readonly version?: string;

    /** Public key token */
    readonly publicKeyToken?: string;

    /** Whether this is a BizTalk assembly */
    readonly isBizTalkAssembly: boolean;

    /** Hint path if local */
    readonly hintPath?: string;
}

// =============================================================================
// Orchestration Types
// =============================================================================

/**
 * BizTalk orchestration shape types.
 */
export type BizTalkShapeType =
    | 'Receive'
    | 'Send'
    | 'Transform'
    | 'ConstructMessage'
    | 'MessageAssignment'
    | 'Expression'
    | 'Decide'
    | 'Loop'
    | 'Listen'
    | 'Parallel'
    | 'Scope'
    | 'Throw'
    | 'Compensate'
    | 'Suspend'
    | 'Terminate'
    | 'Delay'
    | 'CallOrchestration'
    | 'StartOrchestration'
    | 'CallRules'
    | 'Group'
    | 'Unknown';

/**
 * Base interface for orchestration shapes.
 */
export interface BizTalkShapeBase {
    /** Shape type */
    readonly type: BizTalkShapeType;

    /** Shape name/identifier */
    readonly name: string;

    /** Shape description */
    readonly description?: string;

    /** Position in the orchestration (for ordering) */
    readonly position: number;

    /** Parent shape name (for nested shapes) */
    readonly parent?: string;
}

/**
 * Receive shape.
 */
export interface BizTalkReceiveShape extends BizTalkShapeBase {
    readonly type: 'Receive';

    /** Port name */
    readonly portName: string;

    /** Operation name */
    readonly operationName: string;

    /** Message name */
    readonly messageName: string;

    /** Whether this activates the orchestration */
    readonly activates: boolean;

    /** Correlation initializers */
    readonly initializingCorrelations?: readonly string[];

    /** Following correlations */
    readonly followingCorrelations?: readonly string[];

    /** Filter expression */
    readonly filter?: string;
}

/**
 * Send shape.
 */
export interface BizTalkSendShape extends BizTalkShapeBase {
    readonly type: 'Send';

    /** Port name */
    readonly portName: string;

    /** Operation name */
    readonly operationName: string;

    /** Message name */
    readonly messageName: string;

    /** Correlation initializers */
    readonly initializingCorrelations?: readonly string[];

    /** Following correlations */
    readonly followingCorrelations?: readonly string[];
}

/**
 * Transform shape.
 */
export interface BizTalkTransformShape extends BizTalkShapeBase {
    readonly type: 'Transform';

    /** Source message(s) */
    readonly sourceMessages: readonly string[];

    /** Destination message(s) */
    readonly destinationMessages: readonly string[];

    /** Map type name (fully qualified) */
    readonly mapTypeName: string;
}

/**
 * Construct Message shape.
 */
export interface BizTalkConstructMessageShape extends BizTalkShapeBase {
    readonly type: 'ConstructMessage';

    /** Messages being constructed */
    readonly constructedMessages: readonly string[];

    /** Child shapes (MessageAssignment, Transform) */
    readonly children: readonly BizTalkShape[];
}

/**
 * Message Assignment shape.
 */
export interface BizTalkMessageAssignmentShape extends BizTalkShapeBase {
    readonly type: 'MessageAssignment';

    /** Expression code */
    readonly expression: string;
}

/**
 * Expression shape.
 */
export interface BizTalkExpressionShape extends BizTalkShapeBase {
    readonly type: 'Expression';

    /** Expression code */
    readonly expression: string;
}

/**
 * Decide shape (if/else).
 */
export interface BizTalkDecideShape extends BizTalkShapeBase {
    readonly type: 'Decide';

    /** Branches (conditions and else) */
    readonly branches: readonly BizTalkDecideBranch[];
}

/**
 * Decide branch.
 */
export interface BizTalkDecideBranch {
    /** Branch name */
    readonly name: string;

    /** Condition expression (null for else) */
    readonly condition: string | null;

    /** Whether this is the else branch */
    readonly isElse: boolean;

    /** Child shapes in this branch */
    readonly children: readonly BizTalkShape[];
}

/**
 * Loop shape.
 */
export interface BizTalkLoopShape extends BizTalkShapeBase {
    readonly type: 'Loop';

    /** Loop condition expression */
    readonly condition: string;

    /** Child shapes in the loop body */
    readonly children: readonly BizTalkShape[];
}

/**
 * Listen shape (receive/timeout).
 */
export interface BizTalkListenShape extends BizTalkShapeBase {
    readonly type: 'Listen';

    /** Listen branches */
    readonly branches: readonly BizTalkListenBranch[];
}

/**
 * Listen branch.
 */
export interface BizTalkListenBranch {
    /** Branch name */
    readonly name: string;

    /** Whether this is a receive or delay branch */
    readonly branchType: 'receive' | 'delay';

    /** Child shapes in this branch */
    readonly children: readonly BizTalkShape[];
}

/**
 * Parallel shape.
 */
export interface BizTalkParallelShape extends BizTalkShapeBase {
    readonly type: 'Parallel';

    /** Parallel branches */
    readonly branches: readonly BizTalkParallelBranch[];
}

/**
 * Parallel branch.
 */
export interface BizTalkParallelBranch {
    /** Branch name */
    readonly name: string;

    /** Child shapes in this branch */
    readonly children: readonly BizTalkShape[];
}

/**
 * Scope shape.
 */
export interface BizTalkScopeShape extends BizTalkShapeBase {
    readonly type: 'Scope';

    /** Scope transaction type */
    readonly transactionType: 'none' | 'atomic' | 'long-running';

    /** Whether the scope is synchronized */
    readonly synchronized: boolean;

    /** Timeout expression */
    readonly timeout?: string;

    /** Child shapes in the scope body */
    readonly children: readonly BizTalkShape[];

    /** Exception handlers */
    readonly exceptionHandlers: readonly BizTalkExceptionHandler[];

    /** Compensation block */
    readonly compensation?: BizTalkCompensationBlock;
}

/**
 * Exception handler.
 */
export interface BizTalkExceptionHandler {
    /** Handler name */
    readonly name: string;

    /** Exception type being caught */
    readonly exceptionType: string;

    /** Fault message variable name */
    readonly faultMessageName?: string;

    /** Child shapes in the handler */
    readonly children: readonly BizTalkShape[];
}

/**
 * Compensation block.
 */
export interface BizTalkCompensationBlock {
    /** Child shapes in the compensation */
    readonly children: readonly BizTalkShape[];
}

/**
 * Throw shape.
 */
export interface BizTalkThrowShape extends BizTalkShapeBase {
    readonly type: 'Throw';

    /** Exception type being thrown */
    readonly exceptionType: string;

    /** Fault message name */
    readonly faultMessageName?: string;
}

/**
 * Compensate shape.
 */
export interface BizTalkCompensateShape extends BizTalkShapeBase {
    readonly type: 'Compensate';

    /** Target scope to compensate (null for current) */
    readonly targetScope?: string;
}

/**
 * Suspend shape.
 */
export interface BizTalkSuspendShape extends BizTalkShapeBase {
    readonly type: 'Suspend';

    /** Suspend message expression */
    readonly errorMessage?: string;
}

/**
 * Terminate shape.
 */
export interface BizTalkTerminateShape extends BizTalkShapeBase {
    readonly type: 'Terminate';

    /** Termination message expression */
    readonly errorMessage?: string;
}

/**
 * Delay shape.
 */
export interface BizTalkDelayShape extends BizTalkShapeBase {
    readonly type: 'Delay';

    /** Delay expression (TimeSpan or DateTime) */
    readonly delayExpression: string;

    /** Whether it's a delay until (DateTime) */
    readonly isDelayUntil: boolean;
}

/**
 * Call Orchestration shape.
 */
export interface BizTalkCallOrchestrationShape extends BizTalkShapeBase {
    readonly type: 'CallOrchestration';

    /** Called orchestration type name */
    readonly calledOrchestration: string;

    /** Parameter mappings */
    readonly parameters: readonly BizTalkParameterMapping[];
}

/**
 * Start Orchestration shape.
 */
export interface BizTalkStartOrchestrationShape extends BizTalkShapeBase {
    readonly type: 'StartOrchestration';

    /** Started orchestration type name */
    readonly startedOrchestration: string;

    /** Parameter mappings */
    readonly parameters: readonly BizTalkParameterMapping[];
}

/**
 * Parameter mapping for call/start orchestration.
 */
export interface BizTalkParameterMapping {
    /** Parameter name */
    readonly parameterName: string;

    /** Variable/message name */
    readonly variableName: string;
}

/**
 * Call Rules shape.
 */
export interface BizTalkCallRulesShape extends BizTalkShapeBase {
    readonly type: 'CallRules';

    /** Policy name */
    readonly policyName: string;

    /** Policy version */
    readonly policyVersion?: string;

    /** Parameter mappings */
    readonly parameters: readonly BizTalkParameterMapping[];
}

/**
 * Group shape (container).
 */
export interface BizTalkGroupShape extends BizTalkShapeBase {
    readonly type: 'Group';

    /** Child shapes in the group */
    readonly children: readonly BizTalkShape[];
}

/**
 * Unknown shape (for forward compatibility).
 */
export interface BizTalkUnknownShape extends BizTalkShapeBase {
    readonly type: 'Unknown';

    /** Original shape type name */
    readonly originalType: string;

    /** Raw properties */
    readonly rawProperties?: Record<string, unknown>;
}

/**
 * Union of all BizTalk shape types.
 */
export type BizTalkShape =
    | BizTalkReceiveShape
    | BizTalkSendShape
    | BizTalkTransformShape
    | BizTalkConstructMessageShape
    | BizTalkMessageAssignmentShape
    | BizTalkExpressionShape
    | BizTalkDecideShape
    | BizTalkLoopShape
    | BizTalkListenShape
    | BizTalkParallelShape
    | BizTalkScopeShape
    | BizTalkThrowShape
    | BizTalkCompensateShape
    | BizTalkSuspendShape
    | BizTalkTerminateShape
    | BizTalkDelayShape
    | BizTalkCallOrchestrationShape
    | BizTalkStartOrchestrationShape
    | BizTalkCallRulesShape
    | BizTalkGroupShape
    | BizTalkUnknownShape;

// =============================================================================
// Orchestration Metadata
// =============================================================================

/**
 * Orchestration port definition.
 */
export interface BizTalkPort {
    /** Port name */
    readonly name: string;

    /** Port type name */
    readonly portTypeName: string;

    /** Direction (in = receive, out = send, in-out = both) */
    readonly direction: 'in' | 'out' | 'in-out';

    /** Port binding (none = direct, later = specify later, physical = bound) */
    readonly binding: 'none' | 'later' | 'physical';

    /** Operations defined by this port */
    readonly operations: readonly BizTalkPortOperation[];
}

/**
 * Port operation.
 */
export interface BizTalkPortOperation {
    /** Operation name */
    readonly name: string;

    /** Operation type */
    readonly operationType: 'one-way' | 'request-response';

    /** Request message type */
    readonly requestMessageType?: string;

    /** Response message type (for request-response) */
    readonly responseMessageType?: string;

    /** Fault message types */
    readonly faultMessageTypes?: readonly string[];
}

/**
 * Message variable definition.
 */
export interface BizTalkMessageVariable {
    /** Variable name */
    readonly name: string;

    /** Message type name */
    readonly messageTypeName: string;

    /** Part name (if multi-part) */
    readonly partName?: string;
}

/**
 * Variable definition.
 */
export interface BizTalkVariable {
    /** Variable name */
    readonly name: string;

    /** .NET type name */
    readonly typeName: string;

    /** Initial value expression */
    readonly initialValue?: string;
}

/**
 * Correlation type definition.
 */
export interface BizTalkCorrelationType {
    /** Correlation type name */
    readonly name: string;

    /** Properties in this correlation */
    readonly properties: readonly string[];
}

/**
 * Correlation set definition.
 */
export interface BizTalkCorrelationSet {
    /** Correlation set name */
    readonly name: string;

    /** Correlation type name */
    readonly correlationTypeName: string;
}

/**
 * Complete orchestration metadata.
 */
export interface BizTalkOrchestrationInfo {
    /** Orchestration name */
    readonly name: string;

    /** Namespace */
    readonly namespace: string;

    /** File path */
    readonly filePath: string;

    /** Shapes in the orchestration */
    readonly shapes: readonly BizTalkShape[];

    /** Port definitions */
    readonly ports: readonly BizTalkPort[];

    /** Message variables */
    readonly messages: readonly BizTalkMessageVariable[];

    /** Regular variables */
    readonly variables: readonly BizTalkVariable[];

    /** Correlation types */
    readonly correlationTypes: readonly BizTalkCorrelationType[];

    /** Correlation sets */
    readonly correlationSets: readonly BizTalkCorrelationSet[];

    /** Whether this orchestration is a service link */
    readonly isServiceLink: boolean;

    /** Description */
    readonly description?: string;
}

// =============================================================================
// Map Types
// =============================================================================

/**
 * BizTalk functoid types.
 */
export type BizTalkFunctoidCategory =
    | 'String'
    | 'Mathematical'
    | 'Logical'
    | 'DateTime'
    | 'Conversion'
    | 'Scientific'
    | 'Cumulative'
    | 'Database'
    | 'Advanced'
    | 'Custom'
    | 'Unknown';

/**
 * Functoid definition.
 */
export interface BizTalkFunctoid {
    /** Functoid ID (unique within map) */
    readonly id: string;

    /** Functoid type/name */
    readonly type: string;

    /** Functoid category */
    readonly category: BizTalkFunctoidCategory;

    /** X position in the map */
    readonly x: number;

    /** Y position in the map */
    readonly y: number;

    /** Functoid parameters */
    readonly parameters: readonly BizTalkFunctoidParameter[];

    /** For scripting functoid: inline script */
    readonly inlineScript?: string;

    /** For scripting functoid: script type */
    readonly scriptType?: 'CSharp' | 'JScript' | 'XSLT' | 'XPath' | 'External';

    /** For external assembly functoid */
    readonly assemblyName?: string;

    /** For external assembly functoid */
    readonly className?: string;

    /** For external assembly functoid */
    readonly methodName?: string;
}

/**
 * Functoid parameter.
 */
export interface BizTalkFunctoidParameter {
    /** Parameter index */
    readonly index: number;

    /** Parameter value (constant or link reference) */
    readonly value: string;

    /** Whether this is a link to another functoid/node */
    readonly isLink: boolean;
}

/**
 * Map link definition.
 */
export interface BizTalkMapLink {
    /** Source XPath (for source schema nodes) */
    readonly sourceXPath?: string;

    /** Source functoid ID */
    readonly sourceFunctoidId?: string;

    /** Target XPath (for target schema nodes) */
    readonly targetXPath?: string;

    /** Target functoid ID */
    readonly targetFunctoidId?: string;
}

/**
 * Complete map information.
 */
export interface BizTalkMapInfo {
    /** Map name */
    readonly name: string;

    /** File path */
    readonly filePath: string;

    /** Source schema reference */
    readonly sourceSchema: string;

    /** Target schema reference */
    readonly targetSchema: string;

    /** Functoids used */
    readonly functoids: readonly BizTalkFunctoid[];

    /** Links between nodes and functoids */
    readonly links: readonly BizTalkMapLink[];

    /** Embedded XSLT (if available) */
    readonly embeddedXslt?: string;

    /** Custom extension objects */
    readonly extensionObjects?: readonly string[];

    /** Map version */
    readonly version?: string;
}

// =============================================================================
// Pipeline Types
// =============================================================================

/**
 * Pipeline type.
 */
export type BizTalkPipelineType = 'receive' | 'send';

/**
 * Pipeline stage name.
 */
export type BizTalkPipelineStage =
    // Receive stages
    | 'Decode'
    | 'Disassemble'
    | 'Validate'
    | 'ResolveParty'
    // Send stages
    | 'PreAssemble'
    | 'Assemble'
    | 'Encode';

/**
 * Pipeline component configuration.
 */
export interface BizTalkPipelineComponent {
    /** Component name */
    readonly name: string;

    /** Component type (fully qualified) */
    readonly typeName: string;

    /** Whether this is a custom component */
    readonly isCustom: boolean;

    /** Configuration properties */
    readonly properties: Record<string, unknown>;
}

/**
 * Pipeline stage configuration.
 */
export interface BizTalkPipelineStageInfo {
    /** Stage name */
    readonly name: BizTalkPipelineStage;

    /** Components in this stage */
    readonly components: readonly BizTalkPipelineComponent[];
}

/**
 * Complete pipeline information.
 */
export interface BizTalkPipelineInfo {
    /** Pipeline name */
    readonly name: string;

    /** File path */
    readonly filePath: string;

    /** Pipeline type */
    readonly type: BizTalkPipelineType;

    /** Stages and their components */
    readonly stages: readonly BizTalkPipelineStageInfo[];

    /** Description */
    readonly description?: string;
}

// =============================================================================
// Schema Types
// =============================================================================

/**
 * BizTalk schema type.
 */
export type BizTalkSchemaType = 'document' | 'property' | 'envelope' | 'flatFile';

/**
 * Promoted property.
 */
export interface BizTalkPromotedProperty {
    /** Property name */
    readonly name: string;

    /** Property namespace */
    readonly namespace: string;

    /** XPath to the promoted element */
    readonly xpath: string;

    /** Property type */
    readonly type: string;
}

/**
 * Distinguished field.
 */
export interface BizTalkDistinguishedField {
    /** Field name */
    readonly name: string;

    /** XPath to the field */
    readonly xpath: string;
}

/**
 * Flat file annotation.
 */
export interface BizTalkFlatFileAnnotation {
    /** Record type */
    readonly recordType: 'positional' | 'delimited' | 'mixed';

    /** Delimiter (for delimited) */
    readonly delimiter?: string;

    /** Positions (for positional) */
    readonly positions?: readonly number[];

    /** Wrap character */
    readonly wrapChar?: string;

    /** Escape character */
    readonly escapeChar?: string;

    /** Tag identifier */
    readonly tagIdentifier?: string;
}

/**
 * Complete schema information.
 */
export interface BizTalkSchemaInfo {
    /** Schema name */
    readonly name: string;

    /** File path */
    readonly filePath: string;

    /** Target namespace */
    readonly targetNamespace: string;

    /** Root element name */
    readonly rootElement: string;

    /** Schema type */
    readonly schemaType: BizTalkSchemaType;

    /** Promoted properties */
    readonly promotedProperties: readonly BizTalkPromotedProperty[];

    /** Distinguished fields */
    readonly distinguishedFields: readonly BizTalkDistinguishedField[];

    /** Flat file annotations (if flat file schema) */
    readonly flatFileAnnotations?: BizTalkFlatFileAnnotation;

    /** Imported schemas */
    readonly imports: readonly string[];

    /** Included schemas */
    readonly includes: readonly string[];
}

// =============================================================================
// Binding Types
// =============================================================================

/**
 * BizTalk adapter type.
 */
export type BizTalkAdapterType =
    | 'FILE'
    | 'HTTP'
    | 'SOAP'
    | 'SQL'
    | 'FTP'
    | 'SFTP'
    | 'MSMQ'
    | 'MQSeries'
    | 'WCF-BasicHttp'
    | 'WCF-WSHttp'
    | 'WCF-NetTcp'
    | 'WCF-Custom'
    | 'WCF-CustomIsolated'
    | 'WCF-SQL'
    | 'WCF-SAP'
    | 'WCF-OracleDB'
    | 'WCF-Siebel'
    | 'SB-Messaging'
    | 'SharePoint'
    | 'POP3'
    | 'SMTP'
    | 'Office365'
    | 'Custom'
    | 'Unknown';

/**
 * Receive location configuration.
 */
export interface BizTalkReceiveLocation {
    /** Location name */
    readonly name: string;

    /** Receive port name */
    readonly receivePortName: string;

    /** Transport type/adapter */
    readonly transportType: BizTalkAdapterType;

    /** Address/URI */
    readonly address: string;

    /** Pipeline name */
    readonly receivePipeline: string;

    /** Send pipeline (for two-way) */
    readonly sendPipeline?: string;

    /** Whether enabled */
    readonly enabled: boolean;

    /** Transport configuration */
    readonly transportConfig: Record<string, unknown>;

    /** Schedule */
    readonly schedule?: BizTalkSchedule;
}

/**
 * Receive port configuration.
 */
export interface BizTalkReceivePort {
    /** Port name */
    readonly name: string;

    /** Whether two-way */
    readonly isTwoWay: boolean;

    /** Authentication type */
    readonly authentication: 'none' | 'drop' | 'require';

    /** Whether failed messages are routed as error reports instead of suspended */
    readonly routeFailedMessage: boolean;

    /** Receive locations */
    readonly locations: readonly BizTalkReceiveLocation[];

    /** Inbound maps */
    readonly inboundMaps: readonly string[];

    /** Outbound maps (for two-way) */
    readonly outboundMaps: readonly string[];

    /** Tracking settings */
    readonly tracking?: BizTalkTrackingSettings;
}

/**
 * Send port configuration.
 */
export interface BizTalkSendPort {
    /** Port name */
    readonly name: string;

    /** Whether two-way */
    readonly isTwoWay: boolean;

    /** Whether dynamic */
    readonly isDynamic: boolean;

    /** Transport type/adapter */
    readonly transportType: BizTalkAdapterType;

    /** Primary address */
    readonly address: string;

    /** Send pipeline */
    readonly sendPipeline: string;

    /** Receive pipeline (for two-way) */
    readonly receivePipeline?: string;

    /** Filter expression */
    readonly filter?: string;

    /** Transport configuration */
    readonly transportConfig: Record<string, unknown>;

    /** Inbound maps */
    readonly inboundMaps: readonly string[];

    /** Outbound maps */
    readonly outboundMaps: readonly string[];

    /** Backup transport */
    readonly backupTransport?: {
        readonly transportType: BizTalkAdapterType;
        readonly address: string;
        readonly transportConfig: Record<string, unknown>;
    };

    /** Encryption certificate */
    readonly encryptionCert?: string;

    /** Tracking settings */
    readonly tracking?: BizTalkTrackingSettings;
}

/**
 * Send port group.
 */
export interface BizTalkSendPortGroup {
    /** Group name */
    readonly name: string;

    /** Send ports in the group */
    readonly sendPorts: readonly string[];

    /** Filter expression */
    readonly filter?: string;
}

/**
 * Schedule configuration.
 */
export interface BizTalkSchedule {
    /** Time zone */
    readonly timeZone?: string;

    /** Start time */
    readonly startTime?: string;

    /** End time */
    readonly endTime?: string;

    /** Service window enabled */
    readonly serviceWindowEnabled: boolean;
}

/**
 * Tracking settings.
 */
export interface BizTalkTrackingSettings {
    /** Track message bodies before processing */
    readonly trackMessageBodiesBefore: boolean;

    /** Track message bodies after processing */
    readonly trackMessageBodiesAfter: boolean;

    /** Track message properties */
    readonly trackMessageProperties: boolean;
}

/**
 * Orchestration binding.
 */
export interface BizTalkOrchestrationBinding {
    /** Orchestration name */
    readonly orchestrationName: string;

    /** Assembly name */
    readonly assemblyName: string;

    /** Host name */
    readonly hostName: string;

    /** Port bindings */
    readonly portBindings: readonly BizTalkPortBinding[];
}

/**
 * Port binding.
 */
export interface BizTalkPortBinding {
    /** Port name (in orchestration) */
    readonly portName: string;

    /** Bound receive port or send port */
    readonly boundTo?: string;

    /** Whether bound to a send port group */
    readonly isSendPortGroup: boolean;

    /** Binding option (1 = activation receive, 0 = follow correlation) */
    readonly bindingOption?: number;
}

/**
 * Complete binding information.
 */
export interface BizTalkBindingInfo {
    /** Application name */
    readonly applicationName: string;

    /** File path */
    readonly filePath: string;

    /** Receive ports */
    readonly receivePorts: readonly BizTalkReceivePort[];

    /** Send ports */
    readonly sendPorts: readonly BizTalkSendPort[];

    /** Send port groups */
    readonly sendPortGroups: readonly BizTalkSendPortGroup[];

    /** Orchestration bindings */
    readonly orchestrationBindings: readonly BizTalkOrchestrationBinding[];
}
