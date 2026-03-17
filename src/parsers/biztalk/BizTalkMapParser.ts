/**
 * BizTalk Map Parser
 *
 * Parses BizTalk .btm map files into IR format.
 *
 * @module parsers/biztalk/BizTalkMapParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import {
    BizTalkMapInfo,
    BizTalkFunctoid,
    BizTalkFunctoidCategory,
    BizTalkMapLink,
    BizTalkFunctoidParameter,
} from './types';
import { parseXml, getAttr, getAllElements, getElementText } from '../utils/xml';
import { IRDocument, createEmptyIRDocument, IRMap, MapFunction } from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// Functoid Category Mapping
// =============================================================================

const FUNCTOID_CATEGORIES: Record<string, BizTalkFunctoidCategory> = {
    // String functoids (200-299)
    'String Concatenate': 'String',
    'String Left': 'String',
    'String Right': 'String',
    Uppercase: 'String',
    Lowercase: 'String',
    'String Length': 'String',
    'String Find': 'String',
    'String Extract': 'String',
    Trim: 'String',

    // Mathematical functoids (100-199)
    Addition: 'Mathematical',
    Subtraction: 'Mathematical',
    Multiplication: 'Mathematical',
    Division: 'Mathematical',
    Integer: 'Mathematical',
    Round: 'Mathematical',
    'Square Root': 'Mathematical',
    'Absolute Value': 'Mathematical',
    Modulo: 'Mathematical',

    // Logical functoids (400-499)
    Equal: 'Logical',
    'Not Equal': 'Logical',
    'Greater Than': 'Logical',
    'Less Than': 'Logical',
    'Greater Than or Equal To': 'Logical',
    'Less Than or Equal To': 'Logical',
    'Logical AND': 'Logical',
    'Logical OR': 'Logical',
    'Logical NOT': 'Logical',
    IsNil: 'Logical',
    'Logical String': 'Logical',
    'Logical Numeric': 'Logical',
    'Logical Date': 'Logical',
    'Logical Existence': 'Logical',

    // Date/Time functoids (500-599)
    Date: 'DateTime',
    Time: 'DateTime',
    'Date and Time': 'DateTime',
    'Add Days': 'DateTime',

    // Conversion functoids (600-699)
    'ASCII to Character': 'Conversion',
    'Character to ASCII': 'Conversion',
    Hexadecimal: 'Conversion',
    Octal: 'Conversion',

    // Scientific functoids (700-799)
    'Arc Tangent': 'Scientific',
    Cosine: 'Scientific',
    Sine: 'Scientific',
    Tangent: 'Scientific',
    Exponent: 'Scientific',
    'Natural Exponential': 'Scientific',
    Logarithm: 'Scientific',
    '10^n': 'Scientific',

    // Cumulative functoids (800-899)
    'Cumulative Sum': 'Cumulative',
    'Cumulative Average': 'Cumulative',
    'Cumulative Minimum': 'Cumulative',
    'Cumulative Maximum': 'Cumulative',
    'Cumulative String': 'Cumulative',

    // Database functoids (900-999)
    'Database Lookup': 'Database',
    'Error Return': 'Database',
    'Format Message': 'Database',
    'Get Application ID': 'Database',
    'Get Application Value': 'Database',
    'Get Common ID': 'Database',
    'Get Common Value': 'Database',
    'Remove Application ID': 'Database',
    'Set Common ID': 'Database',
    'Value Extractor': 'Database',

    // Advanced functoids (1000+)
    Looping: 'Advanced',
    'Table Looping': 'Advanced',
    'Table Extractor': 'Advanced',
    'Value Mapping': 'Advanced',
    'Value Mapping (Flattening)': 'Advanced',
    'Mass Copy': 'Advanced',
    Scripting: 'Advanced',
    'Nil Value': 'Advanced',
    Assert: 'Advanced',
    Index: 'Advanced',
    'Record Count': 'Advanced',
    Iteration: 'Advanced',
};

// =============================================================================
// BizTalk Map Parser
// =============================================================================

/**
 * Parser for BizTalk map (.btm) files.
 */
export class BizTalkMapParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.btm'],
        fileTypes: ['map'],
        supportsFolder: false,
        description: 'Parses BizTalk maps (.btm) into IR maps',
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
        this.reportProgress(options.onProgress, 1, 4, `Reading map: ${path.basename(inputPath)}`);

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Parse XML
        const doc = parseXml(content);
        if (!doc) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'Map file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        this.reportProgress(options.onProgress, 2, 4, 'Parsing map structure');

        // Parse map info
        const mapInfo = this.parseMapXml(doc, inputPath, errors);
        if (!mapInfo) {
            return null;
        }

        // Check cancellation
        if (this.isCancelled(options.cancellationToken)) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return null;
        }

        this.reportProgress(options.onProgress, 3, 4, 'Converting to IR');

        // Convert to IR
        const ir = this.convertToIR(mapInfo, errors);

        this.reportProgress(options.onProgress, 4, 4, 'Map parsing complete');

        return ir;
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return {
                name: path.basename(filePath, '.btm'),
                type: 'map',
            };
        }

        const doc = parseXml(content);
        if (!doc) {
            return {
                name: path.basename(filePath, '.btm'),
                type: 'map',
            };
        }

        const errors = new ParseErrorAccumulator(100);
        const mapInfo = this.parseMapXml(doc, filePath, errors);

        if (!mapInfo) {
            return {
                name: path.basename(filePath, '.btm'),
                type: 'map',
            };
        }

        const customFunctoids = mapInfo.functoids.filter(
            (f) => f.category === 'Custom' || f.category === 'Advanced'
        );

        return {
            name: mapInfo.name,
            type: 'map',
            elementCount: mapInfo.functoids.length + mapInfo.links.length,
            references: [mapInfo.sourceSchema, mapInfo.targetSchema],
            description:
                `Map with ${mapInfo.functoids.length} functoids, ${mapInfo.links.length} links` +
                (customFunctoids.length > 0 ? ` (${customFunctoids.length} custom)` : ''),
        };
    }

    // =========================================================================
    // Map XML Parsing
    // =========================================================================

    /**
     * Parse map XML document.
     */
    private parseMapXml(
        doc: Document,
        filePath: string,
        errors: ParseErrorAccumulator
    ): BizTalkMapInfo | null {
        const rootElement = doc.documentElement;

        if (!rootElement) {
            errors.addError(ParseErrorCodes.INVALID_MAP, 'Map file has no root element', {
                filePath,
            });
            return null;
        }

        const name = path.basename(filePath, '.btm');

        // Find source and target schema references
        let sourceSchema = '';
        let targetSchema = '';

        // Look for SchemaReference elements or SrcTree/TrgTree
        const srcTreeElements = getAllElements(rootElement, 'SrcTree');
        const trgTreeElements = getAllElements(rootElement, 'TrgTree');

        if (srcTreeElements.length > 0) {
            sourceSchema =
                getAttr(srcTreeElements[0], 'RootType_Name') ||
                getAttr(srcTreeElements[0], 'SchemaRef') ||
                '';
        }

        if (trgTreeElements.length > 0) {
            targetSchema =
                getAttr(trgTreeElements[0], 'RootType_Name') ||
                getAttr(trgTreeElements[0], 'SchemaRef') ||
                '';
        }

        // Parse functoids
        const functoids = this.parseFunctoids(rootElement, errors);

        // Parse links
        const links = this.parseLinks(rootElement, errors);

        // Try to extract embedded XSLT
        const embeddedXslt = this.extractEmbeddedXslt(rootElement);

        return {
            name,
            filePath,
            sourceSchema,
            targetSchema,
            functoids,
            links,
            embeddedXslt,
        };
    }

    /**
     * Parse functoids from map.
     */
    private parseFunctoids(
        rootElement: Element,
        _errors: ParseErrorAccumulator
    ): BizTalkFunctoid[] {
        const functoids: BizTalkFunctoid[] = [];

        // Look for Functoid elements in Pages/Page structure
        const functoidElements = getAllElements(rootElement, 'Functoid');

        for (const funcEl of functoidElements) {
            const id = getAttr(funcEl, 'FunctoidID') || `func_${functoids.length}`;
            const type = getAttr(funcEl, 'Name') || 'Unknown';
            const x = parseInt(getAttr(funcEl, 'X') || '0', 10);
            const y = parseInt(getAttr(funcEl, 'Y') || '0', 10);

            // Determine category
            const category = this.getFunctoidCategory(type);

            // Parse parameters
            const parameters = this.parseFunctoidParameters(funcEl);

            // Check for scripting functoid details
            let inlineScript: string | undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let scriptType: any;
            let assemblyName: string | undefined;
            let className: string | undefined;
            let methodName: string | undefined;

            if (category === 'Advanced' && type.includes('Script')) {
                inlineScript = getElementText(funcEl, 'Script');
                const scriptTypeAttr = getAttr(funcEl, 'ScriptType');
                if (scriptTypeAttr) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    scriptType = scriptTypeAttr as any;
                }
                assemblyName = getAttr(funcEl, 'AssemblyName');
                className = getAttr(funcEl, 'ClassName');
                methodName = getAttr(funcEl, 'MethodName');
            }

            functoids.push({
                id,
                type,
                category,
                x,
                y,
                parameters,
                inlineScript,
                scriptType,
                assemblyName,
                className,
                methodName,
            });
        }

        return functoids;
    }

    /**
     * Parse functoid parameters.
     */
    private parseFunctoidParameters(funcEl: Element): BizTalkFunctoidParameter[] {
        const parameters: BizTalkFunctoidParameter[] = [];

        const paramElements = getAllElements(funcEl, 'Input');

        for (let i = 0; i < paramElements.length; i++) {
            const paramEl = paramElements[i];
            const value = getAttr(paramEl, 'Value') || getElementText(paramEl, 'Value') || '';
            const isLink =
                getAttr(paramEl, 'IsLink') === 'True' ||
                value.startsWith('FunctoidID_') ||
                value.startsWith('Link_');

            parameters.push({
                index: i,
                value,
                isLink,
            });
        }

        return parameters;
    }

    /**
     * Get functoid category from type name.
     */
    private getFunctoidCategory(type: string): BizTalkFunctoidCategory {
        // Check exact match
        if (type in FUNCTOID_CATEGORIES) {
            return FUNCTOID_CATEGORIES[type];
        }

        // Check partial match
        const typeLower = type.toLowerCase();
        if (typeLower.includes('string')) {
            return 'String';
        }
        if (
            typeLower.includes('math') ||
            typeLower.includes('add') ||
            typeLower.includes('subtract')
        ) {
            return 'Mathematical';
        }
        if (
            typeLower.includes('logical') ||
            typeLower.includes('equal') ||
            typeLower.includes('greater') ||
            typeLower.includes('less')
        ) {
            return 'Logical';
        }
        if (typeLower.includes('date') || typeLower.includes('time')) {
            return 'DateTime';
        }
        if (
            typeLower.includes('convert') ||
            typeLower.includes('ascii') ||
            typeLower.includes('hex')
        ) {
            return 'Conversion';
        }
        if (
            typeLower.includes('cumulative') ||
            typeLower.includes('sum') ||
            typeLower.includes('average')
        ) {
            return 'Cumulative';
        }
        if (typeLower.includes('database') || typeLower.includes('lookup')) {
            return 'Database';
        }
        if (
            typeLower.includes('script') ||
            typeLower.includes('custom') ||
            typeLower.includes('assembly')
        ) {
            return 'Custom';
        }
        if (
            typeLower.includes('loop') ||
            typeLower.includes('table') ||
            typeLower.includes('value mapping')
        ) {
            return 'Advanced';
        }

        return 'Unknown';
    }

    /**
     * Parse links from map.
     */
    private parseLinks(rootElement: Element, _errors: ParseErrorAccumulator): BizTalkMapLink[] {
        const links: BizTalkMapLink[] = [];

        const linkElements = getAllElements(rootElement, 'Link');

        for (const linkEl of linkElements) {
            const sourceXPath = getAttr(linkEl, 'SourceXPath') || getAttr(linkEl, 'From');
            const targetXPath = getAttr(linkEl, 'TargetXPath') || getAttr(linkEl, 'To');
            const sourceFunctoidId =
                getAttr(linkEl, 'SourceFunctoid') || getAttr(linkEl, 'FromFunctoid');
            const targetFunctoidId =
                getAttr(linkEl, 'TargetFunctoid') || getAttr(linkEl, 'ToFunctoid');

            // Only add if we have some link information
            if (sourceXPath || targetXPath || sourceFunctoidId || targetFunctoidId) {
                links.push({
                    sourceXPath: sourceXPath || undefined,
                    targetXPath: targetXPath || undefined,
                    sourceFunctoidId: sourceFunctoidId || undefined,
                    targetFunctoidId: targetFunctoidId || undefined,
                });
            }
        }

        return links;
    }

    /**
     * Extract embedded XSLT if present.
     */
    private extractEmbeddedXslt(rootElement: Element): string | undefined {
        // Look for XSLT element or compiled stylesheet
        const xsltElements = getAllElements(rootElement, 'Xslt');
        if (xsltElements.length > 0 && xsltElements[0].textContent) {
            return xsltElements[0].textContent;
        }

        const stylesheetElements = getAllElements(rootElement, 'stylesheet');
        if (stylesheetElements.length > 0) {
            return stylesheetElements[0].outerHTML;
        }

        return undefined;
    }

    // =========================================================================
    // IR Conversion
    // =========================================================================

    /**
     * Convert map info to IR document.
     */
    private convertToIR(mapInfo: BizTalkMapInfo, _errors: ParseErrorAccumulator): IRDocument {
        const ir = createEmptyIRDocument(`map-${mapInfo.name}`, mapInfo.name, 'biztalk');

        // Convert functoids to map functions
        const functions = mapInfo.functoids.map((f) => ({
            id: f.id,
            name: f.type,
            category: f.category.toLowerCase(),
            convertible: this.isFunctoidConvertible(f),
            requiresCustomCode: f.category === 'Custom' || f.scriptType !== undefined,
            sourceMapping: {
                biztalk: {
                    functoidType: f.type,
                    category: f.category,
                    hasScript: f.inlineScript !== undefined,
                    scriptType: f.scriptType,
                },
            },
        })) as unknown as MapFunction[];

        // Create IR map
        const irMap: IRMap = {
            id: `map-${mapInfo.name}`,
            name: mapInfo.name,
            type: 'xslt',
            sourceSchema: mapInfo.sourceSchema,
            targetSchema: mapInfo.targetSchema,
            functions,
            parameters: [],
            sourceMapping: {
                biztalk: {
                    btmFile: mapInfo.filePath,
                    functoidCount: mapInfo.functoids.length,
                    linkCount: mapInfo.links.length,
                    hasEmbeddedXslt: mapInfo.embeddedXslt !== undefined,
                },
            },
            targetMapping: {
                confidence: this.hasNonConvertibleFunctoids(mapInfo) ? 'low' : 'high',
            },
        } as unknown as IRMap;

        // Add gaps for custom functoids
        const gaps = this.identifyMapGaps(mapInfo);

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        name: mapInfo.name,
                        type: 'map',
                        filePath: mapInfo.filePath,
                        fileType: '.btm',
                    },
                },
            },
            maps: [irMap],
            gaps,
        };
    }

    /**
     * Check if functoid is directly convertible to XSLT/Liquid.
     */
    private isFunctoidConvertible(functoid: BizTalkFunctoid): boolean {
        // Custom/scripting functoids need special handling
        if (functoid.category === 'Custom' || functoid.scriptType !== undefined) {
            return false;
        }

        // Database functoids need Azure Function
        if (functoid.category === 'Database') {
            return false;
        }

        // Most standard functoids are convertible
        return true;
    }

    /**
     * Check if map has non-convertible functoids.
     */
    private hasNonConvertibleFunctoids(mapInfo: BizTalkMapInfo): boolean {
        return mapInfo.functoids.some((f) => !this.isFunctoidConvertible(f));
    }

    /**
     * Identify gaps in map conversion.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private identifyMapGaps(mapInfo: BizTalkMapInfo): any[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gaps: any[] = [];

        // Check for custom/scripting functoids
        const scriptingFunctoids = mapInfo.functoids.filter(
            (f) => f.category === 'Custom' || f.scriptType !== undefined
        );

        if (scriptingFunctoids.length > 0) {
            gaps.push({
                id: `gap-${mapInfo.name}-scripting`,
                category: 'custom-code',
                severity: 'medium',
                title: `Scripting functoids in ${mapInfo.name}`,
                description: `Map contains ${scriptingFunctoids.length} scripting/custom functoids that need Azure Function conversion`,
                sourceFeature: {
                    platform: 'biztalk',
                    name: 'Scripting Functoid',
                    items: scriptingFunctoids.map((f) => f.type),
                },
                resolution: {
                    strategy: 'azure-function',
                    confidence: 'medium',
                },
            });
        }

        // Check for database functoids
        const dbFunctoids = mapInfo.functoids.filter((f) => f.category === 'Database');

        if (dbFunctoids.length > 0) {
            gaps.push({
                id: `gap-${mapInfo.name}-database`,
                category: 'connector',
                severity: 'high',
                title: `Database functoids in ${mapInfo.name}`,
                description: `Map contains ${dbFunctoids.length} database functoids that need Azure Function or Logic Apps connector`,
                sourceFeature: {
                    platform: 'biztalk',
                    name: 'Database Functoid',
                    items: dbFunctoids.map((f) => f.type),
                },
                resolution: {
                    strategy: 'azure-function',
                    confidence: 'medium',
                },
            });
        }

        return gaps;
    }
}
