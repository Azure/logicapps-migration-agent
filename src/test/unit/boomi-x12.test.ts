import * as assert from 'assert/strict';
import * as path from 'path';
import { createWorkspace, disposeWorkspace } from '../helpers/workspace';
import { clearBoomiCaches } from '../../parsers/boomi';
import { ArtifactScanner } from '../../stages/discovery/ArtifactScanner';
import { PlatformDetector } from '../../stages/discovery/PlatformDetector';
import { ScanResult } from '../../stages/discovery/types';

const x12Path = path.resolve(
    __dirname,
    '../../../src/test/fixtures/boomi/Boomi_X12_OrderToCash_Complex'
);

/* eslint-disable @typescript-eslint/no-explicit-any */
function artifact(scan: ScanResult, relativePath: string): any {
    const found = scan.parsedArtifacts.find(
        (item) => path.relative(x12Path, path.resolve(x12Path, item.sourcePath)) === relativePath
    );
    assert.ok(found, `missing artifact ${relativePath}`);
    return found;
}

describe('Dell Boomi X12 order-to-cash discovery', () => {
    let workspace: string;
    let scan: ScanResult;

    beforeEach(async () => {
        workspace = createWorkspace();
        clearBoomiCaches();
        scan = await ArtifactScanner.getInstance().scan(x12Path, 'boomi');
    });
    afterEach(() => disposeWorkspace(workspace));

    it('detects Boomi from a manifest that only references Boomi processes', async () => {
        const detection = await PlatformDetector.getInstance().detect(x12Path);
        assert.equal(detection.platform, 'boomi');
        assert.deepEqual(scan.parseErrors, []);
    });

    it('classifies JSON connections, maps, partners and Groovy scripts', () => {
        const types = (relativePath: string) => artifact(scan, relativePath).type;
        assert.equal(types(path.join('Connections', 'RetailHubAS2.json')), 'connector');
        assert.equal(types(path.join('Maps', 'X12_850_To_CanonicalOrder.json')), 'map');
        assert.equal(types(path.join('TradingPartners', 'RetailHub_AS2.json')), 'b2b');
        assert.equal(
            types(path.join('Scripts', 'Groovy', 'ValidateEnvelope.groovy')),
            'custom-code'
        );
        assert.equal(types(path.join('Processes', 'Inbound850Orchestration.xml')), 'flow');
    });

    it('builds the inbound 850 flow with partner trigger, sub-process calls and connections', () => {
        const ir = artifact(scan, path.join('Processes', 'Inbound850Orchestration.xml')).ir;
        const trigger = ir.triggers[0];
        assert.equal(trigger.config.standard, 'X12');
        assert.deepEqual(trigger.config.partners, ['RetailHub_AS2', 'Warehouse_SFTP']);

        const actions = new Map<string, any>(ir.actions.map((a: any) => [a.name, a]));
        assert.equal(actions.get('SubmitOMS').type, 'http-call');
        assert.equal(actions.get('Map850ToCanonical').type, 'transform');
        const called = ir.actions
            .filter((a: any) => a.type === 'call-workflow')
            .map((a: any) => a.config.workflowName)
            .sort();
        assert.deepEqual(called, [
            'ExceptionSubprocess',
            'Generate855PurchaseOrderAck',
            'Generate997Acknowledgment',
        ]);

        const connections = ir.connections.map((c: any) => c.name).sort();
        assert.ok(connections.includes('OrderManagementAPI'));
        assert.ok(connections.includes('AuditDatabase'));
        assert.ok(
            ir.gaps.some((gap: any) => gap.title === 'Custom script: ValidateEnvelope'),
            'Groovy envelope validation should be reported as a gap'
        );
    });

    it('marks acknowledgment sub-processes as callable and event-driven outbounds as Service Bus', () => {
        const ack = artifact(scan, path.join('Processes', 'Generate997Acknowledgment.xml')).ir;
        assert.equal(ack.triggers[0].type, 'manual');
        assert.deepEqual(ack.triggers[0].config.calledBy, ['Inbound850Orchestration']);

        const invoice = artifact(scan, path.join('Processes', 'Outbound810Invoice.xml')).ir;
        assert.equal(invoice.triggers[0].type, 'service-bus');
    });
});
