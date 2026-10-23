/**
 * Logging Service
 *
 * Provides centralized logging with multiple output channels and log levels.
 * Logs are written to a VS Code Output Channel for user visibility.
 */

import * as vscode from 'vscode';
import { TelemetryService } from './TelemetryService';

/**
 * Log levels supported by the logging service
 */
export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

/** Human-readable names for each log level, indexed by LogLevel value. */
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

/**
 * Log entry metadata
 */
type LogMetadata = Record<string, string | number | boolean | undefined>;

/**
 * Singleton logging service for the extension
 */
export class LoggingService implements vscode.Disposable {
    private static instance: LoggingService | undefined;
    private outputChannel: vscode.LogOutputChannel | undefined;
    private readonly channelName = 'Logic Apps Migration Agent';
    private forwardingToTelemetry = false;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): LoggingService {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService();
        }
        return LoggingService.instance;
    }

    /**
     * Initialize the logging service
     */
    public initialize(_context: vscode.ExtensionContext): void {
        // Create the channel as a LogOutputChannel so VS Code controls the
        // visible log level natively (the Output panel's filter icon, or the
        // "Developer: Set Log Level…" command). The channel's own level is the
        // single source of truth — there is no extension-level log-level setting.
        this.outputChannel = vscode.window.createOutputChannel(this.channelName, { log: true });

        this.debug('Logging service initialized');
    }

    /**
     * Append metadata (if any) to a message. The level and timestamp are added
     * by the VS Code LogOutputChannel itself, so we don't duplicate them here.
     */
    private composeMessage(message: string, metadata?: LogMetadata): string {
        if (metadata && Object.keys(metadata).length > 0) {
            return `${message} ${JSON.stringify(metadata)}`;
        }
        return message;
    }

    /**
     * Log a debug message
     */
    public debug(message: string, metadata?: LogMetadata): void {
        this.log(LogLevel.Debug, message, metadata);
    }

    /**
     * Log an info message
     */
    public info(message: string, metadata?: LogMetadata): void {
        this.log(LogLevel.Info, message, metadata);
    }

    /**
     * Log a warning message.
     *
     * Accepts an optional `Error` (whose name/message/stack are merged into the
     * metadata, like `error()`) so a handled failure can be logged at WARN
     * without losing the error detail.
     */
    public warn(message: string, metadata?: LogMetadata): void;
    public warn(message: string, error?: Error, metadata?: LogMetadata): void;
    public warn(
        message: string,
        errorOrMetadata?: Error | LogMetadata,
        metadata?: LogMetadata
    ): void {
        this.log(LogLevel.Warn, message, this.coalesceMetadata(errorOrMetadata, metadata));
    }

    /**
     * Log an error message
     */
    public error(message: string, error?: Error, metadata?: LogMetadata): void {
        this.log(LogLevel.Error, message, this.coalesceMetadata(error, metadata));
    }

    /**
     * Merge an optional Error and metadata into a single metadata object.
     * When an Error is provided, its name/message/stack are attached.
     */
    private coalesceMetadata(
        errorOrMetadata?: Error | LogMetadata,
        metadata?: LogMetadata
    ): LogMetadata {
        if (errorOrMetadata instanceof Error) {
            return {
                ...metadata,
                errorName: errorOrMetadata.name,
                errorMessage: errorOrMetadata.message,
                errorStack: errorOrMetadata.stack,
            };
        }
        return { ...(errorOrMetadata ?? {}), ...metadata };
    }

    /**
     * Internal log method
     */
    private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
        if (this.outputChannel) {
            // Route through the LogOutputChannel's native level methods so VS Code
            // renders a single, correct severity (and its own timestamp), and so
            // the channel's native level filter controls visibility.
            const text = this.composeMessage(message, metadata);
            switch (level) {
                case LogLevel.Debug:
                    this.outputChannel.debug(text);
                    break;
                case LogLevel.Info:
                    this.outputChannel.info(text);
                    break;
                case LogLevel.Warn:
                    this.outputChannel.warn(text);
                    break;
                case LogLevel.Error:
                    this.outputChannel.error(text);
                    break;
            }
        }

        // Forward INFO and above (info/warn/error) to Application Insights (-> Kusto).
        // TEMPORARY: lowered from error-only for testing. Debug stays local.
        // Guard against re-entrancy so telemetry-internal logging cannot recurse.
        if (level >= LogLevel.Info && !this.forwardingToTelemetry) {
            this.forwardingToTelemetry = true;
            try {
                TelemetryService.getInstance().sendLog(LEVEL_NAMES[level], message, metadata);
            } finally {
                this.forwardingToTelemetry = false;
            }
        }
    }

    /**
     * Show the output channel to the user
     */
    public showOutputChannel(): void {
        this.outputChannel?.show(true);
    }

    /**
     * Clear the output channel
     */
    public clear(): void {
        this.outputChannel?.clear();
    }

    /**
     * Dispose the logging service
     */
    public dispose(): void {
        this.outputChannel?.dispose();
        LoggingService.instance = undefined;
    }
}
