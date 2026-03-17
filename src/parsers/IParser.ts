/**
 * Parser Interface
 *
 * Defines the contract that all source platform parsers must implement.
 *
 * @module parsers/IParser
 */

import { ParseOptions, ParseResult, ParserCapabilities, DetectedFile } from './types';
import { ParsedArtifact } from '../stages/discovery/types';
import { LoggingService } from '../services/LoggingService';

// =============================================================================
// IParser Interface
// =============================================================================

/**
 * Interface for source platform parsers.
 *
 * All parsers must implement this interface to be used by the
 * parser factory and discovery tools.
 *
 * @example
 * ```typescript
 * class BizTalkOrchestrationParser implements IParser {
 *   get capabilities() {
 *     return {
 *       platform: 'biztalk',
 *       fileExtensions: ['.odx'],
 *       fileTypes: ['orchestration'],
 *       supportsFolder: false,
 *       description: 'Parses BizTalk orchestrations',
 *     };
 *   }
 *
 *   canParse(path: string) {
 *     return path.endsWith('.odx');
 *   }
 *
 *   async parse(path: string, options?: ParseOptions) {
 *     // Parse implementation
 *   }
 * }
 * ```
 */
export interface IParser {
    /**
     * Parser capabilities.
     * Describes what this parser can handle.
     */
    readonly capabilities: ParserCapabilities;

    /**
     * Check if this parser can handle the given path.
     *
     * @param path - Path to file or folder
     * @returns True if this parser can handle the path
     */
    canParse(path: string): boolean;

    /**
     * Get supported files from a folder.
     *
     * @param folderPath - Path to folder to scan
     * @returns List of files this parser can handle
     */
    getSupportedFiles(folderPath: string): Promise<DetectedFile[]>;

    /**
     * Parse the given file or folder.
     *
     * @param path - Path to file or folder to parse
     * @param options - Parse options
     * @returns Parse result with IR document and errors
     */
    parse(path: string, options?: ParseOptions): Promise<ParseResult>;

    /**
     * Validate that a file is parseable without fully parsing it.
     * Useful for quick validation before expensive parse operations.
     *
     * @param path - Path to file to validate
     * @returns True if file appears valid
     */
    validate?(path: string): Promise<boolean>;

    /**
     * Post-parse enrichment hook.
     *
     * Called after all files have been parsed, giving platform-specific
     * parsers a chance to cross-reference artifacts and enrich IR data.
     * For example, BizTalk uses this to copy connection/endpoint data
     * from binding artifacts into orchestration artifacts.
     *
     * @param artifacts - All parsed artifacts from the scan
     * @param logger - Logger for diagnostics
     */
    postEnrich?(artifacts: ParsedArtifact[], logger: LoggingService): void;

    /**
     * Dispose of any resources held by the parser.
     */
    dispose?(): void;
}

// =============================================================================
// IProjectParser Interface
// =============================================================================

/**
 * Extended interface for project-level parsers.
 *
 * Project parsers handle entire projects (like .btproj or pom.xml)
 * and coordinate parsing of all contained artifacts.
 */
export interface IProjectParser extends IParser {
    /**
     * Detect the platform version from project files.
     *
     * @param path - Path to project file or folder
     * @returns Detected version string or null
     */
    detectVersion(path: string): Promise<string | null>;

    /**
     * Get all artifacts referenced by the project.
     *
     * @param path - Path to project file
     * @returns List of artifact files
     */
    getProjectArtifacts(path: string): Promise<DetectedFile[]>;

    /**
     * Get project dependencies (other projects, external references).
     *
     * @param path - Path to project file
     * @returns List of dependency paths
     */
    getProjectDependencies(path: string): Promise<string[]>;
}

// =============================================================================
// IArtifactParser Interface
// =============================================================================

/**
 * Extended interface for artifact-level parsers.
 *
 * Artifact parsers handle individual files like .odx, .btm, .xml flows.
 */
export interface IArtifactParser extends IParser {
    /**
     * Extract a quick summary without full parsing.
     * Useful for inventory building.
     *
     * @param path - Path to artifact file
     * @returns Quick summary info
     */
    getArtifactSummary?(path: string): Promise<ArtifactSummary>;
}

/**
 * Quick artifact summary for inventory.
 */
export interface ArtifactSummary {
    /** Artifact name */
    readonly name: string;

    /** Artifact type */
    readonly type: string;

    /** Number of elements (shapes, steps, etc.) */
    readonly elementCount?: number;

    /** Referenced artifacts */
    readonly references?: readonly string[];

    /** Brief description */
    readonly description?: string;
}
