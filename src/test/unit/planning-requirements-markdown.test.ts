import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import type { FlowPlanningResult } from '../../stages/planning/PlanningCacheService';
import { renderPlanningRequirementsMarkdown } from '../../services/reports/PlanningRequirementsMarkdown';

function fullPlan(): FlowPlanningResult {
    return {
        planId: 'plan-2026-01',
        flowId: 'orders',
        flowName: 'Orders',
        generatedAt: '2026-01-02T03:04:05.000Z',
        preferences: {
            flowId: 'orders',
            revision: 'rev-1',
            status: 'ready',
            updatedAt: '2026-01-01T00:00:00.000Z',
            decisions: [
                {
                    id: 'deployment-target',
                    question: 'Where will these workflows run?',
                    whyItMatters: 'Hosting affects connector availability.',
                    options: [
                        {
                            id: 'workflow-service-plan',
                            label: 'Azure-hosted Standard',
                            description: 'Workflow Service Plan.',
                        },
                        {
                            id: 'hybrid',
                            label: 'Standard hybrid',
                            description: 'Your infrastructure via Azure Arc.',
                        },
                    ],
                    selectedOptionId: 'hybrid',
                    source: 'user',
                    decidedAt: '2026-01-01T00:00:00.000Z',
                },
                {
                    id: 'messaging',
                    question: 'Which broker should receive orders?',
                    whyItMatters: 'The queue owns delivery guarantees.',
                    options: [
                        {
                            id: 'service-bus',
                            label: 'Service Bus',
                            description: 'Azure-managed broker.',
                        },
                        {
                            id: 'rabbitmq',
                            label: 'RabbitMQ',
                            description: 'Customer-managed broker.',
                        },
                    ],
                    selectedOptionId: 'service-bus',
                    source: 'user-request',
                    decidedAt: '2026-01-01T00:00:00.000Z',
                },
            ],
        },
        brief: {
            scenarioName: 'Hybrid with Service Bus',
            estimatedTimeline: '3-4 weeks',
            assumptions: ['Customer provides hybrid infrastructure.'],
            tradeoffs: ['Local ownership adds operational effort.'],
            opportunities: [
                {
                    component: 'ParseOrder',
                    currentApproach: 'Custom XML parsing',
                    proposedApproach: 'Parse XML with Schema',
                    disposition: 'applied',
                    reason: 'Equivalent behavior verified.',
                    evidence: 'OrderParser.Parse and Order.xsd.',
                },
                {
                    component: 'PricingRules',
                    currentApproach: 'C# rules library',
                    proposedApproach: 'Rules engine',
                    disposition: 'retained',
                    reason: 'Rewrite risk is too high.',
                    evidence: 'PricingRules.cs',
                },
                {
                    component: 'AuditLog',
                    currentApproach: 'Custom log table',
                    proposedApproach: 'Application Insights',
                    disposition: 'deferred',
                    reason: 'Needs an operations review.',
                    evidence: 'AuditLogger.cs',
                },
            ],
        },
        mermaid: 'flowchart LR\n    Receive --> Route',
        explanation: 'Orders arrive over HTTP and are routed to fulfillment.',
        workflows: [
            {
                name: 'OrderIntake',
                description: 'Receives and validates orders.',
                triggerType: 'HTTP request',
                actions: ['Parse order', 'Transform order', 'Send to queue'],
                sourceArtifactIds: ['orch-orders', 'map-order'],
                mermaid: 'flowchart TB\r\n    Trigger --> Parse',
                workflowDefinition: {
                    definition: { actions: { Marker: { type: 'definition-marker' } } },
                },
            },
            {
                name: 'OrderFulfillment',
                description: 'Fulfills queued orders.',
                triggerType: 'Service Bus message',
                actions: ['Ship order'],
                sourceArtifactIds: ['send-port-fulfillment'],
            },
        ],
        azureComponents: [
            {
                name: 'Azure Service Bus',
                type: 'Messaging',
                reason: 'Queue orders.',
                configNotes: 'Standard tier',
            },
            { name: 'Integration Account', type: 'B2B', reason: 'Host schemas and maps.' },
        ],
        connectorMappings: [
            {
                source: 'WCF-BasicHttp',
                target: 'Request trigger',
                isNative: true,
                notes: 'Accepts JSON | XML\nbodies',
            },
        ],
        actionMappings: [
            {
                source: 'ParseOrderShape',
                target: 'Parse XML with schema',
                workflowName: 'OrderIntake',
            },
            {
                source: 'SendShape',
                target: 'Service Bus send',
                workflowName: 'OrderFulfillment',
                notes: 'Session enabled',
            },
        ],
        gaps: [
            {
                component: 'Pipeline | Decoder',
                gap: 'Line one\r\nLine two\nLine three',
                severity: 'high',
                recommendation: String.raw`Split on \| tokens in a local function`,
            },
        ],
        patterns: [
            {
                name: 'Content-based routing',
                sourceApproach: 'Filter expressions',
                logicAppsApproach: 'Switch action',
                complexity: 'medium',
            },
        ],
        effortEstimate: {
            totalHours: 40,
            breakdown: { analysis: 8, conversion: 16, testing: 10, deployment: 6 },
            confidence: 'medium',
        },
        summary: 'Migrate order intake and fulfillment.',
        artifactDispositions: [
            {
                artifactName: 'POSchema',
                artifactType: 'Schema',
                conversionRequired: true,
                conversionFrom: 'BizTalk XSD',
                conversionTo: 'XSD',
                conversionNotes: 'Remove BizTalk annotations',
                uploadDestination: 'integration-account',
                uploadPath: 'Artifacts/Schemas/POSchema.xsd',
            },
            {
                artifactName: 'OrderMap',
                artifactType: 'Map',
                conversionRequired: false,
                uploadDestination: 'logic-app-artifact-folder',
                uploadPath: 'Artifacts/Maps/OrderMap.xslt',
            },
            {
                artifactName: 'Bindings',
                artifactType: 'Binding file',
                conversionRequired: false,
                uploadDestination: 'not-applicable',
                uploadNotes: 'Replaced by connections.json',
            },
        ],
    };
}

function minimalPlan(): FlowPlanningResult {
    return {
        flowId: 'orders',
        flowName: 'Orders',
        generatedAt: '2026-01-02T03:04:05.000Z',
        mermaid: '',
        explanation: '',
        workflows: [],
        azureComponents: [],
        connectorMappings: [],
        actionMappings: [],
        gaps: [],
        patterns: [],
        summary: 'Order migration',
    };
}

function headings(markdown: string, level: number): string[] {
    const prefix = `${'#'.repeat(level)} `;
    return markdown
        .split('\n')
        .filter((line) => line.startsWith(prefix))
        .map((line) => line.slice(prefix.length));
}

/** Lines from a heading up to the next heading of the same or a higher level. */
function sectionText(markdown: string, heading: string): string {
    const level = heading.indexOf(' ');
    const lines = markdown.split('\n');
    const start = lines.indexOf(heading);
    assert.ok(start >= 0, `Missing heading: ${heading}`);
    const end = lines.findIndex(
        (line, index) => index > start && /^#{1,6} /.test(line) && line.indexOf(' ') <= level
    );
    return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

function tables(markdown: string): string[][] {
    const result: string[][] = [];
    let current: string[] = [];
    for (const line of markdown.split('\n')) {
        if (line.startsWith('|')) {
            current.push(line);
        } else if (current.length > 0) {
            result.push(current);
            current = [];
        }
    }
    if (current.length > 0) {
        result.push(current);
    }
    return result;
}

/** Cells separated by unescaped pipes; backslash escape pairs never split a cell. */
function cellCount(row: string): number {
    return row.replace(/\\./g, '_').split('|').length - 2;
}

describe('Planning requirements Markdown export', () => {
    it('renders the title, plan metadata, and sections in requirements order', () => {
        const markdown = renderPlanningRequirementsMarkdown(fullPlan());

        assert.equal(markdown.split('\n')[0], '# Orders — Migration Requirements');
        assert.ok(markdown.includes('- **Flow ID:** `orders`'));
        assert.ok(markdown.includes('- **Plan version:** `plan-2026-01`'));
        assert.ok(markdown.includes('- **Plan generated:** 2026-01-02T03:04:05.000Z'));
        assert.deepEqual(headings(markdown, 2), [
            'Summary',
            'Planning Decisions',
            'Planning Brief',
            'Modernization Opportunities',
            'Target Architecture',
            'Planned Workflows',
            'Connector Mappings',
            'Action Mappings',
            'Artifact Dispositions',
            'Required Azure Components',
            'Gap Analysis',
            'Integration Patterns',
            'Effort Estimate',
            'Acceptance Criteria',
        ]);
        assert.deepEqual(headings(markdown, 3), [
            'Assumptions',
            'Tradeoffs',
            'OrderIntake',
            'OrderFulfillment',
        ]);

        const summary = sectionText(markdown, '## Summary');
        assert.ok(summary.includes('Migrate order intake and fulfillment.'));
        assert.ok(summary.includes('Orders arrive over HTTP and are routed to fulfillment.'));
        assert.ok(
            markdown.includes(
                '| Where will these workflows run? | Standard hybrid — Your infrastructure via Azure Arc. | user | Hosting affects connector availability. |'
            )
        );
        assert.ok(markdown.includes('- **Scenario:** Hybrid with Service Bus'));
        assert.ok(markdown.includes('- **Indicative timeline:** 3-4 weeks'));
        assert.ok(markdown.includes('### Tradeoffs\n\n- Local ownership adds operational effort.'));
        assert.ok(
            markdown.includes(
                '| ParseOrder | Custom XML parsing | Parse XML with Schema | applied | Equivalent behavior verified. | OrderParser.Parse and Order.xsd. |'
            )
        );
        assert.ok(
            markdown.includes('| OrderIntake | ParseOrderShape | Parse XML with schema | — |')
        );
        assert.ok(
            markdown.includes(
                '| POSchema | Schema | BizTalk XSD → XSD | Integration Account | Artifacts/Schemas/POSchema.xsd | Remove BizTalk annotations |'
            )
        );
        assert.ok(
            markdown.includes(
                '| Bindings | Binding file | Not required | Not applicable | — | Replaced by connections.json |'
            )
        );
        assert.ok(markdown.includes('| Integration Account | B2B | Host schemas and maps. | — |'));
        assert.ok(
            markdown.includes(
                '| Content-based routing | medium | Filter expressions | Switch action |'
            )
        );
        assert.ok(markdown.includes('- **Total estimated hours:** 40\n- **Confidence:** medium'));
        assert.ok(markdown.includes('| Conversion | 16 |'));
        assert.ok(markdown.endsWith('\n') && !markdown.endsWith('\n\n'));
    });

    it('fences the target architecture and per-workflow diagrams as Mermaid', () => {
        const markdown = renderPlanningRequirementsMarkdown(fullPlan());

        assert.ok(
            sectionText(markdown, '## Target Architecture').includes(
                '```mermaid\nflowchart LR\n    Receive --> Route\n```'
            )
        );
        assert.ok(
            sectionText(markdown, '### OrderIntake').includes(
                '**Workflow diagram:**\n\n```mermaid\nflowchart TB\n    Trigger --> Parse\n```'
            )
        );
        assert.ok(!sectionText(markdown, '### OrderFulfillment').includes('```mermaid'));
        assert.equal(markdown.match(/^```mermaid$/gm)?.length, 2);
        assert.equal(markdown.match(/^```$/gm)?.length, 2);
    });

    it('renders one section per workflow with trigger, ordered actions, and source artifacts', () => {
        const markdown = renderPlanningRequirementsMarkdown(fullPlan());
        const intake = sectionText(markdown, '### OrderIntake');

        assert.ok(intake.includes('Receives and validates orders.'));
        assert.ok(intake.includes('- **Trigger:** HTTP request'));
        assert.ok(intake.includes('- **Source artifacts:** `orch-orders`, `map-order`'));
        assert.ok(
            intake.includes('**Actions:**\n\n1. Parse order\n2. Transform order\n3. Send to queue')
        );
        assert.ok(
            sectionText(markdown, '### OrderFulfillment').includes(
                '- **Source artifacts:** `send-port-fulfillment`'
            )
        );
        assert.ok(markdown.includes('The migration produces 2 Logic Apps Standard workflows.'));
        assert.ok(!markdown.includes('definition-marker'));
        assert.ok(!markdown.includes('workflowDefinition'));
    });

    it('escapes pipes and normalizes newlines inside table cells', () => {
        const markdown = renderPlanningRequirementsMarkdown(fullPlan());

        assert.ok(
            markdown.includes(
                String.raw`| Pipeline \| Decoder | Line one<br>Line two<br>Line three | high | Split on \\\| tokens in a local function |`
            )
        );
        assert.ok(
            markdown.includes(
                String.raw`| WCF-BasicHttp | Request trigger | Yes | Accepts JSON \| XML<br>bodies |`
            )
        );
        assert.ok(!markdown.includes('\r'));
        const allTables = tables(markdown);
        assert.equal(allTables.length, 9);
        for (const table of allTables) {
            assert.match(table[1], /^\|( --- \|)+$/);
            for (const row of table) {
                assert.equal(cellCount(row), cellCount(table[0]), row);
            }
        }
    });

    it('omits optional sections that have no content', () => {
        const markdown = renderPlanningRequirementsMarkdown(minimalPlan());

        assert.deepEqual(headings(markdown, 2), ['Summary']);
        assert.ok(markdown.includes('Order migration'));
        assert.ok(markdown.includes('- **Plan version:** Legacy'));
        assert.equal(tables(markdown).length, 0);

        const withBrief = renderPlanningRequirementsMarkdown({
            ...minimalPlan(),
            mermaid: 'flowchart LR\n    A --> B',
            brief: {
                scenarioName: 'Lift and shift',
                estimatedTimeline: '2 weeks',
                assumptions: [],
                tradeoffs: [],
                opportunities: [],
            },
            workflows: [
                {
                    name: 'OnlyWorkflow',
                    description: '',
                    triggerType: 'Recurrence',
                    actions: [],
                    sourceArtifactIds: [],
                },
            ],
        });
        assert.deepEqual(headings(withBrief, 2), [
            'Summary',
            'Planning Brief',
            'Target Architecture',
            'Planned Workflows',
            'Acceptance Criteria',
        ]);
        assert.deepEqual(headings(withBrief, 3), ['OnlyWorkflow']);
        const workflow = sectionText(withBrief, '### OnlyWorkflow');
        assert.ok(!workflow.includes('**Actions:**'));
        assert.ok(!workflow.includes('Source artifacts'));
        assert.ok(!workflow.includes('**Workflow diagram:**'));
        assert.equal(withBrief.match(/```mermaid/g)?.length, 1);
        for (const output of [markdown, withBrief]) {
            assert.doesNotMatch(output, /^#{1,6} .*\n\n#{1,6} /m);
            assert.doesNotMatch(output, /\n{3,}/);
        }
    });

    it('never prints undefined for missing or legacy plan fields', () => {
        const legacy = {
            flowId: 'legacy-flow',
            flowName: 'Legacy',
            generatedAt: '2025-12-31T00:00:00.000Z',
            mermaid: 'flowchart LR\n    A --> B',
            explanation: 'Legacy plan',
            summary: 'Legacy summary',
            workflows: [
                {
                    name: 'LegacyWorkflow',
                    description: 'Does work',
                    triggerType: 'Recurrence',
                    actions: ['Step'],
                },
            ],
            azureComponents: [{ name: 'Storage', type: 'Storage account', reason: 'Files' }],
            connectorMappings: [{ source: 'FILE', target: 'File System', isNative: true }],
            actionMappings: [{ source: 'Construct', target: 'Compose' }],
            gaps: [{ component: 'Adapter', gap: 'No equivalent', severity: 'low' }],
            effortEstimate: { totalHours: 8, confidence: 'low' },
            artifactDispositions: [
                {
                    artifactName: 'Map',
                    artifactType: 'Map',
                    conversionRequired: true,
                    uploadDestination: 'logic-app-artifact-folder',
                },
            ],
        } as unknown as FlowPlanningResult;

        const markdown = renderPlanningRequirementsMarkdown(legacy);

        assert.doesNotMatch(markdown, /undefined|null|NaN|\[object Object\]/);
        assert.ok(markdown.includes('- **Plan version:** Legacy'));
        assert.ok(markdown.includes('| — | Construct | Compose | — |'));
        assert.ok(
            markdown.includes('| Map | Map | Required | Logic App artifact folder | — | — |')
        );
        assert.ok(!markdown.includes('## Integration Patterns'));
        assert.ok(!markdown.includes('| Phase | Hours |'));
        assert.ok(
            markdown.includes(
                '- [ ] Gap in Adapter (low severity): "No equivalent" is resolved or tracked as an open item.'
            )
        );
        assert.ok(
            markdown.includes(
                '- [ ] `Map` (Map) is converted and delivered to the Logic App artifact folder.'
            )
        );
    });

    it('derives acceptance criteria only from plan content', () => {
        const markdown = renderPlanningRequirementsMarkdown(fullPlan());
        const criteria = sectionText(markdown, '## Acceptance Criteria')
            .split('\n')
            .filter((line) => line.startsWith('- [ ] '));

        assert.deepEqual(criteria, [
            '- [ ] Implements the selected option for "Where will these workflows run?": Standard hybrid.',
            '- [ ] Implements the selected option for "Which broker should receive orders?": Service Bus.',
            '- [ ] Workflow `OrderIntake` is triggered by "HTTP request", implements its 3 planned actions, and covers source artifacts `orch-orders`, `map-order`.',
            '- [ ] Workflow `OrderFulfillment` is triggered by "Service Bus message", implements its 1 planned action, and covers source artifact `send-port-fulfillment`.',
            '- [ ] Each source connector listed in Connector Mappings is replaced by its target connector.',
            '- [ ] Each source action listed in Action Mappings is implemented with its target action.',
            '- [ ] ParseOrder applies the planned modernization: Parse XML with Schema.',
            '- [ ] PricingRules retains its current approach: C# rules library.',
            '- [ ] Required Azure components are available to the workflows: Azure Service Bus, Integration Account.',
            '- [ ] `POSchema` (Schema) is converted from BizTalk XSD to XSD and delivered to the Integration Account at `Artifacts/Schemas/POSchema.xsd`.',
            '- [ ] `OrderMap` (Map) is delivered to the Logic App artifact folder at `Artifacts/Maps/OrderMap.xslt`.',
            String.raw`- [ ] Gap in Pipeline | Decoder (high severity): the recommendation "Split on \| tokens in a local function" is implemented or tracked as an open item.`,
        ]);
        assert.ok(!criteria.some((line) => line.includes('AuditLog') || line.includes('Bindings')));
        assert.equal(
            renderPlanningRequirementsMarkdown(fullPlan()),
            markdown,
            'rendering must be deterministic'
        );
    });

    it('keeps the renderer free of VS Code dependencies', () => {
        const source = fs.readFileSync(
            path.resolve(
                __dirname,
                '../../../src/services/reports/PlanningRequirementsMarkdown.ts'
            ),
            'utf8'
        );
        assert.doesNotMatch(source, /from 'vscode'|require\('vscode'\)|from 'fs'/);
    });
});
