/**
 * Source Folder Service
 *
 * Handles source folder selection and validation for the Discovery stage.
 * Provides the entry point for starting a migration by selecting the
 * source integration project folder.
 *
 * @module stages/discovery/SourceFolderService
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { StorageService, StorageKeys } from '../../services/StorageService';
import { UserPrompts } from '../../constants/UserMessages';
import { StateManager } from '../../services/StateManager';
import {
    SourceFolderResult,
    QuickScanResult,
    PlatformIndicator,
    SourceFolderChangedEvent,
} from './types';
import { SourcePlatformType } from '../../ir/types/common';
// =============================================================================
// Constants
// =============================================================================

/**
 * File patterns that indicate integration platforms.
 */
const PLATFORM_FILE_PATTERNS: Record<
    SourcePlatformType,
    { patterns: string[]; confidence: 'high' | 'medium' | 'low' }[]
> = {
    biztalk: [
        { patterns: ['*.btproj'], confidence: 'high' },
        { patterns: ['*.odx'], confidence: 'high' },
        { patterns: ['*.btm'], confidence: 'high' },
        { patterns: ['*.btp'], confidence: 'medium' },
        { patterns: ['BindingInfo.xml', 'Binding*.xml'], confidence: 'medium' },
        { patterns: ['*.msi'], confidence: 'medium' },
        { patterns: ['ApplicationDefinition.adf'], confidence: 'high' },
    ],
    mulesoft: [
        { patterns: ['mule-artifact.json'], confidence: 'high' },
        { patterns: ['pom.xml'], confidence: 'medium' }, // Need to check content
        { patterns: ['mule-*.xml'], confidence: 'high' },
        { patterns: ['*.dwl'], confidence: 'high' },
        { patterns: ['*.raml', '*.yaml'], confidence: 'low' },
    ],
    tibco: [
        { patterns: ['tibco.xml', 'TIBCO.xml'], confidence: 'high' },
        { patterns: ['*.process', '*.bwp'], confidence: 'high' },
        { patterns: ['*.sharedhttp', '*.sharedjdbc'], confidence: 'medium' },
        { patterns: ['*.xsd', '*.wsdl', '*.xsl', '*.xslt'], confidence: 'low' },
    ],
    generic: [{ patterns: ['*.xml', '*.json'], confidence: 'low' }],
};

// =============================================================================
// Source Folder Service
// =============================================================================

/**
 * Service for selecting and validating source folders.
 */
export class SourceFolderService implements vscode.Disposable {
    private static instance: SourceFolderService | undefined;

    private readonly logger = LoggingService.getInstance();
    private readonly storage = StorageService.getInstance();
    private readonly stateManager = StateManager.getInstance();

    // Event emitters
    private readonly _onSourceFolderChanged = new vscode.EventEmitter<SourceFolderChangedEvent>();
    public readonly onSourceFolderChanged = this._onSourceFolderChanged.event;

    private readonly disposables: vscode.Disposable[] = [];

    // Current state
    private currentFolder: SourceFolderResult | undefined;

    private constructor() {
        this.disposables.push(this._onSourceFolderChanged);
    }

    /**
     * Get the singleton instance.
     */
    public static getInstance(): SourceFolderService {
        if (!SourceFolderService.instance) {
            SourceFolderService.instance = new SourceFolderService();
        }
        return SourceFolderService.instance;
    }

    /**
     * Initialize the service and restore previous selection.
     */
    public async initialize(): Promise<void> {
        try {
            const savedPath = this.storage.getWorkspace<string | undefined>(
                StorageKeys.PROJECT_PATH,
                undefined
            );

            if (savedPath && fs.existsSync(savedPath)) {
                this.logger.debug('Restoring saved source folder', { path: savedPath });
                // Validate and restore
                const result = await this.validateFolder(savedPath);
                if (result.hasIntegrationFiles) {
                    this.currentFolder = result;
                    this.logger.info('Restored source folder', { path: savedPath });
                }
            }
        } catch (error) {
            this.logger.warn('Failed to restore source folder', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Show folder picker dialog and select source folder.
     */
    public async selectSourceFolder(): Promise<SourceFolderResult | undefined> {
        // Show folder picker
        const folderUris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: UserPrompts.SELECT_SOURCE_PROJECT_LABEL,
            title: UserPrompts.SELECT_INTEGRATION_PROJECT_TITLE,
        });

        if (!folderUris || folderUris.length === 0) {
            this.logger.debug('Folder selection cancelled');
            return undefined;
        }

        const selectedPath = folderUris[0].fsPath;
        return this.setSourceFolder(selectedPath);
    }

    /**
     * Set source folder programmatically.
     */
    public async setSourceFolder(folderPath: string): Promise<SourceFolderResult | undefined> {
        this.logger.info('Setting source folder', { path: folderPath });

        // Validate the folder
        const result = await this.validateFolder(folderPath);

        // Check if folder has integration files
        if (!result.hasIntegrationFiles) {
            const proceed = await this.showNoIntegrationFilesWarning(result);
            if (!proceed) {
                return undefined;
            }
        }

        // Check if we need to confirm changing folder
        if (this.currentFolder && this.currentFolder.path !== folderPath) {
            const confirm = await this.confirmFolderChange();
            if (!confirm) {
                return this.currentFolder;
            }
        }

        // Update current folder
        const previousPath = this.currentFolder?.path;
        this.currentFolder = result;

        // Persist to storage
        await this.storage.setWorkspace(StorageKeys.PROJECT_PATH, folderPath);

        // Update state manager
        await this.stateManager.updateState((draft) => {
            draft.projectPath = folderPath;
        });

        // Emit event
        this._onSourceFolderChanged.fire({
            previousPath,
            newPath: folderPath,
            quickScan: result.quickScan,
        });

        this.logger.info('Source folder set successfully', {
            path: folderPath,
            hasIntegrationFiles: result.hasIntegrationFiles,
            indicators: result.quickScan.platformIndicators.length,
        });

        return result;
    }

    /**
     * Get the currently selected source folder.
     */
    public getCurrentFolder(): SourceFolderResult | undefined {
        return this.currentFolder;
    }

    /**
     * Validate a folder path.
     */
    public async validateFolder(folderPath: string): Promise<SourceFolderResult> {
        // Check existence
        if (!fs.existsSync(folderPath)) {
            throw new Error(`Folder does not exist: ${folderPath}`);
        }

        // Check if directory
        const stat = await fs.promises.stat(folderPath);
        if (!stat.isDirectory()) {
            throw new Error(`Path is not a directory: ${folderPath}`);
        }

        // Check if it's a system folder
        if (this.isSystemFolder(folderPath)) {
            throw new Error(`Cannot use system folder: ${folderPath}`);
        }

        // Determine if workspace folder
        const workspaceFolder = this.getWorkspaceFolder(folderPath);
        const isWorkspaceFolder = workspaceFolder !== undefined;
        const relativePath = isWorkspaceFolder
            ? path.relative(workspaceFolder.uri.fsPath, folderPath)
            : undefined;

        // Quick scan for integration files
        const quickScan = await this.quickScanFolder(folderPath);

        return {
            path: folderPath,
            isWorkspaceFolder,
            relativePath: relativePath === '' ? '.' : relativePath,
            hasIntegrationFiles: quickScan.platformIndicators.length > 0,
            quickScan,
        };
    }

    /**
     * Quick scan a folder for integration files.
     */
    public async quickScanFolder(folderPath: string): Promise<QuickScanResult> {
        const filesByExtension: Record<string, number> = {};
        const platformIndicators: PlatformIndicator[] = [];
        let totalFiles = 0;

        try {
            // Scan top level and one level deep for speed
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile()) {
                    totalFiles++;
                    const ext = path.extname(entry.name).toLowerCase();
                    filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;

                    // Check against platform patterns
                    this.checkFileForPlatform(entry.name, platformIndicators);
                } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    // Scan one level deep
                    const subPath = path.join(folderPath, entry.name);
                    try {
                        const subEntries = await fs.promises.readdir(subPath, {
                            withFileTypes: true,
                        });
                        for (const subEntry of subEntries) {
                            if (subEntry.isFile()) {
                                totalFiles++;
                                const ext = path.extname(subEntry.name).toLowerCase();
                                filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
                                this.checkFileForPlatform(subEntry.name, platformIndicators);
                            }
                        }
                    } catch {
                        // Ignore permission errors on subdirectories
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error during quick scan', error as Error, { folderPath });
        }

        return {
            totalFiles,
            filesByExtension,
            platformIndicators,
        };
    }

    /**
     * Clear the current source folder selection.
     */
    public async clearSourceFolder(): Promise<void> {
        const previousPath = this.currentFolder?.path;
        this.currentFolder = undefined;

        await this.storage.removeWorkspace(StorageKeys.PROJECT_PATH);

        await this.stateManager.updateState((draft) => {
            draft.projectPath = undefined;
        });

        if (previousPath) {
            this._onSourceFolderChanged.fire({
                previousPath,
                newPath: '',
                quickScan: { totalFiles: 0, filesByExtension: {}, platformIndicators: [] },
            });
        }

        this.logger.info('Source folder cleared');
    }

    /**
     * Refresh the quick scan for current folder.
     */
    public async refreshQuickScan(): Promise<QuickScanResult | undefined> {
        if (!this.currentFolder) {
            return undefined;
        }

        const quickScan = await this.quickScanFolder(this.currentFolder.path);
        this.currentFolder = {
            ...this.currentFolder,
            quickScan,
            hasIntegrationFiles: quickScan.platformIndicators.length > 0,
        };

        return quickScan;
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    /**
     * Check a file name against platform patterns.
     */
    private checkFileForPlatform(fileName: string, indicators: PlatformIndicator[]): void {
        for (const [platform, patterns] of Object.entries(PLATFORM_FILE_PATTERNS)) {
            for (const { patterns: filePatterns, confidence } of patterns) {
                for (const pattern of filePatterns) {
                    if (this.matchGlobPattern(fileName, pattern)) {
                        // Avoid duplicates
                        const exists = indicators.some(
                            (ind) => ind.platform === platform && ind.match === fileName
                        );
                        if (!exists) {
                            indicators.push({
                                platform: platform as SourcePlatformType,
                                indicatorType: 'file-extension',
                                match: fileName,
                                confidence,
                            });
                        }
                    }
                }
            }
        }
    }

    /**
     * Simple glob pattern matching.
     */
    private matchGlobPattern(fileName: string, pattern: string): boolean {
        // Convert glob to regex
        const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(fileName);
    }

    /**
     * Check if folder is a system folder.
     */
    private isSystemFolder(folderPath: string): boolean {
        const systemFolders = [
            'C:\\Windows',
            'C:\\Program Files',
            'C:\\Program Files (x86)',
            '/usr',
            '/bin',
            '/sbin',
            '/etc',
            '/var',
            '/System',
        ];

        const normalizedPath = folderPath.toLowerCase().replace(/\\/g, '/');
        return systemFolders.some((sf) =>
            normalizedPath.startsWith(sf.toLowerCase().replace(/\\/g, '/'))
        );
    }

    /**
     * Get workspace folder containing the path.
     */
    private getWorkspaceFolder(folderPath: string): vscode.WorkspaceFolder | undefined {
        return vscode.workspace.workspaceFolders?.find((wf) => {
            const rel = path.relative(wf.uri.fsPath, folderPath);
            return !rel.startsWith('..') && !path.isAbsolute(rel);
        });
    }

    /**
     * Show warning when no integration files found.
     */
    private async showNoIntegrationFilesWarning(result: SourceFolderResult): Promise<boolean> {
        const selection = await vscode.window.showWarningMessage(
            UserPrompts.noIntegrationFilesFound(path.basename(result.path)),
            { modal: true },
            UserPrompts.BUTTON_SELECT_ANYWAY,
            UserPrompts.BUTTON_CHOOSE_DIFFERENT_FOLDER
        );

        return selection === UserPrompts.BUTTON_SELECT_ANYWAY;
    }

    /**
     * Confirm folder change when discovery data exists.
     */
    private async confirmFolderChange(): Promise<boolean> {
        const currentState = this.stateManager.getState();

        // Only ask for confirmation if we have discovery data
        if (currentState.inventory.length === 0) {
            return true;
        }

        const selection = await vscode.window.showWarningMessage(
            UserPrompts.CHANGE_FOLDER_CONFIRM,
            { modal: true },
            UserPrompts.BUTTON_YES_CHANGE_FOLDER,
            UserPrompts.BUTTON_CANCEL
        );

        return selection === UserPrompts.BUTTON_YES_CHANGE_FOLDER;
    }

    /**
     * Dispose of resources.
     */
    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        SourceFolderService.instance = undefined;
    }
}
