/**
 * BizTalk ASMX Parser
 *
 * Parses legacy ASP.NET web service (.asmx) files into IR format.
 * ASMX files are often found in BizTalk solutions as published orchestrations
 * or standalone SOAP endpoints that need migration.
 *
 * @module parsers/biztalk/BizTalkAsmxParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// ASMX Directive Regex
// =============================================================================

/**
 * Matches the <%@ WebService ... %> directive at the top of .asmx files.
 * Captures attribute key-value pairs.
 */
const DIRECTIVE_REGEX = /<%@\s*WebService\b([^%]*)%>/i;
const ATTR_REGEX = /(\w+)\s*=\s*"([^"]*)"/gi;

/**
 * Matches [WebMethod] decorated method signatures in code-behind content.
 */
const WEB_METHOD_REGEX =
    /\[WebMethod[^\]]*\]\s*(?:public\s+)?(\w[\w<>,\s[\]]*?)\s+(\w+)\s*\(([^)]*)\)/g;

// =============================================================================
// BizTalk ASMX Parser
// =============================================================================

/**
 * Parser for legacy ASP.NET web service (.asmx) files.
 *
 * Extracts the service class name, namespace, and — when available —
 * web method signatures from the code-behind file. This provides
 * visibility into SOAP endpoints that need migration to HTTP triggers
 * or Azure Functions.
 */
export class BizTalkAsmxParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.asmx'],
        fileTypes: ['config'],
        supportsFolder: false,
        description: 'Parses legacy ASP.NET web service (.asmx) files into IR metadata',
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
        const fileName = path.basename(inputPath, '.asmx');

        this.reportProgress(options.onProgress, 1, 3, `Reading ASMX: ${fileName}`);

        // Read the .asmx directive file
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Extracting web service metadata');

        // Parse the <%@ WebService %> directive
        const directiveAttrs = this.parseDirective(content);
        const className = directiveAttrs['class'] || directiveAttrs['Class'] || fileName;
        const codeBehind = directiveAttrs['codebehind'] || directiveAttrs['CodeBehind'] || '';

        // Attempt to read code-behind for web methods
        const webMethods = await this.extractWebMethods(inputPath, codeBehind, content);

        this.reportProgress(options.onProgress, 3, 3, 'ASMX parsing complete');

        // Build IR
        const ir = createEmptyIRDocument(`asmx-${fileName}`, className, 'biztalk');

        const notes: string[] = [`Legacy ASP.NET web service: ${className}`];
        if (codeBehind) {
            notes.push(`Code-behind: ${codeBehind}`);
        }
        if (webMethods.length > 0) {
            notes.push(`Web methods: ${webMethods.map((m) => m.name).join(', ')}`);
        }
        notes.push(
            'Legacy ASMX endpoint — migrate to Logic Apps HTTP trigger, Azure Function, or API Management'
        );

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        name: className,
                        type: 'binding',
                        filePath: path.relative(options.basePath, inputPath),
                        fileType: 'asmx',
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered',
                    notes,
                },
            },
            gaps: [
                {
                    id: `gap-asmx-${fileName}`,
                    category: 'unsupported-feature' as const,
                    severity: 'high' as const,
                    title: `Legacy Web Service: ${className}`,
                    description:
                        `ASMX web service with ${webMethods.length || '?'} web method(s). ` +
                        'Needs migration to HTTP trigger, Azure Function, or API Management endpoint.',
                    sourceFeature: {
                        platform: 'biztalk',
                        feature: 'ASMX Web Service',
                        artifacts:
                            webMethods.length > 0
                                ? webMethods.map((m) => `${m.returnType} ${m.name}(${m.params})`)
                                : [className],
                    },
                    resolution: {
                        strategy: 'azure-function' as const,
                    },
                    status: 'pending' as const,
                },
            ],
        };
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Parse <%@ WebService %> directive attributes.
     */
    private parseDirective(content: string): Record<string, string> {
        const attrs: Record<string, string> = {};
        const match = DIRECTIVE_REGEX.exec(content);
        if (match) {
            const attrStr = match[1];
            let m: RegExpExecArray | null;
            const regex = new RegExp(ATTR_REGEX.source, ATTR_REGEX.flags);
            while ((m = regex.exec(attrStr)) !== null) {
                attrs[m[1].toLowerCase()] = m[2];
            }
        }
        return attrs;
    }

    /**
     * Try to extract [WebMethod] signatures from code-behind or inline code.
     */
    private async extractWebMethods(
        asmxPath: string,
        codeBehind: string,
        asmxContent: string
    ): Promise<{ name: string; returnType: string; params: string }[]> {
        const methods: { name: string; returnType: string; params: string }[] = [];

        // Try code-behind file first
        let source = '';
        if (codeBehind) {
            const cbPath = path.resolve(path.dirname(asmxPath), codeBehind);
            try {
                source = await fs.promises.readFile(cbPath, 'utf-8');
            } catch {
                // Code-behind may not exist — fall through
            }
        }

        // Also try the .asmx.cs convention
        if (!source) {
            try {
                source = await fs.promises.readFile(asmxPath + '.cs', 'utf-8');
            } catch {
                // Not found — use inline content
                source = asmxContent;
            }
        }

        let m: RegExpExecArray | null;
        const regex = new RegExp(WEB_METHOD_REGEX.source, WEB_METHOD_REGEX.flags);
        while ((m = regex.exec(source)) !== null) {
            methods.push({
                returnType: m[1].trim(),
                name: m[2],
                params: m[3].trim(),
            });
        }

        return methods;
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const fileName = path.basename(filePath, '.asmx');
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return { name: fileName, type: 'binding' };
        }

        const attrs = this.parseDirective(content);
        const className = attrs['class'] || fileName;

        return {
            name: className,
            type: 'binding',
            description: 'Legacy ASP.NET web service (.asmx)',
        };
    }
}
