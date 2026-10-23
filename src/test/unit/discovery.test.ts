import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { createWorkspace, disposeWorkspace, fixturePath, scanSample } from '../helpers/biztalk';
import { ArtifactScanner } from '../../stages/discovery/ArtifactScanner';
import { PlatformDetector } from '../../stages/discovery/PlatformDetector';
import { InventoryBuilder } from '../../stages/discovery/InventoryService';
import { DependencyGraphBuilder } from '../../stages/discovery/DependencyGraphService';
import { ScanResult } from '../../stages/discovery/types';
import sample from '../fixtures/biztalk/sample.json';
import { testHost } from '../setup';

describe('BizTalk Discovery stage', () => {
    let workspace: string;
    let scan: ScanResult;

    beforeEach(async () => {
        workspace = createWorkspace();
        scan = await scanSample();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('detects the sample as BizTalk with auto-confirmation confidence', async () => {
        const detection = await PlatformDetector.getInstance().detect(fixturePath);
        assert.equal(detection.platform, 'biztalk');
        assert.ok(detection.confidence >= 80, `Confidence was ${detection.confidence}`);
        assert.deepEqual(detection.alternativePlatforms, []);
        assert.ok(detection.indicators.some((indicator) => indicator.match === 'Maps.btproj'));
    });

    it('discovers every selected sample file without parse errors or skips', () => {
        assert.equal(scan.totalFilesScanned, sample.files.length);
        assert.deepEqual(scan.parseErrors, []);
        assert.deepEqual(scan.skippedFiles, []);
        assert.deepEqual(
            scan.parsedArtifacts
                .map((artifact) => artifact.sourcePath.split(path.sep).join('/'))
                .sort(),
            [...sample.files].sort()
        );
        assert.equal(
            scan.parsedArtifacts.filter((artifact) => artifact.type === 'orchestration').length,
            1
        );
        assert.equal(scan.parsedArtifacts.filter((artifact) => artifact.type === 'map').length, 1);
        assert.equal(
            scan.parsedArtifacts.filter((artifact) => artifact.type === 'schema').length,
            2
        );
        assert.equal(
            scan.parsedArtifacts.filter((artifact) => artifact.type === 'custom-code').length,
            3
        );
    });

    it('preserves the receive, nested map transform, and ordered send in orchestration IR', () => {
        const orchestration = scan.parsedArtifacts.find(
            (artifact) => artifact.type === 'orchestration'
        );
        assert.ok(orchestration);
        assert.equal(orchestration.name, 'HelloSchedule');
        assert.deepEqual(
            orchestration.ir.triggers.map((trigger) => trigger.name),
            ['ReceivePO']
        );
        assert.deepEqual(
            orchestration.ir.actions.map((action) => action.name),
            ['ConstructInvoice', 'SendInvoice']
        );
        const construct = orchestration.ir.actions[0];
        const children: unknown = Reflect.get(construct, 'actions');
        assert.ok(Array.isArray(children));
        const transform: unknown = children[0];
        assert.ok(typeof transform === 'object' && transform !== null);
        assert.ok('name' in transform && 'type' in transform && 'config' in transform);
        assert.equal(transform.name, 'POToInvoiceTransform');
        assert.equal(transform.type, 'transform');
        assert.deepEqual(transform.config, {
            transformType: 'xslt',
            mapReference: 'Maps.POToInvoice',
        });
        assert.deepEqual(orchestration.ir.actions[1].runAfter, {
            [construct.id]: ['Succeeded'],
        });
    });

    it('reads the original UTF-16 schemas without losing namespaces or root elements', () => {
        for (const [name, rootElement] of [
            ['POSchema', 'PO'],
            ['InvoiceSchema', 'Invoice'],
        ]) {
            const source = fs.readFileSync(path.join(fixturePath, 'Schemas', `${name}.xsd`));
            assert.deepEqual([...source.subarray(0, 2)], [0xff, 0xfe]);
            const artifact = scan.parsedArtifacts.find((item) => item.name === name);
            assert.ok(artifact);
            assert.equal(artifact.ir.schemas.length, 1);
            const schema = artifact.ir.schemas[0];
            assert.ok('rootElement' in schema);
            assert.equal(schema.rootElement, rootElement);
            assert.equal(artifact.ir.schemas[0].targetNamespace, `http://HelloWorld.${name}`);
        }
    });

    it('builds an inventory with stable IDs across repeat scans', async () => {
        const builder = new InventoryBuilder();
        const first = builder.build(scan, 'HelloApplicationDeployment');
        const second = builder.build(await scanSample(), 'HelloApplicationDeployment');
        assert.equal(first.id, second.id);
        assert.deepEqual(
            first.items.map((item) => item.id),
            second.items.map((item) => item.id)
        );
        assert.equal(new Set(first.items.map((item) => item.id)).size, sample.files.length);
        assert.equal(first.statistics.totalCount, sample.files.length);
        assert.ok(first.items.every((item) => item.status === 'parsed'));
    });

    it('resolves orchestration dependencies on the PO schema, invoice schema, and map', async () => {
        const inventory = new InventoryBuilder().build(scan, 'HelloApplicationDeployment');
        const builder = new DependencyGraphBuilder();
        builder.setIRDocuments(
            new Map(scan.parsedArtifacts.map((artifact) => [artifact.id, artifact.ir]))
        );
        const graph = await builder.build(inventory);
        const orchestration = inventory.items.find((item) => item.category === 'orchestration');
        assert.ok(orchestration);
        const targets = graph.edges
            .filter((edge) => edge.source === orchestration.id)
            .map((edge) => inventory.items.find((item) => item.id === edge.target)?.name);
        for (const name of ['POToInvoice', 'POSchema', 'InvoiceSchema']) {
            assert.ok(targets.includes(name), `Missing dependency on ${name}`);
        }
        assert.equal(graph.nodes.length, sample.files.length);
        assert.deepEqual(graph.circularDependencies, []);
    });

    it('reports a malformed orchestration as an inventory error, not a parsed artifact', async () => {
        fs.writeFileSync(path.join(workspace, 'Broken.odx'), '<not-an-orchestration/>');
        const broken = await ArtifactScanner.getInstance().scan(workspace, 'biztalk');
        assert.equal(broken.parsedArtifacts.length, 0);
        assert.equal(broken.parseErrors.length, 1);
        assert.equal(broken.parseErrors[0].filePath, 'Broken.odx');
        assert.ok(broken.parseErrors[0].message.length > 0);
        const inventory = new InventoryBuilder().build(broken, 'Broken');
        assert.equal(inventory.items[0].status, 'error');
        assert.equal(inventory.items[0].category, 'orchestration');
        assert.deepEqual(testHost.logs.splice(0), [
            {
                level: 'WARN',
                message: '[Parser] Could not find Module element in orchestration',
            },
        ]);
    });

    it('honors cancellation without parsing or leaving an active scan', async () => {
        const scanner = ArtifactScanner.getInstance();
        const cancelled = await scanner.scan(fixturePath, 'biztalk', {
            cancellationToken: { isCancellationRequested: true },
        });
        assert.deepEqual(cancelled.parsedArtifacts, []);
        assert.equal(scanner.isScanning(), false);
    });
});
