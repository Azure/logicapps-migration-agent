/**
 * ArtifactTreeItem - Tree items for artifact inventory
 *
 * Specialized tree items for displaying discovered artifacts
 * grouped by type with status badges and navigation.
 */

import * as vscode from 'vscode';
import { MigrationTreeItem, MigrationTreeItemStatus } from './MigrationTreeItem';
import { DiscoveredArtifact } from '../../services/StateManager';

/**
 * Artifact type definitions
 */
export type ArtifactType =
    | 'orchestration'
    | 'map'
    | 'schema'
    | 'pipeline'
    | 'binding'
    | 'flow'
    | 'dataweave'
    | 'subflow'
    | 'api'
    | 'connector'
    | 'unknown';

/**
 * Artifact type metadata
 */
export interface ArtifactTypeInfo {
    label: string;
    pluralLabel: string;
    icon: string;
    description: string;
    platforms: string[];
}

/**
 * Artifact type information
 */
export const ARTIFACT_TYPE_INFO: Record<ArtifactType, ArtifactTypeInfo> = {
    orchestration: {
        label: 'Orchestration',
        pluralLabel: 'Orchestrations',
        icon: 'git-merge',
        description: 'BizTalk orchestration workflow',
        platforms: ['biztalk'],
    },
    map: {
        label: 'Map',
        pluralLabel: 'Maps',
        icon: 'symbol-array',
        description: 'Data transformation map',
        platforms: ['biztalk'],
    },
    schema: {
        label: 'Schema',
        pluralLabel: 'Schemas',
        icon: 'file-code',
        description: 'Data schema definition',
        platforms: ['biztalk', 'mulesoft'],
    },
    pipeline: {
        label: 'Pipeline',
        pluralLabel: 'Pipelines',
        icon: 'layers',
        description: 'Message processing pipeline',
        platforms: ['biztalk'],
    },
    binding: {
        label: 'Binding',
        pluralLabel: 'Bindings',
        icon: 'plug',
        description: 'Port and connection bindings',
        platforms: ['biztalk'],
    },
    flow: {
        label: 'Flow',
        pluralLabel: 'Flows',
        icon: 'git-branch',
        description: 'Integration flow definition',
        platforms: ['mulesoft'],
    },
    dataweave: {
        label: 'DataWeave',
        pluralLabel: 'DataWeave',
        icon: 'symbol-function',
        description: 'MuleSoft DataWeave transformation',
        platforms: ['mulesoft'],
    },
    subflow: {
        label: 'Subflow',
        pluralLabel: 'Subflows',
        icon: 'symbol-method',
        description: 'Reusable subflow component',
        platforms: ['mulesoft'],
    },
    api: {
        label: 'API',
        pluralLabel: 'APIs',
        icon: 'globe',
        description: 'API specification',
        platforms: ['mulesoft'],
    },
    connector: {
        label: 'Connector',
        pluralLabel: 'Connectors',
        icon: 'extensions',
        description: 'External system connector',
        platforms: ['mulesoft'],
    },
    unknown: {
        label: 'Other',
        pluralLabel: 'Other',
        icon: 'file',
        description: 'Other artifact type',
        platforms: [],
    },
};

/**
 * Complexity level for artifacts
 */
export type ComplexityLevel = 'low' | 'medium' | 'high' | 'unknown';

/**
 * Artifact status for migration progress
 */
export type ArtifactStatus =
    | 'discovered'
    | 'analyzed'
    | 'designed'
    | 'converted'
    | 'validated'
    | 'deployed'
    | 'excluded';

/**
 * Extended artifact info for tree items
 */
export interface ArtifactItemInfo extends DiscoveredArtifact {
    complexity?: ComplexityLevel;
    status?: ArtifactStatus;
    gaps?: number;
    hasOverrides?: boolean;
}

/**
 * Props for ArtifactGroupTreeItem
 */
export interface ArtifactGroupTreeItemProps {
    artifactType: ArtifactType;
    artifacts: ArtifactItemInfo[];
    collapsed?: boolean;
}

/**
 * Tree item for a group of artifacts
 */
export class ArtifactGroupTreeItem extends MigrationTreeItem {
    public readonly artifactType: ArtifactType;
    public readonly artifactCount: number;

    constructor(props: ArtifactGroupTreeItemProps) {
        const typeInfo = ARTIFACT_TYPE_INFO[props.artifactType];

        super({
            id: `artifact-group-${props.artifactType}`,
            label: typeInfo.pluralLabel,
            type: 'artifactGroup',
            description: `(${props.artifacts.length})`,
            tooltip: ArtifactGroupTreeItem.createTooltip(typeInfo, props.artifacts),
            icon: new vscode.ThemeIcon(typeInfo.icon),
            collapsibleState: props.collapsed
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.Expanded,
            contextValue: 'migration.artifactGroup',
            childrenIds: props.artifacts.map((a) => `artifact-${a.id}`),
            metadata: {
                artifactType: props.artifactType,
                count: props.artifacts.length,
            },
        });

        this.artifactType = props.artifactType;
        this.artifactCount = props.artifacts.length;
    }

    /**
     * Create tooltip for artifact group
     */
    private static createTooltip(
        typeInfo: ArtifactTypeInfo,
        artifacts: ArtifactItemInfo[]
    ): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${typeInfo.pluralLabel}**\n\n`);
        tooltip.appendMarkdown(`${typeInfo.description}\n\n`);
        tooltip.appendMarkdown(`---\n\n`);
        tooltip.appendMarkdown(`**Count:** ${artifacts.length}\n\n`);

        // Complexity breakdown
        const complexityCounts = {
            low: artifacts.filter((a) => a.complexity === 'low').length,
            medium: artifacts.filter((a) => a.complexity === 'medium').length,
            high: artifacts.filter((a) => a.complexity === 'high').length,
        };

        if (complexityCounts.low + complexityCounts.medium + complexityCounts.high > 0) {
            tooltip.appendMarkdown(`**Complexity:**\n`);
            if (complexityCounts.low > 0) {
                tooltip.appendMarkdown(`- 🟢 Low: ${complexityCounts.low}\n`);
            }
            if (complexityCounts.medium > 0) {
                tooltip.appendMarkdown(`- 🟡 Medium: ${complexityCounts.medium}\n`);
            }
            if (complexityCounts.high > 0) {
                tooltip.appendMarkdown(`- 🔴 High: ${complexityCounts.high}\n`);
            }
        }

        return tooltip;
    }
}

/**
 * Props for ArtifactTreeItem
 */
export interface ArtifactTreeItemProps {
    artifact: ArtifactItemInfo;
    parentGroupType: ArtifactType;
}

/**
 * Tree item for a single artifact
 */
export class ArtifactTreeItem extends MigrationTreeItem {
    public readonly artifact: ArtifactItemInfo;
    public readonly parentGroupType: ArtifactType;

    constructor(props: ArtifactTreeItemProps) {
        const typeInfo = ARTIFACT_TYPE_INFO[props.parentGroupType];
        const status = ArtifactTreeItem.mapArtifactStatus(props.artifact.status);

        super({
            id: `artifact-${props.artifact.id}`,
            label: props.artifact.name,
            type: 'artifact',
            status,
            description: ArtifactTreeItem.getDescription(props.artifact),
            tooltip: ArtifactTreeItem.createTooltip(props.artifact, typeInfo),
            icon: new vscode.ThemeIcon(
                typeInfo.icon,
                ArtifactTreeItem.getIconColor(props.artifact)
            ),
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(props.artifact.filePath)],
            },
            contextValue: ArtifactTreeItem.getContextValue(props.artifact),
            parentId: `artifact-group-${props.parentGroupType}`,
            metadata: {
                artifactType: props.parentGroupType,
                path: props.artifact.filePath,
                platform: props.artifact.platform,
                complexity: props.artifact.complexity,
                status: props.artifact.status,
                gaps: props.artifact.gaps,
            },
        });

        this.artifact = props.artifact;
        this.parentGroupType = props.parentGroupType;
    }

    /**
     * Map artifact status to tree item status
     */
    private static mapArtifactStatus(status?: ArtifactStatus): MigrationTreeItemStatus {
        switch (status) {
            case 'deployed':
            case 'validated':
                return 'completed';
            case 'converted':
            case 'designed':
            case 'analyzed':
                return 'in-progress';
            case 'excluded':
                return 'locked';
            default:
                return 'not-started';
        }
    }

    /**
     * Get description for artifact
     */
    private static getDescription(artifact: ArtifactItemInfo): string {
        const parts: string[] = [];

        if (artifact.complexity) {
            const complexityIcons = { low: '🟢', medium: '🟡', high: '🔴', unknown: '○' };
            parts.push(complexityIcons[artifact.complexity]);
        }

        if (artifact.gaps && artifact.gaps > 0) {
            parts.push(`⚠️${artifact.gaps}`);
        }

        if (artifact.hasOverrides) {
            parts.push('🔧');
        }

        return parts.join(' ');
    }

    /**
     * Get icon color based on artifact properties
     */
    private static getIconColor(artifact: ArtifactItemInfo): vscode.ThemeColor | undefined {
        if (artifact.status === 'excluded') {
            return new vscode.ThemeColor('disabledForeground');
        }

        if (artifact.gaps && artifact.gaps > 0) {
            return new vscode.ThemeColor('charts.yellow');
        }

        switch (artifact.complexity) {
            case 'high':
                return new vscode.ThemeColor('charts.red');
            case 'medium':
                return new vscode.ThemeColor('charts.yellow');
            case 'low':
                return new vscode.ThemeColor('charts.green');
            default:
                return undefined;
        }
    }

    /**
     * Create tooltip for artifact
     */
    private static createTooltip(
        artifact: ArtifactItemInfo,
        typeInfo: ArtifactTypeInfo
    ): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${artifact.name}**\n\n`);
        tooltip.appendMarkdown(`*Type:* ${typeInfo.label}\n\n`);
        tooltip.appendMarkdown(`*Platform:* ${artifact.platform}\n\n`);
        tooltip.appendMarkdown(`*Path:* \`${artifact.filePath}\`\n\n`);

        if (artifact.complexity) {
            const complexityLabels = {
                low: '🟢 Low',
                medium: '🟡 Medium',
                high: '🔴 High',
                unknown: '○ Unknown',
            };
            tooltip.appendMarkdown(`---\n\n`);
            tooltip.appendMarkdown(`*Complexity:* ${complexityLabels[artifact.complexity]}\n\n`);
        }

        if (artifact.gaps && artifact.gaps > 0) {
            tooltip.appendMarkdown(`*Gaps:* ⚠️ ${artifact.gaps} identified\n\n`);
        }

        if (artifact.status) {
            const statusLabels: Record<ArtifactStatus, string> = {
                discovered: 'Discovered',
                analyzed: 'Analyzed',
                designed: 'Design Complete',
                converted: 'Converted',
                validated: 'Validated',
                deployed: 'Deployed',
                excluded: 'Excluded',
            };
            tooltip.appendMarkdown(`*Status:* ${statusLabels[artifact.status]}\n\n`);
        }

        if (artifact.hasOverrides) {
            tooltip.appendMarkdown(`---\n\n`);
            tooltip.appendMarkdown(`🔧 *Has user overrides*\n`);
        }

        if (artifact.lastModified) {
            tooltip.appendMarkdown(`---\n\n`);
            tooltip.appendMarkdown(
                `*Last Modified:* ${new Date(artifact.lastModified).toLocaleString()}\n`
            );
        }

        return tooltip;
    }

    /**
     * Get context value for menus
     */
    private static getContextValue(artifact: ArtifactItemInfo): string {
        const parts = ['migration.artifact'];

        if (artifact.status) {
            parts.push(artifact.status);
        }

        if (artifact.complexity) {
            parts.push(artifact.complexity);
        }

        if (artifact.gaps && artifact.gaps > 0) {
            parts.push('hasGaps');
        }

        return parts.join('.');
    }

    /**
     * Check if artifact has gaps
     */
    public hasGaps(): boolean {
        return (this.artifact.gaps ?? 0) > 0;
    }

    /**
     * Check if artifact is excluded
     */
    public isExcluded(): boolean {
        return this.artifact.status === 'excluded';
    }

    /**
     * Get complexity level
     */
    public getComplexity(): ComplexityLevel {
        return this.artifact.complexity ?? 'unknown';
    }
}

/**
 * Factory for creating artifact tree items
 */
export const ArtifactItemFactory = {
    /**
     * Create artifact group tree item
     */
    createGroup(props: ArtifactGroupTreeItemProps): ArtifactGroupTreeItem {
        return new ArtifactGroupTreeItem(props);
    },

    /**
     * Create artifact tree item
     */
    createArtifact(props: ArtifactTreeItemProps): ArtifactTreeItem {
        return new ArtifactTreeItem(props);
    },

    /**
     * Group artifacts by type
     */
    groupByType(artifacts: ArtifactItemInfo[]): Map<ArtifactType, ArtifactItemInfo[]> {
        const groups = new Map<ArtifactType, ArtifactItemInfo[]>();

        for (const artifact of artifacts) {
            const type = (artifact.type as ArtifactType) || 'unknown';
            if (!groups.has(type)) {
                groups.set(type, []);
            }
            groups.get(type)?.push(artifact);
        }

        return groups;
    },

    /**
     * Get artifact type info
     */
    getTypeInfo(type: ArtifactType): ArtifactTypeInfo {
        return ARTIFACT_TYPE_INFO[type] ?? ARTIFACT_TYPE_INFO.unknown;
    },

    /**
     * Sort artifacts by name
     */
    sortByName(artifacts: ArtifactItemInfo[]): ArtifactItemInfo[] {
        return [...artifacts].sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * Sort artifacts by complexity (high first)
     */
    sortByComplexity(artifacts: ArtifactItemInfo[]): ArtifactItemInfo[] {
        const order = { high: 0, medium: 1, low: 2, unknown: 3 };
        return [...artifacts].sort(
            (a, b) =>
                (order[a.complexity ?? 'unknown'] ?? 3) - (order[b.complexity ?? 'unknown'] ?? 3)
        );
    },

    /**
     * Filter artifacts by complexity
     */
    filterByComplexity(
        artifacts: ArtifactItemInfo[],
        complexity: ComplexityLevel
    ): ArtifactItemInfo[] {
        return artifacts.filter((a) => a.complexity === complexity);
    },

    /**
     * Filter artifacts by status
     */
    filterByStatus(artifacts: ArtifactItemInfo[], status: ArtifactStatus): ArtifactItemInfo[] {
        return artifacts.filter((a) => a.status === status);
    },
};
