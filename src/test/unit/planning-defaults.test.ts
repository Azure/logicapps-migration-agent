import * as assert from 'assert/strict';
import {
    configuredDefaultOption,
    DEPLOYMENT_QUESTION,
    PLANNING_QUESTION_IDS,
    PlanningQuestion,
} from '../../stages/planning/PlanningDecisions';

const mapStrategyQuestion: PlanningQuestion = {
    id: PLANNING_QUESTION_IDS.mapStrategy,
    question: 'Where should maps run?',
    whyItMatters: 'Map hosting affects deployment, scaling, and regression testing.',
    options: [
        {
            id: 'logic-app-xslt',
            label: 'Logic App XSLT',
            description: 'Transform XML with maps in Artifacts/Maps.',
        },
        {
            id: 'local-function',
            label: 'Local function',
            description: '.NET local function in the Logic App.',
        },
        {
            id: 'azure-function',
            label: 'Azure Functions',
            description: 'Separate .NET isolated Functions project called by workflows.',
        },
    ],
    recommendedOptionId: 'logic-app-xslt',
};

describe('Planning default choices', () => {
    it('keeps the standard question IDs stable for workspace settings', () => {
        assert.deepEqual(PLANNING_QUESTION_IDS, {
            messaging: 'messaging',
            modernization: 'modernization',
            mapStrategy: 'map-strategy',
            workflowTopology: 'workflow-topology',
        });
    });

    it('returns the configured option when the question offers it', () => {
        const defaults = {
            messaging: 'azure-service-bus',
            'map-strategy': 'azure-function',
            'workflow-topology': 'receiver-processor-sender',
        };
        assert.equal(configuredDefaultOption(mapStrategyQuestion, defaults), 'azure-function');
    });

    it('ignores unknown options and answers for other questions', () => {
        assert.equal(
            configuredDefaultOption(mapStrategyQuestion, { 'map-strategy': 'data-mapper' }),
            undefined
        );
        assert.equal(
            configuredDefaultOption(mapStrategyQuestion, { messaging: 'azure-function' }),
            undefined
        );
    });

    it('ignores configured values that are not strings', () => {
        const values = [undefined, null, 1, true, ['azure-function'], { id: 'azure-function' }];
        for (const value of values) {
            assert.equal(
                configuredDefaultOption(mapStrategyQuestion, { 'map-strategy': value }),
                undefined
            );
        }
    });

    it('ignores defaults that are not a plain object', () => {
        const listWithKey = Object.assign(['azure-function'], { 'map-strategy': 'azure-function' });
        for (const defaults of [undefined, null, 'azure-function', 42, listWithKey]) {
            assert.equal(configuredDefaultOption(mapStrategyQuestion, defaults), undefined);
        }
    });

    it('never answers hosting, which comes from the deployment model setting', () => {
        assert.ok(DEPLOYMENT_QUESTION.options.some((option) => option.id === 'hybrid'));
        assert.equal(
            configuredDefaultOption(DEPLOYMENT_QUESTION, { [DEPLOYMENT_QUESTION.id]: 'hybrid' }),
            undefined
        );
    });
});
