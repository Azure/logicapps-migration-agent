import * as assert from 'assert/strict';
import { testHost } from '../setup';
import {
    cachedPlan,
    createWorkspace,
    disposeWorkspace,
    discoverSample,
    migrationPlan,
    preparePlanning,
} from '../helpers/biztalk';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { PlanningService } from '../../stages/planning/PlanningService';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { StorageKeys, StorageService } from '../../services/StorageService';
import { PlanningStageState } from '../../stages/planning/types';

describe('BizTalk Planning stage', () => {
    let workspace: string;
    beforeEach(() => {
        workspace = createWorkspace();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('returns no flows when Discovery has no inventory', () => {
        assert.deepEqual(PlanningService.getInstance().buildFlowsFromDiscovery(), []);
    });

    it('uses only the discovered orchestration as the fallback plannable flow', async () => {
        const flow = await preparePlanning();
        const inventory = InventoryService.getInstance().getInventory();
        assert.ok(inventory);
        const orchestration = inventory.items.find((item) => item.category === 'orchestration');
        assert.ok(orchestration);
        assert.equal(flow.name, 'HelloSchedule');
        assert.equal(flow.id, orchestration.id);
        assert.deepEqual(flow.artifactIds, [orchestration.id]);
        assert.equal(flow.artifactCount, 1);
        assert.equal(flow.status, 'not-started');
    });

    it('uses supplied flow groups and collects valid shared artifacts without dangling IDs', async () => {
        const inventory = await discoverSample();
        const orchestration = inventory.items.find((item) => item.category === 'orchestration');
        assert.ok(orchestration);
        const sharedIds = inventory.items
            .filter((item) => item.category === 'schema')
            .map((item) => item.id);
        testHost.flowGroups = {
            groups: [
                {
                    id: 'purchase-order-to-invoice',
                    name: 'Purchase order to invoice',
                    description: 'Receive, transform, and send.',
                    category: 'message-flow',
                    artifactIds: [orchestration.id],
                },
            ],
            ungroupedArtifactIds: [...sharedIds, 'nonexistent-artifact'],
            explanation: 'Deterministic discovery group response.',
        };
        const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
        assert.equal(flows.length, 2);
        assert.equal(flows[0].id, 'purchase-order-to-invoice');
        assert.deepEqual(flows[0].artifactIds, [orchestration.id]);
        assert.equal(flows[1].id, 'ungrouped-artifacts');
        assert.deepEqual(flows[1].artifactIds, sharedIds);
        assert.equal(flows[1].artifactCount, 2);
    });

    it('does not start an unanalyzed flow just because it was selected', async () => {
        const flow = await preparePlanning();
        const planning = PlanningService.getInstance();
        await planning.selectFlow(flow.id);
        assert.equal(planning.getState()?.selectedFlowId, flow.id);
        assert.equal(flow.status, 'not-started');
        testHost.analyzedFlowIds.add(flow.id);
        await planning.selectFlow(flow.id);
        assert.equal(flow.status, 'in-progress');
    });

    it('stores the supplied migration plan, updates status, and emits the plan event', async () => {
        const flow = await preparePlanning();
        const planning = PlanningService.getInstance();
        const events: string[] = [];
        planning.onStateChange((event) => {
            events.push(`${event.type}:${event.flowId}`);
        });
        const plan = migrationPlan(flow);
        await planning.storePlan(flow.id, plan);
        assert.deepEqual(planning.getPlan(flow.id), plan);
        assert.equal(flow.status, 'planned');
        assert.deepEqual(events, [`plan-generated:${flow.id}`]);
        const persisted = StorageService.getInstance().getWorkspace<PlanningStageState | undefined>(
            StorageKeys.MIGRATION_PLAN,
            undefined
        );
        assert.deepEqual(persisted?.plans[flow.id], plan);
    });

    it('restores planned flow IDs and plans after a service restart without LLM groups', async () => {
        const flow = await preparePlanning();
        const plan = migrationPlan(flow);
        await PlanningService.getInstance().storePlan(flow.id, plan);
        PlanningService.getInstance().dispose();
        const restored = PlanningService.getInstance();
        await restored.initialize();
        const flows = restored.buildFlowsFromDiscovery();
        assert.deepEqual(
            flows.map((item) => item.id),
            [flow.id]
        );
        assert.equal(flows[0].status, 'planned');
        assert.deepEqual(restored.getPlan(flow.id), plan);
    });

    it('reconciles not-started status with a finalized disk-cached plan', async () => {
        const flow = await preparePlanning();
        await PlanningCacheService.getInstance().store(cachedPlan(flow));
        PlanningCacheService.resetInstance();
        const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
        assert.equal(flows[0].status, 'planned');
        assert.deepEqual(PlanningCacheService.getInstance().get(flow.id), cachedPlan(flow));
    });

    it('reset removes the persisted plan and allows a clean planning session', async () => {
        const flow = await preparePlanning();
        const planning = PlanningService.getInstance();
        await planning.storePlan(flow.id, migrationPlan(flow));
        await planning.reset();
        assert.equal(planning.getState(), undefined);
        assert.equal(planning.getPlan(flow.id), undefined);
        assert.equal(
            StorageService.getInstance().getWorkspace(StorageKeys.MIGRATION_PLAN, undefined),
            undefined
        );
        assert.equal(planning.buildFlowsFromDiscovery()[0].status, 'not-started');
    });
});
