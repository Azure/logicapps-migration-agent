/**
 * IR Advanced Types
 *
 * Type definitions for advanced IR components:
 * - Variables
 * - Gaps
 * - Error Handling
 * - Correlation
 * - Message Processing
 * - Endpoints
 * - Observability
 * - Dependencies
 *
 * @module ir/types/advanced
 */

import {
    ConfigRecord,
    CommunicationPattern,
    EDIProtocol,
    ErrorHandlerType,
    ErrorStrategy,
    Expression,
    FunctionRuntime,
    GapCategory,
    GapResolutionStrategy,
    GapSeverity,
    GapStatus,
    InfrastructureType,
    IntegrationAccountTier,
    ISODuration,
    JSONPointer,
    RetryPolicyType,
    RunAfterState,
    SourceMappingRecord,
    TransportType,
    VariableType,
    XPathExpression,
    JSONPathExpression,
} from './common';

// =============================================================================
// Variables
// =============================================================================

/**
 * Variable definition.
 * Represents a workflow variable for storing intermediate state.
 */
export interface IRVariable {
    /** Unique identifier */
    readonly id: string;

    /** Variable name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Data type */
    readonly type: VariableType;

    /** Default value */
    readonly defaultValue?: unknown;

    /** Variable scope */
    readonly scope?: 'workflow' | 'action';

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;
}

// =============================================================================
// Gaps
// =============================================================================

/**
 * Source feature that has a gap.
 */
export interface GapSourceFeature {
    /** Source platform */
    readonly platform: string;

    /** Feature name */
    readonly feature: string;

    /** Affected artifacts */
    readonly artifacts: readonly string[];
}

/**
 * Gap resolution effort estimate.
 */
export interface GapEffortEstimate {
    /** Estimated hours */
    readonly hours: number;

    /** Complexity level */
    readonly complexity: 'low' | 'medium' | 'high';
}

/**
 * Gap resolution definition.
 */
export interface GapResolution {
    /** Resolution strategy */
    readonly strategy: GapResolutionStrategy;

    /** Recommended pattern */
    readonly pattern?: string;

    /** Description of the resolution */
    readonly description?: string;

    /** Effort estimate */
    readonly effort?: GapEffortEstimate;

    /** Code template reference */
    readonly codeTemplate?: string;

    /** Reference documentation */
    readonly documentationUrl?: string;
}

/**
 * Migration gap definition.
 * Represents a feature that cannot be directly migrated.
 */
export interface IRGap {
    /** Unique identifier */
    readonly id: string;

    /** Gap category */
    readonly category: GapCategory;

    /** Severity level */
    readonly severity: GapSeverity;

    /** Short title */
    readonly title: string;

    /** Detailed description */
    readonly description: string;

    /** Source feature details */
    readonly sourceFeature?: GapSourceFeature;

    /** Affected IR elements (JSON pointers) */
    readonly affectedElements?: readonly JSONPointer[];

    /** Resolution information */
    resolution?: GapResolution;

    /** Current status */
    status: GapStatus;

    /** User notes */
    readonly notes?: string;

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Error handler trigger configuration.
 */
export interface ErrorHandlerTrigger {
    /** Exception types to catch */
    readonly exceptionTypes?: readonly string[];

    /** Run-after states that trigger this handler */
    readonly runAfterStates?: readonly RunAfterState[];

    /** Error code patterns to match */
    readonly errorCodes?: readonly string[];
}

/**
 * Error handler action.
 */
export interface ErrorHandlerAction {
    /** Action identifier */
    readonly id: string;

    /** Action type */
    readonly type: string;

    /** Action configuration */
    readonly config?: ConfigRecord;
}

/**
 * Error handler definition.
 */
export interface IRErrorHandler {
    /** Unique identifier */
    readonly id: string;

    /** Handler name */
    readonly name: string;

    /** Handler type */
    readonly type: ErrorHandlerType;

    /** Trigger conditions */
    readonly trigger?: ErrorHandlerTrigger;

    /** Actions to execute */
    readonly actions?: readonly ErrorHandlerAction[];

    /** Compensating actions (for compensation handlers) */
    readonly compensatingActions?: readonly ErrorHandlerAction[];

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target mapping */
    readonly targetMapping?: {
        readonly pattern: string;
        readonly gap: boolean;
        readonly resolution?: string;
    };
}

/**
 * Retry policy definition.
 */
export interface IRRetryPolicy {
    /** Unique identifier */
    readonly id: string;

    /** Policy name */
    readonly name: string;

    /** Retry type */
    readonly type: RetryPolicyType;

    /** Retry count */
    readonly count?: number;

    /** Retry interval */
    readonly interval?: ISODuration;

    /** Maximum interval (for exponential) */
    readonly maximumInterval?: ISODuration;

    /** Minimum interval (for exponential) */
    readonly minimumInterval?: ISODuration;

    /** Actions this policy applies to */
    readonly appliesTo?: readonly JSONPointer[];
}

/**
 * Global error handling configuration.
 */
export interface IRErrorHandlingConfig {
    /** Global error handling settings */
    readonly global?: {
        readonly enabled: boolean;
        readonly defaultStrategy: ErrorStrategy;
        readonly actions?: readonly JSONPointer[];
    };

    /** Error handlers */
    readonly handlers: readonly IRErrorHandler[];

    /** Retry policies */
    readonly retryPolicies?: readonly IRRetryPolicy[];
}

// =============================================================================
// Correlation
// =============================================================================

/**
 * Correlation property definition.
 */
export interface CorrelationProperty {
    /** Property name */
    readonly name: string;

    /** Property type */
    readonly type: 'string' | 'number' | 'guid';

    /** Expression to extract value */
    readonly expression: XPathExpression | JSONPathExpression | Expression;

    /** Expression type */
    readonly expressionType: 'xpath' | 'jsonpath' | 'expression';
}

/**
 * Correlation pattern types.
 */
export type CorrelationPattern =
    | 'request-response'
    | 'publish-subscribe'
    | 'sequential-convoy'
    | 'parallel-convoy'
    | 'aggregator'
    | 'custom';

/**
 * Correlation set definition.
 */
export interface IRCorrelationSet {
    /** Unique identifier */
    readonly id: string;

    /** Set name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Correlation properties */
    readonly properties: readonly CorrelationProperty[];

    /** Actions that initialize this correlation */
    readonly initializingActions: readonly JSONPointer[];

    /** Actions that follow this correlation */
    readonly followingActions: readonly JSONPointer[];

    /** Correlation pattern */
    readonly pattern: CorrelationPattern;

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target mapping */
    readonly targetMapping?: {
        readonly strategy: 'callback-url' | 'durable-functions' | 'polling' | 'event-subscription';
        readonly gap: boolean;
        readonly resolution?: {
            readonly pattern: string;
            readonly effort: 'low' | 'medium' | 'high';
        };
    };
}

/**
 * Correlation configuration.
 */
export interface IRCorrelationConfig {
    /** Correlation sets */
    readonly sets: readonly IRCorrelationSet[];
}

// =============================================================================
// Message Processing (Pipelines)
// =============================================================================

/**
 * Message processing stage type.
 */
export type ProcessingStageType =
    | 'decode'
    | 'disassemble'
    | 'validate'
    | 'resolve-party'
    | 'assemble'
    | 'encode'
    | 'custom';

/**
 * Message processing stage.
 */
export interface ProcessingStage {
    /** Stage order */
    readonly order: number;

    /** Stage name */
    readonly name: ProcessingStageType | string;

    /** Stage type */
    readonly type: string;

    /** Whether stage is enabled */
    readonly enabled: boolean;

    /** Stage configuration */
    readonly config?: ConfigRecord;

    /** Target mapping */
    readonly targetMapping?: {
        readonly action?: string;
        readonly gap: boolean;
        readonly resolution?: string;
    };
}

/**
 * Inbound/outbound message processing.
 */
export interface IRMessageProcessor {
    /** Unique identifier */
    readonly id: string;

    /** Processor name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Processing stages */
    readonly stages: readonly ProcessingStage[];

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;
}

/**
 * Message processing configuration.
 */
export interface IRMessageProcessingConfig {
    /** Inbound processors */
    readonly inbound?: readonly IRMessageProcessor[];

    /** Outbound processors */
    readonly outbound?: readonly IRMessageProcessor[];
}

// =============================================================================
// Endpoints (Ports)
// =============================================================================

/**
 * Endpoint filter.
 */
export interface EndpointFilter {
    /** Property to filter on */
    readonly property: string;

    /** Filter operator */
    readonly operator: 'equals' | 'not-equals' | 'contains' | 'starts-with' | 'ends-with' | 'regex';

    /** Filter value */
    readonly value: string | number | boolean;
}

/**
 * Receive endpoint definition.
 */
export interface IRReceiveEndpoint {
    /** Unique identifier */
    readonly id: string;

    /** Endpoint name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Transport type */
    readonly transport: TransportType;

    /** Direction */
    readonly direction: 'receive';

    /** Communication pattern */
    readonly pattern: CommunicationPattern;

    /** Endpoint configuration */
    readonly config?: ConfigRecord;

    /** Message processing reference */
    readonly messageProcessingRef?: JSONPointer;

    /** Filters */
    readonly filters?: readonly EndpointFilter[];

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target mapping (trigger reference) */
    readonly targetMapping?: {
        readonly triggerRef: JSONPointer;
    };
}

/**
 * Send endpoint binding type.
 */
export type EndpointBindingType = 'static' | 'dynamic';

/**
 * Send endpoint definition.
 */
export interface IRSendEndpoint {
    /** Unique identifier */
    readonly id: string;

    /** Endpoint name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Transport type */
    readonly transport: TransportType;

    /** Direction */
    readonly direction: 'send';

    /** Communication pattern */
    readonly pattern: CommunicationPattern;

    /** Binding type */
    readonly binding?: EndpointBindingType;

    /** Endpoint configuration */
    readonly config?: ConfigRecord;

    /** Connection reference */
    readonly connectionRef?: JSONPointer;

    /** Message processing reference */
    readonly messageProcessingRef?: JSONPointer;

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target mapping (action reference) */
    readonly targetMapping?: {
        readonly actionRef?: JSONPointer;
        readonly pattern?: string;
    };
}

/**
 * Send endpoint group (for fan-out scenarios).
 */
export interface IRSendEndpointGroup {
    /** Unique identifier */
    readonly id: string;

    /** Group name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Group type */
    readonly type: 'group';

    /** Member endpoint IDs */
    readonly members: readonly string[];

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target mapping */
    readonly targetMapping?: {
        readonly pattern: 'parallel-actions';
        readonly actionRef: JSONPointer;
    };
}

/**
 * Endpoints configuration.
 */
export interface IREndpointsConfig {
    /** Receive endpoints */
    readonly receive?: readonly IRReceiveEndpoint[];

    /** Send endpoints */
    readonly send?: readonly (IRSendEndpoint | IRSendEndpointGroup)[];
}

// =============================================================================
// Observability (Tracking/BAM)
// =============================================================================

/**
 * Tracking milestone.
 */
export interface TrackingMilestone {
    /** Milestone name */
    readonly name: string;

    /** Action reference */
    readonly actionRef: JSONPointer;
}

/**
 * Tracking data item.
 */
export interface TrackingDataItem {
    /** Data item name */
    readonly name: string;

    /** Data type */
    readonly type: 'string' | 'number' | 'decimal' | 'datetime' | 'boolean';

    /** Expression to extract value */
    readonly expression: Expression;
}

/**
 * Tracking activity.
 */
export interface TrackingActivity {
    /** Activity name */
    readonly name: string;

    /** Milestones */
    readonly milestones: readonly TrackingMilestone[];

    /** Data items */
    readonly data: readonly TrackingDataItem[];
}

/**
 * Observability configuration.
 */
export interface IRObservabilityConfig {
    /** Tracking configuration */
    readonly tracking?: {
        readonly enabled: boolean;
        readonly activities?: readonly TrackingActivity[];
        readonly sourceMapping?: SourceMappingRecord;
        readonly targetMapping?: {
            readonly pattern: string;
            readonly trackedProperties?: readonly string[];
            readonly logAnalyticsWorkspace?: string;
            readonly gap: boolean;
            readonly gapReason?: string;
        };
    };
}

// =============================================================================
// B2B/EDI
// =============================================================================

/**
 * Trading partner identifier.
 */
export interface PartnerIdentifier {
    /** Qualifier code */
    readonly qualifier: string;

    /** Identifier value */
    readonly value: string;
}

/**
 * Trading partner contact.
 */
export interface PartnerContact {
    /** Contact name */
    readonly name: string;

    /** Email address */
    readonly email?: string;

    /** Phone number */
    readonly phone?: string;
}

/**
 * Trading partner definition.
 */
export interface IRTradingPartner {
    /** Unique identifier */
    readonly id: string;

    /** Partner name */
    readonly name: string;

    /** Partner identifier */
    readonly identifier: PartnerIdentifier;

    /** Contacts */
    readonly contacts?: readonly PartnerContact[];
}

/**
 * Trading agreement security configuration.
 */
export interface AgreementSecurity {
    /** Encryption settings */
    readonly encryption?: {
        readonly enabled: boolean;
        readonly algorithm?: string;
    };

    /** Signing settings */
    readonly signing?: {
        readonly enabled: boolean;
        readonly certificateRef?: JSONPointer;
    };
}

/**
 * Trading agreement definition.
 */
export interface IRTradingAgreement {
    /** Unique identifier */
    readonly id: string;

    /** Agreement name */
    readonly name: string;

    /** EDI protocol */
    readonly protocol: EDIProtocol;

    /** Host partner ID */
    readonly hostPartner: string;

    /** Guest partner ID */
    readonly guestPartner: string;

    /** Protocol-specific settings */
    readonly protocolSettings?: ConfigRecord;

    /** Security settings */
    readonly security?: AgreementSecurity;
}

/**
 * B2B/EDI configuration.
 */
export interface IRB2BConfig {
    /** Whether B2B is enabled */
    readonly enabled: boolean;

    /** Trading partners */
    readonly partners?: readonly IRTradingPartner[];

    /** Trading agreements */
    readonly agreements?: readonly IRTradingAgreement[];

    /** Target mapping */
    readonly targetMapping?: {
        readonly destination: 'integration-account';
        readonly gap: boolean;
    };
}

// =============================================================================
// Dependencies
// =============================================================================

/**
 * Custom code component.
 */
export interface CustomCodeComponent {
    /** Class name */
    readonly class: string;

    /** Methods */
    readonly methods?: readonly {
        readonly name: string;
        readonly signature?: string;
    }[];
}

/**
 * Custom code dependency.
 */
export interface IRCustomCodeDependency {
    /** Unique identifier */
    readonly id: string;

    /** Dependency name */
    readonly name: string;

    /** Dependency type */
    readonly type: 'assembly' | 'script' | 'module';

    /** Programming language */
    readonly language: 'csharp' | 'java' | 'javascript' | 'python';

    /** Version */
    readonly version?: string;

    /** Components in this dependency */
    readonly components?: readonly CustomCodeComponent[];

    /** Elements that use this dependency */
    readonly usedBy?: readonly JSONPointer[];

    /** Target mapping */
    readonly targetMapping?: {
        readonly destination: 'azure-function';
        readonly functionName?: string;
        readonly runtime?: FunctionRuntime;
        readonly scaffoldGenerated?: boolean;
    };
}

/**
 * Certificate dependency.
 */
export interface IRCertificateDependency {
    /** Unique identifier */
    readonly id: string;

    /** Certificate name */
    readonly name: string;

    /** Certificate type */
    readonly type: 'x509';

    /** Usage */
    readonly usage: 'signing' | 'encryption' | 'tls';

    /** Thumbprint */
    readonly thumbprint?: string;

    /** Expiry date */
    readonly expiryDate?: string;

    /** Target mapping */
    readonly targetMapping?: {
        readonly destination: 'integration-account' | 'key-vault';
    };
}

/**
 * Infrastructure dependency.
 */
export interface IRInfrastructureDependency {
    /** Infrastructure type */
    readonly type: InfrastructureType;

    /** Whether required */
    readonly required: boolean;

    /** Reason for requirement */
    readonly reason: string;

    /** Tier/SKU (if applicable) */
    readonly tier?: IntegrationAccountTier | string;

    /** Runtime (for Function App) */
    readonly runtime?: FunctionRuntime;
}

/**
 * Dependencies configuration.
 */
export interface IRDependenciesConfig {
    /** Custom code dependencies */
    readonly customCode?: readonly IRCustomCodeDependency[];

    /** Certificate dependencies */
    readonly certificates?: readonly IRCertificateDependency[];

    /** Infrastructure dependencies */
    readonly infrastructure?: readonly IRInfrastructureDependency[];
}

// =============================================================================
// Platform Extensions
// =============================================================================

/**
 * BizTalk-specific extensions.
 */
export interface BizTalkExtensions {
    /** Host names */
    readonly hosts?: readonly string[];

    /** MessageBox database */
    readonly messagebox?: string;

    /** Tracking database */
    readonly trackingDatabase?: string;

    /** SSO applications */
    readonly ssoApplications?: readonly string[];

    /** Additional properties */
    readonly [key: string]: unknown;
}

/**
 * MuleSoft-specific extensions.
 */
export interface MuleSoftExtensions {
    /** CloudHub deployment config */
    readonly cloudHubDeployment?: {
        readonly workers?: number;
        readonly workerSize?: string;
        readonly region?: string;
    };

    /** API Manager config */
    readonly apiManager?: {
        readonly apiId?: string;
        readonly policies?: readonly string[];
    };

    /** Additional properties */
    readonly [key: string]: unknown;
}

/**
 * Platform-specific extensions.
 */
export interface IRExtensions {
    /** BizTalk extensions */
    readonly biztalk?: BizTalkExtensions;

    /** MuleSoft extensions */
    readonly mulesoft?: MuleSoftExtensions;

    /** Other platform extensions */
    readonly [platform: string]: ConfigRecord | undefined;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new variable.
 */
export function createVariable(
    id: string,
    name: string,
    type: VariableType,
    defaultValue?: unknown
): IRVariable {
    return {
        id,
        name,
        type,
        defaultValue,
    };
}

/**
 * Creates a new gap.
 */
export function createGap(
    id: string,
    category: GapCategory,
    severity: GapSeverity,
    title: string,
    description: string
): IRGap {
    return {
        id,
        category,
        severity,
        title,
        description,
        status: 'pending',
    };
}
