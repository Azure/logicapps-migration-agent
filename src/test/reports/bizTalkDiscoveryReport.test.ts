import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';
import { Script } from 'vm';
import { afterEach, describe, it } from 'mocha';
import * as docx from 'docx';
import { Document, Packer } from 'docx';
import { createEmptyIRDocument } from '../../ir/types/document';
import type { IRDocument } from '../../ir/types/document';
import type { IRReceiveEndpoint, IRSendEndpoint } from '../../ir/types/advanced';
import type { ParsedArtifact } from '../../stages/discovery/types';
import type { GeneratedFlowResult } from '../../services/LLMFlowGenerator';
import { createBizTalkDiscoveryReport } from '../../services/reports/BizTalkDiscoveryReport';
import type { FlowPlanningResult } from '../../stages/planning/PlanningCacheService';

function analysis(overrides: Partial<GeneratedFlowResult> = {}): GeneratedFlowResult {
    return {
        mermaid: '',
        explanation: 'Orders arrive through a BizTalk receive location and are sent to ERP.',
        summary: {
            receiveLocations: ['OrdersIn'],
            receivePorts: ['ReceiveOrders'],
            receivePipelines: ['XMLReceive'],
            orchestrations: ['OrderOrchestration'],
            maps: ['OrderToERP'],
            schemas: ['OrderSchema'],
            sendPorts: ['SendOrders'],
            sendPipelines: ['XMLTransmit'],
        },
        componentDetails: [
            {
                id: 'receive',
                name: 'OrdersIn',
                type: 'receive-location',
                description: 'Receives order messages.',
                purpose: 'Order intake',
                inputMessageType: 'urn:orders#Order',
            },
            {
                id: 'send',
                name: 'SendOrders',
                type: 'send-port',
                description: 'Sends the mapped order to ERP.',
                purpose: 'ERP delivery',
                azureEquivalent: 'HTTP action',
            },
        ],
        messageFlow: [
            {
                step: 1,
                component: 'OrdersIn',
                componentType: 'receive-location',
                action: 'Receive',
                description: 'Receive and validate the order.',
                messageType: 'urn:orders#Order',
                additionalDetails: {},
            },
        ],
        ...overrides,
    };
}

function artifact(ir: IRDocument, type: ParsedArtifact['type'] = 'binding'): ParsedArtifact {
    return {
        id: ir.metadata.id,
        name: ir.metadata.name,
        type,
        sourcePath: 'Bindings.xml',
        absolutePath: 'C:\\source\\Bindings.xml',
        ir,
        fileSize: 100,
        lastModified: '2026-09-29T00:00:00Z',
        parserId: 'biztalk-bindings',
    };
}

function bindings(): ParsedArtifact {
    const ir = createEmptyIRDocument('binding', 'Orders Bindings', 'biztalk');
    const receive: IRReceiveEndpoint & { address: string } = {
        id: 'receive',
        name: 'OrdersIn',
        direction: 'receive',
        transport: 'http',
        pattern: 'request-response',
        address: 'https://orders.example.com/incoming',
        sourceMapping: {
            biztalk: { receivePortName: 'ReceiveOrders', adapterType: 'WCF-BasicHttp' },
        },
    };
    const send: IRSendEndpoint & { address: string } = {
        id: 'send',
        name: 'SendOrders',
        direction: 'send',
        transport: 'http',
        pattern: 'one-way',
        address: 'https://erp.example.com/orders',
        sourceMapping: { biztalk: { sendPortName: 'SendOrders', adapterType: 'WCF-BasicHttp' } },
    };
    const unrelated: IRSendEndpoint & { address: string } = {
        ...send,
        id: 'unrelated',
        name: 'Send_Orders',
        address: 'https://unrelated.example.com/orders',
        sourceMapping: { biztalk: { sendPortName: 'Send_Orders', adapterType: 'WCF-BasicHttp' } },
    };
    return artifact({
        ...ir,
        metadata: {
            ...ir.metadata,
            source: { ...ir.metadata.source, application: 'OrderApplication' },
        },
        endpoints: { receive: [receive], send: [send, unrelated] },
        connections: [
            {
                id: 'erp',
                name: 'ERP',
                type: 'http',
                category: 'api',
                config: { tlsVersion: '1.2', password: 'must-not-export-password' },
                authentication: { type: 'basic', username: 'must-not-export-username' },
                sourceMapping: { biztalk: { address: send.address } },
            },
            {
                id: 'other',
                name: 'Unrelated',
                type: 'http',
                category: 'api',
                config: { tlsVersion: 'UNRELATED-TLS' },
                sourceMapping: { biztalk: { address: unrelated.address } },
            },
        ],
    });
}

function documentXml(document: Document): string {
    return JSON.stringify(
        document.Document.View.prepForXml({
            file: document,
            viewWrapper: document.Document,
            stack: [],
        })
    );
}

function render(result = analysis(), artifacts: readonly ParsedArtifact[] = []): string {
    return documentXml(
        createBizTalkDiscoveryReport({
            flowName: 'Order Processing',
            result,
            artifacts,
            generatedAt: new Date('2026-09-29T12:00:00Z'),
        })
    );
}

interface ExportTestOptions {
    platform: string;
    directory: string;
    artifacts?: ParsedArtifact[];
    artifactIds?: string[];
    plan?: FlowPlanningResult;
    missingGroup?: boolean;
}

function loadExporter(options: ExportTestOptions) {
    const documents: Document[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let inventoryReads = 0;
    const filePath = require.resolve('../../services/ReportExporterService');
    const localRequire = createRequire(filePath);
    const logger = {
        debug: () => undefined,
        warn: (message: string) => warnings.push(message),
        error: (message: string) => errors.push(message),
    };
    const mocks = new Map<string, unknown>([
        [
            'vscode',
            {
                ProgressLocation: { Notification: 1 },
                workspace: { workspaceFolders: [{ uri: { fsPath: options.directory } }] },
                Uri: {
                    file: (fsPath: string) => ({ fsPath }),
                    joinPath: (base: { fsPath: string }, name: string) => ({
                        fsPath: path.join(base.fsPath, name),
                    }),
                },
                window: {
                    withProgress: (
                        _options: unknown,
                        action: (progress: { report: () => void }) => Promise<unknown>
                    ) => action({ report: () => undefined }),
                    showSaveDialog: async (dialog: { defaultUri: { fsPath: string } }) =>
                        dialog.defaultUri,
                    showErrorMessage: (message: string) => errors.push(message),
                    showWarningMessage: (message: string) => warnings.push(message),
                },
            },
        ],
        [
            'docx',
            {
                ...docx,
                Packer: {
                    toBuffer: async (document: Document) => {
                        documents.push(document);
                        return Packer.toBuffer(document);
                    },
                },
            },
        ],
        ['./LoggingService', { LoggingService: { getInstance: () => logger } }],
        [
            './MermaidImageRenderer',
            {
                MermaidImageRenderer: {
                    getInstance: () => ({ renderToBuffer: async () => undefined }),
                },
            },
        ],
        [
            './ConfigurationService',
            {
                ConfigurationService: {
                    getInstance: () => ({ getSourcePlatform: () => options.platform }),
                },
            },
        ],
        [
            '../stages/discovery/DiscoveryCacheService',
            {
                DiscoveryCacheService: {
                    getInstance: () => ({
                        getFlowGroup: () =>
                            options.missingGroup
                                ? undefined
                                : { artifactIds: options.artifactIds ?? [] },
                    }),
                },
            },
        ],
        [
            '../stages/discovery/InventoryService',
            {
                InventoryService: {
                    getInstance: () => ({
                        getAllParsedArtifacts: async () => {
                            inventoryReads++;
                            return options.artifacts ?? [];
                        },
                    }),
                },
            },
        ],
        [
            '../stages/planning/PlanningCacheService',
            {
                PlanningCacheService: { getInstance: () => ({ get: () => options.plan }) },
            },
        ],
    ]);
    const module: {
        exports: Partial<typeof import('../../services/ReportExporterService')>;
    } = { exports: {} };
    // Load the real compiled exporter with VS Code boundaries stubbed, without activating the extension.
    const factory: unknown = new Script(
        `(function(require, module, exports) { ${fs.readFileSync(filePath, 'utf8')}\n})`,
        { filename: filePath }
    ).runInThisContext();
    assert.strictEqual(typeof factory, 'function');
    if (typeof factory !== 'function') {
        throw new Error('Exporter module did not compile to a CommonJS factory.');
    }
    factory(
        (name: string) => (mocks.has(name) ? mocks.get(name) : localRequire(name)),
        module,
        module.exports
    );
    assert.ok(module.exports.ReportExporterService);
    return {
        exporter: module.exports.ReportExporterService.getInstance(),
        documents,
        errors,
        warnings,
        get inventoryReads() {
            return inventoryReads;
        },
    };
}

describe('Report export routing', () => {
    const directories: string[] = [];
    function directory(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biztalk-report-test-'));
        directories.push(dir);
        return dir;
    }
    afterEach(() => {
        for (const dir of directories.splice(0)) {
            for (const name of fs.readdirSync(dir)) {
                fs.unlinkSync(path.join(dir, name));
            }
            fs.rmdirSync(dir);
        }
    });

    it('routes BizTalk to the new template and scopes supplemental inventory to the flow', async () => {
        const selected = bindings();
        const other = artifact({
            ...selected.ir,
            metadata: {
                ...selected.ir.metadata,
                id: 'other-flow',
                source: {
                    ...selected.ir.metadata.source,
                    application: 'UnrelatedApplication',
                },
            },
        });
        const harness = loadExporter({
            platform: 'biztalk',
            directory: directory(),
            artifacts: [selected, other],
            artifactIds: [selected.id],
        });
        const saved = await harness.exporter.generateAnalysisReport(
            'orders',
            'Order Processing',
            analysis()
        );
        assert.ok(saved);
        assert.ok(fs.existsSync(saved));
        assert.deepStrictEqual(harness.errors, []);
        assert.strictEqual(harness.inventoryReads, 1);
        const contents = documentXml(harness.documents[0]);
        assert.ok(contents.includes('Migration Discovery Report'));
        assert.ok(contents.includes('OrderApplication'));
        assert.ok(!contents.includes('UnrelatedApplication'));
        assert.ok(path.basename(saved).startsWith('Order_Processing_Analysis_Report_'));
    });

    for (const platform of ['mulesoft', 'tibco']) {
        it(`keeps the existing ${platform} analysis export format`, async () => {
            const harness = loadExporter({ platform, directory: directory() });
            const saved = await harness.exporter.generateAnalysisReport(
                'orders',
                'Orders',
                analysis()
            );
            assert.ok(saved);
            assert.deepStrictEqual(harness.errors, []);
            assert.strictEqual(harness.inventoryReads, 0);
            const contents = documentXml(harness.documents[0]);
            assert.ok(contents.includes('Source Analysis Report'));
            assert.ok(contents.includes('Artifact Summary'));
            assert.ok(!contents.includes('3.3 Interface Catalog'));
        });
    }

    it('keeps the planning document and export filename unchanged for BizTalk', async () => {
        const plan: FlowPlanningResult = {
            flowId: 'orders',
            flowName: 'Order Processing',
            generatedAt: '2026-09-29T00:00:00Z',
            mermaid: '',
            explanation: 'The target order-processing design.',
            summary: 'Plan an order workflow.',
            workflows: [
                {
                    name: 'OrderProcessing',
                    description: 'Transform incoming orders.',
                    triggerType: 'HTTP request',
                    actions: ['Transform', 'Send'],
                    sourceArtifactIds: [],
                },
            ],
            azureComponents: [],
            connectorMappings: [],
            actionMappings: [],
            gaps: [],
            patterns: [],
        };
        const harness = loadExporter({ platform: 'biztalk', directory: directory(), plan });
        const saved = await harness.exporter.generatePlanningReport('orders');
        assert.ok(saved);
        assert.deepStrictEqual(harness.errors, []);
        assert.strictEqual(harness.inventoryReads, 0);
        const contents = documentXml(harness.documents[0]);
        assert.ok(contents.includes('Migration Planning Report'));
        assert.ok(contents.includes('Planned Workflows'));
        assert.ok(contents.includes('Target Architecture'));
        assert.ok(!contents.includes('Migration Discovery Report'));
        assert.ok(path.basename(saved).startsWith('Order_Processing_Planning_Report_'));
    });

    it('exports saved analysis without inventory when the group is unavailable and logs the limitation', async () => {
        const harness = loadExporter({
            platform: 'biztalk',
            directory: directory(),
            missingGroup: true,
        });
        assert.ok(await harness.exporter.generateAnalysisReport('orders', 'Orders', analysis()));
        assert.deepStrictEqual(harness.errors, []);
        assert.strictEqual(harness.inventoryReads, 0);
        assert.ok(
            harness.warnings.some((warning) => warning.includes('supplemental inventory metadata'))
        );
    });
});
describe('BizTalk discovery report', () => {
    it('uses the supplied six-section structure and BizTalk-specific inventory', async () => {
        const report = createBizTalkDiscoveryReport({
            flowName: 'Order Processing',
            result: analysis(),
            artifacts: [bindings()],
        });
        const contents = render(analysis(), [bindings()]);
        const headings = [
            '1. Executive Summary',
            '2. Current-State Architecture Overview',
            '3. Inventory & Application Portfolio',
            '4. Message Flow & Runtime Characteristics',
            '5. Adapter & Connectivity Assessment',
            '6. Findings, Risks, and Recommendations',
        ];
        let previous = -1;
        for (const heading of headings) {
            const position = contents.indexOf(heading);
            assert.ok(position > previous, `${heading} is present in order`);
            previous = position;
        }
        assert.ok(contents.includes('Migration Discovery Report'));
        assert.ok(contents.includes('3.1 Application Inventory'));
        assert.ok(contents.includes('OrderApplication'));
        assert.ok(contents.includes('3.2 Artifact Inventory (BizTalk)'));
        assert.ok(contents.includes('3.3 Interface Catalog (Integration Map)'));
        assert.ok(!contents.includes('Depends on Product'));
        const packed = await Packer.toBuffer(report);
        assert.strictEqual(packed.subarray(0, 2).toString(), 'PK');
    });

    it('matches the reference fonts, heading colors, and page margins', () => {
        const report = createBizTalkDiscoveryReport({ flowName: 'Orders', result: analysis() });
        const styles = JSON.stringify(
            report.Styles.prepForXml({
                file: report,
                viewWrapper: report.Document,
                stack: [],
            })
        );
        assert.ok(styles.includes('Calibri'));
        assert.ok(styles.includes('17365D'));
        assert.ok(styles.includes('365F91'));
        assert.ok(styles.includes('4F81BD'));
        const contents = documentXml(report);
        assert.match(contents, /"w:left":(?:1800|"1800")/);
        assert.match(contents, /"w:right":(?:1800|"1800")/);
    });

    it('embeds the supplied architecture image in the new layout', async () => {
        const image = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh1kAAAAASUVORK5CYII=',
            'base64'
        );
        const report = createBizTalkDiscoveryReport({
            flowName: 'Orders',
            result: analysis(),
            architectureImage: image,
        });
        assert.ok(documentXml(report).includes('pic:pic'));
        assert.ok((await Packer.toBuffer(report)).length > image.length);
    });

    it('maps only the selected interfaces and keeps adapter and exchange facts distinct', () => {
        const contents = render(analysis(), [bindings()]);
        assert.ok(contents.includes('https://orders.example.com/incoming'));
        assert.ok(contents.includes('BizTalk: ReceiveOrders'));
        assert.ok(contents.includes('https://erp.example.com/orders'));
        assert.ok(contents.includes('WCF-BasicHttp'));
        assert.ok(contents.includes('request-response'));
        assert.ok(contents.includes('one-way'));
        assert.ok(contents.includes('urn:orders#Order'));
        assert.ok(!contents.includes('Send_Orders'));
        assert.ok(!contents.includes('unrelated.example.com'));
        assert.ok(!contents.includes('UNRELATED-TLS'));
        assert.ok(!contents.includes('Sync / async classification'));
        assert.ok(!contents.includes('Processing mode'));
        assert.ok(!contents.includes('Critical path'));
        assert.ok(!contents.includes('Frequency'));
    });

    it('classifies internal systems and external partners from canonical IR, not guessed property keys', () => {
        const partnerConnection = bindings();
        const ir: IRDocument = {
            ...partnerConnection.ir,
            b2b: {
                enabled: true,
                partners: [
                    {
                        id: 'contoso',
                        name: 'Contoso Distribution',
                        identifier: { qualifier: 'ZZ', value: 'CONTOSO' },
                    },
                ],
                agreements: [
                    {
                        id: 'contoso-as2',
                        name: 'Contoso AS2 Agreement',
                        protocol: 'as2',
                        hostPartner: 'OrderApplication',
                        guestPartner: 'Contoso Distribution',
                    },
                ],
            },
        };
        const contents = render(analysis(), [artifact(ir)]);
        const architecture = contents.slice(
            contents.indexOf('2. Current-State'),
            contents.indexOf('3. Inventory')
        );
        assert.ok(architecture.includes('Contoso Distribution (ZZ:CONTOSO)'));
        assert.ok(
            architecture.includes(
                'Contoso AS2 Agreement: as2 between OrderApplication and Contoso Distribution'
            )
        );
        assert.ok(architecture.includes('ERP (http'));
        assert.ok(!architecture.includes('Unrelated (http'));
    });

    it('surfaces the recorded certificate inventory distinct from per-connection authentication facts', () => {
        const source = bindings();
        const ir: IRDocument = {
            ...source.ir,
            dependencies: {
                certificates: [
                    {
                        id: 'erp-cert',
                        name: 'ERP Client Certificate',
                        type: 'x509',
                        usage: 'tls',
                        thumbprint: 'AA11BB22CC33',
                        expiryDate: '2027-01-01',
                    },
                ],
            },
        };
        const contents = render(analysis(), [artifact(ir)]);
        const connectivity = contents.slice(
            contents.indexOf('5. Adapter'),
            contents.indexOf('6. Findings')
        );
        assert.ok(connectivity.includes('Recorded Certificates'));
        assert.ok(connectivity.includes('ERP Client Certificate'));
        assert.ok(connectivity.includes('AA11BB22CC33'));
        assert.ok(connectivity.includes('2027-01-01'));
    });

    it('renders the integration map as one source-to-target interface catalog', () => {
        const contents = render(analysis(), [bindings()]);
        const catalog = contents.slice(
            contents.indexOf('3.3 Interface Catalog'),
            contents.indexOf('4. Message Flow')
        );
        assert.ok(catalog.includes('Source -> target'));
        assert.ok(
            catalog.includes('https://orders.example.com/incoming -> BizTalk: ReceiveOrders')
        );
        assert.ok(catalog.includes('BizTalk: SendOrders -> https://erp.example.com/orders'));
        assert.strictEqual((catalog.match(/"w:tbl":/g) ?? []).length, 1);
    });

    it('includes optional integration characteristics only when explicitly recorded', () => {
        const input = analysis();
        const first = input.componentDetails?.[0];
        assert.ok(first);
        first.properties = {
            sourceSystem: 'CRM',
            targetSystem: 'OrderProcessing',
            frequency: 'Every 5 minutes',
            syncAsync: 'Asynchronous',
            batchOrRealTime: 'Batch',
            criticalPath: 'Order submission',
            orderedDelivery: 'Enabled on the send port',
            largeMessageHandling: 'Streaming pipeline',
        };
        const contents = render(input);
        for (const value of [
            'CRM',
            'Every 5 minutes',
            'Asynchronous',
            'Batch',
            'Order submission',
            '4.2 Non-Functional Patterns',
            'Enabled on the send port',
            'Streaming pipeline',
        ]) {
            assert.ok(contents.includes(value), value);
        }
    });

    it('preserves explicit false and zero values in runtime metadata', () => {
        const input = analysis();
        const step = input.messageFlow?.[0];
        assert.ok(step);
        step.additionalDetails = { criticalPath: false, pollingInterval: 0 };
        const contents = render(input);
        assert.ok(contents.includes('Critical path: No'));
        assert.ok(contents.includes('Frequency: 0'));
    });

    it('exports only relevant connectivity properties, not credentials', () => {
        const contents = render(analysis(), [bindings()]);
        assert.ok(contents.includes('TLS version'));
        assert.ok(contents.includes('1.2'));
        assert.ok(contents.includes('Authentication'));
        assert.ok(contents.includes('basic'));
        assert.ok(!contents.includes('must-not-export-password'));
        assert.ok(!contents.includes('must-not-export-username'));
    });

    it('omits credentials and query strings from displayed endpoint addresses', () => {
        const input = analysis();
        const component = input.componentDetails?.[0];
        assert.ok(component);
        component.properties = {
            source: 'https://test-user:test-password@source.example.com/orders?sig=test-signature',
        };
        const contents = render(input);
        assert.ok(contents.includes('https://source.example.com/orders'));
        assert.ok(!contents.includes('test-user'));
        assert.ok(!contents.includes('test-password'));
        assert.ok(!contents.includes('test-signature'));
    });

    it('limits executive findings and risks to ten while retaining detailed findings', () => {
        const input = analysis({
            notes: Array.from({ length: 12 }, (_, index) => `Finding-${index + 1}.`),
            gapAnalysis: Array.from({ length: 12 }, (_, index) => ({
                component: `Component-${index + 1}.`,
                componentType: 'orchestration',
                gap: `Gap-${index + 1}.`,
                severity: index === 11 ? 'high' : 'low',
                options: [],
                recommendation: `Recommendation-${index + 1}.`,
            })),
        });
        const contents = render(input);
        const findings = contents.slice(
            contents.indexOf('Key Findings (Top 10)'),
            contents.indexOf('Key Risks (Top 10)')
        );
        assert.ok(findings.includes('Finding-10.'));
        assert.ok(!findings.includes('Finding-11.'));
        const risks = contents.slice(
            contents.indexOf('Key Risks (Top 10)'),
            contents.indexOf('Recommendations Summary')
        );
        assert.strictEqual((risks.match(/\[(?:HIGH|LOW)\]/g) ?? []).length, 10);
        assert.ok(risks.indexOf('Component-12.') < risks.indexOf('Component-1.'));
        const details = contents.slice(contents.indexOf('6. Findings, Risks, and Recommendations'));
        assert.ok(details.includes('Finding-12.'));
        assert.ok(details.includes('Gap-12.'));
    });

    it('includes dependency blockers without treating framework references as migration risks', () => {
        const input = analysis({
            dependencyAnalysis: {
                summary: 'A custom pricing assembly is missing.',
                allCriticalResolved: false,
                counts: { critical: 1, warning: 0, info: 1 },
                missingDependencies: [
                    {
                        id: 'pricing',
                        name: 'Pricing.dll',
                        type: 'dll',
                        origin: 'custom',
                        referencedBy: ['OrderOrchestration'],
                        reason: 'Pricing implementation is unavailable.',
                        severity: 'critical',
                        blocksMigration: true,
                        migrationRelevant: true,
                        resolution: 'Provide the pricing source.',
                    },
                    {
                        id: 'system',
                        name: 'System.Framework.dll',
                        type: 'assembly',
                        origin: 'standard-framework',
                        referencedBy: ['OrderOrchestration'],
                        reason: 'Framework reference.',
                        severity: 'info',
                        blocksMigration: false,
                        migrationRelevant: false,
                    },
                ],
            },
        });
        const contents = render(input);
        assert.ok(contents.includes('[CRITICAL] Pricing.dll'));
        assert.ok(contents.includes('Blocks migration.'));
        assert.ok(contents.includes('Provide the pricing source.'));
        assert.ok(!contents.includes('System.Framework.dll'));
    });

    it('uses recorded correlation and compensation details', () => {
        const ir = createEmptyIRDocument('orch', 'OrderOrchestration');
        const source = artifact(
            {
                ...ir,
                correlation: {
                    sets: [
                        {
                            id: 'order-correlation',
                            name: 'OrderCorrelation',
                            properties: [],
                            initializingActions: [],
                            followingActions: [],
                            pattern: 'sequential-convoy',
                        },
                    ],
                },
                errorHandling: {
                    handlers: [
                        {
                            id: 'compensate',
                            name: 'CompensateOrder',
                            type: 'compensation',
                            compensatingActions: [{ id: 'UndoReservation', type: 'compensate' }],
                        },
                    ],
                },
            },
            'orchestration'
        );
        const contents = render(analysis(), [source]);
        assert.ok(contents.includes('OrderCorrelation'));
        assert.ok(contents.includes('sequential-convoy'));
        assert.ok(contents.includes('CompensateOrder'));
        assert.ok(contents.includes('UndoReservation'));
    });

    it('does not invent complexity scores from default parser metadata', () => {
        const unscored = bindings();
        assert.ok(!render(analysis(), [unscored]).includes('Recorded score (0-100)'));
        const scored = artifact({
            ...unscored.ir,
            metadata: {
                ...unscored.ir.metadata,
                migration: {
                    ...unscored.ir.metadata.migration,
                    complexityScore: 67,
                    complexity: 'high',
                    complexityFactors: [
                        {
                            factor: 'Custom pipeline',
                            weight: 25,
                            description: 'Port the custom disassembler.',
                        },
                    ],
                },
            },
        });
        const contents = render(analysis(), [scored]);
        assert.ok(contents.includes('Recorded score (0-100)'));
        assert.ok(contents.includes('67'));
        assert.ok(contents.includes('Custom pipeline (weight 25)'));
    });

    it('keeps candidate target mappings distinct from finalized planning', () => {
        const contents = render();
        assert.ok(contents.includes('Candidate Target Architecture'));
        assert.ok(contents.includes('HTTP action'));
        assert.ok(contents.includes('The finalized target design belongs to the Planning phase.'));
    });

    it('handles sparse analysis without producing inapplicable detail rows', () => {
        const contents = render(
            analysis({
                summary: {
                    receiveLocations: [],
                    receivePorts: [],
                    receivePipelines: [],
                    orchestrations: [],
                    maps: [],
                    schemas: [],
                    sendPorts: [],
                    sendPipelines: [],
                },
                componentDetails: [],
                messageFlow: [],
            })
        );
        assert.ok(contents.includes('6. Findings, Risks, and Recommendations'));
        assert.ok(contents.includes('No interface-level metadata'));
        for (const label of [
            'Frequency',
            'TLS version',
            'Critical path',
            '4.2 Non-Functional Patterns',
            'Key Risks (Top 10)',
        ]) {
            assert.ok(!contents.includes(label), label);
        }
    });

    it('retains interface names and directions from summary-only cached analyses', () => {
        const contents = render(analysis({ componentDetails: [], messageFlow: [] }));
        const catalog = contents.slice(
            contents.indexOf('3.3 Interface Catalog'),
            contents.indexOf('4. Message Flow')
        );
        assert.ok(catalog.includes('OrdersIn'));
        assert.ok(catalog.includes('ReceiveOrders'));
        assert.ok(catalog.includes('SendOrders'));
        assert.ok(catalog.includes('Direction: Receive'));
        assert.ok(catalog.includes('Direction: Send'));
        assert.ok(!catalog.includes('Frequency'));
    });

    it('does not change the analysis or artifact objects consumed by the tabs', () => {
        const input = analysis();
        const sources = [bindings()];
        const before = JSON.stringify({ input, sources });
        render(input, sources);
        assert.strictEqual(JSON.stringify({ input, sources }), before);
    });

    it('does not include supplemental metadata from other platforms', () => {
        const ir = createEmptyIRDocument('mule', 'MuleOnly', 'mulesoft');
        const source = artifact({
            ...ir,
            metadata: {
                ...ir.metadata,
                source: { ...ir.metadata.source, application: 'MuleOnlyApp' },
            },
        });
        assert.ok(!render(analysis(), [source]).includes('MuleOnlyApp'));
    });
});
