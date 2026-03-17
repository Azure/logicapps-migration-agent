/**
 * IR Types Module
 *
 * Central export point for all IR type definitions.
 * Import from this module to access all IR types.
 *
 * @module ir/types
 *
 * @example
 * ```typescript
 * import { IRDocument, IRTrigger, IRAction, createEmptyIRDocument } from '../ir/types';
 * ```
 */

// =============================================================================
// Common Types
// =============================================================================

export {
    // Platform types
    SourcePlatformType,
    TargetPlatformType,

    // Status types
    MigrationStatus,
    ComplexityLevel,
    ConfidenceLevel,

    // Artifact types
    ArtifactType,
    SourceFileType,
    WorkflowType,

    // Gap types
    GapSeverity,
    GapCategory,
    GapResolutionStrategy,
    GapStatus,

    // Override types
    OverrideSource,

    // Transport types
    TransportType,
    CommunicationPattern,

    // Data types
    SchemaType,
    MapType,
    VariableType,

    // Auth types
    AuthenticationType,
    CredentialStorageType,

    // Error handling types
    ErrorHandlerType,
    ErrorStrategy,
    RetryPolicyType,
    RunAfterState,

    // B2B types
    EDIProtocol,

    // Infrastructure types
    InfrastructureType,
    IntegrationAccountTier,
    FunctionRuntime,

    // Utility types
    ConfigRecord,
    SourceMappingRecord,
    ISODuration,
    ISOTimestamp,
    JSONPointer,
    Expression,
    XPathExpression,
    JSONPathExpression,
} from './common';

// =============================================================================
// Metadata Types
// =============================================================================

export {
    SourceArtifact,
    SourceEnvironment,
    SourceMetadata,
    TargetMetadata,
    ComplexityFactor,
    EffortEstimate,
    MigrationMetadata,
    IROverride,
    IRMetadata,
    // Factory functions
    createSourceArtifact,
    createSourceMetadata,
    createTargetMetadata,
    createMigrationMetadata,
    createOverride,
} from './metadata';

// =============================================================================
// Trigger Types
// =============================================================================

export {
    // Type discriminators
    TriggerType,
    TriggerCategory,

    // Configuration types
    TriggerOutputSchema,
    TriggerOutputs,
    TriggerTargetMapping,
    HttpAuthenticationConfig,
    HttpTriggerConfig,
    ServiceBusTriggerConfig,
    StorageQueueTriggerConfig,
    StorageBlobTriggerConfig,
    TimerTriggerConfig,
    FileTriggerConfig,
    FtpTriggerConfig,
    EventGridTriggerConfig,
    EventHubTriggerConfig,
    KafkaTriggerConfig,
    DatabaseTriggerConfig,
    EmailTriggerConfig,
    CustomTriggerConfig,
    TriggerConfig,

    // Base interface
    IRTriggerBase,

    // Discriminated types
    HttpTrigger,
    ServiceBusTrigger,
    StorageQueueTrigger,
    StorageBlobTrigger,
    TimerTrigger,
    FileTrigger,
    FtpTrigger,
    SftpTrigger,
    EventGridTrigger,
    EventHubTrigger,
    KafkaTrigger,
    DatabaseTrigger,
    EmailTrigger,
    ManualTrigger,
    CustomTrigger,

    // Union type
    IRTrigger,

    // Type guards
    isHttpTrigger,
    isServiceBusTrigger,
    isTimerTrigger,
    isFileTrigger,
    isEventTrigger,
    isPollingTrigger,
} from './triggers';

// =============================================================================
// Action Types
// =============================================================================

export {
    // Type discriminators
    ActionType,
    ActionCategory,

    // Configuration types
    RunAfterConfig,
    ActionRetryPolicy,
    ActionInputs,
    ActionOutputs,
    ActionTargetMapping,
    ActionErrorHandling,
    ConditionExpression,
    ActionBranch,
    SwitchCase,

    // Base interface
    IRActionBase,

    // Action config types
    TransformActionConfig,
    ComposeActionConfig,
    ParseActionConfig,
    ValidateActionConfig,
    SetVariableActionConfig,
    AppendVariableActionConfig,
    IncrementVariableActionConfig,
    ConditionActionConfig,
    SwitchActionConfig,
    ForEachActionConfig,
    UntilActionConfig,
    ParallelActionConfig,
    ScopeActionConfig,
    HttpCallActionConfig,
    HttpResponseActionConfig,
    DatabaseQueryActionConfig,
    DatabaseExecuteActionConfig,
    QueueSendActionConfig,
    CallWorkflowActionConfig,
    TerminateActionConfig,
    DelayActionConfig,
    DelayUntilActionConfig,
    AzureFunctionActionConfig,
    CustomActionConfig,

    // Discriminated types
    TransformAction,
    ComposeAction,
    ParseAction,
    ValidateAction,
    SetVariableAction,
    AppendVariableAction,
    IncrementVariableAction,
    ConditionAction,
    SwitchAction,
    ForEachAction,
    UntilAction,
    ParallelAction,
    ScopeAction,
    HttpCallAction,
    HttpResponseAction,
    DatabaseQueryAction,
    DatabaseExecuteAction,
    QueueSendAction,
    CallWorkflowAction,
    TerminateAction,
    DelayAction,
    DelayUntilAction,
    AzureFunctionAction,
    CustomAction,

    // Union type
    IRAction,

    // Type guards
    isTransformAction,
    isConditionAction,
    isSwitchAction,
    isForEachAction,
    isParallelAction,
    isScopeAction,
    isControlFlowAction,
    isIntegrationAction,
    hasNestedActions,
} from './actions';

// =============================================================================
// Connection Types
// =============================================================================

export {
    // Type discriminators
    ConnectionType,
    ConnectionCategory,

    // Configuration types
    GatewayConfig,
    CredentialConfig,
    ConnectionAuthConfig,
    ConnectionTargetMapping,
    SqlServerConnectionConfig,
    OracleConnectionConfig,
    CosmosDbConnectionConfig,
    SapConnectionConfig,
    ServiceBusConnectionConfig,
    EventHubConnectionConfig,
    StorageConnectionConfig,
    FtpConnectionConfig,
    HttpConnectionConfig,
    SmtpConnectionConfig,
    CustomConnectionConfig,
    ConnectionConfig,

    // Main interface
    IRConnection,

    // Type guards
    isDatabaseConnection,
    isMessagingConnection,
    requiresGateway,
    isSqlServerConnection,
    isSapConnection,
    isServiceBusConnection,

    // Factory functions
    createConnection,
} from './connections';

// =============================================================================
// Schema and Map Types
// =============================================================================

export {
    // Schema types
    SchemaFormat,
    FlatFileConfig,
    SchemaTargetMapping,
    IRSchema,

    // Map types
    MapFunction,
    MapParameter,
    MapEndpoint,
    MapTargetMapping,
    IRMap,

    // Type guards
    isXmlSchema,
    isJsonSchema,
    isFlatFileSchema,
    isXsltMap,
    isLiquidMap,
    isDataWeaveMap,
    hasNonConvertibleFunctions,
    getNonConvertibleFunctions,

    // Factory functions
    createSchema,
    createMap,
} from './schemas';

// =============================================================================
// Advanced Types
// =============================================================================

export {
    // Variables
    IRVariable,

    // Gaps
    GapSourceFeature,
    GapEffortEstimate,
    GapResolution,
    IRGap,

    // Error handling
    ErrorHandlerTrigger,
    ErrorHandlerAction,
    IRErrorHandler,
    IRRetryPolicy,
    IRErrorHandlingConfig,

    // Correlation
    CorrelationProperty,
    CorrelationPattern,
    IRCorrelationSet,
    IRCorrelationConfig,

    // Message processing
    ProcessingStageType,
    ProcessingStage,
    IRMessageProcessor,
    IRMessageProcessingConfig,

    // Endpoints
    EndpointFilter,
    IRReceiveEndpoint,
    EndpointBindingType,
    IRSendEndpoint,
    IRSendEndpointGroup,
    IREndpointsConfig,

    // Observability
    TrackingMilestone,
    TrackingDataItem,
    TrackingActivity,
    IRObservabilityConfig,

    // B2B
    PartnerIdentifier,
    PartnerContact,
    IRTradingPartner,
    AgreementSecurity,
    IRTradingAgreement,
    IRB2BConfig,

    // Dependencies
    CustomCodeComponent,
    IRCustomCodeDependency,
    IRCertificateDependency,
    IRInfrastructureDependency,
    IRDependenciesConfig,

    // Extensions
    BizTalkExtensions,
    MuleSoftExtensions,
    IRExtensions,

    // Factory functions
    createVariable,
    createGap,
} from './advanced';

// =============================================================================
// Document Types
// =============================================================================

export {
    // Constants
    IR_SCHEMA_ID,
    IR_VERSION,

    // Workflow config
    WorkflowConcurrency,
    WorkflowRetryPolicy,
    WorkflowOperationOptions,
    WorkflowCorrelation,
    IRWorkflowConfig,

    // Document
    IRDocument,

    // Factory functions
    createEmptyIRDocument,
    cloneIRDocument,

    // Type guards
    isIRDocument,
    isCurrentVersion,
} from './document';
