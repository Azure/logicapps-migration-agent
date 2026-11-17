/**
 * SAP PI/PO Project Parser
 *
 * Detects and parses SAP PI/PO project exports.
 *
 * @module parsers/sappi/SAPPIPOProjectParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import * as vscode from 'vscode';

/**
 * Parser for SAP PI/PO projects
 */
export class SAPPIPOProjectParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'sappi',
        fileExtensions: ['.xml', '.zip', '.iar'],
        fileTypes: ['configuration', 'integration-process', 'message-mapping', 'communication-channel'],
        supportsFolder: true,
        description: 'Parses SAP PI/PO integration projects',
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
        const stats = {
            filesDiscovered: 0,
            filesParsed: 0,
            filesFailed: 0,
        };

        this.reportProgress(options.onProgress, 0, 2, 'Detecting SAP PI/PO project structure');

        const isFolder = (await fs.promises.stat(inputPath)).isDirectory();

        if (isFolder) {
            return this.parseFolder(inputPath, options, errors);
        } else {
            return this.parseFile(inputPath, options, errors);
        }
    }

    /**
     * Parse a folder containing SAP PI/PO files
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
        this.reportProgress(options.onProgress, 1, 2, 'Scanning folder for SAP PI/PO files');

        const supportedFiles = await this.getSupportedFiles(folderPath);

        if (supportedFiles.length === 0) {
            errors.addError(
                ParseErrorCodes.UNSUPPORTED_FORMAT,
                'No SAP PI/PO configuration files found in the folder',
                { filePath: folderPath }
            );
            return null;
        }

        const ir = createEmptyIRDocument();
        ir.metadata = ir.metadata || {};
        ir.metadata.platform = 'sappi';
        ir.metadata.name = path.basename(folderPath);

        this.reportProgress(
            options.onProgress,
            2,
            2,
            `Found ${supportedFiles.length} SAP PI/PO files`
        );

        // For now, create a basic IR document structure
        // Full implementation would parse individual files
        ir.integrationProcesses = [];
        ir.messageMappings = [];
        ir.endpoints = [];

        return ir;
    }

    /**
     * Parse a single SAP PI/PO file
     */
    private async parseFile(
        filePath: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        const fileName = path.basename(filePath);

        this.reportProgress(options.onProgress, 1, 2, `Reading SAP PI/PO file: ${fileName}`);

        const content = await this.readFile(filePath, errors);
        if (!content) {
            return null;
        }

        const ir = createEmptyIRDocument();
        ir.metadata = ir.metadata || {};
        ir.metadata.platform = 'sappi';
        ir.metadata.name = path.basename(filePath, path.extname(filePath));

        this.reportProgress(options.onProgress, 2, 2, 'Parsing SAP PI/PO configuration');

        // Parse based on file extension
        if (filePath.endsWith('.xml')) {
            await this.parseXMLConfiguration(content, filePath, ir, errors);
        } else if (filePath.endsWith('.zip') || filePath.endsWith('.iar')) {
            // For now, just note that archive parsing would be needed
            errors.addError(
                ParseErrorCodes.UNSUPPORTED_FORMAT,
                'Archive format parsing requires additional decompression logic. Recommend exporting as XML.',
                { filePath }
            );
            return null;
        }

        return ir;
    }

    /**
     * Parse XML configuration file
     */
    private async parseXMLConfiguration(
        content: string,
        filePath: string,
        ir: IRDocument,
        errors: ParseErrorAccumulator
    ): Promise<void> {
        try {
            // Parse XML and extract SAP PI/PO objects
            // This is a basic implementation - full version would include:
            // - Integration process parsing
            // - Message mapping extraction
            // - Communication channel parsing
            // - Agreement binding

            if (
                content.includes('IntegrationProcess') ||
                content.includes('IntegrationScenario')
            ) {
                // Contains integration processes
                ir.integrationProcesses = ir.integrationProcesses || [];
            }

            if (content.includes('MessageMapping') || content.includes('Mapping')) {
                // Contains message mappings
                ir.messageMappings = ir.messageMappings || [];
            }

            if (
                content.includes('CommunicationChannel') ||
                content.includes('SenderAgreement') ||
                content.includes('ReceiverAgreement')
            ) {
                // Contains communication configuration
                ir.endpoints = ir.endpoints || [];
            }
        } catch (error) {
            errors.addError(ParseErrorCodes.INVALID_XML, `Failed to parse XML: ${String(error)}`, {
                filePath,
                cause: error as Error,
            });
        }
    }

    /**
     * Get artifact summary
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        return {
            name: path.basename(filePath),
            type: this.getFileType(filePath),
        };
    }

    /**
     * Determine file type based on content and name
     */
    private getFileType(filePath: string): string {
        if (filePath.includes('IntegrationProcess') || filePath.includes('iproc')) {
            return 'integration-process';
        }
        if (filePath.includes('MessageMapping') || filePath.includes('msg-mapping')) {
            return 'message-mapping';
        }
        if (
            filePath.includes('CommunicationChannel') ||
            filePath.includes('SenderAgreement') ||
            filePath.includes('ReceiverAgreement')
        ) {
            return 'communication-channel';
        }
        return 'configuration';
    }
}
