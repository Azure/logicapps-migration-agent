/**
 * BizTalk Project Parser
 *
 * Parses BizTalk .btproj project files and coordinates parsing of all contained artifacts.
 *
 * @module parsers/biztalk/BizTalkProjectParser
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
import {
    BizTalkProjectInfo,
    BizTalkArtifactReferences,
    BizTalkAssemblyReference,
    BizTalkVersion,
} from './types';
import { parseXml, getElementText, getAllElements, getAttr } from '../utils/xml';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import { SourceFileType } from '../../ir/types/common';
import * as vscode from 'vscode';

// =============================================================================
// BizTalk Project Parser
// =============================================================================

/**
 * Parser for BizTalk .btproj project files.
 *
 * Parses the MSBuild-based project file and discovers all contained artifacts.
 */
export class BizTalkProjectParser extends AbstractParser implements IProjectParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.btproj'],
        fileTypes: ['project' as SourceFileType],
        supportsFolder: true,
        description: 'Parses BizTalk Server project files (.btproj)',
    };

    // =========================================================================
    // IProjectParser Implementation
    // =========================================================================

    /**
     * Detect BizTalk Server version from project file.
     */
    async detectVersion(projectPath: string): Promise<string | null> {
        const content = await fs.promises.readFile(projectPath, 'utf-8').catch(() => null);
        if (!content) {
            return null;
        }

        const doc = parseXml(content);
        if (!doc) {
            return null;
        }

        const rootElement = doc.documentElement;
        if (!rootElement) {
            return null;
        }

        // Check ToolsVersion attribute
        const toolsVersion = getAttr(rootElement, 'ToolsVersion');
        if (toolsVersion) {
            if (toolsVersion.startsWith('4.0')) {
                // Could be 2016 or 2020, need to check further
                const targetFramework = this.findPropertyValue(
                    rootElement,
                    'TargetFrameworkVersion'
                );
                if (targetFramework === 'v4.8' || targetFramework === 'v4.7.2') {
                    return '2020';
                }
                return '2016';
            }
        }

        // Check for BizTalk-specific properties
        const bizTalkVersion = this.findPropertyValue(rootElement, 'BizTalkProductVersion');
        if (bizTalkVersion) {
            if (bizTalkVersion.startsWith('3.13')) {
                return '2020';
            }
            if (bizTalkVersion.startsWith('3.12')) {
                return '2016';
            }
        }

        return 'unknown';
    }

    /**
     * Get all artifacts referenced by the project.
     */
    async getProjectArtifacts(projectPath: string): Promise<DetectedFile[]> {
        const projectInfo = await this.parseProjectFile(projectPath);
        if (!projectInfo) {
            return [];
        }

        const files: DetectedFile[] = [];
        const projectDir = path.dirname(projectPath);

        // Helper to add files
        const addFiles = (paths: readonly string[], fileType: SourceFileType) => {
            for (const filePath of paths) {
                const absolutePath = path.resolve(projectDir, filePath);
                if (fs.existsSync(absolutePath)) {
                    const stat = fs.statSync(absolutePath);
                    files.push({
                        path: absolutePath,
                        type: fileType,
                        platform: 'biztalk',
                        size: stat.size,
                        lastModified: stat.mtime,
                    });
                }
            }
        };

        // Add all artifact types
        addFiles(projectInfo.artifacts.orchestrations, 'orchestration');
        addFiles(projectInfo.artifacts.maps, 'map');
        addFiles(projectInfo.artifacts.schemas, 'schema');
        addFiles(projectInfo.artifacts.pipelines, 'pipeline');
        addFiles(projectInfo.artifacts.bindings, 'binding' as SourceFileType);

        return files;
    }

    /**
     * Get project dependencies (other projects).
     */
    async getProjectDependencies(projectPath: string): Promise<string[]> {
        const projectInfo = await this.parseProjectFile(projectPath);
        if (!projectInfo) {
            return [];
        }

        return [...projectInfo.projectReferences];
    }

    // =========================================================================
    // AbstractParser Implementation
    // =========================================================================

    /**
     * Check if this parser can handle the given path.
     */
    override canParse(filePath: string): boolean {
        // Can parse .btproj files or folders containing them
        if (filePath.toLowerCase().endsWith('.btproj')) {
            return true;
        }

        // Check if it's a folder with .btproj files
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            const files = fs.readdirSync(filePath);
            return files.some((f) => f.toLowerCase().endsWith('.btproj'));
        }

        return false;
    }

    /**
     * Recursively get supported files.
     */
    override async getSupportedFiles(folderPath: string): Promise<DetectedFile[]> {
        const files: DetectedFile[] = [];

        if (!fs.existsSync(folderPath)) {
            return files;
        }

        await this.scanForBizTalkFiles(folderPath, files);
        return files;
    }

    /**
     * Perform the actual parsing.
     */
    protected async doParse(
        inputPath: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        const stat = fs.statSync(inputPath);

        if (stat.isDirectory()) {
            // Parse all .btproj files in the folder
            return await this.parseFolder(inputPath, options, errors);
        } else if (inputPath.toLowerCase().endsWith('.btproj')) {
            // Parse single project file
            return await this.parseProject(inputPath, options, errors);
        }

        errors.addError(ParseErrorCodes.UNSUPPORTED_FORMAT, `Unsupported input: ${inputPath}`, {
            filePath: inputPath,
        });
        return null;
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const projectInfo = await this.parseProjectFile(filePath);
        if (!projectInfo) {
            return {
                name: path.basename(filePath, '.btproj'),
                type: 'project',
            };
        }

        const totalArtifacts =
            projectInfo.artifacts.orchestrations.length +
            projectInfo.artifacts.maps.length +
            projectInfo.artifacts.schemas.length +
            projectInfo.artifacts.pipelines.length;

        return {
            name: projectInfo.name,
            type: 'project',
            elementCount: totalArtifacts,
            references: projectInfo.projectReferences,
            description: `BizTalk ${projectInfo.bizTalkVersion} project with ${totalArtifacts} artifacts`,
        };
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Parse a folder containing BizTalk projects.
     */
    private async parseFolder(
        folderPath: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        // Find all .btproj files
        const projectFiles: string[] = [];
        await this.findProjectFiles(folderPath, projectFiles);

        if (projectFiles.length === 0) {
            errors.addWarning(
                ParseErrorCodes.PROJECT_NOT_FOUND,
                `No BizTalk project files (.btproj) found in: ${folderPath}`,
                { filePath: folderPath }
            );
            return null;
        }

        // Parse first project (main project assumed); multi-project solutions use separate parse calls
        return await this.parseProject(projectFiles[0], options, errors);
    }

    /**
     * Parse a single BizTalk project.
     */
    private async parseProject(
        projectPath: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        this.reportProgress(
            options.onProgress,
            1,
            5,
            `Parsing project file: ${path.basename(projectPath)}`
        );

        // Parse project file
        const projectInfo = await this.parseProjectFile(projectPath, errors);
        if (!projectInfo) {
            return null;
        }

        // Check cancellation
        if (this.isCancelled(options.cancellationToken)) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return null;
        }

        // Create base IR document
        const ir = this.createProjectIR(projectInfo);

        this.reportProgress(options.onProgress, 2, 5, 'Analyzing project structure');

        // Individual artifact parsers (orchestrations, maps, schemas) are invoked by the discovery stage
        // Project-level IR contains metadata and artifact references

        // Add artifact references to IR
        this.addArtifactPlaceholders(ir, projectInfo, errors);

        this.reportProgress(options.onProgress, 5, 5, 'Project parsing complete');

        return ir;
    }

    /**
     * Parse the .btproj XML file.
     */
    private async parseProjectFile(
        projectPath: string,
        errors?: ParseErrorAccumulator
    ): Promise<BizTalkProjectInfo | null> {
        const content = await fs.promises.readFile(projectPath, 'utf-8').catch((err) => {
            errors?.addError(
                ParseErrorCodes.FILE_READ_ERROR,
                `Failed to read project file: ${err.message}`,
                { filePath: projectPath, cause: err }
            );
            return null;
        });

        if (!content) {
            return null;
        }

        const doc = parseXml(content);
        if (!doc) {
            errors?.addError(ParseErrorCodes.INVALID_XML, 'Project file is not valid XML', {
                filePath: projectPath,
            });
            return null;
        }

        const rootElement = doc.documentElement;
        if (!rootElement || rootElement.tagName !== 'Project') {
            errors?.addError(
                ParseErrorCodes.INVALID_PROJECT,
                'Project file does not have expected MSBuild Project root element',
                { filePath: projectPath }
            );
            return null;
        }

        const projectDir = path.dirname(projectPath);

        // Extract project properties
        const assemblyName =
            this.findPropertyValue(rootElement, 'AssemblyName') ||
            path.basename(projectPath, '.btproj');
        const namespace = this.findPropertyValue(rootElement, 'RootNamespace') || assemblyName;
        const version =
            this.findPropertyValue(rootElement, 'FileVersion') ||
            this.findPropertyValue(rootElement, 'AssemblyVersion') ||
            '1.0.0.0';

        // Detect BizTalk version
        const bizTalkVersion =
            ((await this.detectVersion(projectPath)) as BizTalkVersion) || 'unknown';

        // Extract artifacts
        const artifacts = this.extractArtifacts(rootElement);

        // Extract project references
        const projectReferences = this.extractProjectReferences(rootElement, projectDir);

        // Extract assembly references
        const assemblyReferences = this.extractAssemblyReferences(rootElement);

        return {
            projectPath,
            name: assemblyName,
            namespace,
            version,
            bizTalkVersion,
            assemblyName,
            projectType: 'standard',
            projectDirectory: projectDir,
            artifacts,
            projectReferences,
            assemblyReferences,
        };
    }

    /**
     * Extract artifacts from project file.
     */
    private extractArtifacts(rootElement: Element): BizTalkArtifactReferences {
        const orchestrations: string[] = [];
        const maps: string[] = [];
        const schemas: string[] = [];
        const pipelines: string[] = [];
        const bindings: string[] = [];
        const others: string[] = [];

        // Find all ItemGroup elements
        const itemGroups = getAllElements(rootElement, 'ItemGroup');

        for (const itemGroup of itemGroups) {
            // Check for various item types
            const items = getAllElements(itemGroup, '*');

            for (const item of items) {
                const include = getAttr(item, 'Include');
                if (!include) {
                    continue;
                }

                const tagName = item.tagName;

                // Determine artifact type by tag name or extension
                const ext = path.extname(include).toLowerCase();

                if (tagName === 'BTXReference' || ext === '.odx') {
                    orchestrations.push(include);
                } else if (ext === '.btm') {
                    maps.push(include);
                } else if (ext === '.xsd') {
                    schemas.push(include);
                } else if (ext === '.btp') {
                    pipelines.push(include);
                } else if (include.toLowerCase().includes('binding') && ext === '.xml') {
                    bindings.push(include);
                } else if (tagName === 'Content' || tagName === 'None') {
                    // Check for binding files by name pattern
                    if (include.toLowerCase().includes('binding')) {
                        bindings.push(include);
                    } else {
                        others.push(include);
                    }
                }
            }
        }

        return {
            orchestrations,
            maps,
            schemas,
            pipelines,
            bindings,
            others,
        };
    }

    /**
     * Extract project references.
     */
    private extractProjectReferences(rootElement: Element, projectDir: string): string[] {
        const references: string[] = [];
        const projectRefElements = getAllElements(rootElement, 'ProjectReference');

        for (const refElement of projectRefElements) {
            const include = getAttr(refElement, 'Include');
            if (include) {
                references.push(path.resolve(projectDir, include));
            }
        }

        return references;
    }

    /**
     * Extract assembly references.
     */
    private extractAssemblyReferences(rootElement: Element): BizTalkAssemblyReference[] {
        const references: BizTalkAssemblyReference[] = [];
        const refElements = getAllElements(rootElement, 'Reference');

        for (const refElement of refElements) {
            const include = getAttr(refElement, 'Include');
            if (!include) {
                continue;
            }

            // Parse assembly identity
            const parts = include.split(',').map((p) => p.trim());
            const name = parts[0];

            let version: string | undefined;
            let publicKeyToken: string | undefined;

            for (const part of parts.slice(1)) {
                if (part.startsWith('Version=')) {
                    version = part.substring(8);
                } else if (part.startsWith('PublicKeyToken=')) {
                    publicKeyToken = part.substring(15);
                }
            }

            const hintPath = getElementText(refElement, 'HintPath');
            const isBizTalkAssembly =
                name.startsWith('Microsoft.BizTalk') ||
                name.startsWith('Microsoft.XLANGs') ||
                publicKeyToken === '31bf3856ad364e35';

            references.push({
                name,
                version,
                publicKeyToken,
                isBizTalkAssembly,
                hintPath,
            });
        }

        return references;
    }

    /**
     * Find a property value in PropertyGroup elements.
     */
    private findPropertyValue(rootElement: Element, propertyName: string): string | undefined {
        const propertyGroups = getAllElements(rootElement, 'PropertyGroup');

        for (const group of propertyGroups) {
            const text = getElementText(group, propertyName);
            if (text) {
                return text;
            }
        }

        return undefined;
    }

    /**
     * Create IR document from project info.
     */
    private createProjectIR(projectInfo: BizTalkProjectInfo): IRDocument {
        const ir = createEmptyIRDocument(
            `biztalk-project-${projectInfo.name}`,
            projectInfo.name,
            'biztalk'
        );

        // Update metadata with project information
        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    platformVersion: projectInfo.bizTalkVersion,
                    application: projectInfo.name,
                    artifact: {
                        name: projectInfo.name,
                        type: 'project',
                        filePath: projectInfo.projectPath,
                        fileType: '.btproj',
                    },
                },
            },
            extensions: {
                biztalk: {
                    projectName: projectInfo.name,
                    projectNamespace: projectInfo.namespace,
                    assemblyVersion: projectInfo.version,
                },
            },
        };
    }

    /**
     * Add artifact placeholders to IR.
     */
    private addArtifactPlaceholders(
        ir: IRDocument,
        projectInfo: BizTalkProjectInfo,
        _errors: ParseErrorAccumulator
    ): void {
        // Add notes about discovered artifacts
        const notes = [...ir.metadata.migration.notes];

        const artifactCounts = {
            orchestrations: projectInfo.artifacts.orchestrations.length,
            maps: projectInfo.artifacts.maps.length,
            schemas: projectInfo.artifacts.schemas.length,
            pipelines: projectInfo.artifacts.pipelines.length,
            bindings: projectInfo.artifacts.bindings.length,
        };

        notes.push(`Discovered artifacts: ${JSON.stringify(artifactCounts)}`);

        // Update the IR with metadata - using Object.assign for readonly property update
        Object.assign(ir, {
            metadata: {
                ...ir.metadata,
                migration: {
                    ...ir.metadata.migration,
                    notes,
                },
            },
        });
    }

    /**
     * Find all .btproj files in a folder recursively.
     */
    private async findProjectFiles(folderPath: string, result: string[]): Promise<void> {
        const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);

            if (entry.isDirectory()) {
                if (!this.shouldSkipDirectory(entry.name)) {
                    await this.findProjectFiles(fullPath, result);
                }
            } else if (entry.name.toLowerCase().endsWith('.btproj')) {
                result.push(fullPath);
            }
        }
    }

    /**
     * Scan for all BizTalk-related files.
     */
    private async scanForBizTalkFiles(folderPath: string, files: DetectedFile[]): Promise<void> {
        const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);

            if (entry.isDirectory()) {
                if (!this.shouldSkipDirectory(entry.name)) {
                    await this.scanForBizTalkFiles(fullPath, files);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                const fileType = this.getFileTypeForExtension(ext);

                if (fileType) {
                    const stat = await fs.promises.stat(fullPath);
                    files.push({
                        path: fullPath,
                        type: fileType,
                        platform: 'biztalk',
                        size: stat.size,
                        lastModified: stat.mtime,
                    });
                }
            }
        }
    }

    /**
     * Get file type for BizTalk extension.
     */
    private getFileTypeForExtension(ext: string): SourceFileType | null {
        switch (ext) {
            case '.btproj':
                return 'project' as SourceFileType;
            case '.odx':
                return 'orchestration';
            case '.btm':
                return 'map';
            case '.xsd':
                return 'schema';
            case '.btp':
                return 'pipeline';
            default:
                return null;
        }
    }
}
