/**
 * Merges live BizTalk deployment metadata into the common artifact inventory.
 *
 * @module stages/discovery/EnvironmentInventoryService
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { defaultParserFactory } from '../../parsers/ParserFactory';
import { IRDocument } from '../../ir/types/document';
import { BizTalkAssemblyRecoveryService } from './BizTalkAssemblyRecoveryService';
import {
    ArtifactInventory,
    EnvironmentGap,
    EnvironmentInventory,
    InventoryItem,
    SourceResolutionResult,
} from './types';

function deterministicId(value: string): string {
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function storageName(name: string, id: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'artifact';
    return `${safeName}-${deterministicId(id)}`;
}

export interface EnvironmentInventoryMergeResult {
    readonly inventory: ArtifactInventory;
    readonly gaps: EnvironmentGap[];
    /** IR documents (keyed by item.irId) parsed from resolved local source files or from BTSTask-exported bindings. */
    readonly irDocuments: Map<string, IRDocument>;
}

export class EnvironmentInventoryService {
    private readonly logger = LoggingService.getInstance();
    constructor(private readonly assemblyRecovery = new BizTalkAssemblyRecoveryService()) {}

    public async merge(
        environment: EnvironmentInventory,
        resolutions: SourceResolutionResult,
        workspacePath: string
    ): Promise<EnvironmentInventoryMergeResult> {
        if (!workspacePath || !path.isAbsolute(workspacePath)) {
            throw new Error('Open a local workspace folder to store discovered BizTalk artifacts.');
        }
        const storageRoot = path.join(
            workspacePath,
            '.vscode',
            'migration',
            'artifacts',
            storageName('biztalk', environment.environmentName)
        );
        await fs.promises.mkdir(storageRoot, { recursive: true });
        const resolutionByArtifact = new Map(
            resolutions.resolutions.map((resolution) => [
                resolution.environmentArtifactId,
                resolution,
            ])
        );
        const items: InventoryItem[] = [];
        const gaps: EnvironmentGap[] = [];
        const irDocuments = new Map<string, IRDocument>();
        let parsedCount = 0;
        let parseFailedCount = 0;

        // Pre-parse each application's authoritative BTSTask-exported bindings
        // (if fetched during discovery) so binding-type artifacts (send/receive
        // ports) are covered even with no local source folder at all.
        const applicationBindingsIR = new Map<string, IRDocument>();
        const applicationDirectories = new Map<string, string>();
        const applicationBindingsPaths = new Map<string, string>();
        for (const application of environment.applications) {
            const applicationDir = path.join(
                storageRoot,
                storageName(application.name, application.id)
            );
            await fs.promises.mkdir(applicationDir, { recursive: true });
            applicationDirectories.set(application.id, applicationDir);
            if (!application.bindingsXml) {
                continue;
            }
            const bindingsPath = path.join(applicationDir, 'BindingInfo.xml');
            await fs.promises.writeFile(bindingsPath, application.bindingsXml, 'utf-8');
            applicationBindingsPaths.set(application.id, bindingsPath);
            const ir = await this.tryParseSourceFile(bindingsPath);
            if (ir) {
                applicationBindingsIR.set(application.id, ir);
            }
        }

        for (const application of environment.applications) {
            const aggregatedBindingsIR = applicationBindingsIR.get(application.id);
            const bindingsPath = applicationBindingsPaths.get(application.id);
            const applicationDir = applicationDirectories.get(application.id)!;
            const assemblies = await this.assemblyRecovery.recover(environment, application, applicationDir);
            const assemblyByIdentity = new Map(
                assemblies.map((assembly) => [assembly.identity.toLowerCase(), assembly])
            );
            for (const assembly of assemblies) {
                const assemblyId = deterministicId(`environment-assembly:${environment.id}:${application.id}:${assembly.identity}`);
                const metadataPath = path.join(applicationDir, `assembly-${assemblyId}.json`);
                await fs.promises.writeFile(metadataPath, JSON.stringify(assembly, null, 2), 'utf8');
                const available = !!assembly.sourcePath && !assembly.error;
                const sourcePath = available ? assembly.sourcePath! : metadataPath;
                const message = assembly.error ?? [
                    'Recovered managed DLL; decompile with ILSpy CLI to inspect workflow logic. Binary is not parsed source IR.',
                    assembly.referenceWarning,
                ].filter(Boolean).join(' ');
                items.push({
                    id: assemblyId,
                    name: available ? path.basename(sourcePath) : assembly.identity,
                    category: 'custom-code', sourcePath, status: 'warning', errorMessage: message,
                    metadata: {
                        fileSize: (await fs.promises.stat(sourcePath)).size,
                        lastModified: environment.discoveredAt,
                        platformSpecific: {
                            applicationId: application.id, applicationName: application.name,
                            assemblyIdentity: assembly.identity, binaryAvailable: available,
                            sha256: assembly.sha256, provenance: assembly.provenance,
                            references: assembly.references, referenceWarning: assembly.referenceWarning, metadataPath,
                        },
                    },
                    tags: ['environment-discovered', 'assembly', available ? 'decompilation-required' : 'binary-unavailable'],
                });
                if (!available || assembly.referenceWarning) {
                    gaps.push({
                        applicationId: application.id, applicationName: application.name,
                        artifactId: assemblyId, artifactName: assembly.identity, severity: 'high',
                        gap: message,
                        resolution: 'Export the owning/referenced application or provide the exact deployed DLL, then rerun discovery. Do not substitute another version.',
                    });
                }
            }

            for (const artifact of application.artifacts) {
                const recoveredAssembly = artifact.assemblyIdentity
                    ? assemblyByIdentity.get(artifact.assemblyIdentity.toLowerCase()) : undefined;
                const resolution = resolutionByArtifact.get(artifact.id);
                const artifactDir = path.join(
                    applicationDir,
                    storageName(artifact.name, artifact.id)
                );
                await fs.promises.mkdir(artifactDir, { recursive: true });
                const metadataPath = path.join(artifactDir, 'metadata.json');
                const { content, ...artifactMetadata } = artifact;
                await fs.promises.writeFile(
                    metadataPath,
                    JSON.stringify(
                        {
                            ...artifactMetadata,
                            applicationId: application.id,
                            applicationName: application.name,
                            discoveredAt: environment.discoveredAt,
                        },
                        null,
                        2
                    ),
                    'utf-8'
                );

                let storedSource: string | undefined;
                if (content) {
                    const extensions: Record<string, string> = { schema: '.xsd', pipeline: '.btp' };
                    const extension = extensions[artifact.type] ?? '.xml';
                    const safeName =
                        artifact.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'artifact';
                    const fileName = safeName.toLowerCase().endsWith(extension)
                        ? safeName
                        : `${safeName}${extension}`;
                    storedSource = path.join(
                        artifactDir,
                        /^(con|prn|aux|nul|com[0-9]|lpt[0-9])\./i.test(fileName)
                            ? `_${fileName}`
                            : fileName
                    );
                    await fs.promises.writeFile(storedSource, content, 'utf-8');
                }
                const matchedFile =
                    resolution?.status === 'resolved' ? resolution.matchedFiles[0] : undefined;
                if (matchedFile) {
                    const copyPath = path.join(artifactDir, path.basename(matchedFile));
                    if (path.resolve(matchedFile) !== path.resolve(copyPath)) {
                        await fs.promises.copyFile(matchedFile, copyPath);
                    }
                    storedSource = copyPath;
                }
                const coveredByAggregatedBindings =
                    artifact.type === 'binding' && !!aggregatedBindingsIR;
                const coveredByReflectedContent =
                    !coveredByAggregatedBindings && !!content && !matchedFile;
                const sourcePath =
                    storedSource ??
                    (artifact.type === 'binding' ? bindingsPath : undefined) ??
                    metadataPath;
                const unresolved = !coveredByAggregatedBindings && !storedSource;
                const tags = ['environment-discovered', artifact.type];
                if (coveredByAggregatedBindings) {
                    tags.push('biztalk-export');
                }
                if (coveredByReflectedContent) {
                    tags.push('biztalk-reflected');
                }
                if (unresolved) {
                    tags.push('source-unavailable');
                    gaps.push({
                        applicationId: application.id,
                        applicationName: application.name,
                        artifactId: artifact.id,
                        artifactName: artifact.name,
                        severity: resolution?.status === 'ambiguous' ? 'medium' : 'high',
                        gap:
                            recoveredAssembly?.error ?? resolution?.reason ??
                            'No source resolution was returned for the deployed artifact.',
                        resolution:
                            recoveredAssembly?.sourcePath
                                ? `Decompile the recovered deployed assembly at ${recoveredAssembly.sourcePath} with ILSpy CLI. Source IR is still unavailable for this artifact.`
                                : 'Verify deployed assembly access and export permissions, then rerun discovery. Metadata is retained in the workspace for manual review.',
                    });
                }

                const itemId = deterministicId(
                    `environment-artifact:${environment.id}:${artifact.id}`
                );
                let irId: string | undefined;
                let parseFailed = false;
                if (storedSource) {
                    const ir = await this.tryParseSourceFile(storedSource);
                    if (ir) {
                        irId = itemId;
                        irDocuments.set(irId, ir);
                        parsedCount++;
                    } else {
                        parseFailed = true;
                        parseFailedCount++;
                    }
                }

                items.push({
                    id: itemId,
                    name: artifact.name,
                    category: artifact.type,
                    sourcePath,
                    status: unresolved ? 'warning' : parseFailed ? 'error' : 'parsed',
                    ...(unresolved
                        ? {
                              errorMessage:
                                  resolution?.reason ?? 'Only deployment metadata is available.',
                          }
                        : parseFailed
                          ? {
                                errorMessage: `Could not parse the saved artifact: ${sourcePath}. See the output log for details.`,
                            }
                          : {}),
                    ...(irId ? { irId } : {}),
                    metadata: {
                        fileSize: (await fs.promises.stat(sourcePath)).size,
                        lastModified: environment.discoveredAt,
                        platformSpecific: {
                            applicationId: application.id,
                            applicationName: application.name,
                            environmentArtifactId: artifact.id,
                            metadataPath,
                            ...(recoveredAssembly?.sourcePath ? { assemblyPath: recoveredAssembly.sourcePath } : {}),
                            ...(recoveredAssembly?.error ? { assemblyRecoveryError: recoveredAssembly.error } : {}),
                            ...(artifact.assemblyIdentity
                                ? { assemblyIdentity: artifact.assemblyIdentity }
                                : {}),
                        },
                    },
                    tags,
                });
            }

            // Add one aggregated inventory item per application representing the
            // whole exported BindingInfo.xml — this is what actually carries the
            // parsed IR (connections/endpoints) into flow-group detection, mirroring
            // how a single on-disk BindingInfo.xml file becomes one artifact.
            if (bindingsPath) {
                const aggregateItemId = deterministicId(
                    `environment-bindings:${environment.id}:${application.id}`
                );
                if (aggregatedBindingsIR) {
                    irDocuments.set(aggregateItemId, aggregatedBindingsIR);
                    parsedCount++;
                } else {
                    parseFailedCount++;
                }
                items.push({
                    id: aggregateItemId,
                    name: `${application.name} (Bindings)`,
                    category: 'binding',
                    sourcePath: bindingsPath,
                    status: aggregatedBindingsIR ? 'parsed' : 'error',
                    ...(aggregatedBindingsIR
                        ? { irId: aggregateItemId }
                        : {
                              errorMessage: `Could not parse the saved bindings: ${bindingsPath}. See the output log for details.`,
                          }),
                    metadata: {
                        fileSize: (await fs.promises.stat(bindingsPath)).size,
                        lastModified: environment.discoveredAt,
                        platformSpecific: {
                            applicationId: application.id,
                            applicationName: application.name,
                        },
                    },
                    tags: ['environment-discovered', 'binding', 'biztalk-export'],
                });
            }
        }

        this.logger.info('Parsed resolved BizTalk environment artifacts into IR', {
            parsed: parsedCount,
            parseFailed: parseFailedCount,
            applicationsWithExportedBindings: applicationBindingsIR.size,
            storageRoot,
        });

        const now = new Date().toISOString();
        const statistics = this.calculateStatistics(items);
        return {
            inventory: {
                id: deterministicId(`environment-inventory:${environment.id}`),
                projectName: environment.environmentName,
                platform: 'biztalk',
                sourcePath: storageRoot,
                items,
                statistics,
                createdAt: now,
                updatedAt: now,
                version: 1,
            },
            gaps,
            irDocuments,
        };
    }

    /**
     * Best-effort parse of a locally resolved BizTalk source file into IR so
     * environment-discovered artifacts can participate in flow-group detection
     * and dependency analysis the same way a normal file-system scan would.
     */
    private async tryParseSourceFile(filePath: string): Promise<IRDocument | undefined> {
        try {
            const result = await defaultParserFactory.parseFile(filePath);
            if (!result.success || !result.ir) {
                this.logger.warn('Failed to parse saved BizTalk artifact', undefined, {
                    filePath,
                    errors: JSON.stringify(result.errors),
                });
            }
            return result.success && result.ir ? result.ir : undefined;
        } catch (error) {
            this.logger.warn(
                'Failed to parse resolved BizTalk source file',
                error instanceof Error ? error : undefined,
                {
                    filePath,
                }
            );
            return undefined;
        }
    }

    private calculateStatistics(items: InventoryItem[]): ArtifactInventory['statistics'] {
        const byCategory: ArtifactInventory['statistics']['byCategory'] = {};
        const byStatus = { parsed: 0, error: 0, warning: 0 };
        let totalFileSize = 0;

        for (const item of items) {
            byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
            byStatus[item.status]++;
            totalFileSize += item.metadata.fileSize;
        }
        return {
            totalCount: items.length,
            byCategory,
            byStatus,
            errorRate: items.length === 0 ? 0 : (byStatus.error / items.length) * 100,
            totalFileSize,
        };
    }
}
