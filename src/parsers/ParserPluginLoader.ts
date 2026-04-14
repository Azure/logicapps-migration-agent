/**
 * Parser Plugin Loader
 *
 * Discovers and loads parsers from external VS Code extensions.
 * Enables partner teams to contribute their own platform parsers.
 *
 * @module parsers/ParserPluginLoader
 */

import * as vscode from 'vscode';
import { IParser } from './IParser';
import { ParserRegistry, defaultParserRegistry } from './ParserRegistry';
import { LoggingService } from '../services/LoggingService';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for registering a parser.
 */
export interface ParserRegistrationOptions {
    /**
     * Unique identifier for the parser.
     * If not provided, one will be auto-generated.
     */
    id?: string;

    /**
     * Priority for parser selection (higher = preferred).
     * Built-in parsers use priority 0-10.
     * Partner parsers should use 10-100.
     * @default 10
     */
    priority?: number;
}

/**
 * Result of parser registration.
 */
export interface ParserRegistrationResult {
    /** Whether registration succeeded */
    success: boolean;
    /** Assigned parser ID */
    parserId?: string;
    /** Error message if registration failed */
    error?: string;
}

/**
 * Information about a registered external parser.
 */
export interface ExternalParserInfo {
    /** Parser ID */
    id: string;
    /** Extension that registered this parser */
    extensionId: string;
    /** Parser capabilities */
    platform: string;
    /** File extensions supported */
    fileExtensions: string[];
    /** Registration priority */
    priority: number;
    /** When the parser was registered */
    registeredAt: Date;
}

/**
 * Contribution from an external extension's package.json.
 */
interface ParserContribution {
    /** Module path relative to extension root */
    modulePath: string;
    /** Export name (default: 'default') */
    exportName?: string;
    /** Parser class name if module exports multiple classes */
    className?: string;
    /** Registration priority */
    priority?: number;
}

// =============================================================================
// Parser Plugin Loader
// =============================================================================

/**
 * Loader for external parser plugins.
 *
 * Provides two mechanisms for loading external parsers:
 * 1. **API Registration**: Partner extensions call `registerParser()` directly
 * 2. **Contribution Points**: Parsers declared in `contributes.logicAppsMigrationAgent.parsers`
 *
 * @example
 * ```typescript
 * // In partner extension's activate function:
 * const migrationAgent = vscode.extensions.getExtension('microsoft.logicapps-migration-assistant');
 * const api = await migrationAgent.activate();
 * api.registerParser(new MyParser(), { priority: 20 });
 * ```
 */
export class ParserPluginLoader implements vscode.Disposable {
    private static instance: ParserPluginLoader | undefined;

    private readonly registry: ParserRegistry;
    private readonly externalParsers = new Map<string, ExternalParserInfo>();
    private readonly extensionChangeListener: vscode.Disposable;
    private initialized = false;

    // =========================================================================
    // Lifecycle
    // =========================================================================

    private constructor(registry: ParserRegistry = defaultParserRegistry) {
        this.registry = registry;

        // Listen for extension changes to discover new parser contributions
        this.extensionChangeListener = vscode.extensions.onDidChange(() => {
            this.discoverContributedParsers().catch((err) => {
                LoggingService.getInstance().error('Failed to discover parser contributions', err);
            });
        });
    }

    /**
     * Get the singleton instance.
     */
    static getInstance(): ParserPluginLoader {
        if (!ParserPluginLoader.instance) {
            ParserPluginLoader.instance = new ParserPluginLoader();
        }
        return ParserPluginLoader.instance;
    }

    /**
     * Initialize the plugin loader.
     * Discovers and loads any parsers contributed via package.json.
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        await this.discoverContributedParsers();
        this.initialized = true;

        LoggingService.getInstance().info('Parser plugin loader initialized', {
            externalParsers: this.externalParsers.size,
        });
    }

    /**
     * Dispose of resources.
     */
    dispose(): void {
        this.extensionChangeListener.dispose();

        // Unregister all external parsers
        for (const info of this.externalParsers.values()) {
            try {
                this.registry.unregister(info.id);
            } catch {
                // Ignore errors during cleanup
            }
        }
        this.externalParsers.clear();

        ParserPluginLoader.instance = undefined;
    }

    // =========================================================================
    // Public API (exported to partner extensions)
    // =========================================================================

    /**
     * Register an external parser.
     *
     * @param parser - Parser instance implementing IParser
     * @param options - Registration options
     * @returns Registration result with assigned ID
     *
     * @example
     * ```typescript
     * const result = api.registerParser(new MuleSoftParser(), {
     *     id: 'mulesoft-flow-parser',
     *     priority: 20
     * });
     * if (result.success) {
     *     console.log(`Registered parser: ${result.parserId}`);
     * }
     * ```
     */
    registerParser(
        parser: IParser,
        options: ParserRegistrationOptions = {}
    ): ParserRegistrationResult {
        try {
            // Validate parser
            if (!parser || !parser.capabilities) {
                return {
                    success: false,
                    error: 'Invalid parser: missing capabilities',
                };
            }

            // Generate ID if not provided
            const id = options.id ?? `external-${parser.capabilities.platform}-${Date.now()}`;

            // Check for duplicates
            if (this.registry.has(id)) {
                return {
                    success: false,
                    error: `Parser already registered with id: ${id}`,
                };
            }

            // Register with the main registry
            const priority = options.priority ?? 10;
            this.registry.register(id, parser, priority);

            // Track as external parser
            const callingExtension = this.getCallingExtension();
            this.externalParsers.set(id, {
                id,
                extensionId: callingExtension ?? 'unknown',
                platform: parser.capabilities.platform,
                fileExtensions: [...parser.capabilities.fileExtensions],
                priority,
                registeredAt: new Date(),
            });

            LoggingService.getInstance().info('External parser registered', {
                parserId: id,
                platform: parser.capabilities.platform,
                extensionId: callingExtension,
            });

            return {
                success: true,
                parserId: id,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            LoggingService.getInstance().error(
                'Failed to register external parser',
                error instanceof Error ? error : undefined
            );
            return {
                success: false,
                error: message,
            };
        }
    }

    /**
     * Unregister an external parser.
     *
     * @param parserId - ID of the parser to unregister
     * @returns True if parser was unregistered
     */
    unregisterParser(parserId: string): boolean {
        const info = this.externalParsers.get(parserId);
        if (!info) {
            return false;
        }

        try {
            this.registry.unregister(parserId);
            this.externalParsers.delete(parserId);

            LoggingService.getInstance().info('External parser unregistered', {
                parserId,
            });

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the parser registry for direct access.
     * Use with caution - prefer registerParser/unregisterParser.
     */
    getParserRegistry(): ParserRegistry {
        return this.registry;
    }

    /**
     * Get information about all registered external parsers.
     */
    getExternalParsers(): readonly ExternalParserInfo[] {
        return Array.from(this.externalParsers.values());
    }

    /**
     * Check if a parser is registered.
     */
    hasParser(parserId: string): boolean {
        return this.registry.has(parserId);
    }

    // =========================================================================
    // Contribution Point Discovery
    // =========================================================================

    /**
     * Discover and load parsers from extension contribution points.
     *
     * Looks for `contributes.logicAppsMigrationAgent.parsers` in other extensions.
     */
    private async discoverContributedParsers(): Promise<void> {
        const contributions: {
            extension: vscode.Extension<unknown>;
            parser: ParserContribution;
        }[] = [];

        // Find all extensions with parser contributions
        for (const ext of vscode.extensions.all) {
            const packageJson = ext.packageJSON;
            const parserContributions = packageJson?.contributes?.logicAppsMigration?.parsers;

            if (Array.isArray(parserContributions)) {
                for (const parser of parserContributions) {
                    contributions.push({ extension: ext, parser });
                }
            }
        }

        // Load each contributed parser
        for (const { extension, parser } of contributions) {
            await this.loadContributedParser(extension, parser);
        }
    }

    /**
     * Load a single contributed parser from an extension.
     */
    private async loadContributedParser(
        extension: vscode.Extension<unknown>,
        contribution: ParserContribution
    ): Promise<void> {
        const parserId = `contrib-${extension.id}-${contribution.modulePath}`;

        // Skip if already loaded
        if (this.externalParsers.has(parserId)) {
            return;
        }

        try {
            // Activate the extension if needed
            if (!extension.isActive) {
                await extension.activate();
            }

            // Import the parser module
            // Note: This requires the extension to export the parser
            const exports = extension.exports as Record<string, unknown>;
            const parserClass = contribution.className
                ? (exports[contribution.className] as new () => IParser)
                : (exports.default as new () => IParser);

            if (!parserClass) {
                LoggingService.getInstance().warn(
                    `Parser contribution not found: ${extension.id}/${contribution.modulePath}`
                );
                return;
            }

            // Instantiate and register
            const parser = new parserClass();
            this.registerParser(parser, {
                id: parserId,
                priority: contribution.priority ?? 10,
            });

            LoggingService.getInstance().info('Loaded contributed parser', {
                extensionId: extension.id,
                parserId,
            });
        } catch (error) {
            LoggingService.getInstance().error(
                `Failed to load parser from ${extension.id}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Attempt to determine which extension is calling registerParser.
     * This is best-effort - may return undefined.
     */
    private getCallingExtension(): string | undefined {
        // Try to get extension ID from the call stack
        // This is a heuristic and may not always work
        try {
            const stack = new Error().stack;
            if (stack) {
                // Look for extension paths in the stack
                const extensionMatch = stack.match(/[/\\]\.vscode[/\\]extensions[/\\]([^/\\]+)/);
                if (extensionMatch) {
                    return extensionMatch[1];
                }
            }
        } catch {
            // Ignore errors
        }
        return undefined;
    }
}

// =============================================================================
// Extension API Export
// =============================================================================

/**
 * API exported to partner extensions.
 *
 * This interface is returned by the extension's activate function
 * and can be used by other extensions to register parsers.
 */
export interface logicAppsMigrationAgentAPI {
    /**
     * Extension version
     */
    readonly version: string;

    /**
     * Register a parser with the migration agent.
     * @param parser - Parser instance
     * @param options - Registration options
     */
    registerParser(parser: IParser, options?: ParserRegistrationOptions): ParserRegistrationResult;

    /**
     * Unregister a previously registered parser.
     * @param parserId - Parser ID returned from registerParser
     */
    unregisterParser(parserId: string): boolean;

    /**
     * Get the parser registry for advanced use cases.
     */
    getParserRegistry(): ParserRegistry;

    /**
     * Check if a parser is registered.
     */
    hasParser(parserId: string): boolean;

    /**
     * Get information about external parsers.
     */
    getExternalParsers(): readonly ExternalParserInfo[];
}

/**
 * Create the API object to export from the extension.
 *
 * @param version - Extension version
 * @returns API object for partner extensions
 */
export function createExtensionAPI(version: string): logicAppsMigrationAgentAPI {
    const loader = ParserPluginLoader.getInstance();

    return {
        version,

        registerParser(parser: IParser, options?: ParserRegistrationOptions) {
            return loader.registerParser(parser, options);
        },

        unregisterParser(parserId: string) {
            return loader.unregisterParser(parserId);
        },

        getParserRegistry() {
            return loader.getParserRegistry();
        },

        hasParser(parserId: string) {
            return loader.hasParser(parserId);
        },

        getExternalParsers() {
            return loader.getExternalParsers();
        },
    };
}
