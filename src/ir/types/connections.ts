/**
 * IR Connection Types
 *
 * Type definitions for connections to external systems.
 * Connections abstract the details of connecting to databases,
 * APIs, messaging systems, and other external resources.
 *
 * @module ir/types/connections
 */

import {
    AuthenticationType,
    ConfigRecord,
    CredentialStorageType,
    SourceMappingRecord,
} from './common';

// =============================================================================
// Connection Type Discriminators
// =============================================================================

/**
 * All supported connection types.
 * Categorizes connections by the type of system they connect to.
 */
export type ConnectionType =
    // Databases
    | 'sql-server'
    | 'oracle'
    | 'mysql'
    | 'postgresql'
    | 'cosmos-db'
    | 'mongodb'
    // ERP/CRM
    | 'sap'
    | 'salesforce'
    | 'dynamics365'
    // Messaging
    | 'service-bus'
    | 'event-hub'
    | 'kafka'
    | 'rabbitmq'
    | 'mq-series'
    // Storage
    | 'storage-blob'
    | 'storage-queue'
    | 'storage-table'
    | 'sharepoint'
    // File transfer
    | 'ftp'
    | 'sftp'
    | 'file-system'
    // Communication
    | 'smtp'
    | 'office365-email'
    | 'teams'
    // API
    | 'http'
    | 'soap'
    | 'rest'
    | 'graphql'
    | 'odata'
    // Custom
    | 'custom';

/**
 * Connection categories for grouping.
 */
export type ConnectionCategory =
    | 'database'
    | 'erp'
    | 'crm'
    | 'messaging'
    | 'storage'
    | 'file'
    | 'email'
    | 'api'
    | 'custom';

// =============================================================================
// Gateway Configuration
// =============================================================================

/**
 * On-premises data gateway configuration.
 * Required for connecting to on-premises resources.
 */
export interface GatewayConfig {
    /** Whether gateway is required */
    readonly required: boolean;

    /** Gateway type */
    readonly type?: 'on-premises-data-gateway' | 'vnet-integration';

    /** Gateway name/identifier */
    readonly name?: string;

    /** Gateway region */
    readonly region?: string;

    /** Gateway cluster name */
    readonly clusterName?: string;
}

// =============================================================================
// Credential Configuration
// =============================================================================

/**
 * Credential configuration for connections.
 */
export interface CredentialConfig {
    /** Credential storage type */
    readonly type: CredentialStorageType;

    /** Key Vault reference */
    readonly keyVaultRef?: string;

    /** Secret name in Key Vault */
    readonly secretName?: string;

    /** SSO application name */
    readonly ssoApplication?: string;

    /** Managed identity client ID */
    readonly managedIdentityClientId?: string;
}

// =============================================================================
// Authentication Configuration
// =============================================================================

/**
 * Connection authentication configuration.
 */
export interface ConnectionAuthConfig {
    /** Authentication type */
    readonly type: AuthenticationType;

    /** Username (for basic/sql auth) */
    readonly username?: string;

    /** Password reference (should point to Key Vault) */
    readonly passwordRef?: string;

    /** Connection string reference */
    readonly connectionStringRef?: string;

    /** OAuth2 configuration */
    readonly oauth2?: {
        readonly clientId?: string;
        readonly clientSecretRef?: string;
        readonly authority?: string;
        readonly resource?: string;
        readonly scopes?: readonly string[];
    };

    /** Certificate configuration */
    readonly certificate?: {
        readonly thumbprint?: string;
        readonly keyVaultRef?: string;
    };

    /** Additional auth config */
    readonly config?: ConfigRecord;
}

// =============================================================================
// Connection Target Mapping
// =============================================================================

/**
 * Logic Apps target mapping for connections.
 */
export interface ConnectionTargetMapping {
    /** Logic Apps connector identifier */
    readonly connector: string;

    /** Connection type in Logic Apps */
    readonly connectionType?: 'managed' | 'service-provider' | 'gateway' | 'custom';

    /** API version */
    readonly apiVersion?: string;

    /** Whether this connection has a gap */
    readonly gap: boolean;

    /** Gap description */
    readonly gapReason?: string;

    /** Suggested alternative */
    readonly alternative?: string;

    /** Requires on-premises gateway */
    readonly requiresGateway?: boolean;

    /** Requires premium connector */
    readonly requiresPremium?: boolean;
}

// =============================================================================
// Connection Configuration Types
// =============================================================================

/**
 * SQL Server connection configuration.
 */
export interface SqlServerConnectionConfig {
    /** Server address */
    readonly server: string;

    /** Database name */
    readonly database: string;

    /** Port number */
    readonly port?: number;

    /** Use encrypted connection */
    readonly encrypt?: boolean;

    /** Trust server certificate */
    readonly trustServerCertificate?: boolean;

    /** Connection timeout in seconds */
    readonly connectionTimeout?: number;

    /** Command timeout in seconds */
    readonly commandTimeout?: number;
}

/**
 * Oracle connection configuration.
 */
export interface OracleConnectionConfig {
    /** TNS name or connection descriptor */
    readonly tnsName?: string;

    /** Host address */
    readonly host?: string;

    /** Port number */
    readonly port?: number;

    /** Service name */
    readonly serviceName?: string;

    /** SID */
    readonly sid?: string;
}

/**
 * Cosmos DB connection configuration.
 */
export interface CosmosDbConnectionConfig {
    /** Account endpoint */
    readonly endpoint: string;

    /** Database name */
    readonly database: string;

    /** Container name */
    readonly container?: string;

    /** Preferred regions */
    readonly preferredRegions?: readonly string[];
}

/**
 * SAP connection configuration.
 */
export interface SapConnectionConfig {
    /** SAP application server */
    readonly appServer?: string;

    /** SAP message server */
    readonly msgServer?: string;

    /** System number */
    readonly systemNumber?: string;

    /** Client number */
    readonly client?: string;

    /** Language */
    readonly language?: string;

    /** Logon group */
    readonly logonGroup?: string;

    /** RFC destination */
    readonly rfcDestination?: string;
}

/**
 * Service Bus connection configuration.
 */
export interface ServiceBusConnectionConfig {
    /** Namespace name */
    readonly namespace: string;

    /** Full namespace URI */
    readonly fullyQualifiedNamespace?: string;

    /** Entity path (queue/topic) */
    readonly entityPath?: string;

    /** Transport type */
    readonly transportType?: 'amqp' | 'amqp-web-sockets';
}

/**
 * Event Hub connection configuration.
 */
export interface EventHubConnectionConfig {
    /** Namespace name */
    readonly namespace: string;

    /** Event Hub name */
    readonly eventHubName?: string;

    /** Consumer group */
    readonly consumerGroup?: string;
}

/**
 * Storage connection configuration.
 */
export interface StorageConnectionConfig {
    /** Storage account name */
    readonly accountName: string;

    /** Endpoint suffix */
    readonly endpointSuffix?: string;

    /** Container/queue/table name */
    readonly containerName?: string;
}

/**
 * FTP/SFTP connection configuration.
 */
export interface FtpConnectionConfig {
    /** Host address */
    readonly host: string;

    /** Port number */
    readonly port?: number;

    /** Root folder path */
    readonly rootFolder?: string;

    /** Use passive mode (FTP) */
    readonly passiveMode?: boolean;

    /** Use binary transfer */
    readonly binaryTransfer?: boolean;

    /** Disable certificate validation */
    readonly disableCertificateValidation?: boolean;

    /** SSH host key fingerprint (SFTP) */
    readonly hostKeyFingerprint?: string;
}

/**
 * HTTP/REST API connection configuration.
 */
export interface HttpConnectionConfig {
    /** Base URL */
    readonly baseUrl: string;

    /** Default headers */
    readonly defaultHeaders?: Record<string, string>;

    /** Certificate thumbprint for mutual TLS */
    readonly certificateThumbprint?: string;

    /** Proxy configuration */
    readonly proxy?: {
        readonly host: string;
        readonly port: number;
        readonly username?: string;
        readonly passwordRef?: string;
    };
}

/**
 * SMTP connection configuration.
 */
export interface SmtpConnectionConfig {
    /** SMTP server */
    readonly server: string;

    /** Port number */
    readonly port?: number;

    /** Use SSL */
    readonly useSsl?: boolean;

    /** Use TLS */
    readonly useTls?: boolean;
}

/**
 * Custom connection configuration.
 */
export interface CustomConnectionConfig {
    /** Custom connector type */
    readonly customType: string;

    /** Configuration properties */
    readonly properties: ConfigRecord;
}

/**
 * Union type for all connection configurations.
 */
export type ConnectionConfig =
    | SqlServerConnectionConfig
    | OracleConnectionConfig
    | CosmosDbConnectionConfig
    | SapConnectionConfig
    | ServiceBusConnectionConfig
    | EventHubConnectionConfig
    | StorageConnectionConfig
    | FtpConnectionConfig
    | HttpConnectionConfig
    | SmtpConnectionConfig
    | CustomConnectionConfig
    | ConfigRecord;

// =============================================================================
// Connection Interface
// =============================================================================

/**
 * Connection definition.
 * Represents a connection to an external system.
 */
export interface IRConnection {
    /** Unique identifier */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Connection type */
    readonly type: ConnectionType;

    /** Connection category */
    readonly category: ConnectionCategory;

    /** Connection configuration */
    readonly config: ConnectionConfig;

    /** Authentication configuration */
    readonly authentication?: ConnectionAuthConfig;

    /** Gateway configuration */
    readonly gateway?: GatewayConfig;

    /** Credential configuration */
    readonly credentials?: CredentialConfig;

    /** Whether connection is enabled */
    readonly enabled?: boolean;

    /** Connection timeout */
    readonly timeout?: string;

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target Logic Apps mapping */
    readonly targetMapping?: ConnectionTargetMapping;

    /** Tags for organization */
    readonly tags?: readonly string[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for database connections.
 */
export function isDatabaseConnection(connection: IRConnection): boolean {
    return connection.category === 'database';
}

/**
 * Type guard for messaging connections.
 */
export function isMessagingConnection(connection: IRConnection): boolean {
    return connection.category === 'messaging';
}

/**
 * Type guard for connections requiring gateway.
 */
export function requiresGateway(connection: IRConnection): boolean {
    return connection.gateway?.required === true;
}

/**
 * Type guard for SQL Server connections.
 */
export function isSqlServerConnection(connection: IRConnection): connection is IRConnection & { config: SqlServerConnectionConfig } {
    return connection.type === 'sql-server';
}

/**
 * Type guard for SAP connections.
 */
export function isSapConnection(connection: IRConnection): connection is IRConnection & { config: SapConnectionConfig } {
    return connection.type === 'sap';
}

/**
 * Type guard for Service Bus connections.
 */
export function isServiceBusConnection(connection: IRConnection): connection is IRConnection & { config: ServiceBusConnectionConfig } {
    return connection.type === 'service-bus';
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new connection with required fields.
 *
 * @param id - Unique identifier
 * @param name - Display name
 * @param type - Connection type
 * @param category - Connection category
 * @param config - Connection configuration
 * @returns A new IRConnection instance
 */
export function createConnection(
    id: string,
    name: string,
    type: ConnectionType,
    category: ConnectionCategory,
    config: ConnectionConfig
): IRConnection {
    return {
        id,
        name,
        type,
        category,
        config,
        enabled: true,
        targetMapping: {
            connector: type,
            gap: false,
        },
    };
}
