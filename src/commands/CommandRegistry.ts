/**
 * Command Registry - Centralized command management
 *
 * Handles registration of all VS Code commands for the extension.
 * Commands are registered with proper disposal tracking.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { LoggingService } from '../services/LoggingService';
import { TelemetryService } from '../services/TelemetryService';
import { StateManager } from '../services/StateManager';
import { ErrorHandler } from '../errors/ErrorHandler';
import { MsiExtractorService } from '../services/MsiExtractorService';
import { DiscoveryService } from '../stages/discovery';
import { PlanningService } from '../stages/planning';
import { ConversionService } from '../stages/conversion';
import { AgentFileProvisioner } from '../services/AgentFileProvisioner';
import { DiscoveryWebviewPanel, SourceFlowVisualizer } from '../views/discovery';
import { PlanningWebviewPanel } from '../views/planning';
import { ConversionWebviewPanel } from '../views/conversion';
import { UserPrompts } from '../constants/UserMessages';
import { ChatPrompts } from '../constants/ChatPrompts';
import type { GeneratedFlowResult } from '../services/LLMFlowGenerator';

/**
 * Command handler function type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommandHandler = (...args: any[]) => unknown | Promise<unknown>;

/**
 * Command definition with metadata
 */
interface CommandDefinition {
    id: string;
    handler: CommandHandler;
    title?: string;
}

/**
 * Singleton class for managing command registration
 */
export class CommandRegistry implements vscode.Disposable {
    private static instance: CommandRegistry | undefined;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly registeredCommands = new Map<string, vscode.Disposable>();

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): CommandRegistry {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }

    /**
     * Register all extension commands
     */
    public registerAll(context: vscode.ExtensionContext): void {
        const commands: CommandDefinition[] = [
            {
                id: 'logicAppsMigrationAgent.start',
                handler: this.handleStartMigration.bind(this),
                title: 'Start Migration',
            },
            {
                id: 'logicAppsMigrationAgent.openSidebar',
                handler: this.handleOpenSidebar.bind(this),
                title: 'Open Sidebar',
            },
            {
                id: 'logicAppsMigrationAgent.selectSourceFolder',
                handler: this.handleSelectSourceFolder.bind(this),
                title: 'Select Source Folder',
            },
            {
                id: 'logicAppsMigrationAgent.viewMigrationPlan',
                handler: this.handleViewMigrationPlan.bind(this),
                title: 'View Migration Plan',
            },
            {
                id: 'logicAppsMigrationAgent.resetMigration',
                handler: this.handleResetMigration.bind(this),
                title: 'Reset Migration',
            },
            {
                id: 'logicAppsMigrationAgent.showLogs',
                handler: this.handleShowLogs.bind(this),
                title: 'Show Logs',
            },
            {
                id: 'logicAppsMigrationAgent.checkPrerequisites',
                handler: this.handleCheckPrerequisites.bind(this),
                title: 'Check Prerequisites',
            },
            // Discovery Stage Commands (Phase 6)
            {
                id: 'logicAppsMigrationAgent.runDiscovery',
                handler: this.handleRunDiscovery.bind(this),
                title: 'Run Discovery',
            },
            {
                id: 'logicAppsMigrationAgent.rescanArtifacts',
                handler: this.handleRescanArtifacts.bind(this),
                title: 'Rescan Artifacts',
            },
            {
                id: 'logicAppsMigrationAgent.viewFlowVisualization',
                handler: this.handleViewFlowVisualization.bind(this),
                title: 'View Flow Visualization',
            },
            {
                id: 'logicAppsMigrationAgent.viewDependencyGraph',
                handler: this.handleViewDependencyGraph.bind(this),
                title: 'View Dependency Graph',
            },
            // Planning Stage Commands
            {
                id: 'logicAppsMigrationAgent.openPlanningView',
                handler: this.handleOpenPlanningView.bind(this),
                title: 'Open Planning View',
            },
            {
                id: 'logicAppsMigrationAgent.generatePlanForFlow',
                handler: this.handleGeneratePlanForFlow.bind(this),
                title: 'Generate Plan for Flow',
            },
            // Conversion Stage Commands
            {
                id: 'logicAppsMigrationAgent.openConversionView',
                handler: this.handleOpenConversionView.bind(this),
                title: 'Open Conversion View',
            },
            {
                id: 'logicAppsMigrationAgent.generateConversionForFlow',
                handler: this.handleGenerateConversionForFlow.bind(this),
                title: 'Generate Conversion for Flow',
            },
            {
                id: 'logicAppsMigrationAgent.executeConversionTask',
                handler: this.handleExecuteConversionTask.bind(this),
                title: 'Execute Conversion Task',
            },
            {
                id: 'logicAppsMigrationAgent.executeAllConversionTasks',
                handler: this.handleExecuteAllConversionTasks.bind(this),
                title: 'Execute All Conversion Tasks',
            },
            {
                id: 'logicAppsMigrationAgent.executeBlackBoxTest',
                handler: this.handleExecuteBlackBoxTest.bind(this),
                title: 'Execute Black Box Test',
            },
            // Export Report Commands
            {
                id: 'logicAppsMigrationAgent.exportAnalysisReport',
                handler: this.handleExportAnalysisReport.bind(this),
                title: 'Export Analysis Report',
            },
            {
                id: 'logicAppsMigrationAgent.exportPlanReport',
                handler: this.handleExportPlanReport.bind(this),
                title: 'Export Planning Report',
            },
        ];

        for (const command of commands) {
            this.registerCommand(context, command);
        }

        LoggingService.getInstance().info(`Registered ${commands.length} commands`);
    }

    /**
     * Register a single command with error handling and telemetry
     */
    private registerCommand(context: vscode.ExtensionContext, command: CommandDefinition): void {
        const wrappedHandler = this.wrapCommandHandler(command);
        const disposable = vscode.commands.registerCommand(command.id, wrappedHandler);

        this.registeredCommands.set(command.id, disposable);
        context.subscriptions.push(disposable);
        this.disposables.push(disposable);
    }

    /**
     * Wrap a command handler with error handling and telemetry
     */
    private wrapCommandHandler(command: CommandDefinition): CommandHandler {
        return async (...args: unknown[]) => {
            const startTime = Date.now();
            const logger = LoggingService.getInstance();
            const telemetry = TelemetryService.getInstance();

            try {
                logger.debug(`Executing command: ${command.id}`);
                telemetry.sendEvent('command.executed', { commandId: command.id });

                const result = await command.handler(...args);

                const duration = Date.now() - startTime;
                logger.debug(`Command ${command.id} completed in ${duration}ms`);
                telemetry.sendEvent('command.completed', {
                    commandId: command.id,
                    duration: duration.toString(),
                });

                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                telemetry.sendEvent('command.failed', {
                    commandId: command.id,
                    duration: duration.toString(),
                    error: error instanceof Error ? error.message : 'Unknown error',
                });

                ErrorHandler.getInstance().handleError(error, `Command: ${command.id}`);
                throw error;
            }
        };
    }

    // ==================== Command Handlers ====================

    /**
     * Handle starting a new migration
     */
    private async handleStartMigration(): Promise<void> {
        const stateManager = StateManager.getInstance();
        const existingPath = stateManager.getState().projectPath;

        // If a migration is already in progress, offer contextual actions
        if (existingPath) {
            // If the persisted folder no longer exists, reset and start fresh
            if (!fs.existsSync(existingPath)) {
                LoggingService.getInstance().warn(
                    `Persisted project path no longer exists: ${existingPath}. Resetting migration.`
                );
                const sm = StateManager.getInstance();
                await sm.resetState();
                await DiscoveryService.getInstance().reset();
                // Fall through to the welcome message below
            } else {
                const discoveryService = DiscoveryService.getInstance();
                const discoveryComplete = discoveryService.isDiscoveryComplete();

                if (discoveryComplete) {
                    // Discovery done — let user proceed or pick a new folder
                    const result = await vscode.window.showInformationMessage(
                        UserPrompts.migrationInProgress(path.basename(existingPath), 'Discovery'),
                        UserPrompts.BUTTON_VIEW_RESULTS,
                        UserPrompts.BUTTON_CHANGE_SOURCE_FOLDER
                    );

                    if (result === UserPrompts.BUTTON_VIEW_RESULTS) {
                        await vscode.commands.executeCommand(
                            'logicAppsMigrationAgent.viewDependencyGraph'
                        );
                    } else if (result === UserPrompts.BUTTON_CHANGE_SOURCE_FOLDER) {
                        await vscode.commands.executeCommand(
                            'logicAppsMigrationAgent.selectSourceFolder'
                        );
                    }
                } else {
                    // Discovery not yet complete — offer to run it or change folder
                    const result = await vscode.window.showInformationMessage(
                        UserPrompts.sourceFolderSelectedNotComplete(path.basename(existingPath)),
                        UserPrompts.BUTTON_RUN_DISCOVERY,
                        UserPrompts.BUTTON_CHANGE_SOURCE_FOLDER
                    );

                    if (result === UserPrompts.BUTTON_RUN_DISCOVERY) {
                        await vscode.commands.executeCommand(
                            'logicAppsMigrationAgent.runDiscovery'
                        );
                    } else if (result === UserPrompts.BUTTON_CHANGE_SOURCE_FOLDER) {
                        await vscode.commands.executeCommand(
                            'logicAppsMigrationAgent.selectSourceFolder'
                        );
                    }
                }
                return;
            }
        }

        // No migration in progress — go directly to folder selection
        await vscode.commands.executeCommand('logicAppsMigrationAgent.selectSourceFolder');
    }

    /**
     * Handle opening the sidebar
     */
    private async handleOpenSidebar(): Promise<void> {
        await vscode.commands.executeCommand('logicAppsMigrationAgent.discovery.focus');
    }

    /**
     * Handle selecting source folder for migration
     */
    private async handleSelectSourceFolder(folderUri?: vscode.Uri): Promise<void> {
        let selectedPath: string | undefined;

        // If folder URI is passed (e.g., from auto-detection), use it directly
        if (folderUri) {
            selectedPath = folderUri.fsPath;
        } else {
            // Show picker that accepts both folders and MSI files
            const folderUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: UserPrompts.SELECT_SOURCE_FOLDER_OPEN_LABEL,
                title: UserPrompts.SELECT_SOURCE_FOLDER_TITLE,
                filters: {
                    'All Supported': ['msi'],
                },
            });

            if (folderUris && folderUris.length > 0) {
                selectedPath = folderUris[0].fsPath;
            }
        }

        if (selectedPath) {
            // If the user selected an MSI file, resolve its parent folder
            // so we can scan the folder for all MSI files.
            const isMsiFile = selectedPath.toLowerCase().endsWith('.msi');
            let msiSourceFolder: string | undefined;
            if (isMsiFile) {
                msiSourceFolder = path.dirname(selectedPath);
            } else {
                // Check if the selected folder contains MSI files
                const extractor = MsiExtractorService.getInstance();
                const msiFiles = await extractor.findMsiFiles(selectedPath);
                if (msiFiles.length > 0) {
                    msiSourceFolder = selectedPath;
                }
            }

            // If MSI files are present, extract them first
            if (msiSourceFolder) {
                const extractor = MsiExtractorService.getInstance();
                if (!extractor.isPlatformSupported()) {
                    vscode.window.showErrorMessage(UserPrompts.MSI_EXTRACTION_WINDOWS_ONLY);
                    return;
                }

                const msiFiles = await extractor.findMsiFiles(msiSourceFolder);
                const msiNames = msiFiles.map((f) => path.basename(f)).join(', ');
                const confirm = await vscode.window.showInformationMessage(
                    UserPrompts.msiFilesFound(msiFiles.length, msiNames),
                    UserPrompts.BUTTON_EXTRACT_AND_DISCOVER,
                    UserPrompts.BUTTON_CANCEL
                );

                if (confirm !== UserPrompts.BUTTON_EXTRACT_AND_DISCOVER) {
                    return;
                }

                // Determine output directory for extraction
                const extractionRoot = path.join(msiSourceFolder, '__msi_extracted__');

                const extractionResults = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: UserPrompts.PROGRESS_EXTRACTING_MSI,
                        cancellable: false,
                    },
                    async (progress) => {
                        return extractor.extractAllMsiInFolder(
                            msiSourceFolder as string,
                            extractionRoot,
                            (p) => {
                                progress.report({
                                    message: p.message,
                                });
                            }
                        );
                    }
                );

                const successCount = extractionResults.filter((r) => r.success).length;
                const totalLeaves = extractionResults.reduce(
                    (sum, r) => sum + r.extractedFiles.length,
                    0
                );

                if (successCount === 0) {
                    const errors = extractionResults
                        .map((r) => r.error)
                        .filter(Boolean)
                        .join('; ');
                    vscode.window.showErrorMessage(
                        UserPrompts.msiExtractionFailed(errors || 'Unknown error')
                    );
                    return;
                }

                // Determine the best path to point discovery at:
                // - If single MSI, use its subdirectory directly (avoids __msi_extracted__ as project name)
                // - If multiple MSIs, use the extraction root
                const successResults = extractionResults.filter((r) => r.success);
                if (successResults.length === 1) {
                    selectedPath = successResults[0].extractedPath;
                } else {
                    selectedPath = extractionRoot;
                }

                vscode.window.showInformationMessage(
                    UserPrompts.msiExtractionSuccess(totalLeaves, successCount)
                );
            }

            LoggingService.getInstance().info(`Source folder selected: ${selectedPath}`);

            const discoveryService = DiscoveryService.getInstance();

            // Check if we need to reset (different folder selected while migration in progress)
            const stateManager = StateManager.getInstance();
            const existingPath = stateManager.getState().projectPath;
            if (existingPath) {
                if (existingPath && existingPath !== selectedPath) {
                    const confirm = await vscode.window.showWarningMessage(
                        UserPrompts.MIGRATION_RESET_WARNING,
                        { modal: true },
                        UserPrompts.BUTTON_RESET_AND_CONTINUE,
                        UserPrompts.BUTTON_CANCEL
                    );

                    if (confirm !== UserPrompts.BUTTON_RESET_AND_CONTINUE) {
                        return;
                    }

                    // Reset state and discovery
                    await stateManager.resetState();
                    await discoveryService.reset();
                    LoggingService.getInstance().info('Migration reset for new source folder');
                } else if (existingPath === selectedPath) {
                    // Same folder already discovered — skip redundant re-scan.
                    // This happens on VS Code restart when auto-detection re-triggers
                    // for a folder that was already discovered in a previous session.
                    // Re-scanning would generate new random artifact IDs, breaking
                    // any cached flow groups or other data that references the old IDs.
                    const existingInventory = discoveryService.getCurrentInventory();
                    if (existingInventory && existingInventory.items.length > 0) {
                        LoggingService.getInstance().info(
                            'Skipping redundant discovery — same folder already discovered',
                            {
                                path: selectedPath,
                                artifactCount: existingInventory.items.length,
                            }
                        );

                        // If flow groups haven't been detected yet, trigger detection
                        try {
                            const { DiscoveryCacheService } =
                                await import('../stages/discovery/DiscoveryCacheService');
                            if (!DiscoveryCacheService.getInstance().hasFlowGroups()) {
                                await this.handleViewFlowVisualization();
                            }
                        } catch (err) {
                            LoggingService.getInstance().warn(
                                `Failed to auto-start flow group detection: ${err instanceof Error ? err.message : String(err)}`
                            );
                        }

                        return;
                    }
                }
            }

            // Keep the workflow in main-page mode without stage transitions

            // Check prerequisites before discovery
            try {
                const { PrerequisitesChecker } = await import('../services/PrerequisitesChecker');
                const prereqResult = await PrerequisitesChecker.getInstance().checkAll();
                if (!prereqResult.allRequiredMet) {
                    await PrerequisitesChecker.getInstance().showNotificationIfNeeded(prereqResult);
                    // Don't block — just warn and continue
                }
            } catch {
                // Non-critical — don't block discovery
            }

            // Run discovery with progress UI
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: UserPrompts.PROGRESS_RUNNING_DISCOVERY,
                    cancellable: true,
                },
                async (progress, _token) => {
                    // Subscribe to progress events
                    const progressListener = discoveryService.onProgress((event) => {
                        progress.report({
                            message: event.message,
                            increment:
                                event.phase === 'complete'
                                    ? 100 - (event.progress || 0)
                                    : undefined,
                        });
                    });

                    try {
                        const result = await discoveryService.runDiscovery(selectedPath);

                        if (result.success) {
                            const artifactCount = result.inventory?.items.length ?? 0;
                            vscode.window.showInformationMessage(
                                UserPrompts.discoveryComplete(artifactCount)
                            );
                        } else {
                            vscode.window.showWarningMessage(
                                UserPrompts.discoveryCancelled(
                                    result.error?.message ?? 'Unknown reason'
                                )
                            );
                        }
                    } finally {
                        progressListener.dispose();
                    }
                }
            );
        }
    }

    /**
     * Handle viewing migration plan
     */
    private async handleViewMigrationPlan(): Promise<void> {
        await vscode.commands.executeCommand('logicAppsMigrationAgent.openPlanningView');
    }

    /**
     * Handle resetting the migration
     */
    private async handleResetMigration(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            UserPrompts.RESET_MIGRATION_CONFIRM,
            { modal: true },
            UserPrompts.BUTTON_RESET,
            UserPrompts.BUTTON_CANCEL
        );

        if (confirm === UserPrompts.BUTTON_RESET) {
            const logger = LoggingService.getInstance();
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

            // Capture project path before reset (needed for agent file removal)
            const projectPath = StateManager.getInstance().getState().projectPath;

            // Reset discovery service", "oldString": "            const logger = LoggingService.getInstance();\n            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];\n\n            // Reset state\n            const stateManager = StateManager.getInstance();\n            await stateManager.resetState();\n\n            // Reset discovery service
            const discoveryService = DiscoveryService.getInstance();
            await discoveryService.reset();

            // Clear flow visualization cache
            SourceFlowVisualizer.clearCache();

            // Close all open webview panels
            SourceFlowVisualizer.closeAllPanels();
            if (DiscoveryWebviewPanel.currentPanel) {
                DiscoveryWebviewPanel.currentPanel.dispose();
            }
            if (PlanningWebviewPanel.currentPanel) {
                PlanningWebviewPanel.currentPanel.dispose();
            }
            if (ConversionWebviewPanel.currentPanel) {
                ConversionWebviewPanel.currentPanel.dispose();
            }

            // Clear discovery cache (flow groups + per-flow analysis on disk)
            const { DiscoveryCacheService } =
                await import('../stages/discovery/DiscoveryCacheService');
            await DiscoveryCacheService.getInstance().clearAll();

            // Reset planning phase — memory + disk
            const planningService = PlanningService.getInstance();
            await planningService.reset();

            const { PlanningCacheService } =
                await import('../stages/planning/PlanningCacheService');
            await PlanningCacheService.getInstance().clearAll();

            const { PlanningFileService } = await import('../stages/planning/PlanningFileService');
            PlanningFileService.getInstance().removeAll();

            // Reset conversion phase — memory + disk
            const conversionService = ConversionService.getInstance();
            await conversionService.reset();

            const { ConversionFileService } =
                await import('../stages/conversion/ConversionFileService');
            ConversionFileService.getInstance().removeAll();

            // Stop any running local Functions host processes.
            await this.killFuncProcesses();

            // Delete generated conversion output projects under /out.
            if (workspaceFolder) {
                this.deleteOutFolder(workspaceFolder.uri.fsPath);
            }

            // Delete the entire .vscode/migration folder from disk
            try {
                if (workspaceFolder) {
                    const migrationDir = path.join(
                        workspaceFolder.uri.fsPath,
                        '.vscode',
                        'migration'
                    );
                    if (fs.existsSync(migrationDir)) {
                        fs.rmSync(migrationDir, { recursive: true, force: true });
                        logger.info(`[Reset] Deleted .vscode/migration folder: ${migrationDir}`);
                    }
                }
            } catch (fsErr) {
                logger.warn(`[Reset] Failed to delete .vscode/migration folder: ${fsErr}`);
            }

            // Remove provisioned agent files
            try {
                const provisioner = AgentFileProvisioner.getInstance();
                if (projectPath) {
                    await provisioner.remove(projectPath);
                }
            } catch {
                // Non-critical
            }

            // Reset state manager (clears projectPath, inventory, stage, etc.)
            await StateManager.getInstance().resetState();

            logger.info('Migration reset by user');
            await vscode.window.showInformationMessage(UserPrompts.MIGRATION_HAS_BEEN_RESET);
        }
    }

    private async killFuncProcesses(): Promise<void> {
        const logger = LoggingService.getInstance();
        try {
            if (process.platform === 'win32') {
                const listOutput = cp.execSync('tasklist /FI "IMAGENAME eq func.exe" /NH', {
                    encoding: 'utf8',
                });

                if (listOutput.toLowerCase().includes('func.exe')) {
                    cp.execSync('taskkill /F /IM func.exe /T', { stdio: 'ignore' });
                    logger.info('[Reset] Killed running func.exe process(es).');
                }
                return;
            }

            cp.execSync('pkill -f "(^|[\\/])func(\\.exe)?(\\s|$)"', { stdio: 'ignore' });
            logger.info('[Reset] Killed running func process(es).');
        } catch {
            // Non-critical: ignore when no process exists or command is unavailable.
        }
    }

    private deleteOutFolder(workspaceRoot: string): void {
        const logger = LoggingService.getInstance();
        try {
            const outDir = path.join(workspaceRoot, 'out');
            if (fs.existsSync(outDir)) {
                fs.rmSync(outDir, { recursive: true, force: true });
                logger.info(`[Reset] Deleted output folder: ${outDir}`);
            }
        } catch (error) {
            logger.warn(`[Reset] Failed to delete out folder: ${String(error)}`);
        }
    }

    /**
     * Handle showing extension logs
     */
    private async handleShowLogs(): Promise<void> {
        LoggingService.getInstance().showOutputChannel();
    }

    /**
     * Handle checking prerequisites
     */
    private async handleCheckPrerequisites(): Promise<void> {
        const { PrerequisitesChecker } = await import('../services/PrerequisitesChecker');
        const checker = PrerequisitesChecker.getInstance();

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Checking prerequisites...',
            },
            async () => checker.checkAll()
        );

        if (result.allRequiredMet && result.missingRecommendedCount === 0) {
            vscode.window.showInformationMessage(
                `All prerequisites are met (${result.results.filter((r) => r.status === 'installed').length} checks passed).`
            );
        } else {
            await checker.showNotificationIfNeeded(result);
        }
    }

    // ==================== Discovery Stage Commands ====================

    /**
     * Handle running full discovery process
     */
    private async handleRunDiscovery(): Promise<void> {
        const discoveryService = DiscoveryService.getInstance();

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: UserPrompts.PROGRESS_RUNNING_DISCOVERY,
                cancellable: true,
            },
            async (progress, _token) => {
                discoveryService.onProgress((event) => {
                    progress.report({
                        message: event.message,
                        increment: event.progress / 100,
                    });
                });

                const result = await discoveryService.runDiscoveryWithProgress();

                if (result.success) {
                    vscode.window.showInformationMessage(
                        UserPrompts.discoveryCompleteCount(
                            result.inventory?.statistics.totalCount || 0
                        )
                    );

                    // Show discovery results panel
                    if (result.inventory && result.dependencyGraph) {
                        DiscoveryWebviewPanel.createOrShow(vscode.Uri.file(__dirname));

                        // Auto-start logical group detection if groups are not available yet
                        try {
                            const { DiscoveryCacheService } =
                                await import('../stages/discovery/DiscoveryCacheService');
                            const hasGroups = DiscoveryCacheService.getInstance().hasFlowGroups();
                            if (!hasGroups) {
                                await this.handleViewFlowVisualization();
                            }
                        } catch (autoDetectError) {
                            LoggingService.getInstance().warn(
                                `[Discovery] Failed to auto-start logical group detection: ${autoDetectError instanceof Error ? autoDetectError.message : String(autoDetectError)}`
                            );
                        }
                    }
                } else {
                    vscode.window.showErrorMessage(
                        UserPrompts.discoveryFailed(result.error?.message || 'Unknown error')
                    );
                }
            }
        );
    }

    /**
     * Handle rescanning artifacts
     */
    private async handleRescanArtifacts(): Promise<void> {
        const discoveryService = DiscoveryService.getInstance();

        try {
            const result = await discoveryService.rescan();

            if (result && result.success) {
                vscode.window.showInformationMessage(
                    UserPrompts.rescanComplete(result.inventory?.statistics.totalCount || 0)
                );

                // Auto-start logical group detection if groups are not available yet
                try {
                    const { DiscoveryCacheService } =
                        await import('../stages/discovery/DiscoveryCacheService');
                    const hasGroups = DiscoveryCacheService.getInstance().hasFlowGroups();
                    if (!hasGroups) {
                        await this.handleViewFlowVisualization();
                    }
                } catch (autoDetectError) {
                    LoggingService.getInstance().warn(
                        `[Discovery] Failed to auto-start logical group detection after rescan: ${autoDetectError instanceof Error ? autoDetectError.message : String(autoDetectError)}`
                    );
                }
            } else if (result) {
                vscode.window.showErrorMessage(
                    UserPrompts.rescanFailed(result.error?.message || 'Unknown error')
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                UserPrompts.rescanFailed(error instanceof Error ? error.message : 'Unknown error')
            );
        }
    }

    /**
     * Handle viewing flow visualization.
     * Always shows the flow group selector (home page).
     * Users access Planning/Conversion views through the flow card buttons.
     */
    private async handleViewFlowVisualization(_arg?: unknown): Promise<void> {
        // Prevent concurrent initial flow visualizations — use the shared static flag
        // that the GenerateVisualizationTool sets/clears during generation.
        if (SourceFlowVisualizer.isInitialGenerating) {
            if (SourceFlowVisualizer.currentPanel) {
                SourceFlowVisualizer.currentPanel.reveal();
            } else {
                const extensionUri =
                    vscode.extensions.getExtension('logicapps-migration-assistant')?.extensionUri ??
                    vscode.Uri.file(__dirname);
                SourceFlowVisualizer.showLoading(extensionUri, 'Detecting logical groups...');
            }
            return;
        }

        // If the webview panel is already open, just reveal it
        if (SourceFlowVisualizer.currentPanel) {
            SourceFlowVisualizer.currentPanel.reveal();
            return;
        }

        // Get inventory service to select an artifact
        const discoveryService = DiscoveryService.getInstance();
        const inventory = discoveryService.getCurrentInventory();

        if (!inventory || inventory.statistics.totalCount === 0) {
            vscode.window.showWarningMessage(UserPrompts.NO_ARTIFACTS_RUN_DISCOVERY);
            return;
        }

        // NEW FLOW: Open discovery webview, which handles flow group detection & per-flow analysis
        const extensionUri =
            vscode.extensions.getExtension('logicapps-migration-assistant')?.extensionUri ??
            vscode.Uri.file(__dirname);

        const stateManager = StateManager.getInstance();
        const state = stateManager.getState();
        const folderName = state.projectPath
            ? state.projectPath.split(/[\\/]/).pop() || 'Integration'
            : 'Integration';

        // Check if we have flow groups in the new DiscoveryCacheService
        const { DiscoveryCacheService } = await import('../stages/discovery/DiscoveryCacheService');
        const discoveryCacheService = DiscoveryCacheService.getInstance();

        if (discoveryCacheService.hasFlowGroups()) {
            // Flow groups exist — always show the flow group selector
            // so the user can pick which flow to view or analyse
            SourceFlowVisualizer.showFlowGroupSelector(extensionUri);
            return;
        }

        // No flow groups detected yet — check old cache first (backward compat)
        const cached = await SourceFlowVisualizer.getCachedVisualizationAsync();
        if (cached) {
            await SourceFlowVisualizer.showWithResult(
                extensionUri,
                cached.artifacts,
                cached.result,
                `${folderName} Architecture`,
                vscode.ViewColumn.Active
            );
            return;
        }

        // No cache at all — open webview with loading state, then start flow group detection

        // Open webview immediately with a loading spinner
        SourceFlowVisualizer.showLoading(extensionUri, 'Detecting logical groups...');
        SourceFlowVisualizer.isInitialGenerating = true;

        try {
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                mode: 'agent',
                query: ChatPrompts.flowGroupDetection(),
            });
        } catch (error) {
            SourceFlowVisualizer.isInitialGenerating = false;
            vscode.window.showErrorMessage(
                UserPrompts.flowGroupDetectionFailed(
                    error instanceof Error ? error.message : String(error)
                )
            );
        }
    }

    /**
     * Handle viewing dependency graph
     */
    private async handleViewDependencyGraph(): Promise<void> {
        // Dependency graph is shown within the Discovery Results panel
        vscode.window.showInformationMessage(UserPrompts.DEPENDENCY_GRAPH_IN_DISCOVERY);

        // Show discovery results panel which includes dependency info
        const discoveryService = DiscoveryService.getInstance();
        const inventory = discoveryService.getCurrentInventory();
        const graph = discoveryService.getCurrentDependencyGraph();

        if (inventory && graph) {
            DiscoveryWebviewPanel.createOrShow(vscode.Uri.file(__dirname));
        } else {
            vscode.window.showWarningMessage(UserPrompts.NO_DISCOVERY_RESULTS);
        }
    }

    // ==================== Planning Stage Commands ====================

    /**
     * Handle opening the planning webview.
     * Automatically loads discovered flows and displays the planning panel.
     */
    private async handleOpenPlanningView(): Promise<void> {
        // Ensure planning service has flows loaded
        const planningService = PlanningService.getInstance();
        const flows = planningService.getFlows();
        if (flows.length === 0) {
            planningService.buildFlowsFromDiscovery();
        }

        // Open the planning webview
        PlanningWebviewPanel.createOrShow(vscode.Uri.file(__dirname));
    }

    /**
     * Handle generating a migration plan for a specific flow.
     * Opens the @migration-planner agent chat to analyse the flow and produce
     * a target Logic Apps Standard architecture diagram.
     */
    private async handleGeneratePlanForFlow(flowId?: string): Promise<void> {
        const logger = LoggingService.getInstance();

        if (!flowId) {
            vscode.window.showWarningMessage(UserPrompts.NO_FLOW_SPECIFIED_PLANNING);
            return;
        }

        logger.info(`[Planning] handleGeneratePlanForFlow called for: ${flowId}`);

        // Do NOT call planningService.selectFlow here — it fires state-change events
        // that would update any existing PlanningWebviewPanel. The webview opens only
        // when the user clicks "✓ Planned" from the flow group page.
        const planningService = PlanningService.getInstance();

        // Get flow details for the prompt
        const flow = planningService.getFlows().find((f) => f.id === flowId);
        const flowName = flow?.name || flowId;
        const artifactIds = flow?.artifactIds || [];
        const artifactList =
            artifactIds.length > 0
                ? `The flow contains these artifact IDs: ${artifactIds.join(', ')}.`
                : '';

        // Ensure the @migration-planner agent file is provisioned
        try {
            const stateManager = StateManager.getInstance();
            const projectPath = stateManager.getState().projectPath;
            if (projectPath) {
                await AgentFileProvisioner.getInstance().provision(projectPath);
                logger.info('[Planning] Agent files provisioned successfully');
            }
        } catch (err) {
            logger.warn(
                `[Planning] Failed to provision agent files: ${err instanceof Error ? err.message : String(err)}`
            );
        }

        // Show user feedback
        vscode.window.showInformationMessage(UserPrompts.generatingPlanForFlow(flowName));

        // Open VS Code agent chat with @migration-planner
        try {
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                mode: 'agent',
                query: ChatPrompts.planForFlow({
                    flowName,
                    flowId: flowId as string,
                    artifactList,
                }),
            });
            logger.info('[Planning] Agent chat opened successfully');
        } catch (err) {
            logger.error(
                `[Planning] Failed to open agent chat: ${err instanceof Error ? err.message : String(err)}`
            );
            vscode.window.showErrorMessage(
                UserPrompts.failedToOpenAgentChatPlanning(
                    err instanceof Error ? err.message : String(err)
                )
            );
        }
    }

    // =========================================================================
    // Conversion Stage Handlers
    // =========================================================================

    /**
     * Handle opening the Conversion webview.
     */
    private async handleOpenConversionView(): Promise<void> {
        // Ensure conversion service has flows loaded (initialize loads persisted state from disk)
        const conversionService = ConversionService.getInstance();
        await conversionService.initialize();
        const flows = conversionService.getFlows();
        if (flows.length === 0) {
            conversionService.buildFlowsFromPlanning();
        }

        // Open the conversion webview
        ConversionWebviewPanel.createOrShow(vscode.Uri.file(__dirname));
    }

    /**
     * Handle generating conversion tasks for a specific flow.
     * Opens the @migration-converter agent chat to analyse the planning
     * results and produce an ordered conversion task plan.
     */
    private async handleGenerateConversionForFlow(flowId?: string): Promise<void> {
        const logger = LoggingService.getInstance();

        if (!flowId) {
            vscode.window.showWarningMessage(UserPrompts.NO_FLOW_SPECIFIED_CONVERSION);
            return;
        }

        logger.info(`[Conversion] handleGenerateConversionForFlow called for: ${flowId}`);

        // Do NOT call conversionService.selectFlow here — it fires state-change events
        // that would update any existing ConversionWebviewPanel. The webview opens only
        // when the user clicks "✓ Converted" from the flow group page.
        const conversionService = ConversionService.getInstance();

        // Get flow details for the prompt
        const flow = conversionService.getFlows().find((f) => f.id === flowId);
        const flowName = flow?.name || flowId;

        // Ensure the @migration-converter agent file is provisioned
        try {
            const stateManager = StateManager.getInstance();
            const projectPath = stateManager.getState().projectPath;
            if (projectPath) {
                await AgentFileProvisioner.getInstance().provision(projectPath);
                logger.info('[Conversion] Agent files provisioned successfully');
            }
        } catch (err) {
            logger.warn(
                `[Conversion] Failed to provision agent files: ${err instanceof Error ? err.message : String(err)}`
            );
        }

        // Show user feedback
        vscode.window.showInformationMessage(UserPrompts.analysingConversionTasks(flowName));

        // Read Azure settings from VS Code configuration
        const azureConfig = vscode.workspace.getConfiguration('logicAppsMigrationAgent.azure');
        const azureResourceGroup = azureConfig.get<string>(
            'resourceGroup',
            'integration-migration-tool-test-rg'
        );
        const azureLocation = azureConfig.get<string>('location', 'eastus');
        const azureSubscriptionId = azureConfig.get<string>('subscriptionId', '');
        const outputProjectName = flowName
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const outputProjectRoot = `out/${outputProjectName}`;
        const outputLogicAppName = `${outputProjectName}-logicapp`;
        const outputLogicAppRoot = `${outputProjectRoot}/${outputLogicAppName}`;

        // Open VS Code agent chat with @migration-converter
        try {
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                mode: 'agent',
                query: ChatPrompts.conversionForFlow({
                    flowName,
                    flowId: flowId as string,
                    azureResourceGroup,
                    azureLocation,
                    azureSubscriptionId,
                    outputProjectName,
                    outputProjectRoot,
                    outputLogicAppName,
                    outputLogicAppRoot,
                }),
            });
            logger.info('[Conversion] Agent chat opened successfully');
        } catch (err) {
            logger.error(
                `[Conversion] Failed to open agent chat: ${err instanceof Error ? err.message : String(err)}`
            );
            vscode.window.showErrorMessage(
                UserPrompts.failedToOpenAgentChatConversion(
                    err instanceof Error ? err.message : String(err)
                )
            );
        }
    }

    /**
     * Handle executing a single conversion task.
     * Opens the @migration-converter agent chat with task-specific instructions
     * to execute the task, generate output files, and call storeTaskOutput.
     */
    private async handleExecuteConversionTask(
        flowId?: string,
        taskId?: string,
        context?: { origin?: string } | boolean
    ): Promise<void> {
        const logger = LoggingService.getInstance();

        if (!flowId || !taskId) {
            vscode.window.showWarningMessage(UserPrompts.NO_FLOW_OR_TASK_SPECIFIED);
            return;
        }

        logger.info(`[Conversion] handleExecuteConversionTask: flow=${flowId} task=${taskId}`);

        const conversionService = ConversionService.getInstance();
        const taskPlan = conversionService.getTaskPlan(flowId);

        if (!taskPlan) {
            vscode.window.showWarningMessage(UserPrompts.NO_TASK_PLAN_FOUND);
            return;
        }

        const task = taskPlan.tasks.find((t) => t.id === taskId);
        if (!task) {
            vscode.window.showWarningMessage(UserPrompts.taskNotFound(taskId));
            return;
        }

        const isExplicitSingleUiInvocation =
            context === true || (typeof context === 'object' && context?.origin === 'single-ui');

        // Only explicit UI single-task runs should exit Execute All mode.
        // Internal/generic task executions must not implicitly clear batch mode.
        if (isExplicitSingleUiInvocation) {
            await conversionService.setExecuteAllActive(flowId, false);
            SourceFlowVisualizer.executingGroupIds.delete(flowId);
            SourceFlowVisualizer.refreshFlowGroupSelectorIfOpen();
        }

        // Check dependencies
        const unmetDeps = task.dependsOn.filter((depId) => {
            const dep = taskPlan.tasks.find((t) => t.id === depId);
            return !dep || (dep.status !== 'completed' && dep.status !== 'skipped');
        });
        if (unmetDeps.length > 0) {
            vscode.window.showWarningMessage(
                UserPrompts.cannotExecuteTaskWaiting(task.name, unmetDeps.join(', '))
            );
            return;
        }

        // Mark task as in-progress
        await conversionService.updateTask(flowId, taskId, { status: 'in-progress' });

        // Ensure agent files are provisioned
        try {
            const stateManager = StateManager.getInstance();
            const projectPath = stateManager.getState().projectPath;
            if (projectPath) {
                await AgentFileProvisioner.getInstance().provision(projectPath);
            }
        } catch (err) {
            logger.warn(
                `[Conversion] Failed to provision agent files: ${err instanceof Error ? err.message : String(err)}`
            );
        }

        // Build context about completed tasks so the agent knows what's been done
        const completedTasks = taskPlan.tasks
            .filter((t) => t.status === 'completed' && t.output)
            .map(
                (t) =>
                    `- ${t.name}: ${t.output?.summary ?? ''}${t.output?.generatedFiles?.length ? ' (files: ' + t.output.generatedFiles.join(', ') + ')' : ''}`
            )
            .join('\n');

        const completedContext = completedTasks
            ? `\nAlready completed tasks:\n${completedTasks}\n`
            : '';

        const artifactContext = task.artifactIds?.length
            ? `This task operates on artifacts: ${task.artifactIds.join(', ')}. `
            : '';
        const taskExecutionPrompt = task.executionPrompt || task.description;
        const outputProjectName = taskPlan.flowName
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const outputProjectRoot = `out/${outputProjectName}`;
        const outputLogicAppName = `${outputProjectName}-logicapp`;
        const outputLogicAppRoot = `${outputProjectRoot}/${outputLogicAppName}`;

        // Extra instruction for scaffold tasks — must generate .code-workspace file
        const isScaffoldTask =
            task.type === 'scaffold-project' || task.type === 'scaffold' || task.order === 1;
        const scaffoldExtra = isScaffoldTask
            ? ChatPrompts.scaffoldExtra(
                  outputProjectName,
                  outputLogicAppName,
                  outputProjectRoot,
                  outputLogicAppRoot
              )
            : '';

        // Open agent chat for this specific task
        try {
            const azCfg = vscode.workspace.getConfiguration('logicAppsMigrationAgent.azure');
            const rg = azCfg.get<string>('resourceGroup', 'integration-migration-tool-test-rg');
            const loc = azCfg.get<string>('location', 'eastus');

            await vscode.commands.executeCommand('workbench.action.chat.open', {
                mode: 'agent',
                query: ChatPrompts.executeSingleTask({
                    taskName: task.name,
                    taskId: taskId as string,
                    flowName: taskPlan.flowName,
                    flowId: flowId as string,
                    taskType: task.type,
                    taskDescription: task.description,
                    taskExecutionPrompt,
                    taskOrder: task.order,
                    taskDependsOn: task.dependsOn.length > 0 ? task.dependsOn.join(', ') : 'none',
                    artifactContext,
                    completedContext,
                    scaffoldExtra,
                    outputProjectRoot,
                    outputLogicAppRoot,
                    resourceGroup: rg,
                    location: loc,
                }),
            });
            logger.info(`[Conversion] Agent chat opened for task: ${taskId}`);
        } catch (err) {
            // Revert status on failure
            await conversionService.updateTask(flowId, taskId, { status: 'pending' });
            logger.error(
                `[Conversion] Failed to open agent chat for task: ${err instanceof Error ? err.message : String(err)}`
            );
            vscode.window.showErrorMessage(
                UserPrompts.failedToStartTaskExecution(
                    err instanceof Error ? err.message : String(err)
                )
            );
        }
    }

    /**
     * Handle executing ALL conversion tasks sequentially.
     * Iterates through tasks in dependency order, executing each one
     * via the single-task handler and waiting for user/agent completion.
     */
    private async handleExecuteAllConversionTasks(flowId?: string): Promise<void> {
        const logger = LoggingService.getInstance();

        if (!flowId) {
            vscode.window.showWarningMessage(UserPrompts.NO_FLOW_SPECIFIED);
            return;
        }

        logger.info(`[Conversion] handleExecuteAllConversionTasks: flow=${flowId}`);

        // Mark flow as executing on the flow group page
        SourceFlowVisualizer.executingGroupIds.add(flowId);
        SourceFlowVisualizer.refreshFlowGroupSelectorIfOpen();

        const conversionService = ConversionService.getInstance();
        const taskPlan = conversionService.getTaskPlan(flowId);

        if (!taskPlan) {
            vscode.window.showWarningMessage(UserPrompts.NO_TASK_PLAN_FOUND);
            return;
        }

        // Keep UI in Execute All mode across task boundaries
        await conversionService.setExecuteAllActive(flowId, true);

        // Find the first pending/failed task whose dependencies are all met
        // Skip optional tasks (like cloud-deploy-test) — Execute All only runs required tasks
        const sortedTasks = [...taskPlan.tasks].sort((a, b) => a.order - b.order);
        const nextTask = sortedTasks.find((task) => {
            if (task.status !== 'pending' && task.status !== 'failed') {
                return false;
            }
            // Skip optional tasks in Execute All
            if (task.optional) {
                return false;
            }
            return task.dependsOn.every((depId) => {
                const dep = taskPlan.tasks.find((t) => t.id === depId);
                return dep && (dep.status === 'completed' || dep.status === 'skipped');
            });
        });

        if (!nextTask) {
            const allDone = sortedTasks.every(
                (t) =>
                    t.status === 'completed' ||
                    t.status === 'skipped' ||
                    (t.optional && t.status === 'pending')
            );
            await conversionService.setExecuteAllActive(flowId, false);
            SourceFlowVisualizer.refreshFlowGroupSelectorIfOpen();
            if (allDone) {
                vscode.window.showInformationMessage(UserPrompts.ALL_TASKS_COMPLETE);
            } else {
                vscode.window.showWarningMessage(UserPrompts.NO_EXECUTABLE_TASKS);
            }
            return;
        }

        // Execute the next task — the agent will call storeTaskOutput when done,
        // which updates the webview. The user can click "Convert All" again
        // to continue with the next task, or the agent prompt instructs it to
        // continue with remaining tasks.
        logger.info(
            `[Conversion] Convert All — starting task "${nextTask.id}" (${nextTask.name}) for flow ${flowId}`
        );

        // Build the list of remaining task IDs after the current one (exclude optional tasks)
        const remainingTasks = sortedTasks
            .filter(
                (t) =>
                    t.id !== nextTask.id &&
                    !t.optional &&
                    (t.status === 'pending' || t.status === 'failed')
            )
            .map((t) => t.id);

        // Mark current task as in-progress
        await conversionService.updateTask(flowId, nextTask.id, { status: 'in-progress' });

        // Ensure agent files are provisioned
        try {
            const stateManager = StateManager.getInstance();
            const projectPath = stateManager.getState().projectPath;
            if (projectPath) {
                await AgentFileProvisioner.getInstance().provision(projectPath);
            }
        } catch (err) {
            logger.warn(
                `[Conversion] Failed to provision agent files: ${err instanceof Error ? err.message : String(err)}`
            );
        }

        // Build context about completed tasks
        const completedTasks = taskPlan.tasks
            .filter((t) => t.status === 'completed' && t.output)
            .map(
                (t) =>
                    `- ${t.name}: ${t.output?.summary ?? ''}${t.output?.generatedFiles?.length ? ' (files: ' + t.output.generatedFiles.join(', ') + ')' : ''}`
            )
            .join('\n');

        const completedContext = completedTasks
            ? `\nAlready completed tasks:\n${completedTasks}\n`
            : '';

        const artifactContext = nextTask.artifactIds?.length
            ? `This task operates on artifacts: ${nextTask.artifactIds.join(', ')}. `
            : '';
        const nextTaskExecutionPrompt = nextTask.executionPrompt || nextTask.description;
        const outputProjectName = taskPlan.flowName
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const outputProjectRoot = `out/${outputProjectName}`;
        const outputLogicAppName = `${outputProjectName}-logicapp`;
        const outputLogicAppRoot = `${outputProjectRoot}/${outputLogicAppName}`;

        const remainingContext = ChatPrompts.remainingTasksContext(
            remainingTasks.length,
            remainingTasks.join(', ')
        );

        // Extra instruction for scaffold tasks
        const isScaffoldFirst =
            nextTask.type === 'scaffold-project' ||
            nextTask.type === 'scaffold' ||
            nextTask.order === 1;
        const scaffoldExtraAll = isScaffoldFirst
            ? ChatPrompts.scaffoldExtra(
                  outputProjectName,
                  outputLogicAppName,
                  outputProjectRoot,
                  outputLogicAppRoot
              )
            : '';

        try {
            const azCfg2 = vscode.workspace.getConfiguration('logicAppsMigrationAgent.azure');
            const rg2 = azCfg2.get<string>('resourceGroup', 'integration-migration-tool-test-rg');
            const loc2 = azCfg2.get<string>('location', 'eastus');

            await vscode.commands.executeCommand('workbench.action.chat.open', {
                mode: 'agent',
                query: ChatPrompts.executeAllTasks({
                    flowName: taskPlan.flowName,
                    flowId: flowId as string,
                    nextTaskName: nextTask.name,
                    nextTaskId: nextTask.id,
                    nextTaskType: nextTask.type,
                    nextTaskDescription: nextTask.description,
                    nextTaskExecutionPrompt,
                    nextTaskOrder: nextTask.order,
                    nextTaskDependsOn:
                        nextTask.dependsOn.length > 0 ? nextTask.dependsOn.join(', ') : 'none',
                    artifactContext,
                    completedContext,
                    remainingContext,
                    scaffoldExtra: scaffoldExtraAll,
                    outputProjectRoot,
                    outputLogicAppRoot,
                    resourceGroup: rg2,
                    location: loc2,
                }),
            });
            logger.info('[Conversion] Convert All agent chat opened successfully');
        } catch (err) {
            await conversionService.updateTask(flowId, nextTask.id, { status: 'pending' });
            await conversionService.setExecuteAllActive(flowId, false);
            SourceFlowVisualizer.executingGroupIds.delete(flowId);
            SourceFlowVisualizer.refreshFlowGroupSelectorIfOpen();
            logger.error(
                `[Conversion] Failed to open agent chat: ${err instanceof Error ? err.message : String(err)}`
            );
            vscode.window.showErrorMessage(
                UserPrompts.failedToStartConversion(
                    err instanceof Error ? err.message : String(err)
                )
            );
        }
    }

    /**
     * Handle executing a local black box test task.
     * Prompts the user to select a test data folder, then opens the
     * @migration-converter agent chat with the test instructions.
     */
    private async handleExecuteBlackBoxTest(flowId?: string, taskId?: string): Promise<void> {
        const logger = LoggingService.getInstance();

        if (!flowId || !taskId) {
            vscode.window.showWarningMessage(UserPrompts.NO_FLOW_OR_TASK_SPECIFIED);
            return;
        }

        logger.info(`[Conversion] handleExecuteBlackBoxTest: flow=${flowId} task=${taskId}`);

        const conversionService = ConversionService.getInstance();
        const taskPlan = conversionService.getTaskPlan(flowId);

        if (!taskPlan) {
            vscode.window.showWarningMessage(UserPrompts.NO_TASK_PLAN_FOUND);
            return;
        }

        const task = taskPlan.tasks.find((t) => t.id === taskId);
        if (!task) {
            vscode.window.showWarningMessage(UserPrompts.taskNotFound(taskId));
            return;
        }

        // Check dependencies
        const unmetDeps = task.dependsOn.filter((depId) => {
            const dep = taskPlan.tasks.find((t) => t.id === depId);
            return !dep || (dep.status !== 'completed' && dep.status !== 'skipped');
        });
        if (unmetDeps.length > 0) {
            vscode.window.showWarningMessage(
                UserPrompts.cannotExecuteTaskWaiting(task.name, unmetDeps.join(', '))
            );
            return;
        }

        // Prompt user to select the test data folder
        const folderUris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Test Data Folder',
            title: 'Select the folder containing TEST-INSTRUCTIONS.md and input/output test files',
        });

        if (!folderUris || folderUris.length === 0) {
            logger.info('[Conversion] Black box test cancelled — no folder selected');
            return;
        }

        const testDataFolder = folderUris[0].fsPath;
        logger.info(`[Conversion] Black box test data folder: ${testDataFolder}`);

        // Validate that TEST-INSTRUCTIONS.md exists in the selected folder
        const fs = await import('fs');
        const pathMod = await import('path');
        const instructionsPath = pathMod.join(testDataFolder, 'TEST-INSTRUCTIONS.md');
        if (!fs.existsSync(instructionsPath)) {
            logger.warn(
                `[Conversion] Black box test failed — TEST-INSTRUCTIONS.md not found in: ${testDataFolder}`
            );
            vscode.window.showErrorMessage(
                `The selected folder does not contain a TEST-INSTRUCTIONS.md file. Please select a folder that includes TEST-INSTRUCTIONS.md with test instructions and input/output test files.`
            );
            return;
        }

        // Mark task as in-progress
        await conversionService.updateTask(flowId, taskId, { status: 'in-progress' });

        // Ensure agent files are provisioned
        try {
            const stateManager = StateManager.getInstance();
            const projectPath = stateManager.getState().projectPath;
            if (projectPath) {
                await AgentFileProvisioner.getInstance().provision(projectPath);
            }
        } catch (err) {
            logger.warn(
                `[Conversion] Failed to provision agent files: ${err instanceof Error ? err.message : String(err)}`
            );
        }

        // Build context about completed tasks
        const completedTasks = taskPlan.tasks
            .filter((t) => t.status === 'completed' && t.output)
            .map(
                (t) =>
                    `- ${t.name}: ${t.output?.summary ?? ''}${t.output?.generatedFiles?.length ? ' (files: ' + t.output.generatedFiles.join(', ') + ')' : ''}`
            )
            .join('\n');

        const completedContext = completedTasks
            ? `\nAlready completed tasks:\n${completedTasks}\n`
            : '';

        const taskExecutionPrompt = task.executionPrompt || task.description;
        const outputProjectName = taskPlan.flowName
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const outputProjectRoot = `out/${outputProjectName}`;
        const outputLogicAppName = `${outputProjectName}-logicapp`;
        const outputLogicAppRoot = `${outputProjectRoot}/${outputLogicAppName}`;

        try {
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                mode: 'agent',
                query: ChatPrompts.executeBlackBoxTest({
                    taskName: task.name,
                    taskId: taskId as string,
                    flowName: taskPlan.flowName,
                    flowId: flowId as string,
                    taskDescription: task.description,
                    taskExecutionPrompt,
                    taskOrder: task.order,
                    taskDependsOn: task.dependsOn.length > 0 ? task.dependsOn.join(', ') : 'none',
                    completedContext,
                    outputProjectRoot,
                    outputLogicAppRoot,
                    testDataFolder,
                }),
            });
            logger.info(`[Conversion] Black box test agent chat opened for task: ${taskId}`);
        } catch (err) {
            await conversionService.updateTask(flowId, taskId, { status: 'pending' });
            logger.error(
                `[Conversion] Failed to open agent chat for black box test: ${err instanceof Error ? err.message : String(err)}`
            );
            vscode.window.showErrorMessage(
                UserPrompts.failedToStartTaskExecution(
                    err instanceof Error ? err.message : String(err)
                )
            );
        }
    }

    /**
     * Export analysis report as DOCX
     */
    private async handleExportAnalysisReport(
        flowId?: string,
        flowName?: string,
        analysisResult?: GeneratedFlowResult
    ): Promise<void> {
        const logger = LoggingService.getInstance();

        if (!flowId || !analysisResult) {
            vscode.window.showWarningMessage('No analysis data available to export.');
            return;
        }

        logger.info(`[Export] Generating analysis report for flow: ${flowId}`);
        const { ReportExporterService } = await import('../services/ReportExporterService');
        const exporter = ReportExporterService.getInstance();
        const filePath = await exporter.generateAnalysisReport(
            flowId,
            flowName || flowId,
            analysisResult
        );

        if (filePath) {
            const openAction = await vscode.window.showInformationMessage(
                `Analysis report saved successfully.`,
                'Open File',
                'Open Folder'
            );
            if (openAction === 'Open File') {
                await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
            } else if (openAction === 'Open Folder') {
                const folderPath = (await import('path')).dirname(filePath);
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
            }
        }
    }

    /**
     * Export planning report as DOCX
     */
    private async handleExportPlanReport(flowId?: string): Promise<void> {
        const logger = LoggingService.getInstance();

        if (!flowId) {
            vscode.window.showWarningMessage('No flow specified for report export.');
            return;
        }

        logger.info(`[Export] Generating planning report for flow: ${flowId}`);
        const { ReportExporterService } = await import('../services/ReportExporterService');
        const exporter = ReportExporterService.getInstance();
        const filePath = await exporter.generatePlanningReport(flowId);

        if (filePath) {
            const openAction = await vscode.window.showInformationMessage(
                `Planning report saved successfully.`,
                'Open File',
                'Open Folder'
            );
            if (openAction === 'Open File') {
                await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
            } else if (openAction === 'Open Folder') {
                const folderPath = (await import('path')).dirname(filePath);
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
            }
        }
    }

    /**
     * Dispose of all registered commands
     */
    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables.length = 0;
        this.registeredCommands.clear();
        CommandRegistry.instance = undefined;
    }
}
