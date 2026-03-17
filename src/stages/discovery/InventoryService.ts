/**
 * Inventory Service
 *
 * Builds and manages the artifact inventory from scan results.
 * Provides querying, persistence, and export capabilities.
 *
 * @module stages/discovery/InventoryService
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { IRDocument } from '../../ir/types/document';
import { UserPrompts } from '../../constants/UserMessages';
import {
    ArtifactInventory,
    InventoryItem,
    InventoryItemMetadata,
    InventoryStatistics,
    ScanResult,
    ParsedArtifact,
    ArtifactCategory,
    InventoryChangedEvent,
} from './types';

// =============================================================================
// Deterministic ID Generation
// =============================================================================

/**
 * Generate a deterministic UUID-v4-formatted ID from a string key.
 * Same key always produces the same ID, keeping references stable
 * across re-scans and VS Code restarts.
 */
function deterministicId(key: string): string {
    const hash = crypto
        .createHash('sha256')
        .update(key.replace(/\\/g, '/').toLowerCase())
        .digest('hex');

    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16),
        ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20),
        hash.substring(20, 32),
    ].join('-');
}

// =============================================================================
// Inventory Builder
// =============================================================================

/**
 * Builds artifact inventory from scan results.
 */
export class InventoryBuilder {
    private readonly logger = LoggingService.getInstance();

    /**
     * Build inventory from scan result.
     */
    public build(
        scanResult: ScanResult,
        projectName: string,
        platformVersion?: string
    ): ArtifactInventory {
        this.logger.info('Building inventory', {
            artifacts: scanResult.parsedArtifacts.length,
            errors: scanResult.parseErrors.length,
        });

        const items: InventoryItem[] = [];
        const addedPaths = new Set<string>();

        // Add successfully parsed artifacts
        for (const artifact of scanResult.parsedArtifacts) {
            items.push(this.createInventoryItem(artifact, 'parsed'));
            addedPaths.add(artifact.sourcePath);
        }

        // Add artifacts with errors (only if not already added as parsed)
        for (const error of scanResult.parseErrors) {
            if (addedPaths.has(error.filePath)) {
                // Skip - this file was already added as a parsed artifact
                continue;
            }
            items.push({
                id: deterministicId(error.filePath),
                name: path.basename(error.filePath, path.extname(error.filePath)),
                category: this.getCategoryFromPath(error.filePath),
                sourcePath: error.filePath,
                status: error.recoverable ? 'warning' : 'error',
                errorMessage: error.message,
                metadata: {
                    fileSize: 0,
                    lastModified: new Date().toISOString(),
                },
                tags: ['parse-error'],
            });
        }

        // Calculate statistics
        const statistics = this.calculateStatistics(items);

        const now = new Date().toISOString();

        return {
            id: deterministicId(`inventory:${projectName}:${scanResult.sourcePath}`),
            projectName,
            platform: scanResult.platform,
            platformVersion,
            sourcePath: scanResult.sourcePath,
            items,
            statistics,
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
    }

    /**
     * Merge new scan results into existing inventory.
     */
    public merge(existing: ArtifactInventory, scanResult: ScanResult): ArtifactInventory {
        const existingItemsByPath = new Map(existing.items.map((item) => [item.sourcePath, item]));

        const mergedItems: InventoryItem[] = [];

        // Update or add items from scan result
        for (const artifact of scanResult.parsedArtifacts) {
            const existingItem = existingItemsByPath.get(artifact.sourcePath);
            if (existingItem) {
                // Update existing item
                mergedItems.push({
                    ...this.createInventoryItem(artifact, 'parsed'),
                    tags: existingItem.tags, // Preserve tags
                });
                existingItemsByPath.delete(artifact.sourcePath);
            } else {
                // New item
                mergedItems.push(this.createInventoryItem(artifact, 'parsed'));
            }
        }

        // Handle errors
        for (const error of scanResult.parseErrors) {
            const existingItem = existingItemsByPath.get(error.filePath);
            if (existingItem) {
                existingItemsByPath.delete(error.filePath);
            }
            mergedItems.push({
                id: existingItem?.id || deterministicId(error.filePath),
                name: path.basename(error.filePath, path.extname(error.filePath)),
                category: this.getCategoryFromPath(error.filePath),
                sourcePath: error.filePath,
                status: error.recoverable ? 'warning' : 'error',
                errorMessage: error.message,
                metadata: {
                    fileSize: 0,
                    lastModified: new Date().toISOString(),
                },
                tags: existingItem?.tags || ['parse-error'],
            });
        }

        // Keep items not in this scan (they may be from a different part of the project)
        // But mark them for potential removal
        for (const [_, item] of existingItemsByPath) {
            mergedItems.push(item);
        }

        const statistics = this.calculateStatistics(mergedItems);

        return {
            ...existing,
            items: mergedItems,
            statistics,
            updatedAt: new Date().toISOString(),
            version: existing.version + 1,
        };
    }

    private createInventoryItem(
        artifact: ParsedArtifact,
        status: 'parsed' | 'error' | 'warning'
    ): InventoryItem {
        const metadata: InventoryItemMetadata = {
            fileSize: artifact.fileSize,
            lastModified: artifact.lastModified,
            actionCount: artifact.ir.actions?.length,
            platformSpecific: {
                parserId: artifact.parserId,
            },
        };

        // Auto-generate tags based on artifact
        const tags: string[] = [artifact.type];
        if (artifact.ir.triggers && artifact.ir.triggers.length > 0) {
            tags.push('has-triggers');
        }
        if (artifact.ir.actions && artifact.ir.actions.length > 10) {
            tags.push('complex');
        }

        return {
            id: artifact.id,
            name: artifact.name,
            category: artifact.type,
            sourcePath: artifact.sourcePath,
            status,
            irId: artifact.id,
            metadata,
            tags,
        };
    }

    private getCategoryFromPath(filePath: string): ArtifactCategory {
        const ext = path.extname(filePath).toLowerCase();
        const mapping: Record<string, ArtifactCategory> = {
            '.odx': 'orchestration',
            '.btm': 'map',
            '.xsd': 'schema',
            '.btp': 'pipeline',
            '.brl': 'policy',
            '.bre': 'policy',
            '.dwl': 'dataweave',
            '.esql': 'esql',
            '.msgflow': 'flow',
            '.process': 'process',
            '.cs': 'dependency',
            '.vb': 'dependency',
            '.java': 'dependency',
            '.csproj': 'dependency',
            '.vbproj': 'dependency',
            '.dll': 'dependency',
            '.jar': 'dependency',
            '.btproj': 'dependency',
        };
        return mapping[ext] || 'other';
    }

    private calculateStatistics(items: InventoryItem[]): InventoryStatistics {
        const byCategory: Record<ArtifactCategory, number> = {
            workflow: 0,
            orchestration: 0,
            flow: 0,
            process: 0,
            map: 0,
            schema: 0,
            pipeline: 0,
            binding: 0,
            policy: 0,
            dataweave: 0,
            esql: 0,
            api: 0,
            connector: 0,
            config: 0,
            project: 0,
            dependency: 0,
            other: 0,
        };

        const byStatus: Record<'parsed' | 'error' | 'warning', number> = {
            parsed: 0,
            error: 0,
            warning: 0,
        };

        let totalFileSize = 0;

        for (const item of items) {
            byCategory[item.category] = (byCategory[item.category] || 0) + 1;
            byStatus[item.status]++;
            totalFileSize += item.metadata.fileSize;
        }

        const errorRate = items.length > 0 ? (byStatus.error / items.length) * 100 : 0;

        return {
            totalCount: items.length,
            byCategory,
            byStatus,
            errorRate,
            totalFileSize,
        };
    }
}

// =============================================================================
// Inventory Service
// =============================================================================

/**
 * Service for managing artifact inventory.
 */
export class InventoryService implements vscode.Disposable {
    private static instance: InventoryService | undefined;

    private readonly logger = LoggingService.getInstance();
    private readonly builder = new InventoryBuilder();
    private readonly irCache = new Map<string, IRDocument>();

    // Current inventory
    private inventory: ArtifactInventory | undefined;

    // Event emitters
    private readonly _onInventoryChanged = new vscode.EventEmitter<InventoryChangedEvent>();
    public readonly onInventoryChanged = this._onInventoryChanged.event;

    private readonly disposables: vscode.Disposable[] = [];

    private constructor() {
        this.disposables.push(this._onInventoryChanged);
    }

    /**
     * Get the singleton instance.
     */
    public static getInstance(): InventoryService {
        if (!InventoryService.instance) {
            InventoryService.instance = new InventoryService();
        }
        return InventoryService.instance;
    }

    /**
     * Initialize and load existing inventory.
     */
    public async initialize(): Promise<void> {
        try {
            const saved = await this.loadFromStorage();
            if (saved) {
                this.inventory = saved;
                this.logger.info('Restored inventory', {
                    itemCount: saved.items.length,
                });

                // Also load IR cache
                await this.loadIRCacheFromStorage();
            }
        } catch (error) {
            this.logger.warn('Failed to restore inventory', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Create inventory from scan result.
     */
    public async createFromScanResult(
        scanResult: ScanResult,
        projectName: string,
        platformVersion?: string
    ): Promise<ArtifactInventory> {
        // Diagnostic: log when overwriting an existing inventory (IDs will change)
        if (this.inventory && this.inventory.items.length > 0) {
            this.logger.warn(
                'Overwriting existing inventory with new scan result — artifact IDs will be regenerated',
                {
                    previousItemCount: this.inventory.items.length,
                    previousIdSample: this.inventory.items
                        .slice(0, 3)
                        .map((i) => i.id)
                        .join(', '),
                    newArtifactCount: scanResult.parsedArtifacts.length,
                    previousSourcePath: this.inventory.sourcePath,
                }
            );
        }

        this.inventory = this.builder.build(scanResult, projectName, platformVersion);

        // Store IR documents in local cache
        for (const artifact of scanResult.parsedArtifacts) {
            this.irCache.set(artifact.id, artifact.ir);
        }

        // Persist inventory
        await this.saveToStorage();

        this._onInventoryChanged.fire({
            inventory: this.inventory,
            changeType: 'created',
        });

        this.logger.info('Inventory created', {
            itemCount: this.inventory.items.length,
        });

        return this.inventory;
    }

    /**
     * Update inventory with new scan result.
     */
    public async updateFromScanResult(scanResult: ScanResult): Promise<ArtifactInventory> {
        if (!this.inventory) {
            throw new Error('No existing inventory to update');
        }

        this.inventory = this.builder.merge(this.inventory, scanResult);

        // Store new IR documents in local cache
        for (const artifact of scanResult.parsedArtifacts) {
            this.irCache.set(artifact.id, artifact.ir);
        }

        await this.saveToStorage();

        this._onInventoryChanged.fire({
            inventory: this.inventory,
            changeType: 'updated',
        });

        return this.inventory;
    }

    /**
     * Get current inventory.
     */
    public getInventory(): ArtifactInventory | undefined {
        return this.inventory;
    }

    /**
     * Get an item by ID.
     */
    public getItem(id: string): InventoryItem | undefined {
        return this.inventory?.items.find((item) => item.id === id);
    }

    /**
     * Get items by category.
     */
    public getItemsByCategory(category: ArtifactCategory): InventoryItem[] {
        return this.inventory?.items.filter((item) => item.category === category) || [];
    }

    /**
     * Get items by status.
     */
    public getItemsByStatus(status: 'parsed' | 'error' | 'warning'): InventoryItem[] {
        return this.inventory?.items.filter((item) => item.status === status) || [];
    }

    /**
     * Search items by name.
     */
    public searchItems(query: string): InventoryItem[] {
        if (!this.inventory) {
            return [];
        }

        const lowerQuery = query.toLowerCase();
        return this.inventory.items.filter(
            (item) =>
                item.name.toLowerCase().includes(lowerQuery) ||
                item.sourcePath.toLowerCase().includes(lowerQuery) ||
                item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Update item tags.
     */
    public async updateItemTags(id: string, tags: string[]): Promise<void> {
        if (!this.inventory) {
            return;
        }

        const item = this.inventory.items.find((i) => i.id === id);
        if (item) {
            (item as { tags: string[] }).tags = tags;
            (this.inventory as { updatedAt: string }).updatedAt = new Date().toISOString();
            await this.saveToStorage();

            this._onInventoryChanged.fire({
                inventory: this.inventory,
                changeType: 'updated',
            });
        }
    }

    /**
     * Get all cached IR documents.
     */
    public getIRDocuments(): Map<string, IRDocument> {
        return this.irCache;
    }

    /**
     * Get IR document for an item.
     */
    public async getItemIR(id: string): Promise<IRDocument | null> {
        const item = this.getItem(id);
        if (!item?.irId) {
            return null;
        }

        return this.irCache.get(item.irId) || null;
    }

    /**
     * Reload IR cache from storage.
     * Used as a recovery mechanism when the inventory has items but the IR cache is empty
     * (e.g., after a VS Code restart where the cache didn't load initially).
     */
    public async reloadIRCache(): Promise<void> {
        await this.loadIRCacheFromStorage();
    }

    /**
     * Get all parsed artifacts from the current inventory.
     * Reconstructs ParsedArtifact objects from inventory items and cached IR documents.
     */
    public async getAllParsedArtifacts(): Promise<ParsedArtifact[]> {
        if (!this.inventory) {
            return [];
        }

        const artifacts: ParsedArtifact[] = [];

        for (const item of this.inventory.items) {
            if (item.irId) {
                const ir = this.irCache.get(item.irId);
                if (ir) {
                    // Compute absolute path from inventory source path
                    const absolutePath = this.inventory.sourcePath
                        ? path.join(this.inventory.sourcePath, item.sourcePath)
                        : item.sourcePath;

                    artifacts.push({
                        id: item.id,
                        name: item.name,
                        type: item.category,
                        sourcePath: item.sourcePath,
                        absolutePath,
                        ir,
                        fileSize: item.metadata.fileSize,
                        lastModified: item.metadata.lastModified,
                        parserId: 'unknown', // Parser ID not stored in inventory
                    });
                }
            }
        }

        artifacts.sort((a, b) => {
            const byPath = a.sourcePath.localeCompare(b.sourcePath);
            if (byPath !== 0) {
                return byPath;
            }
            const byType = a.type.localeCompare(b.type);
            if (byType !== 0) {
                return byType;
            }
            const byName = a.name.localeCompare(b.name);
            if (byName !== 0) {
                return byName;
            }
            return a.id.localeCompare(b.id);
        });

        return artifacts;
    }

    /**
     * Export inventory to JSON.
     */
    public exportToJson(): string {
        if (!this.inventory) {
            throw new Error('No inventory to export');
        }
        return JSON.stringify(this.inventory, null, 2);
    }

    /**
     * Export inventory to CSV.
     */
    public exportToCsv(): string {
        if (!this.inventory) {
            throw new Error('No inventory to export');
        }

        const headers = ['ID', 'Name', 'Category', 'Source Path', 'Status', 'File Size', 'Tags'];
        const rows = this.inventory.items.map((item) => [
            item.id,
            item.name,
            item.category,
            item.sourcePath,
            item.status,
            item.metadata.fileSize.toString(),
            item.tags.join(';'),
        ]);

        return [
            headers.join(','),
            ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n');
    }

    /**
     * Export inventory to Markdown.
     */
    public exportToMarkdown(): string {
        if (!this.inventory) {
            throw new Error('No inventory to export');
        }

        const lines: string[] = [];
        lines.push(`# Artifact Inventory: ${this.inventory.projectName}`);
        lines.push('');
        lines.push(`**Platform:** ${this.inventory.platform}`);
        lines.push(`**Source Path:** ${this.inventory.sourcePath}`);
        lines.push(`**Total Artifacts:** ${this.inventory.statistics.totalCount}`);
        lines.push(`**Created:** ${this.inventory.createdAt}`);
        lines.push(`**Updated:** ${this.inventory.updatedAt}`);
        lines.push('');
        lines.push('## Statistics');
        lines.push('');
        lines.push('| Category | Count |');
        lines.push('|----------|-------|');
        for (const [category, count] of Object.entries(this.inventory.statistics.byCategory)) {
            if (count > 0) {
                lines.push(`| ${category} | ${count} |`);
            }
        }
        lines.push('');
        lines.push('## Artifacts');
        lines.push('');
        lines.push('| Name | Category | Status | Source Path |');
        lines.push('|------|----------|--------|-------------|');
        for (const item of this.inventory.items) {
            lines.push(`| ${item.name} | ${item.category} | ${item.status} | ${item.sourcePath} |`);
        }

        return lines.join('\n');
    }

    /**
     * Export inventory to file.
     */
    public async exportToFile(format: 'json' | 'csv'): Promise<void> {
        const content = format === 'json' ? this.exportToJson() : this.exportToCsv();
        const ext = format === 'json' ? 'json' : 'csv';

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`inventory.${ext}`),
            filters: {
                [format.toUpperCase()]: [ext],
            },
        });

        if (uri) {
            await fs.promises.writeFile(uri.fsPath, content, 'utf-8');
            vscode.window.showInformationMessage(UserPrompts.inventoryExportedTo(uri.fsPath));
        }
    }

    /**
     * Clear inventory.
     */
    public async clearInventory(): Promise<void> {
        // Clear IR cache
        this.irCache.clear();

        this.inventory = undefined;
        await this.removeFromStorage();

        // Fire event so UI updates
        this._onInventoryChanged.fire({
            inventory: undefined,
            changeType: 'cleared',
        });

        this.logger.info('Inventory cleared');
    }

    /**
     * Refresh inventory (re-scan).
     */
    public async refresh(scanResult: ScanResult): Promise<ArtifactInventory> {
        if (this.inventory) {
            return this.updateFromScanResult(scanResult);
        } else {
            return this.createFromScanResult(scanResult, path.basename(scanResult.sourcePath));
        }
    }

    // =========================================================================
    // Storage
    // =========================================================================

    private async saveToStorage(): Promise<void> {
        if (!this.inventory) {
            return;
        }

        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const migrationDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'migration');
            await fs.promises.mkdir(migrationDir, { recursive: true });

            const inventoryPath = path.join(migrationDir, 'inventory.json');
            await fs.promises.writeFile(
                inventoryPath,
                JSON.stringify(this.inventory, null, 2),
                'utf-8'
            );

            // Also save IR cache for flow visualization to work after restart
            await this.saveIRCacheToStorage();

            this.logger.debug('Inventory saved to storage');
        } catch (error) {
            this.logger.error('Failed to save inventory', error as Error);
        }
    }

    /**
     * Save IR cache to storage for persistence across VS Code restarts.
     */
    private async saveIRCacheToStorage(): Promise<void> {
        if (this.irCache.size === 0) {
            return;
        }

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const migrationDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'migration');
            await fs.promises.mkdir(migrationDir, { recursive: true });

            // Convert Map to serializable object
            const irCacheData: Record<string, IRDocument> = {};
            for (const [key, value] of this.irCache.entries()) {
                irCacheData[key] = value;
            }

            const irCachePath = path.join(migrationDir, 'ir-cache.json');
            await fs.promises.writeFile(irCachePath, JSON.stringify(irCacheData, null, 2), 'utf-8');

            this.logger.debug('IR cache saved to storage', { count: this.irCache.size });
        } catch (error) {
            this.logger.error('Failed to save IR cache', error as Error);
        }
    }

    /**
     * Load IR cache from storage.
     */
    private async loadIRCacheFromStorage(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const irCachePath = path.join(
                workspaceFolder.uri.fsPath,
                '.vscode',
                'migration',
                'ir-cache.json'
            );

            if (!fs.existsSync(irCachePath)) {
                this.logger.debug('No IR cache file found');
                return;
            }

            const content = await fs.promises.readFile(irCachePath, 'utf-8');
            const irCacheData = JSON.parse(content) as Record<string, IRDocument>;

            // Restore Map from serialized object
            this.irCache.clear();
            for (const [key, value] of Object.entries(irCacheData)) {
                this.irCache.set(key, value);
            }

            this.logger.info('IR cache restored from storage', { count: this.irCache.size });
        } catch (error) {
            this.logger.warn('Failed to load IR cache from storage', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async loadFromStorage(): Promise<ArtifactInventory | null> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return null;
            }

            const inventoryPath = path.join(
                workspaceFolder.uri.fsPath,
                '.vscode',
                'migration',
                'inventory.json'
            );

            if (!fs.existsSync(inventoryPath)) {
                return null;
            }

            const content = await fs.promises.readFile(inventoryPath, 'utf-8');
            return JSON.parse(content) as ArtifactInventory;
        } catch {
            return null;
        }
    }

    private async removeFromStorage(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const migrationDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'migration');

            const inventoryPath = path.join(migrationDir, 'inventory.json');
            const irCachePath = path.join(migrationDir, 'ir-cache.json');

            if (fs.existsSync(inventoryPath)) {
                await fs.promises.unlink(inventoryPath);
            }
            if (fs.existsSync(irCachePath)) {
                await fs.promises.unlink(irCachePath);
            }
        } catch {
            // Ignore errors
        }
    }

    /**
     * Dispose of resources.
     */
    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        InventoryService.instance = undefined;
    }
}
