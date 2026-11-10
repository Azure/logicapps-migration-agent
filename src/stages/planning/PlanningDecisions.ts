export interface PlanningChoice {
    id: string;
    label: string;
    description: string;
}

export interface PlanningQuestion {
    id: string;
    question: string;
    whyItMatters: string;
    options: PlanningChoice[];
    recommendedOptionId?: string;
    /** Only an explicit answer already supplied in the user's request, never an inferred default. */
    answerFromUser?: string;
}

export interface PlanningDecision extends PlanningQuestion {
    selectedOptionId: string;
    source: 'user' | 'user-request' | 'configuration';
    decidedAt: string;
}

export interface PlanningPreferences {
    flowId: string;
    revision: string;
    status: 'pending' | 'ready';
    decisions: PlanningDecision[];
    pendingQuestions?: PlanningQuestion[];
    updatedAt: string;
}

export interface ModernizationOpportunity {
    component: string;
    currentApproach: string;
    proposedApproach: string;
    disposition: 'applied' | 'retained' | 'deferred';
    reason: string;
    evidence: string;
}

export interface PlanningBrief {
    scenarioName: string;
    estimatedTimeline: string;
    assumptions: string[];
    tradeoffs: string[];
    opportunities: ModernizationOpportunity[];
}

export const DEPLOYMENT_QUESTION: PlanningQuestion = {
    id: 'deployment-target',
    question: 'Where will these workflows run?',
    whyItMatters:
        'Hosting affects connector availability, authentication, networking, and deployment.',
    options: [
        {
            id: 'workflow-service-plan',
            label: 'Azure-hosted Standard',
            description: 'Workflow Service Plan; Azure hosts the workflow runtime.',
        },
        {
            id: 'hybrid',
            label: 'Standard hybrid',
            description:
                'Your infrastructure via Azure Arc; verify connector and identity support.',
        },
        {
            id: 'ase-v3',
            label: 'App Service Environment v3',
            description: 'Isolated Azure hosting; requires an existing or planned ASE.',
        },
    ],
};

export function validatePlanningQuestion(value: unknown): asserts value is PlanningQuestion {
    if (
        !isRecord(value) ||
        !hasText(value.id) ||
        !hasText(value.question) ||
        !hasText(value.whyItMatters) ||
        !Array.isArray(value.options) ||
        value.options.length < 2 ||
        value.options.length > 4
    ) {
        throw new Error('Each planning question needs an id, question, reason, and 2-4 choices.');
    }
    const ids = new Set<string>();
    for (const option of value.options) {
        if (
            !isRecord(option) ||
            !hasText(option.id) ||
            !hasText(option.label) ||
            !hasText(option.description) ||
            ids.has(option.id)
        ) {
            throw new Error(
                'Planning choices need unique ids, labels, and short tradeoff descriptions.'
            );
        }
        ids.add(option.id);
    }
    if (
        value.recommendedOptionId !== undefined &&
        (typeof value.recommendedOptionId !== 'string' || !ids.has(value.recommendedOptionId))
    ) {
        throw new Error('The recommended choice must be one of the offered options.');
    }
    if (
        value.answerFromUser !== undefined &&
        (typeof value.answerFromUser !== 'string' || !ids.has(value.answerFromUser))
    ) {
        throw new Error('The explicit user answer must match one of the offered choices.');
    }
}

export function validatePlanningPreferences(value: unknown): asserts value is PlanningPreferences {
    if (
        !isRecord(value) ||
        !hasText(value.flowId) ||
        !hasText(value.revision) ||
        !['pending', 'ready'].includes(String(value.status)) ||
        !hasText(value.updatedAt) ||
        !Array.isArray(value.decisions)
    ) {
        throw new Error('Invalid saved planning preferences.');
    }
    const ids = new Set<string>();
    for (const decision of value.decisions) {
        validatePlanningQuestion(decision);
        if (
            !isRecord(decision) ||
            ids.has(decision.id) ||
            !decision.options.some((option) => option.id === decision.selectedOptionId) ||
            !['user', 'user-request', 'configuration'].includes(String(decision.source)) ||
            !hasText(decision.decidedAt)
        ) {
            throw new Error('Invalid saved planning decision.');
        }
        ids.add(decision.id);
    }
    if (value.pendingQuestions !== undefined && !Array.isArray(value.pendingQuestions)) {
        throw new Error('Invalid pending planning questions.');
    }
    for (const question of value.pendingQuestions ?? []) {
        validatePlanningQuestion(question);
        if (ids.has(question.id)) {
            throw new Error('A planning question cannot be both answered and pending.');
        }
        ids.add(question.id);
    }
    if (value.status === 'ready' && value.pendingQuestions?.length) {
        throw new Error('Resolve all pending planning questions before generating a plan.');
    }
    const target = value.decisions.find(
        (decision: PlanningDecision) => decision.id === DEPLOYMENT_QUESTION.id
    );
    if (
        value.status === 'ready' &&
        (!target ||
            !DEPLOYMENT_QUESTION.options.some((option) => option.id === target.selectedOptionId))
    ) {
        throw new Error('Select a supported deployment target before generating a plan.');
    }
}

export function validatePlanningBrief(value: unknown): asserts value is PlanningBrief {
    if (
        !isRecord(value) ||
        !hasText(value.scenarioName) ||
        !hasText(value.estimatedTimeline) ||
        !isStringArray(value.assumptions) ||
        !isStringArray(value.tradeoffs) ||
        !Array.isArray(value.opportunities)
    ) {
        throw new Error(
            'The planning brief needs a scenario name, timeline, assumptions, tradeoffs, and opportunities.'
        );
    }
    for (const opportunity of value.opportunities) {
        if (
            !isRecord(opportunity) ||
            !['component', 'currentApproach', 'proposedApproach', 'reason', 'evidence'].every(
                (key) => hasText(opportunity[key])
            ) ||
            !['applied', 'retained', 'deferred'].includes(String(opportunity.disposition))
        ) {
            throw new Error(
                'Each modernization opportunity needs source evidence, a disposition, and a rationale.'
            );
        }
    }
}

export function selectedChoiceLabel(decision: PlanningDecision): string {
    return (
        decision.options.find((option) => option.id === decision.selectedOptionId)?.label ??
        decision.selectedOptionId
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(hasText);
}
