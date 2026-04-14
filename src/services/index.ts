/**
 * Services module index
 */

export { LoggingService, LogLevel } from './LoggingService';
export { TelemetryService } from './TelemetryService';
export { ConfigurationService } from './ConfigurationService';
export type {
    SourcePlatform,
    TargetPlatform,
    LogLevelType,
    AzureConfig,
    ExtensionConfig,
    ConfigurationChangeEvent,
} from './ConfigurationService';
export { StorageService, StorageKeys } from './StorageService';
export type { StorageKey } from './StorageService';
export { StateManager } from './StateManager';
export { MigrationStage } from '../types/stages';
export type {
    MigrationState,
    DiscoveredArtifact,
    StageStatus,
    Override,
    StateChangeEvent,
} from './StateManager';

// Prerequisites checker
export { PrerequisitesChecker, getPrerequisitesChecker } from './PrerequisitesChecker';
export type {
    PrerequisiteStatus,
    PrerequisiteResult,
    PrerequisitesCheckResult,
} from './PrerequisitesChecker';

// Project auto-detection
export { ProjectAutoDetection, getProjectAutoDetection } from './ProjectAutoDetection';
export type { AutoDetectionConfig } from './ProjectAutoDetection';

// LLM Flow Generator
export { LLMFlowGenerator } from './LLMFlowGenerator';
export type {
    GeneratedFlowResult,
    ComponentDetail,
    MessageFlowStep,
    FlowGroup,
    FlowGroupsResult,
} from './LLMFlowGenerator';

// Agent file provisioner
export { AgentFileProvisioner } from './AgentFileProvisioner';

// Reference Workflow Registry
export { ReferenceWorkflowRegistry } from './ReferenceWorkflowRegistry';
export type {
    WorkflowCatalogEntry,
    ConnectionCatalogEntry,
    CatalogEntry,
    ReferenceWorkflowSearchResult,
} from './ReferenceWorkflowRegistry';

// MSI Extractor
export { MsiExtractorService } from './MsiExtractorService';
export type {
    MsiExtractionResult,
    MsiExtractionProgress,
    MsiExtractionProgressCallback,
    AdfResource,
} from './MsiExtractorService';

// Report Export
export { ReportExporterService } from './ReportExporterService';
export { MermaidImageRenderer } from './MermaidImageRenderer';

// Tool services
export * from './tools';
