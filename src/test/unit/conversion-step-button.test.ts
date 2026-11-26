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

describe('Home Execute step', () => {
    it('is named Execute and generates the conversion tasks once the flow is planned', () => {
        assert.deepEqual(step({ isPlanned: false }), {
            label: 'Execute',
            action: undefined,
            disabled: true,
        });
        assert.deepEqual(step({}), { label: 'Execute', action: 'convertFlow', disabled: false });
        assert.deepEqual(step({ isCreatingTasks: true }), {
            label: 'Executing...',
            action: undefined,
            disabled: true,
        });
    });

    it('opens the generated tasks so they are executed from the task list', () => {
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
            label: '✓ Executed',
            action: 'viewConversion',
            disabled: false,
        });
    });

    it('only blocks starting a flow while another flow is busy', () => {
        assert.deepEqual(step({ isBlockedByOtherFlow: true }), {
            label: 'Execute',
            action: undefined,
            disabled: true,
        });
        assert.deepEqual(step({ isBlockedByOtherFlow: true, isTasksCreated: true }), {
            label: 'Execute',
            action: 'viewConversion',
            disabled: false,
        });
    });

    it('never shows Create in any state', () => {
        const flags = [
            'isPlanned',
            'isTasksCreated',
            'isConverted',
            'isCreatingTasks',
            'isExecuting',
            'isBlockedByOtherFlow',
        ] as const;
        for (let mask = 0; mask < 2 ** flags.length; mask++) {
            const overrides: Partial<Record<(typeof flags)[number], boolean>> = {};
            flags.forEach((flag, i) => {
                overrides[flag] = Math.floor(mask / 2 ** i) % 2 === 1;
            });
            const html = renderConversionStepButton({ ...planned, ...overrides });
            assert.doesNotMatch(html, /creat/i, JSON.stringify(overrides));
            assert.ok(
                ['Execute', 'Executing...', '✓ Executed'].includes(step(overrides).label),
                JSON.stringify(overrides)
            );
        }
    });
});
