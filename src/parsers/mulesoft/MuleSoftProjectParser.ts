/**
 * MuleSoft Project Parser
 *
 * Parses MuleSoft Mule 4 project structure from pom.xml and mule-artifact.json.
 * Discovers all flow XMLs, DataWeave files, and API specifications in the project.
 *
 * A typical Mule 4 project structure (Maven-based):
 * ```
 * my-mule-app/
 * ├── pom.xml                      (Maven POM with mule-maven-plugin)
 * ├── mule-artifact.json           (Mule artifact descriptor)
 * └── src/
 *     └── main/
 *         ├── mule/                (Mule flow XML files)
 *         │   ├── main-flow.xml
 *         │   └── error-handler.xml
 *         └── resources/
 *             ├── api/             (RAML/OAS specs)
 *             ├── dwl/            (DataWeave files)
 *             └── application.properties
 * ```
 *
 * @module parsers/mulesoft/MuleSoftProjectParser
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
    MuleProjectInfo,
    MuleArtifactReferences,
    MuleDependency,
    MuleCloudHubConfig,
    MuleRuntimeVersion,
    MuleProjectType,
} from './types';
import {
    parseXml,
    getElementText,
    getAllElements,
    getFirstChildElement,
    findByPath,
} from '../utils/xml';
import { IRDocument, createEmptyIRDocument, IRGap } from '../../ir/types';
import { SourceFileType } from '../../ir/types/common';
import * as vscode from 'vscode';

// =============================================================================
// MuleSoft Project Parser
// =============================================================================

/**
 * Parser for MuleSoft Mule 4 projects.
 *
 * Detects MuleSoft projects by looking for:
 * - pom.xml with mule-maven-plugin
 * - mule-artifact.json
 *
 * Catalogs all artifacts in the project:
 * - Mule flow XMLs (src/main/mule/*.xml)
 * - DataWeave files (*.dwl)
 * - RAML specifications (*.raml)
 * - Property files (*.properties, *.yaml)
 */
export class MuleSoftProjectParser extends AbstractParser implements IProjectParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'mulesoft',
        fileExtensions: ['.xml'],
        fileTypes: ['project'],
        supportsFolder: true,
        description: 'Parses MuleSoft Mule 4 project structure from pom.xml',
    };

    // =========================================================================
    // canParse Override
    // =========================================================================

    override canParse(filePath: string): boolean {
        const fileName = path.basename(filePath).toLowerCase();

        // Detect by pom.xml, mule-artifact.json, or mule-project.xml (Mule 3 project descriptor)
        if (
            fileName === 'pom.xml' ||
            fileName === 'mule-artifact.json' ||
            fileName === 'mule-project.xml'
        ) {
            return true;
        }

        // Detect folder if it contains pom.xml or mule-artifact.json
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            return (
                fs.existsSync(path.join(filePath, 'pom.xml')) ||
                fs.existsSync(path.join(filePath, 'mule-artifact.json'))
            );
        }

        return false;
    }

    // =========================================================================
    // IProjectParser Implementation
    // =========================================================================

    /**
     * Detect the Mule runtime version.
     */
    async detectVersion(inputPath: string): Promise<string | null> {
        const projectDir = this.resolveProjectDir(inputPath);
        const pomPath = path.join(projectDir, 'pom.xml');

        if (!fs.existsSync(pomPath)) {
            return null;
        }

        const content = await fs.promises.readFile(pomPath, 'utf-8').catch(() => null);
        if (!content) {
            return null;
        }

        const doc = parseXml(content);
        if (!doc) {
            return null;
        }

        // Look for app.runtime property
        const properties = findByPath(doc, 'project/properties');
        if (properties) {
            const runtime = getElementText(properties, 'app.runtime');
            if (runtime) {
                return runtime;
            }
            const muleVersion = getElementText(properties, 'mule.version');
            if (muleVersion) {
                return muleVersion;
            }
        }

        return null;
    }

    /**
     * Get all artifacts referenced by the project.
     */
    async getProjectArtifacts(inputPath: string): Promise<DetectedFile[]> {
        const projectDir = this.resolveProjectDir(inputPath);
        const files: DetectedFile[] = [];

        // Scan src/main/mule for flow XMLs (Mule 4)
        const muleDir = path.join(projectDir, 'src', 'main', 'mule');
        await this.scanDirectory(muleDir, ['.xml'], 'flow', files);

        // Scan src/main/app for flow XMLs (Mule 3)
        const appDir = path.join(projectDir, 'src', 'main', 'app');
        await this.scanDirectory(appDir, ['.xml'], 'flow', files);

        // Scan for DataWeave files
        const resourcesDir = path.join(projectDir, 'src', 'main', 'resources');
        await this.scanDirectory(resourcesDir, ['.dwl'], 'transform', files);

        // Also scan mule dir for dwl
        await this.scanDirectory(muleDir, ['.dwl'], 'transform', files);

        // Scan for RAML files
        await this.scanDirectory(resourcesDir, ['.raml'], 'api-spec', files);

        // Scan for OpenAPI files
        await this.scanDirectory(resourcesDir, ['.yaml', '.yml', '.json'], 'api-spec', files);

        // Scan for property files (Mule 3: src/main/app, Mule 4: src/main/resources)
        await this.scanDirectory(appDir, ['.properties'], 'config', files);
        await this.scanDirectory(resourcesDir, ['.properties'], 'config', files);

        // Scan for WSDL files
        await this.scanDirectory(resourcesDir, ['.wsdl'], 'schema', files);

        // Scan for SQL files
        await this.scanDirectory(resourcesDir, ['.sql'], 'config', files);

        return files;
    }

    /**
     * Get project dependencies.
     */
    async getProjectDependencies(inputPath: string): Promise<string[]> {
        const projectDir = this.resolveProjectDir(inputPath);
        const pomPath = path.join(projectDir, 'pom.xml');

        if (!fs.existsSync(pomPath)) {
            return [];
        }

        const content = await fs.promises.readFile(pomPath, 'utf-8').catch(() => null);
        if (!content) {
            return [];
        }

        const doc = parseXml(content);
        if (!doc) {
            return [];
        }

        const deps = this.parseDependencies(doc);
        return deps.map((d) => `${d.groupId}:${d.artifactId}:${d.version || 'latest'}`);
    }

    // =========================================================================
    // AbstractParser Implementation
    // =========================================================================

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

        this.reportProgress(options.onProgress, 1, 4, 'Reading project files');

        // Read pom.xml
        const pomPath = path.join(projectDir, 'pom.xml');
        const pomContent = await this.readFile(pomPath, errors);

        // Read mule-artifact.json
        const artifactJsonPath = path.join(projectDir, 'mule-artifact.json');
        const artifactJsonContent = fs.existsSync(artifactJsonPath)
            ? await this.readFile(artifactJsonPath, errors)
            : null;

        if (!pomContent && !artifactJsonContent) {
            errors.addError(
                ParseErrorCodes.PROJECT_NOT_FOUND,
                'Neither pom.xml nor mule-artifact.json found in project directory',
                { filePath: projectDir }
            );
            return null;
        }

        this.reportProgress(options.onProgress, 2, 4, 'Parsing project structure');

        // Parse project info
        const projectInfo = await this.parseProject(
            projectDir,
            pomContent,
            artifactJsonContent,
            errors
        );

        if (!projectInfo) {
            return null;
        }

        // Verify this is a Mule project
        if (!this.isMuleProject(pomContent)) {
            errors.addWarning(
                ParseErrorCodes.INVALID_PROJECT,
                'pom.xml does not appear to be a MuleSoft Mule project (no mule-maven-plugin found)',
                { filePath: pomPath }
            );
        }

        // Check cancellation
        if (this.isCancelled(options.cancellationToken)) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return null;
        }

        this.reportProgress(options.onProgress, 3, 4, 'Discovering artifacts');

        // Discover artifacts
        const artifacts = await this.discoverArtifacts(projectDir);

        this.reportProgress(options.onProgress, 4, 4, 'Converting to IR');

        // Convert to IR — use the actual filename (without extension) so the tree
        // shows the real file (e.g. "pom.xml") after the extension is re-appended.
        const ext = path.extname(inputPath);
        const displayName = path.basename(inputPath, ext);

        return this.convertToIR({ ...projectInfo, name: displayName }, artifacts, errors);
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const projectDir = this.resolveProjectDir(filePath);
        const artifacts = await this.discoverArtifacts(projectDir);

        return {
            name: path.basename(projectDir),
            type: 'project',
            elementCount:
                artifacts.flows.length +
                artifacts.dataweaveFiles.length +
                artifacts.ramlFiles.length,
            description: `Mule project: ${artifacts.flows.length} flows, ${artifacts.dataweaveFiles.length} DWL files`,
        };
    }

    // =========================================================================
    // Project Detection
    // =========================================================================

    /**
     * Check if a pom.xml belongs to a Mule project.
     */
    private isMuleProject(pomContent: string | null): boolean {
        if (!pomContent) {
            return false;
        }

        return (
            pomContent.includes('mule-maven-plugin') ||
            pomContent.includes('mule-application') ||
            pomContent.includes('org.mule.runtime') ||
            pomContent.includes('mulesoft')
        );
    }

    // =========================================================================
    // Project Parsing
    // =========================================================================

    /**
     * Parse MuleSoft project information from pom.xml and mule-artifact.json.
     */
    private async parseProject(
        projectDir: string,
        pomContent: string | null,
        artifactJsonContent: string | null,
        errors: ParseErrorAccumulator
    ): Promise<MuleProjectInfo | null> {
        let name = path.basename(projectDir);
        let groupId = '';
        let version = '1.0.0';
        let muleVersion = '4.4.0';
        let runtimeVersion: MuleRuntimeVersion = '4';
        let projectType: MuleProjectType = 'mule-application';
        const properties: Record<string, string> = {};
        let dependencies: MuleDependency[] = [];
        let cloudHubConfig: MuleCloudHubConfig | undefined;

        // Parse pom.xml
        if (pomContent) {
            const pomDoc = parseXml(pomContent);
            if (pomDoc) {
                const projectEl = pomDoc.documentElement;

                // Basic project info
                name = getElementText(projectEl, 'artifactId') || name;
                groupId = getElementText(projectEl, 'groupId') || groupId;
                version = getElementText(projectEl, 'version') || version;

                // Packaging type
                const packaging = getElementText(projectEl, 'packaging') || '';
                if (packaging === 'mule-application') {
                    projectType = 'mule-application';
                } else if (packaging === 'mule-domain') {
                    projectType = 'mule-domain';
                } else if (packaging === 'mule-policy') {
                    projectType = 'mule-policy';
                }

                // Properties
                const propsEl = findByPath(pomDoc, 'project/properties');
                if (propsEl) {
                    // Use childNodes to get direct children
                    const allChildren = Array.from(propsEl.childNodes);
                    for (const child of allChildren) {
                        if (child && child.nodeType === 1) {
                            const el = child as Element;
                            properties[el.tagName] = el.textContent?.trim() || '';
                        }
                    }

                    muleVersion =
                        properties['app.runtime'] || properties['mule.version'] || muleVersion;
                }

                // Detect runtime version
                if (muleVersion.startsWith('4')) {
                    runtimeVersion = '4';
                } else if (muleVersion.startsWith('3')) {
                    runtimeVersion = '3';
                }

                // Dependencies
                dependencies = this.parseDependencies(pomDoc);

                // CloudHub config from mule-maven-plugin
                cloudHubConfig = this.parseCloudHubConfig(pomDoc);
            } else {
                errors.addWarning(
                    ParseErrorCodes.INVALID_XML,
                    'Could not parse pom.xml as valid XML',
                    { filePath: path.join(projectDir, 'pom.xml') }
                );
            }
        }

        // Parse mule-artifact.json for additional info
        if (artifactJsonContent) {
            try {
                const artifactJson = JSON.parse(artifactJsonContent);
                if (artifactJson.minMuleVersion) {
                    muleVersion = artifactJson.minMuleVersion;
                }
            } catch {
                errors.addWarning(
                    ParseErrorCodes.INVALID_JSON,
                    'Could not parse mule-artifact.json',
                    { filePath: path.join(projectDir, 'mule-artifact.json') }
                );
            }
        }

        // Parse mule-project.xml for Mule 3 project metadata (runtime version, Studio extensions)
        const muleProjectPath = path.join(projectDir, 'mule-project.xml');
        if (fs.existsSync(muleProjectPath)) {
            const muleProjectContent = await fs.promises
                .readFile(muleProjectPath, 'utf-8')
                .catch(() => null);
            if (muleProjectContent) {
                const muleProjectDoc = parseXml(muleProjectContent);
                if (muleProjectDoc) {
                    const root = muleProjectDoc.documentElement;
                    if (root) {
                        // Extract runtime version from runtimeId (e.g., "org.mule.tooling.server.3.7.1.ee")
                        const runtimeId = root.getAttribute('runtimeId') || '';
                        const runtimeMatch = runtimeId.match(/server\.(\d+\.\d+\.\d+)/);
                        if (runtimeMatch) {
                            // Only use mule-project.xml version if pom.xml didn't provide one
                            if (muleVersion === '4.4.0') {
                                muleVersion = runtimeMatch[1];
                                if (muleVersion.startsWith('3')) {
                                    runtimeVersion = '3';
                                }
                            }
                        }

                        // Extract project name — mule-project.xml is the authoritative
                        // Mule 3 project descriptor, so prefer its name over pom.xml artifactId
                        const projectName = getElementText(root, 'name');
                        if (projectName) {
                            name = projectName;
                        }

                        // Extract Studio extensions as additional metadata
                        const extensionElements = getAllElements(muleProjectDoc, 'muleExtension');
                        const studioExtensions: string[] = [];
                        for (const ext of extensionElements) {
                            const extName = ext.getAttribute('name');
                            if (extName) {
                                studioExtensions.push(extName);
                            }
                        }
                        if (studioExtensions.length > 0) {
                            properties['studio.extensions'] = studioExtensions.join(', ');
                        }
                    }
                }
            }
        }

        // Discover artifacts
        const artifacts = await this.discoverArtifacts(projectDir);

        return {
            projectPath: path.join(projectDir, 'pom.xml'),
            name,
            groupId,
            version,
            muleVersion,
            runtimeVersion,
            projectType,
            projectDirectory: projectDir,
            artifacts,
            dependencies,
            properties,
            cloudHubConfig,
        };
    }

    /**
     * Parse Maven dependencies from pom.xml.
     */
    private parseDependencies(pomDoc: Document): MuleDependency[] {
        const deps: MuleDependency[] = [];

        const dependencyElements = getAllElements(pomDoc, 'dependency');
        for (const depEl of dependencyElements) {
            const gId = getElementText(depEl, 'groupId') || '';
            const aId = getElementText(depEl, 'artifactId') || '';
            const ver = getElementText(depEl, 'version') || undefined;
            const classifier = getElementText(depEl, 'classifier') || undefined;
            const scope = getElementText(depEl, 'scope') || undefined;

            if (gId && aId) {
                deps.push({
                    groupId: gId,
                    artifactId: aId,
                    version: ver,
                    classifier,
                    scope,
                });
            }
        }

        return deps;
    }

    /**
     * Parse CloudHub configuration from mule-maven-plugin in pom.xml.
     */
    private parseCloudHubConfig(pomDoc: Document): MuleCloudHubConfig | undefined {
        const plugins = getAllElements(pomDoc, 'plugin');

        for (const plugin of plugins) {
            const artifactId = getElementText(plugin, 'artifactId') || '';
            if (artifactId !== 'mule-maven-plugin') {
                continue;
            }

            const configEl = getFirstChildElement(plugin, 'configuration');
            if (!configEl) {
                continue;
            }

            const cloudHubEl = getFirstChildElement(configEl, 'cloudHubDeployment');
            if (!cloudHubEl) {
                continue;
            }

            return {
                workers: parseInt(getElementText(cloudHubEl, 'workers') || '1', 10),
                workerSize: getElementText(cloudHubEl, 'workerSize') || '0.1',
                region: getElementText(cloudHubEl, 'region') || undefined,
                muleVersion: getElementText(cloudHubEl, 'muleVersion') || undefined,
                objectStoreV2: getElementText(cloudHubEl, 'objectStoreV2') === 'true',
            };
        }

        return undefined;
    }

    // =========================================================================
    // Artifact Discovery
    // =========================================================================

    /**
     * Discover all artifacts in a MuleSoft project directory.
     */
    private async discoverArtifacts(projectDir: string): Promise<MuleArtifactReferences> {
        const flows: string[] = [];
        const dataweaveFiles: string[] = [];
        const ramlFiles: string[] = [];
        const openApiFiles: string[] = [];
        const propertyFiles: string[] = [];
        const others: string[] = [];

        // Scan src/main/mule for flow XMLs (Mule 4)
        const muleDir = path.join(projectDir, 'src', 'main', 'mule');
        if (fs.existsSync(muleDir)) {
            await this.walkDirectory(muleDir, (filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                if (ext === '.xml') {
                    flows.push(filePath);
                } else if (ext === '.dwl') {
                    dataweaveFiles.push(filePath);
                }
            });
        }

        // Scan src/main/app for flow XMLs (Mule 3)
        const appDir = path.join(projectDir, 'src', 'main', 'app');
        if (fs.existsSync(appDir)) {
            await this.walkDirectory(appDir, (filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                const fileName = path.basename(filePath).toLowerCase();
                if (ext === '.xml') {
                    flows.push(filePath);
                } else if (ext === '.properties') {
                    propertyFiles.push(filePath);
                } else if (ext === '.dwl') {
                    dataweaveFiles.push(filePath);
                } else if (!fileName.startsWith('.')) {
                    others.push(filePath);
                }
            });
        }

        // Scan src/main/resources for other artifacts
        const resourcesDir = path.join(projectDir, 'src', 'main', 'resources');
        if (fs.existsSync(resourcesDir)) {
            await this.walkDirectory(resourcesDir, (filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                if (ext === '.dwl') {
                    dataweaveFiles.push(filePath);
                } else if (ext === '.raml') {
                    ramlFiles.push(filePath);
                } else if (ext === '.yaml' || ext === '.yml') {
                    // Check if it's an API spec or properties
                    const fileName = path.basename(filePath).toLowerCase();
                    if (
                        fileName.includes('api') ||
                        fileName.includes('swagger') ||
                        fileName.includes('openapi')
                    ) {
                        openApiFiles.push(filePath);
                    } else {
                        propertyFiles.push(filePath);
                    }
                } else if (ext === '.json') {
                    const fileName = path.basename(filePath).toLowerCase();
                    if (
                        fileName.includes('api') ||
                        fileName.includes('swagger') ||
                        fileName.includes('openapi')
                    ) {
                        openApiFiles.push(filePath);
                    }
                } else if (ext === '.properties') {
                    propertyFiles.push(filePath);
                } else {
                    others.push(filePath);
                }
            });
        }

        return {
            flows,
            dataweaveFiles,
            ramlFiles,
            openApiFiles,
            propertyFiles,
            others,
        };
    }

    /**
     * Walk a directory recursively and call callback for each file.
     */
    private async walkDirectory(dir: string, callback: (filePath: string) => void): Promise<void> {
        if (!fs.existsSync(dir)) {
            return;
        }

        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (!this.shouldSkipDirectory(entry.name)) {
                    await this.walkDirectory(fullPath, callback);
                }
            } else if (entry.isFile()) {
                callback(fullPath);
            }
        }
    }

    /**
     * Scan a directory for specific file types and add to detected files list.
     */
    private async scanDirectory(
        dir: string,
        extensions: string[],
        fileType: SourceFileType,
        files: DetectedFile[]
    ): Promise<void> {
        if (!fs.existsSync(dir)) {
            return;
        }

        await this.walkDirectory(dir, (filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            if (extensions.includes(ext)) {
                try {
                    const stat = fs.statSync(filePath);
                    files.push({
                        path: filePath,
                        type: fileType,
                        platform: 'mulesoft',
                        size: stat.size,
                        lastModified: stat.mtime,
                    });
                } catch {
                    // Skip files that can't be stat'd
                }
            }
        });
    }

    // =========================================================================
    // IR Conversion
    // =========================================================================

    /**
     * Convert project info to IR document.
     */
    private convertToIR(
        projectInfo: MuleProjectInfo,
        artifacts: MuleArtifactReferences,
        _errors: ParseErrorAccumulator
    ): IRDocument {
        const ir = createEmptyIRDocument(
            `mulesoft-project-${this.sanitizeId(projectInfo.name)}`,
            projectInfo.name,
            'mulesoft'
        );

        const gaps: IRGap[] = [];

        // Add gaps for Mule 3 projects
        if (projectInfo.runtimeVersion === '3') {
            gaps.push({
                id: 'gap-mule3-runtime',
                category: 'unsupported-feature',
                severity: 'high',
                title: 'Mule 3 Runtime',
                description:
                    'This project uses Mule 3 runtime. Migration from Mule 3 may require additional transformations not covered by the standard parser.',
                sourceFeature: {
                    platform: 'mulesoft',
                    name: 'Mule 3 Runtime',
                },
                status: 'open',
            } as unknown as IRGap);
        }

        // Add gap for domain projects
        if (projectInfo.projectType === 'mule-domain') {
            gaps.push({
                id: 'gap-mule-domain',
                category: 'unsupported-feature',
                severity: 'medium',
                title: 'Mule Domain Project',
                description:
                    'This is a Mule domain project. Shared resources need to be distributed to individual Logic Apps projects.',
                sourceFeature: {
                    platform: 'mulesoft',
                    name: 'Mule Domain',
                },
                status: 'open',
            } as unknown as IRGap);
        }

        // Add gap for CloudHub-specific features
        if (projectInfo.cloudHubConfig) {
            gaps.push({
                id: 'gap-cloudhub-config',
                category: 'unsupported-feature',
                severity: 'low',
                title: 'CloudHub Deployment Configuration',
                description:
                    'CloudHub-specific deployment settings need to be mapped to Azure Logic Apps deployment configuration.',
                sourceFeature: {
                    platform: 'mulesoft',
                    name: 'CloudHub Deployment',
                },
                status: 'open',
                resolution: {
                    strategy: 'alternative',
                    description:
                        'Configure Logic Apps Standard plan settings (ASP tier, scaling) based on CloudHub worker config.',
                },
            } as unknown as IRGap);
        }

        // Build connector gap list from dependencies
        const connectorDeps = projectInfo.dependencies.filter(
            (d) => d.classifier === 'mule-plugin'
        );
        for (const dep of connectorDeps) {
            if (this.isCustomConnector(dep)) {
                gaps.push({
                    id: `gap-connector-${this.sanitizeId(dep.artifactId)}`,
                    category: 'unsupported-adapter',
                    severity: 'medium',
                    title: `Custom Connector: ${dep.artifactId}`,
                    description: `MuleSoft connector '${dep.groupId}:${dep.artifactId}' needs a Logic Apps equivalent or custom connector.`,
                    sourceFeature: {
                        platform: 'mulesoft',
                        name: dep.artifactId,
                    },
                    status: 'open',
                } as unknown as IRGap);
            }
        }

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    platform: 'mulesoft',
                    platformVersion: projectInfo.muleVersion,
                    application: projectInfo.name,
                    artifact: {
                        name: projectInfo.name,
                        type: 'project',
                        filePath: projectInfo.projectPath,
                        fileType: 'xml',
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered',
                    complexity: this.estimateProjectComplexity(projectInfo, artifacts),
                    notes: [
                        `Mule ${projectInfo.runtimeVersion} project: ${projectInfo.name}`,
                        `Group: ${projectInfo.groupId}`,
                        `Version: ${projectInfo.version}`,
                        `Mule Runtime: ${projectInfo.muleVersion}`,
                        `Flows: ${artifacts.flows.length}`,
                        `DataWeave files: ${artifacts.dataweaveFiles.length}`,
                        `RAML specs: ${artifacts.ramlFiles.length}`,
                        `Dependencies: ${projectInfo.dependencies.length}`,
                    ],
                },
            },
            gaps,
            extensions: {
                mulesoft: {
                    projectType: projectInfo.projectType,
                    muleVersion: projectInfo.muleVersion,
                    groupId: projectInfo.groupId,
                    artifacts: {
                        flows: artifacts.flows.map((f) =>
                            path.relative(projectInfo.projectDirectory, f)
                        ),
                        dataweaveFiles: artifacts.dataweaveFiles.map((f) =>
                            path.relative(projectInfo.projectDirectory, f)
                        ),
                        ramlFiles: artifacts.ramlFiles.map((f) =>
                            path.relative(projectInfo.projectDirectory, f)
                        ),
                    },
                    dependencies: projectInfo.dependencies.map(
                        (d) => `${d.groupId}:${d.artifactId}:${d.version || 'latest'}`
                    ),
                    cloudHubDeployment: projectInfo.cloudHubConfig,
                    properties: projectInfo.properties,
                },
            },
        } as unknown as IRDocument;
    }

    // =========================================================================
    // Complexity Estimation
    // =========================================================================

    /**
     * Estimate project-level complexity.
     */
    private estimateProjectComplexity(
        projectInfo: MuleProjectInfo,
        artifacts: MuleArtifactReferences
    ): 'low' | 'medium' | 'high' | 'very-high' {
        let score = 0;

        score += artifacts.flows.length * 5;
        score += artifacts.dataweaveFiles.length * 3;
        score += artifacts.ramlFiles.length * 2;
        score += projectInfo.dependencies.filter((d) => d.classifier === 'mule-plugin').length * 3;

        if (projectInfo.cloudHubConfig) {
            score += 5;
        }
        if (projectInfo.runtimeVersion === '3') {
            score += 15;
        }

        if (score <= 15) {
            return 'low';
        }
        if (score <= 40) {
            return 'medium';
        }
        if (score <= 70) {
            return 'high';
        }
        return 'very-high';
    }

    // =========================================================================
    // Utility
    // =========================================================================

    /**
     * Resolve the project directory from an input path.
     */
    private resolveProjectDir(inputPath: string): string {
        const stat = fs.statSync(inputPath);

        if (stat.isDirectory()) {
            return inputPath;
        }

        return path.dirname(inputPath);
    }

    /**
     * Check if a dependency is a custom/non-standard connector.
     */
    private isCustomConnector(dep: MuleDependency): boolean {
        // Standard MuleSoft connectors are from org.mule.connectors
        const standardGroups = [
            'org.mule.connectors',
            'org.mule.modules',
            'com.mulesoft.connectors',
            'com.mulesoft.modules',
        ];

        return !standardGroups.includes(dep.groupId);
    }

    /**
     * Sanitize a string for use as an ID.
     */
    private sanitizeId(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Get file type for file extension.
     */
    protected override getFileType(extension: string): SourceFileType {
        switch (extension) {
            case '.xml':
                return 'xml';
            case '.dwl':
                return 'dwl';
            case '.raml':
                return 'raml';
            case '.yaml':
            case '.yml':
                return 'yaml';
            case '.json':
                return 'json';
            default:
                return 'xml';
        }
    }
}
