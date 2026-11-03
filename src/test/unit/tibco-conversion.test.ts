import * as assert from 'assert/strict';
import { createWorkspace, disposeWorkspace, generatedAt } from '../helpers/workspace';
import { cachedPlan, prepareConversion, preparePlanning } from '../helpers/tibco';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { ConversionService } from '../../stages/conversion/ConversionService';
import { ConversionFileService } from '../../stages/conversion/ConversionFileService';

describe('TIBCO Conversion stage', () => {
    let workspace: string;
    beforeEach(() => {
        workspace = createWorkspace();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('does not offer unplanned TIBCO processes for conversion', async () => {
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

    it('persists workflow, validation, and optional deployment task dependencies', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        const plan = conversion.getTaskPlan(flow.id);
        assert.ok(plan);
        assert.equal(conversion.getFlows()[0].status, 'tasks-ready');
        assert.deepEqual(
            plan.tasks.map((task) => task.dependsOn),
            [[], ['generate-workflow'], ['test-workflows']]
        );
        assert.deepEqual(plan.tasks[0].artifactIds, flow.artifactIds);
        assert.deepEqual(ConversionFileService.getInstance().readTaskPlan(flow.id), plan);
    });

    it('records failed validation without completing the flow', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.updateTask(flow.id, 'test-workflows', { status: 'failed' });
        assert.equal(conversion.getTaskPlan(flow.id)?.tasks[1].status, 'failed');
        assert.notEqual(conversion.getFlows()[0].status, 'completed');
        assert.equal(
            ConversionFileService.getInstance().readTaskPlan(flow.id)?.tasks[1].status,
            'failed'
        );
    });

    it('releases Execute All when required work completes without auto-deploying', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.setExecuteAllActive(flow.id, true);
        for (const taskId of ['generate-workflow', 'test-workflows']) {
            await conversion.storeTaskOutput(flow.id, taskId, {
                completedAt: generatedAt,
                summary: `Recorded ${taskId} response.`,
            });
        }
        assert.equal(conversion.isExecuteAllActive(flow.id), false);
        assert.equal(conversion.getFlows()[0].status, 'tasks-ready');
        assert.equal(conversion.getTaskPlan(flow.id)?.tasks[2].status, 'pending');
        await conversion.storeTaskOutput(flow.id, 'cloud-deploy-test', {
            completedAt: generatedAt,
            summary: 'Skipped optional deployment for offline tests.',
        });
        assert.equal(conversion.getFlows()[0].status, 'completed');
        assert.equal(conversion.getTaskPlan(flow.id)?.tasks[2].status, 'skipped');
    });

    it('restores running execution after restart and can stop it safely', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.setExecuteAllActive(flow.id, true);
        await conversion.updateTask(flow.id, 'generate-workflow', { status: 'in-progress' });
        conversion.dispose();
        const restored = ConversionService.getInstance();
        await restored.initialize();
        assert.equal(restored.getFlows()[0].status, 'in-progress');
        assert.equal(restored.isExecuteAllActive(flow.id), true);
        await restored.stopExecution(flow.id);
        assert.equal(restored.isExecuteAllActive(flow.id), false);
        assert.equal(restored.getFlows()[0].status, 'tasks-ready');
        assert.equal(restored.getTaskPlan(flow.id)?.tasks[0].status, 'pending');
    });

    it('resets conversion while leaving the source flow eligible for a fresh conversion', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.reset();
        assert.equal(conversion.getState(), undefined);
        const flows = conversion.buildFlowsFromPlanning();
        assert.equal(flows[0].id, flow.id);
        assert.equal(flows[0].status, 'not-started');
    });
});
