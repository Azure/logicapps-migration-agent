/**
 * IR Trigger Types
 *
 * Type definitions for workflow triggers (entry points).
 * Uses discriminated unions to provide type-safe trigger configurations.
 *
 * @module ir/types/triggers
 */

import {
    AuthenticationType,
    ConfigRecord,
    Expression,
    ISODuration,
    JSONPointer,
    SourceMappingRecord,
} from './common';

// =============================================================================
// Trigger Type Discriminators
// =============================================================================

/**
 * All supported trigger types.
 * Used as discriminator for the trigger union type.
 */
export type TriggerType =
    | 'http'
    | 'service-bus'
    | 'storage-queue'
    | 'storage-blob'
    | 'timer'
    | 'file'
    | 'ftp'
    | 'sftp'
    | 'event-grid'
    | 'event-hub'
    | 'kafka'
    | 'database'
    | 'email'
    | 'manual'
    | 'custom';

/**
 * Trigger categories based on invocation pattern.
 */
export type TriggerCategory =
    | 'request-response'  // Synchronous HTTP request/response
    | 'event'             // Event-driven (Service Bus, Event Hub, etc.)
    | 'polling'           // Periodic polling (timer, database)
    | 'webhook'           // Webhook callback
    | 'manual';           // Manual/on-demand

// =============================================================================
// Trigger Output Types
// =============================================================================

/**
 * Schema reference for trigger outputs.
 */
export interface TriggerOutputSchema {
    /** Data format type */
    readonly type: 'xml' | 'json' | 'text' | 'binary';

    /** Reference to schema definition */
    readonly schemaRef?: JSONPointer;

    /** Inline schema (for simple cases) */
    readonly inlineSchema?: Record<string, unknown>;
}

/**
 * Trigger output definition.
 */
export interface TriggerOutputs {
    /** Body/payload schema */
    readonly body?: TriggerOutputSchema;

    /** Header definitions */
    readonly headers?: Record<string, string>;

    /** Additional metadata */
    readonly metadata?: Record<string, unknown>;
}

// =============================================================================
// Target Mapping
// =============================================================================

/**
 * Logic Apps target mapping for triggers.
 */
export interface TriggerTargetMapping {
    /** Logic Apps action/trigger type */
    readonly logicAppsAction: string;

    /** Connector identifier */
    readonly connector?: string;

    /** Whether this trigger has a gap */
    readonly gap: boolean;

    /** Gap description (if gap=true) */
    readonly gapReason?: string;

    /** Suggested alternative (if gap=true) */
    readonly alternative?: string;

    /** Additional configuration notes */
    readonly notes?: string;
}

// =============================================================================
// Trigger Configuration Types
// =============================================================================

/**
 * HTTP trigger authentication configuration.
 */
export interface HttpAuthenticationConfig {
    /** Authentication type */
    readonly type: AuthenticationType;

    /** OAuth2 configuration */
    readonly oauth2?: {
        readonly authority?: string;
        readonly audience?: string;
        readonly scopes?: readonly string[];
    };

    /** API key configuration */
    readonly apiKey?: {
        readonly name: string;
        readonly in: 'header' | 'query';
    };

    /** Additional auth config */
    readonly config?: ConfigRecord;
}

/**
 * HTTP trigger configuration.
 */
export interface HttpTriggerConfig {
    /** HTTP method */
    readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

    /** Relative URL path */
    readonly relativePath?: string;

    /** Request schema */
    readonly requestSchema?: JSONPointer;

    /** Response schema */
    readonly responseSchema?: JSONPointer;

    /** Authentication configuration */
    readonly authentication?: HttpAuthenticationConfig;

    /** CORS configuration */
    readonly cors?: {
        readonly allowedOrigins?: readonly string[];
        readonly allowedMethods?: readonly string[];
        readonly allowedHeaders?: readonly string[];
    };
}

/**
 * Service Bus trigger configuration.
 */
export interface ServiceBusTriggerConfig {
    /** Queue or topic name */
    readonly queueOrTopicName: string;

    /** Subscription name (for topics) */
    readonly subscriptionName?: string;

    /** Connection reference */
    readonly connectionRef?: JSONPointer;

    /** Whether to use sessions */
    readonly sessionEnabled?: boolean;

    /** Max concurrent calls */
    readonly maxConcurrentCalls?: number;

    /** Auto-complete messages */
    readonly autoComplete?: boolean;

    /** Prefetch count */
    readonly prefetchCount?: number;
}

/**
 * Storage Queue trigger configuration.
 */
export interface StorageQueueTriggerConfig {
    /** Queue name */
    readonly queueName: string;

    /** Connection reference */
    readonly connectionRef?: JSONPointer;

    /** Batch size */
    readonly batchSize?: number;

    /** Visibility timeout */
    readonly visibilityTimeout?: ISODuration;

    /** Polling interval */
    readonly pollingInterval?: ISODuration;
}

/**
 * Storage Blob trigger configuration.
 */
export interface StorageBlobTriggerConfig {
    /** Container name */
    readonly containerName: string;

    /** Blob path pattern */
    readonly path?: string;

    /** Connection reference */
    readonly connectionRef?: JSONPointer;

    /** Maximum blob size to process */
    readonly maxBlobSize?: number;
}

/**
 * Timer/Recurrence trigger configuration.
 */
export interface TimerTriggerConfig {
    /** CRON expression or recurrence pattern */
    readonly schedule?: string;

    /** Recurrence frequency */
    readonly frequency?: 'Second' | 'Minute' | 'Hour' | 'Day' | 'Week' | 'Month' | 'Year';

    /** Interval value */
    readonly interval?: number;

    /** Start time (ISO 8601) */
    readonly startTime?: string;

    /** End time (ISO 8601) */
    readonly endTime?: string;

    /** Time zone */
    readonly timeZone?: string;

    /** Schedule details for complex patterns */
    readonly schedule_details?: {
        readonly hours?: readonly number[];
        readonly minutes?: readonly number[];
        readonly weekDays?: readonly string[];
        readonly monthDays?: readonly number[];
    };
}

/**
 * File system trigger configuration.
 */
export interface FileTriggerConfig {
    /** Folder path */
    readonly folderPath: string;

    /** File pattern (glob) */
    readonly filePattern?: string;

    /** Include subfolders */
    readonly recursive?: boolean;

    /** Connection reference (for remote file systems) */
    readonly connectionRef?: JSONPointer;

    /** Polling interval */
    readonly pollingInterval?: ISODuration;
}

/**
 * FTP/SFTP trigger configuration.
 */
export interface FtpTriggerConfig extends FileTriggerConfig {
    /** Host address */
    readonly host?: string;

    /** Port number */
    readonly port?: number;

    /** Use passive mode */
    readonly passiveMode?: boolean;

    /** Use binary transfer */
    readonly binaryTransfer?: boolean;
}

/**
 * Event Grid trigger configuration.
 */
export interface EventGridTriggerConfig {
    /** Topic endpoint */
    readonly topicEndpoint?: string;

    /** Event types to subscribe to */
    readonly eventTypes?: readonly string[];

    /** Subject filters */
    readonly subjectFilter?: {
        readonly subjectBeginsWith?: string;
        readonly subjectEndsWith?: string;
    };

    /** Advanced filters */
    readonly advancedFilters?: readonly Record<string, unknown>[];
}

/**
 * Event Hub trigger configuration.
 */
export interface EventHubTriggerConfig {
    /** Event Hub name */
    readonly eventHubName: string;

    /** Consumer group */
    readonly consumerGroup?: string;

    /** Connection reference */
    readonly connectionRef?: JSONPointer;

    /** Batch size */
    readonly batchSize?: number;

    /** Prefetch count */
    readonly prefetchCount?: number;
}

/**
 * Kafka trigger configuration.
 */
export interface KafkaTriggerConfig {
    /** Topic name */
    readonly topic: string;

    /** Consumer group */
    readonly consumerGroup?: string;

    /** Broker list */
    readonly brokers?: readonly string[];

    /** Connection reference */
    readonly connectionRef?: JSONPointer;
}

/**
 * Database polling trigger configuration.
 */
export interface DatabaseTriggerConfig {
    /** Polling query */
    readonly query?: string;

    /** Polling interval */
    readonly pollingInterval?: ISODuration;

    /** Connection reference */
    readonly connectionRef?: JSONPointer;

    /** Change tracking mode */
    readonly changeTracking?: 'polling' | 'change-tracking' | 'temporal';
}

/**
 * Email trigger configuration.
 */
export interface EmailTriggerConfig {
    /** Folder to monitor */
    readonly folder?: string;

    /** Subject filter */
    readonly subjectFilter?: string;

    /** From filter */
    readonly fromFilter?: string;

    /** Connection reference */
    readonly connectionRef?: JSONPointer;

    /** Include attachments */
    readonly includeAttachments?: boolean;
}

/**
 * Custom trigger configuration.
 */
export interface CustomTriggerConfig {
    /** Custom trigger type identifier */
    readonly customType: string;

    /** Configuration properties */
    readonly properties: ConfigRecord;
}

/**
 * Union type for all trigger configurations.
 */
export type TriggerConfig =
    | HttpTriggerConfig
    | ServiceBusTriggerConfig
    | StorageQueueTriggerConfig
    | StorageBlobTriggerConfig
    | TimerTriggerConfig
    | FileTriggerConfig
    | FtpTriggerConfig
    | EventGridTriggerConfig
    | EventHubTriggerConfig
    | KafkaTriggerConfig
    | DatabaseTriggerConfig
    | EmailTriggerConfig
    | CustomTriggerConfig
    | ConfigRecord;

// =============================================================================
// Base Trigger Interface
// =============================================================================

/**
 * Base interface for all trigger types.
 */
export interface IRTriggerBase {
    /** Unique identifier */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Description */
    readonly description?: string;

    /** Trigger type discriminator */
    readonly type: TriggerType;

    /** Trigger category */
    readonly category: TriggerCategory;

    /** Outputs produced by the trigger */
    readonly outputs?: TriggerOutputs;

    /** Source platform-specific mapping */
    readonly sourceMapping?: SourceMappingRecord;

    /** Target Logic Apps mapping */
    readonly targetMapping?: TriggerTargetMapping;

    /** Retry policy */
    readonly retryPolicy?: {
        readonly type: 'none' | 'fixed' | 'exponential';
        readonly count?: number;
        readonly interval?: ISODuration;
        readonly maximumInterval?: ISODuration;
    };

    /** Concurrency settings */
    readonly concurrency?: {
        readonly runs?: number;
        readonly maximumWaitingRuns?: number;
    };

    /** Conditions for trigger firing */
    readonly conditions?: readonly Expression[];

    /** Split-on expression for debatching */
    readonly splitOn?: Expression;
}

// =============================================================================
// Discriminated Trigger Types
// =============================================================================

/**
 * HTTP Request trigger.
 */
export interface HttpTrigger extends IRTriggerBase {
    readonly type: 'http';
    readonly category: 'request-response';
    readonly config: HttpTriggerConfig;
}

/**
 * Service Bus trigger.
 */
export interface ServiceBusTrigger extends IRTriggerBase {
    readonly type: 'service-bus';
    readonly category: 'event';
    readonly config: ServiceBusTriggerConfig;
}

/**
 * Storage Queue trigger.
 */
export interface StorageQueueTrigger extends IRTriggerBase {
    readonly type: 'storage-queue';
    readonly category: 'event';
    readonly config: StorageQueueTriggerConfig;
}

/**
 * Storage Blob trigger.
 */
export interface StorageBlobTrigger extends IRTriggerBase {
    readonly type: 'storage-blob';
    readonly category: 'event';
    readonly config: StorageBlobTriggerConfig;
}

/**
 * Timer/Recurrence trigger.
 */
export interface TimerTrigger extends IRTriggerBase {
    readonly type: 'timer';
    readonly category: 'polling';
    readonly config: TimerTriggerConfig;
}

/**
 * File system trigger.
 */
export interface FileTrigger extends IRTriggerBase {
    readonly type: 'file';
    readonly category: 'polling';
    readonly config: FileTriggerConfig;
}

/**
 * FTP trigger.
 */
export interface FtpTrigger extends IRTriggerBase {
    readonly type: 'ftp';
    readonly category: 'polling';
    readonly config: FtpTriggerConfig;
}

/**
 * SFTP trigger.
 */
export interface SftpTrigger extends IRTriggerBase {
    readonly type: 'sftp';
    readonly category: 'polling';
    readonly config: FtpTriggerConfig;
}

/**
 * Event Grid trigger.
 */
export interface EventGridTrigger extends IRTriggerBase {
    readonly type: 'event-grid';
    readonly category: 'event';
    readonly config: EventGridTriggerConfig;
}

/**
 * Event Hub trigger.
 */
export interface EventHubTrigger extends IRTriggerBase {
    readonly type: 'event-hub';
    readonly category: 'event';
    readonly config: EventHubTriggerConfig;
}

/**
 * Kafka trigger.
 */
export interface KafkaTrigger extends IRTriggerBase {
    readonly type: 'kafka';
    readonly category: 'event';
    readonly config: KafkaTriggerConfig;
}

/**
 * Database trigger.
 */
export interface DatabaseTrigger extends IRTriggerBase {
    readonly type: 'database';
    readonly category: 'polling';
    readonly config: DatabaseTriggerConfig;
}

/**
 * Email trigger.
 */
export interface EmailTrigger extends IRTriggerBase {
    readonly type: 'email';
    readonly category: 'polling';
    readonly config: EmailTriggerConfig;
}

/**
 * Manual trigger.
 */
export interface ManualTrigger extends IRTriggerBase {
    readonly type: 'manual';
    readonly category: 'manual';
    readonly config?: ConfigRecord;
}

/**
 * Custom trigger.
 */
export interface CustomTrigger extends IRTriggerBase {
    readonly type: 'custom';
    readonly config: CustomTriggerConfig;
}

// =============================================================================
// Trigger Union Type
// =============================================================================

/**
 * Union of all trigger types.
 * Use type guards to narrow to specific trigger types.
 */
export type IRTrigger =
    | HttpTrigger
    | ServiceBusTrigger
    | StorageQueueTrigger
    | StorageBlobTrigger
    | TimerTrigger
    | FileTrigger
    | FtpTrigger
    | SftpTrigger
    | EventGridTrigger
    | EventHubTrigger
    | KafkaTrigger
    | DatabaseTrigger
    | EmailTrigger
    | ManualTrigger
    | CustomTrigger;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for HTTP trigger.
 */
export function isHttpTrigger(trigger: IRTrigger): trigger is HttpTrigger {
    return trigger.type === 'http';
}

/**
 * Type guard for Service Bus trigger.
 */
export function isServiceBusTrigger(trigger: IRTrigger): trigger is ServiceBusTrigger {
    return trigger.type === 'service-bus';
}

/**
 * Type guard for Timer trigger.
 */
export function isTimerTrigger(trigger: IRTrigger): trigger is TimerTrigger {
    return trigger.type === 'timer';
}

/**
 * Type guard for File trigger.
 */
export function isFileTrigger(trigger: IRTrigger): trigger is FileTrigger {
    return trigger.type === 'file';
}

/**
 * Type guard for Event trigger (any event-driven trigger).
 */
export function isEventTrigger(trigger: IRTrigger): boolean {
    return trigger.category === 'event';
}

/**
 * Type guard for Polling trigger (any polling-based trigger).
 */
export function isPollingTrigger(trigger: IRTrigger): boolean {
    return trigger.category === 'polling';
}
