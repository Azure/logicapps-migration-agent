/**
 * Discovery Service
 *
 * Main orchestrator for the Discovery stage. Coordinates source folder
 * selection, platform detection, artifact scanning, inventory building,
 * and dependency graph creation.
 *
 * @module stages/discovery/DiscoveryService
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { StateManager } from '../../services/StateManager';
import { StorageService, StorageKeys } from '../../services/StorageService';
import { UserPrompts } from '../../constants/UserMessages';
import { SourceFolderService } from './SourceFolderService';
import { PlatformDetector } from './PlatformDetector';
import { ArtifactScanner } from './ArtifactScanner';
import { InventoryService } from './InventoryService';
import { DependencyGraphService } from './DependencyGraphService';
import {
    SourceFolderResult,
    PlatformDetectionResult,
    ScanResult,
    ArtifactInventory,
    DependencyGraph,
    ScanProgress,
} from './types';
import { AgentFileProvisioner } from '../../services/AgentFileProvisioner';

// =============================================================================
// Discovery Service Events
// =============================================================================

/**
 * Discovery progress event.
 */
interface DiscoveryProgressEvent {
    /** Current phase */
    phase:
        | 'folder-selection'
        | 'platform-detection'
        | 'scanning'
        | 'inventory'
        | 'dependencies'
        | 'complete';

    /** Phase progress (0-100) */
    progress: number;

    /** Current message */
    message: string;

    /** Detailed scan progress (when phase is 'scanning') */
    scanProgress?: ScanProgress;
}

/**
 * Discovery complete event.
 */
export interface DiscoveryCompleteEvent {
    /** Whether discovery was successful */
    success: boolean;

    /** Source folder */
    sourceFolder?: SourceFolderResult;

    /** Detected platform */
    platform?: PlatformDetectionResult;

    /** Scan result */
    scanResult?: ScanResult;

    /** Built inventory */
    inventory?: ArtifactInventory;

    /** Dependency graph */
    dependencyGraph?: DependencyGraph;

    /** Error if failed */
    error?: Error;
}

// =============================================================================
// Discovery Service
// =============================================================================

/**
 * Main service for the Discovery stage.
 */
export class DiscoveryService implements vscode.Disposable {
    private static instance: DiscoveryService | undefined;

    private readonly logger = LoggingService.getInstance();
    private readonly stateManager = StateManager.getInstance();

    // Sub-services
    private readonly sourceFolderService = SourceFolderService.getInstance();
    private readonly platformDetector = PlatformDetector.getInstance();
    private readonly artifactScanner = ArtifactScanner.getInstance();
    private readonly inventoryService = InventoryService.getInstance();
    private readonly dependencyGraphService = DependencyGraphService.getInstance();

    // Event emitters
    private readonly _onProgress = new vscode.EventEmitter<DiscoveryProgressEvent>();
    public readonly onProgress = this._onProgress.event;

    private readonly _onComplete = new vscode.EventEmitter<DiscoveryCompleteEvent>();
    public readonly onComplete = this._onComplete.event;

    private readonly disposables: vscode.Disposable[] = [];

    // Current discovery state
    private isRunning = false;
    private currentResult: DiscoveryCompleteEvent | undefined;

    private constructor() {
        this.disposables.push(this._onProgress, this._onComplete);
    }

    /**
     * Get the singleton instance.
     */
    public static getInstance(): DiscoveryService {
        if (!DiscoveryService.instance) {
            DiscoveryService.instance = new DiscoveryService();
        }
        return DiscoveryService.instance;
    }

    /**
     * Initialize the discovery service.
     */
    public async initialize(): Promise<void> {
        await this.sourceFolderService.initialize();
        await this.inventoryService.initialize();

        // Restore discovery result from storage
        await this.loadDiscoveryResultFromStorage();

        this.logger.info('Discovery service initialized');
    }

    /**
     * Get the current inventory.
     */
    public getCurrentInventory(): ArtifactInventory | undefined {
        return this.inventoryService.getInventory();
    }

    /**
     * Get the current dependency graph.
     */
    public getCurrentDependencyGraph(): DependencyGraph | undefined {
        return this.dependencyGraphService.getGraph();
    }

    /**
     * Get whether discovery is currently running.
     */
    public getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get the last discovery result.
     */
    public getLastResult(): DiscoveryCompleteEvent | undefined {
        return this.currentResult;
    }

    /**
     * Run the complete discovery process.
     */
    public async runDiscovery(folderPath?: string): Promise<DiscoveryCompleteEvent> {
        if (this.isRunning) {
            throw new Error('Discovery is already running');
        }

        this.isRunning = true;
        this.logger.info('Starting discovery process');

        try {
            // Phase 1: Select source folder
            this.emitProgress('folder-selection', 0, 'Selecting source folder...');

            let sourceFolder: SourceFolderResult | undefined;

            if (folderPath) {
                sourceFolder = await this.sourceFolderService.setSourceFolder(folderPath);
            } else {
                sourceFolder = await this.sourceFolderService.selectSourceFolder();
            }

            if (!sourceFolder) {
                this.logger.info('Discovery cancelled: no folder selected');
                const result: DiscoveryCompleteEvent = {
                    success: false,
                    error: new Error('No folder selected'),
                };
                this._onComplete.fire(result);
                return result;
            }

            this.emitProgress('folder-selection', 100, `Selected: ${sourceFolder.path}`);

            // Persist the project path so the sidebar and other services reflect the current folder
            await this.stateManager.setProjectPath(sourceFolder.path);

            // Phase 2: Detect platform
            this.emitProgress('platform-detection', 0, 'Detecting platform...');

            // If discovery was already completed for this folder (state has a sourcePlatform),
            // skip the confirmation prompt entirely — auto-confirm with the stored platform.
            const existingState = this.stateManager.getState();
            const previouslyDetectedPlatform =
                existingState.projectPath === sourceFolder.path
                    ? existingState.sourcePlatform
                    : undefined;

            let platform: PlatformDetectionResult;
            let confirmed: boolean;

            if (previouslyDetectedPlatform) {
                this.logger.info(
                    `Skipping platform confirmation — previously detected: ${previouslyDetectedPlatform}`
                );
                const detection = await this.platformDetector.detect(
                    sourceFolder.path,
                    sourceFolder.quickScan
                );
                // Use previously confirmed platform if detection matches, otherwise use detected
                platform =
                    detection.platform === previouslyDetectedPlatform
                        ? detection
                        : {
                              ...detection,
                              platform:
                                  previouslyDetectedPlatform as PlatformDetectionResult['platform'],
                              confidence: 100,
                          };
                confirmed = true;
            } else {
                const result = await this.platformDetector.detectWithConfirmation(
                    sourceFolder.path,
                    sourceFolder.quickScan
                );
                platform = result.detection;
                confirmed = result.confirmed;
            }

            if (!confirmed) {
                this.logger.info('Discovery cancelled: platform not confirmed');
                const result: DiscoveryCompleteEvent = {
                    success: false,
                    sourceFolder,
                    error: new Error('Platform not confirmed'),
                };
                this._onComplete.fire(result);
                return result;
            }

            this.emitProgress(
                'platform-detection',
                100,
                `Detected: ${platform.platform} (${platform.confidence}% confidence)`
            );

            // Update state
            await this.stateManager.updateState((draft) => {
                draft.sourcePlatform = platform.platform;
            });

            // Phase 3: Scan for artifacts
            this.emitProgress('scanning', 0, 'Scanning for artifacts...');

            const scanResult = await this.artifactScanner.scan(
                sourceFolder.path,
                platform.platform,
                undefined,
                (progress) => {
                    this.emitProgress(
                        'scanning',
                        progress.percentage,
                        progress.currentFile,
                        progress
                    );
                }
            );

            this.emitProgress(
                'scanning',
                100,
                `Found ${scanResult.parsedArtifacts.length} artifacts`
            );

            // Phase 4: Build inventory
            this.emitProgress('inventory', 0, 'Building inventory...');

            const projectName = path.basename(sourceFolder.path);
            const inventory = await this.inventoryService.createFromScanResult(
                scanResult,
                projectName,
                platform.version
            );

            this.emitProgress(
                'inventory',
                100,
                `Inventory created: ${inventory.items.length} items`
            );

            // Phase 5: Build dependency graph
            this.emitProgress('dependencies', 0, 'Analyzing dependencies...');

            // Pass IR documents to dependency graph service so it can extract relationships
            this.dependencyGraphService.setIRDocuments(this.inventoryService.getIRDocuments());

            const dependencyGraph = await this.dependencyGraphService.buildGraph(inventory);

            this.emitProgress(
                'dependencies',
                100,
                `Dependencies mapped: ${dependencyGraph.edges.length} relationships`
            );

            // Phase 6: Complete
            this.emitProgress('complete', 100, 'Discovery complete!');

            const result: DiscoveryCompleteEvent = {
                success: true,
                sourceFolder,
                platform,
                scanResult,
                inventory,
                dependencyGraph,
            };

            this.currentResult = result;
            await this.saveDiscoveryResultToStorage();
            this._onComplete.fire(result);

            // Update state manager with inventory
            const discoveredArtifacts = inventory.items.map((item) => ({
                id: item.id,
                name: item.name,
                type: item.category,
                filePath: item.sourcePath,
                platform: platform.platform,
                lastModified: item.metadata.lastModified,
            }));

            await this.stateManager.updateState((draft) => {
                draft.inventory = discoveredArtifacts;
            });

            this.logger.info('Discovery completed successfully', {
                artifacts: inventory.items.length,
                dependencies: dependencyGraph.edges.length,
            });

            // Provision the @migration-analyser agent file in the workspace
            try {
                const provisioner = AgentFileProvisioner.getInstance();
                const created = await provisioner.provision(sourceFolder.path);
                if (created) {
                    this.logger.info(
                        '[Discovery] Provisioned @migration-analyser agent in workspace'
                    );
                }
            } catch (provisionErr) {
                // Non-critical — log and continue
                this.logger.warn(
                    `[Discovery] Failed to provision agent file: ${provisionErr instanceof Error ? provisionErr.message : String(provisionErr)}`
                );
            }

            // Auto-open the discovery webview after artifact parsing completes
            try {
                await vscode.commands.executeCommand(
                    'logicAppsMigrationAgent.viewFlowVisualization',
                    'DISCOVERY'
                );
            } catch (openErr) {
                this.logger.warn(
                    `[Discovery] Failed to auto-open discovery view: ${openErr instanceof Error ? openErr.message : String(openErr)}`
                );
            }

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error('Discovery failed', err);

            const result: DiscoveryCompleteEvent = {
                success: false,
                error: err,
            };

            this._onComplete.fire(result);
            return result;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Run discovery with VS Code progress UI.
     */
    public async runDiscoveryWithProgress(folderPath?: string): Promise<DiscoveryCompleteEvent> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: UserPrompts.PROGRESS_DISCOVERY_STAGE,
                cancellable: true,
            },
            async (progress, _token) => {
                // Subscribe to progress events
                const progressDisposable = this.onProgress((event) => {
                    progress.report({
                        message: event.message,
                        increment: event.phase === 'scanning' ? 0 : undefined,
                    });
                });

                try {
                    return await this.runDiscovery(folderPath);
                } finally {
                    progressDisposable.dispose();
                }
            }
        );
    }

    /**
     * Re-scan the current source folder.
     */
    public async rescan(): Promise<DiscoveryCompleteEvent | undefined> {
        const currentFolder = this.sourceFolderService.getCurrentFolder();
        if (!currentFolder) {
            vscode.window.showWarningMessage(UserPrompts.NO_SOURCE_FOLDER_SELECTED);
            return undefined;
        }

        return this.runDiscoveryWithProgress(currentFolder.path);
    }

    /**
     * Get current discovery result.
     */
    public getCurrentResult(): DiscoveryCompleteEvent | undefined {
        return this.currentResult;
    }

    /**
     * Check if discovery is in progress.
     */
    public isDiscoveryRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Check if discovery is complete.
     */
    public isDiscoveryComplete(): boolean {
        return this.currentResult?.success === true;
    }

    /**
     * Get source folder service.
     */
    public getSourceFolderService(): SourceFolderService {
        return this.sourceFolderService;
    }

    /**
     * Get platform detector.
     */
    public getPlatformDetector(): PlatformDetector {
        return this.platformDetector;
    }

    /**
     * Get artifact scanner.
     */
    public getArtifactScanner(): ArtifactScanner {
        return this.artifactScanner;
    }

    /**
     * Get inventory service.
     */
    public getInventoryService(): InventoryService {
        return this.inventoryService;
    }

    /**
     * Get dependency graph service.
     */
    public getDependencyGraphService(): DependencyGraphService {
        return this.dependencyGraphService;
    }

    /**
     * Reset discovery state.
     */
    public async reset(): Promise<void> {
        await this.inventoryService.clearInventory();
        this.dependencyGraphService.clearGraph();
        await this.sourceFolderService.clearSourceFolder();
        this.currentResult = undefined;

        // Clear persisted discovery result
        try {
            const storage = StorageService.getInstance();
            await storage.setWorkspace(StorageKeys.DISCOVERY_RESULT, undefined);
        } catch {
            // Ignore storage errors during reset
        }

        this.logger.info('Discovery state reset');
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private emitProgress(
        phase: DiscoveryProgressEvent['phase'],
        progress: number,
        message: string,
        scanProgress?: ScanProgress
    ): void {
        this._onProgress.fire({
            phase,
            progress,
            message,
            scanProgress,
        });
    }

    /**
     * Save discovery result to storage for persistence across restarts.
     */
    private async saveDiscoveryResultToStorage(): Promise<void> {
        if (!this.currentResult) {
            return;
        }

        try {
            const storage = StorageService.getInstance();
            // Serialize result (excluding non-serializable parts like Error objects)
            const serializable = {
                success: this.currentResult.success,
                sourceFolder: this.currentResult.sourceFolder,
                platform: this.currentResult.platform,
                scanResult: this.currentResult.scanResult,
                inventory: this.currentResult.inventory,
                dependencyGraph: this.currentResult.dependencyGraph,
            };
            await storage.setWorkspace(StorageKeys.DISCOVERY_RESULT, serializable);
            this.logger.debug('Discovery result saved to storage');
        } catch (error) {
            this.logger.error(
                'Failed to save discovery result to storage',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Load discovery result from storage.
     */
    private async loadDiscoveryResultFromStorage(): Promise<void> {
        try {
            const storage = StorageService.getInstance();
            const stored = storage.getWorkspace<DiscoveryCompleteEvent | undefined>(
                StorageKeys.DISCOVERY_RESULT,
                undefined
            );

            if (stored && stored.success) {
                this.currentResult = stored;
                this.logger.info('Discovery result restored from storage', {
                    artifacts: stored.inventory?.items?.length ?? 0,
                });
            }
        } catch (error) {
            this.logger.error(
                'Failed to load discovery result from storage',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Dispose of resources.
     */
    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        this.sourceFolderService.dispose();
        this.platformDetector.dispose();
        this.artifactScanner.dispose();
        this.inventoryService.dispose();
        this.dependencyGraphService.dispose();
        DiscoveryService.instance = undefined;
    }
}
