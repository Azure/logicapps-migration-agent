import * as assert from 'assert/strict';
import { createWorkspace, disposeWorkspace } from '../helpers/workspace';
import { cachedPlan, migrationPlan, preparePlanning } from '../helpers/boomi';
import sample from '../fixtures/boomi/sample.json';
import { testHost } from '../setup';
import { clearBoomiCaches } from '../../parsers/boomi';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { PlanningService } from '../../stages/planning/PlanningService';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { StorageKeys, StorageService } from '../../services/StorageService';
import { PlanningStageState } from '../../stages/planning/types';

describe('Dell Boomi Planning stage', () => {
    let workspace: string;
    beforeEach(() => {
        workspace = createWorkspace();
        clearBoomiCaches();
    });
    afterEach(() => disposeWorkspace(workspace));

    it('offers each Boomi process for planning but not supporting components', async () => {
        const flow = await preparePlanning();
        const inventory = InventoryService.getInstance().getInventory();
        const process = inventory?.items.find((item) => item.name === sample.processName);
        assert.ok(process);
        assert.equal(flow.category, 'flow');
        assert.equal(flow.id, process.id);
        assert.deepEqual(flow.artifactIds, [process.id]);
        assert.equal(flow.status, 'not-started');
        const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
        assert.equal(flows.length, sample.processes.length);
    });

    it('keeps grouped processes and shared components separate', async () => {
        await preparePlanning();
        const items = InventoryService.getInstance().getInventory()?.items ?? [];
        const ids = (names: string[]) =>
            names.map((name) => items.find((item) => item.name === name)?.id ?? '');
        const orderIds = ids(['OrderProcessing', 'CustomerLookup', 'CommonErrorHandler']);
        const [invoiceId] = ids(['InvoiceProcessing']);
        const [manifestId] = ids(['BoomiOrderManagement']);
        testHost.flowGroups = {
            groups: [
                {
                    id: 'order-intake',
                    name: 'Order intake',
                    description: 'Order processing with CRM lookup and shared error handling.',
                    category: 'message-flow',
                    artifactIds: orderIds,
                },
                {
                    id: 'invoice-edi',
                    name: 'Invoice EDI',
                    description: 'Invoice to X12 over SFTP.',
                    category: 'message-flow',
                    artifactIds: [invoiceId],
                },
            ],
            ungroupedArtifactIds: [manifestId, 'missing-artifact'],
            explanation: 'Fixed Boomi group response.',
        };
        const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
        assert.deepEqual(
            flows.map((flow) => flow.id),
            ['order-intake', 'invoice-edi', 'ungrouped-artifacts']
        );
        assert.deepEqual(flows[0].artifactIds, orderIds);
        assert.deepEqual(flows[2].artifactIds, [manifestId]);
    });

    it('persists the supplied plan and its Groovy script gap', async () => {
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
    });

    it('restores finalized disk plans and preserves Boomi artifact IDs after restart', async () => {
        const flow = await preparePlanning();
        const finalized = await PlanningCacheService.getInstance().store(cachedPlan(flow));
        PlanningService.getInstance().dispose();
        PlanningCacheService.resetInstance();
        const restored = PlanningService.getInstance();
        await restored.initialize();
        const restoredFlow = restored
            .buildFlowsFromDiscovery()
            .find((item) => item.id === flow.id);
        assert.equal(restoredFlow?.status, 'planned');
        const restoredPlan = PlanningCacheService.getInstance().get(flow.id);
        assert.deepEqual(restoredPlan, finalized);
        assert.deepEqual(restoredPlan?.workflows[0].sourceArtifactIds, flow.artifactIds);
    });

    it('resets planning without deleting the discovered Boomi inventory', async () => {
        const flow = await preparePlanning();
        const planning = PlanningService.getInstance();
        await planning.storePlan(flow.id, migrationPlan(flow));
        await planning.reset();
        assert.equal(planning.getPlan(flow.id), undefined);
        assert.equal(InventoryService.getInstance().getInventory()?.platform, 'boomi');
        assert.ok(
            planning
                .buildFlowsFromDiscovery()
                .every((item) => item.status === 'not-started')
        );
    });
});
