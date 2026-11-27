/**
 * Planning Requirements Markdown
 *
 * Renders a finalized migration plan as a `requirements.md` document that
 * skill-based build pipelines can consume. Pure and deterministic: no VS Code
 * or file-system access, so the same plan always yields the same Markdown.
 */

import type {
    FlowPlanningResult,
    PlannedWorkflow,
} from '../../stages/planning/PlanningCacheService';
import {
    PlanningBrief,
    PlanningDecision,
    selectedChoiceLabel,
} from '../../stages/planning/PlanningDecisions';

type ArtifactDisposition = NonNullable<FlowPlanningResult['artifactDispositions']>[number];

const DESTINATIONS: Readonly<Record<string, { label: string; phrase: string }>> = {
    'integration-account': { label: 'Integration Account', phrase: 'the Integration Account' },
    'logic-app-artifact-folder': {
        label: 'Logic App artifact folder',
        phrase: 'the Logic App artifact folder',
    },
    'azure-function': { label: 'Azure Function', phrase: 'an Azure Function' },
    'not-applicable': { label: 'Not applicable', phrase: '' },
};

/**
 * Render a finalized plan as `requirements.md`. Sections without content are
 * omitted, and the acceptance criteria are derived only from plan content.
 */
export function renderPlanningRequirementsMarkdown(plan: FlowPlanningResult): string {
    const workflows = items(plan.workflows);
    const title = inline(plan.flowName) || inline(plan.flowId) || 'Migration plan';
    const criteria = acceptanceCriteria(plan);

    const blocks = [
        `# ${heading(`${title} — Migration Requirements`)}`,
        '> Exported from the finalized Logic Apps migration plan.',
        bullets([
            labelled('Flow ID', code(plan.flowId)),
            labelled('Plan version', code(plan.planId) || 'Legacy'),
            labelled('Plan generated', inline(plan.generatedAt)),
        ]),
        ...section('Summary', [text(plan.summary), text(plan.explanation)]),
        ...section('Planning Decisions', [
            table(
                ['Decision', 'Selected option', 'Source', 'Why it matters'],
                items(plan.preferences?.decisions).map((decision) => [
                    decision.question,
                    selectedOption(decision),
                    decision.source,
                    decision.whyItMatters,
                ])
            ),
        ]),
        ...section('Planning Brief', briefBlocks(plan.brief)),
        ...section('Modernization Opportunities', [
            table(
                [
                    'Component',
                    'Current approach',
                    'Proposed approach',
                    'Disposition',
                    'Reason',
                    'Evidence',
                ],
                items(plan.brief?.opportunities).map((opportunity) => [
                    opportunity.component,
                    opportunity.currentApproach,
                    opportunity.proposedApproach,
                    opportunity.disposition,
                    opportunity.reason,
                    opportunity.evidence,
                ])
            ),
        ]),
        ...section('Target Architecture', [fenced('mermaid', plan.mermaid)]),
        ...section(
            'Planned Workflows',
            workflows.length > 0
                ? [
                      `The migration produces ${count(workflows.length, 'Logic Apps Standard workflow')}.`,
                      ...workflows.flatMap(workflowBlocks),
                  ]
                : []
        ),
        ...section('Connector Mappings', [
            table(
                ['Source connector', 'Target connector', 'Native', 'Notes'],
                items(plan.connectorMappings).map((mapping) => [
                    mapping.source,
                    mapping.target,
                    yesNo(mapping.isNative),
                    mapping.notes,
                ])
            ),
        ]),
        ...section('Action Mappings', [
            table(
                ['Workflow', 'Source action', 'Target action', 'Notes'],
                items(plan.actionMappings).map((mapping) => [
                    mapping.workflowName,
                    mapping.source,
                    mapping.target,
                    mapping.notes,
                ])
            ),
        ]),
        ...section('Artifact Dispositions', [
            table(
                ['Artifact', 'Type', 'Conversion', 'Destination', 'Upload path', 'Notes'],
                items(plan.artifactDispositions).map((disposition) => [
                    disposition.artifactName,
                    disposition.artifactType,
                    conversionCell(disposition),
                    DESTINATIONS[disposition.uploadDestination]?.label ??
                        disposition.uploadDestination,
                    disposition.uploadPath,
                    [text(disposition.conversionNotes), text(disposition.uploadNotes)]
                        .filter(Boolean)
                        .join('\n'),
                ])
            ),
        ]),
        ...section('Required Azure Components', [
            table(
                ['Component', 'Type', 'Reason', 'Configuration notes'],
                items(plan.azureComponents).map((component) => [
                    component.name,
                    component.type,
                    component.reason,
                    component.configNotes,
                ])
            ),
        ]),
        ...section('Gap Analysis', [
            table(
                ['Component', 'Gap', 'Severity', 'Recommendation'],
                items(plan.gaps).map((gap) => [
                    gap.component,
                    gap.gap,
                    gap.severity,
                    gap.recommendation,
                ])
            ),
        ]),
        ...section('Integration Patterns', [
            table(
                ['Pattern', 'Complexity', 'Source approach', 'Logic Apps approach'],
                items(plan.patterns).map((pattern) => [
                    pattern.name,
                    pattern.complexity,
                    pattern.sourceApproach,
                    pattern.logicAppsApproach,
                ])
            ),
        ]),
        ...section('Effort Estimate', effortBlocks(plan.effortEstimate)),
        ...section(
            'Acceptance Criteria',
            criteria.length > 0
                ? ['Each criterion is derived from the plan content above.', checklist(criteria)]
                : []
        ),
    ];

    return `${blocks.filter((block) => block.length > 0).join('\n\n')}\n`;
}

// ─── Section builders ───

function briefBlocks(brief: PlanningBrief | undefined): string[] {
    if (!brief) {
        return [];
    }
    return [
        bullets([
            labelled('Scenario', inline(brief.scenarioName)),
            labelled('Indicative timeline', inline(brief.estimatedTimeline)),
        ]),
        ...section('Assumptions', [bullets(items(brief.assumptions).map(inline))], 3),
        ...section('Tradeoffs', [bullets(items(brief.tradeoffs).map(inline))], 3),
    ];
}

function workflowBlocks(workflow: PlannedWorkflow, index: number): string[] {
    const actions = items(workflow.actions).map(inline).filter(Boolean);
    const sources = items(workflow.sourceArtifactIds).map(code).filter(Boolean);
    const diagram = fenced('mermaid', workflow.mermaid);
    return [
        `### ${heading(workflowName(workflow, index))}`,
        text(workflow.description),
        bullets([
            labelled('Trigger', inline(workflow.triggerType)),
            labelled('Source artifacts', sources.join(', ')),
        ]),
        actions.length > 0 ? `**Actions:**\n\n${numbered(actions)}` : '',
        diagram ? `**Workflow diagram:**\n\n${diagram}` : '',
    ];
}

function effortBlocks(estimate: FlowPlanningResult['effortEstimate']): string[] {
    if (!estimate) {
        return [];
    }
    const breakdown = estimate.breakdown;
    const phases: [string, unknown][] = breakdown
        ? [
              ['Analysis', breakdown.analysis],
              ['Conversion', breakdown.conversion],
              ['Testing', breakdown.testing],
              ['Deployment', breakdown.deployment],
          ]
        : [];
    return [
        bullets([
            labelled('Total estimated hours', text(estimate.totalHours)),
            labelled('Confidence', inline(estimate.confidence)),
        ]),
        table(
            ['Phase', 'Hours'],
            phases.filter(([, hours]) => text(hours))
        ),
    ];
}

function acceptanceCriteria(plan: FlowPlanningResult): string[] {
    const criteria: string[] = [];

    for (const decision of items(plan.preferences?.decisions)) {
        const question = inline(decision.question);
        const choice = inline(selectedChoiceLabel(decision));
        if (question && choice) {
            criteria.push(`Implements the selected option for "${question}": ${choice}.`);
        }
    }

    items(plan.workflows).forEach((workflow, index) => {
        const trigger = inline(workflow.triggerType);
        const actionCount = items(workflow.actions).map(inline).filter(Boolean).length;
        const sources = items(workflow.sourceArtifactIds).map(code).filter(Boolean);
        const clauses: string[] = [];
        if (trigger) {
            clauses.push(`is triggered by "${trigger}"`);
        }
        if (actionCount > 0) {
            clauses.push(`implements its ${count(actionCount, 'planned action')}`);
        }
        if (sources.length > 0) {
            clauses.push(
                `covers source ${sources.length === 1 ? 'artifact' : 'artifacts'} ${sources.join(', ')}`
            );
        }
        criteria.push(
            `Workflow ${code(workflowName(workflow, index))} ${
                clauses.length > 0 ? sentenceList(clauses) : 'is implemented as planned'
            }.`
        );
    });

    if (items(plan.connectorMappings).length > 0) {
        criteria.push(
            'Each source connector listed in Connector Mappings is replaced by its target connector.'
        );
    }
    if (items(plan.actionMappings).length > 0) {
        criteria.push(
            'Each source action listed in Action Mappings is implemented with its target action.'
        );
    }

    for (const opportunity of items(plan.brief?.opportunities)) {
        const component = inline(opportunity.component);
        const proposed = inline(opportunity.proposedApproach);
        const current = inline(opportunity.currentApproach);
        if (component && opportunity.disposition === 'applied' && proposed) {
            criteria.push(`${component} applies the planned modernization: ${proposed}.`);
        } else if (component && opportunity.disposition === 'retained' && current) {
            criteria.push(`${component} retains its current approach: ${current}.`);
        }
    }

    const components = items(plan.azureComponents)
        .map((component) => inline(component.name))
        .filter(Boolean);
    if (components.length > 0) {
        criteria.push(
            `Required Azure components are available to the workflows: ${components.join(', ')}.`
        );
    }

    for (const disposition of items(plan.artifactDispositions)) {
        const criterion = dispositionCriterion(disposition);
        if (criterion) {
            criteria.push(criterion);
        }
    }

    for (const gap of items(plan.gaps)) {
        const severity = inline(gap.severity);
        const subject = `Gap in ${inline(gap.component) || 'an unnamed component'}${
            severity ? ` (${severity} severity)` : ''
        }`;
        const recommendation = inline(gap.recommendation);
        const description = inline(gap.gap);
        if (recommendation) {
            criteria.push(
                `${subject}: the recommendation "${recommendation}" is implemented or tracked as an open item.`
            );
        } else if (description) {
            criteria.push(`${subject}: "${description}" is resolved or tracked as an open item.`);
        }
    }

    return criteria;
}

function dispositionCriterion(disposition: ArtifactDisposition): string {
    const name = code(disposition.artifactName);
    if (!name) {
        return '';
    }
    const clauses: string[] = [];
    if (disposition.conversionRequired) {
        const range = conversionRange(disposition);
        clauses.push(range ? `converted ${range}` : 'converted');
    }
    const destination =
        DESTINATIONS[disposition.uploadDestination]?.phrase ??
        inline(disposition.uploadDestination);
    if (destination) {
        const uploadPath = code(disposition.uploadPath);
        clauses.push(`delivered to ${destination}${uploadPath ? ` at ${uploadPath}` : ''}`);
    }
    if (clauses.length === 0) {
        return '';
    }
    const type = inline(disposition.artifactType);
    return `${name}${type ? ` (${type})` : ''} is ${clauses.join(' and ')}.`;
}

function conversionCell(disposition: ArtifactDisposition): string {
    if (!disposition.conversionRequired) {
        return 'Not required';
    }
    const from = inline(disposition.conversionFrom);
    const to = inline(disposition.conversionTo);
    return from && to ? `${from} → ${to}` : `Required ${conversionRange(disposition)}`.trim();
}

function conversionRange(disposition: ArtifactDisposition): string {
    const from = inline(disposition.conversionFrom);
    const to = inline(disposition.conversionTo);
    return [from && `from ${from}`, to && `to ${to}`].filter(Boolean).join(' ');
}

function selectedOption(decision: PlanningDecision): string {
    const option = decision.options.find((choice) => choice.id === decision.selectedOptionId);
    return [selectedChoiceLabel(decision), option?.description]
        .map(inline)
        .filter(Boolean)
        .join(' — ');
}

function workflowName(workflow: PlannedWorkflow, index: number): string {
    return inline(workflow.name) || `Workflow ${index + 1}`;
}

// ─── Markdown primitives ───

function section(title: string, blocks: readonly string[], level = 2): string[] {
    const content = blocks.filter((block) => block.length > 0);
    return content.length > 0 ? [`${'#'.repeat(level)} ${title}`, ...content] : [];
}

function table(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
    if (rows.length === 0) {
        return '';
    }
    return [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
    ].join('\n');
}

/** Table cell: escape pipes (and a backslash that precedes one) and keep line breaks as `<br>`. */
function cell(value: unknown): string {
    const content = text(value)
        .split('\n')
        .map((line) => line.trim())
        .join('<br>')
        .replace(/\\(?=\|)/g, '\\\\')
        .replace(/\|/g, '\\|');
    return content || '—';
}

function bullets(lines: readonly string[]): string {
    return lines
        .filter((line) => line.length > 0)
        .map((line) => `- ${line}`)
        .join('\n');
}

function numbered(lines: readonly string[]): string {
    return lines
        .filter((line) => line.length > 0)
        .map((line, index) => `${index + 1}. ${line}`)
        .join('\n');
}

function checklist(lines: readonly string[]): string {
    return lines
        .filter((line) => line.length > 0)
        .map((line) => `- [ ] ${line}`)
        .join('\n');
}

function labelled(label: string, value: string): string {
    return value ? `**${label}:** ${value}` : '';
}

/** Single-line heading text; a trailing `#` run is escaped so it is not read as a closing sequence. */
function heading(value: string): string {
    return inline(value).replace(/(^|\s)(#+)$/, '$1\\$2');
}

/** Inline code span whose fence is longer than any backtick run in the value. */
function code(value: unknown): string {
    const content = inline(value);
    if (!content) {
        return '';
    }
    const fence = '`'.repeat(longestBacktickRun(content) + 1);
    const padding = content.startsWith('`') || content.endsWith('`') ? ' ' : '';
    return `${fence}${padding}${content}${padding}${fence}`;
}

function fenced(language: string, value: unknown): string {
    const body = text(value);
    if (!body) {
        return '';
    }
    const fence = '`'.repeat(Math.max(3, longestBacktickRun(body) + 1));
    return `${fence}${language}\n${body}\n${fence}`;
}

function longestBacktickRun(value: string): number {
    return Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
}

function sentenceList(parts: readonly string[]): string {
    return parts.length <= 2
        ? parts.join(' and ')
        : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function count(amount: number, noun: string): string {
    return `${amount} ${noun}${amount === 1 ? '' : 's'}`;
}

function yesNo(value: unknown): string {
    return value === true ? 'Yes' : value === false ? 'No' : '';
}

// ─── Value normalization (plans are LLM-authored JSON; never print `undefined`) ───

function items<T>(value: readonly T[] | undefined): readonly T[] {
    return Array.isArray(value) ? value : [];
}

/** Trimmed text with normalized line endings; empty for missing or non-scalar values. */
function text(value: unknown): string {
    if (typeof value === 'string') {
        return value.replace(/\r\n?/g, '\n').trim();
    }
    if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}

/** Text collapsed onto a single line. */
function inline(value: unknown): string {
    return text(value).replace(/\s+/g, ' ');
}
