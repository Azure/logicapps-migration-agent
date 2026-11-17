/**
 * SAP PI/PO Integration Process Parser
 *
 * Parses SAP PI/PO integration processes into IR format.
 *
 * @module parsers/sappi/SAPPIPOIntegrationProcessParser
 */

import * as path from 'path';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument, IRIntegrationProcess } from '../../ir/types';
import * as vscode from 'vscode';

/**
 * Parser for SAP PI/PO Integration Processes
 */
export class SAPPIPOIntegrationProcessParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'sappi',
        fileExtensions: ['.xml', '.iproc'],
        fileTypes: ['integration-process'],
        supportsFolder: false,
        description: 'Parses SAP PI/PO Integration Processes into IR format',
    };

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
        this.reportProgress(
            options.onProgress,
            1,
            3,
            `Reading Integration Process: ${path.basename(inputPath)}`
        );

        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Parsing Integration Process steps');

        const ir = createEmptyIRDocument();
        ir.metadata = ir.metadata || {};
        ir.metadata.platform = 'sappi';
        ir.metadata.sourceFile = inputPath;

        // Parse the integration process
        this.parseIntegrationProcess(content, inputPath, ir, errors);

        this.reportProgress(options.onProgress, 3, 3, 'Integration Process parsing complete');

        return ir;
    }

    /**
     * Parse an integration process from XML content
     */
    private parseIntegrationProcess(
        content: string,
        filePath: string,
        ir: IRDocument,
        errors: ParseErrorAccumulator
    ): void {
        try {
            // Extract process metadata
            const nameMatch = content.match(
                /<\w*(?:IntegrationProcess|Process)\s+[^>]*name=["']([^"']+)["']/i
            );
            const descMatch = content.match(
                /<\w*(?:Description|description)>([^<]+)<\/\w*(?:Description|description)>/i
            );

            const process: IRIntegrationProcess = {
                id: path.basename(filePath, path.extname(filePath)),
                name: nameMatch ? nameMatch[1] : path.basename(filePath),
                description: descMatch ? descMatch[1] : undefined,
                steps: [],
            };

            // Parse process steps (receive, send, fork, join, switch, etc.)
            const stepMatches = content.matchAll(
                /<\w*(?:Step|step)\s+[^>]*id=["']([^"']+)["'][^>]*type=["']([^"']+)["']/g
            );

            for (const match of stepMatches) {
                const stepId = match[1];
                const stepType = match[2].toLowerCase();

                process.steps = process.steps || [];
                process.steps.push({
                    id: stepId,
                    name: stepId,
                    type: this.mapStepType(stepType),
                    sourceLocation: {
                        filePath,
                        lineNumber: this.estimateLineNumber(content, match[0]),
                    },
                });
            }

            ir.integrationProcesses = ir.integrationProcesses || [];
            ir.integrationProcesses.push(process);
        } catch (error) {
            errors.addError(
                ParseErrorCodes.INVALID_XML,
                `Failed to parse integration process: ${String(error)}`,
                { filePath, cause: error as Error }
            );
        }
    }

    /**
     * Map SAP PI/PO step types to IR types
     */
    private mapStepType(
        sapType: string
    ): 'receive' | 'send' | 'transform' | 'decision' | 'parallel' | 'fork' | 'join' | 'other' {
        const typeMap: Record<string, any> = {
            receive: 'receive',
            send: 'send',
            'request-reply': 'send', // Maps to send since it's a two-way communication
            fork: 'fork',
            join: 'join',
            switch: 'decision',
            'switch-case': 'decision',
            transform: 'transform',
            mapping: 'transform',
            block: 'other',
            delay: 'other',
            alert: 'other',
            parallel: 'parallel',
            loop: 'other',
        };

        return typeMap[sapType] || 'other';
    }

    /**
     * Estimate line number in content
     */
    private estimateLineNumber(content: string, substring: string): number {
        const index = content.indexOf(substring);
        if (index === -1) return 1;
        return content.substring(0, index).split('\n').length;
    }

    /**
     * Get artifact summary
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        return {
            name: path.basename(filePath, path.extname(filePath)),
            type: 'integration-process',
        };
    }
}
