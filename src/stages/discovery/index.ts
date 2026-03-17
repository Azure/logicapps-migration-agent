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
export type {
    DiscoveryFlowGroup,
    DiscoveryFlowGroupsResult,
    DiscoveryAnalysisResult,
} from './DiscoveryCacheService';
