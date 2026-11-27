/**
 * Flow Group Inventory
 *
 * Text shown on Home flow cards and the exportable Markdown inventory that maps every
 * logical group to its entry points, orchestrations, exit points and artifacts.
 *
 * @module stages/discovery/FlowGroupInventory
 */

import type { FlowGroup, FlowGroupsResult } from '../../services/LLMFlowGenerator';

/** Name, type and location of an inventory artifact. */
export interface InventoryArtifactInfo {
    readonly name: string;
    readonly type: string;
    readonly sourcePath?: string;
}

export type ArtifactLookup = (artifactId: string) => InventoryArtifactInfo | undefined;

const PROCESS_TYPES: ReadonlySet<string> = new Set([
    'orchestration',
    'flow',
    'process',
    'workflow',
]);

/** Receive → process → send summary of one flow, for display. */
export interface FlowRoute {
    readonly entry?: string;
    readonly additionalEntries: number;
    readonly processes: string[];
    readonly exits: string[];
}

function byName(a: string, b: string): number {
    return a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b);
}

export function describeFlowRoute(group: FlowGroup, lookup: ArtifactLookup): FlowRoute {
    const processes = group.artifactIds
        .map((id) => lookup(id))
        .filter((info): info is InventoryArtifactInfo => !!info && PROCESS_TYPES.has(info.type))
        .map((info) => info.name)
        .sort(byName);
    const entry =
        group.entryPoint && !PROCESS_TYPES.has(group.entryPoint.type)
            ? group.entryPoint.name
            : undefined;
    return {
        entry,
        additionalEntries: entry ? Math.max(0, (group.summary?.receivePorts ?? 1) - 1) : 0,
        processes,
        exits: (group.exitPoints ?? []).map((exit) => exit.name),
    };
}

/** "RL_A (+2 more)" style label for the entry of a flow. */
export function entryLabel(route: FlowRoute): string {
    if (!route.entry) {
        return '';
    }
    return route.additionalEntries > 0
        ? `${route.entry} (+${route.additionalEntries} more)`
        : route.entry;
}

/** Lower-case text a Home search box matches against. */
export function flowSearchText(group: FlowGroup, lookup: ArtifactLookup): string {
    const artifacts = group.artifactIds.map((id) => lookup(id)?.name ?? '');
    return [
        group.id,
        group.name,
        group.description,
        group.category,
        group.entryPoint?.name ?? '',
        ...(group.exitPoints ?? []).map((exit) => exit.name),
        ...(group.endpointNames ?? []),
        ...artifacts,
    ]
        .join(' ')
        .toLowerCase();
}

function cell(value: string | undefined): string {
    return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>') || '—';
}

/** Markdown inventory of all logical groups, shared and ungrouped artifacts. */
export function renderFlowGroupInventoryMarkdown(
    result: FlowGroupsResult,
    lookup: ArtifactLookup
): string {
    const shared = new Set(result.sharedArtifactIds ?? []);
    const usedBy = new Map<string, string[]>();
    for (const group of result.groups) {
        for (const id of group.artifactIds) {
            usedBy.set(id, [...(usedBy.get(id) ?? []), group.name]);
        }
    }
    const artifactRow = (id: string, extra: string[] = []) => {
        const info = lookup(id);
        return `| ${[info?.name ?? id, info?.type, info?.sourcePath, ...extra].map(cell).join(' | ')} |`;
    };

    const lines: string[] = [
        '# Logical Group Inventory',
        '',
        `${result.groups.length} flow(s), ${shared.size} shared artifact(s), ${result.ungroupedArtifactIds.length} ungrouped artifact(s).` +
            (result.detectionMode ? ` Detection: ${result.detectionMode}.` : ''),
    ];
    if (result.explanation) {
        lines.push('', `> ${result.explanation.replace(/\r?\n/g, ' ')}`);
    }

    if (result.missingProjects && result.missingProjects.length > 0) {
        lines.push(
            '',
            '## Missing Referenced Projects',
            '',
            'Add these projects to the source folder and rescan so flows include their schemas and code.',
            '',
            '| Project | Referenced by | Path |',
            '| --- | --- | --- |',
            ...result.missingProjects.map(
                (missing) =>
                    `| ${cell(missing.project)} | ${cell(missing.referencedBy.join(', '))} | ${cell(missing.path)} |`
            )
        );
    }

    lines.push(
        '',
        '## Flows',
        '',
        '| Flow | ID | Entry | Orchestrations / flows | Exits | Artifacts |',
        '| --- | --- | --- | --- | --- | --- |'
    );
    for (const group of result.groups) {
        const route = describeFlowRoute(group, lookup);
        lines.push(
            `| ${cell(group.name)} | \`${group.id}\` | ${cell(entryLabel(route))} | ${cell(route.processes.join(', '))} | ${cell(route.exits.join(', '))} | ${group.artifactIds.length} |`
        );
    }

    for (const group of result.groups) {
        lines.push('', `### ${group.name} (\`${group.id}\`)`, '');
        if (group.description) {
            lines.push(group.description, '');
        }
        if (group.endpointNames && group.endpointNames.length > 0) {
            lines.push(`Ports: ${group.endpointNames.join(', ')}`, '');
        }
        lines.push('| Artifact | Type | Path | Shared |', '| --- | --- | --- | --- |');
        const ids = [...group.artifactIds].sort(
            (a, b) =>
                byName(lookup(a)?.type ?? '', lookup(b)?.type ?? '') ||
                byName(lookup(a)?.name ?? a, lookup(b)?.name ?? b)
        );
        for (const id of ids) {
            lines.push(artifactRow(id, [shared.has(id) ? 'yes' : '']));
        }
    }

    if (shared.size > 0) {
        lines.push(
            '',
            '## Shared Artifacts',
            '',
            '| Artifact | Type | Path | Used by |',
            '| --- | --- | --- | --- |',
            ...[...shared].map((id) => artifactRow(id, [(usedBy.get(id) ?? []).join(', ')]))
        );
    }

    if (result.ungroupedArtifactIds.length > 0) {
        lines.push(
            '',
            '## Ungrouped Artifacts',
            '',
            'Not referenced by any flow.',
            '',
            '| Artifact | Type | Path |',
            '| --- | --- | --- |',
            ...result.ungroupedArtifactIds.map((id) => artifactRow(id))
        );
    }

    return `${lines.join('\n')}\n`;
}
