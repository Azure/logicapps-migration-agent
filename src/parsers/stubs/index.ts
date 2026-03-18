/**
 * Stub Parsers
 *
 * Placeholder parsers for platforms not yet implemented.
 * Returns "Work in Progress" status.
 *
 * @module parsers/stubs
 */

import * as path from 'path';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// Base Stub Parser
// =============================================================================

/**
 * Base class for stub parsers that return work-in-progress status.
 */
abstract class StubParser extends AbstractParser implements IArtifactParser {
    protected async doParse(
        inputPath: string,
        _options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        const name = path.basename(inputPath, path.extname(inputPath));

        // Create a minimal IR document with work-in-progress status
        const ir = createEmptyIRDocument(
            `${this.capabilities.platform}-${name}`,
            name,
            this.capabilities.platform
        );

        // Add work in progress gap
        const wipIR = {
            ...ir,
            metadata: {
                ...ir.metadata,
                migration: {
                    ...ir.metadata.migration,
                    status: 'discovered' as const,
                    notes: [
                        `Parser for ${this.capabilities.platform} is under development`,
                        'This is a placeholder IR document',
                        `Input file: ${inputPath}`,
                    ],
                },
            },
            gaps: [
                {
                    id: `gap-wip-${this.capabilities.platform}`,
                    category: 'unsupported-feature' as const,
                    severity: 'high' as const,
                    title: `${this.capabilities.platform} Parser - Work in Progress`,
                    description: `The ${this.capabilities.platform} parser is not yet implemented. This artifact cannot be fully parsed at this time.`,
                    sourceFeature: {
                        platform: this.capabilities.platform,
                        name: this.capabilities.description,
                    },
                    status: 'open' as const,
                },
            ],
        };

        errors.addWarning(
            ParseErrorCodes.NOT_IMPLEMENTED,
            `Parser for ${this.capabilities.platform} is work in progress. Full parsing not available.`,
            { filePath: inputPath }
        );

        return wipIR as unknown as IRDocument;
    }

    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        return {
            name: path.basename(filePath, path.extname(filePath)),
            type: this.capabilities.fileTypes[0] ?? 'xml',
            description: `[Work in Progress] ${this.capabilities.platform} artifact`,
        };
    }
}

// =============================================================================
// MuleSoft API Spec Parser (Stub - RAML/OAS parsing planned)
// =============================================================================

/**
 * Stub parser for MuleSoft API specs.
 * RAML and OAS specification parsing is planned for a future release.
 */
export class MuleSoftAPISpecParser extends StubParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'mulesoft',
        fileExtensions: ['.raml', '.yaml', '.yml', '.json'],
        fileTypes: ['api-spec'],
        supportsFolder: false,
        description: 'Parses MuleSoft RAML/OAS API specifications (Work in Progress)',
    };

    override canParse(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ['.raml', '.yaml', '.yml', '.json'].includes(ext);
    }
}

// =============================================================================
// Generic Parser (Stub)
// =============================================================================

/**
 * Stub parser for generic XML configurations.
 */
export class GenericXMLParser extends StubParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'generic',
        fileExtensions: ['.xml'],
        fileTypes: ['config'],
        supportsFolder: false,
        description: 'Parses generic XML configuration files (Work in Progress)',
    };
}
