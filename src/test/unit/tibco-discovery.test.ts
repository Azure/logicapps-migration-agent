import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { createWorkspace, disposeWorkspace } from '../helpers/workspace';
import { fixturePath, processPath, scanSample } from '../helpers/tibco';
import sample from '../fixtures/tibco/sample.json';
import { testHost } from '../setup';
import { TIBCOProcessParser } from '../../parsers/tibco/TIBCOProcessParser';
import { TIBCOProjectParser } from '../../parsers/tibco/TIBCOProjectParser';
import { ArtifactScanner } from '../../stages/discovery/ArtifactScanner';
import { InventoryBuilder } from '../../stages/discovery/InventoryService';
import { PlatformDetector } from '../../stages/discovery/PlatformDetector';
import { ScanResult } from '../../stages/discovery/types';

describe('TIBCO Discovery stage', () => {
    let workspace: string;
    let scan: ScanResult;
    beforeEach(async () => {
        workspace = createWorkspace();
        scan = await scanSample();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('detects BusinessWorks 6 from the original module descriptor', async () => {
        const detection = await PlatformDetector.getInstance().detect(fixturePath);
        assert.equal(detection.platform, 'tibco');
        assert.equal(detection.version, '6.x');
        assert.ok(detection.confidence > 0);
        assert.ok(detection.indicators.some((item) => item.match.includes('module.bwm')));
        assert.deepEqual(detection.alternativePlatforms, []);
    });

    it('discovers all selected module files without parse errors or skips', () => {
        assert.equal(scan.totalFilesScanned, sample.files.length);
        assert.deepEqual(scan.parseErrors, []);
        assert.deepEqual(scan.skippedFiles, []);
        assert.deepEqual(
            scan.parsedArtifacts.map((item) => item.sourcePath.split(path.sep).join('/')).sort(),
            [...sample.files].sort()
        );
        assert.equal(scan.parsedArtifacts.filter((item) => item.type === 'flow').length, 1);
    });

    it('preserves the TIBCO source platform for both parsed and fallback artifacts', () => {
        for (const artifact of scan.parsedArtifacts) {
            assert.equal(artifact.ir.metadata.source.platform, 'tibco', artifact.sourcePath);
        }
    });

    it('retains the process name and summary without inventing executable IR actions', () => {
        const process = scan.parsedArtifacts.find((item) => item.type === 'flow');
        assert.ok(process);
        assert.equal(process.name, sample.processName);
        assert.equal(process.ir.metadata.source.artifact.fileType, 'bwp');
        assert.equal(process.ir.metadata.migration.complexity, 'medium');
        assert.deepEqual(process.ir.extensions?.tibco, {
            sourceFile: 'invokeSyncLogEvent.bwp',
            activityCount: 5,
            transitionCount: 0,
            starterTypes: ['tibex:StartEvent'],
        });
        // The current TIBCO parser is metadata-only, not a BPEL-to-actions converter.
        assert.deepEqual(process.ir.actions, []);
        assert.deepEqual(process.ir.triggers, []);
    });

    it('parses the BW6 project directory and locates its process artifact', async () => {
        const parser = new TIBCOProjectParser();
        assert.equal(parser.canParse(fixturePath), true);
        assert.equal(await parser.detectVersion(fixturePath), '6.x');
        const result = await parser.parse(fixturePath);
        assert.equal(result.success, true);
        assert.deepEqual(result.errors, []);
        assert.ok(result.ir);
        assert.equal(result.ir.metadata.source.platform, 'tibco');
        assert.equal(result.ir.metadata.source.platformVersion, '6.x');
        assert.equal(result.ir.metadata.name, 'CommonLogging');
        const artifacts = await parser.getProjectArtifacts(fixturePath);
        assert.equal(artifacts.length, 1);
        assert.equal(artifacts[0].path, processPath);
        assert.equal(artifacts[0].type, 'flow');
        assert.deepEqual(result.ir.extensions?.tibco, {
            descriptorFile: 'module.bwm',
            artifactCount: 1,
        });
    });

    it('builds stable inventory IDs across scans without losing platform and version', async () => {
        const builder = new InventoryBuilder();
        const first = builder.build(scan, 'CommonLogging', '6.x');
        const second = builder.build(await scanSample(), 'CommonLogging', '6.x');
        assert.equal(first.platform, 'tibco');
        assert.equal(first.platformVersion, '6.x');
        assert.equal(first.statistics.totalCount, sample.files.length);
        assert.equal(first.id, second.id);
        assert.deepEqual(
            first.items.map((item) => item.id),
            second.items.map((item) => item.id)
        );
        assert.equal(new Set(first.items.map((item) => item.id)).size, sample.files.length);
    });

    it('accepts the same process XML through the supported .process extension', async () => {
        const alternate = path.join(workspace, 'invokeSyncLogEvent.process');
        fs.copyFileSync(processPath, alternate);
        const parser = new TIBCOProcessParser();
        assert.equal(parser.canParse(alternate), true);
        const result = await parser.parse(alternate);
        assert.equal(result.success, true);
        assert.ok(result.ir);
        assert.equal(result.ir.metadata.name, sample.processName);
        assert.equal(result.ir.metadata.source.artifact.fileType, 'process');
        assert.equal(result.ir.metadata.source.platform, 'tibco');
    });

    it('records malformed process XML as an explicit parse failure', async () => {
        const invalidPath = path.join(workspace, 'Broken.bwp');
        fs.writeFileSync(invalidPath, '<');
        const result = await new TIBCOProcessParser().parse(invalidPath);
        assert.equal(result.success, false);
        assert.equal(result.ir, null);
        assert.ok(result.errors.length > 0);
        assert.ok(result.errors[0].message.length > 0);
        assert.deepEqual(testHost.logs.splice(0), [
            { level: 'WARN', message: '[Parser] Process file has no XML root element' },
        ]);
    });

    it('labels Java dependencies with the detected TIBCO platform', async () => {
        fs.writeFileSync(path.join(workspace, 'LoggingHelper.java'), 'class LoggingHelper {}');
        const result = await ArtifactScanner.getInstance().scan(workspace, 'tibco');
        assert.deepEqual(result.parseErrors, []);
        assert.equal(result.parsedArtifacts.length, 1);
        assert.equal(result.parsedArtifacts[0].type, 'custom-code');
        assert.equal(result.parsedArtifacts[0].ir.metadata.source.platform, 'tibco');
    });

    it('honors a cancelled scan without leaving an active scanner', async () => {
        const scanner = ArtifactScanner.getInstance();
        const result = await scanner.scan(fixturePath, 'tibco', {
            cancellationToken: { isCancellationRequested: true },
        });
        assert.deepEqual(result.parsedArtifacts, []);
        assert.equal(scanner.isScanning(), false);
    });
});
