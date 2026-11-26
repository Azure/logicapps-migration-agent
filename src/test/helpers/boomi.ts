import * as assert from 'assert/strict';
import * as path from 'path';
import { generatedAt } from './workspace';
import sample from '../fixtures/boomi/sample.json';
import { ArtifactScanner } from '../../stages/discovery/ArtifactScanner';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { PlanningService } from '../../stages/planning/PlanningService';
import { FlowPlanningResult } from '../../stages/planning/PlanningCacheService';
import { ConversionService } from '../../stages/conversion/ConversionService';
import { ConversionFileService } from '../../stages/conversion/ConversionFileService';
import { FlowMigrationPlan, PlanningFlow } from '../../stages/planning/types';
import { ConversionTaskPlan } from '../../stages/conversion/types';

export const fixturePath = path.resolve(
    __dirname,
    '../../../src/test/fixtures/boomi/BoomiOrderManagement'
);
export const processPath = path.join(fixturePath, 'Processes', `${sample.processName}.xml`);
export const manifestPath = path.join(fixturePath, 'migration-manifest.json');

export async function scanSample() {
    return ArtifactScanner.getInstance().scan(fixturePath, 'boomi');
}

/** Discover the sample and return the OrderProcessing planning flow. */
export async function preparePlanning(): Promise<PlanningFlow> {
    const scan = await scanSample();
    assert.deepEqual(scan.parseErrors, []);
    await InventoryService.getInstance().createFromScanResult(
        scan,
        'BoomiOrderManagement',
        'AtomSphere'
    );
    const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
    assert.deepEqual(flows.map((flow) => flow.name).sort(), [...sample.processes].sort());
    const flow = flows.find((item) => item.name === sample.processName);
    assert.ok(flow);
    return flow;
}

// Fixed planner responses exercise stage contracts, not LLM-driven conversion.
export function migrationPlan(flow: PlanningFlow): FlowMigrationPlan {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        complexity: { score: 45, level: 'medium', factors: [] },
        patterns: [],
        connectorMappings: [],
        actionMappings: [
            { sourceAction: 'ReceiveOrder', targetAction: 'Request', mappingType: 'direct' },
            { sourceAction: 'CustomerLookup', targetAction: 'Workflow', mappingType: 'direct' },
            { sourceAction: 'OrderToERPMap', targetAction: 'Transform XML', mappingType: 'adapted' },
            { sourceAction: 'ERPUpsert', targetAction: 'SQL Execute query', mappingType: 'adapted' },
            {
                sourceAction: 'PublishOrderEvent',
                targetAction: 'Service Bus Send message',
                mappingType: 'adapted',
            },
        ],
        gaps: [
            {
                id: 'groovy-risk-script',
                component: 'CalculateRisk',
                description: 'Port the Groovy risk-band script to an Inline Code action.',
                severity: 'medium',
            },
        ],
        effortEstimate: {
            totalHours: 16,
            breakdown: { analysis: 4, conversion: 6, testing: 4, deployment: 2 },
            confidence: 'medium',
        },
        summary: 'Receive orders over HTTP, enrich from CRM, map and upsert to ERP, publish event.',
    };
}

export function cachedPlan(flow: PlanningFlow): FlowPlanningResult {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        mermaid:
            'flowchart LR\n    Request --> Validate --> CustomerLookup --> Map --> ERPUpsert --> Publish',
        explanation: 'REST order intake with CRM enrichment, ERP upsert and event publication.',
        workflows: [
            {
                name: 'order-processing',
                description: 'Receive and process an order.',
                triggerType: 'Request',
                actions: ['Validate_Order', 'Customer_Lookup', 'Transform_Order', 'ERP_Upsert'],
                sourceArtifactIds: flow.artifactIds,
            },
        ],
        azureComponents: [],
        connectorMappings: [],
        actionMappings: [{ source: 'ERPUpsert', target: 'SQL Execute query' }],
        gaps: [
            {
                component: 'CalculateRisk',
                gap: 'Groovy script has no Logic Apps runtime.',
                severity: 'medium',
                recommendation: 'Port to an Inline Code (JavaScript) action.',
            },
        ],
        patterns: [],
        summary: 'Finalized order processing migration plan.',
    };
}

export function conversionPlan(flow: PlanningFlow): ConversionTaskPlan {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        summary: 'Generate the order workflows, validate them, and optionally deploy.',
        tasks: [
            {
                id: 'generate-workflow',
                type: 'generate-workflow',
                name: 'Generate order processing workflows',
                description: 'Implement order intake, CRM lookup, ERP upsert and publication.',
                artifactIds: flow.artifactIds,
                dependsOn: [],
                status: 'pending',
                order: 1,
            },
            {
                id: 'test-workflows',
                type: 'test-workflows',
                name: 'Validate order workflows',
                description: 'Validate success and error-handler paths.',
                dependsOn: ['generate-workflow'],
                status: 'pending',
                order: 2,
            },
            {
                id: 'cloud-deploy-test',
                type: 'cloud-deploy-test',
                name: 'Deploy and test in Azure',
                description: 'Optional cloud deployment.',
                dependsOn: ['test-workflows'],
                optional: true,
                status: 'pending',
                order: 3,
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
