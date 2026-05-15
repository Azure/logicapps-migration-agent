/**
 * Parser Factory
 *
 * Factory for creating and obtaining parser instances.
 *
 * @module parsers/ParserFactory
 */

import * as fs from 'fs';
import * as path from 'path';
import { IParser, IProjectParser } from './IParser';
import { ParserRegistry, defaultParserRegistry } from './ParserRegistry';
import { ParseOptions, ParseResult, DetectedFile } from './types';
import { SourcePlatformType } from '../ir/types/common';

// =============================================================================
// Parser Factory
// =============================================================================

/**
 * Factory for obtaining parsers and coordinating parsing operations.
 */
export class ParserFactory {
    private readonly registry: ParserRegistry;

    constructor(registry: ParserRegistry = defaultParserRegistry) {
        this.registry = registry;
    }

    /**
     * Get the appropriate parser for a file path.
     *
     * @param filePath - Path to file
     * @returns Parser that can handle the file, or undefined
     */
    getParserForFile(filePath: string): IParser | undefined {
        return this.registry.findForPath(filePath);
    }

    /**
     * Get the appropriate parser for a platform.
     *
     * @param platform - Source platform
     * @returns First parser for the platform, or undefined
     */
    getParserForPlatform(platform: SourcePlatformType): IParser | undefined {
        const parsers = this.registry.findByPlatform(platform);
        return parsers[0];
    }

    /**
     * Get all parsers for a platform.
     *
     * @param platform - Source platform
     * @returns All parsers for the platform
     */
    getParsersForPlatform(platform: SourcePlatformType): IParser[] {
        return this.registry.findByPlatform(platform);
    }

    /**
     * Get project parsers.
     *
     * @returns All registered project parsers
     */
    getProjectParsers(): IProjectParser[] {
        return this.registry.findProjectParsers();
    }

    /**
     * Detect platform from a folder.
     *
     * @param folderPath - Path to folder
     * @returns Detected platform or undefined
     */
    async detectPlatform(folderPath: string): Promise<SourcePlatformType | undefined> {
        if (!fs.existsSync(folderPath)) {
            return undefined;
        }

        const stat = await fs.promises.stat(folderPath);
        if (!stat.isDirectory()) {
            return undefined;
        }

        // Check for platform-specific indicators
        const indicators: { platform: SourcePlatformType; patterns: string[] }[] = [
            {
                platform: 'biztalk',
                patterns: ['*.btproj', '*.odx', '*.btm', 'BindingInfo.xml'],
            },
            {
                platform: 'mulesoft',
                patterns: ['pom.xml', 'mule-*.xml', '*.dwl'],
            },
            {
                platform: 'tibco',
                patterns: ['tibco.xml', '*.process', '*.bwp'],
            },
        ];

        for (const indicator of indicators) {
            if (await this.hasMatchingFiles(folderPath, indicator.patterns)) {
                return indicator.platform;
            }
        }

        return undefined;
    }

    /**
     * Scan a folder for all parseable files.
     *
     * @param folderPath - Path to folder
     * @returns All detected files grouped by platform
     */
    async scanFolder(folderPath: string): Promise<Map<SourcePlatformType, DetectedFile[]>> {
        const result = new Map<SourcePlatformType, DetectedFile[]>();

        for (const parser of this.registry.getAll()) {
            const files = await parser.getSupportedFiles(folderPath);
            if (files.length > 0) {
                const platform = parser.capabilities.platform;
                const existing = result.get(platform) ?? [];
                result.set(platform, [...existing, ...files]);
            }
        }

        // Deduplicate files by path
        for (const [platform, files] of result) {
            const unique = new Map<string, DetectedFile>();
            for (const file of files) {
                unique.set(file.path, file);
            }
            result.set(platform, Array.from(unique.values()));
        }

        return result;
    }

    /**
     * Parse a file using the appropriate parser.
     *
     * @param filePath - Path to file
     * @param options - Parse options
     * @returns Parse result
     */
    async parseFile(filePath: string, options?: ParseOptions): Promise<ParseResult> {
        const parser = this.getParserForFile(filePath);
        if (!parser) {
            return {
                success: false,
                ir: null,
                errors: [
                    {
                        severity: 'error',
                        code: 'PARSE_UNSUPPORTED_FORMAT',
                        message: `No parser found for file: ${filePath}`,
                        filePath,
                    },
                ],
                stats: {
                    filesDiscovered: 1,
                    filesParsed: 0,
                    filesFailed: 1,
                    filesSkipped: 0,
                    durationMs: 0,
                    byArtifactType: {},
                },
            };
        }

        return parser.parse(filePath, options);
    }

    /**
     * Parse a folder using all appropriate parsers.
     *
     * @param folderPath - Path to folder
     * @param options - Parse options
     * @returns Array of parse results (one per detected platform)
     */
    async parseFolder(folderPath: string, options?: ParseOptions): Promise<ParseResult[]> {
        const results: ParseResult[] = [];
        const filesByPlatform = await this.scanFolder(folderPath);

        for (const [platform, files] of filesByPlatform) {
            const projectParsers = this.registry.findByPlatform(platform);
            const projectParser = projectParsers.find((p) => p.capabilities.supportsFolder);

            if (projectParser) {
                // Use project parser for the entire folder
                const result = await projectParser.parse(folderPath, options);
                results.push(result);
            } else {
                // Parse individual files
                for (const file of files) {
                    const parser = this.getParserForFile(file.path);
                    if (parser) {
                        const result = await parser.parse(file.path, options);
                        results.push(result);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Get supported platforms.
     */
    getSupportedPlatforms(): SourcePlatformType[] {
        return this.registry.getSupportedPlatforms();
    }

    /**
     * Get supported file extensions.
     */
    getSupportedExtensions(): string[] {
        return this.registry.getSupportedExtensions();
    }

    /**
     * Check if a file is parseable.
     */
    canParse(filePath: string): boolean {
        return this.getParserForFile(filePath) !== undefined;
    }

    /**
     * Check if folder has matching files.
     */
    private async hasMatchingFiles(folderPath: string, patterns: string[]): Promise<boolean> {
        try {
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

            for (const entry of entries) {
                for (const pattern of patterns) {
                    if (this.matchPattern(entry.name, pattern)) {
                        return true;
                    }
                }

                // Check one level deep in subdirectories
                if (entry.isDirectory()) {
                    const subPath = path.join(folderPath, entry.name);
                    try {
                        const subEntries = await fs.promises.readdir(subPath);
                        for (const subEntry of subEntries) {
                            for (const pattern of patterns) {
                                if (this.matchPattern(subEntry, pattern)) {
                                    return true;
                                }
                            }
                        }
                    } catch {
                        // Ignore errors in subdirectories
                    }
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Simple glob pattern matching (supports only * wildcard).
     */
    private matchPattern(name: string, pattern: string): boolean {
        const regex = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(`^${regex}$`, 'i').test(name);
    }
}

// =============================================================================
// Default Factory Instance
// =============================================================================

/**
 * Default parser factory instance using the global registry.
 */
export const defaultParserFactory = new ParserFactory(defaultParserRegistry);
