import * as assert from 'assert/strict';
import {
    checkTaskArtifacts,
    renderTraceabilityMarkdown,
    toOutputProjectName,
    TraceableArtifact,
} from '../../stages/conversion/Traceability';
import { ChatPrompts } from '../../constants/ChatPrompts';
import { ConversionTaskPlan } from '../../stages/conversion/types';

const artifacts: TraceableArtifact[] = [
    {
        id: 'orch-1',
        name: 'InvoiceNotification',
        type: 'orchestration',
        sourcePath: 'Orch/Inv.odx',
    },
    { id: 'map-1', name: 'InvoiceToNotification', type: 'map', sourcePath: 'Maps/E2N.btm' },
    { id: 'schema-1', name: 'Invoice', type: 'schema', sourcePath: 'Cdm/Invoice.xsd' },
    {
        id: 'schema-2',
        name: 'Notification',
        type: 'schema',
        sourcePath: 'Schemas/Notification.xsd',
    },
    {
        id: 'project-1',
        name: 'Orchestrations',
        type: 'custom-code',
        sourcePath: 'Orch/Orchestrations.btproj',
    },
    {
        id: 'binding-1',
        name: 'Contoso.Application',
        type: 'binding',
        sourcePath: 'Deploy/Bindings.xml',
    },
    {
        id: 'other-flow-schema',
        name: 'Customer',
        type: 'schema',
        sourcePath: 'Schemas/Customer.xsd',
    },
    { id: 'dup-a', name: 'Common', type: 'schema', sourcePath: 'A/Common.xsd' },
    { id: 'dup-b', name: 'Common', type: 'schema', sourcePath: 'B/Common.xsd' },
];
const flowArtifacts = artifacts.filter((a) =>
    ['orch-1', 'map-1', 'schema-1', 'schema-2', 'project-1', 'binding-1'].includes(a.id)
);

describe('Conversion traceability', () => {
    it('names the generated project folder like the conversion commands do', () => {
        assert.equal(toOutputProjectName('Invoice Notification / v2'), 'Invoice-Notification-v2');
        assert.equal(toOutputProjectName('--Hello_World--'), 'Hello_World');
    });

    it('resolves artifact names, rejects unknown references and reports uncovered artifacts', () => {
        const result = checkTaskArtifacts(
            [
                { id: 'convert-schemas', artifactIds: ['Invoice', 'schema-2'] },
                { id: 'generate-workflow', artifactIds: ['orch-1', 'NoSuchArtifact', 'Common'] },
                { id: 'scaffold-project' },
            ],
            flowArtifacts,
            artifacts
        );
        assert.deepEqual(result.tasks, [
            { id: 'convert-schemas', artifactIds: ['schema-1', 'schema-2'] },
            { id: 'generate-workflow', artifactIds: ['orch-1'] },
            { id: 'scaffold-project' },
        ]);
        assert.deepEqual(result.unknownReferences, [
            { taskId: 'generate-workflow', reference: 'NoSuchArtifact' },
            { taskId: 'generate-workflow', reference: 'Common' },
        ]);
        // Projects and bindings need no conversion task; the map does.
        assert.deepEqual(
            result.uncoveredArtifacts.map((a) => a.id),
            ['map-1']
        );
    });

    it('renders source artifact → task → generated file traceability', () => {
        const plan: ConversionTaskPlan = {
            flowId: 'flow-invoicenotification',
            flowName: 'Invoice Notification',
            generatedAt: '2026-01-01T00:00:00.000Z',
            summary: 'Convert',
            tasks: [
                {
                    id: 'generate-workflow',
                    type: 'generate-workflow',
                    name: 'Generate | notification workflow',
                    description: 'Workflow',
                    dependsOn: ['convert-artifacts'],
                    status: 'completed',
                    order: 2,
                    artifactIds: ['orch-1'],
                    output: {
                        completedAt: '2026-01-01T00:00:00.000Z',
                        summary: 'done',
                        generatedFiles: ['out/Invoice-Notification/la/Notify/workflow.json'],
                    },
                },
                {
                    id: 'convert-artifacts',
                    type: 'convert-maps',
                    name: 'Convert map and schemas',
                    description: 'Maps',
                    dependsOn: [],
                    status: 'pending',
                    order: 1,
                    artifactIds: ['map-1', 'schema-1'],
                },
            ],
        };
        const byId = new Map(artifacts.map((a) => [a.id, a]));
        const markdown = renderTraceabilityMarkdown(plan, (id) => byId.get(id));

        assert.match(markdown, /^# Traceability — Invoice Notification\n/);
        assert.match(
            markdown,
            /\| InvoiceNotification \| orchestration \| Orch\/Inv\.odx \| 2\. Generate \\\| notification workflow \| out\/Invoice-Notification\/la\/Notify\/workflow\.json \|/
        );
        assert.match(
            markdown,
            /\| Invoice \| schema \| Cdm\/Invoice\.xsd \| 1\. Convert map and schemas \| — \|/
        );
        assert.match(
            markdown,
            /## Tasks[\s\S]*\| 1 \| Convert map and schemas \| pending \| InvoiceToNotification, Invoice \| — \|[\s\S]*\| 2 \| Generate \\\| notification workflow \| completed \| InvoiceNotification \|/
        );
    });
});

describe('Conversion prompts', () => {
    const base = {
        flowName: 'Invoice Notification',
        flowId: 'flow-invoicenotification',
        azureResourceGroup: 'rg',
        azureLocation: 'westeurope',
        azureSubscriptionId: '',
        outputProjectName: 'Invoice-Notification',
        outputProjectRoot: 'out/Invoice-Notification',
        outputLogicAppName: 'Invoice-Notification-logicapp',
        outputLogicAppRoot: 'out/Invoice-Notification/Invoice-Notification-logicapp',
    };

    it('keeps Azure settings when provisioning is allowed', () => {
        const prompt = ChatPrompts.conversionForFlow({ ...base, provisioningMode: 'provision' });
        assert.match(prompt, /AZURE SETTINGS: Resource Group="rg", Location="westeurope"/);
        assert.match(prompt, /`automated-test-generation`/);
        assert.ok(!prompt.includes('OFFLINE'));
    });

    it('forbids Azure provisioning in offline mode', () => {
        const prompt = ChatPrompts.conversionForFlow({ ...base, provisioningMode: 'offline' });
        assert.match(prompt, /AZURE PROVISIONING: OFFLINE — do not sign in to Azure/);
        assert.match(prompt, /Generate Bicep/);
        assert.ok(!prompt.includes('AZURE SETTINGS:'));
    });
});
