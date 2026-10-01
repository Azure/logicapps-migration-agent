/**
 * Discovery Stage Index
 *
 * Exports all Discovery stage components.
 *
 * @module stages/discovery
 */

// Types
export * from './types';

// Services
export { SourceFolderService } from './SourceFolderService';
export { PlatformDetector } from './PlatformDetector';
export { ArtifactScanner } from './ArtifactScanner';
export { InventoryBuilder, InventoryService } from './InventoryService';
export { DependencyGraphBuilder, DependencyGraphService } from './DependencyGraphService';
export { DiscoveryService } from './DiscoveryService';
export { DiscoveryCacheService } from './DiscoveryCacheService';
export { BizTalkEnvironmentConnector } from './BizTalkEnvironmentConnector';
export { SourceResolverService } from './SourceResolverService';
export { ApplicationMigrationScheduler } from './ApplicationMigrationScheduler';
export { EnvironmentInventoryService } from './EnvironmentInventoryService';
export type {
    DiscoveryFlowGroup,
    DiscoveryFlowGroupsResult,
    DiscoveryAnalysisResult,
} from './DiscoveryCacheService';

export type {
    ApplicationMigrationSchedule,
    ApplicationMigrationStep,
    EnvironmentGap,
    SourceResolution,
    SourceResolutionResult,
} from './types';
