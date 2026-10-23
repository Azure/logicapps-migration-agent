import * as assert from 'assert/strict';
import { createWorkspace, disposeWorkspace } from '../helpers/workspace';
import { cachedPlan, migrationPlan, preparePlanning } from '../helpers/tibco';
import sample from '../fixtures/tibco/sample.json';
import { testHost } from '../setup';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { PlanningService } from '../../stages/planning/PlanningService';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { StorageKeys, StorageService } from '../../services/StorageService';
import { PlanningStageState } from '../../stages/planning/types';

describe('TIBCO Planning stage', () => {
    let workspace: string;
    beforeEach(() => {
        workspace = createWorkspace();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('offers the process for planning but not the module descriptor', async () => {
        const flow = await preparePlanning();
        const process = InventoryService.getInstance()
            .getInventory()
            ?.items.find((item) => item.category === 'flow');
        assert.ok(process);
        assert.equal(flow.name, sample.processName);
        assert.equal(flow.category, 'flow');
        assert.equal(flow.id, process.id);
        assert.deepEqual(flow.artifactIds, [process.id]);
        assert.equal(flow.status, 'not-started');
    });

    it('keeps grouped process and shared descriptor identities separate', async () => {
        const flow = await preparePlanning();
        const descriptor = InventoryService.getInstance()
            .getInventory()
            ?.items.find((item) => item.name === 'module');
        assert.ok(descriptor);
        testHost.flowGroups = {
            groups: [
                {
                    id: 'synchronous-logging',
                    name: 'Synchronous logging',
                    description: 'Invoke the logging service.',
                    category: 'message-flow',
                    artifactIds: flow.artifactIds,
                },
            ],
            ungroupedArtifactIds: [descriptor.id, 'missing-artifact'],
            explanation: 'Fixed TIBCO group response.',
        };
        const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
        assert.equal(flows.length, 2);
        assert.equal(flows[0].id, 'synchronous-logging');
        assert.deepEqual(flows[0].artifactIds, flow.artifactIds);
        assert.equal(flows[1].id, 'ungrouped-artifacts');
        assert.deepEqual(flows[1].artifactIds, [descriptor.id]);
    });

    it('starts planning only after process analysis is available', async () => {
        const flow = await preparePlanning();
        const planning = PlanningService.getInstance();
        await planning.selectFlow(flow.id);
        assert.equal(flow.status, 'not-started');
        testHost.analyzedFlowIds.add(flow.id);
        await planning.selectFlow(flow.id);
        assert.equal(flow.status, 'in-progress');
        assert.equal(planning.getState()?.selectedFlowId, flow.id);
    });

    it('persists the supplied logging plan and its unresolved SOAP-contract gap', async () => {
        const flow = await preparePlanning();
        const plan = migrationPlan(flow);
        const planning = PlanningService.getInstance();
        await planning.storePlan(flow.id, plan);
        assert.equal(flow.status, 'planned');
        assert.deepEqual(planning.getPlan(flow.id), plan);
        const state = StorageService.getInstance().getWorkspace<PlanningStageState | undefined>(
            StorageKeys.MIGRATION_PLAN,
            undefined
        );
        assert.deepEqual(state?.plans[flow.id].gaps, plan.gaps);
        assert.deepEqual(state?.plans[flow.id].actionMappings, plan.actionMappings);
    });

    it('restores finalized disk plans and preserves TIBCO artifact IDs after restart', async () => {
        const flow = await preparePlanning();
        const plan = cachedPlan(flow);
        await PlanningCacheService.getInstance().store(plan);
        PlanningService.getInstance().dispose();
        PlanningCacheService.resetInstance();
        const restored = PlanningService.getInstance();
        await restored.initialize();
        const flows = restored.buildFlowsFromDiscovery();
        assert.equal(flows[0].id, flow.id);
        assert.equal(flows[0].status, 'planned');
        assert.deepEqual(PlanningCacheService.getInstance().get(flow.id), plan);
        assert.deepEqual(plan.workflows[0].sourceArtifactIds, flow.artifactIds);
    });

    it('resets planning without deleting the discovered TIBCO inventory', async () => {
        const flow = await preparePlanning();
        const planning = PlanningService.getInstance();
        await planning.storePlan(flow.id, migrationPlan(flow));
        await planning.reset();
        assert.equal(planning.getState(), undefined);
        assert.equal(planning.getPlan(flow.id), undefined);
        assert.equal(InventoryService.getInstance().getInventory()?.platform, 'tibco');
        assert.equal(planning.buildFlowsFromDiscovery()[0].status, 'not-started');
    });
});
