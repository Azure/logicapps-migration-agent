/**
 * Logging Service
 *
 * Provides centralized logging with multiple output channels and log levels.
 * Logs are written to a VS Code Output Channel for user visibility.
 */

import * as vscode from 'vscode';

/**
 * Log levels supported by the logging service
 */
export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

/**
 * Log entry metadata
 */
type LogMetadata = Record<string, string | number | boolean | undefined>;

/**
 * Singleton logging service for the extension
 */
export class LoggingService implements vscode.Disposable {
    private static instance: LoggingService | undefined;
    private outputChannel: vscode.OutputChannel | undefined;
    private logLevel: LogLevel = LogLevel.Info;
    private readonly channelName = 'Logic Apps Migration Assistant';

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
        this.outputChannel = vscode.window.createOutputChannel(this.channelName, { log: true });

        // Read log level from configuration
        this.updateLogLevel();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('logicAppsMigrationAssistant.logLevel')) {
                this.updateLogLevel();
            }
        });

        this.info('Logging service initialized');
    }

    /**
     * Update log level from configuration
     */
    private updateLogLevel(): void {
        const config = vscode.workspace.getConfiguration('logicAppsMigration');
        const levelString = config.get<string>('logLevel', 'info');

        switch (levelString.toLowerCase()) {
            case 'debug':
                this.logLevel = LogLevel.Debug;
                break;
            case 'info':
                this.logLevel = LogLevel.Info;
                break;
            case 'warn':
                this.logLevel = LogLevel.Warn;
                break;
            case 'error':
                this.logLevel = LogLevel.Error;
                break;
            default:
                this.logLevel = LogLevel.Info;
        }
    }

    /**
     * Format a log message with timestamp and level
     */
    private formatMessage(level: string, message: string, metadata?: LogMetadata): string {
        const timestamp = new Date().toISOString();
        let formattedMessage = `[${level}] [${timestamp}] ${message}`;

        if (metadata && Object.keys(metadata).length > 0) {
            formattedMessage += ` ${JSON.stringify(metadata)}`;
        }

        return formattedMessage;
    }

    /**
     * Log a debug message
     */
    public debug(message: string, metadata?: LogMetadata): void {
        if (this.logLevel <= LogLevel.Debug) {
            this.log(LogLevel.Debug, message, metadata);
        }
    }

    /**
     * Log an info message
     */
    public info(message: string, metadata?: LogMetadata): void {
        if (this.logLevel <= LogLevel.Info) {
            this.log(LogLevel.Info, message, metadata);
        }
    }

    /**
     * Log a warning message
     */
    public warn(message: string, metadata?: LogMetadata): void {
        if (this.logLevel <= LogLevel.Warn) {
            this.log(LogLevel.Warn, message, metadata);
        }
    }

    /**
     * Log an error message
     */
    public error(message: string, error?: Error, metadata?: LogMetadata): void {
        if (this.logLevel <= LogLevel.Error) {
            const errorMetadata: LogMetadata = {
                ...metadata,
                errorName: error?.name,
                errorMessage: error?.message,
                errorStack: error?.stack,
            };
            this.log(LogLevel.Error, message, errorMetadata);
        }
    }

    /**
     * Internal log method
     */
    private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
        if (!this.outputChannel) {
            return;
        }

        const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const formattedMessage = this.formatMessage(levelNames[level], message, metadata);
        this.outputChannel.appendLine(formattedMessage);
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
