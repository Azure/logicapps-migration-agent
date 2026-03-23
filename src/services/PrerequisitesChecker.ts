/**
 * Prerequisites Checker Service
 *
 * Checks for required and recommended dependencies:
 * - VS Code version (1.85+)
 * - Azure Logic Apps Extension
 * - Azure Functions Extension
 * - Azure CLI
 * - Docker Desktop
 * - GitHub Copilot (recommended)
 *
 *
 * @module services/PrerequisitesChecker
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { UserPrompts } from '../constants/UserMessages';
import { LoggingService } from './LoggingService';

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

/**
 * Status of a prerequisite check.
 */
export type PrerequisiteStatus = 'installed' | 'missing' | 'recommended' | 'optional' | 'unknown';

/**
 * Individual prerequisite result.
 */
export interface PrerequisiteResult {
    /** Prerequisite identifier */
    id: string;

    /** Display name */
    name: string;

    /** Description of the prerequisite */
    description: string;

    /** Current status */
    status: PrerequisiteStatus;

    /** Whether this is required */
    required: boolean;

    /** Current version (if applicable) */
    version?: string;

    /** Minimum required version (if applicable) */
    minVersion?: string;

    /** Help URL for installing/troubleshooting */
    helpUrl?: string;

    /** VS Code extension ID (if prerequisite is an extension) */
    extensionId?: string;

    /** Action to take if missing */
    action?: {
        label: string;
        command?: string;
        url?: string;
    };
}

/**
 * Complete prerequisites check result.
 */
export interface PrerequisitesCheckResult {
    /** All individual results */
    results: PrerequisiteResult[];

    /** Whether all required prerequisites are met */
    allRequiredMet: boolean;

    /** Count of missing required prerequisites */
    missingRequiredCount: number;

    /** Count of missing recommended prerequisites */
    missingRecommendedCount: number;
}

// =============================================================================
// Prerequisites Checker
// =============================================================================

/**
 * Service for checking extension prerequisites.
 */
export class PrerequisitesChecker {
    private static instance: PrerequisitesChecker | undefined;
    private readonly logger = LoggingService.getInstance();

    private constructor() {}

    /**
     * Get the singleton instance.
     */
    public static getInstance(): PrerequisitesChecker {
        if (!PrerequisitesChecker.instance) {
            PrerequisitesChecker.instance = new PrerequisitesChecker();
        }
        return PrerequisitesChecker.instance;
    }

    /**
     * Run all prerequisite checks.
     */
    public async checkAll(): Promise<PrerequisitesCheckResult> {
        const results: PrerequisiteResult[] = [];

        results.push(await this.checkVSCodeVersion());
        results.push(await this.checkAzureLogicAppsExtension());
        results.push(await this.checkAzureFunctionsExtension());
        results.push(await this.checkGitHubCopilot());
        results.push(await this.checkAzureCLI());
        results.push(await this.checkDocker());

        const allRequiredMet = results
            .filter((r) => r.required)
            .every((r) => r.status === 'installed');

        const missingRequiredCount = results.filter(
            (r) => r.required && r.status === 'missing'
        ).length;

        const missingRecommendedCount = results.filter(
            (r) => !r.required && r.status === 'recommended'
        ).length;

        this.logger.debug('Prerequisites check complete', {
            allRequiredMet,
            missingRequiredCount,
            missingRecommendedCount,
        });

        return {
            results,
            allRequiredMet,
            missingRequiredCount,
            missingRecommendedCount,
        };
    }

    /**
     * Check VS Code version.
     */
    private async checkVSCodeVersion(): Promise<PrerequisiteResult> {
        const currentVersion = vscode.version;
        const minVersion = '1.85.0';

        const isValid = this.compareVersions(currentVersion, minVersion) >= 0;

        return {
            id: 'vscode',
            name: 'VS Code',
            description: `Version ${minVersion} or higher required`,
            status: isValid ? 'installed' : 'missing',
            required: true,
            version: currentVersion,
            minVersion,
            helpUrl: 'https://code.visualstudio.com/download',
            action: isValid
                ? undefined
                : {
                      label: 'Update VS Code',
                      url: 'https://code.visualstudio.com/download',
                  },
        };
    }

    /**
     * Check Azure Logic Apps Extension.
     */
    private async checkAzureLogicAppsExtension(): Promise<PrerequisiteResult> {
        const extensionId = 'ms-azuretools.vscode-azurelogicapps';
        const extension = vscode.extensions.getExtension(extensionId);
        const isInstalled = extension !== undefined;

        return {
            id: 'azure-logic-apps',
            name: 'Azure Logic Apps (Standard)',
            description: 'Required for Logic Apps development and deployment',
            status: isInstalled ? 'installed' : 'missing',
            required: true,
            version: extension?.packageJSON?.version,
            extensionId,
            helpUrl: `https://marketplace.visualstudio.com/items?itemName=${extensionId}`,
            action: isInstalled
                ? undefined
                : {
                      label: 'Install Extension',
                      command: 'workbench.extensions.installExtension',
                  },
        };
    }

    /**
     * Check Azure Functions Extension.
     */
    private async checkAzureFunctionsExtension(): Promise<PrerequisiteResult> {
        const extensionId = 'ms-azuretools.vscode-azurefunctions';
        const extension = vscode.extensions.getExtension(extensionId);
        const isInstalled = extension !== undefined;

        return {
            id: 'azure-functions',
            name: 'Azure Functions',
            description: 'Required for local functions runtime integration and development tasks',
            status: isInstalled ? 'installed' : 'missing',
            required: true,
            version: extension?.packageJSON?.version,
            extensionId,
            helpUrl: `https://marketplace.visualstudio.com/items?itemName=${extensionId}`,
            action: isInstalled
                ? undefined
                : {
                      label: 'Install Extension',
                      command: 'workbench.extensions.installExtension',
                  },
        };
    }

    /**
     * Check GitHub Copilot.
     */
    private async checkGitHubCopilot(): Promise<PrerequisiteResult> {
        const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
        const copilotChatExtension = vscode.extensions.getExtension('GitHub.copilot-chat');

        const isInstalled = copilotExtension !== undefined || copilotChatExtension !== undefined;

        return {
            id: 'github-copilot',
            name: 'GitHub Copilot',
            description: 'Recommended for AI-powered analysis and suggestions',
            status: isInstalled ? 'installed' : 'recommended',
            required: false,
            version:
                copilotExtension?.packageJSON?.version ??
                copilotChatExtension?.packageJSON?.version,
            helpUrl: 'https://marketplace.visualstudio.com/items?itemName=GitHub.copilot',
            action: isInstalled
                ? undefined
                : {
                      label: 'Install Copilot',
                      command: 'workbench.extensions.installExtension',
                  },
        };
    }

    /**
     * Check Azure CLI availability.
     */
    private async checkAzureCLI(): Promise<PrerequisiteResult> {
        const installUrl = 'https://docs.microsoft.com/cli/azure/install-azure-cli';

        try {
            const { stdout, stderr } = await execAsync('az --version', { timeout: 10000 });
            const output = `${stdout || ''}${stderr || ''}`.trim();
            const match = output.match(/azure-cli\s+(\d+\.\d+\.\d+)/i);

            return {
                id: 'azure-cli',
                name: 'Azure CLI',
                description: 'Required for Azure provisioning and deployment',
                status: 'installed',
                required: true,
                version: match?.[1],
                helpUrl: installUrl,
            };
        } catch {
            return {
                id: 'azure-cli',
                name: 'Azure CLI',
                description: 'Required for Azure provisioning and deployment',
                status: 'missing',
                required: true,
                helpUrl: installUrl,
                action: {
                    label: 'Install Azure CLI',
                    url: installUrl,
                },
            };
        }
    }

    /**
     * Check Docker availability.
     */
    private async checkDocker(): Promise<PrerequisiteResult> {
        const installUrl = 'https://docs.docker.com/desktop/setup/install/windows-install/';

        try {
            const { stdout, stderr } = await execAsync('docker --version', { timeout: 5000 });
            const output = `${stdout || ''}${stderr || ''}`.trim();
            const match = output.match(/(\d+\.\d+\.\d+)/);

            return {
                id: 'docker',
                name: 'Docker Desktop',
                description: 'Required - used for local test dependencies and emulators',
                status: 'installed',
                required: true,
                version: match?.[1],
                helpUrl: installUrl,
            };
        } catch {
            return {
                id: 'docker',
                name: 'Docker Desktop',
                description: 'Required - used for local test dependencies and emulators',
                status: 'missing',
                required: true,
                helpUrl: installUrl,
                action: {
                    label: 'Install Docker',
                    url: installUrl,
                },
            };
        }
    }

    /**
     * Compare two semantic versions.
     * Returns: 1 if a > b, -1 if a < b, 0 if equal
     */
    private compareVersions(a: string, b: string): number {
        const partsA = a.split('.').map((p) => parseInt(p, 10) || 0);
        const partsB = b.split('.').map((p) => parseInt(p, 10) || 0);

        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0;
            const numB = partsB[i] || 0;

            if (numA > numB) {
                return 1;
            }
            if (numA < numB) {
                return -1;
            }
        }

        return 0;
    }

    /**
     * Show notification if prerequisites are missing.
     */
    public async showNotificationIfNeeded(result: PrerequisitesCheckResult): Promise<void> {
        if (!result.allRequiredMet) {
            const installAction = UserPrompts.BUTTON_INSTALL_REQUIRED;
            const learnMore = UserPrompts.BUTTON_LEARN_MORE;

            const response = await vscode.window.showWarningMessage(
                UserPrompts.missingRequiredExtensions(result.missingRequiredCount),
                installAction,
                learnMore
            );

            if (response === installAction) {
                const missingRequired = result.results.filter(
                    (r) => r.required && r.status === 'missing'
                );

                for (const prereq of missingRequired) {
                    if (prereq.extensionId) {
                        await vscode.commands.executeCommand(
                            'workbench.extensions.installExtension',
                            prereq.extensionId
                        );
                        continue;
                    }

                    if (prereq.action?.url) {
                        await vscode.env.openExternal(vscode.Uri.parse(prereq.action.url));
                    }
                }
            } else if (response === learnMore) {
                await vscode.env.openExternal(
                    vscode.Uri.parse(
                        'https://github.com/microsoft/integration-migration-agent#prerequisites'
                    )
                );
            }
        } else if (result.missingRecommendedCount > 0) {
            const showRecommendedNotice = true;

            if (showRecommendedNotice) {
                const install = UserPrompts.BUTTON_INSTALL;
                const dontShowAgain = UserPrompts.BUTTON_DONT_SHOW_AGAIN;

                const response = await vscode.window.showInformationMessage(
                    UserPrompts.COPILOT_RECOMMENDED,
                    install,
                    dontShowAgain
                );

                if (response === install) {
                    await vscode.commands.executeCommand(
                        'workbench.extensions.installExtension',
                        'GitHub.copilot'
                    );
                } else if (response === dontShowAgain) {
                    // User dismissed — no-op since setting is hardcoded
                }
            }
        }
    }
}

/**
 * Get the singleton instance of PrerequisitesChecker.
 */
export function getPrerequisitesChecker(): PrerequisitesChecker {
    return PrerequisitesChecker.getInstance();
}
