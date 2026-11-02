import * as assert from 'assert/strict';
import { createWorkspace, disposeWorkspace, generatedAt } from '../helpers/workspace';
import { PlanningFileService } from '../../stages/planning/PlanningFileService';
import {
    validateWorkflowDefinition,
    validateLocalFunctionResultContracts,
} from '../../workflowSchema';
import type { LogicAppsWorkflowDefinition, WorkflowAction } from '../../workflowSchema';

function loggingWorkflow(
    value: string
): LogicAppsWorkflowDefinition & { actions: Record<string, WorkflowAction> } {
    return {
        $schema:
            'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
        contentVersion: '1.0.0.0',
        triggers: { Request: { type: 'Request', kind: 'Http' } },
        actions: {
            Initialize_logging: {
                type: 'InitializeVariable',
                inputs: { variables: [{ name: 'logging', type: 'boolean', value: false }] },
                runAfter: {},
            },
            Read_logging_flag: {
                type: 'InvokeFunction',
                inputs: { functionName: 'ReadLoggingFlag', parameters: {} },
                runAfter: { Initialize_logging: ['Succeeded'] },
            },
            Assign_logging: {
                type: 'SetVariable',
                inputs: { name: 'logging', value },
                runAfter: { Read_logging_flag: ['Succeeded'] },
            },
        },
    };
}

describe('Local-function result contracts', () => {
    it('rejects a raw local-function result assigned to a Boolean variable during planning', () => {
        const validation = validateWorkflowDefinition(
            loggingWorkflow("@body('Read_logging_flag')")
        );
        assert.equal(validation.valid, false);
        assert.match(validation.errors.join('\n'), /Assign_logging.*Read_logging_flag/);
        assert.match(validation.errors.join('\n'), /result object/i);
    });

    it('allows the consumer to select the Boolean property from the result object', () => {
        for (const expression of [
            "@body('Read_logging_flag')?['Enabled']",
            "@outputs('Read_logging_flag')?['body']?['Enabled']",
            "@outputs('Read_logging_flag').body.Enabled",
        ]) {
            const validation = validateWorkflowDefinition(loggingWorkflow(expression));
            assert.equal(validation.valid, true, validation.errors.join('\n'));
        }
    });

    it('rejects whole-result expressions for timestamp and retry-path string consumers', () => {
        for (const expression of [
            "@body('Read_logging_flag')",
            "@outputs('Read_logging_flag')?['body']",
            "@outputs('Read_logging_flag').body",
            "@outputs('Read_logging_flag')",
        ]) {
            const workflow = loggingWorkflow(expression);
            for (const functionName of ['AddLocalTimestamp', 'RetrieveRetryPath']) {
                workflow.actions.Read_logging_flag.inputs.functionName = functionName;
                workflow.actions.Initialize_logging.inputs.variables[0].type = 'string';
                workflow.actions.Initialize_logging.inputs.variables[0].value = '';
                const validation = validateWorkflowDefinition(workflow);
                assert.equal(validation.valid, false, `${functionName}: ${expression}`);
                assert.match(validation.errors.join('\n'), /expects "string"/);
            }
        }
    });

    it('checks nested scopes, branches, and switch cases in wrapped workflow definitions', () => {
        const workflow = loggingWorkflow("@body('Read_logging_flag')");
        const actions = workflow.actions;
        workflow.actions = {
            Initialize_logging: actions.Initialize_logging,
            Helpers: {
                type: 'Scope',
                actions: { Read_logging_flag: actions.Read_logging_flag },
            },
            Branch: {
                type: 'If',
                expression: '@true',
                actions: {},
                else: {
                    actions: {
                        Route: {
                            type: 'Switch',
                            expression: 'route',
                            cases: {
                                Logging: {
                                    case: 'logging',
                                    actions: { Assign_logging: actions.Assign_logging },
                                },
                            },
                            default: {
                                actions: { Assign_default_logging: actions.Assign_logging },
                            },
                        },
                    },
                },
            },
        };
        const errors = validateLocalFunctionResultContracts({ definition: workflow });
        assert.equal(errors.length, 2);
        assert.match(
            errors.join('\n'),
            /Branch > \[else\] > Route > \[case:Logging\] > Assign_logging/
        );
        assert.match(errors.join('\n'), /Route > \[default\] > Assign_default_logging/);
    });

    it('allows whole-object consumers, explicit conversions, and non-local-function results', () => {
        const objectWorkflow = loggingWorkflow("@body('Read_logging_flag')");
        objectWorkflow.actions.Initialize_logging.inputs.variables[0].type = 'object';
        objectWorkflow.actions.Initialize_logging.inputs.variables[0].value = {};
        objectWorkflow.actions.Keep_result = {
            type: 'Compose',
            inputs: "@body('Read_logging_flag')",
        };
        assert.deepEqual(validateLocalFunctionResultContracts(objectWorkflow), []);

        const stringWorkflow = loggingWorkflow("@string(body('Read_logging_flag'))");
        stringWorkflow.actions.Initialize_logging.inputs.variables[0].type = 'string';
        assert.deepEqual(validateLocalFunctionResultContracts(stringWorkflow), []);

        const httpWorkflow = loggingWorkflow("@body('Read_logging_flag')");
        httpWorkflow.actions.Read_logging_flag.type = 'Http';
        assert.deepEqual(validateLocalFunctionResultContracts(httpWorkflow), []);
    });

    it('checks scalar initializers and outputs without rejecting object outputs', () => {
        const workflow = loggingWorkflow("@body('Read_logging_flag')?['Enabled']");
        workflow.actions.Initialize_logging.inputs.variables[0].value =
            "@body('Read_logging_flag')";
        workflow.outputs = {
            Logging: { type: 'Bool', value: "@body('Read_logging_flag')" },
            Result: { type: 'Object', value: "@body('Read_logging_flag')" },
        };
        const errors = validateLocalFunctionResultContracts(workflow);
        assert.equal(errors.length, 2);
        assert.match(errors[0], /Initialize_logging/);
        assert.match(errors[1], /Output "Logging"/);
    });

    it('rejects a conflicting plan at finalization even when workflow files were written directly', () => {
        const workspace = createWorkspace();
        try {
            const files = PlanningFileService.getInstance();
            const flowId = 'logging-flow';
            files.storeMeta(flowId, {
                flowId,
                flowName: 'Logging flow',
                explanation: 'Call a source helper and assign its logging flag.',
                summary: 'Preserve the logging decision.',
                generatedAt,
                updatedAt: generatedAt,
            });
            files.storeArchitecture(flowId, 'flowchart TB\n    Read --> Assign');
            files.storeActionMappings(flowId, []);
            files.storeGaps(flowId, []);
            files.storePatterns(flowId, []);
            files.storeArtifactDispositions(flowId, []);
            files.storeWorkflowDefinition(flowId, {
                name: 'logging',
                description: 'Read a logging flag.',
                triggerType: 'Request',
                actions: ['Read_logging_flag', 'Assign_logging'],
                sourceArtifactIds: [],
                definition: loggingWorkflow("@body('Read_logging_flag')"),
            });

            const validation = files.validate(flowId);
            assert.equal(validation.valid, false);
            assert.match(
                validation.files.map((file) => file.error ?? '').join('\n'),
                /Assign_logging.*Read_logging_flag/
            );
            const storedWorkflow = files.readWorkflowDefinition(flowId);
            assert.ok(storedWorkflow);
            files.storeWorkflowDefinition(flowId, {
                ...storedWorkflow,
                definition: loggingWorkflow("@body('Read_logging_flag')?['Enabled']"),
            });
            assert.equal(files.validate(flowId).valid, true);
        } finally {
            disposeWorkspace(workspace);
        }
    });
});
