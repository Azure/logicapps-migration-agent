/**
 * Sidebar UI Components
 *
 * This module exports all sidebar-related UI components including
 * tree view providers and tree items for the migration sidebar.
 */

// Base tree item
export { MigrationTreeItem, TreeItemFactory } from './MigrationTreeItem';
export type {
    MigrationTreeItemType,
    MigrationTreeItemStatus,
    MigrationTreeItemProps,
} from './MigrationTreeItem';

// Stage tree items
export { StageTreeItem, ExitCriteriaTreeItem, StageItemFactory, STAGE_INFO } from './StageTreeItem';
export type { StageInfo, StageTreeItemProps, ExitCriteriaTreeItemProps } from './StageTreeItem';

// Artifact tree items
export {
    ArtifactGroupTreeItem,
    ArtifactTreeItem,
    ArtifactItemFactory,
    ARTIFACT_TYPE_INFO,
} from './ArtifactTreeItem';
export type {
    ArtifactType,
    ArtifactTypeInfo,
    ComplexityLevel,
    ArtifactStatus,
    ArtifactItemInfo,
    ArtifactGroupTreeItemProps,
    ArtifactTreeItemProps,
} from './ArtifactTreeItem';

// Tree data provider
export { MigrationTreeProvider, registerTreeViewProviders } from './MigrationTreeProvider';
export type { MigrationTreeViewType, TreeDataChangeType } from './MigrationTreeProvider';
