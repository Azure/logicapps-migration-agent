/**
 * SAP PI/PO Message Mapping Parser
 *
 * Parses SAP PI/PO message mappings into IR format.
 *
 * @module parsers/sappi/SAPPIPOMessageMappingParser
 */

import * as path from 'path';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument, IRMessageTransformation } from '../../ir/types';
import * as vscode from 'vscode';

/**
 * Parser for SAP PI/PO Message Mappings
 */
export class SAPPIPOMessageMappingParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'sappi',
        fileExtensions: ['.xml', '.mapping'],
        fileTypes: ['message-mapping'],
        supportsFolder: false,
        description: 'Parses SAP PI/PO Message Mappings into IR format',
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
            `Reading Message Mapping: ${path.basename(inputPath)}`
        );

        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Parsing Message Mapping rules');

        const ir = createEmptyIRDocument();
        ir.metadata = ir.metadata || {};
        ir.metadata.platform = 'sappi';
        ir.metadata.sourceFile = inputPath;

        // Parse the message mapping
        this.parseMessageMapping(content, inputPath, ir, errors);

        this.reportProgress(options.onProgress, 3, 3, 'Message Mapping parsing complete');

        return ir;
    }

    /**
     * Parse a message mapping from XML content
     */
    private parseMessageMapping(
        content: string,
        filePath: string,
        ir: IRDocument,
        errors: ParseErrorAccumulator
    ): void {
        try {
            // Extract mapping metadata
            const nameMatch = content.match(
                /<\w*(?:Mapping|MessageMapping)\s+[^>]*name=["']([^"']+)["']/i
            );
            const sourceMatch = content.match(/<\w*SourceMessage[^>]*>([^<]+)<\/\w*SourceMessage>/i);
            const targetMatch = content.match(/<\w*TargetMessage[^>]*>([^<]+)<\/\w*TargetMessage>/i);

            const transformation: IRMessageTransformation = {
                id: path.basename(filePath, path.extname(filePath)),
                name: nameMatch ? nameMatch[1] : path.basename(filePath),
                sourceMessage: sourceMatch ? sourceMatch[1].trim() : 'source',
                targetMessage: targetMatch ? targetMatch[1].trim() : 'target',
                rules: [],
                sourceLocation: {
                    filePath,
                },
            };

            // Parse mapping rules
            const ruleMatches = content.matchAll(
                /<\w*(?:MappingRule|Rule)\s+[^>]*source=["']([^"']+)["'][^>]*target=["']([^"']+)["']/g
            );

            for (const match of ruleMatches) {
                const sourceField = match[1];
                const targetField = match[2];

                transformation.rules = transformation.rules || [];
                transformation.rules.push({
                    sourcePath: sourceField,
                    targetPath: targetField,
                    type: 'map',
                });
            }

            // Parse function-based mappings (more complex transformations)
            const functionMatches = content.matchAll(
                /<\w*(?:Function|FunctionCall)\s+[^>]*name=["']([^"']+)["'][^>]*>([^<]*)<\/\w*(?:Function|FunctionCall)>/g
            );

            for (const match of functionMatches) {
                const functionName = match[1];
                const parameters = match[2];

                if (transformation.rules) {
                    transformation.rules.push({
                        sourcePath: parameters.split(',')[0]?.trim() || 'input',
                        targetPath: 'output',
                        type: 'function',
                        functionName,
                    });
                }
            }

            ir.messageMappings = ir.messageMappings || [];
            ir.messageMappings.push(transformation);
        } catch (error) {
            errors.addError(
                ParseErrorCodes.INVALID_XML,
                `Failed to parse message mapping: ${String(error)}`,
                { filePath, cause: error as Error }
            );
        }
    }

    /**
     * Get artifact summary
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        return {
            name: path.basename(filePath, path.extname(filePath)),
            type: 'message-mapping',
        };
    }
}
