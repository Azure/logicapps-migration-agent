/**
 * Configuration Service
 *
 * Provides typed access to extension configuration settings.
 * Emits events when configuration changes.
 */

import * as vscode from 'vscode';
import { LoggingService } from './LoggingService';
import { StateManager } from './StateManager';
import { SourcePlatform } from '../types/platforms';

export type { SourcePlatform } from '../types/platforms';

/**
 * Target platform type (always Logic Apps Standard)
 */
export type TargetPlatform = 'logic-apps-standard';

/**
 * Deployment model for Logic Apps Standard
 */
type DeploymentModel = 'workflow-service-plan' | 'ase-v3' | 'hybrid';

/**
 * Log level types
 */
export type LogLevelType = 'debug' | 'info' | 'warn' | 'error';

/**
 * Azure configuration settings
 */
export interface AzureConfig {
    subscriptionId: string;
    resourceGroup: string;
    location: string;
}

/**
 * Complete extension configuration
 */
export interface ExtensionConfig {
    sourcePlatform: SourcePlatform;
    targetPlatform: 'logic-apps-standard';
    deploymentModel: DeploymentModel;
    outputFolder: string;
    enableCopilot: true;
    enableTelemetry: true;
    logLevel: LogLevelType;
    autoSave: boolean;
    maxParallelParsers: number;
    cacheEnabled: true;
    azure: AzureConfig;
}

/**
 * Configuration change event
 */
export interface ConfigurationChangeEvent {
    affectedKeys: string[];
    config: ExtensionConfig;
}

/**
 * Singleton configuration service
 */
export class ConfigurationService implements vscode.Disposable {
    private static instance: ConfigurationService | undefined;
    private readonly configurationSection = 'logicAppsMigration';
    private readonly disposables: vscode.Disposable[] = [];

    private readonly _onDidChangeConfiguration =
        new vscode.EventEmitter<ConfigurationChangeEvent>();
    public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    /**
     * Initialize the configuration service
     */
    public initialize(): void {
        // Listen for configuration changes
        const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(this.configurationSection)) {
                this.handleConfigurationChange(event);
            }
        });

        this.disposables.push(disposable);
        LoggingService.getInstance().debug('Configuration service initialized');
    }

    /**
     * Handle configuration changes
     */
    private handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
        const affectedKeys: string[] = [];
        const configKeys = [
            'sourcePlatform',
            'deploymentModel',
            'azure.subscriptionId',
            'azure.resourceGroup',
            'azure.location',
        ];

        for (const key of configKeys) {
            if (event.affectsConfiguration(`${this.configurationSection}.${key}`)) {
                affectedKeys.push(key);
            }
        }

        if (affectedKeys.length > 0) {
            LoggingService.getInstance().debug('Configuration changed', {
                affectedKeys: affectedKeys.join(', '),
            });

            this._onDidChangeConfiguration.fire({
                affectedKeys,
                config: this.getConfig(),
            });
        }
    }

    /**
     * Get the full configuration object
     */
    public getConfig(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration(this.configurationSection);

        return {
            sourcePlatform:
                (StateManager.getInstance().getState().sourcePlatform as SourcePlatform) ||
                'biztalk',
            targetPlatform: 'logic-apps-standard' as const,
            deploymentModel: config.get<DeploymentModel>(
                'deploymentModel',
                'workflow-service-plan'
            ),
            outputFolder: '.migration',
            enableCopilot: true,
            enableTelemetry: true,
            logLevel: 'info' as LogLevelType,
            autoSave: true,
            maxParallelParsers: 4,
            cacheEnabled: true,
            azure: {
                subscriptionId: config.get<string>('azure.subscriptionId', ''),
                resourceGroup: config.get<string>('azure.resourceGroup', ''),
                location: config.get<string>('azure.location', 'eastus'),
            },
        };
    }

    /**
     * Get source platform setting
     */
    public getSourcePlatform(): SourcePlatform {
        return this.getConfig().sourcePlatform;
    }

    /**
     * Get target platform setting (always Logic Apps Standard)
     */
    public getTargetPlatform(): TargetPlatform {
        return 'logic-apps-standard';
    }

    /**
     * Get deployment model setting
     */
    public getDeploymentModel(): DeploymentModel {
        return this.getConfig().deploymentModel;
    }

    /**
     * Get output folder setting
     */
    public getOutputFolder(): string {
        return this.getConfig().outputFolder;
    }

    /**
     * Check if Copilot is enabled
     */
    public isCopilotEnabled(): boolean {
        return this.getConfig().enableCopilot;
    }

    /**
     * Check if telemetry is enabled
     */
    public isTelemetryEnabled(): boolean {
        return this.getConfig().enableTelemetry;
    }

    /**
     * Get Azure configuration
     */
    public getAzureConfig(): AzureConfig {
        return this.getConfig().azure;
    }

    /**
     * Update a configuration setting
     */
    public async updateSetting<T>(
        key: string,
        value: T,
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configurationSection);
        await config.update(key, value, target);
        LoggingService.getInstance().debug(`Configuration updated: ${key}`, {
            value: String(value),
        });
    }

    /**
     * Dispose the configuration service
     */
    public dispose(): void {
        this._onDidChangeConfiguration.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        ConfigurationService.instance = undefined;
    }
}
