import { diagram as flowchartDiagram } from 'mermaid/dist/chunks/mermaid.core/flowDiagram-DWJPFMVM.mjs';
import { LoggingService } from './LoggingService';

interface FlowchartDbLike {
    clear(): void;
    parseError?: (err: unknown) => never;
    sanitizeText?: (value: string) => string;
}

interface FlowchartParserLike {
    yy?: FlowchartDbLike;
    parser?: {
        yy?: FlowchartDbLike;
    };
    parse(text: string): unknown;
}

interface FlowchartDiagramLike {
    parser: FlowchartParserLike;
    readonly db: FlowchartDbLike;
}

export interface MermaidValidationOptions {
    expectedDiagramTypes?: string[];
}

export interface MermaidValidationResult {
    valid: boolean;
    normalized: string;
    diagramType?: string;
    error?: string;
}

export class MermaidValidationService {
    private static instance: MermaidValidationService | undefined;
    private readonly logger = LoggingService.getInstance();
    private readonly flowchartDiagram = flowchartDiagram as FlowchartDiagramLike;

    public static getInstance(): MermaidValidationService {
        if (!MermaidValidationService.instance) {
            MermaidValidationService.instance = new MermaidValidationService();
        }
        return MermaidValidationService.instance;
    }

    public normalize(code: string): string {
        let normalized = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        normalized = normalized.replace(/\\n/g, '\n');
        normalized = normalized.replace(/\\"/g, '"');
        normalized = normalized
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n')
            .replace(/\n{3,}/g, '\n\n');
        return normalized.trim();
    }

    public async validate(
        code: string,
        options?: MermaidValidationOptions
    ): Promise<MermaidValidationResult> {
        const normalized = this.normalize(code);
        if (!normalized) {
            this.logger.warn(
                '[MermaidValidationService] Mermaid validation failed: diagram is empty after normalization'
            );
            return {
                valid: false,
                normalized,
                error: 'Mermaid diagram is empty after normalization.',
            };
        }

        try {
            const diagramType = this.detectDiagramType(normalized);

            if (!diagramType) {
                this.logger.warn(
                    '[MermaidValidationService] Mermaid validation failed: unsupported or missing diagram type declaration'
                );
                return {
                    valid: false,
                    normalized,
                    error: 'Supported Mermaid diagrams are flowcharts and sequence diagrams. The first diagram line must start with "flowchart", "graph", or "sequenceDiagram".',
                };
            }

            if (
                options?.expectedDiagramTypes &&
                options.expectedDiagramTypes.length > 0 &&
                !options.expectedDiagramTypes.includes(diagramType)
            ) {
                const expected = options.expectedDiagramTypes.join(', ');
                this.logger.warn(
                    `[MermaidValidationService] Mermaid validation failed: unexpected diagram type "${diagramType ?? 'unknown'}". Expected one of: ${expected}.`
                );
                return {
                    valid: false,
                    normalized,
                    diagramType,
                    error: `Unexpected Mermaid diagram type "${diagramType ?? 'unknown'}". Expected one of: ${expected}.`,
                };
            }

            if (diagramType === 'sequenceDiagram') {
                this.validateSequenceDiagramSyntax(normalized);
            } else {
                this.validateFlowchartSyntax(normalized);
            }

            this.logger.debug(
                `[MermaidValidationService] Mermaid validation succeeded (${diagramType ?? 'unknown'})`
            );

            return {
                valid: true,
                normalized,
                diagramType,
            };
        } catch (error) {
            this.logger.warn(
                `[MermaidValidationService] Mermaid validation failed: ${this.formatError(error)}`
            );
            return {
                valid: false,
                normalized,
                error: this.formatError(error),
            };
        }
    }

    private validateFlowchartSyntax(code: string): void {
        const db = this.flowchartDiagram.db;
        const parser = this.flowchartDiagram.parser;
        const originalSanitizeText = db.sanitizeText;

        try {
            db.clear();
            db.parseError = (err: unknown) => {
                throw err;
            };
            db.sanitizeText = (value: string) => value;

            parser.yy = db;
            if (parser.parser) {
                parser.parser.yy = db;
            }
            parser.parse(code);
        } finally {
            db.sanitizeText = originalSanitizeText;
        }
    }

    /**
     * Validate the common Mermaid sequence-diagram grammar without depending on
     * Mermaid's browser-oriented renderer. Rendering in the discovery webview
     * remains the final parser check for the complete Mermaid feature set.
     */
    private validateSequenceDiagramSyntax(code: string): void {
        const lines = code.split('\n');
        const blocks: string[] = [];
        let participantCount = 0;
        let messageCount = 0;

        for (const rawLine of lines.slice(1)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('%%')) {
                continue;
            }

            if (/^(participant|actor)\s+\S/i.test(line)) {
                participantCount++;
                continue;
            }

            if (
                /^(autonumber|title|activate|deactivate|create|destroy|hide|show|links?)\b/i.test(
                    line
                )
            ) {
                continue;
            }

            if (/^(loop|alt|opt|par|critical|break|rect)\b/i.test(line)) {
                blocks.push(line.split(/\s+/, 1)[0].toLowerCase());
                continue;
            }

            if (/^(else|and|option)\b/i.test(line)) {
                if (blocks.length === 0) {
                    throw new Error(`Sequence diagram branch "${line}" has no open block.`);
                }
                continue;
            }

            if (/^end$/i.test(line)) {
                if (blocks.length === 0) {
                    throw new Error('Sequence diagram contains an unmatched "end".');
                }
                blocks.pop();
                continue;
            }

            if (
                /^Note\s+(over|left of|right of)\s+\S+(?:\s*,\s*\S+)?\s*:\s*\S/i.test(
                    line
                )
            ) {
                continue;
            }

            // Mermaid sequence arrows. A message label is required so that the
            // diagram conveys a business interaction rather than bare wiring.
            const messageMatch = line.match(
                /^(.+?)(-->>|->>|-->|->|-x|--x|-\)|--\))\s*(.+?)\s*:\s*(\S.*)$/i
            );
            if (messageMatch) {
                const [, sender, , receiver] = messageMatch;
                if (!sender.trim() || !receiver.trim()) {
                    throw new Error(`Sequence diagram message has an empty participant: "${line}".`);
                }
                messageCount++;
                continue;
            }

            throw new Error(`Unsupported sequence diagram statement: "${line}".`);
        }

        if (blocks.length > 0) {
            throw new Error(
                `Sequence diagram block "${blocks[blocks.length - 1]}" is not closed with "end".`
            );
        }
        if (participantCount === 0 && messageCount === 0) {
            throw new Error('Sequence diagram must declare at least one participant or message.');
        }
        if (messageCount === 0) {
            throw new Error('Sequence diagram must contain at least one message.');
        }
    }

    private detectDiagramType(code: string): string | undefined {
        for (const rawLine of code.split('\n')) {
            const line = rawLine.trim();
            if (!line || line.startsWith('%%')) {
                continue;
            }

            const keyword = line.split(/\s+/, 1)[0]?.toLowerCase();
            if (keyword === 'flowchart') {
                return 'flowchart-v2';
            }

            if (keyword === 'graph') {
                return 'flowchart';
            }

            if (keyword === 'sequencediagram') {
                return 'sequenceDiagram';
            }

            return undefined;
        }

        return undefined;
    }

    private formatError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (typeof error === 'object' && error !== null) {
            if ('str' in error && typeof error.str === 'string') {
                return error.str;
            }
            if ('message' in error && typeof error.message === 'string') {
                return error.message;
            }
            try {
                return JSON.stringify(error);
            } catch {
                return String(error);
            }
        }
        return String(error);
    }
}
