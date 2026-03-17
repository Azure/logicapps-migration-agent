/**
 * Context Builder for LM Tools
 *
 * Collects discovery results, planning data, and migration state
 * to provide rich context for LM tool invocations.
 *
 * @module copilot/ContextBuilder
 */

import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from '../services/StateManager';
import { DiscoveryService } from '../stages/discovery/DiscoveryService';
import { ArtifactInventory, ScanResult } from '../stages/discovery/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Context scope — controls how much context is gathered.
 */
export enum ContextScope {
    /** Minimal: stage info + inventory summary */
    Minimal = 'minimal',
    /** Standard: + artifact details + mapping reference */
    Standard = 'standard',
    /** Full: + raw source file contents */
    Full = 'full',
}

/**
 * Assembled context for the chat participant.
 */
interface MigrationChatContext {
    /** Current migration stage summary */
    stageSummary: string;
    /** Inventory summary text */
    inventorySummary?: string;
    /** Source artifact details (names, types, paths) */
    artifactDetails?: string;
    /** Raw source file contents (for Full scope) */
    sourceFileContents?: Map<string, string>;
    /** Source platform */
    sourcePlatform?: string;
    /** Target platform */
    targetPlatform?: string;
    /** Source folder path */
    sourceFolderPath?: string;
}

// =============================================================================
// Context Builder
// =============================================================================

/**
 * Builds rich context from the migration workspace for the chat participant.
 */
export class ContextBuilder {
    /**
     * Build context for a chat request.
     *
     * @param scope How much context to gather.
     * @returns Assembled context.
     */
    public async buildContext(
        scope: ContextScope = ContextScope.Standard
    ): Promise<MigrationChatContext> {
        const stateManager = StateManager.getInstance();
        const state = stateManager.getState();

        const context: MigrationChatContext = {
            stageSummary: '',
            sourcePlatform: state.sourcePlatform,
            targetPlatform: 'Azure Logic Apps Standard',
            sourceFolderPath: state.projectPath,
        };

        // 1. Stage summary (always)
        context.stageSummary = `Current stage: ${state.currentStage}`;

        // 2. Inventory summary (always)
        try {
            const discovery = DiscoveryService.getInstance();
            const inventory = discovery.getCurrentInventory();
            if (inventory) {
                context.inventorySummary = this.buildInventorySummary(inventory);
            }
        } catch {
            // Discovery may not have run yet
        }

        if (scope === ContextScope.Minimal) {
            return context;
        }

        // 3. Artifact details (Standard+)
        try {
            const discovery = DiscoveryService.getInstance();
            const result = discovery.getLastResult();
            if (result?.scanResult) {
                context.artifactDetails = this.buildArtifactDetails(result.scanResult);
            }
        } catch {
            // Ignore
        }

        if (scope === ContextScope.Full) {
            // 6. Raw source file contents
            context.sourceFileContents = await this.loadSourceFiles(state.projectPath);
        }

        return context;
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private buildInventorySummary(inventory: ArtifactInventory): string {
        const lines: string[] = [];
        lines.push(`Project: ${inventory.projectName}`);
        lines.push(
            `Platform: ${inventory.platform}${inventory.platformVersion ? ` v${inventory.platformVersion}` : ''}`
        );
        lines.push(`Total artifacts: ${inventory.statistics.totalCount}`);
        lines.push(
            `Parsed: ${inventory.statistics.byStatus.parsed}, Errors: ${inventory.statistics.byStatus.error}, Warnings: ${inventory.statistics.byStatus.warning}`
        );

        // Breakdown by category
        if (inventory.statistics.byCategory) {
            lines.push('');
            lines.push('By category:');
            for (const [cat, count] of Object.entries(inventory.statistics.byCategory)) {
                if (count > 0) {
                    lines.push(`  - ${cat}: ${count}`);
                }
            }
        }

        return lines.join('\n');
    }

    private buildArtifactDetails(scanResult: ScanResult): string {
        const lines: string[] = [];
        const artifacts = scanResult.parsedArtifacts;
        if (!artifacts || artifacts.length === 0) {
            return 'No artifacts parsed yet.';
        }

        for (const a of artifacts) {
            lines.push(`- **${a.name}** (${a.type}) — \`${a.sourcePath}\``);
        }
        return lines.join('\n');
    }

    private async loadSourceFiles(projectPath?: string): Promise<Map<string, string>> {
        const contents = new Map<string, string>();
        if (!projectPath) {
            return contents;
        }

        const discovery = DiscoveryService.getInstance();
        const inventory = discovery.getCurrentInventory();
        if (!inventory) {
            return contents;
        }

        const MAX_FILE_SIZE = 512 * 1024; // 512 KB per file
        const MAX_TOTAL = 5 * 1024 * 1024; // 5 MB total
        let totalSize = 0;

        for (const item of inventory.items) {
            if (totalSize >= MAX_TOTAL) {
                break;
            }
            const absPath = path.isAbsolute(item.sourcePath)
                ? item.sourcePath
                : path.join(inventory.sourcePath, item.sourcePath);
            try {
                const stat = fs.statSync(absPath);
                if (stat.size > MAX_FILE_SIZE) {
                    continue;
                }
                const content = fs.readFileSync(absPath, 'utf-8');
                contents.set(item.sourcePath, content);
                totalSize += stat.size;
            } catch {
                // Skip unreadable files
            }
        }
        return contents;
    }
}
