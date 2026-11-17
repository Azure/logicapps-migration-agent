/**
 * Dell Boomi Component Parsers
 *
 * Parsers for non-process Boomi components: connections and connector
 * operations, maps, profiles, trading partners and other components
 * (scripts, process properties, cross-reference tables, ...).
 *
 * Each parser declares a distinct file type so discovery can categorize the
 * resulting artifacts (connector, map, schema, b2b, config).
 *
 * @module parsers/boomi/BoomiComponentParsers
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import { IRConnection } from '../../ir/types/connections';
import { IRGap } from '../../ir/types/advanced';
import { ArtifactType, ComplexityLevel } from '../../ir/types/common';
import { parseXml } from '../utils/xml';
import {
    attr,
    childElements,
    classifyBoomiFile,
    descendants,
    getProjectIndex,
    localName,
    readComponentRef,
    readMap,
} from './BoomiComponentReader';
import { mapConnector } from './BoomiMappings';
import { boomiConnectionToIr, sanitizeId } from './BoomiIrHelpers';
import { BoomiComponentKind, BoomiComponentRef, BoomiMap } from './types';

type ParseOpts = Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
    onProgress?: ProgressCallback;
    cancellationToken?: vscode.CancellationToken;
    basePath: string;
};

interface ComponentIrParts {
    readonly artifactType: ArtifactType;
    readonly complexity?: ComplexityLevel;
    readonly notes: string[];
    readonly connections?: IRConnection[];
    readonly gaps?: IRGap[];
    readonly extension: Record<string, unknown>;
}

/**
 * Base class for single-component Boomi parsers.
 */
abstract class BoomiComponentParserBase extends AbstractParser implements IArtifactParser {
    abstract override readonly capabilities: ParserCapabilities;

    /** Component kinds handled by this parser. */
    protected abstract readonly kinds: readonly BoomiComponentKind[];

    override canParse(filePath: string): boolean {
        const kind = classifyBoomiFile(filePath);
        return kind !== null && this.kinds.includes(kind);
    }

    protected abstract buildParts(
        ref: BoomiComponentRef,
        content: string,
        doc: Document | null,
        inputPath: string
    ): ComponentIrParts;

    protected async doParse(
        inputPath: string,
        options: ParseOpts,
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        this.reportProgress(
            options.onProgress,
            1,
            2,
            `Reading Boomi component: ${path.basename(inputPath)}`
        );
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        const ext = path.extname(inputPath).toLowerCase();
        const isJson = ext === '.json';
        const isXml = ext === '.xml' || ext === '.xsd';
        let doc: Document | null = null;
        if (isJson) {
            try {
                JSON.parse(content);
            } catch (error) {
                errors.addError(ParseErrorCodes.INVALID_JSON, `Invalid JSON: ${String(error)}`, {
                    filePath: inputPath,
                });
                return null;
            }
        } else if (isXml) {
            doc = parseXml(content);
            if (!doc || !doc.documentElement) {
                errors.addError(
                    ParseErrorCodes.INVALID_XML,
                    'Boomi component file is not valid XML',
                    {
                        filePath: inputPath,
                    }
                );
                return null;
            }
        }

        const ref = readComponentRef(inputPath, ext === '.xml' ? content : undefined);
        if (!ref) {
            errors.addError(
                ParseErrorCodes.UNSUPPORTED_FORMAT,
                'File is not a recognized Boomi component',
                {
                    filePath: inputPath,
                }
            );
            return null;
        }

        this.reportProgress(options.onProgress, 2, 2, 'Converting Boomi component to IR');
        const parts = this.buildParts(ref, content, doc, inputPath);
        const ir = createEmptyIRDocument(`boomi-${ref.kind}-${ref.name}`, ref.name, 'boomi');

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        ...ir.metadata.source.artifact,
                        name: ref.name,
                        type: parts.artifactType,
                        filePath: inputPath,
                        fileType: path.extname(inputPath).slice(1).toLowerCase(),
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    complexity: parts.complexity || 'low',
                    notes: parts.notes,
                },
            },
            connections: parts.connections || [],
            gaps: parts.gaps || [],
            extensions: {
                ...ir.extensions,
                boomi: {
                    componentType: ref.kind,
                    dialect: ref.dialect,
                    ...(ref.componentId ? { componentId: ref.componentId } : {}),
                    ...(ref.componentType ? { nativeType: ref.componentType } : {}),
                    sourceFile: path.basename(inputPath),
                    ...parts.extension,
                },
            },
        };
    }

    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const ref = readComponentRef(filePath);
        return {
            name: ref?.name || path.basename(filePath, path.extname(filePath)),
            type: ref?.kind || 'component',
            description: ref ? `Boomi ${ref.kind} component` : 'Boomi component',
        };
    }
}

/**
 * Parser for Boomi connections (connector-settings) and connector operations (connector-action).
 */
export class BoomiConnectorParser extends BoomiComponentParserBase {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.xml', '.json'],
        fileTypes: ['connector'],
        supportsFolder: false,
        description: 'Parses Dell Boomi connection and connector operation components',
    };
    protected readonly kinds: readonly BoomiComponentKind[] = ['connection', 'operation'];

    protected buildParts(
        ref: BoomiComponentRef,
        content: string,
        doc: Document | null
    ): ComponentIrParts {
        const index = getProjectIndex(ref.filePath);
        const connRef = ref.kind === 'connection' ? ref : index.find(ref.connection);
        const connectorType = ref.connectorType || connRef?.connectorType;
        const mapping = mapConnector(connectorType);
        const secretPlaceholders = doc
            ? descendants(doc.documentElement, 'secret')
                  .map((s) => attr(s, 'value') || '')
                  .filter((v) => /^\$\{[^}]+\}$/.test(v))
                  .map((v) => v.slice(2, -1))
            : [...new Set([...content.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]))];
        const connections = connRef ? [boomiConnectionToIr(connRef)] : [];
        const gaps: IRGap[] = mapping.gap
            ? [
                  {
                      id: `gap-connector-${sanitizeId(ref.name)}`,
                      category: 'unsupported-adapter',
                      severity: 'medium',
                      title: `Connector requires assessment: ${connectorType || 'unknown'}`,
                      description: `Boomi connector '${connectorType || 'unknown'}' has no direct Logic Apps Standard connector mapping.`,
                      sourceFeature: { platform: 'boomi', name: connectorType || 'unknown' },
                      status: 'open',
                  } as unknown as IRGap,
              ]
            : [];

        return {
            artifactType: 'binding',
            notes: [
                ref.kind === 'connection'
                    ? `Boomi ${connectorType || 'unknown'} connection → ${mapping.logicAppsAction}.`
                    : `Boomi ${ref.operation || ''} operation on ${connRef?.name || ref.connection || 'unknown connection'} → ${mapping.logicAppsAction}.`.replace(
                          '  ',
                          ' '
                      ),
            ],
            connections,
            gaps,
            extension: {
                connectorType: connectorType || 'unknown',
                ...(ref.auth ? { authenticationType: ref.auth } : {}),
                ...(ref.kind === 'operation'
                    ? {
                          operation: ref.operation || 'unknown',
                          connection: connRef?.name || ref.connection,
                      }
                    : {}),
                ...(secretPlaceholders.length > 0 ? { secretPlaceholders } : {}),
                logicAppsConnector: mapping.logicAppsAction,
                builtIn: mapping.builtIn,
            },
        };
    }
}

/**
 * Parser for Boomi maps (transform.map).
 */
export class BoomiMapParser extends BoomiComponentParserBase {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.xml', '.json'],
        fileTypes: ['map'],
        supportsFolder: false,
        description: 'Parses Dell Boomi map components',
    };
    protected readonly kinds: readonly BoomiComponentKind[] = ['map'];

    protected buildParts(
        ref: BoomiComponentRef,
        content: string,
        doc: Document | null,
        inputPath: string
    ): ComponentIrParts {
        const map = doc ? readMap(doc, inputPath) : readJsonMap(content, ref.name);
        const fields = map?.fields || [];
        const functionCount = map?.functionCount || 0;
        const complexity: ComplexityLevel =
            functionCount > 10 || fields.length > 100
                ? 'high'
                : functionCount > 0 || fields.length > 20
                  ? 'medium'
                  : 'low';
        const targetsEdi =
            fields.some((f) => /^[A-Z]{2,3}\d{2}$/.test(f.target)) ||
            /edi|x12|edifact/i.test(`${ref.name} ${map?.toProfile || ''}`);
        const sourcesEdi =
            fields.some((f) => /^[A-Z]{2,3}\d{2}$/.test(f.source)) ||
            /x12|edifact/i.test(map?.fromProfile || '');
        return {
            artifactType: 'map',
            complexity,
            notes: [
                `Boomi map with ${fields.length} field mapping(s) and ${functionCount} function step(s).`,
                targetsEdi
                    ? 'Targets EDI segments — consider X12/EDIFACT encode with Integration Account schemas plus XSLT.'
                    : sourcesEdi
                      ? 'Reads EDI segments — X12/EDIFACT decode to XML, then Data Mapper (XSLT) to the canonical model.'
                      : 'Candidate for Data Mapper (XSLT) or Liquid template.',
                ...(map?.lookups?.length
                    ? [`Uses cross-reference lookups: ${map.lookups.join(', ')}.`]
                    : []),
            ],
            extension: {
                fieldCount: fields.length,
                fields,
                functionCount,
                ...(map?.fromProfile ? { fromProfile: map.fromProfile } : {}),
                ...(map?.toProfile ? { toProfile: map.toProfile } : {}),
                ...(map?.lookups?.length ? { lookups: map.lookups } : {}),
                ...(map?.validations?.length ? { validations: map.validations } : {}),
                targetsEdi,
                sourcesEdi,
            },
        };
    }
}

/**
 * Parser for Boomi profiles (XML/JSON/flat-file/EDI/database profiles).
 */
export class BoomiProfileParser extends BoomiComponentParserBase {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.xml', '.json', '.xsd'],
        fileTypes: ['schema'],
        supportsFolder: false,
        description: 'Parses Dell Boomi profile components and JSON profile schemas',
    };
    protected readonly kinds: readonly BoomiComponentKind[] = ['profile'];

    protected buildParts(
        ref: BoomiComponentRef,
        content: string,
        doc: Document | null
    ): ComponentIrParts {
        let profileType = ref.componentType || 'profile';
        let elementCount = 0;
        const ext = path.extname(ref.filePath).toLowerCase();
        if (ext === '.xsd' && doc?.documentElement) {
            profileType = 'profile.xml';
            elementCount = descendants(doc.documentElement, 'element').length;
        } else if (ext === '.json') {
            profileType = 'profile.json';
            try {
                const schema = JSON.parse(content) as { properties?: Record<string, unknown> };
                elementCount = Object.keys(schema.properties || {}).length;
            } catch {
                elementCount = 0;
            }
        } else if (doc?.documentElement) {
            elementCount =
                descendants(doc.documentElement, 'XMLElement').length +
                descendants(doc.documentElement, 'JSONObjectEntry').length +
                descendants(doc.documentElement, 'FlatFileElement').length +
                descendants(doc.documentElement, 'EdiDataElement').length;
        }
        const isEdi = /edi/i.test(profileType);
        return {
            artifactType: 'schema',
            notes: [
                `Boomi ${profileType} with ${elementCount} element(s).`,
                isEdi
                    ? 'EDI profile → Integration Account X12/EDIFACT schema.'
                    : profileType.includes('flatfile')
                      ? 'Flat-file profile → Flat File schema (XSD with flat-file annotations).'
                      : 'Profile → XSD / JSON schema for Parse JSON, XML Validation and Data Mapper.',
            ],
            extension: { profileType, elementCount },
        };
    }
}

/**
 * Parser for Boomi trading partner components (B2B/EDI).
 */
export class BoomiTradingPartnerParser extends BoomiComponentParserBase {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.xml', '.json'],
        fileTypes: ['b2b'],
        supportsFolder: false,
        description: 'Parses Dell Boomi trading partner components',
    };
    protected readonly kinds: readonly BoomiComponentKind[] = ['trading-partner'];

    protected buildParts(
        ref: BoomiComponentRef,
        content: string,
        doc: Document | null
    ): ComponentIrParts {
        const root = doc?.documentElement;
        const standard =
            ref.standard?.toUpperCase() ||
            (root && (attr(root, 'standard') || attr(root, 'standardType'))) ||
            /\b(x12|edifact|hl7|tradacoms|rosettanet|odette)\b/i
                .exec(content)?.[1]
                ?.toUpperCase() ||
            'unknown';
        const transport =
            ref.communication?.toUpperCase() ||
            (root && (attr(root, 'transport') || attr(root, 'communicationMethod'))) ||
            /\b(as2|sftp|ftp|http|mllp|disk)\b/i.exec(content)?.[1]?.toUpperCase() ||
            'unknown';
        const transactionSets = ref.documents
            ? [...ref.documents]
            : root
              ? descendants(root, 'document')
                    .map((d) => attr(d, 'transactionSet') || attr(d, 'type') || '')
                    .filter(Boolean)
              : [];
        return {
            artifactType: 'binding',
            complexity: 'medium',
            notes: [
                `Trading partner using ${standard} over ${transport}.`,
                'Requires an Integration Account (partners, agreements, schemas) and the built-in X12/EDIFACT/AS2 actions.',
            ],
            gaps: [
                {
                    id: `gap-b2b-${sanitizeId(ref.name)}`,
                    category: 'b2b',
                    severity: 'medium',
                    title: `B2B trading partner: ${ref.name}`,
                    description: `${standard} trading partner over ${transport} requires Integration Account partner/agreement setup.`,
                    sourceFeature: { platform: 'boomi', name: `Trading Partner (${standard})` },
                    status: 'open',
                } as unknown as IRGap,
            ],
            extension: { standard, transport, transactionSets },
        };
    }
}

/**
 * Parser for other Boomi components (process properties, cross-reference
 * tables, environment extensions, certificates, ...).
 */
export class BoomiComponentParser extends BoomiComponentParserBase {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.xml', '.json', '.yaml', '.yml', '.properties', '.csv', '.edi', '.x12'],
        fileTypes: ['config'],
        supportsFolder: false,
        description:
            'Parses other Dell Boomi components (process properties, cross references, environment extensions)',
    };
    protected readonly kinds: readonly BoomiComponentKind[] = [
        'process-property',
        'cross-reference',
        'environment',
        'test-asset',
        'component',
    ];

    protected buildParts(
        ref: BoomiComponentRef,
        content: string,
        doc: Document | null
    ): ComponentIrParts {
        const root = doc?.documentElement;
        const ext = path.extname(ref.filePath).toLowerCase();
        const hint: Record<string, string> = {
            'process-property':
                'Process properties → app settings (local.settings.json) referenced via @appsetting() or workflow parameters.',
            'cross-reference':
                'Cross-reference table → Integration Account map/lookup, Azure Table Storage or a parameters.json lookup object.',
            environment:
                'Environment extensions/deployment settings → per-environment app settings, parameters.json and Bicep parameters.',
            'test-asset':
                'Sample payload / expected output / test definition → reuse as runtime validation test data for the converted workflows.',
            component: 'Review component usage and map to the closest Logic Apps capability.',
        };
        const extension: Record<string, unknown> = {};
        if (root) {
            extension['rootElement'] = localName(root);
            extension['childCount'] = childElements(root).length;
        } else if (ext === '.properties') {
            // Only property names and environment placeholders are retained; values may be secrets.
            extension['propertyNames'] = content
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
                .map((line) => line.split(/[=:]/)[0].trim())
                .filter(Boolean);
            extension['environmentPlaceholders'] = [...content.matchAll(/\$\{([^}]+)\}/g)].map(
                (m) => m[1]
            );
        } else if (ext === '.csv') {
            const rows = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
            extension['columns'] = rows.length > 0 ? rows[0].split(',').map((c) => c.trim()) : [];
            extension['rowCount'] = Math.max(rows.length - 1, 0);
        } else if (ext === '.json') {
            const parsed = JSON.parse(content) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                extension['topLevelKeys'] = Object.keys(parsed);
                const cases = (parsed as Record<string, unknown>)['cases'];
                if (ref.kind === 'test-asset' && Array.isArray(cases)) {
                    extension['testCaseCount'] = cases.length;
                }
            }
        } else if (ext === '.edi' || ext === '.x12') {
            Object.assign(extension, summarizeEdi(content));
        }
        return {
            artifactType: 'binding',
            notes: [hint[ref.kind] || hint.component],
            extension,
        };
    }
}

/**
 * Parser for Boomi API Service components and OpenAPI/Swagger definitions.
 */
export class BoomiApiParser extends BoomiComponentParserBase {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.json', '.yaml', '.yml'],
        fileTypes: ['api-spec'],
        supportsFolder: false,
        description: 'Parses Dell Boomi API Service definitions (OpenAPI/Swagger)',
    };
    protected readonly kinds: readonly BoomiComponentKind[] = ['api'];

    protected buildParts(ref: BoomiComponentRef, content: string): ComponentIrParts {
        const operations: { method: string; path: string; operationId?: string }[] = [];
        let title: string | undefined;
        let specVersion: string | undefined;
        if (path.extname(ref.filePath).toLowerCase() === '.json') {
            const spec = JSON.parse(content) as {
                openapi?: string;
                swagger?: string;
                info?: { title?: string };
                paths?: Record<string, Record<string, { operationId?: string } | undefined>>;
            };
            specVersion = spec.openapi || spec.swagger;
            title = spec.info?.title;
            for (const [route, methods] of Object.entries(spec.paths || {})) {
                for (const [method, op] of Object.entries(methods || {})) {
                    if (/^(get|put|post|delete|patch|head|options)$/i.test(method)) {
                        operations.push({
                            method: method.toUpperCase(),
                            path: route,
                            ...(op?.operationId ? { operationId: op.operationId } : {}),
                        });
                    }
                }
            }
        }
        return {
            artifactType: 'binding',
            notes: [
                `API definition${title ? ` '${title}'` : ''} with ${operations.length} operation(s).`,
                'Boomi API Service → Logic Apps Request trigger per operation (relativePath + method), optionally fronted by Azure API Management.',
            ],
            extension: {
                ...(specVersion ? { specVersion } : {}),
                ...(title ? { title } : {}),
                operations,
            },
        };
    }
}

/**
 * Parser for Boomi custom scripts (Groovy / JavaScript), either as native
 * script components or as standalone script files in a Boomi project.
 */
export class BoomiScriptParser extends BoomiComponentParserBase {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.xml', '.groovy', '.js'],
        // 'project' is normalized to the custom-code discovery category.
        fileTypes: ['project'],
        supportsFolder: false,
        description: 'Parses Dell Boomi custom scripts (Groovy/JavaScript)',
    };
    protected readonly kinds: readonly BoomiComponentKind[] = ['script'];

    protected buildParts(
        ref: BoomiComponentRef,
        content: string,
        doc: Document | null
    ): ComponentIrParts {
        const ext = path.extname(ref.filePath).toLowerCase();
        const isJavaScript =
            ext === '.js' ||
            (ext === '.xml' &&
                (/javascript/i.test(ref.componentType || '') ||
                    /language="javascript"/i.test(content)));
        const language = isJavaScript ? 'javascript' : 'groovy';
        const code = doc?.documentElement
            ? (findScriptText(doc.documentElement) ?? content)
            : content;
        const lineCount = code.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
        const usesDynamicProperties =
            /\b(properties\.(get|set)Property|ExecutionUtil\.(get|set)DynamicProcessProperty)/.test(
                code
            );
        const usesDocumentStream = /\bdataContext\b/.test(code);
        return {
            artifactType: 'binding',
            complexity: lineCount > 50 ? 'high' : 'medium',
            notes: [
                `${isJavaScript ? 'JavaScript' : 'Groovy'} script with ${lineCount} line(s) of code.`,
                isJavaScript
                    ? 'Re-implement as an Inline Code (JavaScript) action.'
                    : 'Groovy is not supported by Logic Apps: port to an Inline Code (JavaScript) action or a local .NET function.',
            ],
            gaps: [
                {
                    id: `gap-script-${sanitizeId(ref.name)}`,
                    category: 'custom-code',
                    severity: 'medium',
                    title: `Custom script: ${ref.name}`,
                    description:
                        'Boomi custom scripting must be re-implemented as an Inline Code action or a local .NET function.',
                    sourceFeature: { platform: 'boomi', name: `Custom Scripting (${language})` },
                    status: 'open',
                } as unknown as IRGap,
            ],
            extension: { language, lineCount, usesDynamicProperties, usesDocumentStream },
        };
    }
}

function findScriptText(root: Element): string | undefined {
    for (const name of ['script', 'scripttext', 'code']) {
        const text = descendants(root, name)[0]?.textContent?.trim();
        if (text) {
            return text;
        }
    }
    return undefined;
}
/**
 * Read a JSON map definition (`{ source, target, rules: [...] }`) used by
 * migration corpora. Rules are either `{from,to}` pairs, `{loop, mappings}`
 * blocks or free-text descriptions.
 */
function readJsonMap(content: string, name: string): BoomiMap | null {
    let json: Record<string, unknown>;
    try {
        json = JSON.parse(content) as Record<string, unknown>;
    } catch {
        return null;
    }
    const fields: { source: string; target: string }[] = [];
    const lookups = new Set<string>();
    const validations: string[] = [];
    let functionCount = 0;
    const rules = Array.isArray(json['rules']) ? (json['rules'] as unknown[]) : [];
    for (const rule of rules) {
        if (!rule || typeof rule !== 'object') {
            continue;
        }
        const r = rule as Record<string, unknown>;
        if (typeof r['from'] === 'string' && typeof r['to'] === 'string') {
            fields.push({ source: r['from'], target: r['to'] });
        }
        if (r['function'] || r['default'] !== undefined) {
            functionCount++;
        }
        if (r['mappings'] && typeof r['mappings'] === 'object') {
            for (const [source, target] of Object.entries(r['mappings'] as object)) {
                fields.push({ source, target: String(target) });
            }
        }
        for (const lookup of Array.isArray(r['lookups']) ? (r['lookups'] as unknown[]) : []) {
            lookups.add(String(lookup));
        }
        for (const check of Array.isArray(r['validation']) ? (r['validation'] as unknown[]) : []) {
            validations.push(String(check));
        }
    }
    // Free-text rules describe logic without field-level detail.
    functionCount += rules.filter((r) => typeof r === 'string').length;
    return {
        name: typeof json['name'] === 'string' ? json['name'] : name,
        dialect: 'file',
        fields,
        functionCount,
        ...(typeof json['source'] === 'string' ? { fromProfile: json['source'] } : {}),
        ...(typeof json['target'] === 'string' ? { toProfile: json['target'] } : {}),
        lookups: [...lookups],
        validations,
    };
}

/** Summarize a raw EDI interchange (standard and transaction sets) without retaining content. */
function summarizeEdi(content: string): Record<string, unknown> {
    const text = content.trim();
    const isX12 = text.startsWith('ISA');
    const segmentTerminator = isX12 && text.length > 105 ? text[105] : '~';
    const elementSeparator = isX12 ? text[3] : '*';
    const segments = text
        .split(segmentTerminator)
        .map((segment) => segment.trim())
        .filter(Boolean);
    const transactionSets = segments
        .filter((segment) => segment.startsWith(`ST${elementSeparator}`))
        .map((segment) => segment.split(elementSeparator)[1])
        .filter(Boolean);
    return {
        ediStandard: isX12
            ? 'X12'
            : text.startsWith('UNA') || text.startsWith('UNB')
              ? 'EDIFACT'
              : 'unknown',
        segmentCount: segments.length,
        transactionSets: [...new Set(transactionSets)],
    };
}
