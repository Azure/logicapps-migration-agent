/**
 * MSI Extractor Service
 *
 * Extracts BizTalk MSI packages to their leaf artifacts using the real
 * BizTalk MSI structure discovered by testing against actual packages.
 *
 * ## Real BizTalk MSI structure
 *
 * ```
 * msiexec /a app.msi → staging/
 *   ├─ app.msi                         (copy of original — discarded)
 *   └─ {GUID}/
 *       ├─ ApplicationDefinition.adf   (XML manifest: maps ITEM~N.CAB → real filename + type)
 *       ├─ ITEM~0.CAB                  (outer compressed CAB wrapper)
 *       │    └─ item~0.cab             (NOT a CAB — actual artifact with .cab extension)
 *       ├─ ITEM~1.CAB → item~1.cab     (DLL, XML, etc.)
 *       └─ …
 * ```
 *
 * The outer `ITEM~N.CAB` files are real Windows Cabinet archives.
 * `expand ITEM~N.CAB` produces an inner `item~n.cab` which is the actual
 * artifact (DLL, binding XML, …) mis-named with a `.cab` extension.
 *
 * The `ApplicationDefinition.adf` XML contains `<Resource>` elements
 * with `ShortCabinetName` properties that map each CAB to its real
 * filename and BizTalk resource type.
 *
 * ### Extraction algorithm
 * 1. `msiexec /a` → staging dir
 * 2. Parse `ApplicationDefinition.adf` → build CAB-to-filename map
 * 3. `expand` each `ITEM~N.CAB` → inner `item~n.cab`
 * 4. Rename inner file to its real name from the ADF map
 * 5. Copy renamed files + ADF to clean output dir
 * 6. Remove entire staging dir
 *
 * Supports Windows only (uses `msiexec` and `expand`).
 *
 * @module services/MsiExtractorService
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { LoggingService } from './LoggingService';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of an MSI extraction run.
 */
export interface MsiExtractionResult {
    /** Whether extraction succeeded */
    readonly success: boolean;

    /** Directory containing the final extracted leaf files */
    readonly extractedPath: string;

    /** List of leaf files extracted (absolute paths) */
    readonly extractedFiles: string[];

    /** Parsed resource metadata from ApplicationDefinition.adf */
    readonly resources: AdfResource[];

    /** Number of extraction layers traversed (MSI → CAB → file) */
    readonly layersExtracted: number;

    /** Total duration in milliseconds */
    readonly durationMs: number;

    /** Error if extraction failed */
    readonly error?: string;
}

/**
 * A single resource entry parsed from ApplicationDefinition.adf.
 */
export interface AdfResource {
    /** BizTalk resource type, e.g. "System.BizTalk:BizTalkAssembly" */
    readonly type: string;

    /** Logical unique ID (assembly full name, app path, etc.) */
    readonly luid: string;

    /** The real filename for this resource (e.g. "MyApp.dll", "BindingInfo.xml") */
    readonly fileName: string;

    /** ShortCabinetName that maps to the CAB holding this resource */
    readonly shortCabinetName: string;

    /** Key from <File> element (e.g. "Assembly", "Binding") */
    readonly fileKey: string;

    /** Selected properties from the ADF (FullName, SourceLocation, etc.) */
    readonly properties: Record<string, string>;
}

/**
 * Progress callback for extraction.
 */
export interface MsiExtractionProgress {
    /** Current phase description */
    message: string;

    /** Percentage 0-100 (approximate) */
    percentage: number;
}

export type MsiExtractionProgressCallback = (progress: MsiExtractionProgress) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default timeout per shell command in ms. */
const COMMAND_TIMEOUT_MS = 120_000; // 2 minutes

/** Name of the BizTalk application definition file inside the MSI. */
const ADF_FILENAME = 'ApplicationDefinition.adf';

// =============================================================================
// MSI Extractor Service
// =============================================================================

export class MsiExtractorService implements vscode.Disposable {
    private static instance: MsiExtractorService | undefined;

    private readonly logger = LoggingService.getInstance();

    private constructor() {}

    /**
     * Get the singleton instance.
     */
    public static getInstance(): MsiExtractorService {
        if (!MsiExtractorService.instance) {
            MsiExtractorService.instance = new MsiExtractorService();
        }
        return MsiExtractorService.instance;
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Check whether the current platform supports MSI extraction.
     */
    public isPlatformSupported(): boolean {
        return process.platform === 'win32';
    }

    /**
     * Detect `.msi` files in a folder (non-recursive, top-level only).
     */
    public async findMsiFiles(folderPath: string): Promise<string[]> {
        try {
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
            return entries
                .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.msi'))
                .map((e) => path.join(folderPath, e.name));
        } catch {
            return [];
        }
    }

    /**
     * Extract a single BizTalk MSI file to its leaf artifacts.
     *
     * The extraction follows the real BizTalk MSI structure:
     * 1. `msiexec /a` to a staging directory
     * 2. Find the GUID sub-folder and parse `ApplicationDefinition.adf`
     * 3. `expand` each outer `ITEM~N.CAB` to get the inner artifact
     * 4. Rename each inner file to its real name using the ADF manifest
     * 5. Copy all leaf files + ADF to the clean output directory
     * 6. Remove the staging directory
     *
     * @param msiPath      Absolute path to the `.msi` file.
     * @param outputDir    Directory where clean leaf artifacts will be placed.
     * @param onProgress   Optional progress callback.
     */
    public async extractMsi(
        msiPath: string,
        outputDir: string,
        onProgress?: MsiExtractionProgressCallback
    ): Promise<MsiExtractionResult> {
        const startTime = Date.now();
        const mkResult = (partial: Partial<MsiExtractionResult>): MsiExtractionResult => ({
            success: false,
            extractedPath: outputDir,
            extractedFiles: [],
            resources: [],
            layersExtracted: 0,
            durationMs: Date.now() - startTime,
            ...partial,
        });

        if (!this.isPlatformSupported()) {
            return mkResult({ error: 'MSI extraction is only supported on Windows.' });
        }
        if (!fs.existsSync(msiPath)) {
            return mkResult({ error: `MSI file not found: ${msiPath}` });
        }

        this.logger.info('Starting MSI extraction', { msiPath, outputDir });
        onProgress?.({ message: 'Preparing extraction…', percentage: 0 });

        // Use a staging directory that will be fully removed at the end
        const stagingDir = path.join(outputDir, '__msi_staging__');

        try {
            await fs.promises.mkdir(outputDir, { recursive: true });
            await fs.promises.mkdir(stagingDir, { recursive: true });

            // ─── Step 1: Extract MSI ───────────────────────────────────
            onProgress?.({ message: 'Extracting MSI package…', percentage: 5 });
            await this.runMsiExec(msiPath, stagingDir);

            // ─── Step 2: Locate the GUID sub-folder ────────────────────
            onProgress?.({ message: 'Locating BizTalk resources…', percentage: 15 });
            const guidDir = await this.findGuidDirectory(stagingDir);
            if (!guidDir) {
                return mkResult({
                    error:
                        'MSI extraction did not produce the expected GUID sub-folder. ' +
                        'This may not be a BizTalk MSI package.',
                });
            }

            // ─── Step 3: Parse ApplicationDefinition.adf ───────────────
            onProgress?.({ message: 'Parsing application manifest…', percentage: 20 });
            const adfPath = path.join(guidDir, ADF_FILENAME);
            const resources = fs.existsSync(adfPath) ? await this.parseAdf(adfPath) : [];

            // Build map: upper-case ShortCabinetName → real filename
            const cabToFileName = new Map<string, string>();
            for (const res of resources) {
                if (res.shortCabinetName && res.fileName) {
                    cabToFileName.set(res.shortCabinetName.toUpperCase(), res.fileName);
                }
            }

            this.logger.info('ADF parsed', {
                resources: resources.length,
                mappings: cabToFileName.size,
            });

            // ─── Step 4: Expand each outer CAB and rename ──────────────
            const outerCabs = await this.findCabFiles(guidDir);
            const totalCabs = outerCabs.length;
            const extractedFiles: string[] = [];

            for (let i = 0; i < outerCabs.length; i++) {
                const cabPath = outerCabs[i];
                const cabName = path.basename(cabPath);

                const pct = 25 + Math.round((i / Math.max(totalCabs, 1)) * 55);
                onProgress?.({
                    message: `Expanding ${cabName} (${i + 1}/${totalCabs})…`,
                    percentage: pct,
                });

                // Expand the outer CAB → produces inner file(s)
                const cabExtractDir = path.join(guidDir, `__cab_${i}__`);
                try {
                    await this.runExpand(cabPath, cabExtractDir);
                } catch (err) {
                    this.logger.warn('Failed to expand CAB, skipping', {
                        cabPath,
                        error: err instanceof Error ? err.message : String(err),
                    });
                    continue;
                }

                // Collect inner files (usually exactly one per CAB)
                const innerFiles = await this.listFiles(cabExtractDir);

                for (const innerFile of innerFiles) {
                    // Determine the real filename from the ADF map
                    const realName =
                        cabToFileName.get(cabName.toUpperCase()) ??
                        this.inferFileNameFromMagic(innerFile);

                    const destPath = path.join(
                        outputDir,
                        this.deduplicateName(realName, outputDir, extractedFiles)
                    );
                    await fs.promises.copyFile(innerFile, destPath);
                    extractedFiles.push(destPath);

                    this.logger.debug('Extracted artifact', {
                        cabName,
                        realName,
                        destPath,
                        size: (await fs.promises.stat(innerFile)).size,
                    });
                }
            }

            // ─── Step 5: Copy the ADF itself into output ───────────────
            if (fs.existsSync(adfPath)) {
                const adfDest = path.join(outputDir, ADF_FILENAME);
                await fs.promises.copyFile(adfPath, adfDest);
                extractedFiles.push(adfDest);
            }

            // ─── Step 6: Clean up staging directory ────────────────────
            onProgress?.({ message: 'Cleaning up temporary files…', percentage: 90 });
            await this.removeDirectoryRecursive(stagingDir);

            onProgress?.({ message: 'Extraction complete.', percentage: 100 });

            this.logger.info('MSI extraction completed', {
                leafFiles: extractedFiles.length,
                durationMs: Date.now() - startTime,
            });

            return mkResult({
                success: true,
                extractedFiles,
                resources,
                layersExtracted: 2, // MSI → CAB → leaf
            });
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.logger.error('MSI extraction failed', error instanceof Error ? error : undefined, {
                msiPath,
            });

            // Best-effort cleanup
            if (fs.existsSync(stagingDir)) {
                await this.removeDirectoryRecursive(stagingDir).catch(() => undefined);
            }

            return mkResult({ error: errMsg });
        }
    }

    /**
     * Extract all MSI files found in a folder.
     * Each MSI is extracted into its own sub-directory named after the MSI.
     */
    public async extractAllMsiInFolder(
        folderPath: string,
        outputDir: string,
        onProgress?: MsiExtractionProgressCallback
    ): Promise<MsiExtractionResult[]> {
        const msiFiles = await this.findMsiFiles(folderPath);
        if (msiFiles.length === 0) {
            return [];
        }

        this.logger.info(`Found ${msiFiles.length} MSI file(s) in ${folderPath}`);
        const results: MsiExtractionResult[] = [];

        for (let i = 0; i < msiFiles.length; i++) {
            const msiFile = msiFiles[i];
            const msiName = path.basename(msiFile, '.msi');
            const msiOutputDir = path.join(outputDir, msiName);

            onProgress?.({
                message: `Extracting ${path.basename(msiFile)} (${i + 1}/${msiFiles.length})…`,
                percentage: Math.round((i / msiFiles.length) * 100),
            });

            const result = await this.extractMsi(msiFile, msiOutputDir, onProgress);
            results.push(result);
        }

        return results;
    }

    // =========================================================================
    // Private — MSI / CAB commands
    // =========================================================================

    /**
     * Extract an MSI via `msiexec /a` (administrative install).
     */
    private async runMsiExec(msiPath: string, targetDir: string): Promise<void> {
        const cmd = `msiexec /a "${msiPath}" /qn TARGETDIR="${targetDir}"`;
        this.logger.debug('Running msiexec', { cmd });
        await this.runShellCommand(cmd);
    }

    /**
     * Expand a CAB file via the Windows `expand` command.
     */
    private async runExpand(cabPath: string, targetDir: string): Promise<void> {
        await fs.promises.mkdir(targetDir, { recursive: true });
        const cmd = `expand "${cabPath}" -F:* "${targetDir}"`;
        this.logger.debug('Running expand', { cmd });
        await this.runShellCommand(cmd);
    }

    // =========================================================================
    // Private — ADF parsing
    // =========================================================================

    /**
     * Parse `ApplicationDefinition.adf` to extract resource metadata.
     *
     * The ADF is a small XML file so we use simple regex-based parsing
     * to avoid pulling in an XML library dependency.
     */
    private async parseAdf(adfPath: string): Promise<AdfResource[]> {
        const content = await fs.promises.readFile(adfPath, 'utf-8');
        const resources: AdfResource[] = [];

        // Match each <Resource ...>...</Resource> block
        const resourceRegex =
            /<Resource\s+Type="([^"]*)"(?:\s+Luid="([^"]*)")?[^>]*>([\s\S]*?)<\/Resource>/gi;
        let resourceMatch: RegExpExecArray | null;

        while ((resourceMatch = resourceRegex.exec(content)) !== null) {
            const type = resourceMatch[1];
            const luid = resourceMatch[2] ?? '';
            const body = resourceMatch[3];

            // Extract properties
            const properties: Record<string, string> = {};
            const propRegex = /<Property\s+Name="([^"]*)"(?:\s+Value="([^"]*)")?/gi;
            let propMatch: RegExpExecArray | null;
            while ((propMatch = propRegex.exec(body)) !== null) {
                properties[propMatch[1]] = propMatch[2] ?? '';
            }

            // Extract file info
            let fileName = '';
            let fileKey = '';
            const fileRegex = /<File\s+RelativePath="([^"]*)"(?:\s+Key="([^"]*)")?/i;
            const fileMatch = fileRegex.exec(body);
            if (fileMatch) {
                fileName = fileMatch[1];
                fileKey = fileMatch[2] ?? '';
            }

            // Fallback: use FullName property if no <File> element
            if (!fileName && properties['FullName']) {
                fileName = properties['FullName'];
            }

            const shortCabinetName = properties['ShortCabinetName'] ?? '';

            resources.push({
                type,
                luid,
                fileName,
                shortCabinetName,
                fileKey,
                properties,
            });
        }

        return resources;
    }

    // =========================================================================
    // Private — file system helpers
    // =========================================================================

    /**
     * Find the GUID-named sub-directory produced by msiexec.
     * It's the first directory in staging that is NOT the MSI copy itself.
     */
    private async findGuidDirectory(stagingDir: string): Promise<string | undefined> {
        const entries = await fs.promises.readdir(stagingDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                // GUID dirs look like: A5BE5841-05DA-442A-8D5F-72F3CE9F32C6
                // Accept any directory — the first one is usually the GUID folder
                return path.join(stagingDir, entry.name);
            }
        }
        return undefined;
    }

    /**
     * Find all `.CAB` files in a directory (non-recursive).
     */
    private async findCabFiles(dir: string): Promise<string[]> {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        return entries
            .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.cab'))
            .map((e) => path.join(dir, e.name));
    }

    /**
     * List all files in a directory (non-recursive).
     */
    private async listFiles(dir: string): Promise<string[]> {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            return entries.filter((e) => e.isFile()).map((e) => path.join(dir, e.name));
        } catch {
            return [];
        }
    }

    /**
     * When the ADF doesn't provide a filename mapping, infer the correct
     * extension from the file's magic bytes.
     */
    private inferFileNameFromMagic(filePath: string): string {
        const baseName = path.basename(filePath, path.extname(filePath));
        try {
            const fd = fs.openSync(filePath, 'r');
            const buf = Buffer.alloc(4);
            fs.readSync(fd, buf, 0, 4, 0);
            fs.closeSync(fd);

            const hex = buf.toString('hex').toUpperCase();

            // MZ → PE / DLL
            if (hex.startsWith('4D5A')) {
                return `${baseName}.dll`;
            }
            // <?xm → XML
            if (hex.startsWith('3C3F78')) {
                return `${baseName}.xml`;
            }
            // <Bin or other XML root
            if (hex.startsWith('3C')) {
                return `${baseName}.xml`;
            }
            // PK → ZIP
            if (hex.startsWith('504B')) {
                return `${baseName}.zip`;
            }
        } catch {
            // If we can't read the file, keep the original name
        }

        return path.basename(filePath);
    }

    /**
     * Recursively remove a directory.
     */
    private async removeDirectoryRecursive(dir: string): Promise<void> {
        if (!fs.existsSync(dir)) {
            return;
        }
        await fs.promises.rm(dir, { recursive: true, force: true });
    }

    /**
     * Produce a deduplicated filename when collisions exist.
     */
    private deduplicateName(baseName: string, targetDir: string, existingMoved: string[]): string {
        const existingNames = new Set(existingMoved.map((p) => path.basename(p).toLowerCase()));

        if (
            !existingNames.has(baseName.toLowerCase()) &&
            !fs.existsSync(path.join(targetDir, baseName))
        ) {
            return baseName;
        }

        const ext = path.extname(baseName);
        const nameWithoutExt = path.basename(baseName, ext);
        let counter = 1;
        let candidate: string;
        do {
            candidate = `${nameWithoutExt}_${counter}${ext}`;
            counter++;
        } while (
            existingNames.has(candidate.toLowerCase()) ||
            fs.existsSync(path.join(targetDir, candidate))
        );

        return candidate;
    }

    /**
     * Run a shell command and return stdout. Rejects on non-zero exit.
     */
    private runShellCommand(cmd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(
                cmd,
                {
                    timeout: COMMAND_TIMEOUT_MS,
                    windowsHide: true,
                    maxBuffer: 10 * 1024 * 1024, // 10 MB
                },
                (error, stdout, stderr) => {
                    if (error) {
                        const msg =
                            `Command failed: ${cmd}\n` +
                            `Error: ${error.message}\n` +
                            `Stderr: ${stderr}`;
                        this.logger.debug(msg);
                        reject(new Error(msg));
                    } else {
                        resolve(stdout);
                    }
                }
            );
        });
    }

    // =========================================================================
    // Dispose
    // =========================================================================

    public dispose(): void {
        MsiExtractorService.instance = undefined;
    }
}
