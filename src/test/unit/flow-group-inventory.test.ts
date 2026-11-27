import * as assert from 'assert/strict';
import {
    describeFlowRoute,
    entryLabel,
    flowSearchText,
    renderFlowGroupInventoryMarkdown,
} from '../../stages/discovery/FlowGroupInventory';
import { FlowGroupsResult } from '../../services/LLMFlowGenerator';

const artifacts: Record<string, { name: string; type: string; sourcePath: string }> = {
    orch: { name: 'InvoiceNotification', type: 'orchestration', sourcePath: 'Orch/Inv.odx' },
    called: { name: 'SendNotification', type: 'orchestration', sourcePath: 'Orch/Send.odx' },
    map: { name: 'Invoice|ToNotification', type: 'map', sourcePath: 'Maps/E.btm' },
    cdm: { name: 'Invoice', type: 'schema', sourcePath: 'Cdm/Invoice.xsd' },
    binding: { name: 'Contoso.Application', type: 'binding', sourcePath: 'Deploy/Bindings.xml' },
    unused: { name: 'Unused', type: 'schema', sourcePath: 'Schemas/Unused.xsd' },
};
const lookup = (id: string) => artifacts[id];

const result: FlowGroupsResult = {
    groups: [
        {
            id: 'flow-invoicenotification',
            name: 'Invoice Notification',
            description: 'Orchestrations: InvoiceNotification, SendNotification.',
            category: 'message-flow',
            artifactIds: ['orch', 'called', 'map', 'cdm', 'binding'],
            entryPoint: { type: 'receive-location', name: 'RL_Invoice_File' },
            exitPoints: [{ type: 'send-port', name: 'SP_Notification_SB' }],
            endpointNames: [
                'RL_Invoice_File',
                'RL_Invoice_Ftp',
                'RP_Invoice',
                'SP_Notification_SB',
            ],
            summary: { receivePorts: 2, orchestrations: 2, maps: 1, sendPorts: 1 },
        },
        {
            id: 'flow-rp-archive',
            name: 'RP Archive Route',
            description: 'Messaging route without an orchestration (receive port RP_Archive).',
            category: 'message-flow',
            artifactIds: ['binding'],
            entryPoint: { type: 'receive-port', name: 'RP_Archive' },
        },
    ],
    ungroupedArtifactIds: ['unused'],
    sharedArtifactIds: ['binding'],
    missingProjects: [
        {
            project: 'Common',
            path: 'C:\\src\\Common\\Common.btproj',
            referencedBy: ['Orchestrations'],
        },
    ],
    explanation: 'Grouped deterministically.',
    detectionMode: 'deterministic',
};

describe('Logical group inventory', () => {
    it('summarizes the receive, process and send route of a flow', () => {
        const route = describeFlowRoute(result.groups[0], lookup);
        assert.deepEqual(route, {
            entry: 'RL_Invoice_File',
            additionalEntries: 1,
            processes: ['InvoiceNotification', 'SendNotification'],
            exits: ['SP_Notification_SB'],
        });
        assert.equal(entryLabel(route), 'RL_Invoice_File (+1 more)');
        assert.equal(entryLabel(describeFlowRoute(result.groups[1], lookup)), 'RP_Archive');
    });

    it('searches flows by ports and artifact names', () => {
        const text = flowSearchText(result.groups[0], lookup);
        assert.ok(text.includes('rl_invoice_ftp'));
        assert.ok(text.includes('invoice|tonotification'));
        assert.ok(text.includes('flow-invoicenotification'));
    });

    it('exports flows, shared, ungrouped and missing artifacts as Markdown', () => {
        const markdown = renderFlowGroupInventoryMarkdown(result, lookup);
        assert.match(markdown, /^# Logical Group Inventory\n/);
        assert.match(
            markdown,
            /2 flow\(s\), 1 shared artifact\(s\), 1 ungrouped artifact\(s\)\. Detection: deterministic\./
        );
        assert.match(
            markdown,
            /## Missing Referenced Projects[\s\S]*\| Common \| Orchestrations \| C:\\src\\Common\\Common\.btproj \|/
        );
        assert.match(
            markdown,
            /\| Invoice Notification \| `flow-invoicenotification` \| RL_Invoice_File \(\+1 more\) \| InvoiceNotification, SendNotification \| SP_Notification_SB \| 5 \|/
        );
        assert.match(markdown, /\| Invoice\\\|ToNotification \| map \| Maps\/E\.btm \| — \|/);
        assert.match(
            markdown,
            /\| Contoso\.Application \| binding \| Deploy\/Bindings\.xml \| yes \|/
        );
        assert.match(
            markdown,
            /## Shared Artifacts[\s\S]*\| Contoso\.Application \| binding \| Deploy\/Bindings\.xml \| Invoice Notification, RP Archive Route \|/
        );
        assert.match(
            markdown,
            /## Ungrouped Artifacts[\s\S]*\| Unused \| schema \| Schemas\/Unused\.xsd \|/
        );
        assert.ok(!markdown.includes('undefined'));
    });
});
