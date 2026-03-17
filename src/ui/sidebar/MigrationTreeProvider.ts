/**
 * MigrationTreeProvider - Tree Data Provider for the migration sidebar
 *
 * This is the main tree view provider that displays migration status,
 * stages, and artifact inventory in the VS Code sidebar.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MigrationTreeItem } from './MigrationTreeItem';
import { StateManager, MigrationState, DiscoveredArtifact } from '../../services/StateManager';
import { MigrationStage } from '../../types/stages';
import { LoggingService } from '../../services/LoggingService';
import { DiscoveryCacheService } from '../../stages/discovery/DiscoveryCacheService';

/**
 * Tree view type
 */
export type MigrationTreeViewType = 'home' | 'inventory' | 'actions';

/**
 * Event types for tree data changes
 */
export type TreeDataChangeType = 'full' | 'item' | 'children';

/**
 * Migration TreeData Provider
 */
export class MigrationTreeProvider
    implements vscode.TreeDataProvider<MigrationTreeItem>, vscode.Disposable
{
    private static instances = new Map<MigrationTreeViewType, MigrationTreeProvider>();

    /** Event emitter for tree data changes */
    private _onDidChangeTreeData = new vscode.EventEmitter<
        MigrationTreeItem | undefined | null | void
    >();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /** View type this provider handles */
    private readonly viewType: MigrationTreeViewType;

    /** Cache of tree items by ID */
    private itemCache = new Map<string, MigrationTreeItem>();

    /** Disposables */
    private disposables: vscode.Disposable[] = [];

    /** Logger */
    private logger = LoggingService.getInstance();

    private constructor(viewType: MigrationTreeViewType) {
        this.viewType = viewType;
        this.setupEventListeners();
    }

    /**
     * Get or create singleton instance for a view type
     */
    public static getInstance(viewType: MigrationTreeViewType): MigrationTreeProvider {
        if (!MigrationTreeProvider.instances.has(viewType)) {
            MigrationTreeProvider.instances.set(viewType, new MigrationTreeProvider(viewType));
        }
        return MigrationTreeProvider.instances.get(viewType) as MigrationTreeProvider;
    }

    /**
     * Setup event listeners for state changes
     */
    private setupEventListeners(): void {
        // Listen to state changes from StateManager
        const stateManager = StateManager.getInstance();
        const stateDisposable = stateManager.onDidChangeState(() => {
            this.refresh();
        });
        this.disposables.push(stateDisposable);
    }

    /**
     * Refresh the tree view
     */
    public refresh(item?: MigrationTreeItem): void {
        this.itemCache.clear();
        this._onDidChangeTreeData.fire(item);
    }

    /**
     * Get tree item for display
     */
    public getTreeItem(element: MigrationTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for a tree item (or root items if no element)
     */
    public async getChildren(element?: MigrationTreeItem): Promise<MigrationTreeItem[]> {
        try {
            if (!element) {
                // Root level - depends on view type
                return this.getRootItems();
            }

            // Get children based on item type
            return this.getItemChildren(element);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.logger.error('Error getting tree children', error, { viewType: this.viewType });
            return [];
        }
    }

    /**
     * Get parent of an item (for reveal functionality)
     */
    public getParent(element: MigrationTreeItem): MigrationTreeItem | undefined {
        if (element.parentId) {
            return this.itemCache.get(element.parentId);
        }
        return undefined;
    }

    /**
     * Get root items based on view type
     */
    private getRootItems(): MigrationTreeItem[] {
        switch (this.viewType) {
            case 'home':
                return this.getHomeRootItems();
            case 'inventory':
                return this.getInventoryRootItems();
            case 'actions':
                return this.getActionsRootItems();
            default:
                return [];
        }
    }

    /**
     * Get root items for home view
     */
    private getHomeRootItems(): MigrationTreeItem[] {
        const item = new MigrationTreeItem({
            id: 'home-open-main',
            label: 'Home Page',
            type: 'action',
            icon: new vscode.ThemeIcon('home'),
            tooltip: 'Open discovery main page (logical groups loading/selector)',
            command: {
                command: 'logicAppsMigrationAssistant.viewFlowVisualization',
                title: 'Home Page',
            },
            contextValue: 'migration.action.primary',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
        });

        this.cacheItem(item);
        return [item];
    }

    /**
     * Get root items for inventory view
     */
    private getInventoryRootItems(): MigrationTreeItem[] {
        const stateManager = StateManager.getInstance();
        const state = stateManager.getState();
        const items: MigrationTreeItem[] = [];

        // If no inventory yet, return empty
        if (!state.inventory || state.inventory.length === 0) {
            return items;
        }

        // Group artifacts by type
        const groups = this.groupArtifactsByType(state.inventory);

        for (const [groupName, artifacts] of Object.entries(groups)) {
            const groupItem = this.createArtifactGroupItem(groupName, artifacts);
            items.push(groupItem);
            this.cacheItem(groupItem);
        }

        return items;
    }

    /**
     * Get root items for actions view
     */
    private getActionsRootItems(): MigrationTreeItem[] {
        const stateManager = StateManager.getInstance();
        const state = stateManager.getState();
        const items: MigrationTreeItem[] = [];

        // Primary action based on state
        const primaryAction = this.getPrimaryAction(state);
        if (primaryAction) {
            items.push(primaryAction);
            this.cacheItem(primaryAction);
        }

        // Common actions
        const commonActions = this.getCommonActions(state);
        commonActions.forEach((item) => {
            items.push(item);
            this.cacheItem(item);
        });

        return items;
    }

    /**
     * Get children for a specific item
     */
    private getItemChildren(element: MigrationTreeItem): MigrationTreeItem[] {
        const items: MigrationTreeItem[] = [];

        switch (element.itemType) {
            case 'artifactGroup':
                // Return artifacts in this group
                return this.getArtifactItems(element);
            default:
                return items;
        }
    }

    /**
     * Group artifacts by type
     */
    private groupArtifactsByType(
        inventory: DiscoveredArtifact[]
    ): Record<string, DiscoveredArtifact[]> {
        const groups: Record<string, DiscoveredArtifact[]> = {};

        for (const artifact of inventory) {
            const type = artifact.type || 'unknown';
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(artifact);
        }

        return groups;
    }

    /**
     * Create artifact group item
     */
    private createArtifactGroupItem(
        groupName: string,
        artifacts: DiscoveredArtifact[]
    ): MigrationTreeItem {
        const groupLabels: Record<string, string> = {
            orchestration: 'Orchestrations',
            map: 'Maps',
            schema: 'Schemas',
            pipeline: 'Pipelines',
            binding: 'Bindings',
            flow: 'Flows',
            dataweave: 'DataWeave',
            process: 'Processes',
            recipe: 'Recipes',
            unknown: 'Other',
        };

        const item = new MigrationTreeItem({
            id: `artifact-group-${groupName}`,
            label: groupLabels[groupName] || groupName,
            type: 'artifactGroup',
            description: `(${artifacts.length})`,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: 'migration.artifactGroup',
            metadata: { groupName, artifacts },
            childrenIds: artifacts.map((a) => `artifact-${a.name}`),
        });

        return item;
    }

    /**
     * Get artifact items for a group
     */
    private getArtifactItems(groupItem: MigrationTreeItem): MigrationTreeItem[] {
        const artifacts = groupItem.metadata.artifacts as DiscoveredArtifact[];
        const groupName = groupItem.metadata.groupName as string;
        const stateManager = StateManager.getInstance();
        const state = stateManager.getState();
        const projectPath = state.projectPath || '';

        return artifacts.map((artifact) => {
            // Resolve relative path to absolute using projectPath
            const absolutePath = path.isAbsolute(artifact.filePath)
                ? artifact.filePath
                : path.join(projectPath, artifact.filePath);

            const item = new MigrationTreeItem({
                id: `artifact-${artifact.id}`,
                label: artifact.name,
                type: 'artifact',
                tooltip: artifact.filePath,
                parentId: groupItem.itemId,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                command: {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(absolutePath)],
                },
                contextValue: 'migration.artifact',
                metadata: {
                    artifactType: groupName,
                    path: artifact.filePath,
                    absolutePath: absolutePath,
                    platform: artifact.platform,
                },
            });

            this.cacheItem(item);
            return item;
        });
    }

    /**
     * Get primary action based on current state
     */
    private getPrimaryAction(_state: MigrationState): MigrationTreeItem | null {
        const stateManager = StateManager.getInstance();
        const currentStage = stateManager.getCurrentStage();
        const hasFlowGroups = DiscoveryCacheService.getInstance().hasFlowGroups();

        if (currentStage === MigrationStage.NotStarted) {
            if (hasFlowGroups) {
                return new MigrationTreeItem({
                    id: 'action-reset-primary',
                    label: 'Reset Migration',
                    type: 'action',
                    icon: new vscode.ThemeIcon('refresh'),
                    command: {
                        command: 'logicAppsMigrationAssistant.resetMigration',
                        title: 'Reset Migration',
                    },
                    contextValue: 'migration.action.primary migration.action.destructive',
                });
            }

            return new MigrationTreeItem({
                id: 'action-start',
                label: 'Start Migration',
                type: 'action',
                icon: new vscode.ThemeIcon('rocket'),
                command: {
                    command: 'logicAppsMigrationAssistant.selectSourceFolder',
                    title: 'Start Migration',
                },
                contextValue: 'migration.action.primary',
            });
        }

        // Show flow view if migration is in progress
        return new MigrationTreeItem({
            id: 'action-open-main',
            label: 'Open Main Flow View',
            type: 'action',
            icon: new vscode.ThemeIcon('preview'),
            command: {
                command: 'logicAppsMigrationAssistant.viewFlowVisualization',
                title: 'Open Main Flow View',
            },
            contextValue: 'migration.action.primary',
        });
    }

    /**
     * Get common actions
     */
    private getCommonActions(state: MigrationState): MigrationTreeItem[] {
        const actions: MigrationTreeItem[] = [];
        const stateManager = StateManager.getInstance();
        const currentStage = stateManager.getCurrentStage();

        this.logger.debug('getCommonActions', {
            currentStage,
            inventoryCount: state.inventory.length,
        });

        if (currentStage !== MigrationStage.NotStarted) {
            actions.push(
                new MigrationTreeItem({
                    id: 'action-reset',
                    label: 'Reset Migration',
                    type: 'action',
                    icon: new vscode.ThemeIcon('refresh'),
                    command: {
                        command: 'logicAppsMigrationAssistant.resetMigration',
                        title: 'Reset Migration',
                    },
                    contextValue: 'migration.action.destructive',
                })
            );
        }

        actions.push(
            new MigrationTreeItem({
                id: 'action-settings',
                label: 'Settings',
                type: 'action',
                icon: new vscode.ThemeIcon('gear'),
                command: {
                    command: 'workbench.action.openSettings',
                    title: 'Settings',
                    arguments: ['logicAppsMigration'],
                },
                contextValue: 'migration.action',
            })
        );

        actions.push(
            new MigrationTreeItem({
                id: 'action-logs',
                label: 'View Logs',
                type: 'action',
                icon: new vscode.ThemeIcon('output'),
                command: {
                    command: 'logicAppsMigrationAssistant.showLogs',
                    title: 'View Logs',
                },
                contextValue: 'migration.action',
            })
        );

        return actions;
    }

    /**
     * Cache a tree item
     */
    private cacheItem(item: MigrationTreeItem): void {
        this.itemCache.set(item.itemId, item);
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this._onDidChangeTreeData.dispose();
        this.itemCache.clear();
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }

    /**
     * Dispose all instances (static cleanup)
     */
    public static disposeAll(): void {
        MigrationTreeProvider.instances.forEach((provider) => provider.dispose());
        MigrationTreeProvider.instances.clear();
    }
}

/**
 * Register all tree view providers
 */
export function registerTreeViewProviders(context: vscode.ExtensionContext): void {
    // Register home tree view
    const homeProvider = MigrationTreeProvider.getInstance('home');
    const homeTreeView = vscode.window.createTreeView('logicAppsMigrationAssistant.home', {
        treeDataProvider: homeProvider,
        showCollapseAll: false,
    });
    context.subscriptions.push(homeTreeView);

    // Register inventory tree view
    const inventoryProvider = MigrationTreeProvider.getInstance('inventory');
    const inventoryTreeView = vscode.window.createTreeView('logicAppsMigrationAssistant.inventory', {
        treeDataProvider: inventoryProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(inventoryTreeView);

    // Register actions tree view
    const actionsProvider = MigrationTreeProvider.getInstance('actions');
    const actionsTreeView = vscode.window.createTreeView('logicAppsMigrationAssistant.actions', {
        treeDataProvider: actionsProvider,
    });
    context.subscriptions.push(actionsTreeView);

    // Register command to refresh all views
    const refreshCommand = vscode.commands.registerCommand(
        'logicAppsMigrationAssistant.refreshViews',
        () => {
            inventoryProvider.refresh();
            actionsProvider.refresh();
        }
    );
    context.subscriptions.push(refreshCommand);
}
