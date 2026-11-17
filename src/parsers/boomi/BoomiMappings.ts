/**
 * Dell Boomi → Logic Apps Standard mapping tables
 *
 * Deterministic hints used by the Boomi parsers to populate IR action,
 * trigger and connection types. Final design decisions are made by the
 * planning/conversion agents using the Boomi skills.
 *
 * @module parsers/boomi/BoomiMappings
 */

import { ActionCategory, ActionType } from '../../ir/types/actions';
import { ConnectionCategory, ConnectionType } from '../../ir/types/connections';

export interface BoomiConnectorMapping {
    readonly connectionType: ConnectionType;
    readonly connectionCategory: ConnectionCategory;
    readonly actionType: ActionType;
    readonly actionCategory: ActionCategory;
    /** Recommended Logic Apps Standard connector / action */
    readonly logicAppsAction: string;
    /** True when the connector is built-in (in-app / service provider) */
    readonly builtIn: boolean;
    /** True when there is no direct Logic Apps equivalent */
    readonly gap?: boolean;
}

const CONNECTOR_MAPPINGS: { match: RegExp; mapping: BoomiConnectorMapping }[] = [
    {
        match: /^(http|https|rest|wss|webservices?server|web ?services? ?server|apiserver)/i,
        mapping: {
            connectionType: 'http',
            connectionCategory: 'api',
            actionType: 'http-call',
            actionCategory: 'integration',
            logicAppsAction: 'HTTP (built-in)',
            builtIn: true,
        },
    },
    {
        match: /^(ws|soap|webservicessoap|wssoap)/i,
        mapping: {
            connectionType: 'soap',
            connectionCategory: 'api',
            actionType: 'http-call',
            actionCategory: 'integration',
            logicAppsAction: 'HTTP (built-in) with SOAP envelope',
            builtIn: true,
        },
    },
    {
        match: /^(database|db|jdbc|sql)/i,
        mapping: {
            connectionType: 'sql-server',
            connectionCategory: 'database',
            actionType: 'database-execute',
            actionCategory: 'integration',
            logicAppsAction: 'SQL Server (built-in service provider)',
            builtIn: true,
        },
    },
    {
        match: /^(salesforce|sfdc)/i,
        mapping: {
            connectionType: 'salesforce',
            connectionCategory: 'crm',
            actionType: 'salesforce-operation',
            actionCategory: 'integration',
            logicAppsAction: 'Salesforce (managed connector)',
            builtIn: false,
        },
    },
    {
        match: /^sftp/i,
        mapping: {
            connectionType: 'sftp',
            connectionCategory: 'file',
            actionType: 'sftp-operation',
            actionCategory: 'integration',
            logicAppsAction: 'SFTP (built-in service provider)',
            builtIn: true,
        },
    },
    {
        match: /^ftp/i,
        mapping: {
            connectionType: 'ftp',
            connectionCategory: 'file',
            actionType: 'ftp-operation',
            actionCategory: 'integration',
            logicAppsAction: 'FTP (built-in service provider)',
            builtIn: true,
        },
    },
    {
        match: /^(disk|file|localfile)/i,
        mapping: {
            connectionType: 'file-system',
            connectionCategory: 'file',
            actionType: 'file-write',
            actionCategory: 'integration',
            logicAppsAction: 'File System (built-in) or Azure Blob Storage',
            builtIn: true,
        },
    },
    {
        match: /^(objectstorage|object ?storage|blob|azureblob|amazons3|s3|storage)/i,
        mapping: {
            connectionType: 'storage-blob',
            connectionCategory: 'storage',
            actionType: 'file-write',
            actionCategory: 'integration',
            logicAppsAction: 'Azure Blob Storage (built-in service provider)',
            builtIn: true,
        },
    },
    {
        match: /^(mail|email|smtp)/i,
        mapping: {
            connectionType: 'smtp',
            connectionCategory: 'email',
            actionType: 'email-send',
            actionCategory: 'integration',
            logicAppsAction: 'SMTP (built-in) or Office 365 Outlook',
            builtIn: true,
        },
    },
    {
        match: /^(jms|amqp|atomqueue|atom ?queue|mq|rabbit|eventstreams|event ?streams)/i,
        mapping: {
            connectionType: 'service-bus',
            connectionCategory: 'messaging',
            actionType: 'queue-send',
            actionCategory: 'integration',
            logicAppsAction: 'Azure Service Bus (built-in service provider)',
            builtIn: true,
        },
    },
    {
        match: /^kafka/i,
        mapping: {
            connectionType: 'event-hub',
            connectionCategory: 'messaging',
            actionType: 'queue-send',
            actionCategory: 'integration',
            logicAppsAction: 'Azure Event Hubs (built-in, Kafka endpoint)',
            builtIn: true,
        },
    },
    {
        match: /^sap/i,
        mapping: {
            connectionType: 'sap',
            connectionCategory: 'erp',
            actionType: 'sap-call',
            actionCategory: 'integration',
            logicAppsAction: 'SAP (built-in service provider)',
            builtIn: true,
        },
    },
    {
        match: /^(netsuite|workday|servicenow|dynamics|microsoftdynamics)/i,
        mapping: {
            connectionType: 'rest',
            connectionCategory: 'erp',
            actionType: 'http-call',
            actionCategory: 'integration',
            logicAppsAction: 'Managed connector (if available) or HTTP',
            builtIn: false,
        },
    },
    {
        match: /^(as2|x12|edifact|tradingpartner)/i,
        mapping: {
            connectionType: 'custom',
            connectionCategory: 'custom',
            actionType: 'custom',
            actionCategory: 'integration',
            logicAppsAction: 'AS2 / X12 / EDIFACT (built-in) with Integration Account',
            builtIn: true,
        },
    },
    {
        match: /^(publish|event|eventgrid|servicebus|queue|topic)/i,
        mapping: {
            connectionType: 'service-bus',
            connectionCategory: 'messaging',
            actionType: 'queue-send',
            actionCategory: 'integration',
            logicAppsAction: 'Azure Service Bus / Event Grid',
            builtIn: true,
        },
    },
];

const UNKNOWN_CONNECTOR: BoomiConnectorMapping = {
    connectionType: 'custom',
    connectionCategory: 'custom',
    actionType: 'custom',
    actionCategory: 'integration',
    logicAppsAction: 'HTTP or custom connector (requires assessment)',
    builtIn: false,
    gap: true,
};

/**
 * Map a Boomi connector type (e.g. `http`, `Database`, `Salesforce`, `sftp`) to IR / Logic Apps hints.
 */
export function mapConnector(connectorType: string | undefined): BoomiConnectorMapping {
    const type = (connectorType || '').replace(/^officialboomi-[^-]+-/i, '').trim();
    if (!type) {
        return UNKNOWN_CONNECTOR;
    }
    const found = CONNECTOR_MAPPINGS.find((m) => m.match.test(type));
    return found ? found.mapping : UNKNOWN_CONNECTOR;
}

export interface BoomiShapeMapping {
    readonly actionType: ActionType;
    readonly actionCategory: ActionCategory;
    readonly logicAppsAction: string;
    readonly gap?: boolean;
    readonly notes?: string;
}

/**
 * Map a native Boomi process shape type to IR action / Logic Apps hints.
 */
export const BOOMI_SHAPE_MAPPINGS: Record<string, BoomiShapeMapping> = {
    map: {
        actionType: 'transform',
        actionCategory: 'data',
        logicAppsAction: 'Data Mapper / Transform XML (XSLT) / Liquid',
    },
    processcall: {
        actionType: 'call-workflow',
        actionCategory: 'workflow',
        logicAppsAction: 'Workflow (call child workflow)',
    },
    processroute: {
        actionType: 'call-workflow',
        actionCategory: 'workflow',
        logicAppsAction: 'Switch + Workflow (call child workflow)',
    },
    decision: {
        actionType: 'condition',
        actionCategory: 'control-flow',
        logicAppsAction: 'Condition',
    },
    businessrules: {
        actionType: 'condition',
        actionCategory: 'control-flow',
        logicAppsAction: 'Condition / Inline Code (rules)',
    },
    branch: {
        actionType: 'parallel',
        actionCategory: 'control-flow',
        logicAppsAction: 'Parallel branches (or sequential Scopes when order matters)',
    },
    route: {
        actionType: 'switch',
        actionCategory: 'control-flow',
        logicAppsAction: 'Switch',
    },
    trycatch: {
        actionType: 'scope',
        actionCategory: 'control-flow',
        logicAppsAction: 'Scope + runAfter (Failed/TimedOut) catch Scope',
    },
    catcherrors: {
        actionType: 'scope',
        actionCategory: 'control-flow',
        logicAppsAction: 'Scope + runAfter (Failed/TimedOut) catch Scope',
    },
    flowcontrol: {
        actionType: 'foreach',
        actionCategory: 'control-flow',
        logicAppsAction: 'For each (concurrency control)',
    },
    dataprocess: {
        actionType: 'custom',
        actionCategory: 'data',
        logicAppsAction: 'Built-in data operations / Inline Code / local .NET function',
        notes: 'Data Process steps (split, combine, scripting, zip) need case-by-case redesign.',
    },
    documentproperties: {
        actionType: 'set-variable',
        actionCategory: 'utility',
        logicAppsAction: 'Initialize/Set variable or Compose',
    },
    setproperties: {
        actionType: 'set-variable',
        actionCategory: 'utility',
        logicAppsAction: 'Initialize/Set variable or Compose',
    },
    message: {
        actionType: 'compose',
        actionCategory: 'data',
        logicAppsAction: 'Compose',
    },
    notify: {
        actionType: 'compose',
        actionCategory: 'utility',
        logicAppsAction: 'Compose + tracked properties (Application Insights)',
    },
    stop: {
        actionType: 'terminate',
        actionCategory: 'utility',
        logicAppsAction: 'Terminate (Succeeded) or end of branch',
    },
    exception: {
        actionType: 'terminate',
        actionCategory: 'utility',
        logicAppsAction: 'Terminate (Failed) with error code/message',
    },
    returndocuments: {
        actionType: 'http-response',
        actionCategory: 'integration',
        logicAppsAction: 'Response (or return to parent workflow)',
    },
    cleanse: {
        actionType: 'validate',
        actionCategory: 'data',
        logicAppsAction: 'XML Validation / Parse JSON schema validation',
    },
    addtocache: {
        actionType: 'custom',
        actionCategory: 'data',
        logicAppsAction: 'Variables / Azure Cache for Redis / Table Storage',
        gap: true,
        notes: 'Boomi document cache has no direct equivalent.',
    },
    retrievefromcache: {
        actionType: 'custom',
        actionCategory: 'data',
        logicAppsAction: 'Variables / Azure Cache for Redis / Table Storage',
        gap: true,
        notes: 'Boomi document cache has no direct equivalent.',
    },
    removefromcache: {
        actionType: 'custom',
        actionCategory: 'data',
        logicAppsAction: 'Variables / Azure Cache for Redis / Table Storage',
        gap: true,
        notes: 'Boomi document cache has no direct equivalent.',
    },
    findchanges: {
        actionType: 'custom',
        actionCategory: 'data',
        logicAppsAction: 'Inline Code / local .NET function (diff)',
        gap: true,
    },
};

/** Ordered name heuristics; the first matching rule wins. */
const SHAPE_NAME_RULES: { match: RegExp; mapping: BoomiShapeMapping }[] = [
    { match: /validat|cleanse/i, mapping: BOOMI_SHAPE_MAPPINGS.cleanse },
    { match: /^(log|notify|alert|audit)|log$|notif/i, mapping: BOOMI_SHAPE_MAPPINGS.notify },
    { match: /^(map|transform|convert)/i, mapping: BOOMI_SHAPE_MAPPINGS.map },
    {
        match: /split|batch|iterate|foreach/i,
        mapping: {
            actionType: 'foreach',
            actionCategory: 'control-flow',
            logicAppsAction: 'For each (X12 Decode splits interchanges into transaction sets)',
        },
    },
    {
        match: /retry/i,
        mapping: {
            actionType: 'until',
            actionCategory: 'control-flow',
            logicAppsAction: 'Action retry policy (or Until loop for custom back-off)',
        },
    },
    {
        match: /classif|switch/i,
        mapping: { ...BOOMI_SHAPE_MAPPINGS.route },
    },
    { match: /decision|route|businessrule/i, mapping: BOOMI_SHAPE_MAPPINGS.decision },
    {
        match: /archive/i,
        mapping: {
            actionType: 'file-write',
            actionCategory: 'integration',
            logicAppsAction: 'Azure Blob Storage upload blob (archive)',
        },
    },
    {
        match: /dedup|duplicate|idempot/i,
        mapping: {
            actionType: 'condition',
            actionCategory: 'control-flow',
            logicAppsAction: 'Idempotency lookup (Table Storage / SQL) + Condition',
        },
    },
    {
        match: /controlnumber|envelope/i,
        mapping: {
            actionType: 'set-variable',
            actionCategory: 'utility',
            logicAppsAction:
                'X12 agreement envelope/control-number settings (Integration Account) used by X12 Encode',
        },
    },
    {
        match: /publish|event|enqueue/i,
        mapping: {
            actionType: 'queue-send',
            actionCategory: 'integration',
            logicAppsAction: 'Azure Service Bus send message / Event Grid publish',
        },
    },
    {
        match: /submit|invoke|^post|^call/i,
        mapping: {
            actionType: 'http-call',
            actionCategory: 'integration',
            logicAppsAction: 'HTTP (built-in)',
        },
    },
    {
        match: /persist|insert|upsert|^save|^store|^write/i,
        mapping: {
            actionType: 'database-execute',
            actionCategory: 'integration',
            logicAppsAction: 'SQL Server (built-in) or Azure Blob Storage',
        },
    },
    {
        match: /enrich|lookup|crossref/i,
        mapping: {
            actionType: 'compose',
            actionCategory: 'data',
            logicAppsAction:
                'Cross-reference lookup (Integration Account map / Liquid lookup table / Table Storage)',
        },
    },
    {
        match: /^(read|get|fetch|extract)/i,
        mapping: {
            actionType: 'compose',
            actionCategory: 'data',
            logicAppsAction: 'Compose / Parse JSON (read trigger or upstream output)',
        },
    },
    {
        match: /^(set|derive|calculate|compute|assign)/i,
        mapping: BOOMI_SHAPE_MAPPINGS.setproperties,
    },
    {
        match: /^(build|create|generate|compose)/i,
        mapping: BOOMI_SHAPE_MAPPINGS.message,
    },
    { match: /script|groovy|javascript/i, mapping: BOOMI_SHAPE_MAPPINGS.dataprocess },
];

/**
 * Name-based heuristics for synthetic shapes that do not reference a known component.
 */
export function mapShapeByName(name: string): BoomiShapeMapping {
    const rule = SHAPE_NAME_RULES.find((r) => r.match.test(name));
    if (rule) {
        return rule.mapping;
    }
    return {
        actionType: 'custom',
        actionCategory: 'utility',
        logicAppsAction: 'Requires assessment',
        gap: true,
    };
}
