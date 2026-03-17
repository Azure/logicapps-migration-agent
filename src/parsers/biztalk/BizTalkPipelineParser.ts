/**
 * BizTalk Pipeline Parser
 *
 * Parses BizTalk .btp pipeline files into IR format.
 *
 * @module parsers/biztalk/BizTalkPipelineParser
 */

import * as path from 'path';
import * as fs from 'fs';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import {
    BizTalkPipelineInfo,
    BizTalkPipelineType,
    BizTalkPipelineStage,
    BizTalkPipelineStageInfo,
    BizTalkPipelineComponent,
} from './types';
import { parseXml, getAttr, getAllElements, getElementText } from '../utils/xml';
import {
    IRDocument,
    createEmptyIRDocument,
    IRMessageProcessingConfig,
    ProcessingStage,
} from '../../ir/types';
import * as vscode from 'vscode';

// =============================================================================
// Standard Pipeline Component Types
// =============================================================================

const STANDARD_COMPONENTS: Record<string, { name: string; stage: BizTalkPipelineStage }> = {
    'Microsoft.BizTalk.Component.XmlDasmComp': { name: 'XML Disassembler', stage: 'Disassemble' },
    'Microsoft.BizTalk.Component.XmlAsmComp': { name: 'XML Assembler', stage: 'Assemble' },
    'Microsoft.BizTalk.Component.FFDasmComp': {
        name: 'Flat File Disassembler',
        stage: 'Disassemble',
    },
    'Microsoft.BizTalk.Component.FFAsmComp': { name: 'Flat File Assembler', stage: 'Assemble' },
    'Microsoft.BizTalk.Component.JsonDecoder': { name: 'JSON Decoder', stage: 'Decode' },
    'Microsoft.BizTalk.Component.JsonEncoder': { name: 'JSON Encoder', stage: 'Encode' },
    'Microsoft.BizTalk.Component.MIME_SMIME_Decoder': {
        name: 'MIME/SMIME Decoder',
        stage: 'Decode',
    },
    'Microsoft.BizTalk.Component.MIME_SMIME_Encoder': {
        name: 'MIME/SMIME Encoder',
        stage: 'Encode',
    },
    'Microsoft.BizTalk.Component.XmlValidator': { name: 'XML Validator', stage: 'Validate' },
    'Microsoft.BizTalk.Component.PartyRes': { name: 'Party Resolution', stage: 'ResolveParty' },
    'Microsoft.BizTalk.Component.BTF21DasmComp': { name: 'BTF Disassembler', stage: 'Disassemble' },
    'Microsoft.BizTalk.Component.BTF21AsmComp': { name: 'BTF Assembler', stage: 'Assemble' },
};

// =============================================================================
// BizTalk Pipeline Parser
// =============================================================================

/**
 * Parser for BizTalk pipeline (.btp) files.
 */
export class BizTalkPipelineParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'biztalk',
        fileExtensions: ['.btp'],
        fileTypes: ['pipeline'],
        supportsFolder: false,
        description: 'Parses BizTalk pipelines (.btp) into IR message processing config',
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
            `Reading pipeline: ${path.basename(inputPath)}`
        );

        // Read file content
        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        // Parse XML
        const doc = parseXml(content);
        if (!doc) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'Pipeline file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Parsing pipeline structure');

        // Parse pipeline info
        const pipelineInfo = this.parsePipelineXml(doc, inputPath, errors);
        if (!pipelineInfo) {
            return null;
        }

        this.reportProgress(options.onProgress, 3, 3, 'Pipeline parsing complete');

        // Convert to IR
        return this.convertToIR(pipelineInfo, errors);
    }

    /**
     * Get artifact summary.
     */
    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        if (!content) {
            return {
                name: path.basename(filePath, '.btp'),
                type: 'pipeline',
            };
        }

        const doc = parseXml(content);
        if (!doc) {
            return {
                name: path.basename(filePath, '.btp'),
                type: 'pipeline',
            };
        }

        const errors = new ParseErrorAccumulator(100);
        const pipelineInfo = this.parsePipelineXml(doc, filePath, errors);

        if (!pipelineInfo) {
            return {
                name: path.basename(filePath, '.btp'),
                type: 'pipeline',
            };
        }

        const componentCount = pipelineInfo.stages.reduce(
            (sum, stage) => sum + stage.components.length,
            0
        );

        const customComponents = pipelineInfo.stages
            .flatMap((s) => s.components)
            .filter((c) => c.isCustom);

        return {
            name: pipelineInfo.name,
            type: 'pipeline',
            elementCount: componentCount,
            description:
                `${pipelineInfo.type} pipeline with ${componentCount} components` +
                (customComponents.length > 0 ? ` (${customComponents.length} custom)` : ''),
        };
    }

    // =========================================================================
    // Pipeline XML Parsing
    // =========================================================================

    /**
     * Parse pipeline XML document.
     */
    private parsePipelineXml(
        doc: Document,
        filePath: string,
        errors: ParseErrorAccumulator
    ): BizTalkPipelineInfo | null {
        const rootElement = doc.documentElement;

        if (!rootElement) {
            errors.addError(ParseErrorCodes.INVALID_PIPELINE, 'Pipeline file has no root element', {
                filePath,
            });
            return null;
        }

        const name = path.basename(filePath, '.btp');

        // Determine pipeline type
        const pipelineType = this.determinePipelineType(rootElement);

        // Parse stages
        const stages = this.parseStages(rootElement, pipelineType);

        // Get description
        const description =
            getAttr(rootElement, 'Description') || getElementText(rootElement, 'Description');

        return {
            name,
            filePath,
            type: pipelineType,
            stages,
            description,
        };
    }

    /**
     * Determine pipeline type (receive or send).
     */
    private determinePipelineType(rootElement: Element): BizTalkPipelineType {
        const policyAttr = getAttr(rootElement, 'Policy');
        const typeAttr = getAttr(rootElement, 'Type');

        if (policyAttr?.includes('Receive') || typeAttr?.includes('Receive')) {
            return 'receive';
        }
        if (
            policyAttr?.includes('Send') ||
            policyAttr?.includes('Transmit') ||
            typeAttr?.includes('Send') ||
            typeAttr?.includes('Transmit')
        ) {
            return 'send';
        }

        // Check for stage names
        const stageElements = getAllElements(rootElement, 'Stage');
        for (const stage of stageElements) {
            const stageName = getAttr(stage, 'Name') || getAttr(stage, 'CategoryId');
            if (stageName) {
                const stageNameLower = stageName.toLowerCase();
                if (stageNameLower.includes('decode') || stageNameLower.includes('disassemble')) {
                    return 'receive';
                }
                if (stageNameLower.includes('encode') || stageNameLower.includes('assemble')) {
                    return 'send';
                }
            }
        }

        return 'receive'; // Default
    }

    /**
     * Parse pipeline stages.
     */
    private parseStages(
        rootElement: Element,
        pipelineType: BizTalkPipelineType
    ): BizTalkPipelineStageInfo[] {
        const stages: BizTalkPipelineStageInfo[] = [];

        const stageElements = getAllElements(rootElement, 'Stage');

        for (const stageEl of stageElements) {
            const stageName = this.getStageName(stageEl, pipelineType);
            const components = this.parseStageComponents(stageEl);

            if (components.length > 0) {
                stages.push({
                    name: stageName,
                    components,
                });
            }
        }

        return stages;
    }

    /**
     * Get stage name from element.
     */
    private getStageName(
        stageEl: Element,
        pipelineType: BizTalkPipelineType
    ): BizTalkPipelineStage {
        const categoryId = getAttr(stageEl, 'CategoryId') || '';
        const name = getAttr(stageEl, 'Name') || '';

        const combined = (categoryId + ' ' + name).toLowerCase();

        if (combined.includes('decode')) {
            return 'Decode';
        }
        if (combined.includes('disassemble')) {
            return 'Disassemble';
        }
        if (combined.includes('validate')) {
            return 'Validate';
        }
        if (combined.includes('resolveparty') || combined.includes('party')) {
            return 'ResolveParty';
        }
        if (combined.includes('preassemble')) {
            return 'PreAssemble';
        }
        if (combined.includes('assemble')) {
            return 'Assemble';
        }
        if (combined.includes('encode')) {
            return 'Encode';
        }

        // Default based on pipeline type
        return pipelineType === 'receive' ? 'Disassemble' : 'Assemble';
    }

    /**
     * Parse components in a stage.
     */
    private parseStageComponents(stageEl: Element): BizTalkPipelineComponent[] {
        const components: BizTalkPipelineComponent[] = [];

        const componentElements = getAllElements(stageEl, 'Component');

        for (const compEl of componentElements) {
            const typeName =
                getAttr(compEl, 'AssemblyQualifiedName') ||
                getAttr(compEl, 'Type') ||
                getAttr(compEl, 'Name') ||
                '';

            const componentInfo = STANDARD_COMPONENTS[typeName.split(',')[0]];
            const name = componentInfo?.name || typeName.split('.').pop() || 'Unknown';
            const isCustom = !componentInfo;

            // Parse properties
            const properties: Record<string, unknown> = {};
            const propElements = getAllElements(compEl, 'Property');

            for (const propEl of propElements) {
                const propName = getAttr(propEl, 'Name');
                const propValue = getAttr(propEl, 'Value') || propEl.textContent;
                if (propName) {
                    properties[propName] = propValue;
                }
            }

            components.push({
                name,
                typeName,
                isCustom,
                properties,
            });
        }

        return components;
    }

    // =========================================================================
    // IR Conversion
    // =========================================================================

    /**
     * Convert pipeline info to IR document.
     */
    private convertToIR(
        pipelineInfo: BizTalkPipelineInfo,
        _errors: ParseErrorAccumulator
    ): IRDocument {
        const ir = createEmptyIRDocument(
            `pipeline-${pipelineInfo.name}`,
            pipelineInfo.name,
            'biztalk'
        );

        // Convert stages to IR processing stages
        const stages = pipelineInfo.stages.map((stage, index) => ({
            id: `stage-${stage.name}-${index}`,
            name: stage.name,
            type: this.mapStageType(stage.name),
            order: index,
            components: stage.components.map((c) => ({
                name: c.name,
                type: c.typeName,
                config: c.properties,
            })),
            sourceMapping: {
                biztalk: {
                    stageName: stage.name,
                    componentCount: stage.components.length,
                    hasCustomComponents: stage.components.some((c) => c.isCustom),
                },
            },
        })) as unknown as ProcessingStage[];

        // Create message processing config
        const messageProcessing = {
            processors: [
                {
                    id: `processor-${pipelineInfo.name}`,
                    name: pipelineInfo.name,
                    type: pipelineInfo.type === 'receive' ? 'receive-pipeline' : 'send-pipeline',
                    stages,
                    sourceMapping: {
                        biztalk: {
                            pipelineName: pipelineInfo.name,
                            pipelineType: pipelineInfo.type,
                            stageCount: stages.length,
                        },
                    },
                },
            ],
        } as unknown as IRMessageProcessingConfig;

        // Identify gaps for custom components
        const gaps = this.identifyPipelineGaps(pipelineInfo);

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    artifact: {
                        name: pipelineInfo.name,
                        type: 'pipeline',
                        filePath: pipelineInfo.filePath,
                        fileType: '.btp',
                    },
                },
            },
            messageProcessing,
            gaps,
        };
    }

    /**
     * Map BizTalk stage name to IR stage type.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private mapStageType(stageName: BizTalkPipelineStage): any {
        switch (stageName) {
            case 'Decode':
                return 'decode';
            case 'Disassemble':
                return 'parse';
            case 'Validate':
                return 'validate';
            case 'ResolveParty':
                return 'authenticate';
            case 'PreAssemble':
                return 'transform';
            case 'Assemble':
                return 'serialize';
            case 'Encode':
                return 'encode';
            default:
                return 'custom';
        }
    }

    /**
     * Identify gaps in pipeline conversion.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private identifyPipelineGaps(pipelineInfo: BizTalkPipelineInfo): any[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gaps: any[] = [];

        const customComponents = pipelineInfo.stages
            .flatMap((s) => s.components)
            .filter((c) => c.isCustom);

        if (customComponents.length > 0) {
            gaps.push({
                id: `gap-${pipelineInfo.name}-custom`,
                category: 'custom-code',
                severity: 'high',
                title: `Custom pipeline components in ${pipelineInfo.name}`,
                description: `Pipeline contains ${customComponents.length} custom components that need Azure Function migration`,
                sourceFeature: {
                    platform: 'biztalk',
                    name: 'Custom Pipeline Component',
                    items: customComponents.map((c) => c.name),
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
