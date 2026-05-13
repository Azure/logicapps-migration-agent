/**
 * TIBCO Project Parser
 *
 * Parses TIBCO BusinessWorks project descriptors (for example tibco.xml)
 * and discovers related project artifacts.
 *
 * @module parsers/tibco/TIBCOProjectParser
 */

import * as path from 'path';
import * as fs from 'fs';
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
import * as vscode from 'vscode';

export class TIBCOProjectParser extends AbstractParser implements IProjectParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'tibco',
        fileExtensions: ['.xml'],
        fileTypes: ['project'],
        supportsFolder: true,
        description: 'Parses TIBCO BusinessWorks project descriptors and discovers artifacts',
    };

    override canParse(filePath: string): boolean {
        const fileName = path.basename(filePath).toLowerCase();

        if (fileName === 'tibco.xml') {
            return true;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            return fs.existsSync(path.join(filePath, 'tibco.xml'));
        }

        return false;
    }

    async detectVersion(inputPath: string): Promise<string | null> {
        const projectDir = this.resolveProjectDir(inputPath);
        const descriptorPath = path.join(projectDir, 'tibco.xml');

        if (!fs.existsSync(descriptorPath)) {
            return null;
        }

        const content = await fs.promises.readFile(descriptorPath, 'utf-8').catch(() => null);
        if (!content) {
            return null;
        }

        if (/businessworks\s*6|\bbw6\b/i.test(content)) {
            return '6.x';
        }
        if (/businessworks\s*5|\bbw5\b/i.test(content)) {
            return '5.x';
        }

        return null;
    }

    async getProjectArtifacts(inputPath: string): Promise<DetectedFile[]> {
        const projectDir = this.resolveProjectDir(inputPath);
        const files: DetectedFile[] = [];

        await this.scanDirectory(projectDir, ['.process', '.bwp'], 'flow', files);
        await this.scanDirectory(projectDir, ['.xsd', '.wsdl'], 'schema', files);
        await this.scanDirectory(projectDir, ['.xsl', '.xslt'], 'map', files);
        await this.scanDirectory(projectDir, ['.sharedhttp', '.sharedjdbc'], 'config', files);

        return files;
    }

    async getProjectDependencies(_inputPath: string): Promise<string[]> {
        // Dependency graph resolution for TIBCO projects can be added later.
        return [];
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
        const descriptorPath = path.join(projectDir, 'tibco.xml');

        this.reportProgress(options.onProgress, 1, 3, 'Reading TIBCO project descriptor');

        const descriptorContent = fs.existsSync(descriptorPath)
            ? await this.readFile(descriptorPath, errors)
            : null;

        if (!descriptorContent) {
            errors.addError(
                ParseErrorCodes.PROJECT_NOT_FOUND,
                'tibco.xml project descriptor was not found',
                { filePath: projectDir }
            );
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Discovering TIBCO project artifacts');

        const artifacts = await this.getProjectArtifacts(projectDir);
        const projectName = path.basename(projectDir);
        const version = (await this.detectVersion(projectDir)) ?? undefined;

        this.reportProgress(options.onProgress, 3, 3, 'Converting TIBCO project to IR');

        const ir = createEmptyIRDocument(`tibco-project-${projectName}`, projectName, 'tibco');

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    platformVersion: version ?? '',
                    artifact: {
                        ...ir.metadata.source.artifact,
                        name: projectName,
                        type: 'project',
                        filePath: descriptorPath,
                        fileType: 'xml',
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    notes: [
                        `TIBCO project discovered with ${artifacts.length} related artifact(s).`,
                    ],
                },
            },
            extensions: {
                ...ir.extensions,
                tibco: {
                    descriptorFile: path.basename(descriptorPath),
                    artifactCount: artifacts.length,
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
            description: `TIBCO project with ${artifacts.length} related artifact(s)`,
        };
    }

    protected override getFileType(_extension: string): SourceFileType {
        return 'project';
    }

    private resolveProjectDir(inputPath: string): string {
        if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
            return inputPath;
        }
        return path.dirname(inputPath);
    }

    private async scanDirectory(
        dirPath: string,
        exts: string[],
        type: SourceFileType,
        output: DetectedFile[]
    ): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                if (!this.shouldSkipDirectory(entry.name)) {
                    await this.scanDirectory(fullPath, exts, type, output);
                }
                continue;
            }

            if (!entry.isFile()) {
                continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            if (!exts.includes(ext)) {
                continue;
            }

            const stat = await fs.promises.stat(fullPath);
            output.push({
                path: fullPath,
                type,
                platform: 'tibco',
                size: stat.size,
                lastModified: stat.mtime,
            });
        }
    }
}
