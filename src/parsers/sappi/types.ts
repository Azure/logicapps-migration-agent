/**
 * SAP PI/PO Parser Types
 *
 * Type definitions specific to SAP PI/PO integration platform.
 *
 * @module parsers/sappi/types
 */

/**
 * SAP PI/PO Integration Process information
 */
export interface SAPPIPOIntegrationProcess {
    id: string;
    name: string;
    description?: string;
    steps: IntegrationProcessStep[];
    sender?: string;
    receiver?: string;
    messageTypes?: string[];
    sourceFile?: string;
}

/**
 * A step in an integration process
 */
export interface IntegrationProcessStep {
    id: string;
    name: string;
    type:
        | 'receive'
        | 'send'
        | 'fork'
        | 'join'
        | 'switch'
        | 'transform'
        | 'delay'
        | 'alert'
        | 'block'
        | 'call';
    properties: Record<string, unknown>;
    inputs?: string[];
    outputs?: string[];
}

/**
 * SAP PI/PO Message Mapping
 */
export interface SAPPIPOMessageMapping {
    id: string;
    name: string;
    sourceMessage: string;
    targetMessage: string;
    mappingRules: MappingRule[];
    description?: string;
    sourceFile?: string;
}

/**
 * A mapping rule from source to target
 */
export interface MappingRule {
    sourcePath: string;
    targetPath: string;
    transformationType: 'direct' | 'function' | 'script' | 'aggregate';
    functionName?: string;
    scriptContent?: string;
    constants?: Record<string, unknown>;
}

/**
 * SAP PI/PO Communication Channel
 */
export interface SAPPIPOCommunicationChannel {
    id: string;
    name: string;
    type: 'sender' | 'receiver';
    protocol: string; // HTTP, JDBC, File, SOAP, JMS, etc.
    adapter: string; // Adapter name
    properties: Record<string, unknown>;
    sourceFile?: string;
}

/**
 * SAP PI/PO Receiver Agreement
 */
export interface SAPPIPOReceiverAgreement {
    id: string;
    name: string;
    senderComponent: string;
    receiverComponent: string;
    interfaceName: string;
    mappingId?: string;
    receiverChannelId: string;
    sourceFile?: string;
}

/**
 * SAP PI/PO Sender Agreement
 */
export interface SAPPIPOSenderAgreement {
    id: string;
    name: string;
    senderComponent: string;
    interfaceName: string;
    senderChannelId: string;
    receiverAgreements: string[]; // IDs of receiver agreements
    sourceFile?: string;
}

/**
 * SAP PI/PO Message Type
 */
export interface SAPPIPOMessageType {
    id: string;
    name: string;
    namespace: string;
    structure: SchemaElement[];
    description?: string;
    sourceFile?: string;
}

/**
 * Schema element for message structure
 */
export interface SchemaElement {
    name: string;
    type: string; // string, int, boolean, complex, etc.
    required: boolean;
    children?: SchemaElement[];
    maxOccurs?: number;
}

/**
 * SAP PI/PO Adapter Configuration
 */
export interface SAPPIPOAdapter {
    id: string;
    name: string;
    type: string; // HTTP, JDBC, File, etc.
    metadata?: Record<string, unknown>;
    sourceFile?: string;
}

/**
 * Complete SAP PI/PO Project metadata
 */
export interface SAPPIPOProjectMetadata {
    name: string;
    version?: string;
    description?: string;
    createdDate?: Date;
    modifiedDate?: Date;
    integrationProcesses: SAPPIPOIntegrationProcess[];
    messageMappings: SAPPIPOMessageMapping[];
    messageTypes: SAPPIPOMessageType[];
    communicationChannels: SAPPIPOCommunicationChannel[];
    senderAgreements: SAPPIPOSenderAgreement[];
    receiverAgreements: SAPPIPOReceiverAgreement[];
    adapters: SAPPIPOAdapter[];
}

/**
 * SAP PI/PO export file types
 */
export enum SAPPIPOFileType {
    /**
     * Integration Repository export (contains objects and mappings)
     */
    INTEGRATION_REPOSITORY = 'ir-export',

    /**
     * Integration Directory export (contains runtime objects like channels and agreements)
     */
    INTEGRATION_DIRECTORY = 'id-export',

    /**
     * XML configuration file
     */
    XML_CONFIG = 'xml-config',

    /**
     * Individual integration process
     */
    INTEGRATION_PROCESS = 'iproc',

    /**
     * Individual message mapping
     */
    MESSAGE_MAPPING = 'msg-mapping',

    /**
     * Message type definition
     */
    MESSAGE_TYPE = 'msg-type',
}
