import * as assert from 'assert/strict';
import {
    cachedPlan,
    createWorkspace,
    disposeWorkspace,
    generatedAt,
    prepareConversion,
    preparePlanning,
} from '../helpers/biztalk';
import { ConversionService } from '../../stages/conversion/ConversionService';
import { ConversionFileService } from '../../stages/conversion/ConversionFileService';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { ConversionStageState } from '../../stages/conversion/types';
import { StorageKeys, StorageService } from '../../services/StorageService';

describe('BizTalk Conversion stage', () => {
    let workspace: string;
    beforeEach(() => {
        workspace = createWorkspace();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('excludes discovered flows that do not yet have a migration plan', async () => {
        await preparePlanning();
        assert.deepEqual(ConversionService.getInstance().buildFlowsFromPlanning(), []);
    });

    it('accepts a finalized cached plan even before the planning status is refreshed', async () => {
        const flow = await preparePlanning();
        await PlanningCacheService.getInstance().store(cachedPlan(flow));
        assert.equal(flow.status, 'not-started');
        const flows = ConversionService.getInstance().buildFlowsFromPlanning();
        assert.equal(flows.length, 1);
        assert.equal(flows[0].id, flow.id);
        assert.deepEqual(flows[0].artifactIds, flow.artifactIds);
    });

    it('stores ordered tasks and their schema-to-workflow-to-test dependencies', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        const plan = conversion.getTaskPlan(flow.id);
        assert.ok(plan);
        assert.equal(conversion.getFlows()[0].status, 'tasks-ready');
        assert.deepEqual(
            plan.tasks.map((task) => task.order),
            [1, 2, 3, 4]
        );
        assert.deepEqual(
            plan.tasks.map((task) => task.dependsOn),
            [[], ['convert-schemas-and-map'], ['generate-workflow'], ['test-workflows']]
        );
        assert.deepEqual(ConversionFileService.getInstance().readTaskPlan(flow.id), plan);
    });

    it('persists running status to both stage state and task-plan.json', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.updateTask(flow.id, 'convert-schemas-and-map', { status: 'in-progress' });
        assert.equal(conversion.getFlows()[0].status, 'in-progress');
        const persisted = StorageService.getInstance().getWorkspace<
            ConversionStageState | undefined
        >(StorageKeys.CONVERSION_STATE, undefined);
        assert.equal(persisted?.taskPlans[flow.id].tasks[0].status, 'in-progress');
        assert.equal(
            ConversionFileService.getInstance().readTaskPlan(flow.id)?.tasks[0].status,
            'in-progress'
        );
    });

    it('does not complete the flow when a required task fails', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.updateTask(flow.id, 'generate-workflow', { status: 'failed' });
        assert.equal(conversion.getTaskPlan(flow.id)?.tasks[1].status, 'failed');
        assert.notEqual(conversion.getFlows()[0].status, 'completed');
    });

    it('clears Execute All after required tasks finish but leaves optional deployment pending', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.setExecuteAllActive(flow.id, true);
        for (const taskId of ['convert-schemas-and-map', 'generate-workflow', 'test-workflows']) {
            await conversion.storeTaskOutput(flow.id, taskId, {
                completedAt: generatedAt,
                summary: `${taskId} completed.`,
            });
        }
        assert.equal(conversion.isExecuteAllActive(flow.id), false);
        assert.equal(conversion.getFlows()[0].executeAllActive, false);
        assert.equal(conversion.getFlows()[0].status, 'tasks-ready');
        assert.equal(conversion.getTaskPlan(flow.id)?.tasks[3].status, 'pending');
    });

    it('completes the flow when required tasks finish and cloud deployment is explicitly skipped', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        const completedFlows: string[] = [];
        conversion.onStateChange((event) => {
            if (event.type === 'flow-completed' && event.flowId) {
                completedFlows.push(event.flowId);
            }
        });
        for (const taskId of ['convert-schemas-and-map', 'generate-workflow', 'test-workflows']) {
            await conversion.storeTaskOutput(flow.id, taskId, {
                completedAt: generatedAt,
                summary: `${taskId} completed.`,
            });
        }
        await conversion.storeTaskOutput(flow.id, 'cloud-deploy-test', {
            completedAt: generatedAt,
            summary: 'Skipped optional Azure deployment for unit testing.',
        });
        assert.equal(conversion.getTaskPlan(flow.id)?.tasks[3].status, 'skipped');
        assert.equal(conversion.getFlows()[0].status, 'completed');
        assert.deepEqual(completedFlows, [flow.id]);
    });

    it('stops interrupted execution without losing previously completed tasks', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.updateTask(flow.id, 'convert-schemas-and-map', { status: 'completed' });
        await conversion.setExecuteAllActive(flow.id, true);
        await conversion.updateTask(flow.id, 'generate-workflow', { status: 'in-progress' });
        await conversion.stopExecution(flow.id);
        assert.equal(conversion.isExecuteAllActive(flow.id), false);
        assert.equal(conversion.getFlows()[0].status, 'tasks-ready');
        assert.deepEqual(
            conversion.getTaskPlan(flow.id)?.tasks.map((task) => task.status),
            ['completed', 'pending', 'pending', 'pending']
        );
        assert.equal(
            ConversionFileService.getInstance().readTaskPlan(flow.id)?.tasks[1].status,
            'pending'
        );
    });

    it('restores interrupted Execute All state after a service restart', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.setExecuteAllActive(flow.id, true);
        await conversion.updateTask(flow.id, 'generate-workflow', { status: 'in-progress' });
        conversion.dispose();
        const restored = ConversionService.getInstance();
        await restored.initialize();
        assert.equal(restored.getFlows()[0].status, 'in-progress');
        assert.equal(restored.isExecuteAllActive(flow.id), true);
        assert.equal(restored.getTaskPlan(flow.id)?.tasks[1].status, 'in-progress');
    });

    it('reset removes conversion state without changing the approved planning inputs', async () => {
        const flow = await prepareConversion();
        const conversion = ConversionService.getInstance();
        await conversion.reset();
        assert.equal(conversion.getState(), undefined);
        assert.equal(
            StorageService.getInstance().getWorkspace(StorageKeys.CONVERSION_STATE, undefined),
            undefined
        );
        const flows = conversion.buildFlowsFromPlanning();
        assert.equal(flows[0].id, flow.id);
        assert.equal(flows[0].status, 'not-started');
    });
});
