import { LoggingService } from './LoggingService';

interface JsDomWindowLike {
    document: unknown;
    navigator: unknown;
    Element?: { prototype?: Record<string, unknown> };
    SVGElement?: { prototype?: Record<string, unknown> };
    HTMLElement?: unknown;
    Node?: unknown;
    NodeList?: unknown;
    DOMParser?: unknown;
    XMLSerializer?: unknown;
    DocumentFragment?: unknown;
    HTMLTemplateElement?: unknown;
    MutationObserver?: unknown;
    getComputedStyle?: unknown;
    requestAnimationFrame?: unknown;
    cancelAnimationFrame?: unknown;
    location?: unknown;
    performance?: unknown;
    setTimeout?: typeof setTimeout;
    clearTimeout?: typeof clearTimeout;
}

interface JsDomModuleLike {
    JSDOM: new (
        html?: string,
        options?: Record<string, unknown>
    ) => {
        window: JsDomWindowLike;
    };
}

interface MermaidParseResult {
    diagramType: string;
    config?: unknown;
}

interface MermaidModuleLike {
    initialize(config: Record<string, unknown>): void;
    parse(
        text: string,
        parseOptions?: { suppressErrors?: boolean }
    ): Promise<MermaidParseResult | false>;
    detectType?(text: string): string;
    parseError?: ((err: unknown, hash?: unknown) => void) | undefined;
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
    private mermaidPromise: Promise<MermaidModuleLike> | undefined;
    private domEnvironmentPromise: Promise<void> | undefined;

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
            const mermaid = await this.getMermaid();
            const parseResult = await mermaid.parse(normalized);
            const diagramType =
                parseResult && typeof parseResult === 'object' && 'diagramType' in parseResult
                    ? parseResult.diagramType
                    : this.tryDetectType(mermaid, normalized);

            if (
                options?.expectedDiagramTypes &&
                options.expectedDiagramTypes.length > 0 &&
                (!diagramType || !options.expectedDiagramTypes.includes(diagramType))
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

            this.logger.info(
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

    private async getMermaid(): Promise<MermaidModuleLike> {
        if (!this.mermaidPromise) {
            this.mermaidPromise = this.loadMermaid();
        }
        return this.mermaidPromise;
    }

    private async loadMermaid(): Promise<MermaidModuleLike> {
        await this.ensureDomEnvironment();

        const dynamicImport = new Function('specifier', 'return import(specifier);') as (
            specifier: string
        ) => Promise<unknown>;
        const moduleValue = await dynamicImport('mermaid');
        const mermaid = ((moduleValue as { default?: MermaidModuleLike }).default ??
            moduleValue) as MermaidModuleLike;

        mermaid.parseError = undefined;
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            flowchart: {
                htmlLabels: true,
                useMaxWidth: true,
                curve: 'basis',
            },
        });

        this.logger.info('[MermaidValidationService] Mermaid parser initialized');
        return mermaid;
    }

    private async ensureDomEnvironment(): Promise<void> {
        if (!this.domEnvironmentPromise) {
            this.domEnvironmentPromise = this.initializeDomEnvironment();
        }

        await this.domEnvironmentPromise;
    }

    private async initializeDomEnvironment(): Promise<void> {
        const existingWindow = globalThis.window as unknown as JsDomWindowLike | undefined;
        const existingDocument = globalThis.document as unknown;

        if (existingWindow?.document && existingDocument) {
            return;
        }

        const dynamicImport = new Function('specifier', 'return import(specifier);') as (
            specifier: string
        ) => Promise<unknown>;
        const jsdomModule = await dynamicImport('jsdom');
        const { JSDOM } = jsdomModule as JsDomModuleLike;

        const dom = new JSDOM('<!doctype html><html><body></body></html>', {
            pretendToBeVisual: true,
            url: 'https://example.invalid/',
        });
        const { window } = dom;

        this.setGlobalIfMissing('window', window);
        this.setGlobalIfMissing('document', window.document);
        this.setGlobalIfMissing('navigator', window.navigator);
        this.setGlobalIfMissing('Element', window.Element);
        this.setGlobalIfMissing('SVGElement', window.SVGElement);
        this.setGlobalIfMissing('HTMLElement', window.HTMLElement);
        this.setGlobalIfMissing('Node', window.Node);
        this.setGlobalIfMissing('NodeList', window.NodeList);
        this.setGlobalIfMissing('DOMParser', window.DOMParser);
        this.setGlobalIfMissing('XMLSerializer', window.XMLSerializer);
        this.setGlobalIfMissing('DocumentFragment', window.DocumentFragment);
        this.setGlobalIfMissing('HTMLTemplateElement', window.HTMLTemplateElement);
        this.setGlobalIfMissing('MutationObserver', window.MutationObserver);
        this.setGlobalIfMissing('getComputedStyle', window.getComputedStyle);
        this.setGlobalIfMissing('requestAnimationFrame', window.requestAnimationFrame);
        this.setGlobalIfMissing('cancelAnimationFrame', window.cancelAnimationFrame);
        this.setGlobalIfMissing('location', window.location);
        this.setGlobalIfMissing('performance', window.performance);

        const elementPrototype = window.Element?.prototype as Record<string, unknown> | undefined;
        if (elementPrototype && typeof elementPrototype.getBBox !== 'function') {
            elementPrototype.getBBox = () => ({
                x: 0,
                y: 0,
                width: 100,
                height: 20,
            });
        }

        if (elementPrototype && typeof elementPrototype.getComputedTextLength !== 'function') {
            elementPrototype.getComputedTextLength = () => 100;
        }

        this.logger.info('[MermaidValidationService] JSDOM environment initialized');
    }

    private setGlobalIfMissing(name: string, value: unknown): void {
        if (typeof value === 'undefined') {
            return;
        }

        const globalRecord = globalThis as Record<string, unknown>;
        const ownDescriptor = Object.getOwnPropertyDescriptor(globalThis, name);

        if (ownDescriptor) {
            if ('value' in ownDescriptor) {
                if (typeof ownDescriptor.value === 'undefined' && ownDescriptor.writable) {
                    globalRecord[name] = value;
                }
                return;
            }

            if (typeof ownDescriptor.get === 'function') {
                try {
                    const currentValue = globalRecord[name];
                    if (typeof currentValue !== 'undefined') {
                        return;
                    }
                } catch {
                    return;
                }

                if (typeof ownDescriptor.set === 'function') {
                    ownDescriptor.set.call(globalThis, value);
                }
                return;
            }

            return;
        }

        Object.defineProperty(globalThis, name, {
            value,
            configurable: true,
            writable: true,
        });
    }

    private tryDetectType(mermaid: MermaidModuleLike, code: string): string | undefined {
        if (!mermaid.detectType) {
            return undefined;
        }

        try {
            return mermaid.detectType(code);
        } catch {
            return undefined;
        }
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
