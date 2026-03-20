/**
 * Artifact Scanner
 *
 * Scans source folders for integration artifacts and coordinates parsing
 * using platform-specific parsers. Provides progress reporting and
 * handles errors gracefully.
 *
 * @module stages/discovery/ArtifactScanner
 */

import * as vscode from 'vscode';
import { UserPrompts } from '../../constants/UserMessages';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { ParserFactory } from '../../parsers/ParserFactory';
import { defaultParserRegistry } from '../../parsers/ParserRegistry';
import { IParser } from '../../parsers/IParser';
import {
    ScanOptions,
    ScanResult,
    ScanProgress,
    ScanProgressCallback,
    ParsedArtifact,
    ParseErrorInfo,
    SkippedFile,
    ArtifactCategory,
} from './types';
import { SourcePlatformType } from '../../ir/types/common';
import { IRDocument, createEmptyIRDocument } from '../../ir/types/document';

// =============================================================================
// Deterministic ID Generation
// =============================================================================

/**
 * Generate a deterministic UUID-v4-formatted ID from a relative source path.
 * Same file path always produces the same ID, even across re-scans and
 * VS Code restarts. This keeps flow group references, planning caches,
 * and IR caches stable.
 *
 * The output is formatted as a UUID for consistency with the rest of the
 * codebase: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.
 */
function deterministicId(relativePath: string): string {
    const hash = crypto
        .createHash('sha256')
        .update(relativePath.replace(/\\/g, '/').toLowerCase())
        .digest('hex');

    // Format as UUID v4 — set version nibble (4) and variant bits (8/9/a/b)
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16),
        ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20),
        hash.substring(20, 32),
    ].join('-');
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default exclude patterns.
 */
const DEFAULT_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/bin/**',
    '**/obj/**',
    '**/dist/**',
    '**/build/**',
    '**/.vs/**',
    '**/packages/**',
    '**/out/**',
    '**/target/**',
];

/**
 * Default maximum file size (10MB).
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Map file extensions to artifact categories.
 */
const EXTENSION_TO_CATEGORY: Record<string, ArtifactCategory> = {
    '.odx': 'orchestration',
    '.btm': 'map',
    '.xsd': 'schema',
    '.btp': 'pipeline',
    '.btproj': 'custom-code',
    '.dwl': 'dataweave',
    '.esql': 'esql',
    '.msgflow': 'flow',
    '.subflow': 'flow',
    '.process': 'process',
    '.bwp': 'process',
    '.raml': 'api',
    '.yaml': 'config',
    '.json': 'config',
    '.xml': 'config',
    '.properties': 'config',
    '.wsdl': 'schema',
    '.sql': 'config',
    // BizTalk-specific extensions
    '.asmx': 'legacy-webservice',
    '.hidx': 'hidx',
    '.brl': 'ruleset',
    '.bre': 'ruleset',
    // Custom code and assemblies
    '.cs': 'custom-code',
    '.vb': 'custom-code',
    '.java': 'custom-code',
    '.csproj': 'custom-code',
    '.vbproj': 'custom-code',
    '.dll': 'custom-code',
    '.jar': 'custom-code',
};

/**
 * Extensions that are dependency files (no parser required).
 * These create lightweight inventory entries without full IR parsing.
 */
const CUSTOM_CODE_EXTENSIONS = new Set([
    '.cs',
    '.vb',
    '.java',
    '.csproj',
    '.vbproj',
    '.dll',
    '.jar',
]);

// =============================================================================
// BizTalk XML Path Heuristics
// =============================================================================

/**
 * Classify a generic .xml file into a more specific BizTalk category
 * based on its relative path within the source project.
 *
 * Returns the refined ArtifactCategory, or 'config' if no heuristic matches.
 */
function classifyXmlByPath(relativePath: string): ArtifactCategory {
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();

    // B2B / TPM — Trading Partner Management, EDI, AS2, agreements, partner profiles
    if (
        /\btpm\b/.test(normalized) ||
        /\bpartner\s?data\b/.test(normalized) ||
        /\bagreement/.test(normalized) ||
        /\bedi\b/.test(normalized) ||
        /\bas2\b/.test(normalized) ||
        /\bx12\b/.test(normalized) ||
        /\bedifact\b/.test(normalized) ||
        /\bparties\b/.test(normalized) ||
        (/\bprofiles?\b/.test(normalized) && /\bpartner/.test(normalized))
    ) {
        return 'b2b';
    }

    // BRE Rulesets & Vocabularies
    if (
        /\brule/i.test(normalized) ||
        /\bvocabulari?e?s?\b/.test(normalized) ||
        /\bpolicies?\b/.test(normalized) ||
        /\bbre\b/.test(normalized)
    ) {
        return 'ruleset';
    }

    // Legacy web services
    if (/\.asmx$/i.test(normalized) || /\bwebservice/i.test(normalized)) {
        return 'legacy-webservice';
    }

    // Sample/test messages — keep in config (not a migration artifact)
    if (/\bsample/i.test(normalized) || /\btestmessage/i.test(normalized)) {
        return 'config';
    }

    return 'config';
}

// =============================================================================
// Artifact Scanner
// =============================================================================

/**
 * Scanner for discovering and parsing integration artifacts.
 */
export class ArtifactScanner implements vscode.Disposable {
    private static instance: ArtifactScanner | undefined;

    private readonly logger = LoggingService.getInstance();
    private readonly parserFactory: ParserFactory;

    private currentScan:
        | {
              cancelled: boolean;
              startTime: number;
          }
        | undefined;

    private constructor() {
        this.parserFactory = new ParserFactory(defaultParserRegistry);
    }

    /**
     * Get the singleton instance.
     */
    public static getInstance(): ArtifactScanner {
        if (!ArtifactScanner.instance) {
            ArtifactScanner.instance = new ArtifactScanner();
        }
        return ArtifactScanner.instance;
    }

    /**
     * Scan a folder for artifacts.
     *
     * @param folderPath - Path to scan
     * @param platform - Detected platform
     * @param options - Scan options
     * @param progressCallback - Progress callback
     */
    public async scan(
        folderPath: string,
        platform: SourcePlatformType,
        options?: ScanOptions,
        progressCallback?: ScanProgressCallback
    ): Promise<ScanResult> {
        this.logger.info('Starting artifact scan', { folderPath, platform });

        const startTime = Date.now();
        this.currentScan = { cancelled: false, startTime };

        const mergedOptions: Required<ScanOptions> = {
            excludePatterns: options?.excludePatterns || DEFAULT_EXCLUDE_PATTERNS,
            maxDepth: options?.maxDepth ?? 10,
            respectGitignore: options?.respectGitignore ?? true,
            maxFileSizeBytes: options?.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE,
            cancellationToken: options?.cancellationToken ?? { isCancellationRequested: false },
        };

        const parsedArtifacts: ParsedArtifact[] = [];
        const parseErrors: ParseErrorInfo[] = [];
        const skippedFiles: SkippedFile[] = [];

        try {
            // Phase 1: Discover all files
            this.reportProgress(progressCallback, {
                currentFile: '',
                totalFiles: 0,
                processedFiles: 0,
                percentage: 0,
                phase: 'scanning',
            });

            const discoveredFiles = await this.discoverFiles(folderPath, platform, mergedOptions);

            this.logger.info('File discovery complete', { totalFiles: discoveredFiles.length });

            // Phase 2: Parse files
            const totalFiles = discoveredFiles.length;
            let processedFiles = 0;

            for (const file of discoveredFiles) {
                // Check cancellation
                if (
                    this.currentScan.cancelled ||
                    mergedOptions.cancellationToken.isCancellationRequested
                ) {
                    this.logger.info('Scan cancelled');
                    break;
                }

                processedFiles++;
                const relativePath = path.relative(folderPath, file.path);

                this.reportProgress(progressCallback, {
                    currentFile: relativePath,
                    totalFiles,
                    processedFiles,
                    percentage: Math.round((processedFiles / totalFiles) * 100),
                    phase: 'parsing',
                });

                // Check file size
                try {
                    const stat = await fs.promises.stat(file.path);
                    if (stat.size > mergedOptions.maxFileSizeBytes) {
                        skippedFiles.push({
                            filePath: relativePath,
                            reason: 'too-large',
                            details: `File size ${(stat.size / 1024 / 1024).toFixed(2)}MB exceeds limit`,
                        });
                        continue;
                    }
                } catch {
                    continue;
                }

                // Get parser for file
                const ext = path.extname(file.path).toLowerCase();
                const parser = file.parser || this.parserFactory.getParserForFile(file.path);
                if (!parser) {
                    // Custom code files (.cs, .vb, .java, .dll, .jar) don't need a
                    // parser — create a lightweight inventory entry so they appear
                    // in the inventory under the "Custom Code & Assemblies" category.
                    if (CUSTOM_CODE_EXTENSIONS.has(ext)) {
                        const depArtifact = this.createDependencyArtifact(file.path, folderPath);
                        if (depArtifact) {
                            parsedArtifacts.push(depArtifact);
                        }
                        continue;
                    }

                    // No parser available — create an "other" inventory entry
                    // so every file in the source folder is visible in the tree.
                    const category: ArtifactCategory = EXTENSION_TO_CATEGORY[ext] || 'other';
                    const otherArtifact = this.createOtherArtifact(file.path, folderPath, category);
                    if (otherArtifact) {
                        parsedArtifacts.push(otherArtifact);
                    }
                    continue;
                }

                // Parse the file
                try {
                    const result = await parser.parse(file.path);

                    if (result.success && result.ir) {
                        const artifact = this.createParsedArtifact(
                            file.path,
                            folderPath,
                            result.ir,
                            parser
                        );
                        parsedArtifacts.push(artifact);

                        // Note: Warnings are captured in the artifact's IR metadata,
                        // not as separate error entries to avoid duplication
                    } else {
                        // Parse failed
                        const errorMessage = result.errors?.[0]?.message || 'Unknown parse error';
                        parseErrors.push({
                            filePath: relativePath,
                            message: errorMessage,
                            code: result.errors?.[0]?.code,
                            line: result.errors?.[0]?.line,
                            column: result.errors?.[0]?.column,
                            recoverable: false,
                        });
                    }
                } catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error));
                    this.logger.warn('Error parsing file', {
                        file: relativePath,
                        error: err.message,
                    });
                    parseErrors.push({
                        filePath: relativePath,
                        message: err.message,
                        recoverable: false,
                    });
                }
            }

            // Post-parse: let platform-specific parsers enrich IR data across artifacts
            this.runPostEnrichment(parsedArtifacts, platform);

            const durationMs = Date.now() - startTime;

            this.logger.info('Artifact scan complete', {
                totalFiles: discoveredFiles.length,
                parsed: parsedArtifacts.length,
                errors: parseErrors.length,
                skipped: skippedFiles.length,
                durationMs,
            });

            return {
                platform,
                sourcePath: folderPath,
                totalFilesScanned: discoveredFiles.length,
                parsedArtifacts,
                parseErrors,
                skippedFiles,
                durationMs,
                completedAt: new Date().toISOString(),
            };
        } finally {
            this.currentScan = undefined;
        }
    }

    /**
     * Scan with VS Code progress dialog.
     */
    public async scanWithProgress(
        folderPath: string,
        platform: SourcePlatformType,
        options?: ScanOptions
    ): Promise<ScanResult> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: UserPrompts.PROGRESS_SCANNING_ARTIFACTS,
                cancellable: true,
            },
            async (progress, token) => {
                const cancellationToken = {
                    get isCancellationRequested() {
                        return token.isCancellationRequested;
                    },
                };

                return this.scan(
                    folderPath,
                    platform,
                    { ...options, cancellationToken },
                    (scanProgress) => {
                        progress.report({
                            message: `${scanProgress.phase}: ${scanProgress.currentFile}`,
                            increment:
                                scanProgress.processedFiles === 1
                                    ? 0
                                    : (1 / scanProgress.totalFiles) * 100,
                        });
                    }
                );
            }
        );
    }

    /**
     * Cancel the current scan.
     */
    public cancelScan(): void {
        if (this.currentScan) {
            this.currentScan.cancelled = true;
            this.logger.info('Scan cancellation requested');
        }
    }

    /**
     * Check if a scan is in progress.
     */
    public isScanning(): boolean {
        return this.currentScan !== undefined;
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    /**
     * Run post-parse enrichment hooks from all parsers that implement them.
     *
     * Each parser may optionally define `postEnrich()` to cross-reference
     * artifacts and enrich IR data after all parsing is complete.
     */
    private runPostEnrichment(
        parsedArtifacts: ParsedArtifact[],
        platform: SourcePlatformType
    ): void {
        const parsers = this.parserFactory.getParsersForPlatform(platform);
        const seen = new Set<string>();

        for (const parser of parsers) {
            // Deduplicate — only call postEnrich once per parser class
            const key = parser.constructor.name;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);

            if (typeof parser.postEnrich === 'function') {
                parser.postEnrich(parsedArtifacts, this.logger);
            }
        }
    }

    /**
     * Discover all parseable files in a folder.
     */
    private async discoverFiles(
        folderPath: string,
        platform: SourcePlatformType,
        options: Required<ScanOptions>
    ): Promise<{ path: string; parser?: IParser }[]> {
        const files: { path: string; parser?: IParser }[] = [];

        // Get parsers for platform
        const platformParsers = this.parserFactory.getParsersForPlatform(platform);

        // Get all supported file patterns
        const supportedExtensions = new Set<string>();
        for (const parser of platformParsers) {
            for (const ext of parser.capabilities.fileExtensions || []) {
                supportedExtensions.add(ext.toLowerCase());
            }
        }

        // Also add common extensions
        supportedExtensions.add('.xml');
        supportedExtensions.add('.xsd');
        supportedExtensions.add('.json');
        supportedExtensions.add('.properties');
        supportedExtensions.add('.wsdl');
        supportedExtensions.add('.sql');

        // BizTalk-specific extensions
        supportedExtensions.add('.asmx');
        supportedExtensions.add('.hidx');
        supportedExtensions.add('.brl');
        supportedExtensions.add('.bre');

        // Add custom code file extensions so they are discovered
        for (const ext of CUSTOM_CODE_EXTENSIONS) {
            supportedExtensions.add(ext);
        }

        // Recursively scan folder
        await this.scanDirectory(
            folderPath,
            folderPath,
            supportedExtensions,
            platformParsers,
            files,
            0,
            options
        );

        files.sort((a, b) => a.path.localeCompare(b.path));

        return files;
    }

    private async scanDirectory(
        rootPath: string,
        currentPath: string,
        supportedExtensions: Set<string>,
        parsers: IParser[],
        files: { path: string; parser?: IParser }[],
        depth: number,
        options: Required<ScanOptions>
    ): Promise<void> {
        if (depth > options.maxDepth) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
            entries.sort((a, b) => a.name.localeCompare(b.name));

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                const relativePath = path.relative(rootPath, fullPath);

                // Check exclude patterns
                if (this.matchesExcludePattern(relativePath, options.excludePatterns)) {
                    continue;
                }

                if (entry.isFile()) {
                    // Discover ALL files — parser lookup happens later
                    const parser = parsers.find((p) => p.canParse(fullPath));
                    files.push({ path: fullPath, parser });
                } else if (entry.isDirectory()) {
                    // Skip hidden directories
                    if (entry.name.startsWith('.')) {
                        continue;
                    }
                    await this.scanDirectory(
                        rootPath,
                        fullPath,
                        supportedExtensions,
                        parsers,
                        files,
                        depth + 1,
                        options
                    );
                }
            }
        } catch (error) {
            this.logger.warn('Error scanning directory', {
                path: currentPath,
                error: String(error),
            });
        }
    }

    private matchesExcludePattern(relativePath: string, patterns: string[]): boolean {
        const normalizedPath = relativePath.replace(/\\/g, '/');

        for (const pattern of patterns) {
            // Convert glob to regex
            // Use a placeholder for ** to avoid the subsequent * replacement corrupting .*
            let regexPattern = pattern
                .replace(/\*\*/g, '\0GLOBSTAR\0')
                .replace(/\*/g, '[^/]*')
                .replace(/\0GLOBSTAR\0/g, '.*')
                .replace(/\//g, '[\\\\/]');

            // Anchor: if pattern starts with .*[\\/] (from **/) make the leading
            // part optional so it also matches paths that begin with the directory
            // name (e.g. "target/..." matches both **/target/** and target/**)
            if (regexPattern.startsWith('.*[\\\\/]')) {
                regexPattern = '(.*[\\\\/])?' + regexPattern.slice('.*[\\\\/]'.length);
            }

            if (new RegExp(regexPattern).test(normalizedPath)) {
                return true;
            }
        }

        return false;
    }

    private createParsedArtifact(
        filePath: string,
        rootPath: string,
        ir: IRDocument,
        parser: IParser
    ): ParsedArtifact {
        const relativePath = path.relative(rootPath, filePath);
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath, ext);

        // Get file stats
        let fileSize = 0;
        let lastModified = new Date().toISOString();
        try {
            const stat = fs.statSync(filePath);
            fileSize = stat.size;
            lastModified = stat.mtime.toISOString();
        } catch {
            // Ignore stat errors
        }

        // Determine category
        // Use parser's declared file type if available, otherwise fall back to extension mapping
        let category: ArtifactCategory;
        if (
            parser.capabilities.fileTypes &&
            parser.capabilities.fileTypes.length > 0 &&
            parser.capabilities.fileTypes[0] !== 'config'
        ) {
            // Use parser's declared type (e.g., 'binding', 'orchestration')
            category = parser.capabilities.fileTypes[0] as ArtifactCategory;
        } else {
            // Fall back to extension-based mapping
            category = EXTENSION_TO_CATEGORY[ext] || 'other';
        }

        // Refine generic .xml classification using path heuristics
        if (category === 'config' && ext === '.xml') {
            category = classifyXmlByPath(relativePath);
        }

        // Normalize project artifacts into custom-code for discovery taxonomy
        if (category === 'project') {
            category = 'custom-code';
        }

        return {
            id: deterministicId(relativePath),
            name: ir.metadata?.name || fileName,
            type: category,
            sourcePath: relativePath,
            absolutePath: filePath,
            ir,
            fileSize,
            lastModified,
            parserId: parser.capabilities.platform,
        };
    }

    /**
     * Create a lightweight ParsedArtifact for files that have no dedicated
     * parser. These appear in the inventory under their extension-mapped
     * category (or 'other') so every file in the source tree is visible.
     */
    private createOtherArtifact(
        filePath: string,
        rootPath: string,
        category: ArtifactCategory
    ): ParsedArtifact | undefined {
        const relativePath = path.relative(rootPath, filePath);
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath, ext);

        let fileSize = 0;
        let lastModified = new Date().toISOString();
        try {
            const stat = fs.statSync(filePath);
            fileSize = stat.size;
            lastModified = stat.mtime.toISOString();
        } catch {
            return undefined;
        }

        const ir = createEmptyIRDocument(`other-${fileName}`, fileName, 'biztalk');
        const enrichedIR: IRDocument = {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        ...ir.metadata.source.artifact,
                        name: fileName,
                        type: 'project',
                        filePath: relativePath,
                        fileType: ext.replace('.', ''),
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered',
                    notes: [`${ext.toUpperCase().replace('.', '')} file: ${relativePath}`],
                },
            },
        };

        return {
            id: deterministicId(relativePath),
            name: fileName,
            type: category,
            sourcePath: relativePath,
            absolutePath: filePath,
            ir: enrichedIR,
            fileSize,
            lastModified,
            parserId: 'discovery-scanner',
        };
    }

    /**
     * Create a lightweight ParsedArtifact for dependency files that have
     * no parser (.cs, .vb, .java, .dll, .jar). These appear in the
     * inventory under the "Dependencies" category without full IR parsing.
     */
    private createDependencyArtifact(
        filePath: string,
        rootPath: string
    ): ParsedArtifact | undefined {
        const relativePath = path.relative(rootPath, filePath);
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath, ext);

        let fileSize = 0;
        let lastModified = new Date().toISOString();
        try {
            const stat = fs.statSync(filePath);
            fileSize = stat.size;
            lastModified = stat.mtime.toISOString();
        } catch {
            return undefined;
        }

        const isBinary = ext === '.dll' || ext === '.jar';
        const isProjectFile = ext === '.csproj' || ext === '.vbproj';
        const langLabel =
            {
                '.cs': 'C#',
                '.vb': 'VB.NET',
                '.java': 'Java',
                '.csproj': 'C# Project',
                '.vbproj': 'VB.NET Project',
                '.dll': '.NET Assembly',
                '.jar': 'Java Archive',
            }[ext] || ext;

        // Create a minimal IR document for the dependency
        const ir = createEmptyIRDocument(`dep-${fileName}`, fileName, 'biztalk');

        // Enrich with dependency-specific metadata
        const enrichedIR: IRDocument = {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        ...ir.metadata.source.artifact,
                        name: fileName,
                        type: 'project',
                        filePath: relativePath,
                        fileType: ext.replace('.', ''),
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered',
                    notes: [
                        `${langLabel} dependency file: ${relativePath}`,
                        isBinary
                            ? 'Binary dependency — source code may need to be provided for migration'
                            : isProjectFile
                              ? 'Project file — defines build structure and references for the dependency library'
                              : 'Source code dependency — contains business logic that may need migration to Logic Apps',
                    ],
                },
            },
        };

        return {
            id: deterministicId(relativePath),
            name: fileName,
            type: 'custom-code',
            sourcePath: relativePath,
            absolutePath: filePath,
            ir: enrichedIR,
            fileSize,
            lastModified,
            parserId: 'dependency-scanner',
        };
    }

    private reportProgress(
        callback: ScanProgressCallback | undefined,
        progress: ScanProgress
    ): void {
        if (callback) {
            try {
                callback(progress);
            } catch {
                // Ignore callback errors
            }
        }
    }

    /**
     * Dispose of resources.
     */
    public dispose(): void {
        this.cancelScan();
        ArtifactScanner.instance = undefined;
    }
}
