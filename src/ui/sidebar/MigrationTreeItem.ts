/**
 * MigrationTreeItem - Base class for all tree items in the migration sidebar
 *
 * This is the foundation for all tree items displayed in the sidebar.
 * It extends VS Code's TreeItem with migration-specific functionality.
 */

import * as vscode from 'vscode';

/**
 * Types of tree items in the migration sidebar
 */
export type MigrationTreeItemType =
    | 'project'
    | 'stage'
    | 'exitCriteria'
    | 'artifactGroup'
    | 'artifact'
    | 'action'
    | 'info'
    | 'header'
    | 'separator';

/**
 * Status for tree items that represent stateful entities
 */
export type MigrationTreeItemStatus =
    | 'not-started'
    | 'in-progress'
    | 'completed'
    | 'failed'
    | 'locked'
    | 'warning';

/**
 * Props for creating a MigrationTreeItem
 */
export interface MigrationTreeItemProps {
    /** Unique identifier for the item */
    id: string;
    /** Display label */
    label: string;
    /** Item type */
    type: MigrationTreeItemType;
    /** Optional status */
    status?: MigrationTreeItemStatus;
    /** Optional description shown to the right */
    description?: string;
    /** Optional tooltip */
    tooltip?: string | vscode.MarkdownString;
    /** Optional icon */
    icon?: vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri };
    /** Collapsible state */
    collapsibleState?: vscode.TreeItemCollapsibleState;
    /** Command to execute on click */
    command?: vscode.Command;
    /** Context value for menus */
    contextValue?: string;
    /** Optional children IDs (for parent-child relationships) */
    childrenIds?: string[];
    /** Optional parent ID */
    parentId?: string;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Base class for migration tree items
 */
export class MigrationTreeItem extends vscode.TreeItem {
    /** Unique identifier */
    public readonly itemId: string;

    /** Item type */
    public readonly itemType: MigrationTreeItemType;

    /** Current status */
    public itemStatus?: MigrationTreeItemStatus;

    /** Children IDs for parent items */
    public childrenIds: string[];

    /** Parent ID for child items */
    public parentId?: string;

    /** Additional metadata */
    public metadata: Record<string, unknown>;

    constructor(props: MigrationTreeItemProps) {
        super(props.label, props.collapsibleState ?? vscode.TreeItemCollapsibleState.None);

        this.itemId = props.id;
        this.id = props.id;
        this.itemType = props.type;
        this.itemStatus = props.status;
        this.childrenIds = props.childrenIds ?? [];
        this.parentId = props.parentId;
        this.metadata = props.metadata ?? {};

        // Set description
        if (props.description) {
            this.description = props.description;
        }

        // Set tooltip
        if (props.tooltip) {
            this.tooltip = props.tooltip;
        }

        // Set icon
        if (props.icon) {
            this.iconPath = props.icon;
        } else {
            this.iconPath = this.getDefaultIcon();
        }

        // Set command
        if (props.command) {
            this.command = props.command;
        }

        // Set context value for menus
        this.contextValue = props.contextValue ?? `migration.${props.type}`;
    }

    /**
     * Get default icon based on item type and status
     */
    protected getDefaultIcon(): vscode.ThemeIcon {
        switch (this.itemType) {
            case 'project':
                return new vscode.ThemeIcon('folder');
            case 'stage':
                return this.getStageIcon();
            case 'exitCriteria':
                return this.getExitCriteriaIcon();
            case 'artifactGroup':
                return new vscode.ThemeIcon('symbol-folder');
            case 'artifact':
                return this.getArtifactIcon();
            case 'action':
                return new vscode.ThemeIcon('play');
            case 'info':
                return new vscode.ThemeIcon('info');
            case 'header':
                return new vscode.ThemeIcon('symbol-namespace');
            case 'separator':
                return new vscode.ThemeIcon('dash');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    /**
     * Get icon for stage items based on status
     */
    private getStageIcon(): vscode.ThemeIcon {
        switch (this.itemStatus) {
            case 'completed':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            case 'in-progress':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
            case 'failed':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            case 'locked':
                return new vscode.ThemeIcon('lock', new vscode.ThemeColor('disabledForeground'));
            case 'warning':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
            case 'not-started':
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    /**
     * Get icon for exit criteria items
     */
    private getExitCriteriaIcon(): vscode.ThemeIcon {
        switch (this.itemStatus) {
            case 'completed':
                return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
            case 'failed':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            default:
                return new vscode.ThemeIcon('circle-large-outline');
        }
    }

    /**
     * Get icon for artifact items
     */
    private getArtifactIcon(): vscode.ThemeIcon {
        // Check metadata for artifact type
        const artifactType = this.metadata.artifactType as string | undefined;

        switch (artifactType) {
            case 'orchestration':
                return new vscode.ThemeIcon('git-merge');
            case 'map':
                return new vscode.ThemeIcon('symbol-array');
            case 'schema':
                return new vscode.ThemeIcon('file-code');
            case 'pipeline':
                return new vscode.ThemeIcon('layers');
            case 'binding':
                return new vscode.ThemeIcon('plug');
            case 'flow':
                return new vscode.ThemeIcon('git-branch');
            case 'dataweave':
                return new vscode.ThemeIcon('symbol-function');
            default:
                return new vscode.ThemeIcon('file');
        }
    }

    /**
     * Update the item status
     */
    public updateStatus(status: MigrationTreeItemStatus): void {
        this.itemStatus = status;
        this.iconPath = this.getDefaultIcon();
    }

    /**
     * Update description
     */
    public updateDescription(description: string): void {
        this.description = description;
    }

    /**
     * Check if item has children
     */
    public hasChildren(): boolean {
        return this.childrenIds.length > 0;
    }

    /**
     * Add a child ID
     */
    public addChild(childId: string): void {
        if (!this.childrenIds.includes(childId)) {
            this.childrenIds.push(childId);
        }
    }

    /**
     * Remove a child ID
     */
    public removeChild(childId: string): void {
        this.childrenIds = this.childrenIds.filter((id) => id !== childId);
    }

    /**
     * Create a clone of this item with updated props
     */
    public clone(overrides: Partial<MigrationTreeItemProps>): MigrationTreeItem {
        return new MigrationTreeItem({
            id: overrides.id ?? this.itemId,
            label: overrides.label ?? (this.label as string),
            type: overrides.type ?? this.itemType,
            status: overrides.status ?? this.itemStatus,
            description: overrides.description ?? (this.description as string | undefined),
            tooltip: overrides.tooltip ?? this.tooltip,
            icon: overrides.icon,
            collapsibleState: overrides.collapsibleState ?? this.collapsibleState,
            command: overrides.command ?? this.command,
            contextValue: overrides.contextValue ?? this.contextValue,
            childrenIds: overrides.childrenIds ?? [...this.childrenIds],
            parentId: overrides.parentId ?? this.parentId,
            metadata: overrides.metadata ?? { ...this.metadata },
        });
    }
}

/**
 * Factory functions for common tree item types
 */
export const TreeItemFactory = {
    /**
     * Create a header/separator item
     */
    createHeader(label: string, id?: string): MigrationTreeItem {
        return new MigrationTreeItem({
            id: id ?? `header-${label.toLowerCase().replace(/\s+/g, '-')}`,
            label,
            type: 'header',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
        });
    },

    /**
     * Create an info item
     */
    createInfo(label: string, description?: string, id?: string): MigrationTreeItem {
        return new MigrationTreeItem({
            id: id ?? `info-${label.toLowerCase().replace(/\s+/g, '-')}`,
            label,
            type: 'info',
            description,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
        });
    },

    /**
     * Create an action item
     */
    createAction(label: string, command: vscode.Command, id?: string): MigrationTreeItem {
        return new MigrationTreeItem({
            id: id ?? `action-${label.toLowerCase().replace(/\s+/g, '-')}`,
            label,
            type: 'action',
            command,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'migration.action.executable',
        });
    },
};
