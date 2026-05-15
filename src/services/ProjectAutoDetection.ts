/**
 * Project Auto-Detection Notification Service
 *
 * Detects integration projects in the workspace and shows a notification
 * prompting the user to start a migration.
 *
 * @module services/ProjectAutoDetection
 */

import * as vscode from 'vscode';
import { PlatformDetector } from '../stages/discovery/PlatformDetector';
import { PlatformDetectionResult } from '../stages/discovery/types';
import { LoggingService } from './LoggingService';
import { StorageService, StorageKeys } from './StorageService';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for auto-detection behavior.
 */
export interface AutoDetectionConfig {
    /** Whether to show detection notification */
    showNotification: boolean;

    /** Minimum confidence percentage to show notification */
    minConfidence: number;

    /** Folders that have been dismissed (don't show again) */
    dismissedFolders: string[];
}

// =============================================================================
// Project Auto-Detection Service
// =============================================================================

/**
 * Service that automatically detects integration projects and prompts the user.
 */
export class ProjectAutoDetection implements vscode.Disposable {
    private static instance: ProjectAutoDetection | undefined;
    private readonly logger = LoggingService.getInstance();
    private readonly storage = StorageService.getInstance();
    private disposables: vscode.Disposable[] = [];

    private constructor() {}

    /**
     * Get the singleton instance.
     */
    public static getInstance(): ProjectAutoDetection {
        if (!ProjectAutoDetection.instance) {
            ProjectAutoDetection.instance = new ProjectAutoDetection();
        }
        return ProjectAutoDetection.instance;
    }

    /**
     * Initialize and run auto-detection.
     */
    public async initialize(): Promise<void> {
        // Only run if workspace folders exist
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.logger.debug('No workspace folders - skipping auto-detection');
            return;
        }

        // Check configuration
        const showAutoDetection = true;

        if (!showAutoDetection) {
            this.logger.debug('Auto-detection disabled by configuration');
            return;
        }

        // Run detection on the first workspace folder
        const rootFolder = workspaceFolders[0].uri.fsPath;

        // Check if this folder was dismissed
        const dismissedFolders = this.storage.getGlobal<string[]>(
            StorageKeys.DISMISSED_FOLDERS,
            []
        );

        if (dismissedFolders.includes(rootFolder)) {
            this.logger.debug('Folder was previously dismissed', { rootFolder });
            return;
        }

        // Run platform detection (don't await - let activation complete)

        this.detectAndNotify(rootFolder);
    }

    /**
     * Detect platform and show notification if found.
     */
    private async detectAndNotify(folderPath: string): Promise<void> {
        try {
            this.logger.info('Running auto-detection for workspace', { folderPath });

            const detector = PlatformDetector.getInstance();
            const result = await detector.detect(folderPath);

            // Only show notification if confidence is above threshold
            if (result.confidence >= 50 && result.platform !== 'generic') {
                this.logger.info('Showing detection notification', {
                    platform: result.platform,
                    confidence: result.confidence.toString(),
                });
                await this.showDetectionNotification(folderPath, result);
                this.logger.info('Detection notification dismissed');
            } else {
                this.logger.debug('No platform detected with sufficient confidence', {
                    confidence: result.confidence.toString(),
                    platform: result.platform,
                });
            }
        } catch (err) {
            this.logger.error(
                'Auto-detection failed',
                err instanceof Error ? err : new Error(String(err)),
                { folderPath }
            );
        }
    }

    /**
     * Show the detection notification to the user.
     */
    private async showDetectionNotification(
        folderPath: string,
        detection: PlatformDetectionResult
    ): Promise<void> {
        const platformName = this.getPlatformDisplayName(detection.platform);

        // Auto-start migration directly — no confirmation popup
        this.logger.info(
            `Auto-detected ${platformName} project, starting migration automatically`,
            { folderPath, confidence: detection.confidence }
        );

        await vscode.commands.executeCommand(
            'logicAppsMigrationAgent.selectSourceFolder',
            vscode.Uri.file(folderPath)
        );
    }

    /**
     * Get display name for a platform.
     */
    private getPlatformDisplayName(platform: string): string {
        const names: Record<string, string> = {
            biztalk: 'BizTalk Server',
            mulesoft: 'MuleSoft Anypoint',
            tibco: 'TIBCO BusinessWorks',
            generic: 'Generic Integration',
        };

        return names[platform] ?? platform;
    }

    /**
     * Dispose resources.
     */
    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        ProjectAutoDetection.instance = undefined;
    }
}

/**
 * Get the singleton instance of ProjectAutoDetection.
 */
export function getProjectAutoDetection(): ProjectAutoDetection {
    return ProjectAutoDetection.getInstance();
}
