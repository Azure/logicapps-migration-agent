import * as assert from 'assert/strict';
import { createWorkspace, disposeWorkspace, generatedAt } from '../helpers/workspace';
import { cachedPlan, conversionPlan, fixturePath, scanSample } from '../helpers/boomi';
import sample from '../fixtures/boomi/sample.json';
import { clearBoomiCaches } from '../../parsers/boomi';
import { PlatformDetector } from '../../stages/discovery/PlatformDetector';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { PlanningService } from '../../stages/planning/PlanningService';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { ConversionService } from '../../stages/conversion/ConversionService';
import { ConversionFileService } from '../../stages/conversion/ConversionFileService';

describe('Dell Boomi migration stage handoff (deterministic agent responses)', () => {
    let workspace: string;
    beforeEach(() => {
        workspace = createWorkspace();
        clearBoomiCaches();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('preserves process identity through discovery, planning, conversion, and disk reloads', async () => {
        const detection = await PlatformDetector.getInstance().detect(fixturePath);
        assert.equal(detection.platform, 'boomi');
        const scan = await scanSample();
        assert.deepEqual(scan.parseErrors, []);
        const inventory = InventoryService.getInstance();
        await inventory.createFromScanResult(scan, 'BoomiOrderManagement', detection.version);
        inventory.dispose();
        await InventoryService.getInstance().initialize();
        assert.equal(InventoryService.getInstance().getInventory()?.platform, 'boomi');
        assert.equal(InventoryService.getInstance().getInventory()?.platformVersion, 'AtomSphere');

        const flow = PlanningService.getInstance()
            .buildFlowsFromDiscovery()
            .find((item) => item.name === sample.processName);
        assert.ok(flow);
        const source = scan.parsedArtifacts.find(
            (artifact) => artifact.name === sample.processName
        );
        assert.ok(source);
        assert.deepEqual(flow.artifactIds, [source.id]);
        await PlanningCacheService.getInstance().store(cachedPlan(flow));
        PlanningService.getInstance().dispose();
        PlanningCacheService.resetInstance();
        await PlanningService.getInstance().initialize();
        assert.equal(
            PlanningService.getInstance()
                .buildFlowsFromDiscovery()
                .find((item) => item.id === flow.id)?.status,
            'planned'
        );

        const conversion = ConversionService.getInstance();
        assert.deepEqual(conversion.buildFlowsFromPlanning()[0].artifactIds, [source.id]);
        const plan = conversionPlan(flow);
        ConversionFileService.getInstance().storeTaskPlan(flow.id, plan);
        await conversion.storeTaskPlan(flow.id, plan);
        for (const task of plan.tasks) {
            await conversion.storeTaskOutput(flow.id, task.id, {
                completedAt: generatedAt,
                summary: task.optional
                    ? 'Skipped optional deployment in offline tests.'
                    : `Recorded deterministic ${task.id} response.`,
            });
        }
        conversion.dispose();
        const restored = ConversionService.getInstance();
        await restored.initialize();
        assert.equal(restored.getFlows()[0].status, 'completed');
        assert.deepEqual(
            restored.getTaskPlan(flow.id)?.tasks.map((task) => task.status),
            ['completed', 'completed', 'skipped']
        );
    });
});
