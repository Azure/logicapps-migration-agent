/**
 * BizTalk HIDX Parser
 *
 * Parses BizTalk Host Integration .hidx files into IR format.
 * HIDX files define mainframe/midrange data layouts for the
 * Host Integration Server / BizTalk Adapter for Host Applications.
 *
 * @module parsers/biztalk/BizTalkHidxParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { parseXml, getAttr, getAllElements, getElementText } from '../utils/xml';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// BizTalk HIDX Parser
// =============================================================================

/**
 * Parser for BizTalk Host Integration HIDX (.hidx) files.
 *
 * Extracts host data layout metadata: program name, fields,
 * COBOL types, offsets, and lengths — useful for understanding
 * mainframe data dependencies during migration.
 */
export class BizTalkHidxParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.hidx'],
        fileTypes: ['config'],
        supportsFolder: false,
        description: 'Parses BizTalk HIDX host data layout files into IR metadata',
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
        const fileName = path.basename(inputPath, '.hidx');

        this.reportProgress(options.onProgress, 1, 3, `Reading HIDX: ${fileName}`);

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Parse XML
        const doc = parseXml(content);
        if (!doc) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'HIDX file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Extracting host data layout');

        // Extract metadata
        const rootEl = doc.documentElement;
        const programName =
            getAttr(rootEl, 'ProgramName') ||
            getAttr(rootEl, 'Name') ||
            getElementText(rootEl, 'ProgramName') ||
            fileName;

        const description =
            getAttr(rootEl, 'Description') || getElementText(rootEl, 'Description') || '';

        // Extract field definitions
        const fieldElements = [
            ...getAllElements(rootEl, 'DataItem'),
            ...getAllElements(rootEl, 'Field'),
            ...getAllElements(rootEl, 'Element'),
        ];

        const fields = fieldElements.map((el) => ({
            name: getAttr(el, 'Name') || getAttr(el, 'name') || 'unknown',
            type:
                getAttr(el, 'DataType') ||
                getAttr(el, 'Type') ||
                getAttr(el, 'HostDataType') ||
                'unknown',
            length: getAttr(el, 'Length') || getAttr(el, 'Size') || undefined,
            offset: getAttr(el, 'Offset') || getAttr(el, 'Position') || undefined,
        }));

        this.reportProgress(options.onProgress, 3, 3, 'HIDX parsing complete');

        // Build IR
        const ir = createEmptyIRDocument(`hidx-${fileName}`, programName, 'biztalk');

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        name: programName,
                        type: 'schema',
                        filePath: path.relative(options.basePath, inputPath),
                        fileType: 'hidx',
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered',
                    notes: [
                        `Host Integration HIDX file: ${programName}`,
                        description ? `Description: ${description}` : '',
                        `Defines ${fields.length} host data field(s)`,
                        'Mainframe/midrange data layout — review for data mapping during migration',
                    ].filter(Boolean),
                },
            },
            gaps:
                fields.length > 0
                    ? [
                          {
                              id: `gap-hidx-${fileName}`,
                              category: 'other' as const,
                              severity: 'medium' as const,
                              title: `Host data layout: ${programName}`,
                              description: `HIDX defines ${fields.length} field(s) for host system communication. These data layouts need mapping to Logic Apps connectors or Azure Functions.`,
                              sourceFeature: {
                                  platform: 'biztalk',
                                  feature: 'HIDX Host Data Layout',
                                  artifacts: fields
                                      .slice(0, 20)
                                      .map(
                                          (f) =>
                                              `${f.name} (${f.type}${f.length ? ', len=' + f.length : ''})`
                                      ),
                              },
                              resolution: {
                                  strategy: 'alternative' as const,
                              },
                              status: 'pending' as const,
                          },
                      ]
                    : [],
        };
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const fileName = path.basename(filePath, '.hidx');
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return { name: fileName, type: 'schema' };
        }

        const doc = parseXml(content);
        if (!doc) {
            return { name: fileName, type: 'schema' };
        }

        const rootEl = doc.documentElement;
        const programName = getAttr(rootEl, 'ProgramName') || getAttr(rootEl, 'Name') || fileName;

        const fieldCount = [
            ...getAllElements(rootEl, 'DataItem'),
            ...getAllElements(rootEl, 'Field'),
            ...getAllElements(rootEl, 'Element'),
        ].length;

        return {
            name: programName,
            type: 'schema',
            elementCount: fieldCount,
            description: `HIDX host data layout with ${fieldCount} field(s)`,
        };
    }
}
