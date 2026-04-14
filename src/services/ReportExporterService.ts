/**
 * Report Exporter Service
 *
 * Generates professional DOCX reports from migration analysis (discovery)
 * and planning data. Embeds Mermaid diagrams as images with white
 * background / black lines for stakeholder-ready output.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    HeadingLevel,
    ImageRun,
    Header,
    Footer,
    PageNumber,
    PageBreak,
    ShadingType,
    TableLayoutType,
    convertInchesToTwip,
} from 'docx';
import { LoggingService } from './LoggingService';
import { MermaidImageRenderer } from './MermaidImageRenderer';
import { GeneratedFlowResult, ComponentDetail, MessageFlowStep } from './LLMFlowGenerator';
import { PlanningCacheService, FlowPlanningResult } from '../stages/planning/PlanningCacheService';

// ─── Color palette ───
const COLORS = {
    DARK_BLUE: '1B3A5C',
    TABLE_HEADER_BG: '2B579A',
    TABLE_ALT_ROW: 'F2F6FA',
    WHITE: 'FFFFFF',
    BLACK: '000000',
    DARK_GRAY: '333333',
    RED: 'CC0000',
    ORANGE: 'CC7700',
    GREEN: '228B22',
    LIGHT_GRAY: 'E8E8E8',
};

/** Union type for document section children */
type SectionChild = Paragraph | Table;

export type ReportType = 'analysis' | 'planning';

export class ReportExporterService {
    private static instance: ReportExporterService | undefined;
    private readonly logger = LoggingService.getInstance();
    private readonly mermaidRenderer = MermaidImageRenderer.getInstance();

    private constructor() {}

    public static getInstance(): ReportExporterService {
        if (!ReportExporterService.instance) {
            ReportExporterService.instance = new ReportExporterService();
        }
        return ReportExporterService.instance;
    }

    // ════════════════════════════════════════════════════════════════
    //  PUBLIC: Generate Analysis Report
    // ════════════════════════════════════════════════════════════════

    public async generateAnalysisReport(
        _flowId: string,
        flowName: string,
        result: GeneratedFlowResult
    ): Promise<string | undefined> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Generating Analysis Report…',
                cancellable: false,
            },
            async (progress) => {
                try {
                    progress.report({ message: 'Rendering diagrams…', increment: 10 });
                    const archImage = await this.mermaidRenderer.renderToBuffer(result.mermaid);

                    progress.report({ message: 'Building document…', increment: 40 });
                    const sections = await this.buildAnalysisSections(flowName, result, archImage);

                    const doc = this.createDocument(flowName, 'Analysis Report', sections);

                    progress.report({ message: 'Writing file…', increment: 40 });
                    const filePath = await this.saveDocument(doc, flowName, 'Analysis');

                    progress.report({ increment: 10 });
                    return filePath;
                } catch (err) {
                    this.logger.error(
                        `[ReportExporter] Analysis report failed: ${err instanceof Error ? err.message : String(err)}`
                    );
                    vscode.window.showErrorMessage(
                        `Failed to generate analysis report: ${err instanceof Error ? err.message : String(err)}`
                    );
                    return undefined;
                }
            }
        );
    }

    // ════════════════════════════════════════════════════════════════
    //  PUBLIC: Generate Planning Report
    // ════════════════════════════════════════════════════════════════

    public async generatePlanningReport(flowId: string): Promise<string | undefined> {
        const planResult = PlanningCacheService.getInstance().get(flowId);
        if (!planResult) {
            vscode.window.showWarningMessage('No planning data available for this flow.');
            return undefined;
        }

        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Generating Planning Report…',
                cancellable: false,
            },
            async (progress) => {
                try {
                    progress.report({ message: 'Rendering diagrams…', increment: 10 });
                    const archImage = planResult.mermaid
                        ? await this.mermaidRenderer.renderToBuffer(planResult.mermaid)
                        : undefined;

                    // Render per-workflow diagrams
                    const workflowImages = new Map<string, Buffer>();
                    for (const wf of planResult.workflows) {
                        if (wf.mermaid) {
                            const img = await this.mermaidRenderer.renderToBuffer(wf.mermaid);
                            if (img) {
                                workflowImages.set(wf.name, img);
                            }
                        }
                    }

                    progress.report({ message: 'Building document…', increment: 40 });
                    const sections = await this.buildPlanningSections(
                        planResult,
                        archImage,
                        workflowImages
                    );

                    const doc = this.createDocument(
                        planResult.flowName,
                        'Planning Report',
                        sections
                    );

                    progress.report({ message: 'Writing file…', increment: 40 });
                    const filePath = await this.saveDocument(doc, planResult.flowName, 'Planning');

                    progress.report({ increment: 10 });
                    return filePath;
                } catch (err) {
                    this.logger.error(
                        `[ReportExporter] Planning report failed: ${err instanceof Error ? err.message : String(err)}`
                    );
                    vscode.window.showErrorMessage(
                        `Failed to generate planning report: ${err instanceof Error ? err.message : String(err)}`
                    );
                    return undefined;
                }
            }
        );
    }

    // ════════════════════════════════════════════════════════════════
    //  ANALYSIS SECTIONS
    // ════════════════════════════════════════════════════════════════

    private async buildAnalysisSections(
        flowName: string,
        result: GeneratedFlowResult,
        archImage: Buffer | undefined
    ): Promise<SectionChild[]> {
        const children: SectionChild[] = [];

        // ── Title Page ──
        children.push(...this.titlePage(flowName, 'Source Analysis Report'));

        // ── Executive Summary ──
        children.push(this.pageBreakParagraph());
        children.push(this.heading1('Executive Summary'));
        children.push(this.bodyText(result.explanation));

        // ── Architecture Diagram ──
        children.push(this.pageBreakParagraph());
        children.push(this.heading1('Architecture Diagram'));
        if (archImage) {
            children.push(this.imageParagraph(archImage, 600, 450));
            children.push(this.caption('Figure 1: Source integration architecture diagram'));
        } else {
            children.push(
                this.bodyText(
                    'The architecture diagram could not be rendered as an image. ' +
                        'The Mermaid source code is included below.'
                )
            );
            children.push(...this.codeBlock(result.mermaid));
        }

        // ── Component Inventory ──
        if (result.componentDetails && result.componentDetails.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Component Inventory'));
            children.push(
                this.bodyText(
                    'The following table details each integration component discovered in the source project.'
                )
            );
            children.push(this.componentTable(result.componentDetails));
        }

        // ── Message Flow ──
        if (result.messageFlow && result.messageFlow.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Message Flow'));
            children.push(
                this.bodyText(
                    'Step-by-step processing sequence for messages through the integration flow.'
                )
            );
            children.push(this.messageFlowTable(result.messageFlow));
        }

        // ── Gap Analysis ──
        if (result.gapAnalysis && result.gapAnalysis.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Gap Analysis'));
            children.push(
                this.bodyText(
                    'Components that cannot be directly migrated to Azure Logic Apps Standard and the recommended alternatives.'
                )
            );
            children.push(this.gapAnalysisTable(result.gapAnalysis));
        }

        // ── Migration Patterns ──
        if (result.migrationPatterns && result.migrationPatterns.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Migration Patterns'));
            children.push(
                this.bodyText(
                    'Integration patterns detected in the source project with their Logic Apps equivalents.'
                )
            );
            children.push(this.migrationPatternsTable(result.migrationPatterns));
        }

        // ── Artifact Summary ──
        children.push(this.pageBreakParagraph());
        children.push(this.heading1('Artifact Summary'));
        children.push(this.artifactSummarySection(result.summary));

        // ── Notes & Warnings ──
        if (result.notes && result.notes.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Notes & Warnings'));
            for (const note of result.notes) {
                children.push(this.bulletPoint(note));
            }
        }

        return children;
    }

    // ════════════════════════════════════════════════════════════════
    //  PLANNING SECTIONS
    // ════════════════════════════════════════════════════════════════

    private async buildPlanningSections(
        plan: FlowPlanningResult,
        archImage: Buffer | undefined,
        workflowImages: Map<string, Buffer>
    ): Promise<SectionChild[]> {
        const children: SectionChild[] = [];

        // ── Title Page ──
        children.push(...this.titlePage(plan.flowName, 'Migration Planning Report'));

        // ── Executive Summary ──
        children.push(this.pageBreakParagraph());
        children.push(this.heading1('Executive Summary'));
        children.push(this.bodyText(plan.summary));
        if (plan.explanation) {
            children.push(this.bodyText(plan.explanation));
        }

        // ── Architecture Diagram ──
        children.push(this.pageBreakParagraph());
        children.push(this.heading1('Target Architecture'));
        if (archImage) {
            children.push(this.imageParagraph(archImage, 600, 450));
            children.push(this.caption('Figure 1: Target Logic Apps architecture'));
        } else if (plan.mermaid) {
            children.push(
                this.bodyText(
                    'The architecture diagram could not be rendered as an image. ' +
                        'The Mermaid source code is included below.'
                )
            );
            children.push(...this.codeBlock(plan.mermaid));
        }

        // ── Planned Workflows ──
        if (plan.workflows.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Planned Workflows'));
            children.push(
                this.bodyText(
                    `The migration produces ${plan.workflows.length} Logic Apps workflow(s).`
                )
            );

            let figureNum = 2;
            for (const wf of plan.workflows) {
                children.push(this.heading2(wf.name));
                children.push(this.bodyText(wf.description));
                children.push(
                    this.bodyText(`Trigger: ${wf.triggerType} | Actions: ${wf.actions.join(', ')}`)
                );

                const wfImage = workflowImages.get(wf.name);
                if (wfImage) {
                    children.push(this.imageParagraph(wfImage, 500, 350));
                    children.push(
                        this.caption(`Figure ${figureNum++}: ${wf.name} workflow diagram`)
                    );
                } else if (wf.mermaid) {
                    children.push(...this.codeBlock(wf.mermaid));
                }
            }
        }

        // ── Connector Mappings ──
        if (plan.connectorMappings.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Connector Mappings'));
            children.push(this.connectorMappingsTable(plan.connectorMappings));
        }

        // ── Action Mappings ──
        if (plan.actionMappings.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Action Mappings'));
            children.push(this.actionMappingsTable(plan.actionMappings));
        }

        // ── Gap Analysis ──
        if (plan.gaps.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Gap Analysis'));
            children.push(this.planningGapTable(plan.gaps));
        }

        // ── Integration Patterns ──
        if (plan.patterns.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Integration Patterns'));
            children.push(this.planningPatternsTable(plan.patterns));
        }

        // ── Azure Components ──
        if (plan.azureComponents.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Required Azure Components'));
            children.push(this.azureComponentsTable(plan.azureComponents));
        }

        // ── Effort Estimate ──
        if (plan.effortEstimate) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Effort Estimate'));
            children.push(this.effortEstimateSection(plan.effortEstimate));
        }

        // ── Artifact Dispositions ──
        if (plan.artifactDispositions && plan.artifactDispositions.length > 0) {
            children.push(this.pageBreakParagraph());
            children.push(this.heading1('Artifact Dispositions'));
            children.push(this.artifactDispositionsTable(plan.artifactDispositions));
        }

        return children;
    }

    // ════════════════════════════════════════════════════════════════
    //  DOCUMENT CREATION
    // ════════════════════════════════════════════════════════════════

    private createDocument(
        flowName: string,
        _reportType: string,
        children: SectionChild[]
    ): Document {
        return new Document({
            styles: {
                default: {
                    document: {
                        run: { font: 'Segoe UI', size: 22 /* 11pt */ },
                    },
                    heading1: {
                        run: { font: 'Segoe UI', size: 36, bold: true, color: COLORS.DARK_BLUE },
                        paragraph: { spacing: { before: 240, after: 120 } },
                    },
                    heading2: {
                        run: { font: 'Segoe UI', size: 28, bold: true, color: COLORS.DARK_GRAY },
                        paragraph: { spacing: { before: 200, after: 100 } },
                    },
                },
            },
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: convertInchesToTwip(1),
                                bottom: convertInchesToTwip(1),
                                left: convertInchesToTwip(1),
                                right: convertInchesToTwip(1),
                            },
                            pageNumbers: { start: 1 },
                        },
                    },
                    headers: {
                        default: new Header({
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [
                                        new TextRun({
                                            text: `Logic Apps Migration Report — ${flowName}`,
                                            size: 16,
                                            color: '888888',
                                            font: 'Segoe UI',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    },
                    footers: {
                        default: new Footer({
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                        new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                                    ],
                                }),
                            ],
                        }),
                    },
                    children,
                },
            ],
        });
    }

    private async saveDocument(
        doc: Document,
        flowName: string,
        reportType: string
    ): Promise<string> {
        const buffer = await Packer.toBuffer(doc);

        const safeName = flowName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const date = new Date().toISOString().slice(0, 10);
        const fileName = `${safeName}_${reportType}_Report_${date}.docx`;

        // Ask user where to save
        const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: defaultUri
                ? vscode.Uri.joinPath(defaultUri, fileName)
                : vscode.Uri.file(fileName),
            filters: { 'Word Document': ['docx'] },
            title: `Save ${reportType} Report`,
        });

        if (!saveUri) {
            throw new Error('Save cancelled by user');
        }

        fs.writeFileSync(saveUri.fsPath, buffer);
        this.logger.info(`[ReportExporter] Report saved: ${saveUri.fsPath}`);
        return saveUri.fsPath;
    }

    // ════════════════════════════════════════════════════════════════
    //  BUILDING BLOCKS
    // ════════════════════════════════════════════════════════════════

    private titlePage(flowName: string, subtitle: string): Paragraph[] {
        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        return [
            new Paragraph({ spacing: { before: 3000 } }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: flowName,
                        bold: true,
                        size: 56, // 28pt
                        color: COLORS.DARK_BLUE,
                        font: 'Segoe UI',
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200 },
                children: [
                    new TextRun({
                        text: subtitle,
                        size: 36, // 18pt
                        color: COLORS.DARK_GRAY,
                        font: 'Segoe UI',
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 400 },
                children: [
                    new TextRun({
                        text: `Generated: ${date}`,
                        size: 22,
                        color: '888888',
                        font: 'Segoe UI',
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100 },
                children: [
                    new TextRun({
                        text: 'Logic Apps Migration Agent',
                        size: 22,
                        color: '888888',
                        font: 'Segoe UI',
                    }),
                ],
            }),
        ];
    }

    private heading1(text: string): Paragraph {
        return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
    }

    private heading2(text: string): Paragraph {
        return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
    }

    private bodyText(text: string): Paragraph {
        return new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text, size: 22, font: 'Segoe UI' })],
        });
    }

    private bulletPoint(text: string): Paragraph {
        return new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [new TextRun({ text, size: 22, font: 'Segoe UI' })],
        });
    }

    private caption(text: string): Paragraph {
        return new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 200 },
            children: [
                new TextRun({ text, italics: true, size: 18, color: '666666', font: 'Segoe UI' }),
            ],
        });
    }

    private pageBreakParagraph(): Paragraph {
        return new Paragraph({ children: [new PageBreak()] });
    }

    private codeBlock(code: string): Paragraph[] {
        const lines = code.split('\n');
        return lines.map(
            (line) =>
                new Paragraph({
                    spacing: { before: 0, after: 0, line: 276 },
                    indent: { left: convertInchesToTwip(0.3), right: convertInchesToTwip(0.3) },
                    children: [
                        new TextRun({
                            text: line || ' ',
                            font: 'Consolas',
                            size: 14,
                            color: COLORS.DARK_GRAY,
                        }),
                    ],
                    shading: { type: ShadingType.SOLID, color: 'F5F5F5' },
                })
        );
    }

    private imageParagraph(imageBuffer: Buffer, width: number, height: number): Paragraph {
        return new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new ImageRun({
                    data: imageBuffer,
                    transformation: { width, height },
                    type: 'png',
                }),
            ],
        });
    }

    // ════════════════════════════════════════════════════════════════
    //  TABLE HELPERS
    // ════════════════════════════════════════════════════════════════

    private makeHeaderCell(text: string): TableCell {
        return new TableCell({
            children: [
                new Paragraph({
                    children: [
                        new TextRun({
                            text,
                            bold: true,
                            size: 20,
                            color: COLORS.WHITE,
                            font: 'Segoe UI',
                        }),
                    ],
                }),
            ],
            shading: { type: ShadingType.SOLID, color: COLORS.TABLE_HEADER_BG },
        });
    }

    private makeCell(text: string, isAltRow = false): TableCell {
        return new TableCell({
            children: [
                new Paragraph({
                    children: [new TextRun({ text, size: 20, font: 'Segoe UI' })],
                }),
            ],
            shading: isAltRow
                ? { type: ShadingType.SOLID, color: COLORS.TABLE_ALT_ROW }
                : undefined,
        });
    }

    private makeSeverityCell(severity: string, isAltRow = false): TableCell {
        const colorMap: Record<string, string> = {
            high: COLORS.RED,
            medium: COLORS.ORANGE,
            low: COLORS.GREEN,
        };
        return new TableCell({
            children: [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: severity.toUpperCase(),
                            bold: true,
                            size: 20,
                            color: colorMap[severity] || COLORS.BLACK,
                            font: 'Segoe UI',
                        }),
                    ],
                }),
            ],
            shading: isAltRow
                ? { type: ShadingType.SOLID, color: COLORS.TABLE_ALT_ROW }
                : undefined,
        });
    }

    // ════════════════════════════════════════════════════════════════
    //  ANALYSIS TABLES
    // ════════════════════════════════════════════════════════════════

    private componentTable(components: ComponentDetail[]): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Component'),
                        this.makeHeaderCell('Type'),
                        this.makeHeaderCell('Description'),
                        this.makeHeaderCell('Azure Equivalent'),
                    ],
                }),
                ...components.map(
                    (c, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(c.name, i % 2 === 1),
                                this.makeCell(c.type, i % 2 === 1),
                                this.makeCell(c.description || '', i % 2 === 1),
                                this.makeCell(c.azureEquivalent || 'N/A', i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private messageFlowTable(steps: MessageFlowStep[]): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Step'),
                        this.makeHeaderCell('Component'),
                        this.makeHeaderCell('Action'),
                        this.makeHeaderCell('Details'),
                    ],
                }),
                ...steps.map(
                    (s, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(String(s.step ?? i + 1), i % 2 === 1),
                                this.makeCell(s.component || '', i % 2 === 1),
                                this.makeCell(s.action || '', i % 2 === 1),
                                this.makeCell(s.description || '', i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private gapAnalysisTable(
        gaps: {
            component: string;
            componentType: string;
            gap: string;
            severity: 'high' | 'medium' | 'low';
            options: string[];
            recommendation: string;
        }[]
    ): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Component'),
                        this.makeHeaderCell('Type'),
                        this.makeHeaderCell('Gap'),
                        this.makeHeaderCell('Severity'),
                        this.makeHeaderCell('Recommendation'),
                    ],
                }),
                ...gaps.map(
                    (g, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(g.component, i % 2 === 1),
                                this.makeCell(g.componentType, i % 2 === 1),
                                this.makeCell(g.gap, i % 2 === 1),
                                this.makeSeverityCell(g.severity, i % 2 === 1),
                                this.makeCell(g.recommendation, i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private migrationPatternsTable(
        patterns: {
            pattern: string;
            description: string;
            complexity: 'high' | 'medium' | 'low';
            biztalkApproach: string;
            logicAppsApproach: string;
            components: string[];
        }[]
    ): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Pattern'),
                        this.makeHeaderCell('Complexity'),
                        this.makeHeaderCell('Source Approach'),
                        this.makeHeaderCell('Logic Apps Approach'),
                    ],
                }),
                ...patterns.map(
                    (p, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(p.pattern, i % 2 === 1),
                                this.makeSeverityCell(p.complexity, i % 2 === 1),
                                this.makeCell(p.biztalkApproach, i % 2 === 1),
                                this.makeCell(p.logicAppsApproach, i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private artifactSummarySection(summary: GeneratedFlowResult['summary']): Paragraph {
        const lines: string[] = [];
        if (summary.receiveLocations.length) {
            lines.push(`Receive Locations: ${summary.receiveLocations.join(', ')}`);
        }
        if (summary.receivePipelines.length) {
            lines.push(`Receive Pipelines: ${summary.receivePipelines.join(', ')}`);
        }
        if (summary.receivePorts.length) {
            lines.push(`Receive Ports: ${summary.receivePorts.join(', ')}`);
        }
        if (summary.orchestrations.length) {
            lines.push(`Orchestrations: ${summary.orchestrations.join(', ')}`);
        }
        if (summary.maps.length) {
            lines.push(`Maps: ${summary.maps.join(', ')}`);
        }
        if (summary.schemas.length) {
            lines.push(`Schemas: ${summary.schemas.join(', ')}`);
        }
        if (summary.sendPorts.length) {
            lines.push(`Send Ports: ${summary.sendPorts.join(', ')}`);
        }
        if (summary.sendPipelines.length) {
            lines.push(`Send Pipelines: ${summary.sendPipelines.join(', ')}`);
        }

        return new Paragraph({
            spacing: { after: 120 },
            children: lines.flatMap((line, idx) => {
                const runs: TextRun[] = [new TextRun({ text: line, size: 22, font: 'Segoe UI' })];
                if (idx < lines.length - 1) {
                    runs.push(new TextRun({ break: 1 }));
                }
                return runs;
            }),
        });
    }

    // ════════════════════════════════════════════════════════════════
    //  PLANNING TABLES
    // ════════════════════════════════════════════════════════════════

    private connectorMappingsTable(mappings: FlowPlanningResult['connectorMappings']): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Source Connector'),
                        this.makeHeaderCell('Target Connector'),
                        this.makeHeaderCell('Native'),
                        this.makeHeaderCell('Notes'),
                    ],
                }),
                ...mappings.map(
                    (m, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(m.source, i % 2 === 1),
                                this.makeCell(m.target, i % 2 === 1),
                                this.makeCell(m.isNative ? 'Yes' : 'No', i % 2 === 1),
                                this.makeCell(m.notes || '', i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private actionMappingsTable(mappings: FlowPlanningResult['actionMappings']): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Source Action'),
                        this.makeHeaderCell('Target Action'),
                        this.makeHeaderCell('Workflow'),
                        this.makeHeaderCell('Notes'),
                    ],
                }),
                ...mappings.map(
                    (m, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(m.source, i % 2 === 1),
                                this.makeCell(m.target, i % 2 === 1),
                                this.makeCell(m.workflowName || '', i % 2 === 1),
                                this.makeCell(m.notes || '', i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private planningGapTable(gaps: FlowPlanningResult['gaps']): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Component'),
                        this.makeHeaderCell('Gap'),
                        this.makeHeaderCell('Severity'),
                        this.makeHeaderCell('Recommendation'),
                    ],
                }),
                ...gaps.map(
                    (g, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(g.component, i % 2 === 1),
                                this.makeCell(g.gap, i % 2 === 1),
                                this.makeSeverityCell(g.severity, i % 2 === 1),
                                this.makeCell(g.recommendation, i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private planningPatternsTable(patterns: FlowPlanningResult['patterns']): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Pattern'),
                        this.makeHeaderCell('Complexity'),
                        this.makeHeaderCell('Source Approach'),
                        this.makeHeaderCell('Logic Apps Approach'),
                    ],
                }),
                ...patterns.map(
                    (p, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(p.name, i % 2 === 1),
                                this.makeSeverityCell(p.complexity, i % 2 === 1),
                                this.makeCell(p.sourceApproach, i % 2 === 1),
                                this.makeCell(p.logicAppsApproach, i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private azureComponentsTable(components: FlowPlanningResult['azureComponents']): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Component'),
                        this.makeHeaderCell('Type'),
                        this.makeHeaderCell('Reason'),
                        this.makeHeaderCell('Config Notes'),
                    ],
                }),
                ...components.map(
                    (c, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(c.name, i % 2 === 1),
                                this.makeCell(c.type, i % 2 === 1),
                                this.makeCell(c.reason, i % 2 === 1),
                                this.makeCell(c.configNotes || '', i % 2 === 1),
                            ],
                        })
                ),
            ],
        });
    }

    private effortEstimateSection(
        estimate: NonNullable<FlowPlanningResult['effortEstimate']>
    ): Paragraph {
        const bd = estimate.breakdown;
        const lines = [
            `Total Estimated Hours: ${estimate.totalHours}`,
            `Confidence: ${estimate.confidence.toUpperCase()}`,
            '',
            `Analysis: ${bd.analysis}h`,
            `Conversion: ${bd.conversion}h`,
            `Testing: ${bd.testing}h`,
            `Deployment: ${bd.deployment}h`,
        ];
        return new Paragraph({
            spacing: { after: 120 },
            children: lines.flatMap((line, idx) => {
                const runs: TextRun[] = [new TextRun({ text: line, size: 22, font: 'Segoe UI' })];
                if (idx < lines.length - 1) {
                    runs.push(new TextRun({ break: 1 }));
                }
                return runs;
            }),
        });
    }

    private artifactDispositionsTable(
        dispositions: NonNullable<FlowPlanningResult['artifactDispositions']>
    ): Table {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.AUTOFIT,
            rows: [
                new TableRow({
                    children: [
                        this.makeHeaderCell('Artifact'),
                        this.makeHeaderCell('Type'),
                        this.makeHeaderCell('Conversion'),
                        this.makeHeaderCell('Destination'),
                        this.makeHeaderCell('Notes'),
                    ],
                }),
                ...dispositions.map(
                    (d, i) =>
                        new TableRow({
                            children: [
                                this.makeCell(d.artifactName, i % 2 === 1),
                                this.makeCell(d.artifactType, i % 2 === 1),
                                this.makeCell(
                                    d.conversionRequired
                                        ? `${d.conversionFrom || ''} → ${d.conversionTo || ''}`
                                        : 'Not required',
                                    i % 2 === 1
                                ),
                                this.makeCell(d.uploadDestination, i % 2 === 1),
                                this.makeCell(
                                    d.conversionNotes || d.uploadNotes || '',
                                    i % 2 === 1
                                ),
                            ],
                        })
                ),
            ],
        });
    }
}
