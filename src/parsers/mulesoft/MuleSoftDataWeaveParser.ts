/**
 * MuleSoft DataWeave Parser
 *
 * Parses MuleSoft DataWeave (.dwl) transformation files into IR format.
 * DataWeave is MuleSoft's expression language and data transformation engine.
 *
 * DataWeave 2.0 file structure:
 * ```
 * %dw 2.0
 * output application/json
 * ---
 * {
 *   orderId: payload.id,
 *   customer: payload.customerName,
 *   items: payload.lineItems map (item) -> {
 *     productId: item.productId,
 *     quantity: item.qty
 *   }
 * }
 * ```
 *
 * @module parsers/mulesoft/MuleSoftDataWeaveParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument, IRMap, IRGap } from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// DataWeave File Structure
// =============================================================================

/**
 * Parsed DataWeave file information.
 */
interface DataWeaveInfo {
    /** File path */
    readonly filePath: string;

    /** File name (without extension) */
    readonly name: string;

    /** DataWeave version (e.g., '2.0') */
    readonly version: string;

    /** Output MIME type (e.g., 'application/json', 'application/xml') */
    readonly outputType: string;

    /** Input directives */
    readonly inputDirectives: readonly DataWeaveDirective[];

    /** Additional header directives */
    readonly headerDirectives: readonly DataWeaveDirective[];

    /** Body (transformation expression) */
    readonly body: string;

    /** Full header text */
    readonly header: string;

    /** Imported modules */
    readonly imports: readonly string[];

    /** Functions defined in the script */
    readonly functions: readonly DataWeaveFunction[];

    /** Variables defined in the header */
    readonly variables: readonly DataWeaveVariable[];

    /** Type definitions */
    readonly types: readonly string[];
}

/**
 * A DataWeave header directive.
 */
interface DataWeaveDirective {
    /** Directive type (import, var, fun, type, ns, input, output) */
    readonly type: string;

    /** Full directive text */
    readonly text: string;
}

/**
 * A DataWeave function definition.
 */
interface DataWeaveFunction {
    /** Function name */
    readonly name: string;

    /** Parameters */
    readonly parameters: string;

    /** Function body */
    readonly body: string;
}

/**
 * A DataWeave variable definition.
 */
interface DataWeaveVariable {
    /** Variable name */
    readonly name: string;

    /** Value expression */
    readonly value: string;
}

// =============================================================================
// MuleSoft DataWeave Parser
// =============================================================================

/**
 * Parser for MuleSoft DataWeave (.dwl) transformation files.
 *
 * Converts DataWeave scripts to IR Map entries that describe
 * the transformation for subsequent conversion to Liquid templates
 * or Azure Function code.
 */
export class MuleSoftDataWeaveParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'mulesoft',
        fileExtensions: ['.dwl'],
        fileTypes: ['transform'],
        supportsFolder: false,
        description: 'Parses MuleSoft DataWeave (.dwl) transformation files into IR maps',
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
            `Reading DataWeave file: ${path.basename(inputPath)}`
        );

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Verify this is a DataWeave file
        if (!this.isDataWeaveFile(content)) {
            errors.addWarning(
                ParseErrorCodes.UNSUPPORTED_FORMAT,
                'File does not appear to be a DataWeave script (missing %dw header)',
                { filePath: inputPath }
            );
        }

        this.reportProgress(options.onProgress, 2, 3, 'Parsing DataWeave structure');

        // Parse DataWeave structure
        const dwInfo = this.parseDataWeave(content, inputPath);

        // Check cancellation
        if (this.isCancelled(options.cancellationToken)) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return null;
        }

        this.reportProgress(options.onProgress, 3, 3, 'Converting to IR');

        // Convert to IR
        return this.convertToIR(dwInfo, errors);
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return {
                name: path.basename(filePath, '.dwl'),
                type: 'transform',
            };
        }

        const dwInfo = this.parseDataWeave(content, filePath);

        return {
            name: dwInfo.name,
            type: 'transform',
            elementCount: dwInfo.functions.length,
            description: `DataWeave ${dwInfo.version} → ${dwInfo.outputType}`,
        };
    }

    // =========================================================================
    // DataWeave Detection
    // =========================================================================

    /**
     * Check if content is a DataWeave file.
     */
    private isDataWeaveFile(content: string): boolean {
        const trimmed = content.trimStart();
        return trimmed.startsWith('%dw');
    }

    // =========================================================================
    // DataWeave Parsing
    // =========================================================================

    /**
     * Parse DataWeave content into structured info.
     *
     * DataWeave file format:
     *   Header section (directives)
     *   ---
     *   Body section (transformation expression)
     */
    private parseDataWeave(content: string, filePath: string): DataWeaveInfo {
        const name = path.basename(filePath, '.dwl');

        // Split into header and body at the "---" separator
        const separatorIndex = content.indexOf('\n---');
        let header: string;
        let body: string;

        if (separatorIndex >= 0) {
            header = content.substring(0, separatorIndex).trim();
            body = content.substring(separatorIndex + 4).trim();
        } else {
            // No separator - treat entire content as body
            header = '';
            body = content.trim();
        }

        // Parse header directives
        const lines = header
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        let version = '2.0';
        let outputType = 'application/json';
        const inputDirectives: DataWeaveDirective[] = [];
        const headerDirectives: DataWeaveDirective[] = [];
        const imports: string[] = [];
        const functions: DataWeaveFunction[] = [];
        const variables: DataWeaveVariable[] = [];
        const types: string[] = [];

        for (const line of lines) {
            // Version directive: %dw 2.0
            if (line.startsWith('%dw')) {
                const versionMatch = line.match(/%dw\s+([\d.]+)/);
                if (versionMatch && versionMatch[1]) {
                    version = versionMatch[1];
                }
                headerDirectives.push({ type: 'version', text: line });
                continue;
            }

            // Output directive: output application/json
            if (line.startsWith('output')) {
                const outputMatch = line.match(/output\s+(\S+)/);
                if (outputMatch && outputMatch[1]) {
                    outputType = outputMatch[1];
                }
                headerDirectives.push({ type: 'output', text: line });
                continue;
            }

            // Input directive: input payload application/json
            if (line.startsWith('input')) {
                inputDirectives.push({ type: 'input', text: line });
                headerDirectives.push({ type: 'input', text: line });
                continue;
            }

            // Import directive: import * from dw::core::Strings
            if (line.startsWith('import')) {
                const importMatch = line.match(/import\s+(.+)/);
                if (importMatch && importMatch[1]) {
                    imports.push(importMatch[1]);
                }
                headerDirectives.push({ type: 'import', text: line });
                continue;
            }

            // Variable directive: var myVar = "value"
            if (line.startsWith('var')) {
                const varMatch = line.match(/var\s+(\w+)\s*=\s*(.+)/);
                if (varMatch && varMatch[1] && varMatch[2]) {
                    variables.push({ name: varMatch[1], value: varMatch[2] });
                }
                headerDirectives.push({ type: 'var', text: line });
                continue;
            }

            // Function directive: fun myFunc(param) = param + 1
            if (line.startsWith('fun')) {
                const funMatch = line.match(/fun\s+(\w+)\(([^)]*)\)\s*=\s*(.+)/);
                if (funMatch && funMatch[1] && funMatch[2] !== undefined) {
                    functions.push({
                        name: funMatch[1],
                        parameters: funMatch[2],
                        body: funMatch[3] || '',
                    });
                }
                headerDirectives.push({ type: 'fun', text: line });
                continue;
            }

            // Type directive: type MyType = String
            if (line.startsWith('type')) {
                types.push(line);
                headerDirectives.push({ type: 'type', text: line });
                continue;
            }

            // Namespace directive: ns ns0 http://example.com
            if (line.startsWith('ns')) {
                headerDirectives.push({ type: 'ns', text: line });
                continue;
            }

            // Other header content
            headerDirectives.push({ type: 'other', text: line });
        }

        // Also parse multi-line functions from body (standalone .dwl modules)
        const bodyFunctions = this.parseBodyFunctions(body);
        functions.push(...bodyFunctions);

        return {
            filePath,
            name,
            version,
            outputType,
            inputDirectives,
            headerDirectives,
            body,
            header,
            imports,
            functions,
            variables,
            types,
        };
    }

    /**
     * Parse function definitions from the body of a DataWeave module.
     */
    private parseBodyFunctions(body: string): DataWeaveFunction[] {
        const functions: DataWeaveFunction[] = [];
        const funRegex = /fun\s+(\w+)\s*\(([^)]*)\)\s*=\s*/g;
        let match;

        while ((match = funRegex.exec(body)) !== null) {
            if (match[1] && match[2] !== undefined) {
                functions.push({
                    name: match[1],
                    parameters: match[2],
                    body: '(extracted from body)',
                });
            }
        }

        return functions;
    }

    // =========================================================================
    // IR Conversion
    // =========================================================================

    /**
     * Convert DataWeave info to IR document.
     */
    private convertToIR(dwInfo: DataWeaveInfo, _errors: ParseErrorAccumulator): IRDocument {
        const ir = createEmptyIRDocument(
            `mulesoft-dw-${this.sanitizeId(dwInfo.name)}`,
            dwInfo.name,
            'mulesoft'
        );

        // Create IR Map
        const irMap: Record<string, unknown> = {
            id: `map-${this.sanitizeId(dwInfo.name)}`,
            name: dwInfo.name,
            type: 'dataweave',
            version: dwInfo.version,
            file: {
                sourceFile: path.basename(dwInfo.filePath),
            },
            sourceMapping: {
                mulesoft: {
                    script: path.basename(dwInfo.filePath),
                    language: 'dataweave',
                    version: dwInfo.version,
                    mimeType: dwInfo.outputType,
                    imports: dwInfo.imports,
                    functions: dwInfo.functions.map((f) => f.name),
                    variables: dwInfo.variables.map((v) => v.name),
                    types: dwInfo.types,
                },
            },
            targetMapping: {
                type: 'liquid',
                conversionNeeded: true,
                gap: true,
                notes: 'DataWeave must be converted to Liquid template or Azure Function',
            },
        };

        // Create gap for DataWeave conversion
        const gap: Record<string, unknown> = {
            id: `gap-dw-${this.sanitizeId(dwInfo.name)}`,
            category: 'complex-logic',
            severity: this.assessDataWeaveComplexity(dwInfo),
            title: `DataWeave Conversion: ${dwInfo.name}`,
            description: this.buildGapDescription(dwInfo),
            sourceFeature: {
                platform: 'mulesoft',
                name: `DataWeave ${dwInfo.version} script`,
            },
            status: 'open',
            resolution: {
                strategy: 'alternative',
                pattern: 'liquid-template',
                description: this.buildResolutionDescription(dwInfo),
                effort: {
                    hours: this.estimateConversionEffort(dwInfo),
                },
            },
        };

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    platform: 'mulesoft',
                    artifact: {
                        name: dwInfo.name,
                        type: 'map',
                        filePath: dwInfo.filePath,
                        fileType: 'dwl',
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered',
                    complexity:
                        this.assessDataWeaveComplexity(dwInfo) === 'critical'
                            ? 'very-high'
                            : 'medium',
                    notes: [
                        `DataWeave ${dwInfo.version} script`,
                        `Output: ${dwInfo.outputType}`,
                        `Functions: ${dwInfo.functions.length}`,
                        `Imports: ${dwInfo.imports.length}`,
                    ],
                },
            },
            maps: [irMap as unknown as IRMap],
            gaps: [gap as unknown as IRGap],
            extensions: {
                mulesoft: {
                    dataweaveVersion: dwInfo.version,
                    outputType: dwInfo.outputType,
                    header: dwInfo.header,
                    body: dwInfo.body,
                },
            },
        } as unknown as IRDocument;
    }

    // =========================================================================
    // Complexity Assessment
    // =========================================================================

    /**
     * Assess the complexity of a DataWeave conversion.
     */
    private assessDataWeaveComplexity(
        dwInfo: DataWeaveInfo
    ): 'low' | 'medium' | 'high' | 'critical' {
        let score = 0;

        // Body length indicates complexity
        if (dwInfo.body.length > 1000) {
            score += 3;
        } else if (dwInfo.body.length > 500) {
            score += 2;
        } else if (dwInfo.body.length > 100) {
            score += 1;
        }

        // Functions add complexity
        score += dwInfo.functions.length * 2;

        // Imports suggest advanced usage
        score += dwInfo.imports.length;

        // Custom types add complexity
        score += dwInfo.types.length * 2;

        // XML output is more complex to convert to Liquid
        if (dwInfo.outputType.includes('xml')) {
            score += 2;
        }

        // Check for complex DataWeave patterns in body
        const complexPatterns = [
            'reduce',
            'pluck',
            'groupBy',
            'orderBy',
            'distinctBy',
            'flatMap',
            'zip',
            'unzip',
            'joinBy',
            'splitBy',
            'match',
            'scan',
            'replace',
            'do',
            'using',
            'try',
            'update',
            'mask',
        ];
        for (const pattern of complexPatterns) {
            if (dwInfo.body.includes(pattern)) {
                score += 1;
            }
        }

        // Recursive functions
        if (dwInfo.body.includes('fun ') && dwInfo.body.includes('$')) {
            score += 2;
        }

        if (score <= 2) {
            return 'low';
        }
        if (score <= 5) {
            return 'medium';
        }
        if (score <= 10) {
            return 'high';
        }
        return 'critical';
    }

    /**
     * Estimate conversion effort in hours.
     */
    private estimateConversionEffort(dwInfo: DataWeaveInfo): number {
        const complexity = this.assessDataWeaveComplexity(dwInfo);

        switch (complexity) {
            case 'low':
                return 1;
            case 'medium':
                return 4;
            case 'high':
                return 8;
            case 'critical':
                return 16;
        }
    }

    /**
     * Build a description for the DataWeave gap.
     */
    private buildGapDescription(dwInfo: DataWeaveInfo): string {
        const parts: string[] = [
            `DataWeave ${dwInfo.version} script '${dwInfo.name}' needs conversion.`,
            `Output type: ${dwInfo.outputType}.`,
        ];

        if (dwInfo.functions.length > 0) {
            parts.push(
                `Contains ${dwInfo.functions.length} custom function(s): ${dwInfo.functions.map((f) => f.name).join(', ')}.`
            );
        }

        if (dwInfo.imports.length > 0) {
            parts.push(`Imports: ${dwInfo.imports.join(', ')}.`);
        }

        if (dwInfo.variables.length > 0) {
            parts.push(`Variables: ${dwInfo.variables.map((v) => v.name).join(', ')}.`);
        }

        return parts.join(' ');
    }

    /**
     * Build resolution description.
     */
    private buildResolutionDescription(dwInfo: DataWeaveInfo): string {
        if (dwInfo.outputType.includes('json')) {
            return 'Convert to Liquid template for JSON output. Simple field mappings can use inline expressions.';
        }
        if (dwInfo.outputType.includes('xml')) {
            return 'Convert to XSLT or Liquid template for XML output. Consider Azure Function for complex transformations.';
        }
        return 'Convert to Liquid template or implement as Azure Function for complex transformation logic.';
    }

    // =========================================================================
    // Utility
    // =========================================================================

    /**
     * Sanitize a string for use as an ID.
     */
    private sanitizeId(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
