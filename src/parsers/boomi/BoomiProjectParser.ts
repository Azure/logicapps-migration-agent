/**
 * Dell Boomi Project Parser
 *
 * Parses a Boomi project folder (or its `migration-manifest.json`) and
 * discovers the Boomi components it contains.
 *
 * @module parsers/boomi/BoomiProjectParser
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IProjectParser, ArtifactSummary } from '../IParser';
import {
    ParseOptions,
    ParserCapabilities,
    DetectedFile,
    ParseErrorCodes,
    ProgressCallback,
} from '../types';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import { SourceFileType } from '../../ir/types/common';
import {
    BOOMI_MANIFEST_FILE,
    classifyBoomiFile,
    containsBoomiProcess,
    isBoomiManifest,
} from './BoomiComponentReader';
import { BoomiComponentKind } from './types';

const KIND_TO_FILE_TYPE: Record<BoomiComponentKind, SourceFileType> = {
    process: 'flow',
    connection: 'connector',
    operation: 'connector',
    map: 'map',
    profile: 'schema',
    'trading-partner': 'b2b',
    script: 'project',
    'process-property': 'config',
    'cross-reference': 'config',
    api: 'api-spec',
    environment: 'config',
    'test-asset': 'config',
    component: 'config',
    manifest: 'project',
};

interface BoomiManifest {
    application?: string;
    sourcePlatform?: string;
    version?: string;
    synthetic?: boolean;
    processes?: Record<string, string[]>;
    connections?: string[];
    maps?: string[];
    migrationHints?: Record<string, string>;
    /** Alternative name for `migrationHints` used by some corpora */
    migrationTargets?: Record<string, string>;
    /** B2B transaction sets handled by the project (e.g. X12 850, 810) */
    transactions?: string[];
    features?: string[];
    warning?: string;
}

export class BoomiProjectParser extends AbstractParser implements IProjectParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.json'],
        fileTypes: ['project'],
        supportsFolder: true,
        description: 'Parses Dell Boomi project manifests and discovers Boomi components',
    };

    override canParse(filePath: string): boolean {
        if (path.basename(filePath).toLowerCase() === BOOMI_MANIFEST_FILE) {
            return classifyBoomiFile(filePath) === 'manifest';
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            const manifest = path.join(filePath, BOOMI_MANIFEST_FILE);
            if (fs.existsSync(manifest)) {
                return classifyBoomiFile(manifest) === 'manifest';
            }
            return containsBoomiProcess(filePath);
        }

        return false;
    }

    async detectVersion(inputPath: string): Promise<string | null> {
        const manifest = await this.readManifest(this.resolveProjectDir(inputPath));
        if (manifest?.version) {
            return manifest.version;
        }
        return manifest || this.canParse(this.resolveProjectDir(inputPath)) ? 'AtomSphere' : null;
    }

    async getProjectArtifacts(inputPath: string): Promise<DetectedFile[]> {
        const projectDir = this.resolveProjectDir(inputPath);
        const files: DetectedFile[] = [];
        await this.scanDirectory(projectDir, files, 0);
        return files.sort((a, b) => a.path.localeCompare(b.path));
    }

    async getProjectDependencies(inputPath: string): Promise<string[]> {
        const manifest = await this.readManifest(this.resolveProjectDir(inputPath));
        return manifest?.connections ?? [];
    }

    protected async doParse(
        inputPath: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        const projectDir = this.resolveProjectDir(inputPath);
        this.reportProgress(options.onProgress, 1, 3, 'Reading Boomi project manifest');

        const manifestPath = path.join(projectDir, BOOMI_MANIFEST_FILE);
        let manifest: BoomiManifest | null = null;
        if (fs.existsSync(manifestPath)) {
            const content = await this.readFile(manifestPath, errors);
            if (!content) {
                return null;
            }
            try {
                manifest = JSON.parse(content) as BoomiManifest;
            } catch (error) {
                errors.addError(
                    ParseErrorCodes.INVALID_JSON,
                    `Invalid Boomi manifest: ${String(error)}`,
                    {
                        filePath: manifestPath,
                    }
                );
                return null;
            }
        } else if (!this.canParse(projectDir)) {
            errors.addError(
                ParseErrorCodes.PROJECT_NOT_FOUND,
                'No Boomi project found (migration-manifest.json or Boomi process components)',
                { filePath: projectDir }
            );
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Discovering Boomi components');
        const artifacts = await this.getProjectArtifacts(projectDir);
        const counts: Record<string, number> = {};
        for (const artifact of artifacts) {
            const kind = classifyBoomiFile(artifact.path) || 'other';
            counts[kind] = (counts[kind] || 0) + 1;
        }

        this.reportProgress(options.onProgress, 3, 3, 'Converting Boomi project to IR');
        const projectName = manifest?.application || path.basename(projectDir);
        const ir = createEmptyIRDocument(`boomi-project-${projectName}`, projectName, 'boomi');

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    platformVersion: manifest?.version || 'AtomSphere',
                    application: projectName,
                    artifact: {
                        ...ir.metadata.source.artifact,
                        name: projectName,
                        type: 'project',
                        filePath: fs.existsSync(manifestPath) ? manifestPath : projectDir,
                        fileType: 'json',
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    notes: [
                        `Boomi project discovered with ${artifacts.length} component file(s).`,
                        ...(manifest?.synthetic
                            ? [
                                  'Manifest marks this corpus as synthetic (not native AtomSphere export XML).',
                              ]
                            : []),
                        ...(manifest?.warning ? [manifest.warning] : []),
                    ],
                },
            },
            extensions: {
                ...ir.extensions,
                boomi: {
                    componentType: 'project',
                    application: projectName,
                    ...(manifest?.sourcePlatform
                        ? { sourcePlatform: manifest.sourcePlatform }
                        : {}),
                    synthetic: manifest?.synthetic === true,
                    artifactCount: artifacts.length,
                    componentCounts: counts,
                    processes: manifest?.processes ?? {},
                    connections: manifest?.connections ?? [],
                    maps: manifest?.maps ?? [],
                    migrationHints: {
                        ...(manifest?.migrationTargets ?? {}),
                        ...(manifest?.migrationHints ?? {}),
                    },
                    ...(manifest?.transactions ? { transactions: manifest.transactions } : {}),
                    ...(manifest?.features ? { features: manifest.features } : {}),
                },
            },
        };
    }

    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const projectDir = this.resolveProjectDir(filePath);
        const artifacts = await this.getProjectArtifacts(projectDir);
        return {
            name: path.basename(projectDir),
            type: 'project',
            elementCount: artifacts.length,
            description: `Boomi project with ${artifacts.length} component file(s)`,
        };
    }

    protected override getFileType(_extension: string): SourceFileType {
        return 'project';
    }

    private async readManifest(projectDir: string): Promise<BoomiManifest | null> {
        const manifestPath = path.join(projectDir, BOOMI_MANIFEST_FILE);
        const content = await fs.promises.readFile(manifestPath, 'utf-8').catch(() => null);
        if (!content) {
            return null;
        }
        try {
            const manifest = JSON.parse(content) as BoomiManifest;
            return isBoomiManifest(manifestPath) ? manifest : null;
        } catch {
            return null;
        }
    }

    private resolveProjectDir(inputPath: string): string {
        if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
            return inputPath;
        }
        return path.dirname(inputPath);
    }

    private async scanDirectory(
        dirPath: string,
        output: DetectedFile[],
        depth: number
    ): Promise<void> {
        if (depth > 8) {
            return;
        }
        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (!this.shouldSkipDirectory(entry.name)) {
                    await this.scanDirectory(fullPath, output, depth + 1);
                }
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            const kind = classifyBoomiFile(fullPath);
            if (!kind || kind === 'manifest') {
                continue;
            }
            const stat = await fs.promises.stat(fullPath);
            output.push({
                path: fullPath,
                type: KIND_TO_FILE_TYPE[kind],
                platform: 'boomi',
                size: stat.size,
                lastModified: stat.mtime,
            });
        }
    }
}
