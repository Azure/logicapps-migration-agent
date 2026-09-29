import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { UserPrompts } from '../../constants/UserMessages';
import { PlanningFileService } from './PlanningFileService';
import {
    DEPLOYMENT_QUESTION,
    PlanningDecision,
    PlanningPreferences,
    PlanningQuestion,
    validatePlanningQuestion,
} from './PlanningDecisions';

export class PlanningDecisionService {
    private static readonly resolving = new Set<string>();

    public async resolve(
        flowId: string,
        questions: PlanningQuestion[],
        token: vscode.CancellationToken,
        reconsider = false,
        deploymentTarget?: string
    ): Promise<PlanningPreferences> {
        if (!flowId.trim() || questions.length > 2) {
            throw new Error(
                'Provide a flow ID and at most two critical questions per preflight call.'
            );
        }
        const ids = new Set([DEPLOYMENT_QUESTION.id]);
        const hostingQuestion =
            deploymentTarget === undefined
                ? DEPLOYMENT_QUESTION
                : { ...DEPLOYMENT_QUESTION, answerFromUser: deploymentTarget };
        validatePlanningQuestion(hostingQuestion);
        for (const question of questions) {
            validatePlanningQuestion(question);
            if (ids.has(question.id)) {
                throw new Error(
                    'Use unique question IDs; deployment-target is handled automatically.'
                );
            }
            ids.add(question.id);
        }
        if (PlanningDecisionService.resolving.has(flowId)) {
            throw new Error(
                'Planning choices for this flow are already open. Finish that prompt first.'
            );
        }

        const files = PlanningFileService.getInstance();
        const previous = files.readPreferences(flowId);
        const preferences: PlanningPreferences = previous ?? {
            flowId,
            revision: randomUUID(),
            status: 'pending',
            decisions: [],
            updatedAt: new Date().toISOString(),
        };
        const originalDecisions = new Map(
            preferences.decisions.map((decision) => [decision.id, decision])
        );
        const pending = new Map(
            (preferences.pendingQuestions ?? []).map((question) => [question.id, question])
        );
        const inspected = vscode.workspace
            .getConfiguration('logicAppsMigrationAgent')
            .inspect<string>('deploymentModel');
        // An extension default is not an explicit customer hosting decision.
        const configuredTarget =
            inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
        const shouldReconsider = (question: PlanningQuestion) =>
            reconsider && (question.id !== DEPLOYMENT_QUESTION.id || questions.length === 0);
        const toResolve = [hostingQuestion, ...questions].filter((question) => {
            const existing = originalDecisions.get(question.id);
            const configurationChanged =
                question.id === DEPLOYMENT_QUESTION.id &&
                existing?.source === 'configuration' &&
                configuredTarget !== existing.selectedOptionId;
            return (
                pending.has(question.id) ||
                shouldReconsider(question) ||
                configurationChanged ||
                !existing ||
                (question.answerFromUser !== undefined &&
                    question.answerFromUser !== existing.selectedOptionId) ||
                existing.whyItMatters !== question.whyItMatters ||
                !question.options.some(
                    (option) =>
                        option.id === existing.selectedOptionId &&
                        existing.options.some(
                            (old) =>
                                old.id === option.id &&
                                old.label === option.label &&
                                old.description === option.description
                        )
                )
            );
        });
        const persist = () => {
            preferences.pendingQuestions = [...pending.values()];
            preferences.updatedAt = new Date().toISOString();
            files.storePreferences(preferences);
        };
        PlanningDecisionService.resolving.add(flowId);
        try {
            preferences.status = 'pending';
            // Invalidate every affected answer before opening a prompt, including later questions.
            for (const question of toResolve) {
                pending.set(question.id, question);
                preferences.decisions = preferences.decisions.filter(
                    (decision) => decision.id !== question.id
                );
            }
            if (toResolve.length > 0) {
                preferences.revision = randomUUID();
            }
            persist();
            for (const question of toResolve) {
                if (token.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }
                const existing = originalDecisions.get(question.id);
                let selectedOptionId = question.answerFromUser;
                let source: PlanningDecision['source'] = selectedOptionId ? 'user-request' : 'user';
                if (
                    !selectedOptionId &&
                    question.id === DEPLOYMENT_QUESTION.id &&
                    !shouldReconsider(question) &&
                    (!existing || existing.source === 'configuration')
                ) {
                    selectedOptionId = configuredTarget;
                    if (
                        selectedOptionId &&
                        !question.options.some((option) => option.id === selectedOptionId)
                    ) {
                        throw new Error('The configured deployment model is not supported.');
                    }
                    source = 'configuration';
                }
                if (!selectedOptionId) {
                    const choices = question.options.map((option) => ({
                        label: option.label,
                        description:
                            option.id === question.recommendedOptionId ? 'Recommended' : undefined,
                        detail: option.description,
                        optionId: option.id,
                    }));
                    const selection = await vscode.window.showQuickPick(
                        choices,
                        {
                            title: UserPrompts.planningChoiceTitle(flowId),
                            placeHolder: `${question.question} ${question.whyItMatters}`,
                            ignoreFocusOut: true,
                        },
                        token
                    );
                    if (!selection || token.isCancellationRequested) {
                        throw new vscode.CancellationError();
                    }
                    selectedOptionId = selection.optionId;
                    source = 'user';
                }
                const hostChanged =
                    question.id === DEPLOYMENT_QUESTION.id &&
                    existing?.selectedOptionId !== selectedOptionId;
                if (hostChanged) {
                    // Keep unresolved choices visible, but do not reuse options validated for another host.
                    for (const decision of originalDecisions.values()) {
                        if (decision.id !== DEPLOYMENT_QUESTION.id && !pending.has(decision.id)) {
                            pending.set(decision.id, {
                                id: decision.id,
                                question: decision.question,
                                whyItMatters: decision.whyItMatters,
                                options: decision.options,
                                ...(decision.recommendedOptionId
                                    ? { recommendedOptionId: decision.recommendedOptionId }
                                    : {}),
                            });
                        }
                    }
                    preferences.decisions = preferences.decisions.filter(
                        (decision) => decision.id === DEPLOYMENT_QUESTION.id
                    );
                }
                preferences.decisions = preferences.decisions.filter(
                    (decision) => decision.id !== question.id
                );
                preferences.decisions.push({
                    ...question,
                    selectedOptionId,
                    source,
                    decidedAt: new Date().toISOString(),
                });
                pending.delete(question.id);
                preferences.revision = randomUUID();
                persist();
                if (hostChanged && pending.size > 0) {
                    return preferences;
                }
            }
            preferences.status = pending.size === 0 ? 'ready' : 'pending';
            persist();
            return preferences;
        } finally {
            PlanningDecisionService.resolving.delete(flowId);
        }
    }
}
