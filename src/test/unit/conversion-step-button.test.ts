import * as assert from 'assert/strict';
import {
    ConversionStepState,
    renderConversionStepButton,
} from '../../views/discovery/ConversionStepButton';

const planned: ConversionStepState = {
    flowId: 'order-flow',
    isPlanned: true,
    isTasksCreated: false,
    isConverted: false,
    isCreatingTasks: false,
    isExecuting: false,
    isBlockedByOtherFlow: false,
};

function step(overrides: Partial<ConversionStepState>): {
    label: string;
    action?: string;
    disabled: boolean;
} {
    const html = renderConversionStepButton({ ...planned, ...overrides });
    return {
        label: /<strong>([^<]*)<\/strong>/.exec(html)?.[1] ?? '',
        action: /onclick="event\.stopPropagation\(\); (\w+)\('order-flow'\)"/.exec(html)?.[1],
        disabled: /\sdisabled[\s>]/.test(html),
    };
}

describe('Home conversion step', () => {
    it('creates the conversion tasks once the flow is planned', () => {
        assert.deepEqual(step({ isPlanned: false }), {
            label: 'Create',
            action: undefined,
            disabled: true,
        });
        assert.deepEqual(step({}), { label: 'Create', action: 'convertFlow', disabled: false });
        assert.deepEqual(step({ isCreatingTasks: true }), {
            label: 'Creating...',
            action: undefined,
            disabled: true,
        });
    });

    it('opens the created tasks so they are executed from the task list', () => {
        assert.deepEqual(step({ isTasksCreated: true }), {
            label: 'Execute',
            action: 'viewConversion',
            disabled: false,
        });
        assert.deepEqual(step({ isTasksCreated: true, isExecuting: true }), {
            label: 'Executing...',
            action: undefined,
            disabled: true,
        });
        assert.deepEqual(step({ isTasksCreated: true, isConverted: true }), {
            label: '✓ Converted',
            action: 'viewConversion',
            disabled: false,
        });
    });

    it('only blocks creating tasks while another flow is busy', () => {
        assert.deepEqual(step({ isBlockedByOtherFlow: true }), {
            label: 'Create',
            action: undefined,
            disabled: true,
        });
        assert.deepEqual(step({ isBlockedByOtherFlow: true, isTasksCreated: true }), {
            label: 'Execute',
            action: 'viewConversion',
            disabled: false,
        });
    });
});
