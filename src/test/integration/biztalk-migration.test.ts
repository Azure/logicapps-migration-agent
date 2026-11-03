import * as assert from 'assert/strict';
import {
    cachedPlan,
    conversionPlan,
    createWorkspace,
    disposeWorkspace,
    fixturePath,
    generatedAt,
    scanSample,
} from '../helpers/biztalk';
import { PlatformDetector } from '../../stages/discovery/PlatformDetector';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { PlanningService } from '../../stages/planning/PlanningService';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { ConversionService } from '../../stages/conversion/ConversionService';
import { ConversionFileService } from '../../stages/conversion/ConversionFileService';

describe('BizTalk migration stage handoff (deterministic agent responses)', () => {
    let workspace: string;
    beforeEach(() => {
        workspace = createWorkspace();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('carries source artifact IDs from discovery through cached planning and conversion restart', async () => {
        const detection = await PlatformDetector.getInstance().detect(fixturePath);
        assert.equal(detection.platform, 'biztalk');
        const scan = await scanSample();
        assert.deepEqual(scan.parseErrors, []);
        await InventoryService.getInstance().createFromScanResult(
            scan,
            'HelloApplicationDeployment'
        );
        const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
        assert.equal(flows.length, 1);
        const flow = flows[0];
        const source = scan.parsedArtifacts.find((artifact) => artifact.name === 'HelloSchedule');
        assert.ok(source);
        assert.deepEqual(flow.artifactIds, [source.id]);

        await PlanningCacheService.getInstance().store(cachedPlan(flow));
        PlanningService.getInstance().dispose();
        PlanningCacheService.resetInstance();
        await PlanningService.getInstance().initialize();
        assert.equal(PlanningService.getInstance().buildFlowsFromDiscovery()[0].status, 'planned');

        const conversion = ConversionService.getInstance();
        assert.deepEqual(conversion.buildFlowsFromPlanning()[0].artifactIds, [source.id]);
        const plan = conversionPlan(flow);
        ConversionFileService.getInstance().storeTaskPlan(flow.id, plan);
        await conversion.storeTaskPlan(flow.id, plan);
        await conversion.setExecuteAllActive(flow.id, true);
        for (const task of plan.tasks.filter((item) => !item.optional)) {
            await conversion.storeTaskOutput(flow.id, task.id, {
                completedAt: generatedAt,
                summary: `Recorded deterministic ${task.id} response.`,
                generatedFiles: task.type === 'test-workflows' ? ['TEST-REPORT.md'] : [],
            });
        }
        await conversion.storeTaskOutput(flow.id, 'cloud-deploy-test', {
            completedAt: generatedAt,
            summary: 'Skipped optional deployment in offline stage-handoff test.',
        });
        conversion.dispose();
        const restored = ConversionService.getInstance();
        await restored.initialize();
        assert.equal(restored.getFlows()[0].status, 'completed');
        assert.deepEqual(restored.getFlows()[0].artifactIds, [source.id]);
        assert.equal(restored.isExecuteAllActive(flow.id), false);
        assert.deepEqual(
            restored.getTaskPlan(flow.id)?.tasks.map((task) => task.status),
            ['completed', 'completed', 'completed', 'skipped']
        );
        assert.equal(
            ConversionFileService.getInstance().readTaskPlan(flow.id)?.tasks[3].status,
            'skipped'
        );
    });
});
