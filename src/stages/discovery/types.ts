/**
 * Discovery Stage Types
 *
 * Type definitions for the Discovery stage (Phase 6).
 *
 * @module stages/discovery/types
 */

import { SourcePlatformType, ComplexityLevel } from '../../ir/types/common';
import { IRDocument } from '../../ir/types/document';

// =============================================================================
// Source Folder Types
// =============================================================================

/**
 * Result of source folder selection and validation.
 */
export interface SourceFolderResult {
    /** Absolute path to selected folder */
    readonly path: string;

    /** Whether the folder is within the VS Code workspace */
    readonly isWorkspaceFolder: boolean;

    /** Relative path if within workspace */
    readonly relativePath?: string;

    /** Whether the folder contains recognizable integration files */
    readonly hasIntegrationFiles: boolean;

    /** Quick scan results */
    readonly quickScan: QuickScanResult;
}

/**
 * Quick scan result for a folder.
 */
export interface QuickScanResult {
    /** Total files found */
    readonly totalFiles: number;

    /** Files by extension */
    readonly filesByExtension: Record<string, number>;

    /** Potential platform indicators found */
    readonly platformIndicators: PlatformIndicator[];
}

/**
 * Platform indicator found during quick scan.
 */
export interface PlatformIndicator {
    /** Platform this indicates */
    readonly platform: SourcePlatformType;

    /** Type of indicator */
    readonly indicatorType: 'file-extension' | 'config-file' | 'folder-structure';

    /** File or pattern that matched */
    readonly match: string;

    /** Confidence level for this indicator */
    readonly confidence: 'high' | 'medium' | 'low';
}

// =============================================================================
// Platform Detection Types
// =============================================================================

/**
 * Platform detection result.
 */
export interface PlatformDetectionResult {
    /** Detected platform (primary) */
    readonly platform: SourcePlatformType;

    /** Detected version if available */
    readonly version?: string;

    /** Overall confidence score (0-100) */
    readonly confidence: number;

    /** All indicators that contributed to detection */
    readonly indicators: PlatformIndicator[];

    /** Other platforms detected (for mixed projects) */
    readonly alternativePlatforms: AlternativePlatform[];
}

/**
 * Alternative platform detection for mixed projects.
 */
export interface AlternativePlatform {
    /** Platform type */
    readonly platform: SourcePlatformType;

    /** Confidence score */
    readonly confidence: number;

    /** Indicators */
    readonly indicators: PlatformIndicator[];
}

/**
 * Platform detector interface.
 */
export interface IPlatformDetector {
    /** Platform this detector handles */
    readonly platform: SourcePlatformType;

    /**
     * Detect if this platform is present in the folder.
     */
    detect(folderPath: string): Promise<PlatformDetectionResult | null>;

    /**
     * Get version if detectable.
     */
    detectVersion?(folderPath: string): Promise<string | null>;
}

// =============================================================================
// Artifact Scanner Types
// =============================================================================

/**
 * Options for artifact scanning.
 */
export interface ScanOptions {
    /** Patterns to exclude from scanning */
    readonly excludePatterns?: string[];

    /** Maximum depth for recursive scanning */
    readonly maxDepth?: number;

    /** Whether to respect .gitignore */
    readonly respectGitignore?: boolean;

    /** File size limit in bytes */
    readonly maxFileSizeBytes?: number;

    /** Cancellation token */
    readonly cancellationToken?: { isCancellationRequested: boolean };
}

/**
 * Scan progress callback.
 */
export interface ScanProgress {
    /** Current file being processed */
    currentFile: string;

    /** Total files found */
    totalFiles: number;

    /** Files processed */
    processedFiles: number;

    /** Percentage complete */
    percentage: number;

    /** Current phase */
    phase: 'scanning' | 'parsing' | 'analyzing';
}

/**
 * Progress callback function type.
 */
export type ScanProgressCallback = (progress: ScanProgress) => void;

/**
 * Result of artifact scanning.
 */
export interface ScanResult {
    /** Platform detected */
    readonly platform: SourcePlatformType;

    /** Source folder path */
    readonly sourcePath: string;

    /** Total files scanned */
    readonly totalFilesScanned: number;

    /** Artifacts successfully parsed */
    readonly parsedArtifacts: ParsedArtifact[];

    /** Files that failed to parse */
    readonly parseErrors: ParseErrorInfo[];

    /** Files skipped (excluded, too large, etc.) */
    readonly skippedFiles: SkippedFile[];

    /** Scan duration in milliseconds */
    readonly durationMs: number;

    /** Timestamp of scan completion */
    readonly completedAt: string;
}

/**
 * Successfully parsed artifact.
 */
export interface ParsedArtifact {
    /** Unique ID for this artifact */
    readonly id: string;

    /** Artifact name */
    readonly name: string;

    /** Artifact type */
    readonly type: ArtifactCategory;

    /** Source file path (relative) */
    readonly sourcePath: string;

    /** Source file path (absolute) */
    readonly absolutePath: string;

    /** Parsed IR document */
    readonly ir: IRDocument;

    /** File size in bytes */
    readonly fileSize: number;

    /** Last modified timestamp */
    readonly lastModified: string;

    /** Parser that processed this artifact */
    readonly parserId: string;
}

/**
 * Artifact categories.
 */
export type ArtifactCategory =
    | 'workflow'
    | 'orchestration'
    | 'flow'
    | 'process'
    | 'map'
    | 'schema'
    | 'pipeline'
    | 'binding'
    | 'policy'
    | 'dataweave'
    | 'esql'
    | 'api'
    | 'connector'
    | 'config'
    | 'project'
    | 'dependency'
    | 'other';

/**
 * Parse error information.
 */
export interface ParseErrorInfo {
    /** File path */
    readonly filePath: string;

    /** Error message */
    readonly message: string;

    /** Error code if available */
    readonly code?: string;

    /** Line number if available */
    readonly line?: number;

    /** Column if available */
    readonly column?: number;

    /** Whether this is recoverable */
    readonly recoverable: boolean;
}

/**
 * Skipped file information.
 */
export interface SkippedFile {
    /** File path */
    readonly filePath: string;

    /** Reason for skipping */
    readonly reason: 'excluded' | 'too-large' | 'binary' | 'no-parser' | 'cancelled';

    /** Additional details */
    readonly details?: string;
}

// =============================================================================
// Inventory Types
// =============================================================================

/**
 * Artifact inventory - central catalog of all discovered artifacts.
 */
export interface ArtifactInventory {
    /** Unique inventory ID */
    readonly id: string;

    /** Project name */
    readonly projectName: string;

    /** Source platform */
    readonly platform: SourcePlatformType;

    /** Platform version if detected */
    readonly platformVersion?: string;

    /** Source folder path */
    readonly sourcePath: string;

    /** All inventory items */
    readonly items: InventoryItem[];

    /** Summary statistics */
    readonly statistics: InventoryStatistics;

    /** When inventory was created */
    readonly createdAt: string;

    /** When inventory was last updated */
    readonly updatedAt: string;

    /** Inventory version (for change tracking) */
    readonly version: number;
}

/**
 * Single inventory item.
 */
export interface InventoryItem {
    /** Unique ID (same as artifact ID) */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Category */
    readonly category: ArtifactCategory;

    /** Source path (relative) */
    readonly sourcePath: string;

    /** Parse status */
    readonly status: 'parsed' | 'error' | 'warning';

    /** Error message if status is error */
    readonly errorMessage?: string;

    /** IR reference ID */
    readonly irId?: string;

    /** Metadata */
    readonly metadata: InventoryItemMetadata;

    /** Tags for filtering */
    readonly tags: string[];
}

/**
 * Inventory item metadata.
 */
export interface InventoryItemMetadata {
    /** File size in bytes */
    readonly fileSize: number;

    /** Last modified timestamp */
    readonly lastModified: string;

    /** Complexity if assessed */
    readonly complexity?: ComplexityLevel;

    /** Number of actions/shapes */
    readonly actionCount?: number;

    /** Dependencies count */
    readonly dependencyCount?: number;

    /** Platform-specific metadata */
    readonly platformSpecific?: Record<string, unknown>;
}

/**
 * Inventory statistics.
 */
export interface InventoryStatistics {
    /** Total items */
    readonly totalCount: number;

    /** Count by category */
    readonly byCategory: Record<ArtifactCategory, number>;

    /** Count by status */
    readonly byStatus: Record<'parsed' | 'error' | 'warning', number>;

    /** Error rate as percentage */
    readonly errorRate: number;

    /** Total file size */
    readonly totalFileSize: number;
}

// =============================================================================
// Dependency Graph Types
// =============================================================================

/**
 * Dependency graph for artifacts.
 */
export interface DependencyGraph {
    /** All nodes (artifacts) */
    readonly nodes: DependencyNode[];

    /** All edges (dependencies) */
    readonly edges: DependencyEdge[];

    /** Root nodes (no dependencies) */
    readonly rootNodeIds: string[];

    /** Leaf nodes (no dependents) */
    readonly leafNodeIds: string[];

    /** Circular dependencies detected */
    readonly circularDependencies: CircularDependency[];

    /** Shared resources (used by multiple artifacts) */
    readonly sharedResources: SharedResource[];
}

/**
 * Node in the dependency graph.
 */
export interface DependencyNode {
    /** Artifact ID */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Category */
    readonly category: ArtifactCategory;

    /** Number of incoming edges (dependents) */
    readonly inDegree: number;

    /** Number of outgoing edges (dependencies) */
    readonly outDegree: number;

    /** Depth in the graph (from root) */
    readonly depth: number;
}

/**
 * Edge in the dependency graph.
 */
export interface DependencyEdge {
    /** Source node ID (the artifact that has the dependency) */
    readonly source: string;

    /** Target node ID (the artifact being depended on) */
    readonly target: string;

    /** Type of dependency */
    readonly type: DependencyType;

    /** Reference details */
    readonly reference?: string;
}

/**
 * Dependency types.
 */
export type DependencyType =
    | 'uses' // General usage
    | 'references' // Reference (schema, map)
    | 'imports' // Import (code)
    | 'calls' // Calls (subprocess, function)
    | 'includes'; // Includes (config, template)

/**
 * Circular dependency information.
 */
export interface CircularDependency {
    /** IDs of nodes in the cycle */
    readonly nodeIds: string[];

    /** Edges forming the cycle */
    readonly edges: DependencyEdge[];
}

/**
 * Shared resource information.
 */
export interface SharedResource {
    /** Resource ID (artifact ID) */
    readonly id: string;

    /** Resource name */
    readonly name: string;

    /** Category */
    readonly category: ArtifactCategory;

    /** IDs of artifacts using this resource */
    readonly usedBy: string[];

    /** Usage count */
    readonly usageCount: number;
}

// =============================================================================
// Discovery Service Events
// =============================================================================

/**
 * Event emitted when source folder changes.
 */
export interface SourceFolderChangedEvent {
    /** Previous folder path (undefined if first selection) */
    readonly previousPath?: string;

    /** New folder path */
    readonly newPath: string;

    /** Quick scan result */
    readonly quickScan: QuickScanResult;
}

/**
 * Event emitted when platform is detected.
 */
export interface PlatformDetectedEvent {
    /** Detection result */
    readonly detection: PlatformDetectionResult;

    /** Whether user confirmed/overrode */
    readonly userConfirmed: boolean;
}

/**
 * Event emitted during scanning.
 */
export interface ScanProgressEvent {
    /** Progress information */
    readonly progress: ScanProgress;
}

/**
 * Event emitted when scanning completes.
 */
export interface ScanCompleteEvent {
    /** Scan result */
    readonly result: ScanResult;
}

/**
 * Event emitted when inventory changes.
 */
export interface InventoryChangedEvent {
    /** Updated inventory (undefined when cleared) */
    readonly inventory?: ArtifactInventory;

    /** Change type */
    readonly changeType: 'created' | 'updated' | 'refreshed' | 'cleared';
}
