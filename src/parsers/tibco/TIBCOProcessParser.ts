/**
 * TIBCO Process Parser
 *
 * Parses TIBCO BusinessWorks process files (.process, .bwp)
 * into IR documents used by discovery and planning stages.
 *
 * @module parsers/tibco/TIBCOProcessParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import { parseXml } from '../utils/xml';
import * as vscode from 'vscode';

interface ProcessSummary {
    processName: string;
    activityCount: number;
    transitionCount: number;
    starterTypes: string[];
}

export class TIBCOProcessParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'tibco',
        fileExtensions: ['.process', '.bwp'],
        fileTypes: ['flow'],
        supportsFolder: false,
        description: 'Parses TIBCO BW process files into IR metadata',
    };

    override canParse(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.process' || ext === '.bwp';
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
        this.reportProgress(options.onProgress, 1, 3, `Reading TIBCO process: ${path.basename(inputPath)}`);

        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Analyzing TIBCO process structure');

        const summary = this.extractProcessSummary(inputPath, content, errors);
        if (!summary) {
            return null;
        }

        if (this.isCancelled(options.cancellationToken)) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return null;
        }

        this.reportProgress(options.onProgress, 3, 3, 'Converting TIBCO process to IR');

        return this.toIr(inputPath, summary);
    }

    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return {
                name: path.basename(filePath, path.extname(filePath)),
                type: 'process',
            };
        }

        const summary = this.extractProcessSummary(filePath, content, undefined);
        return {
            name: summary?.processName || path.basename(filePath, path.extname(filePath)),
            type: 'process',
            elementCount: summary?.activityCount,
            description: summary
                ? `${summary.activityCount} activity(ies), ${summary.transitionCount} transition(s)`
                : 'TIBCO process',
        };
    }

    private extractProcessSummary(
        filePath: string,
        content: string,
        errors?: ParseErrorAccumulator
    ): ProcessSummary | null {
        const doc = parseXml(content);
        if (!doc) {
            errors?.addError(ParseErrorCodes.INVALID_XML, 'Process file is not valid XML', {
                filePath,
            });
            return null;
        }

        const root = doc.documentElement;
        if (!root) {
            errors?.addError(ParseErrorCodes.INVALID_FLOW, 'Process file has no XML root element', {
                filePath,
            });
            return null;
        }

        const defaultName = path.basename(filePath, path.extname(filePath));
        const processName =
            root.getAttribute('name') ||
            root.getAttribute('processName') ||
            this.getProcessNameFromElements(doc) ||
            defaultName;

        const activities = this.countByTagNameIncludes(doc, 'activity');
        const transitions = this.countByTagNameIncludes(doc, 'transition');
        const starters = this.collectStarterTypes(doc);

        return {
            processName,
            activityCount: activities,
            transitionCount: transitions,
            starterTypes: starters,
        };
    }

    private toIr(inputPath: string, summary: ProcessSummary): IRDocument {
        const ir = createEmptyIRDocument(
            `tibco-process-${summary.processName}`,
            summary.processName,
            'tibco'
        );

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        ...ir.metadata.source.artifact,
                        name: summary.processName,
                        type: 'flow',
                        filePath: inputPath,
                        fileType: path.extname(inputPath).replace('.', ''),
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    complexity: summary.activityCount > 50 ? 'high' : 'medium',
                    notes: [
                        `Detected ${summary.activityCount} activity(ies) and ${summary.transitionCount} transition(s).`,
                        summary.starterTypes.length > 0
                            ? `Starter activities: ${summary.starterTypes.join(', ')}`
                            : 'Starter activity types could not be inferred.',
                    ],
                },
            },
            extensions: {
                ...ir.extensions,
                tibco: {
                    sourceFile: path.basename(inputPath),
                    activityCount: summary.activityCount,
                    transitionCount: summary.transitionCount,
                    starterTypes: summary.starterTypes,
                },
            },
        };
    }

    private countByTagNameIncludes(doc: Document, token: string): number {
        let count = 0;
        const all = doc.getElementsByTagName('*');
        for (const node of Array.from(all)) {
            const tagName = (node as Element).tagName?.toLowerCase?.() || '';
            if (tagName.includes(token)) {
                count++;
            }
        }
        return count;
    }

    private collectStarterTypes(doc: Document): string[] {
        const starters = new Set<string>();
        const all = doc.getElementsByTagName('*');

        for (const node of Array.from(all)) {
            const el = node as Element;
            const tagName = el.tagName?.toLowerCase?.() || '';
            if (!tagName.includes('starter') && !tagName.includes('start')) {
                continue;
            }

            const type = el.getAttribute('type') || el.getAttribute('activityType') || el.tagName;
            starters.add(type);
        }

        return Array.from(starters).slice(0, 10);
    }

    private getProcessNameFromElements(doc: Document): string | undefined {
        const candidates = ['ProcessDefinition', 'processDefinition', 'Process'];
        for (const candidate of candidates) {
            const nodes = doc.getElementsByTagName(candidate);
            if (nodes.length === 0) {
                continue;
            }

            const name = (nodes[0] as Element).getAttribute('name');
            if (name) {
                return name;
            }
        }

        return undefined;
    }
}
