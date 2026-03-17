/**
 * BizTalk Schema Parser
 *
 * Parses BizTalk .xsd schema files into IR format.
 *
 * @module parsers/biztalk/BizTalkSchemaParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import {
    BizTalkSchemaInfo,
    BizTalkSchemaType,
    BizTalkPromotedProperty,
    BizTalkDistinguishedField,
    BizTalkFlatFileAnnotation,
} from './types';
import { parseXml, getAttr, getAllElements } from '../utils/xml';
import { IRDocument, createEmptyIRDocument, IRSchema } from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// BizTalk Schema Parser
// =============================================================================

/**
 * Parser for BizTalk schema (.xsd) files.
 */
export class BizTalkSchemaParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.xsd'],
        fileTypes: ['schema'],
        supportsFolder: false,
        description: 'Parses BizTalk schemas (.xsd) into IR schemas',
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
            `Reading schema: ${path.basename(inputPath)}`
        );

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Parse XML
        const doc = parseXml(content);
        if (!doc) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'Schema file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Parsing schema structure');

        // Parse schema info
        const schemaInfo = this.parseSchemaXml(doc, inputPath, errors);
        if (!schemaInfo) {
            return null;
        }

        this.reportProgress(options.onProgress, 3, 3, 'Schema parsing complete');

        // Convert to IR
        return this.convertToIR(schemaInfo, errors);
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return {
                name: path.basename(filePath, '.xsd'),
                type: 'schema',
            };
        }

        const doc = parseXml(content);
        if (!doc) {
            return {
                name: path.basename(filePath, '.xsd'),
                type: 'schema',
            };
        }

        const errors = new ParseErrorAccumulator(100);
        const schemaInfo = this.parseSchemaXml(doc, filePath, errors);

        if (!schemaInfo) {
            return {
                name: path.basename(filePath, '.xsd'),
                type: 'schema',
            };
        }

        return {
            name: schemaInfo.name,
            type: 'schema',
            elementCount:
                schemaInfo.promotedProperties.length + schemaInfo.distinguishedFields.length,
            references: [...schemaInfo.imports, ...schemaInfo.includes],
            description: `${schemaInfo.schemaType} schema: ${schemaInfo.rootElement} (${schemaInfo.targetNamespace})`,
        };
    }

    // =========================================================================
    // Schema XML Parsing
    // =========================================================================

    /**
     * Parse schema XML document.
     */
    private parseSchemaXml(
        doc: Document,
        filePath: string,
        errors: ParseErrorAccumulator
    ): BizTalkSchemaInfo | null {
        const rootElement = doc.documentElement;

        // Check for schema element with any namespace prefix (xs:schema, xsd:schema, q1:schema, etc.)
        // The local name should be 'schema' and namespace should be XSD namespace
        const isSchemaElement =
            rootElement &&
            (rootElement.localName === 'schema' ||
                rootElement.tagName === 'xs:schema' ||
                rootElement.tagName === 'xsd:schema' ||
                rootElement.tagName.endsWith(':schema'));

        if (!isSchemaElement) {
            errors.addError(ParseErrorCodes.INVALID_SCHEMA, 'File is not a valid XSD schema', {
                filePath,
            });
            return null;
        }

        const name = path.basename(filePath, '.xsd');
        const targetNamespace = getAttr(rootElement, 'targetNamespace') || '';

        // Determine schema type
        const schemaType = this.determineSchemaType(rootElement);

        // Find root element
        const rootElementName = this.findRootElement(rootElement);

        // Parse promoted properties
        const promotedProperties = this.parsePromotedProperties(rootElement);

        // Parse distinguished fields
        const distinguishedFields = this.parseDistinguishedFields(rootElement);

        // Parse flat file annotations if applicable
        const flatFileAnnotations =
            schemaType === 'flatFile' ? this.parseFlatFileAnnotations(rootElement) : undefined;

        // Parse imports and includes
        const imports = this.parseImports(rootElement);
        const includes = this.parseIncludes(rootElement);

        return {
            name,
            filePath,
            targetNamespace,
            rootElement: rootElementName,
            schemaType,
            promotedProperties,
            distinguishedFields,
            flatFileAnnotations,
            imports,
            includes,
        };
    }

    /**
     * Determine schema type from annotations.
     */
    private determineSchemaType(rootElement: Element): BizTalkSchemaType {
        const appInfoElements = getAllElements(rootElement, 'xs:appinfo');

        for (const appInfo of appInfoElements) {
            const schemaInfo = getAllElements(appInfo, 'schemaInfo');
            if (schemaInfo.length > 0) {
                const schemaTypeAttr = getAttr(schemaInfo[0], 'schema_type');
                if (schemaTypeAttr === 'property') {
                    return 'property';
                }
                if (schemaTypeAttr === 'envelope') {
                    return 'envelope';
                }
            }

            // Check for flat file indicators
            const flatFileElements = getAllElements(appInfo, 'b:recordInfo');
            if (flatFileElements.length > 0) {
                return 'flatFile';
            }
        }

        return 'document';
    }

    /**
     * Find root element name.
     */
    private findRootElement(rootElement: Element): string {
        const elementDecls = getAllElements(rootElement, 'xs:element');
        if (elementDecls.length > 0) {
            // First global element is typically the root
            for (const el of elementDecls) {
                if (el.parentNode === rootElement) {
                    const name = getAttr(el, 'name');
                    if (name) {
                        return name;
                    }
                }
            }
        }
        return 'Unknown';
    }

    /**
     * Parse promoted properties from annotations.
     */
    private parsePromotedProperties(rootElement: Element): BizTalkPromotedProperty[] {
        const properties: BizTalkPromotedProperty[] = [];

        // Look for property promotions in xs:appinfo
        const appInfoElements = getAllElements(rootElement, 'xs:appinfo');

        for (const appInfo of appInfoElements) {
            const promotions = getAllElements(appInfo, 'b:promotion');

            for (const promo of promotions) {
                const fieldPromotions = getAllElements(promo, 'b:fieldPromotion');

                for (const field of fieldPromotions) {
                    const propName = getAttr(field, 'propertyName');
                    const propNamespace = getAttr(field, 'propertyNamespace') || '';
                    const xpath = getAttr(field, 'xpath') || '';

                    if (propName) {
                        properties.push({
                            name: propName,
                            namespace: propNamespace,
                            xpath,
                            type: 'string',
                        });
                    }
                }
            }
        }

        return properties;
    }

    /**
     * Parse distinguished fields.
     */
    private parseDistinguishedFields(rootElement: Element): BizTalkDistinguishedField[] {
        const fields: BizTalkDistinguishedField[] = [];

        const appInfoElements = getAllElements(rootElement, 'xs:appinfo');

        for (const appInfo of appInfoElements) {
            const promotions = getAllElements(appInfo, 'b:promotion');

            for (const promo of promotions) {
                const dfPromotions = getAllElements(promo, 'b:distinguishedField');

                for (const df of dfPromotions) {
                    const xpath = getAttr(df, 'xpath') || '';
                    const name = xpath.split('/').pop() || 'Unknown';

                    fields.push({
                        name,
                        xpath,
                    });
                }
            }
        }

        return fields;
    }

    /**
     * Parse flat file annotations.
     */
    private parseFlatFileAnnotations(rootElement: Element): BizTalkFlatFileAnnotation | undefined {
        const appInfoElements = getAllElements(rootElement, 'xs:appinfo');

        for (const appInfo of appInfoElements) {
            const recordInfo = getAllElements(appInfo, 'b:recordInfo');

            if (recordInfo.length > 0) {
                const firstRecord = recordInfo[0];
                const structure = getAttr(firstRecord, 'structure') || 'delimited';
                const delimiter = getAttr(firstRecord, 'child_delimiter');
                const wrapChar = getAttr(firstRecord, 'wrap_char');
                const escapeChar = getAttr(firstRecord, 'escape_char');
                const tagIdentifier = getAttr(firstRecord, 'tag_identifier');

                let recordType: 'positional' | 'delimited' | 'mixed' = 'delimited';
                if (structure === 'positional') {
                    recordType = 'positional';
                } else if (structure === 'mixed') {
                    recordType = 'mixed';
                }

                return {
                    recordType,
                    delimiter,
                    wrapChar,
                    escapeChar,
                    tagIdentifier,
                };
            }
        }

        return undefined;
    }

    /**
     * Parse schema imports.
     */
    private parseImports(rootElement: Element): string[] {
        const imports: string[] = [];
        const importElements = getAllElements(rootElement, 'xs:import');

        for (const imp of importElements) {
            const schemaLocation = getAttr(imp, 'schemaLocation');
            if (schemaLocation) {
                imports.push(schemaLocation);
            }
        }

        return imports;
    }

    /**
     * Parse schema includes.
     */
    private parseIncludes(rootElement: Element): string[] {
        const includes: string[] = [];
        const includeElements = getAllElements(rootElement, 'xs:include');

        for (const inc of includeElements) {
            const schemaLocation = getAttr(inc, 'schemaLocation');
            if (schemaLocation) {
                includes.push(schemaLocation);
            }
        }

        return includes;
    }

    // =========================================================================
    // IR Conversion
    // =========================================================================

    /**
     * Convert schema info to IR document.
     */
    private convertToIR(schemaInfo: BizTalkSchemaInfo, _errors: ParseErrorAccumulator): IRDocument {
        const ir = createEmptyIRDocument(`schema-${schemaInfo.name}`, schemaInfo.name, 'biztalk');

        // Create IR schema
        const irSchema = {
            id: `schema-${schemaInfo.name}`,
            name: schemaInfo.name,
            type: schemaInfo.schemaType === 'flatFile' ? 'flat-file' : 'xml',
            format: 'xsd',
            namespace: schemaInfo.targetNamespace,
            targetNamespace: schemaInfo.targetNamespace,
            rootElement: schemaInfo.rootElement,
            imports: [...schemaInfo.imports, ...schemaInfo.includes],
            sourceMapping: {
                biztalk: {
                    schemaType: schemaInfo.schemaType,
                    promotedProperties: schemaInfo.promotedProperties.map((p) => p.name),
                    distinguishedFields: schemaInfo.distinguishedFields.map((f) => f.name),
                    hasFlatFileAnnotations: schemaInfo.flatFileAnnotations !== undefined,
                },
            },
            targetMapping: {
                confidence: 'high',
            },
        } as unknown as IRSchema;

        // Add flat file config if applicable
        if (schemaInfo.flatFileAnnotations) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (irSchema as any).flatFileConfig = {
                type: schemaInfo.flatFileAnnotations.recordType,
                delimiter: schemaInfo.flatFileAnnotations.delimiter,
                wrapCharacter: schemaInfo.flatFileAnnotations.wrapChar,
                escapeCharacter: schemaInfo.flatFileAnnotations.escapeChar,
            };
        }

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        name: schemaInfo.name,
                        type: 'schema',
                        filePath: schemaInfo.filePath,
                        fileType: '.xsd',
                    },
                },
            },
            schemas: [irSchema],
        };
    }
}
