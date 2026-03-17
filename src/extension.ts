/**
 * Logic Apps Migration Assistant - VS Code Extension
 *
 * Main entry point for the extension. Handles activation, deactivation,
 * and orchestrates all services and commands.
 */

import * as vscode from 'vscode';
import { CommandRegistry } from './commands/CommandRegistry';
import { UserPrompts } from './constants/UserMessages';
import { LoggingService } from './services/LoggingService';
import { TelemetryService } from './services/TelemetryService';
import { ConfigurationService } from './services/ConfigurationService';
import { StorageService } from './services/StorageService';
import { StateManager } from './services/StateManager';
import { ErrorHandler } from './errors/ErrorHandler';
import { registerTreeViewProviders } from './ui/sidebar';

// Stage Infrastructure Services (Phase 5)
import { ToolRegistry } from './services/tools';

// Discovery Stage Services (Phase 6)
import { DiscoveryService, SourceFolderService } from './stages/discovery';
import { registerDiscoveryTreeProvider } from './views/discovery';

// Planning Stage Services
import { PlanningService } from './stages/planning';

// Conversion Stage Services
import { ConversionService } from './stages/conversion';

// Parsers (Phase 4)
import {
    initializeParsers,
    ParserPluginLoader,
    createExtensionAPI,
    LogicAppsMigrationAssistantAPI,
} from './parsers';

// Project Auto-Detection (Phase 6)
import { ProjectAutoDetection } from './services/ProjectAutoDetection';

// Copilot Integration (Phase 14)
import { registerMigrationLMTools } from './copilot';

/**
 * All disposables registered by the extension
 */
const disposables: vscode.Disposable[] = [];

/**
 * This method is called when the extension is activated.
 * Activation happens based on activationEvents in package.json:
 * - onStartupFinished
 * - workspaceContains:**\/*.btproj (BizTalk projects)
 * - workspaceContains:**\/*.odx (BizTalk orchestrations)
 * - workspaceContains:**\/*.btm (BizTalk maps)
 * - workspaceContains:**\/pom.xml (MuleSoft projects)
 * - workspaceContains:**\/mule-*.xml (MuleSoft flows)
 *
 * @returns Extension API for parser registration by partner extensions
 */
export async function activate(
    context: vscode.ExtensionContext
): Promise<LogicAppsMigrationAssistantAPI> {
    try {
        // Detect version change and prompt reload to refresh cached manifest contributions
        const currentVersion = context.extension.packageJSON.version as string;
        const previousVersion = context.globalState.get<string>('extensionVersion');
        if (previousVersion && previousVersion !== currentVersion) {
            void context.globalState.update('extensionVersion', currentVersion);
            const reload = await vscode.window.showInformationMessage(
                UserPrompts.extensionUpdated(currentVersion),
                UserPrompts.BUTTON_RELOAD_WINDOW,
                UserPrompts.BUTTON_LATER
            );
            if (reload === UserPrompts.BUTTON_RELOAD_WINDOW) {
                void vscode.commands.executeCommand('workbench.action.reloadWindow');
                // Return minimal API — window will reload
                return createExtensionAPI(currentVersion);
            }
        } else {
            void context.globalState.update('extensionVersion', currentVersion);
        }

        // Initialize core services in order
        await initializeServices(context);

        // Register all commands
        await registerCommands(context);

        // Register tree views
        await registerTreeViews(context);

        // Create status bar item
        createStatusBarItem(context);

        // Register LM tools (Phase 14)
        registerMigrationLMTools(context);

        // Log activation
        LoggingService.getInstance().info('Extension activated successfully', {
            extensionId: context.extension.id,
            extensionVersion: context.extension.packageJSON.version,
        });

        // Send telemetry
        TelemetryService.getInstance().sendEvent('extension.activated', {
            platform: process.platform,
            vscodeVersion: vscode.version,
        });

        // =====================================================================
        // Two-way sync: Workspace folder ↔ Source folder
        // Guard flag prevents infinite loops when one updates the other.
        // =====================================================================
        let isSyncingFolders = false;

        // Direction 1: Workspace folder changed → auto-select as source folder
        const workspaceFolderChangeDisposable = vscode.workspace.onDidChangeWorkspaceFolders(
            async (event) => {
                if (event.added.length > 0 || event.removed.length > 0) {
                    // If this change was triggered by source-folder → workspace sync, skip
                    if (isSyncingFolders) {
                        isSyncingFolders = false;
                        return;
                    }

                    LoggingService.getInstance().info(
                        'Workspace folders changed, syncing source folder'
                    );

                    // Reset migration state (clears stale projectPath, inventory, etc.)
                    const stateManager = StateManager.getInstance();
                    await stateManager.resetState();

                    // Auto-select the new workspace folder as the source folder
                    if (event.added.length > 0) {
                        const newFolder = event.added[0];
                        isSyncingFolders = true;
                        await vscode.commands.executeCommand(
                            'logicAppsMigrationAssistant.selectSourceFolder',
                            newFolder.uri
                        );
                        isSyncingFolders = false;
                    }
                }
            }
        );
        disposables.push(workspaceFolderChangeDisposable);

        // Direction 2: Source folder changed → update workspace folder to match
        const sourceFolderService = SourceFolderService.getInstance();
        const sourceFolderSyncDisposable = sourceFolderService.onSourceFolderChanged(
            async (event) => {
                if (isSyncingFolders || !event.newPath) {
                    return;
                }

                const workspaceFolders = vscode.workspace.workspaceFolders;
                const isAlreadyWorkspace = workspaceFolders?.some(
                    (wf) => wf.uri.fsPath === event.newPath
                );

                if (!isAlreadyWorkspace) {
                    LoggingService.getInstance().info(
                        'Source folder changed, syncing workspace folder',
                        { newPath: event.newPath }
                    );
                    isSyncingFolders = true;
                    vscode.workspace.updateWorkspaceFolders(0, workspaceFolders?.length || 0, {
                        uri: vscode.Uri.file(event.newPath),
                    });
                }
            }
        );
        disposables.push(sourceFolderSyncDisposable);

        // Initialize parser plugin loader for external parsers
        const pluginLoader = ParserPluginLoader.getInstance();
        await pluginLoader.initialize();
        disposables.push(pluginLoader);

        // Auto-open the flow group selector (main page) on startup
        // if flow groups have been detected previously or a migration is in progress
        setTimeout(async () => {
            try {
                const { DiscoveryCacheService } =
                    await import('./stages/discovery/DiscoveryCacheService');
                const discoveryCacheService = DiscoveryCacheService.getInstance();
                if (discoveryCacheService.hasFlowGroups()) {
                    const { SourceFlowVisualizer } =
                        await import('./views/discovery/SourceFlowVisualizer');
                    const extensionUri =
                        vscode.extensions.getExtension('logicapps-migration-assistant')
                            ?.extensionUri ?? vscode.Uri.file(__dirname);
                    SourceFlowVisualizer.showFlowGroupSelector(extensionUri);
                    LoggingService.getInstance().info(
                        'Auto-opened flow group selector on startup (flow groups exist)'
                    );
                }
            } catch {
                // Non-critical — don't block activation
            }
        }, 1000);

        // Create and return the extension API for partner extensions
        const extensionVersion = context.extension.packageJSON.version as string;
        return createExtensionAPI(extensionVersion);
    } catch (error) {
        ErrorHandler.getInstance().handleError(error, 'Extension Activation');
        throw error;
    }
}

/**
 * Initialize all core services
 */
async function initializeServices(context: vscode.ExtensionContext): Promise<void> {
    // Initialize logging first (other services depend on it)
    const loggingService = LoggingService.getInstance();
    loggingService.initialize(context);
    disposables.push(loggingService);

    // Initialize telemetry service
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initialize(context);
    disposables.push(telemetryService);

    // Initialize configuration service
    const configService = ConfigurationService.getInstance();
    configService.initialize();
    disposables.push(configService);

    // Initialize storage service
    const storageService = StorageService.getInstance();
    storageService.initialize(context);
    disposables.push(storageService);

    // Initialize state manager (legacy - will be replaced by state machine)
    const stateManager = StateManager.getInstance();
    await stateManager.initialize(context);
    disposables.push(stateManager);

    // Initialize error handler
    const errorHandler = ErrorHandler.getInstance();
    errorHandler.initialize(context);
    disposables.push(errorHandler);

    // =========================================================================
    // PHASE 4: Parsers
    // =========================================================================

    // Initialize all parsers and register them
    initializeParsers();
    LoggingService.getInstance().info('Parsers initialized');

    // =========================================================================
    // PHASE 5: Stage Infrastructure Services
    // =========================================================================

    // Initialize Tool Registry (manages tools with stage-based enablement)
    const toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    disposables.push(toolRegistry);

    LoggingService.getInstance().info('Stage infrastructure services initialized');

    // =========================================================================
    // PHASE 6: Discovery Stage Services
    // =========================================================================

    // Initialize Discovery Service (orchestrates discovery workflow)
    const discoveryService = DiscoveryService.getInstance();
    await discoveryService.initialize();
    disposables.push(discoveryService);

    LoggingService.getInstance().info('Discovery stage services initialized');

    // =========================================================================
    // PLANNING STAGE SERVICES
    // =========================================================================

    // Initialize Planning Service (orchestrates planning workflow)
    const planningService = PlanningService.getInstance();
    await planningService.initialize();
    disposables.push(planningService);

    LoggingService.getInstance().info('Planning stage services initialized');

    // =========================================================================
    // CONVERSION STAGE SERVICES
    // =========================================================================

    // Initialize Conversion Service (orchestrates conversion workflow)
    const conversionService = ConversionService.getInstance();
    await conversionService.initialize();
    disposables.push(conversionService);

    LoggingService.getInstance().info('Conversion stage services initialized');

    // =========================================================================\n    // PROJECT AUTO-DETECTION (Phase 6)\n    // =========================================================================", "oldString": "    // =========================================================================\n    // STAGE CHANGE LISTENER\n    // =========================================================================\n\n    // Stage transitions are now handled per-flow from the flow group selector.\n    // Do NOT auto-open Planning/Conversion webviews on stage change — the user\n    // accesses them through the flow card buttons (\"✓ Planned\" / \"✓ Converted\").\n    const stageChangeDisposable = stateMachine.onStageChange(async (event) => {\n        LoggingService.getInstance().info(`Stage changed to ${event.currentStage}`);\n    });\n    disposables.push(stageChangeDisposable);\n\n    // =========================================================================\n    // PROJECT AUTO-DETECTION (Phase 6)\n    // =========================================================================

    // Initialize and run project auto-detection
    const autoDetection = ProjectAutoDetection.getInstance();
    await autoDetection.initialize();
    disposables.push(autoDetection);

    LoggingService.getInstance().info('Project auto-detection initialized');
}

/**
 * Register all extension commands
 */
async function registerCommands(context: vscode.ExtensionContext): Promise<void> {
    const commandRegistry = CommandRegistry.getInstance();
    commandRegistry.registerAll(context);
    disposables.push(commandRegistry);
}

/**
 * Register tree view providers
 */
async function registerTreeViews(context: vscode.ExtensionContext): Promise<void> {
    // Register all tree view providers for the migration sidebar
    registerTreeViewProviders(context);

    // Register Discovery tree view provider (Phase 6)
    const discoveryTreeDisposable = registerDiscoveryTreeProvider(context);
    disposables.push(discoveryTreeDisposable);

    LoggingService.getInstance().debug('Tree view providers registered');
}

/**
 * Create and register status bar item
 */
function createStatusBarItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

    statusBarItem.text = '$(layers) Migration';
    statusBarItem.tooltip = 'Logic Apps Migration Assistant - Click to start';
    statusBarItem.command = 'logicAppsMigrationAssistant.start';
    statusBarItem.show();

    context.subscriptions.push(statusBarItem);
    disposables.push(statusBarItem);

    return statusBarItem;
}

/**
 * This method is called when the extension is deactivated.
 * Clean up all resources and dispose of all services.
 */
export function deactivate(): void {
    // Log deactivation
    try {
        LoggingService.getInstance().info('Extension deactivating...');

        // Send telemetry
        TelemetryService.getInstance().sendEvent('extension.deactivated');
    } catch {
        // Ignore errors during deactivation logging
    }

    // Dispose all registered disposables in reverse order
    while (disposables.length > 0) {
        const disposable = disposables.pop();
        if (disposable) {
            try {
                disposable.dispose();
            } catch {
                // Ignore disposal errors
            }
        }
    }
}
