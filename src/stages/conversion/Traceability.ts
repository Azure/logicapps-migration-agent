/**
 * Conversion Traceability
 *
 * Links source artifacts to the conversion tasks that implement them and the files those
 * tasks generated, so users can see which generated code belongs to which source artifact.
 *
 * @module stages/conversion/Traceability
 */

import * as path from 'path';
import type { ConversionTaskPlan } from './types';

/** Name, type and location of a source artifact. */
export interface TraceableArtifact {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly sourcePath?: string;
}

/** Artifact types that are converted into Logic Apps, function or test assets. */
const CONVERTIBLE_TYPES: ReadonlySet<string> = new Set([
    'orchestration',
    'flow',
    'process',
    'workflow',
    'map',
    'schema',
    'pipeline',
    'custom-code',
    'dataweave',
    'esql',
    'policy',
    'ruleset',
]);
const PROJECT_EXTENSIONS: ReadonlySet<string> = new Set(['.btproj', '.csproj', '.vbproj', '.sln']);

/** Folder name used for a flow's generated project under `out/`. */
export function toOutputProjectName(flowName: string): string {
    return flowName
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function isConvertible(artifact: TraceableArtifact): boolean {
    return (
        CONVERTIBLE_TYPES.has(artifact.type) &&
        !PROJECT_EXTENSIONS.has(path.extname(artifact.sourcePath ?? '').toLowerCase())
    );
}

export interface TaskArtifactCheck {
    /** Task artifact references rewritten to artifact IDs (names resolved when unambiguous). */
    readonly tasks: { id: string; artifactIds?: string[] }[];
    /** References that match no artifact ID or unique artifact name. */
    readonly unknownReferences: { taskId: string; reference: string }[];
    /** Convertible flow artifacts that no task lists. */
    readonly uncoveredArtifacts: TraceableArtifact[];
}

/**
 * Resolve the artifacts each task implements and find flow artifacts no task covers.
 */
export function checkTaskArtifacts(
    tasks: readonly { id: string; artifactIds?: readonly string[] }[],
    flowArtifacts: readonly TraceableArtifact[],
    allArtifacts: readonly TraceableArtifact[]
): TaskArtifactCheck {
    const ids = new Set(allArtifacts.map((artifact) => artifact.id));
    const byName = new Map<string, TraceableArtifact[]>();
    for (const artifact of [...flowArtifacts, ...allArtifacts]) {
        const key = artifact.name.toLowerCase();
        const list = byName.get(key) ?? [];
        if (!list.some((existing) => existing.id === artifact.id)) {
            list.push(artifact);
        }
        byName.set(key, list);
    }
    const flowIds = new Set(flowArtifacts.map((artifact) => artifact.id));

    const unknownReferences: { taskId: string; reference: string }[] = [];
    const resolvedTasks = tasks.map((task) => {
        if (!task.artifactIds) {
            return { id: task.id };
        }
        const resolved: string[] = [];
        for (const reference of task.artifactIds) {
            if (ids.has(reference)) {
                resolved.push(reference);
                continue;
            }
            const matches = byName.get(reference.toLowerCase()) ?? [];
            const inFlow = matches.filter((artifact) => flowIds.has(artifact.id));
            const match =
                inFlow.length === 1 ? inFlow[0] : matches.length === 1 ? matches[0] : undefined;
            if (match) {
                resolved.push(match.id);
            } else {
                unknownReferences.push({ taskId: task.id, reference });
            }
        }
        return { id: task.id, artifactIds: [...new Set(resolved)] };
    });

    const covered = new Set(resolvedTasks.flatMap((task) => task.artifactIds ?? []));
    const uncoveredArtifacts = flowArtifacts.filter(
        (artifact) => isConvertible(artifact) && !covered.has(artifact.id)
    );
    return { tasks: resolvedTasks, unknownReferences, uncoveredArtifacts };
}

function cell(value: string | undefined): string {
    return (
        (value ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>') || '—'
    );
}

/**
 * Markdown traceability matrix: source artifact → tasks → generated files.
 */
export function renderTraceabilityMarkdown(
    plan: ConversionTaskPlan,
    lookup: (artifactId: string) => TraceableArtifact | undefined
): string {
    const tasks = [...plan.tasks].sort((a, b) => a.order - b.order);
    const tasksByArtifact = new Map<string, typeof tasks>();
    for (const task of tasks) {
        for (const artifactId of task.artifactIds ?? []) {
            tasksByArtifact.set(artifactId, [...(tasksByArtifact.get(artifactId) ?? []), task]);
        }
    }
    const artifactLabel = (id: string) => lookup(id)?.name ?? id;

    const lines = [
        `# Traceability — ${plan.flowName}`,
        '',
        'Which conversion task implements each source artifact, and which files it generated.',
        '',
        '## Source artifacts',
        '',
        '| Source artifact | Type | Source path | Tasks | Generated files |',
        '| --- | --- | --- | --- | --- |',
    ];
    const artifactIds = [...tasksByArtifact.keys()].sort((a, b) =>
        artifactLabel(a).localeCompare(artifactLabel(b))
    );
    for (const id of artifactIds) {
        const artifact = lookup(id);
        const artifactTasks = tasksByArtifact.get(id) ?? [];
        const files = [
            ...new Set(artifactTasks.flatMap((task) => task.output?.generatedFiles ?? [])),
        ];
        lines.push(
            `| ${cell(artifact?.name ?? id)} | ${cell(artifact?.type)} | ${cell(artifact?.sourcePath)} | ${cell(artifactTasks.map((task) => `${task.order}. ${task.name}`).join('<br>'))} | ${cell(files.join('<br>'))} |`
        );
    }

    lines.push(
        '',
        '## Tasks',
        '',
        '| # | Task | Status | Source artifacts | Generated files |',
        '| --- | --- | --- | --- | --- |'
    );
    for (const task of tasks) {
        lines.push(
            `| ${task.order} | ${cell(task.name)} | ${cell(task.status)} | ${cell((task.artifactIds ?? []).map(artifactLabel).join(', '))} | ${cell((task.output?.generatedFiles ?? []).join('<br>'))} |`
        );
    }
    return `${lines.join('\n')}\n`;
}
