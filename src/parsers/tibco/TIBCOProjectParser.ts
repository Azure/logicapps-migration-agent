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
            // BW5 style: tibco.xml at root
            if (fs.existsSync(path.join(filePath, 'tibco.xml'))) {
                return true;
            }
            // BW6 style: TIBCO.xml or module.bwm inside META-INF/
            if (this.findDescriptorPath(filePath) !== null) {
                return true;
            }
        }

        return false;
    }

    async detectVersion(inputPath: string): Promise<string | null> {
        const projectDir = this.resolveProjectDir(inputPath);
        const descriptorPath = this.findDescriptorPath(projectDir);

        if (!descriptorPath) {
            return null;
        }

        const content = await fs.promises.readFile(descriptorPath, 'utf-8').catch(() => null);
        if (!content) {
            return null;
        }

        // BW6 module descriptor
        if (path.basename(descriptorPath).toLowerCase() === 'module.bwm') {
            return '6.x';
        }

        if (/businessworks\s*6|\bbw6\b/i.test(content)) {
            return '6.x';
        }
        if (/businessworks\s*5|\bbw5\b/i.test(content)) {
            return '5.x';
        }

        // BW6 packaging namespace in TIBCO.xml
        if (/schemas\.tibco\.com\/tra\/model\/core\/PackagingModel/i.test(content)) {
            return '6.x';
        }

        return null;
    }

    async getProjectArtifacts(inputPath: string): Promise<DetectedFile[]> {
        const projectDir = this.resolveProjectDir(inputPath);
        const files: DetectedFile[] = [];

        await this.scanDirectory(projectDir, ['.process', '.bwp'], 'flow', files);
        await this.scanDirectory(projectDir, ['.xsd', '.wsdl'], 'schema', files);
        await this.scanDirectory(projectDir, ['.xsl', '.xslt'], 'map', files);
        await this.scanDirectory(
            projectDir,
            ['.sharedhttp', '.sharedjdbc', '.substvar', '.httpClientResource', '.httpConnResource', '.sslClientResource', '.keystoreProviderResource'],
            'config',
            files
        );

        // Also scan sibling module folder for BW6 application projects
        const parentDir = path.dirname(projectDir);
        const baseName = path.basename(projectDir);
        if (baseName.endsWith('.application')) {
            const moduleName = baseName.replace(/\.application$/, '');
            const moduleDir = path.join(parentDir, moduleName);
            if (fs.existsSync(moduleDir) && fs.statSync(moduleDir).isDirectory()) {
                await this.scanDirectory(moduleDir, ['.process', '.bwp'], 'flow', files);
                await this.scanDirectory(moduleDir, ['.xsd', '.wsdl'], 'schema', files);
                await this.scanDirectory(moduleDir, ['.xsl', '.xslt'], 'map', files);
                await this.scanDirectory(
                    moduleDir,
                    ['.sharedhttp', '.sharedjdbc', '.substvar', '.httpClientResource', '.httpConnResource', '.sslClientResource', '.keystoreProviderResource'],
                    'config',
                    files
                );
            }
        }

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
        const descriptorPath = this.findDescriptorPath(projectDir);

        this.reportProgress(options.onProgress, 1, 3, 'Reading TIBCO project descriptor');

        if (!descriptorPath) {
            errors.addError(
                ParseErrorCodes.PROJECT_NOT_FOUND,
                'No TIBCO project descriptor found (tibco.xml or META-INF/TIBCO.xml or META-INF/module.bwm)',
                { filePath: projectDir }
            );
            return null;
        }

        const descriptorContent = await this.readFile(descriptorPath, errors);
        if (!descriptorContent) {
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

    /**
     * Find the TIBCO project descriptor in a folder.
     * Supports BW5 (tibco.xml at root) and BW6 (META-INF/TIBCO.xml or META-INF/module.bwm).
     */
    private findDescriptorPath(projectDir: string): string | null {
        // BW5 style: tibco.xml at root
        const rootDescriptor = path.join(projectDir, 'tibco.xml');
        if (fs.existsSync(rootDescriptor)) {
            return rootDescriptor;
        }

        // BW6 style: TIBCO.xml in META-INF
        const metaInfDir = path.join(projectDir, 'META-INF');
        if (fs.existsSync(metaInfDir)) {
            // Check for TIBCO.xml (case-insensitive on Windows, explicit variants for cross-platform)
            for (const name of ['TIBCO.xml', 'tibco.xml', 'Tibco.xml']) {
                const candidate = path.join(metaInfDir, name);
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
            }

            // BW6 module descriptor
            const moduleBwm = path.join(metaInfDir, 'module.bwm');
            if (fs.existsSync(moduleBwm)) {
                return moduleBwm;
            }
        }

        return null;
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
