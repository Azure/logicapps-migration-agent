/**
 * Execute step on the Home flow cards.
 *
 * A single Execute step covers conversion: on a planned flow it generates the
 * conversion tasks and opens the task list, where each task (or Execute All)
 * is executed.
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
 * Render the Execute step. It keeps the Execute name in every state, like
 * Analyse → ✓ Analysed and Plan → ✓ Planned.
 */
export function renderConversionStepButton(state: ConversionStepState): string {
    if (!state.isPlanned) {
        return disabledStep('Execute', 'Plan first');
    }
    if (state.isCreatingTasks || state.isExecuting) {
        return disabledStep('Executing...');
    }
    if (state.isConverted) {
        return actionStep(
            '✓ Executed',
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
        return disabledStep('Execute', 'Another flow is in progress');
    }
    return actionStep(
        'Execute',
        'btn-primary',
        'convertFlow',
        state.flowId,
        'Generate the conversion tasks, then execute them from the task list'
    );
}
