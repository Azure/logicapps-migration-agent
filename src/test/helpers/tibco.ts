import * as assert from 'assert/strict';
import * as path from 'path';
import { generatedAt } from './workspace';
import sample from '../fixtures/tibco/sample.json';
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
    '../../../src/test/fixtures/tibco/CommonLogging'
);
export const processPath = path.join(
    fixturePath,
    'Processes',
    'commonlogging',
    'sh',
    'invokeSyncLogEvent.bwp'
);

export async function scanSample() {
    return ArtifactScanner.getInstance().scan(fixturePath, 'tibco');
}

export async function preparePlanning(): Promise<PlanningFlow> {
    const scan = await scanSample();
    assert.deepEqual(scan.parseErrors, []);
    await InventoryService.getInstance().createFromScanResult(scan, 'CommonLogging', '6.x');
    const flows = PlanningService.getInstance().buildFlowsFromDiscovery();
    assert.equal(flows.length, 1);
    assert.equal(flows[0].name, sample.processName);
    return flows[0];
}

// Fixed planner responses exercise stage contracts, not automated BPEL conversion.
export function migrationPlan(flow: PlanningFlow): FlowMigrationPlan {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        complexity: { score: 30, level: 'medium', factors: [] },
        patterns: [],
        connectorMappings: [],
        actionMappings: [
            {
                sourceAction: 'syncLogEvent',
                targetAction: 'HTTP',
                mappingType: 'adapted',
            },
        ],
        gaps: [
            {
                id: 'soap-contract',
                component: 'syncLogEvent',
                description: 'Review the SOAP contract and configure the target endpoint.',
                severity: 'medium',
            },
        ],
        effortEstimate: {
            totalHours: 4,
            breakdown: { analysis: 1, conversion: 1, testing: 1, deployment: 1 },
            confidence: 'medium',
        },
        summary: 'Invoke the logging service using a reviewed SOAP contract.',
    };
}

export function cachedPlan(flow: PlanningFlow): FlowPlanningResult {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        mermaid: 'flowchart LR\n    Request --> InvokeSyncLogEvent --> Response',
        explanation: 'Invoke a synchronous logging service.',
        workflows: [
            {
                name: 'invoke-sync-log-event',
                description: 'Invoke a synchronous logging service.',
                triggerType: 'Request',
                actions: ['InvokeSyncLogEvent', 'Response'],
                sourceArtifactIds: flow.artifactIds,
            },
        ],
        azureComponents: [],
        connectorMappings: [],
        actionMappings: [{ source: 'syncLogEvent', target: 'HTTP' }],
        gaps: [
            {
                component: 'syncLogEvent',
                gap: 'SOAP contract and target endpoint need review.',
                severity: 'medium',
                recommendation: 'Configure a reviewed service contract and endpoint.',
            },
        ],
        patterns: [],
        summary: 'Finalized synchronous logging migration plan.',
    };
}

export function conversionPlan(flow: PlanningFlow): ConversionTaskPlan {
    return {
        flowId: flow.id,
        flowName: flow.name,
        generatedAt,
        summary: 'Generate a logging workflow, validate it, and optionally deploy.',
        tasks: [
            {
                id: 'generate-workflow',
                type: 'generate-workflow',
                name: 'Generate synchronous logging workflow',
                description: 'Implement logging invocation and response.',
                artifactIds: flow.artifactIds,
                dependsOn: [],
                status: 'pending',
                order: 1,
            },
            {
                id: 'test-workflows',
                type: 'test-workflows',
                name: 'Validate logging workflow',
                description: 'Validate success and service fault handling.',
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
