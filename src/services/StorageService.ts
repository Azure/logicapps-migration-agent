/**
 * Storage Service
 *
 * Provides persistent storage using JSON files under `.vscode/migration/state/`
 * in the workspace folder. All state is driven from the migration folder on disk —
 * deleting `.vscode/migration/` cleanly resets everything.
 *
 * Global storage (user preferences, telemetry) still uses VS Code ExtensionContext.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from './LoggingService';

/**
 * Storage keys used by the extension
 */
export const StorageKeys = {
    // Workspace storage keys
    MIGRATION_STATE: 'migrationState',
    CURRENT_STAGE: 'currentStage',
    PROJECT_PATH: 'projectPath',
    INVENTORY: 'inventory',
    IR_CACHE: 'irCache',
    MIGRATION_PLAN: 'migrationPlan',
    CONVERSION_STATE: 'conversionState',
    STATE_MACHINE: 'logicAppsMigrationAgent.stateMachine',
    DISCOVERY_RESULT: 'discoveryResult',
    MSI_EXTRACTION_PATH: 'msiExtractionPath',

    // Global storage keys
    RECENT_PROJECTS: 'recentProjects',
    USER_PREFERENCES: 'userPreferences',
    TELEMETRY_ID: 'telemetryId',
    DISMISSED_FOLDERS: 'dismissedFolders',
} as const;

/**
 * Type for storage keys
 */
export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/**
 * Singleton storage service
 */
export class StorageService implements vscode.Disposable {
    private static instance: StorageService | undefined;
    private context: vscode.ExtensionContext | undefined;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): StorageService {
        if (!StorageService.instance) {
            StorageService.instance = new StorageService();
        }
        return StorageService.instance;
    }

    /**
     * Initialize the storage service
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;

        // Set keys for sync (user preferences that should roam)
        context.globalState.setKeysForSync([
            StorageKeys.USER_PREFERENCES,
            StorageKeys.RECENT_PROJECTS,
        ]);

        LoggingService.getInstance().debug('Storage service initialized');
    }

    // ==================== Workspace Storage (disk-backed) ====================

    /**
     * Get the state directory path: .vscode/migration/state/
     */
    private getStateDir(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        return path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'migration', 'state');
    }

    /**
     * Get a value from workspace storage (reads from .vscode/migration/state/{key}.json)
     */
    public getWorkspace<T>(key: StorageKey, defaultValue: T): T {
        const stateDir = this.getStateDir();
        if (!stateDir) {
            return defaultValue;
        }
        const filePath = path.join(stateDir, `${key}.json`);
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(data) as T;
            }
        } catch {
            // Corrupt file — return default
        }
        return defaultValue;
    }

    /**
     * Set a value in workspace storage (writes to .vscode/migration/state/{key}.json)
     */
    public async setWorkspace<T>(key: StorageKey, value: T): Promise<void> {
        const stateDir = this.getStateDir();
        if (!stateDir) {
            LoggingService.getInstance().warn('No workspace folder — cannot persist state to disk');
            return;
        }
        try {
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }
            const filePath = path.join(stateDir, `${key}.json`);
            if (value === undefined || value === null) {
                // Remove the file if value is undefined/null
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } else {
                fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
            }
            LoggingService.getInstance().debug(`Workspace storage updated: ${key}`);
        } catch (err) {
            LoggingService.getInstance().warn(`Failed to write workspace storage: ${key} — ${err}`);
        }
    }

    /**
     * Remove a value from workspace storage
     */
    public async removeWorkspace(key: StorageKey): Promise<void> {
        await this.setWorkspace(key, undefined);
        LoggingService.getInstance().debug(`Workspace storage removed: ${key}`);
    }

    /**
     * Clear all workspace storage
     */
    public async clearWorkspace(): Promise<void> {
        const stateDir = this.getStateDir();
        if (stateDir && fs.existsSync(stateDir)) {
            try {
                fs.rmSync(stateDir, { recursive: true, force: true });
                LoggingService.getInstance().info('Workspace storage cleared (state dir removed)');
            } catch (err) {
                LoggingService.getInstance().warn(`Failed to clear workspace storage: ${err}`);
            }
        }
    }

    // ==================== Global Storage ====================

    /**
     * Get a value from global storage
     */
    public getGlobal<T>(key: StorageKey, defaultValue: T): T {
        if (!this.context) {
            LoggingService.getInstance().warn('Storage service not initialized');
            return defaultValue;
        }
        return this.context.globalState.get<T>(key, defaultValue);
    }

    /**
     * Set a value in global storage
     */
    public async setGlobal<T>(key: StorageKey, value: T): Promise<void> {
        if (!this.context) {
            LoggingService.getInstance().warn('Storage service not initialized');
            return;
        }
        await this.context.globalState.update(key, value);
        LoggingService.getInstance().debug(`Global storage updated: ${key}`);
    }

    /**
     * Remove a value from global storage
     */
    public async removeGlobal(key: StorageKey): Promise<void> {
        if (!this.context) {
            return;
        }
        await this.context.globalState.update(key, undefined);
        LoggingService.getInstance().debug(`Global storage removed: ${key}`);
    }

    /**
     * Clear all global storage
     */
    public async clearGlobal(): Promise<void> {
        if (!this.context) {
            return;
        }

        const keys = this.context.globalState.keys();
        for (const key of keys) {
            await this.context.globalState.update(key, undefined);
        }
        LoggingService.getInstance().info('Global storage cleared');
    }

    // ==================== Large Object Storage ====================

    /**
     * Store a large object by chunking it
     * Used for IR data that may exceed storage limits
     */
    public async setLargeWorkspace<T>(key: StorageKey, value: T): Promise<void> {
        if (!this.context) {
            return;
        }

        const serialized = JSON.stringify(value);
        const chunkSize = 500000; // 500KB chunks

        if (serialized.length <= chunkSize) {
            // Small enough, store directly
            await this.setWorkspace(key, value);
            await this.removeWorkspace(`${key}_chunks` as StorageKey);
            return;
        }

        // Split into chunks
        const chunks: string[] = [];
        for (let i = 0; i < serialized.length; i += chunkSize) {
            chunks.push(serialized.slice(i, i + chunkSize));
        }

        // Store chunk count and chunks
        await this.setWorkspace(`${key}_chunks` as StorageKey, chunks.length);
        for (let i = 0; i < chunks.length; i++) {
            await this.setWorkspace(`${key}_chunk_${i}` as StorageKey, chunks[i]);
        }

        // Clear direct storage
        await this.removeWorkspace(key);

        LoggingService.getInstance().debug(
            `Large object stored in ${chunks.length} chunks: ${key}`
        );
    }

    /**
     * Retrieve a large object that was stored in chunks
     */
    public getLargeWorkspace<T>(key: StorageKey, defaultValue: T): T {
        if (!this.context) {
            return defaultValue;
        }

        // Check if chunked
        const chunkCount = this.getWorkspace<number | undefined>(
            `${key}_chunks` as StorageKey,
            undefined
        );

        if (chunkCount === undefined) {
            // Not chunked, get directly
            return this.getWorkspace<T>(key, defaultValue);
        }

        // Reassemble chunks
        let serialized = '';
        for (let i = 0; i < chunkCount; i++) {
            const chunk = this.getWorkspace<string>(`${key}_chunk_${i}` as StorageKey, '');
            serialized += chunk;
        }

        try {
            return JSON.parse(serialized) as T;
        } catch (error) {
            LoggingService.getInstance().error('Failed to parse chunked data', error as Error, {
                key,
            });
            return defaultValue;
        }
    }

    /**
     * Get the extension's storage URI
     */
    public getStorageUri(): vscode.Uri | undefined {
        return this.context?.storageUri;
    }

    /**
     * Get the extension's global storage URI
     */
    public getGlobalStorageUri(): vscode.Uri | undefined {
        return this.context?.globalStorageUri;
    }

    /**
     * Dispose the storage service
     */
    public dispose(): void {
        StorageService.instance = undefined;
    }
}
