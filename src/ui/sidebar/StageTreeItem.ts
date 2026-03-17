/**
 * StageTreeItem - Tree item for migration stages
 *
 * Specialized tree item for displaying the 5-stage migration progress.
 * Each stage shows status icon, name, and expandable exit criteria.
 */

import * as vscode from 'vscode';
import { MigrationTreeItem, MigrationTreeItemStatus } from './MigrationTreeItem';
import { MigrationStage } from '../../types/stages';

/**
 * Stage information
 */
export interface StageInfo {
    stage: MigrationStage;
    label: string;
    description: string;
    order: number;
}

/**
 * All migration stages with metadata
 */
export const STAGE_INFO: Record<MigrationStage, StageInfo> = {
    [MigrationStage.NotStarted]: {
        stage: MigrationStage.NotStarted,
        label: 'Not Started',
        description: 'Select a source folder to begin',
        order: 0,
    },
    [MigrationStage.Discovery]: {
        stage: MigrationStage.Discovery,
        label: '1. Discovery',
        description: 'Scan and parse source artifacts',
        order: 1,
    },
    [MigrationStage.Planning]: {
        stage: MigrationStage.Planning,
        label: '2. Planning',
        description: 'Analyze, plan roadmap, and map patterns',
        order: 2,
    },
    [MigrationStage.Conversion]: {
        stage: MigrationStage.Conversion,
        label: '3. Conversion',
        description: 'Generate Logic Apps artifacts',
        order: 3,
    },
    [MigrationStage.Validation]: {
        stage: MigrationStage.Validation,
        label: '4. Validation',
        description: 'Test and verify outputs',
        order: 4,
    },
    [MigrationStage.Deployment]: {
        stage: MigrationStage.Deployment,
        label: '5. Deployment',
        description: 'Deploy to Azure',
        order: 5,
    },
    [MigrationStage.Completed]: {
        stage: MigrationStage.Completed,
        label: 'Completed',
        description: 'Migration complete',
        order: 6,
    },
};

/**
 * Props for StageTreeItem
 */
export interface StageTreeItemProps {
    stage: MigrationStage;
    status: MigrationTreeItemStatus;
    isCurrent: boolean;
    hasExitCriteria: boolean;
    startedAt?: string;
    completedAt?: string;
}

/**
 * Tree item for a migration stage
 */
export class StageTreeItem extends MigrationTreeItem {
    public readonly stage: MigrationStage;
    public readonly isCurrent: boolean;
    public readonly startedAt?: string;
    public readonly completedAt?: string;

    constructor(props: StageTreeItemProps) {
        const stageInfo = STAGE_INFO[props.stage];

        super({
            id: `stage-${props.stage}`,
            label: stageInfo.label,
            type: 'stage',
            status: props.status,
            description: StageTreeItem.getStatusDescription(props),
            tooltip: StageTreeItem.createTooltip(stageInfo, props),
            collapsibleState: props.hasExitCriteria
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
            command: StageTreeItem.getCommand(props),
            contextValue: `migration.stage.${props.status}${props.isCurrent ? '.current' : ''}`,
            metadata: {
                stage: props.stage,
                order: stageInfo.order,
                isCurrent: props.isCurrent,
            },
        });

        this.stage = props.stage;
        this.isCurrent = props.isCurrent;
        this.startedAt = props.startedAt;
        this.completedAt = props.completedAt;
    }

    /**
     * Get status description text
     */
    private static getStatusDescription(props: StageTreeItemProps): string {
        if (props.completedAt) {
            return '✓ Complete';
        }
        if (props.isCurrent && props.startedAt) {
            return 'In Progress...';
        }
        if (props.isCurrent) {
            return 'Ready';
        }
        return '';
    }

    /**
     * Create tooltip for stage
     */
    private static createTooltip(
        stageInfo: StageInfo,
        props: StageTreeItemProps
    ): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${stageInfo.label}**\n\n`);
        tooltip.appendMarkdown(`${stageInfo.description}\n\n`);

        if (props.startedAt) {
            tooltip.appendMarkdown(`---\n\n`);
            tooltip.appendMarkdown(`*Started:* ${new Date(props.startedAt).toLocaleString()}\n\n`);
        }

        if (props.completedAt) {
            tooltip.appendMarkdown(
                `*Completed:* ${new Date(props.completedAt).toLocaleString()}\n\n`
            );
        }

        // Add status indicator
        const statusIcons: Record<MigrationTreeItemStatus, string> = {
            completed: '✅',
            'in-progress': '🔄',
            'not-started': '○',
            locked: '🔒',
            failed: '❌',
            warning: '⚠️',
        };

        tooltip.appendMarkdown(
            `*Status:* ${statusIcons[props.status] || '○'} ${StageTreeItem.formatStatus(props.status)}`
        );

        return tooltip;
    }

    /**
     * Format status for display
     */
    private static formatStatus(status: MigrationTreeItemStatus): string {
        const statusLabels: Record<MigrationTreeItemStatus, string> = {
            completed: 'Completed',
            'in-progress': 'In Progress',
            'not-started': 'Not Started',
            locked: 'Locked',
            failed: 'Failed',
            warning: 'Warning',
        };
        return statusLabels[status] || status;
    }

    /**
     * Get command for stage item
     */
    private static getCommand(props: StageTreeItemProps): vscode.Command | undefined {
        if (props.status === 'locked') {
            return undefined;
        }

        return {
            command: 'logicAppsMigrationAssistant.viewFlowVisualization',
            title: 'Open Main Flow View',
        };
    }

    /**
     * Get stage icon based on status
     */
    protected override getDefaultIcon(): vscode.ThemeIcon {
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
                if (this.isCurrent) {
                    return new vscode.ThemeIcon(
                        'circle-large-outline',
                        new vscode.ThemeColor('charts.blue')
                    );
                }
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    /**
     * Check if stage can be navigated to
     */
    public isNavigable(): boolean {
        return this.itemStatus !== 'locked';
    }

    /**
     * Check if stage is complete
     */
    public isComplete(): boolean {
        return this.itemStatus === 'completed';
    }

    /**
     * Check if stage can be started
     */
    public canStart(): boolean {
        return this.isCurrent && !this.startedAt && this.itemStatus !== 'locked';
    }
}

/**
 * Props for ExitCriteriaTreeItem
 */
export interface ExitCriteriaTreeItemProps {
    parentStage: MigrationStage;
    criterionId: string;
    label: string;
    description: string;
    isCompleted: boolean;
    isUserConfirmable: boolean;
}

/**
 * Tree item for exit criteria
 */
export class ExitCriteriaTreeItem extends MigrationTreeItem {
    public readonly parentStage: MigrationStage;
    public readonly criterionId: string;
    public readonly isUserConfirmable: boolean;

    constructor(props: ExitCriteriaTreeItemProps) {
        super({
            id: `${props.parentStage}-criteria-${props.criterionId}`,
            label: props.label,
            type: 'exitCriteria',
            status: props.isCompleted ? 'completed' : 'not-started',
            tooltip: ExitCriteriaTreeItem.createTooltip(props),
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command:
                props.isUserConfirmable && !props.isCompleted
                    ? {
                          command: 'logicAppsMigrationAssistant.toggleExitCriteria',
                          title: 'Toggle Exit Criteria',
                          arguments: [props.parentStage, props.criterionId],
                      }
                    : undefined,
            contextValue: props.isUserConfirmable
                ? 'migration.exitCriteria.confirmable'
                : 'migration.exitCriteria.auto',
            parentId: `stage-${props.parentStage}`,
            metadata: {
                criterionId: props.criterionId,
                userConfirmable: props.isUserConfirmable,
                description: props.description,
            },
        });

        this.parentStage = props.parentStage;
        this.criterionId = props.criterionId;
        this.isUserConfirmable = props.isUserConfirmable;
    }

    /**
     * Create tooltip for exit criteria
     */
    private static createTooltip(props: ExitCriteriaTreeItemProps): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${props.label}**\n\n`);
        tooltip.appendMarkdown(`${props.description}\n\n`);

        if (props.isUserConfirmable) {
            tooltip.appendMarkdown(`---\n\n`);
            tooltip.appendMarkdown(
                `*Click to ${props.isCompleted ? 'uncheck' : 'check'} this criterion*`
            );
        } else {
            tooltip.appendMarkdown(`---\n\n`);
            tooltip.appendMarkdown(`*This criterion is automatically validated by the system*`);
        }

        return tooltip;
    }

    /**
     * Get icon for exit criteria
     */
    protected override getDefaultIcon(): vscode.ThemeIcon {
        if (this.itemStatus === 'completed') {
            return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
        }

        if (this.isUserConfirmable) {
            return new vscode.ThemeIcon('circle-large-outline');
        }

        return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('disabledForeground'));
    }
}

/**
 * Factory for creating stage-related tree items
 */
export const StageItemFactory = {
    /**
     * Create a stage tree item
     */
    createStage(props: StageTreeItemProps): StageTreeItem {
        return new StageTreeItem(props);
    },

    /**
     * Create an exit criteria tree item
     */
    createExitCriteria(props: ExitCriteriaTreeItemProps): ExitCriteriaTreeItem {
        return new ExitCriteriaTreeItem(props);
    },

    /**
     * Get ordered list of stages (excluding NotStarted and Completed)
     */
    getOrderedStages(): MigrationStage[] {
        return [
            MigrationStage.Discovery,
            MigrationStage.Planning,
            MigrationStage.Conversion,
            MigrationStage.Validation,
            MigrationStage.Deployment,
        ];
    },

    /**
     * Get stage info
     */
    getStageInfo(stage: MigrationStage): StageInfo {
        return STAGE_INFO[stage];
    },
};
