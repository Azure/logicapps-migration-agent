/**
 * Discovery Tree Provider
 *
 * Tree data provider for displaying discovery results in the sidebar.
 * Shows artifacts organized by type, with status badges and navigation.
 * For BizTalk binding artifacts, extracts semantic sub-items (Receive Ports,
 * Receive Locations, Send Ports, Send Port Groups) from the IR data.
 *
 * @module views/discovery/DiscoveryTreeProvider
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { InventoryService } from '../../stages/discovery/InventoryService';
import {
    ArtifactInventory,
    InventoryItem,
    ArtifactCategory,
    InventoryStatistics,
} from '../../stages/discovery/types';

// =============================================================================
// Tree Item Types
// =============================================================================

/**
 * Types of tree items in the discovery view.
 */
type DiscoveryTreeItemType =
    | 'root'
    | 'project-info'
    | 'statistics'
    | 'category'
    | 'virtual-category'
    | 'artifact'
    | 'virtual-artifact'
    | 'error-group'
    | 'error-item';

/**
 * Virtual category key for BizTalk sub-items extracted from binding IR.
 */
type VirtualCategory =
    | 'receive-port'
    | 'receive-location'
    | 'send-port'
    | 'send-port-group'
    | 'role-link'
    | 'policy';

/**
 * Tree item for discovery results.
 */
export class DiscoveryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly itemType: DiscoveryTreeItemType,
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly data?: {
            category?: ArtifactCategory;
            virtualCategory?: VirtualCategory;
            item?: InventoryItem;
            count?: number;
            /** Virtual sub-items: name + description pairs */
            virtualItems?: { name: string; description?: string; tooltip?: string }[];
        }
    ) {
        super(label, collapsibleState);
        this.contextValue = itemType;
    }
}

// =============================================================================
// Category Info
// =============================================================================

/**
 * Category display information.
 */
const CATEGORY_INFO: Record<string, { label: string; icon: string; priority: number }> = {
    orchestration: { label: 'Orchestrations', icon: 'git-merge', priority: 1 },
    'role-link': { label: 'Role Links', icon: 'link', priority: 2 },
    'send-port-group': { label: 'Send Port Groups', icon: 'group-by-ref-type', priority: 3 },
    'send-port': { label: 'Send Ports', icon: 'call-outgoing', priority: 4 },
    'receive-port': { label: 'Receive Ports', icon: 'call-incoming', priority: 5 },
    'receive-location': { label: 'Receive Locations', icon: 'location', priority: 6 },
    policy: { label: 'Policies', icon: 'law', priority: 7 },
    schema: { label: 'Schemas', icon: 'file-code', priority: 8 },
    map: { label: 'Maps', icon: 'symbol-array', priority: 9 },
    pipeline: { label: 'Pipelines', icon: 'layers', priority: 10 },
    flow: { label: 'Flows', icon: 'git-branch', priority: 11 },
    process: { label: 'Processes', icon: 'workflow', priority: 12 },
    workflow: { label: 'Workflows', icon: 'list-tree', priority: 13 },
    binding: { label: 'Bindings', icon: 'plug', priority: 14 },
    dataweave: { label: 'DataWeave', icon: 'symbol-function', priority: 15 },
    esql: { label: 'ESQL', icon: 'database', priority: 16 },
    api: { label: 'APIs', icon: 'globe', priority: 17 },
    connector: { label: 'Connectors', icon: 'extensions', priority: 18 },
    config: { label: 'Configuration', icon: 'gear', priority: 19 },
    project: { label: 'Projects', icon: 'project', priority: 20 },
    dependency: { label: 'Resources', icon: 'package', priority: 21 },
    other: { label: 'Other', icon: 'file', priority: 99 },
};

// =============================================================================
// Discovery Tree Provider
// =============================================================================

/**
 * Tree data provider for discovery results.
 */
export class DiscoveryTreeProvider
    implements vscode.TreeDataProvider<DiscoveryTreeItem>, vscode.Disposable
{
    private static instance: DiscoveryTreeProvider | undefined;

    private readonly inventoryService = InventoryService.getInstance();

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<
        DiscoveryTreeItem | undefined | null | void
    >();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly disposables: vscode.Disposable[] = [];

    private constructor() {
        this.disposables.push(this._onDidChangeTreeData);

        // Listen for inventory changes
        this.disposables.push(
            this.inventoryService.onInventoryChanged(() => {
                this.refresh();
            })
        );
    }

    /**
     * Get singleton instance.
     */
    public static getInstance(): DiscoveryTreeProvider {
        if (!DiscoveryTreeProvider.instance) {
            DiscoveryTreeProvider.instance = new DiscoveryTreeProvider();
        }
        return DiscoveryTreeProvider.instance;
    }

    /**
     * Refresh the tree view.
     */
    public refresh(item?: DiscoveryTreeItem): void {
        this._onDidChangeTreeData.fire(item);
    }

    /**
     * Get tree item for display.
     */
    public getTreeItem(element: DiscoveryTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for a tree item.
     */
    public async getChildren(element?: DiscoveryTreeItem): Promise<DiscoveryTreeItem[]> {
        const inventory = this.inventoryService.getInventory();

        if (!element) {
            // Root level
            return this.getRootItems(inventory);
        }

        switch (element.itemType) {
            case 'category':
                return this.getCategoryItems(element.data?.category, inventory);
            case 'virtual-category':
                return this.getVirtualCategoryItems(element);
            case 'error-group':
                return this.getErrorItems(inventory);
            default:
                return [];
        }
    }

    /**
     * Get root level items.
     */
    private getRootItems(inventory: ArtifactInventory | undefined): DiscoveryTreeItem[] {
        if (!inventory) {
            return [this.createNoInventoryItem()];
        }

        const items: DiscoveryTreeItem[] = [];

        // Project info
        items.push(this.createProjectInfoItem(inventory));

        // Statistics
        items.push(this.createStatisticsItem(inventory.statistics));

        // Real artifact categories (excluding 'binding' — we show its contents as virtual categories)
        const categories = this.getCategoriesWithItems(inventory);
        for (const [category, count] of categories) {
            if (category === 'binding') {
                continue; // Skip binding — we'll expand it into virtual categories below
            }
            items.push(this.createCategoryItem(category, count));
        }

        // Virtual categories extracted from binding IR
        const virtualCategories = this.extractVirtualCategories(inventory);
        for (const vc of virtualCategories) {
            items.push(vc);
        }

        // Show binding category if it exists (after virtual categories, at lower priority)
        for (const [category, count] of categories) {
            if (category === 'binding') {
                items.push(this.createCategoryItem(category, count));
            }
        }

        // Errors group if any
        const errorCount = inventory.statistics.byStatus.error;
        if (errorCount > 0) {
            items.push(this.createErrorGroupItem(errorCount));
        }

        return items;
    }

    /**
     * Extract virtual BizTalk categories from binding artifacts' IR data.
     * Returns tree items for Receive Ports, Receive Locations, Send Ports,
     * Send Port Groups, and Role Links.
     */
    private extractVirtualCategories(inventory: ArtifactInventory): DiscoveryTreeItem[] {
        const virtualItems: DiscoveryTreeItem[] = [];

        // Find binding artifacts and look up their IR documents
        const bindingArtifacts = inventory.items.filter((item) => item.category === 'binding');
        const irDocs = this.inventoryService.getIRDocuments();

        const receivePorts: { name: string; description?: string; tooltip?: string }[] = [];
        const receiveLocations: { name: string; description?: string; tooltip?: string }[] = [];
        const sendPorts: { name: string; description?: string; tooltip?: string }[] = [];
        const sendPortGroups: { name: string; description?: string; tooltip?: string }[] = [];
        const roleLinks: { name: string; description?: string; tooltip?: string }[] = [];

        for (const bindingItem of bindingArtifacts) {
            const irDoc = irDocs.get(bindingItem.irId || bindingItem.id);
            if (!irDoc) {
                continue;
            }

            // Extract receive ports and locations from endpoints
            const receiveEndpoints = irDoc.endpoints?.receive || [];
            for (const ep of receiveEndpoints) {
                const sm = ep.sourceMapping as
                    | { biztalk?: { receivePortName?: string; receiveLocationName?: string } }
                    | undefined;
                const portName = sm?.biztalk?.receivePortName || ep.name;
                const locName = sm?.biztalk?.receiveLocationName;
                const adapterInfo = (ep as unknown as Record<string, unknown>).transport
                    ? String((ep as unknown as Record<string, unknown>).transport)
                    : '';

                if (portName && !receivePorts.some((rp) => rp.name === portName)) {
                    receivePorts.push({
                        name: portName,
                        description: adapterInfo || undefined,
                        tooltip: `Receive Port: ${portName}`,
                    });
                }

                if (locName) {
                    receiveLocations.push({
                        name: locName,
                        description: portName ? `Port: ${portName}` : undefined,
                        tooltip: `Receive Location: ${locName}\nPort: ${portName || 'unknown'}`,
                    });
                } else if (ep.name && portName) {
                    // Use endpoint name as location name when explicit location name isn't available
                    receiveLocations.push({
                        name: ep.name,
                        description: portName ? `Port: ${portName}` : undefined,
                        tooltip: `Receive Location: ${ep.name}\nPort: ${portName}`,
                    });
                }
            }

            // Extract send ports from endpoints
            const sendEndpoints = irDoc.endpoints?.send || [];
            for (const ep of sendEndpoints) {
                const sm = ep.sourceMapping as { biztalk?: { filter?: string } } | undefined;
                const adapterInfo = (ep as unknown as Record<string, unknown>).transport
                    ? String((ep as unknown as Record<string, unknown>).transport)
                    : '';

                sendPorts.push({
                    name: ep.name,
                    description: adapterInfo || undefined,
                    tooltip: `Send Port: ${ep.name}${sm?.biztalk?.filter ? `\nFilter: ${sm.biztalk.filter}` : ''}`,
                });
            }

            // Extract send port groups and role links from extensions
            const btExt = (irDoc.extensions as Record<string, unknown>)?.biztalk as
                | Record<string, unknown>
                | undefined;

            if (btExt) {
                // Send port groups
                const spGroups = btExt.sendPortGroups as
                    | { name: string; sendPorts?: string[] }[]
                    | undefined;
                if (Array.isArray(spGroups)) {
                    for (const spg of spGroups) {
                        sendPortGroups.push({
                            name: spg.name,
                            description: spg.sendPorts
                                ? `${spg.sendPorts.length} member(s)`
                                : undefined,
                            tooltip: `Send Port Group: ${spg.name}\nMembers: ${spg.sendPorts?.join(', ') || 'none'}`,
                        });
                    }
                }

                // Role links (from orchestration bindings — look for bound role link references)
                const orchBindings = btExt.orchestrationBindings as
                    | {
                          orchestrationName: string;
                          portBindings?: {
                              portName: string;
                              boundTo?: string;
                              isSendPortGroup?: boolean;
                          }[];
                      }[]
                    | undefined;
                if (Array.isArray(orchBindings)) {
                    // Role links will be extracted when explicit RoleLink XML parsing is added
                    // For now, orchestration bindings are used to detect port binding patterns
                }

                // Check receivePortDetails for additional info
                const rpDetails = btExt.receivePortDetails as
                    | {
                          name: string;
                          isTwoWay?: boolean;
                          routeFailedMessage?: boolean;
                          inboundMaps?: string[];
                          outboundMaps?: string[];
                      }[]
                    | undefined;
                if (Array.isArray(rpDetails)) {
                    for (const rpd of rpDetails) {
                        // Enrich existing receive port entries with detail
                        const existing = receivePorts.find((rp) => rp.name === rpd.name);
                        if (existing) {
                            const details: string[] = [];
                            if (rpd.isTwoWay) {
                                details.push('Two-Way');
                            }
                            if (rpd.routeFailedMessage) {
                                details.push('Route Failed Messages');
                            }
                            if (rpd.inboundMaps && rpd.inboundMaps.length > 0) {
                                details.push(`${rpd.inboundMaps.length} inbound map(s)`);
                            }
                            if (details.length > 0) {
                                existing.description = details.join(' · ');
                            }
                        } else {
                            // Receive port from details not yet in list
                            receivePorts.push({
                                name: rpd.name,
                                description: rpd.isTwoWay ? 'Two-Way' : undefined,
                                tooltip: `Receive Port: ${rpd.name}`,
                            });
                        }
                    }
                }
            }
        }

        // Extract policies (Business Rules Engine) from orchestration IR actions.
        // CallRules shapes produce actions with originalShapeType='CallRules' or policyName in sourceMapping.
        const policies: { name: string; description?: string; tooltip?: string }[] = [];
        const orchArtifacts = inventory.items.filter((item) => item.category === 'orchestration');
        for (const orchItem of orchArtifacts) {
            const orchIr = irDocs.get(orchItem.irId || orchItem.id);
            if (!orchIr) {
                continue;
            }
            const orchActions = orchIr.actions || [];
            for (const action of orchActions) {
                const sm = action.sourceMapping as
                    | { biztalk?: { shapeType?: string; shapeName?: string } }
                    | undefined;
                const config = action.config as Record<string, unknown> | undefined;
                if (
                    sm?.biztalk?.shapeType === 'CallRules' ||
                    config?.originalShapeType === 'CallRules'
                ) {
                    const policyName =
                        (config?.policyName as string) || sm?.biztalk?.shapeName || action.name;
                    if (!policies.some((p) => p.name === policyName)) {
                        policies.push({
                            name: policyName,
                            description: `Used in: ${orchItem.name}`,
                            tooltip: `Policy: ${policyName}\nReferenced by orchestration: ${orchItem.name}`,
                        });
                    }
                }
            }
        }

        // Create virtual category tree items (only if they have items)
        if (receivePorts.length > 0) {
            virtualItems.push(this.createVirtualCategoryItem('receive-port', receivePorts));
        }
        if (receiveLocations.length > 0) {
            virtualItems.push(this.createVirtualCategoryItem('receive-location', receiveLocations));
        }
        if (sendPorts.length > 0) {
            virtualItems.push(this.createVirtualCategoryItem('send-port', sendPorts));
        }
        if (sendPortGroups.length > 0) {
            virtualItems.push(this.createVirtualCategoryItem('send-port-group', sendPortGroups));
        }
        if (roleLinks.length > 0) {
            virtualItems.push(this.createVirtualCategoryItem('role-link', roleLinks));
        }
        if (policies.length > 0) {
            virtualItems.push(this.createVirtualCategoryItem('policy', policies));
        }

        // Sort by priority
        virtualItems.sort((a, b) => {
            const pa = CATEGORY_INFO[a.data?.virtualCategory || '']?.priority || 99;
            const pb = CATEGORY_INFO[b.data?.virtualCategory || '']?.priority || 99;
            return pa - pb;
        });

        return virtualItems;
    }

    /**
     * Get items for a category.
     */
    private getCategoryItems(
        category: ArtifactCategory | undefined,
        inventory: ArtifactInventory | undefined
    ): DiscoveryTreeItem[] {
        if (!category || !inventory) {
            return [];
        }

        const items = inventory.items.filter((item) => item.category === category);

        return items.map((item) => this.createArtifactItem(item));
    }

    /**
     * Get items for a virtual category (e.g., Receive Ports extracted from binding).
     */
    private getVirtualCategoryItems(element: DiscoveryTreeItem): DiscoveryTreeItem[] {
        const virtualItems = element.data?.virtualItems || [];
        return virtualItems.map((vi) => {
            const item = new DiscoveryTreeItem(
                'virtual-artifact',
                vi.name,
                vscode.TreeItemCollapsibleState.None
            );
            if (vi.description) {
                item.description = vi.description;
            }
            if (vi.tooltip) {
                item.tooltip = vi.tooltip;
            }
            item.iconPath = new vscode.ThemeIcon(
                'circle-filled',
                new vscode.ThemeColor('charts.foreground')
            );
            return item;
        });
    }

    /**
     * Get error items.
     */
    private getErrorItems(inventory: ArtifactInventory | undefined): DiscoveryTreeItem[] {
        if (!inventory) {
            return [];
        }

        const errorItems = inventory.items.filter((item) => item.status === 'error');

        return errorItems.map((item) => this.createErrorItem(item));
    }

    /**
     * Get categories that have items.
     */
    private getCategoriesWithItems(inventory: ArtifactInventory): [ArtifactCategory, number][] {
        const categoryCount = new Map<ArtifactCategory, number>();

        for (const item of inventory.items) {
            if (item.status !== 'error') {
                const count = categoryCount.get(item.category) || 0;
                categoryCount.set(item.category, count + 1);
            }
        }

        // Sort by priority
        const sorted = Array.from(categoryCount.entries()).sort((a, b) => {
            const priorityA = CATEGORY_INFO[a[0]]?.priority || 99;
            const priorityB = CATEGORY_INFO[b[0]]?.priority || 99;
            return priorityA - priorityB;
        });

        return sorted;
    }

    // =========================================================================
    // Item Creators
    // =========================================================================

    private createNoInventoryItem(): DiscoveryTreeItem {
        const item = new DiscoveryTreeItem(
            'root',
            'No artifacts discovered',
            vscode.TreeItemCollapsibleState.None
        );
        item.description = 'Run discovery to scan for artifacts';
        item.iconPath = new vscode.ThemeIcon('info');
        return item;
    }

    private createProjectInfoItem(inventory: ArtifactInventory): DiscoveryTreeItem {
        const item = new DiscoveryTreeItem(
            'project-info',
            inventory.projectName,
            vscode.TreeItemCollapsibleState.None
        );
        item.description = `${inventory.platform}${inventory.platformVersion ? ` ${inventory.platformVersion}` : ''}`;
        item.iconPath = new vscode.ThemeIcon('folder');
        item.tooltip = new vscode.MarkdownString(
            `**Project:** ${inventory.projectName}\n\n` +
                `**Platform:** ${inventory.platform}\n\n` +
                `**Path:** ${inventory.sourcePath}\n\n` +
                `**Last Updated:** ${new Date(inventory.updatedAt).toLocaleString()}`
        );
        return item;
    }

    private createStatisticsItem(stats: InventoryStatistics): DiscoveryTreeItem {
        const item = new DiscoveryTreeItem(
            'statistics',
            `${stats.totalCount} artifacts`,
            vscode.TreeItemCollapsibleState.None
        );

        const sizeFormatted = this.formatFileSize(stats.totalFileSize);
        item.description = sizeFormatted;
        item.iconPath = new vscode.ThemeIcon('dashboard');
        item.tooltip = new vscode.MarkdownString(
            `**Total Artifacts:** ${stats.totalCount}\n\n` +
                `**Parsed:** ${stats.byStatus.parsed}\n\n` +
                `**Warnings:** ${stats.byStatus.warning}\n\n` +
                `**Errors:** ${stats.byStatus.error}\n\n` +
                `**Total Size:** ${sizeFormatted}`
        );
        return item;
    }

    private createCategoryItem(category: ArtifactCategory, count: number): DiscoveryTreeItem {
        const info = CATEGORY_INFO[category] || CATEGORY_INFO.other;

        const item = new DiscoveryTreeItem(
            'category',
            info.label,
            vscode.TreeItemCollapsibleState.Collapsed,
            { category, count }
        );
        item.description = `(${count})`;
        item.iconPath = new vscode.ThemeIcon(info.icon);
        return item;
    }

    private createVirtualCategoryItem(
        virtualCategory: VirtualCategory,
        virtualItems: { name: string; description?: string; tooltip?: string }[]
    ): DiscoveryTreeItem {
        const info = CATEGORY_INFO[virtualCategory] || CATEGORY_INFO.other;

        const item = new DiscoveryTreeItem(
            'virtual-category',
            info.label,
            vscode.TreeItemCollapsibleState.Collapsed,
            { virtualCategory, count: virtualItems.length, virtualItems }
        );
        item.description = `(${virtualItems.length})`;
        item.iconPath = new vscode.ThemeIcon(info.icon);
        return item;
    }

    private createArtifactItem(inventoryItem: InventoryItem): DiscoveryTreeItem {
        // Include the file extension in the label for clarity
        const ext = path.extname(inventoryItem.sourcePath);
        const displayName = ext ? `${inventoryItem.name}${ext}` : inventoryItem.name;

        const item = new DiscoveryTreeItem(
            'artifact',
            displayName,
            vscode.TreeItemCollapsibleState.None,
            { item: inventoryItem }
        );

        // Status icon
        const statusIcon = this.getStatusIcon(inventoryItem.status);
        item.iconPath = statusIcon;

        // Description
        item.description = path.dirname(inventoryItem.sourcePath);

        // Tooltip
        item.tooltip = new vscode.MarkdownString(
            `**Name:** ${inventoryItem.name}\n\n` +
                `**Path:** ${inventoryItem.sourcePath}\n\n` +
                `**Category:** ${inventoryItem.category}\n\n` +
                `**Status:** ${inventoryItem.status}\n\n` +
                `**Size:** ${this.formatFileSize(inventoryItem.metadata.fileSize)}\n\n` +
                (inventoryItem.tags.length > 0 ? `**Tags:** ${inventoryItem.tags.join(', ')}` : '')
        );

        // Command to open file
        item.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [
                vscode.Uri.file(
                    path.isAbsolute(inventoryItem.sourcePath)
                        ? inventoryItem.sourcePath
                        : path.join(
                              this.inventoryService.getInventory()?.sourcePath || '',
                              inventoryItem.sourcePath
                          )
                ),
            ],
        };

        return item;
    }

    private createErrorGroupItem(count: number): DiscoveryTreeItem {
        const item = new DiscoveryTreeItem(
            'error-group',
            'Parse Errors',
            vscode.TreeItemCollapsibleState.Collapsed,
            { count }
        );
        item.description = `(${count})`;
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
        return item;
    }

    private createErrorItem(inventoryItem: InventoryItem): DiscoveryTreeItem {
        const item = new DiscoveryTreeItem(
            'error-item',
            inventoryItem.name,
            vscode.TreeItemCollapsibleState.None,
            { item: inventoryItem }
        );
        item.description = inventoryItem.errorMessage;
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
        item.tooltip = new vscode.MarkdownString(
            `**File:** ${inventoryItem.sourcePath}\n\n` + `**Error:** ${inventoryItem.errorMessage}`
        );
        return item;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private getStatusIcon(status: 'parsed' | 'error' | 'warning'): vscode.ThemeIcon {
        switch (status) {
            case 'parsed':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            case 'warning':
                return new vscode.ThemeIcon(
                    'warning',
                    new vscode.ThemeColor('editorWarning.foreground')
                );
            case 'error':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
            default:
                return new vscode.ThemeIcon('file');
        }
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Dispose of resources.
     */
    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        DiscoveryTreeProvider.instance = undefined;
    }
}

// =============================================================================
// Registration Helper
// =============================================================================

/**
 * Register the discovery tree provider.
 */
export function registerDiscoveryTreeProvider(
    context: vscode.ExtensionContext
): DiscoveryTreeProvider {
    const provider = DiscoveryTreeProvider.getInstance();

    const treeView = vscode.window.createTreeView('logicAppsMigrationAssistant.discovery', {
        treeDataProvider: provider,
        showCollapseAll: true,
    });

    context.subscriptions.push(treeView);

    return provider;
}
