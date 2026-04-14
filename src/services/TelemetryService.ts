/**
 * Telemetry Service
 *
 * Provides anonymous usage telemetry using @vscode/extension-telemetry.
 * Respects user privacy settings and VS Code telemetry configuration.
 */

import * as vscode from 'vscode';
import { TelemetryReporter } from '@vscode/extension-telemetry';
import { LoggingService } from './LoggingService';

/**
 * Telemetry event properties
 */
type TelemetryProperties = Record<string, string>;

/**
 * Telemetry event measurements
 */
type TelemetryMeasurements = Record<string, number>;

/**
 * Singleton telemetry service
 */
export class TelemetryService implements vscode.Disposable {
    private static instance: TelemetryService | undefined;
    private reporter: TelemetryReporter | undefined;
    private isEnabled = false; // Disabled by default until real connection string is configured

    // Connection string for Application Insights
    // Set via environment or configuration to enable telemetry; empty disables it
    private readonly connectionString = '';

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): TelemetryService {
        if (!TelemetryService.instance) {
            TelemetryService.instance = new TelemetryService();
        }
        return TelemetryService.instance;
    }

    /**
     * Initialize the telemetry service
     */
    public initialize(context: vscode.ExtensionContext): void {
        // Check if telemetry is enabled in extension settings
        this.updateEnabledState();

        // Only create reporter if telemetry is enabled AND connection string is configured
        if (this.isEnabled && this.connectionString) {
            try {
                this.reporter = new TelemetryReporter(this.connectionString);
                context.subscriptions.push(this.reporter);
                LoggingService.getInstance().debug('Telemetry service initialized');
            } catch (error) {
                LoggingService.getInstance().warn('Failed to initialize telemetry reporter', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        } else {
            LoggingService.getInstance().debug(
                'Telemetry disabled (no connection string configured)'
            );
        }

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('logicAppsMigrationAgent.enableTelemetry')) {
                this.updateEnabledState();
            }
        });
    }

    /**
     * Update the enabled state from configuration
     */
    private updateEnabledState(): void {
        const config = vscode.workspace.getConfiguration('logicAppsMigration');
        this.isEnabled = config.get<boolean>('enableTelemetry', true);

        // Also respect VS Code's global telemetry setting
        const vscodeConfig = vscode.workspace.getConfiguration('telemetry');
        const vscodeTelemetryLevel = vscodeConfig.get<string>('telemetryLevel', 'all');
        if (vscodeTelemetryLevel === 'off') {
            this.isEnabled = false;
        }
    }

    /**
     * Send a telemetry event
     */
    public sendEvent(
        eventName: string,
        properties?: TelemetryProperties,
        measurements?: TelemetryMeasurements
    ): void {
        if (!this.isEnabled || !this.reporter) {
            return;
        }

        try {
            this.reporter.sendTelemetryEvent(eventName, properties, measurements);
        } catch (error) {
            // Silently fail telemetry - should not impact user experience
            LoggingService.getInstance().debug('Failed to send telemetry event', {
                eventName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Send an error telemetry event
     */
    public sendError(
        error: Error,
        properties?: TelemetryProperties,
        measurements?: TelemetryMeasurements
    ): void {
        if (!this.isEnabled || !this.reporter) {
            return;
        }

        try {
            this.reporter.sendTelemetryErrorEvent(
                'error',
                {
                    ...properties,
                    errorName: error.name,
                    errorMessage: error.message,
                },
                measurements
            );
        } catch (err) {
            // Silently fail telemetry
            LoggingService.getInstance().debug('Failed to send telemetry error', {
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    }

    /**
     * Dispose the telemetry service
     */
    public dispose(): void {
        this.reporter?.dispose();
        TelemetryService.instance = undefined;
    }
}
