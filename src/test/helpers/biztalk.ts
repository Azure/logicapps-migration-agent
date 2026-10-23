import * as assert from 'assert/strict';
import * as path from 'path';
import { generatedAt } from './workspace';
import { ArtifactScanner } from '../../stages/discovery/ArtifactScanner';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { PlanningService } from '../../stages/planning/PlanningService';
import { FlowPlanningResult } from '../../stages/planning/PlanningCacheService';
import { ConversionService } from '../../stages/conversion/ConversionService';
import { ConversionFileService } from '../../stages/conversion/ConversionFileService';
import { FlowMigrationPlan, PlanningFlow } from '../../stages/planning/types';
import { ConversionTaskPlan } from '../../stages/conversion/types';
import { ArtifactInventory, ScanResult } from '../../stages/discovery/types';

export const fixturePath = path.resolve(
    __dirname,
    '../../../src/test/fixtures/biztalk/HelloApplicationDeployment'
);
export { createWorkspace, disposeWorkspace, generatedAt } from './workspace';

export async function scanSample(): Promise<ScanResult> {
    return ArtifactScanner.getInstance().scan(fixturePath, 'biztalk');
}

export async function discoverSample(): Promise<ArtifactInventory> {
    const scan = await scanSample();
    assert.deepEqual(scan.parseErrors, []);
    return InventoryService.getInstance().createFromScanResult(scan, 'HelloApplicationDeployment');
}

export async function preparePlanning(): Promise<PlanningFlow> {
    await discoverSample();
    const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
    assert.equal(flows.length, 1);
    return flows[0];
}

// Agent responses are fixed inputs: these tests verify stage behavior, not LLM quality.
export function migrationPlan(flow: PlanningFlow): FlowMigrationPlan {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        complexity: { score: 20, level: 'low', factors: [] },
        patterns: [
            {
                name: 'Message Translator',
                category: 'transformation',
                description: 'Purchase order to invoice',
                logicAppsEquivalent: 'Transform XML',
                confidence: 'high',
            },
        ],
        connectorMappings: [],
        actionMappings: [
            {
                sourceAction: 'POToInvoiceTransform',
                targetAction: 'Transform XML',
                mappingType: 'adapted',
            },
        ],
        gaps: [],
        effortEstimate: {
            totalHours: 4,
            breakdown: { analysis: 1, conversion: 1, testing: 1, deployment: 1 },
            confidence: 'high',
        },
        summary: 'Migrate purchase-order receipt, invoice transformation, and invoice send.',
    };
}

export function cachedPlan(flow: PlanningFlow): FlowPlanningResult {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        mermaid: 'flowchart LR\n    ReceivePO --> POToInvoiceTransform --> SendInvoice',
        explanation: 'Receive a purchase order, transform it, and send an invoice.',
        workflows: [
            {
                name: 'purchase-order-to-invoice',
                description: 'Purchase order to invoice',
                triggerType: 'Request',
                actions: ['POToInvoiceTransform', 'SendInvoice'],
                sourceArtifactIds: flow.artifactIds,
            },
        ],
        azureComponents: [],
        connectorMappings: [],
        actionMappings: [
            {
                source: 'POToInvoiceTransform',
                target: 'Transform XML',
            },
        ],
        gaps: [],
        patterns: [],
        summary: 'Finalized purchase-order-to-invoice migration plan.',
    };
}

export function conversionPlan(flow: PlanningFlow): ConversionTaskPlan {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        summary: 'Convert schemas and map, generate workflow, validate, optionally deploy.',
        tasks: [
            {
                id: 'convert-schemas-and-map',
                type: 'convert-schemas',
                name: 'Convert PO and invoice schemas and map',
                description: 'Prepare POSchema, InvoiceSchema, and POToInvoice.',
                dependsOn: [],
                status: 'pending',
                order: 1,
                artifactIds: flow.artifactIds,
            },
            {
                id: 'generate-workflow',
                type: 'generate-workflow',
                name: 'Generate purchase-order-to-invoice workflow',
                description: 'Implement ReceivePO, POToInvoiceTransform, and SendInvoice.',
                dependsOn: ['convert-schemas-and-map'],
                status: 'pending',
                order: 2,
            },
            {
                id: 'test-workflows',
                type: 'test-workflows',
                name: 'Validate the migrated workflow',
                description: 'Validate successful transformation and invalid purchase orders.',
                dependsOn: ['generate-workflow'],
                status: 'pending',
                order: 3,
            },
            {
                id: 'cloud-deploy-test',
                type: 'cloud-deploy-test',
                name: 'Deploy and test in Azure',
                description: 'Optional cloud deployment.',
                dependsOn: ['test-workflows'],
                status: 'pending',
                optional: true,
                order: 4,
            },
        ],
    };
}

export async function prepareConversion(): Promise<PlanningFlow> {
    const flow = await preparePlanning();
    await PlanningService.getInstance().storePlan(flow.id, migrationPlan(flow));
    ConversionService.getInstance().buildFlowsFromPlanning();
    const plan = conversionPlan(flow);
    ConversionFileService.getInstance().storeTaskPlan(flow.id, plan);
    await ConversionService.getInstance().storeTaskPlan(flow.id, plan);
    return flow;
}
