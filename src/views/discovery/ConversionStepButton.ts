/**
 * Conversion step on the Home flow cards.
 *
 * A single step covers conversion: it creates the conversion tasks, then opens
 * the task list where each task (or Execute All) is executed.
 *
 * @module views/discovery/ConversionStepButton
 */

export interface ConversionStepState {
    readonly flowId: string;
    readonly isPlanned: boolean;
    readonly isTasksCreated: boolean;
    readonly isConverted: boolean;
    readonly isCreatingTasks: boolean;
    readonly isExecuting: boolean;
    readonly isBlockedByOtherFlow: boolean;
}

function stepLabel(text: string): string {
    return `<span class="step-label"><strong>${text}</strong><small>Conversion Tasks</small></span>`;
}

function disabledStep(text: string, title?: string): string {
    const titleAttr = title ? ` title="${title}"` : '';
    return `<button class="btn btn-step btn-disabled" disabled${titleAttr}>${stepLabel(text)}</button>`;
}

function actionStep(
    text: string,
    style: 'btn-primary' | 'btn-done',
    action: 'convertFlow' | 'viewConversion',
    flowId: string,
    title: string
): string {
    return `<button class="btn btn-step ${style}" onclick="event.stopPropagation(); ${action}('${flowId}')" title="${title}">${stepLabel(text)}</button>`;
}

/**
 * Render the conversion step: Create the tasks, then Execute them from the task list.
 */
export function renderConversionStepButton(state: ConversionStepState): string {
    if (!state.isPlanned) {
        return disabledStep('Create', 'Plan first');
    }
    if (state.isCreatingTasks) {
        return disabledStep('Creating...');
    }
    if (state.isExecuting) {
        return disabledStep('Executing...');
    }
    if (state.isConverted) {
        return actionStep(
            '✓ Converted',
            'btn-done',
            'viewConversion',
            state.flowId,
            'View conversion tasks'
        );
    }
    if (state.isTasksCreated) {
        return actionStep(
            'Execute',
            'btn-primary',
            'viewConversion',
            state.flowId,
            'Open the conversion tasks to execute them'
        );
    }
    if (state.isBlockedByOtherFlow) {
        return disabledStep('Create', 'Another flow is in progress');
    }
    return actionStep(
        'Create',
        'btn-primary',
        'convertFlow',
        state.flowId,
        'Create the conversion tasks'
    );
}
