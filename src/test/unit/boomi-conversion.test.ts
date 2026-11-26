import * as assert from 'assert/strict';
import { createWorkspace, disposeWorkspace, generatedAt } from '../helpers/workspace';
import { cachedPlan, prepareConversion, preparePlanning } from '../helpers/boomi';
import { clearBoomiCaches } from '../../parsers/boomi';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { ConversionService } from '../../stages/conversion/ConversionService';
import { ConversionFileService } from '../../stages/conversion/ConversionFileService';

describe('Dell Boomi Conversion stage', () => {
    let workspace: string;
    beforeEach(() => {
        workspace = createWorkspace();
        clearBoomiCaches();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('does not offer unplanned Boomi processes for conversion', async () => {
        await preparePlanning();
        assert.deepEqual(ConversionService.getInstance().buildFlowsFromPlanning(), []);
    });

    it('accepts finalized cached plans and preserves source process IDs', async () => {
        const flow = await preparePlanning();
        await PlanningCacheService.getInstance().store(cachedPlan(flow));
        const flows = ConversionService.getInstance().buildFlowsFromPlanning();
        assert.equal(flows.length, 1);
        assert.equal(flows[0].id, flow.id);
        assert.deepEqual(flows[0].artifactIds, flow.artifactIds);
    });

    it('persists task dependencies and completes only after optional deploy is resolved', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        const plan = conversion.getTaskPlan(flow.id);
        assert.ok(plan);
        assert.deepEqual(
            plan.tasks.map((task) => task.dependsOn),
            [[], ['generate-workflow'], ['test-workflows']]
        );
        assert.deepEqual(ConversionFileService.getInstance().readTaskPlan(flow.id), plan);
        for (const taskId of ['generate-workflow', 'test-workflows']) {
            await conversion.storeTaskOutput(flow.id, taskId, {
                completedAt: generatedAt,
                summary: `Recorded ${taskId} response.`,
            });
        }
        assert.equal(conversion.getFlows()[0].status, 'tasks-ready');
        await conversion.storeTaskOutput(flow.id, 'cloud-deploy-test', {
            completedAt: generatedAt,
            summary: 'Skipped optional deployment for offline tests.',
        });
        assert.equal(conversion.getFlows()[0].status, 'completed');
        assert.equal(conversion.getTaskPlan(flow.id)?.tasks[2].status, 'skipped');
    });
});
