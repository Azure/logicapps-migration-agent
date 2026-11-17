import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { testHost } from '../setup';
import { createWorkspace, disposeWorkspace } from '../helpers/workspace';
import { fixturePath, manifestPath, processPath, scanSample } from '../helpers/boomi';
import sample from '../fixtures/boomi/sample.json';
import {
    BoomiConnectorParser,
    BoomiProcessParser,
    BoomiProjectParser,
    BoomiScriptParser,
    clearBoomiCaches,
} from '../../parsers/boomi';
import { defaultParserFactory } from '../../parsers/ParserFactory';
import { InventoryBuilder } from '../../stages/discovery/InventoryService';
import { PlatformDetector } from '../../stages/discovery/PlatformDetector';
import { ScanResult } from '../../stages/discovery/types';

function typesByPath(scan: ScanResult): Record<string, string> {
    return Object.fromEntries(
        scan.parsedArtifacts.map((item) => [item.sourcePath.split(path.sep).join('/'), item.type])
    );
}

const NATIVE_CONNECTION = `<?xml version="1.0" encoding="UTF-8"?>
<bns:Component xmlns:bns="http://api.platform.boomi.com/" componentId="conn-1" name="Orders DB" type="connector-settings" subType="database">
  <bns:object><DatabaseSettings user="svc" password="hunter2"/></bns:object>
</bns:Component>`;

const NATIVE_OPERATION = `<?xml version="1.0" encoding="UTF-8"?>
<bns:Component xmlns:bns="http://api.platform.boomi.com/" componentId="op-1" name="Insert Order" type="connector-action" subType="database">
  <bns:object><Operation actionType="Send"/></bns:object>
</bns:Component>`;

const NATIVE_SUBPROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bns:Component xmlns:bns="http://api.platform.boomi.com/" componentId="proc-2" name="Audit" type="process">
  <bns:object><process><shapes>
    <shape name="shape1" shapetype="start"><configuration><passthroughaction/></configuration>
      <dragpoints><dragpoint toShape="shape2"/></dragpoints></shape>
    <shape name="shape2" shapetype="stop"/>
  </shapes></process></bns:object>
</bns:Component>`;

const NATIVE_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bns:Component xmlns:bns="http://api.platform.boomi.com/" componentId="proc-1" name="Sync Orders" type="process" folderFullPath="Acme/Orders">
  <bns:object><process><shapes>
    <shape name="shape1" shapetype="start">
      <configuration><connectoraction connectorType="http" actionType="Listen"/></configuration>
      <dragpoints><dragpoint toShape="shape2"/></dragpoints>
    </shape>
    <shape name="shape2" shapetype="decision" userlabel="Is priority?">
      <dragpoints><dragpoint toShape="shape3"/><dragpoint toShape="shape4"/></dragpoints>
    </shape>
    <shape name="shape3" shapetype="connectoraction" userlabel="Insert">
      <configuration><connectoraction connectionId="conn-1" operationId="op-1" connectorType="database" actionType="Send"/></configuration>
      <dragpoints><dragpoint toShape="shape5"/></dragpoints>
    </shape>
    <shape name="shape4" shapetype="processcall" userlabel="Audit">
      <configuration><processcall processId="proc-2" wait="true"/></configuration>
      <dragpoints><dragpoint toShape="shape5"/></dragpoints>
    </shape>
    <shape name="shape5" shapetype="stop"/>
  </shapes></process></bns:object>
</bns:Component>`;

describe('Dell Boomi Discovery stage', () => {
    let workspace: string;
    let scan: ScanResult;
    beforeEach(async () => {
        workspace = createWorkspace();
        clearBoomiCaches();
        scan = await scanSample();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('detects Dell Boomi from the manifest and process components', async () => {
        const detection = await PlatformDetector.getInstance().detect(fixturePath);
        assert.equal(detection.platform, 'boomi');
        assert.equal(detection.version, 'AtomSphere');
        assert.ok(detection.confidence >= 90);
        assert.ok(detection.indicators.some((item) => item.match.includes('migration-manifest')));
        assert.ok(detection.indicators.some((item) => item.match.startsWith('4 Boomi process')));
        assert.deepEqual(detection.alternativePlatforms, []);
        assert.equal(await defaultParserFactory.detectPlatform(fixturePath), 'boomi');
    });

    it('discovers every file as a Boomi artifact without parse errors or skips', () => {
        assert.equal(scan.totalFilesScanned, sample.files.length);
        assert.deepEqual(scan.parseErrors, []);
        assert.deepEqual(scan.skippedFiles, []);
        assert.deepEqual(
            scan.parsedArtifacts.map((item) => item.sourcePath.split(path.sep).join('/')).sort(),
            [...sample.files].sort()
        );
        for (const artifact of scan.parsedArtifacts) {
            assert.equal(artifact.ir.metadata.source.platform, 'boomi', artifact.sourcePath);
        }
    });

    it('categorizes each Boomi component type', () => {
        const types = typesByPath(scan);
        assert.deepEqual(
            {
                process: types['Processes/OrderProcessing.xml'],
                connection: types['Connections/ERP.xml'],
                operation: types['Operations/ERPUpsert.xml'],
                map: types['Maps/OrderToERPMap.xml'],
                jsonProfile: types['Profiles/JSON/Order.schema.json'],
                xmlProfile: types['Profiles/XML/Customer.xsd'],
                tradingPartner: types['EDI/TradingPartners/ContosoRetail.xml'],
                api: types['APIs/OpenAPI/order-api.json'],
                script: types['Scripts/Groovy/CalculateRisk.groovy'],
                properties: types['ProcessProperties/application.properties'],
                environment: types['EnvironmentExtensions/extensions.json'],
                manifest: types['migration-manifest.json'],
            },
            {
                process: 'flow',
                connection: 'connector',
                operation: 'connector',
                map: 'map',
                jsonProfile: 'schema',
                xmlProfile: 'schema',
                tradingPartner: 'b2b',
                api: 'api-spec',
                script: 'custom-code',
                properties: 'config',
                environment: 'config',
                manifest: 'custom-code',
            }
        );
        assert.equal(scan.parsedArtifacts.filter((item) => item.type === 'flow').length, 4);
    });

    it('converts OrderProcessing shapes into ordered IR actions with sub-process calls', () => {
        const process = scan.parsedArtifacts.find((item) => item.name === sample.processName);
        assert.ok(process);
        const { actions, triggers, connections } = process.ir;
        assert.deepEqual(
            actions.map((action) => [action.name, action.type]),
            [
                ['ValidateOrder', 'validate'],
                ['CustomerLookup', 'call-workflow'],
                ['OrderToERPMap', 'transform'],
                ['ERPUpsert', 'database-execute'],
                ['PublishOrderEvent', 'queue-send'],
                ['CommonErrorHandler', 'call-workflow'],
            ]
        );
        assert.equal(actions[0].runAfter, undefined);
        assert.deepEqual(actions[1].runAfter, { [actions[0].id]: ['Succeeded'] });
        assert.equal(
            (actions[1].config as unknown as Record<string, unknown>)['workflowName'],
            'CustomerLookup'
        );
        // No Start shape: the HTTP listener operation sharing the "Order" token becomes the trigger.
        assert.equal(triggers.length, 1);
        assert.equal(triggers[0].type, 'http');
        assert.equal(
            (triggers[0].config as unknown as Record<string, unknown>)['operationName'],
            'ReceiveOrder'
        );
        assert.deepEqual(connections.map((conn) => conn.id).sort(), [
            'conn-boomi-ERP',
            'conn-boomi-OrderApi',
        ]);
        const boomi = process.ir.extensions?.boomi as Record<string, unknown>;
        assert.deepEqual(boomi['subprocesses'], ['CustomerLookup', 'CommonErrorHandler']);
        assert.deepEqual(boomi['maps'], ['OrderToERPMap']);
    });

    it('marks sub-processes as child workflows with their callers', () => {
        const handler = scan.parsedArtifacts.find((item) => item.name === 'CommonErrorHandler');
        assert.ok(handler);
        assert.equal(handler.ir.triggers[0].type, 'manual');
        assert.deepEqual(
            (handler.ir.triggers[0].config as unknown as Record<string, unknown>)['calledBy'],
            ['CustomerLookup', 'InvoiceProcessing', 'OrderProcessing']
        );
    });

    it('maps connections without copying secrets and flags custom-code and B2B gaps', () => {
        const crm = scan.parsedArtifacts.find((item) => item.sourcePath.endsWith('CRM.xml'));
        assert.ok(crm);
        assert.equal(crm.ir.connections[0].type, 'salesforce');
        assert.doesNotMatch(JSON.stringify(crm.ir), /CRM_SECRET\}/);
        const script = scan.parsedArtifacts.find((item) => item.name === 'CalculateRisk');
        assert.equal(script?.ir.gaps[0].category, 'custom-code');
        assert.equal(
            (script?.ir.extensions?.boomi as Record<string, unknown>)['language'],
            'groovy'
        );
        const partner = scan.parsedArtifacts.find((item) => item.name === 'ContosoRetail');
        assert.equal(partner?.ir.gaps[0].category, 'b2b');
        const properties = scan.parsedArtifacts.find((item) => item.name === 'application');
        assert.deepEqual(
            (properties?.ir.extensions?.boomi as Record<string, unknown>)['propertyNames'],
            ['retry.count', 'order.timeout.seconds', 'environment']
        );
    });

    it('parses the project directory from its manifest and lists component artifacts', async () => {
        const parser = new BoomiProjectParser();
        assert.equal(parser.canParse(fixturePath), true);
        assert.equal(parser.canParse(manifestPath), true);
        assert.equal(await parser.detectVersion(fixturePath), 'AtomSphere');
        const result = await parser.parse(fixturePath);
        assert.equal(result.success, true);
        assert.ok(result.ir);
        assert.equal(result.ir.metadata.name, 'BoomiOrderManagement');
        assert.equal(result.ir.metadata.source.platform, 'boomi');
        const artifacts = await parser.getProjectArtifacts(fixturePath);
        assert.equal(artifacts.length, sample.files.length - 2); // excludes manifest and README
        assert.equal(artifacts.find((item) => item.path === processPath)?.type, 'flow');
    });

    it('builds stable inventory IDs across scans', async () => {
        const builder = new InventoryBuilder();
        const first = builder.build(scan, 'BoomiOrderManagement', 'AtomSphere');
        const second = builder.build(await scanSample(), 'BoomiOrderManagement', 'AtomSphere');
        assert.equal(first.platform, 'boomi');
        assert.equal(first.statistics.totalCount, sample.files.length);
        assert.equal(first.id, second.id);
        assert.deepEqual(
            first.items.map((item) => item.id),
            second.items.map((item) => item.id)
        );
    });

    it('parses native AtomSphere component exports with dragpoint branching', async () => {
        const write = (name: string, xml: string) => {
            const file = path.join(workspace, name);
            fs.writeFileSync(file, xml);
            return file;
        };
        write('OrdersDb.xml', NATIVE_CONNECTION);
        write('InsertOrder.xml', NATIVE_OPERATION);
        write('Audit.xml', NATIVE_SUBPROCESS);
        const processFile = write('SyncOrders.xml', NATIVE_PROCESS);

        const parser = new BoomiProcessParser();
        assert.equal(parser.canParse(processFile), true);
        assert.equal(new BoomiConnectorParser().canParse(processFile), false);
        const result = await parser.parse(processFile);
        assert.equal(result.success, true);
        assert.ok(result.ir);
        assert.equal(result.ir.metadata.name, 'Sync Orders');
        assert.equal(result.ir.triggers[0].type, 'http');
        const byName = Object.fromEntries(result.ir.actions.map((a) => [a.name, a]));
        assert.equal(byName['Is priority?'].type, 'condition');
        assert.equal(byName['Insert'].type, 'database-execute');
        assert.equal(byName['Audit'].type, 'call-workflow');
        assert.deepEqual(Object.keys(byName['Insert'].runAfter ?? {}), [byName['Is priority?'].id]);
        assert.equal(result.ir.connections[0].name, 'Orders DB');
        assert.doesNotMatch(JSON.stringify(result.ir), /hunter2/);
        assert.equal((result.ir.extensions?.boomi as Record<string, unknown>)['dialect'], 'native');
    });

    it('does not claim unrelated XML or JSON files outside a Boomi project', () => {
        const xml = path.join(workspace, 'pom.xml');
        fs.writeFileSync(xml, '<project><artifactId>x</artifactId></project>');
        const json = path.join(workspace, 'settings.json');
        fs.writeFileSync(json, '{}');
        const groovy = path.join(workspace, 'build.groovy');
        fs.writeFileSync(groovy, 'println "hi"');
        assert.equal(new BoomiProcessParser().canParse(xml), false);
        assert.equal(new BoomiProjectParser().canParse(json), false);
        assert.equal(new BoomiScriptParser().canParse(groovy), false);
    });

    it('records malformed process XML as an explicit parse failure', async () => {
        const broken = path.join(workspace, 'Broken.xml');
        fs.writeFileSync(broken, '<syntheticBoomiProcess name="Broken"><shapes>');
        const result = await new BoomiProcessParser().parse(broken);
        assert.equal(result.success, false);
        assert.equal(result.ir, null);
        assert.ok(result.errors.length > 0);
        assert.ok(testHost.logs.some((entry) => /not valid XML/.test(entry.message)));
        testHost.logs.length = 0;
    });
});
