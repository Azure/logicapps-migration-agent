/**
 * Parser Registry
 *
 * Manages registration and lookup of parsers.
 *
 * @module parsers/ParserRegistry
 */

import { IParser, IProjectParser } from './IParser';
import { ParserRegistration } from './types';
import { SourcePlatformType } from '../ir/types/common';

// =============================================================================
// Parser Registry
// =============================================================================

/**
 * Registry for source platform parsers.
 *
 * Allows dynamic registration of parsers and lookup by file type,
 * extension, or platform.
 */
export class ParserRegistry {
    private readonly parsers = new Map<string, IParser>();
    private readonly registrations = new Map<string, ParserRegistration>();
    private autoIdCounter = 0;

    /**
     * Register a parser.
     *
     * @param parserOrId - Parser instance (id generated auto) or unique parser identifier
     * @param parser - Parser instance (when first arg is id)
     * @param priority - Priority for selection (higher = preferred)
     */
    register(parserOrId: IParser | string, parser?: IParser, priority = 0): void {
        let id: string;
        let actualParser: IParser;

        if (typeof parserOrId === 'string') {
            id = parserOrId;
            if (!parser) {
                throw new Error('Parser instance required when id is provided');
            }
            actualParser = parser;
        } else {
            // Auto-generate id from capabilities
            actualParser = parserOrId;
            id = `${actualParser.capabilities.platform}-${actualParser.capabilities.fileTypes[0] ?? 'parser'}-${++this.autoIdCounter}`;
        }

        if (this.parsers.has(id)) {
            throw new Error(`Parser already registered: ${id}`);
        }

        this.parsers.set(id, actualParser);
        this.registrations.set(id, {
            id,
            capabilities: actualParser.capabilities,
            priority,
        });
    }

    /**
     * Unregister a parser.
     *
     * @param id - Parser identifier
     */
    unregister(id: string): void {
        const parser = this.parsers.get(id);
        if (parser) {
            parser.dispose?.();
            this.parsers.delete(id);
            this.registrations.delete(id);
        }
    }

    /**
     * Get a parser by ID.
     *
     * @param id - Parser identifier
     * @returns Parser instance or undefined
     */
    get(id: string): IParser | undefined {
        return this.parsers.get(id);
    }

    /**
     * Check if a parser is registered.
     *
     * @param id - Parser identifier
     */
    has(id: string): boolean {
        return this.parsers.has(id);
    }

    /**
     * Get all registered parsers.
     */
    getAll(): readonly IParser[] {
        return Array.from(this.parsers.values());
    }

    /**
     * Get all parser registrations.
     */
    getRegistrations(): readonly ParserRegistration[] {
        return Array.from(this.registrations.values());
    }

    /**
     * Find parsers by platform.
     *
     * @param platform - Source platform type
     * @returns Array of parsers for the platform, sorted by priority
     */
    findByPlatform(platform: SourcePlatformType): IParser[] {
        const results: { parser: IParser; priority: number }[] = [];

        for (const [id, parser] of this.parsers) {
            if (parser.capabilities.platform === platform) {
                const reg = this.registrations.get(id);
                if (reg) {
                    results.push({ parser, priority: reg.priority });
                }
            }
        }

        return results.sort((a, b) => b.priority - a.priority).map((r) => r.parser);
    }

    /**
     * Find parsers by file extension.
     *
     * @param extension - File extension (with or without dot)
     * @returns Array of parsers that support the extension, sorted by priority
     */
    findByExtension(extension: string): IParser[] {
        const ext = extension.startsWith('.')
            ? extension.toLowerCase()
            : `.${extension.toLowerCase()}`;
        const results: { parser: IParser; priority: number }[] = [];

        for (const [id, parser] of this.parsers) {
            if (parser.capabilities.fileExtensions.includes(ext)) {
                const reg = this.registrations.get(id);
                if (reg) {
                    results.push({ parser, priority: reg.priority });
                }
            }
        }

        return results.sort((a, b) => b.priority - a.priority).map((r) => r.parser);
    }

    /**
     * Find the best parser for a file path.
     *
     * @param filePath - Path to file
     * @returns Best matching parser or undefined
     */
    findForPath(filePath: string): IParser | undefined {
        const ext = this.getExtension(filePath);
        const parsers = this.findByExtension(ext);
        return parsers.find((p) => p.canParse(filePath));
    }

    /**
     * Find project parsers that can handle a folder.
     *
     * @param folderPath - Path to folder
     * @returns Array of project parsers, sorted by priority
     */
    findProjectParsers(): IProjectParser[] {
        const results: { parser: IProjectParser; priority: number }[] = [];

        for (const [id, parser] of this.parsers) {
            if (parser.capabilities.supportsFolder && this.isProjectParser(parser)) {
                const reg = this.registrations.get(id);
                if (reg) {
                    results.push({ parser: parser as IProjectParser, priority: reg.priority });
                }
            }
        }

        return results.sort((a, b) => b.priority - a.priority).map((r) => r.parser);
    }

    /**
     * Get supported platforms.
     */
    getSupportedPlatforms(): SourcePlatformType[] {
        const platforms = new Set<SourcePlatformType>();
        for (const parser of this.parsers.values()) {
            platforms.add(parser.capabilities.platform);
        }
        return Array.from(platforms);
    }

    /**
     * Get supported extensions.
     */
    getSupportedExtensions(): string[] {
        const extensions = new Set<string>();
        for (const parser of this.parsers.values()) {
            for (const ext of parser.capabilities.fileExtensions) {
                extensions.add(ext);
            }
        }
        return Array.from(extensions).sort();
    }

    /**
     * Clear all registered parsers.
     */
    clear(): void {
        for (const parser of this.parsers.values()) {
            parser.dispose?.();
        }
        this.parsers.clear();
        this.registrations.clear();
    }

    /**
     * Get extension from file path.
     */
    private getExtension(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        if (lastDot === -1) {
            return '';
        }
        return filePath.slice(lastDot).toLowerCase();
    }

    /**
     * Check if parser is a project parser.
     */
    private isProjectParser(parser: IParser): parser is IProjectParser {
        return 'detectVersion' in parser && 'getProjectArtifacts' in parser;
    }
}

// =============================================================================
// Global Registry Instance
// =============================================================================

/**
 * Default global parser registry instance.
 */
export const defaultParserRegistry = new ParserRegistry();
