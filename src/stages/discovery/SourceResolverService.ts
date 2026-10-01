/**
 * Resolves deployed BizTalk assemblies to local source projects/files.
 *
 * @module stages/discovery/SourceResolverService
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import {
    EnvironmentArtifact,
    EnvironmentInventory,
    SourceResolution,
    SourceResolutionResult,
} from './types';

const PROJECT_EXTENSIONS = new Set(['.btproj', '.csproj', '.vbproj']);
const SOURCE_EXTENSIONS = new Set(['.odx', '.btm', '.btp', '.xsd', '.brl', '.bre', '.asmx', '.hidx']);

export class SourceResolverService {
    private readonly logger = LoggingService.getInstance();

    public async resolve(
        inventory: EnvironmentInventory,
        rootPaths: string[]
    ): Promise<SourceResolutionResult> {
        const files = await this.collectFiles(rootPaths);
        const normalizedFiles = files.map((filePath) => ({
            path: filePath,
            baseName: path.basename(filePath, path.extname(filePath)).toLowerCase(),
            extension: path.extname(filePath).toLowerCase(),
        }));

        const resolutions: SourceResolution[] = [];
        for (const application of inventory.applications) {
            for (const artifact of application.artifacts) {
                resolutions.push(this.resolveArtifact(artifact, normalizedFiles));
            }
        }

        this.logger.info('Resolved BizTalk environment artifacts to source', {
            artifacts: resolutions.length,
            resolved: resolutions.filter((item) => item.status === 'resolved').length,
            ambiguous: resolutions.filter((item) => item.status === 'ambiguous').length,
        });

        return { rootPaths: [...rootPaths], resolutions };
    }

    private resolveArtifact(
        artifact: EnvironmentArtifact,
        files: Array<{ path: string; baseName: string; extension: string }>
    ): SourceResolution {
        const identityName = this.getAssemblyName(artifact.assemblyIdentity);
        const artifactName = artifact.name.toLowerCase();
        const matches = files.filter((file) =>
            (identityName && file.baseName === identityName) ||
            file.baseName === artifactName
        );
        const sourceMatches = matches.filter((file) => SOURCE_EXTENSIONS.has(file.extension));
        const projectMatches = matches.filter((file) => PROJECT_EXTENSIONS.has(file.extension));
        const candidatePaths = [...new Set(matches.map((file) => file.path))];

        if (candidatePaths.length === 0) {
            return {
                environmentArtifactId: artifact.id,
                ...(artifact.assemblyIdentity ? { assemblyIdentity: artifact.assemblyIdentity } : {}),
                status: 'unresolved',
                candidatePaths: [],
                matchedFiles: [],
                reason: 'No local source file matched the deployed artifact name or assembly identity.',
            };
        }

        const projectPath = projectMatches[0]?.path;
        const matchedFiles = sourceMatches.map((file) => file.path);
        if (candidatePaths.length > 1 && !projectPath) {
            return {
                environmentArtifactId: artifact.id,
                ...(artifact.assemblyIdentity ? { assemblyIdentity: artifact.assemblyIdentity } : {}),
                status: 'ambiguous',
                candidatePaths,
                matchedFiles,
                reason: 'Multiple source candidates matched and no project file disambiguated them.',
            };
        }

        return {
            environmentArtifactId: artifact.id,
            ...(artifact.assemblyIdentity ? { assemblyIdentity: artifact.assemblyIdentity } : {}),
            status: 'resolved',
            ...(projectPath ? { projectPath } : {}),
            candidatePaths,
            matchedFiles,
        };
    }

    private getAssemblyName(identity?: string): string | undefined {
        if (!identity) {
            return undefined;
        }
        return identity.split(',')[0]?.trim().toLowerCase() || undefined;
    }

    private async collectFiles(rootPaths: string[]): Promise<string[]> {
        const result: string[] = [];
        for (const rootPath of rootPaths) {
            await this.collectFilesFromPath(path.resolve(rootPath), result);
        }
        return result;
    }

    private async collectFilesFromPath(currentPath: string, result: string[]): Promise<void> {
        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        } catch (error) {
            this.logger.warn('Unable to scan source resolution path', error instanceof Error ? error : undefined, {
                path: currentPath,
            });
            return;
        }

        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vscode' || entry.name === 'bin' || entry.name === 'obj') {
                continue;
            }
            const entryPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                await this.collectFilesFromPath(entryPath, result);
            } else if (entry.isFile()) {
                result.push(entryPath);
            }
        }
    }
}
