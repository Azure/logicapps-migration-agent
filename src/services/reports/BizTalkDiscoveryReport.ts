import {
    BorderStyle,
    Document,
    HeadingLevel,
    ImageRun,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import type { IRReceiveEndpoint, IRSendEndpoint } from '../../ir/types/advanced';
import type { IRConnection } from '../../ir/types/connections';
import type { ParsedArtifact } from '../../stages/discovery/types';
import type { GeneratedFlowResult } from '../LLMFlowGenerator';

interface DiscoveryReportOptions {
    flowName: string;
    result: GeneratedFlowResult;
    artifacts?: readonly ParsedArtifact[];
    architectureImage?: Buffer;
    generatedAt?: Date;
}

type ReportChild = Paragraph | Table;
type Facts = Readonly<Record<string, unknown>>;
type FactDefinition = readonly [label: string, ...keys: string[]];

interface ReportInterface {
    name: string;
    names: string[];
    direction?: 'Receive' | 'Send';
    records: Facts[];
    messageTypes: string[];
    /** Connections matched to this interface's endpoint address, kept distinct from
     *  the records bag so callers can list connected systems without re-scanning every
     *  artifact's raw connections (which may include ports for unrelated flows). */
    connections: IRConnection[];
}

const ARTIFACT_CATEGORIES: readonly [keyof GeneratedFlowResult['summary'], string][] = [
    ['receiveLocations', 'Receive locations'],
    ['receivePorts', 'Receive ports'],
    ['receivePipelines', 'Receive pipelines'],
    ['orchestrations', 'Orchestrations'],
    ['maps', 'Maps'],
    ['schemas', 'Schemas'],
    ['sendPorts', 'Send ports'],
    ['sendPipelines', 'Send pipelines'],
];

const INTERFACE_FACTS: readonly FactDefinition[] = [
    ['Source', 'sourceSystem', 'sourceEndpoint', 'source'],
    ['Target', 'targetSystem', 'targetEndpoint', 'target'],
    ['Direction', 'direction'],
    ['Adapter / protocol', 'adapterType', 'adapter', 'protocol', 'transportType'],
    ['Exchange pattern', 'exchangePattern', 'communicationPattern'],
    ['Sync / async classification', 'syncAsync', 'syncAsyncClassification', 'communicationMode'],
    ['Frequency', 'frequency', 'schedule', 'pollingInterval'],
    ['Polling interval unit', 'pollingIntervalUnit', 'pollingUnitOfMeasure'],
    ['Processing mode', 'processingMode', 'batchOrRealTime', 'batchVsRealTime'],
    ['Critical path', 'criticalPath', 'isCriticalPath'],
];

const CONNECTIVITY_FACTS: readonly FactDefinition[] = [
    ['Adapter / protocol', 'adapterType', 'adapter', 'protocol', 'transportType'],
    ['Authentication', 'authenticationType', 'authenticationMode', 'authentication'],
    ['Client credential type', 'transportClientCredentialType', 'clientCredentialType'],
    ['Security mode', 'securityMode'],
    ['TLS version', 'tlsVersion', 'sslProtocol'],
    ['SSL enabled', 'useSSL', 'enableSSL'],
    ['Certificate usage', 'certificateUsage'],
    ['Certificate thumbprint', 'certificateThumbprint', 'clientCertificateThumbprint'],
    ['Partner connectivity', 'partnerConnectivity', 'partnerName', 'tradingPartner'],
    ['Legacy connectivity', 'legacyConnectivity'],
];

const FLOW_FACTS: readonly FactDefinition[] = [
    ['Correlation', 'correlation', 'correlationSet', 'correlationPattern'],
    ['Convoy pattern', 'convoy', 'convoyPattern'],
    ['Error path', 'errorPath', 'errorHandling'],
    ['Compensation', 'compensation', 'compensationLogic'],
];

const NON_FUNCTIONAL_FACTS: readonly FactDefinition[] = [
    ['Ordering guarantees', 'orderingGuarantees', 'orderedDelivery'],
    ['Large message handling', 'largeMessageHandling', 'largeMessages'],
    ['Maximum message size', 'maxMessageSize', 'maximumMessageSize'],
];

/**
 * Export-only BizTalk layout. Optional details are copied from recorded evidence,
 * never inferred from an adapter name or a parser's default complexity score.
 */
export function createBizTalkDiscoveryReport(options: DiscoveryReportOptions): Document {
    const { flowName, result, architectureImage } = options;
    const artifacts = (options.artifacts ?? []).filter(
        (artifact) => artifact.ir.metadata.source.platform === 'biztalk'
    );
    const components = result.componentDetails ?? [];
    const patterns = result.migrationPatterns ?? [];
    const gaps = result.gapAnalysis ?? [];
    const dependencies = (result.dependencyAnalysis?.missingDependencies ?? []).filter(
        (dependency) => dependency.migrationRelevant !== false
    );
    const interfaces = collectInterfaces(result, artifacts);
    const inventory = ARTIFACT_CATEGORIES.flatMap(([key, label]) => {
        const names = unique(result.summary[key] ?? []);
        return names.length > 0 ? [[label, String(names.length), names.join('\n')]] : [];
    });
    const findings = unique([
        ...(result.notes ?? []),
        ...patterns.map((pattern) => `${pattern.pattern}: ${pattern.description}`),
    ]);
    const severityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        warning: 2,
        medium: 2,
        low: 3,
    };
    const risks = [
        ...gaps.map((gap) => ({
            severity: gap.severity,
            text: `${gap.component}: ${gap.gap}`,
        })),
        ...dependencies
            .filter((dependency) => dependency.severity !== 'info' || dependency.blocksMigration)
            .map((dependency) => ({
                severity: dependency.severity,
                text: `${dependency.name}: ${dependency.reason}`,
            })),
    ]
        .sort(
            (left, right) =>
                (severityOrder[left.severity] ?? 4) - (severityOrder[right.severity] ?? 4)
        )
        .map((risk) => `[${risk.severity.toUpperCase()}] ${risk.text}`);
    const recommendations = unique([
        ...gaps.map((gap) => gap.recommendation),
        ...dependencies.map((dependency) => displayValue(dependency.resolution) ?? ''),
    ]);
    const recordedFacts = [
        ...components.map((component) => ({
            name: component.name,
            records: [component.properties ?? {}],
        })),
        ...(result.messageFlow ?? []).map((step) => ({
            name: step.component,
            records: [step.additionalDetails ?? {}],
        })),
        ...interfaces,
    ];

    const children: ReportChild[] = [
        new Paragraph({ text: 'Migration Discovery Report', heading: HeadingLevel.TITLE }),
        paragraph(flowName, true),
        paragraph(
            `Source platform: BizTalk | Generated: ${(options.generatedAt ?? new Date()).toLocaleDateString('en-US')}`
        ),
        paragraph(
            'Scope: the selected integration flow and its discovered artifacts, not the entire application estate.'
        ),
        heading('1. Executive Summary'),
        subheading('Integration Workload Overview (at-a-glance)'),
        paragraph(result.explanation),
    ];
    if (inventory.length > 0) {
        children.push(
            table(
                ['Artifact category', 'Count'],
                inventory.map((row) => row.slice(0, 2))
            )
        );
    }
    appendList(children, 'Key Findings (Top 10)', findings.slice(0, 10));
    appendList(children, 'Key Risks (Top 10)', unique(risks).slice(0, 10));
    appendList(children, 'Recommendations Summary', recommendations);

    children.push(heading('2. Current-State Architecture Overview'), paragraph(result.explanation));
    if (architectureImage) {
        children.push(
            new Paragraph({
                children: [
                    new ImageRun({
                        type: 'png',
                        data: architectureImage,
                        transformation: { width: 540, height: 405 },
                    }),
                ],
            })
        );
    } else if (result.mermaid.trim()) {
        children.push(
            paragraph('Architecture diagram image unavailable; recorded diagram source follows.')
        );
        for (const line of result.mermaid.split('\n')) {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: line, font: 'Consolas', size: 16 })],
                })
            );
        }
    }
    // Trading partners/agreements come from the canonical ir.b2b structure, not from
    // guessed property names or keyword matches on free-text pattern descriptions.
    const tradingPartners = artifacts.flatMap((artifact) => artifact.ir.b2b?.partners ?? []);
    const tradingAgreements = artifacts.flatMap((artifact) => artifact.ir.b2b?.agreements ?? []);
    const partnerNames = new Set(tradingPartners.map((partner) => nameKey(partner.name)));
    const taggedPartnerComponents = components.filter((component) =>
        ['partner', 'tradingpartner', 'b2b', 'agreement'].includes(normalize(component.type))
    );
    for (const component of taggedPartnerComponents) {
        partnerNames.add(nameKey(component.name));
    }
    appendList(
        children,
        'Internal Systems',
        unique(
            dedupeByName(
                interfaces.flatMap((entry) => entry.connections),
                (connection) => connection.name
            )
                .filter((connection) => !partnerNames.has(nameKey(connection.name)))
                .map(
                    (connection) =>
                        `${connection.name} (${connection.type}${connection.description ? `: ${connection.description}` : ''})`
                )
        )
    );
    appendList(
        children,
        'External Partners and B2B Flows',
        unique([
            ...tradingPartners.map(
                (partner) =>
                    `${partner.name} (${partner.identifier.qualifier}:${partner.identifier.value})`
            ),
            ...tradingAgreements.map(
                (agreement) =>
                    `${agreement.name}: ${agreement.protocol} between ${agreement.hostPartner} and ${agreement.guestPartner}`
            ),
            ...taggedPartnerComponents.map(
                (component) => `${component.name}: ${component.description}`
            ),
        ])
    );

    children.push(heading('3. Inventory & Application Portfolio'));
    const applications = unique(
        artifacts.map((artifact) => artifact.ir.metadata.source.application)
    );
    if (applications.length > 0) {
        children.push(subheading('3.1 Application Inventory'));
        children.push(
            table(
                ['Application', 'Selected source artifacts'],
                applications.map((application) => [
                    application,
                    artifacts
                        .filter(
                            (artifact) => artifact.ir.metadata.source.application === application
                        )
                        .map((artifact) => artifact.name)
                        .join('\n'),
                ])
            )
        );
    }
    children.push(subheading('3.2 Artifact Inventory (BizTalk)'));
    if (inventory.length > 0) {
        children.push(table(['Artifact category', 'Count', 'Artifacts'], inventory));
    }
    if (components.length > 0) {
        children.push(
            table(
                ['Component', 'Type', 'Description'],
                components.map((component) => [
                    component.name,
                    component.type,
                    component.description,
                ])
            )
        );
    }
    if (artifacts.length > 0) {
        children.push(paragraph('Selected Source Files', true));
        children.push(
            table(
                ['Artifact', 'Type', 'Source file'],
                artifacts.map((artifact) => [artifact.name, artifact.type, artifact.sourcePath])
            )
        );
    }
    appendList(
        children,
        'Custom Components',
        unique([
            ...artifacts
                .filter((artifact) => artifact.type === 'custom-code')
                .map((artifact) => artifact.name),
            ...components
                .filter((component) =>
                    [
                        'customcode',
                        'customcomponent',
                        'custompipelinecomponent',
                        'assembly',
                        'dll',
                    ].includes(normalize(component.type))
                )
                .map((component) => `${component.name}: ${component.description}`),
        ])
    );
    children.push(subheading('3.3 Interface Catalog (Integration Map)'));
    if (interfaces.length > 0) {
        children.push(interfaceCatalog(interfaces));
    } else {
        children.push(
            paragraph(
                'No interface-level metadata is included in the saved analysis for this flow.'
            )
        );
    }

    children.push(
        heading('4. Message Flow & Runtime Characteristics'),
        subheading('4.1 End-to-End Flow Documentation')
    );
    const steps = result.messageFlow ?? [];
    if (steps.length > 0) {
        children.push(
            table(
                ['Step', 'Component', 'Action', 'Description'],
                steps.map((step) => [
                    String(step.step),
                    step.component,
                    step.action,
                    step.description,
                ])
            )
        );
    } else {
        children.push(paragraph('No step-by-step message flow is included in the saved analysis.'));
    }
    appendRecordedFacts(children, recordedFacts, FLOW_FACTS);
    const correlations = artifacts.flatMap((artifact) =>
        (artifact.ir.correlation?.sets ?? []).map((set) => [artifact.name, set.name, set.pattern])
    );
    if (correlations.length > 0) {
        children.push(paragraph('Recorded Correlation and Convoy Patterns', true));
        children.push(table(['Artifact', 'Correlation set', 'Pattern'], correlations));
    }
    const errorHandlers = artifacts.flatMap((artifact) =>
        (artifact.ir.errorHandling?.handlers ?? []).map((handler) => [
            artifact.name,
            handler.name,
            handler.type,
            (handler.compensatingActions ?? []).map((action) => action.id).join('\n'),
        ])
    );
    if (errorHandlers.length > 0) {
        children.push(paragraph('Recorded Error Paths and Compensation', true));
        children.push(
            table(['Artifact', 'Handler', 'Type', 'Compensating actions'], errorHandlers)
        );
    }
    const nonFunctionalRows = recordedFactRows(recordedFacts, NON_FUNCTIONAL_FACTS);
    if (nonFunctionalRows.length > 0) {
        children.push(subheading('4.2 Non-Functional Patterns'));
        children.push(table(['Component', 'Characteristic', 'Recorded value'], nonFunctionalRows));
    }

    children.push(heading('5. Adapter & Connectivity Assessment'));
    let hasConnectivity = false;
    for (const entry of interfaces) {
        const rows = factRows(entry.records, CONNECTIVITY_FACTS);
        if (rows.length > 0) {
            children.push(
                paragraph(entry.name, true),
                table(['Connectivity detail', 'Recorded value'], rows)
            );
            hasConnectivity = true;
        }
    }
    if (!hasConnectivity) {
        children.push(
            paragraph(
                'No adapter or connectivity configuration is included in the saved evidence for this flow.'
            )
        );
    }
    const certificates = dedupeByName(
        artifacts.flatMap((artifact) => artifact.ir.dependencies?.certificates ?? []),
        (certificate) => certificate.name
    );
    if (certificates.length > 0) {
        children.push(
            paragraph('Recorded Certificates', true),
            table(
                ['Certificate', 'Usage', 'Thumbprint', 'Expiry'],
                certificates.map((certificate) => [
                    certificate.name,
                    certificate.usage,
                    certificate.thumbprint ?? '',
                    certificate.expiryDate ?? '',
                ])
            )
        );
    }

    children.push(heading('6. Findings, Risks, and Recommendations'));
    appendList(children, 'Discovery Findings and Notes', result.notes ?? []);
    if (gaps.length > 0) {
        children.push(subheading('Migration Gaps and Recommendations'));
        children.push(
            table(
                ['Component', 'Risk / gap', 'Severity', 'Recommendation'],
                gaps.map((gap) => [
                    gap.component,
                    gap.gap,
                    gap.severity.toUpperCase(),
                    gap.recommendation,
                ])
            )
        );
    }
    if (dependencies.length > 0) {
        children.push(subheading('Dependency Findings'));
        children.push(
            table(
                ['Dependency', 'Finding', 'Severity', 'Resolution'],
                dependencies.map((dependency) => [
                    dependency.name,
                    `${dependency.reason}${dependency.blocksMigration ? '\nBlocks migration.' : ''}`,
                    dependency.severity.toUpperCase(),
                    displayValue(dependency.resolution) ?? '',
                ])
            )
        );
    }
    const mappings = components.filter((component) => component.azureEquivalent?.trim());
    if (mappings.length > 0) {
        children.push(
            subheading('Candidate Target Architecture'),
            paragraph(
                'Candidate component mappings recorded during discovery. The finalized target design belongs to the Planning phase.'
            ),
            table(
                ['Source component', 'Candidate Logic Apps equivalent'],
                mappings.map((component) => [component.name, component.azureEquivalent ?? ''])
            )
        );
    }
    if (patterns.length > 0) {
        children.push(subheading('Integration Patterns Mapping'));
        children.push(
            table(
                ['Pattern', 'BizTalk approach', 'Logic Apps approach', 'Recorded complexity'],
                patterns.map((pattern) => [
                    pattern.pattern,
                    pattern.biztalkApproach,
                    pattern.logicAppsApproach,
                    pattern.complexity,
                ])
            )
        );
    }
    const scoredArtifacts = artifacts.filter(
        (artifact) => artifact.ir.metadata.migration.complexityFactors.length > 0
    );
    if (scoredArtifacts.length > 0) {
        children.push(
            subheading('Effort Drivers and Recorded Complexity'),
            paragraph(
                'Scores and contributing factors below are recorded artifact assessments; no report-level scoring model is inferred.'
            ),
            table(
                ['Artifact', 'Recorded score (0-100)', 'Complexity', 'Contributing factors'],
                scoredArtifacts.map((artifact) => [
                    artifact.name,
                    String(artifact.ir.metadata.migration.complexityScore),
                    artifact.ir.metadata.migration.complexity,
                    artifact.ir.metadata.migration.complexityFactors
                        .map(
                            (factor) =>
                                `${factor.factor} (weight ${factor.weight})${factor.description ? `: ${factor.description}` : ''}`
                        )
                        .join('\n'),
                ])
            )
        );
    }

    return new Document({
        title: 'Migration Discovery Report',
        creator: 'Logic Apps Migration Agent',
        styles: {
            default: {
                document: {
                    run: { font: 'Calibri', size: 22 },
                    paragraph: { spacing: { after: 200, line: 276 } },
                },
                title: {
                    run: { font: 'Calibri', size: 52, color: '17365D' },
                    paragraph: {
                        spacing: { after: 300 },
                        border: {
                            bottom: {
                                style: BorderStyle.SINGLE,
                                size: 8,
                                color: '4F81BD',
                                space: 4,
                            },
                        },
                    },
                },
                heading1: {
                    run: { font: 'Calibri', size: 28, bold: true, color: '365F91' },
                    paragraph: { spacing: { before: 480, after: 0 }, keepNext: true },
                },
                heading2: {
                    run: { font: 'Calibri', size: 26, bold: true, color: '4F81BD' },
                    paragraph: { spacing: { before: 200, after: 0 }, keepNext: true },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        size: { width: 12240, height: 15840 },
                        margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 },
                    },
                },
                children,
            },
        ],
    });
}

function collectInterfaces(
    result: GeneratedFlowResult,
    artifacts: readonly ParsedArtifact[]
): ReportInterface[] {
    const components = result.componentDetails ?? [];
    const knownNames = new Set(
        [
            ...Object.values(result.summary).flat(),
            ...components.flatMap((component) => [component.id, component.name]),
            ...(result.messageFlow ?? []).map((step) => step.component),
        ].map(nameKey)
    );
    const entries: ReportInterface[] = [];

    function addEndpoint(
        endpoint: IRReceiveEndpoint | IRSendEndpoint,
        direction: 'Receive' | 'Send'
    ): void {
        const mapping = endpoint.sourceMapping?.biztalk ?? {};
        const port = readFact([mapping], ['receivePortName', 'sendPortName']);
        const names = unique([endpoint.name, port ?? '']);
        // Binding files can contain ports for other flows. Do not export those.
        if (!names.some((name) => knownNames.has(nameKey(name)))) {
            return;
        }
        if (
            entries.some(
                (entry) =>
                    entry.direction === direction && nameKey(entry.name) === nameKey(endpoint.name)
            )
        ) {
            return;
        }
        const address =
            'address' in endpoint
                ? displayValue(endpoint.address)
                : readFact([endpoint.config ?? {}], ['address']);
        const bizTalkPort = `BizTalk: ${port ?? endpoint.name}`;
        const adapter = readFact([mapping], ['adapterType']);
        const records: Facts[] = [
            {
                direction,
                source: direction === 'Receive' ? address : bizTalkPort,
                target: direction === 'Send' ? address : bizTalkPort,
                adapterType: adapter ?? endpoint.transport,
                exchangePattern: endpoint.pattern,
            },
            mapping,
            endpoint.config ?? {},
        ];
        const matchedConnections: IRConnection[] = [];
        if (address) {
            for (const artifact of artifacts) {
                for (const connection of artifact.ir.connections) {
                    // An adapter type alone is not enough to associate connection settings.
                    if (connection.sourceMapping?.biztalk?.address !== address) {
                        continue;
                    }
                    const connectionAdapter = readFact(
                        [connection.sourceMapping?.biztalk ?? {}],
                        ['adapterType']
                    );
                    if (
                        adapter &&
                        connectionAdapter &&
                        nameKey(adapter) !== nameKey(connectionAdapter)
                    ) {
                        continue;
                    }
                    matchedConnections.push(connection);
                    records.push(
                        { ...connection.config },
                        {
                            authenticationType: connection.authentication?.type,
                            certificateUsage: connection.authentication?.certificate
                                ? 'Client authentication'
                                : undefined,
                            certificateThumbprint:
                                connection.authentication?.certificate?.thumbprint,
                        }
                    );
                }
            }
        }
        entries.push({
            name: endpoint.name,
            names,
            direction,
            records,
            messageTypes: [],
            connections: matchedConnections,
        });
    }

    for (const artifact of artifacts) {
        for (const endpoint of artifact.ir.endpoints?.receive ?? []) {
            addEndpoint(endpoint, 'Receive');
        }
        for (const endpoint of artifact.ir.endpoints?.send ?? []) {
            if ('pattern' in endpoint) {
                addEndpoint(endpoint, 'Send');
            }
        }
    }
    for (const component of components) {
        const componentType = normalize(component.type);
        const matches = entries.filter(
            (entry) =>
                entry.names.some((name) => nameKey(name) === nameKey(component.name)) &&
                (componentType !== 'sendport' || entry.direction === 'Send') &&
                (!['receiveport', 'receivelocation'].includes(componentType) ||
                    entry.direction === 'Receive')
        );
        if (
            matches.length === 0 &&
            [
                'receivelocation',
                'receiveport',
                'sendport',
                'adapter',
                'endpoint',
                'interface',
            ].includes(normalize(component.type))
        ) {
            const entry: ReportInterface = {
                name: component.name,
                names: [component.id, component.name],
                direction:
                    componentType === 'sendport'
                        ? 'Send'
                        : ['receiveport', 'receivelocation'].includes(componentType)
                          ? 'Receive'
                          : undefined,
                records: [],
                messageTypes: [],
                connections: [],
            };
            entries.push(entry);
            matches.push(entry);
        }
        for (const entry of matches) {
            entry.records.push(component.properties ?? {});
            entry.messageTypes.push(
                ...unique([component.inputMessageType ?? '', component.outputMessageType ?? ''])
            );
        }
    }
    const summaryEndpoints: readonly [readonly string[], 'Receive' | 'Send'][] = [
        [result.summary.receiveLocations ?? [], 'Receive'],
        [result.summary.receivePorts ?? [], 'Receive'],
        [result.summary.sendPorts ?? [], 'Send'],
    ];
    for (const [names, direction] of summaryEndpoints) {
        for (const name of names) {
            const exists = entries.some(
                (entry) =>
                    (!entry.direction || entry.direction === direction) &&
                    entry.names.some((alias) => nameKey(alias) === nameKey(name))
            );
            if (!exists) {
                entries.push({
                    name,
                    names: [name],
                    direction,
                    records: [{ direction }],
                    messageTypes: [],
                    connections: [],
                });
            }
        }
    }
    for (const entry of entries) {
        for (const step of result.messageFlow ?? []) {
            if (entry.names.some((name) => nameKey(name) === nameKey(step.component))) {
                entry.records.push(step.additionalDetails ?? {});
                if (step.messageType) {
                    entry.messageTypes.push(step.messageType);
                }
            }
        }
        const recordedMessageTypes = readFact(entry.records, ['messageTypes', 'messageType']);
        if (recordedMessageTypes) {
            entry.messageTypes.push(recordedMessageTypes);
        }
    }
    return entries;
}

function normalize(value: string): string {
    return value.replace(/[\s_-]/g, '').toLowerCase();
}

function interfaceCatalog(interfaces: readonly ReportInterface[]): Table {
    const headers = [
        'Interface',
        'Source -> target',
        'Adapter / protocol',
        'Message types',
        'Applicable characteristics',
    ];
    const rows = interfaces.map((entry) => {
        const facts = new Map(factRows(entry.records, INTERFACE_FACTS));
        const source = facts.get('Source');
        const target = facts.get('Target');
        const route =
            source && target
                ? `${source} -> ${target}`
                : source
                  ? `Source: ${source}`
                  : target
                    ? `Target: ${target}`
                    : '';
        return [
            entry.name,
            route,
            facts.get('Adapter / protocol') ?? '',
            unique(entry.messageTypes).join('\n'),
            [...facts]
                .filter(([label]) => !['Source', 'Target', 'Adapter / protocol'].includes(label))
                .map(([label, value]) => `${label}: ${value}`)
                .join('\n'),
        ];
    });
    const columns = headers
        .map((_, index) => index)
        .filter((index) => rows.some((row) => row[index].length > 0));
    return table(
        columns.map((index) => headers[index]),
        rows.map((row) => columns.map((index) => row[index]))
    );
}

function nameKey(value: string): string {
    return value.trim().toLowerCase();
}

function unique(values: readonly string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function dedupeByName<T>(items: readonly T[], getName: (item: T) => string): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
        const key = nameKey(getName(item));
        if (key && !seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }
    return result;
}

function displayValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value.trim() || undefined;
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map(displayValue).filter(Boolean).join(', ') || undefined;
    }
    return undefined;
}

function readFact(records: readonly Facts[], keys: readonly string[]): string | undefined {
    for (const key of keys) {
        for (const record of records) {
            const entry = Object.entries(record).find(
                ([name]) => normalize(name) === normalize(key)
            );
            const value = displayValue(entry?.[1]);
            if (value !== undefined) {
                return value;
            }
        }
    }
    return undefined;
}

function factRows(
    records: readonly Facts[],
    definitions: readonly FactDefinition[]
): [string, string][] {
    return definitions.flatMap(([label, ...keys]) => {
        let value = readFact(records, keys);
        if (value === undefined) {
            return [];
        }
        if (label === 'Source' || label === 'Target') {
            value = value.replace(/(\/\/)[^/?#\s]*@/g, '$1').replace(/[?#].*$/, '');
        }
        return [[label, value]];
    });
}

function recordedFactRows(
    sources: readonly { name: string; records: readonly Facts[] }[],
    definitions: readonly FactDefinition[]
): string[][] {
    const rows = sources.flatMap((source) =>
        factRows(source.records, definitions).map((row) => [source.name, ...row])
    );
    return [...new Map(rows.map((row) => [JSON.stringify(row), row])).values()];
}

function appendRecordedFacts(
    children: ReportChild[],
    sources: readonly { name: string; records: readonly Facts[] }[],
    definitions: readonly FactDefinition[]
): void {
    const rows = recordedFactRows(sources, definitions);
    if (rows.length > 0) {
        children.push(table(['Component', 'Characteristic', 'Recorded value'], rows));
    }
}

function paragraph(text: string, bold = false): Paragraph {
    return new Paragraph({ children: [new TextRun({ text, bold })], keepNext: bold });
}

function heading(text: string): Paragraph {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
}

function subheading(text: string): Paragraph {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
}

function appendList(children: ReportChild[], title: string, items: readonly string[]): void {
    if (items.length > 0) {
        children.push(subheading(title));
        for (const text of items) {
            children.push(new Paragraph({ text, bullet: { level: 0 } }));
        }
    }
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): Table {
    const makeRow = (values: readonly string[], header = false): TableRow =>
        new TableRow({
            tableHeader: header,
            children: values.map(
                (value) =>
                    new TableCell({
                        shading: header ? { fill: 'DCE6F1' } : undefined,
                        children: value.split('\n').map(
                            (text) =>
                                new Paragraph({
                                    spacing: { before: 0, after: 60 },
                                    children: [
                                        new TextRun({
                                            text,
                                            font: 'Calibri',
                                            size: 20,
                                            bold: header,
                                        }),
                                    ],
                                })
                        ),
                    })
            ),
        });
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.AUTOFIT,
        rows: [makeRow(headers, true), ...rows.map((row) => makeRow(row))],
    });
}
