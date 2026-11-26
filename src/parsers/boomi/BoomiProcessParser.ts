/**
 * Dell Boomi Process Parser
 *
 * Parses Boomi process components (native AtomSphere component XML or the
 * simplified synthetic Boomi XML) into IR documents. Shapes are converted to
 * IR actions with run-after dependencies derived from dragpoints (or
 * declaration order), sub-process calls become `call-workflow` actions, and
 * connector operations are resolved to the connections they use so that
 * discovery can group related processes.
 *
 * @module parsers/boomi/BoomiProcessParser
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { AbstractParser, ParseErrorAccumulator } from '../AbstractParser';
import { IArtifactParser, ArtifactSummary } from '../IParser';
import { ParseOptions, ParserCapabilities, ParseErrorCodes, ProgressCallback } from '../types';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';
import { IRAction } from '../../ir/types/actions';
import { IRTrigger } from '../../ir/types/triggers';
import { IRConnection } from '../../ir/types/connections';
import { IRGap } from '../../ir/types/advanced';
import { ComplexityLevel } from '../../ir/types/common';
import { DOMParser } from '@xmldom/xmldom';
import { parseXml } from '../utils/xml';
import {
    BoomiProjectIndex,
    classifyBoomiFile,
    getProjectIndex,
    readProcess,
} from './BoomiComponentReader';
import {
    BOOMI_SHAPE_MAPPINGS,
    BoomiConnectorMapping,
    mapConnector,
    mapShapeByName,
} from './BoomiMappings';
import { BoomiComponentRef, BoomiProcess, BoomiShape } from './types';
import { boomiConnectionToIr, sanitizeId } from './BoomiIrHelpers';

interface ResolvedShape {
    action?: Record<string, unknown>;
    trigger?: Record<string, unknown>;
    connection?: { ref: BoomiComponentRef; mapping: BoomiConnectorMapping };
    /** Additional connections used by the shape (e.g. one per trading partner channel) */
    extraConnections?: BoomiComponentRef[];
    gap?: Record<string, unknown>;
    subprocess?: string;
    map?: string;
    operation?: string;
}

/**
 * Parser for Boomi process components.
 */
export class BoomiProcessParser extends AbstractParser implements IArtifactParser {
    readonly capabilities: ParserCapabilities = {
        platform: 'boomi',
        fileExtensions: ['.xml'],
        fileTypes: ['flow'],
        supportsFolder: false,
        description:
            'Parses Dell Boomi process components into IR actions, triggers and connections',
    };

    override canParse(filePath: string): boolean {
        return classifyBoomiFile(filePath) === 'process';
    }

    protected async doParse(
        inputPath: string,
        options: Required<Omit<ParseOptions, 'onProgress' | 'cancellationToken' | 'basePath'>> & {
            onProgress?: ProgressCallback;
            cancellationToken?: vscode.CancellationToken;
            basePath: string;
        },
        errors: ParseErrorAccumulator
    ): Promise<IRDocument | null> {
        this.reportProgress(
            options.onProgress,
            1,
            3,
            `Reading Boomi process: ${path.basename(inputPath)}`
        );

        const content = await this.readFile(inputPath, errors);
        if (!content) {
            return null;
        }

        const doc = parseStrictXml(content);
        if (!doc || !doc.documentElement) {
            errors.addError(ParseErrorCodes.INVALID_XML, 'Boomi process file is not valid XML', {
                filePath: inputPath,
            });
            return null;
        }

        const process = readProcess(doc, inputPath);
        if (!process) {
            errors.addError(ParseErrorCodes.INVALID_FLOW, 'File is not a Boomi process component', {
                filePath: inputPath,
            });
            return null;
        }

        if (this.isCancelled(options.cancellationToken)) {
            errors.addError(ParseErrorCodes.CANCELLED, 'Parse operation was cancelled');
            return null;
        }

        this.reportProgress(options.onProgress, 2, 3, 'Resolving Boomi component references');
        const index = getProjectIndex(inputPath);

        this.reportProgress(options.onProgress, 3, 3, 'Converting Boomi process to IR');
        return this.toIr(inputPath, process, index);
    }

    override async getArtifactSummary(filePath: string): Promise<ArtifactSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
        const doc = content ? parseXml(content) : null;
        const process = doc ? readProcess(doc, filePath) : null;
        return {
            name: process?.name || path.basename(filePath, path.extname(filePath)),
            type: 'process',
            elementCount: process?.shapes.length,
            description: process
                ? `Boomi process with ${process.shapes.length} shape(s)`
                : 'Boomi process',
        };
    }

    // =========================================================================
    // IR conversion
    // =========================================================================

    private toIr(inputPath: string, process: BoomiProcess, index: BoomiProjectIndex): IRDocument {
        const ir = createEmptyIRDocument(`boomi-process-${process.name}`, process.name, 'boomi');
        const processKey = sanitizeId(process.name);

        const predecessors = new Map<string, string[]>();
        for (const shape of process.shapes) {
            for (const next of shape.next) {
                const list = predecessors.get(next) || [];
                list.push(shape.id);
                predecessors.set(next, list);
            }
        }
        const startIds = new Set(
            process.shapes.filter((s) => s.shapeType === 'start').map((s) => s.id)
        );
        // Synthetic processes have no Start shape; a leading receive/listen shape is the trigger.
        const receiveShape =
            startIds.size === 0 ? findReceiveShape(process, predecessors) : undefined;
        if (receiveShape) {
            startIds.add(receiveShape.id);
        }

        const triggers: IRTrigger[] = [];
        const actions: IRAction[] = [];
        const gaps: IRGap[] = [];
        const connections = new Map<string, IRConnection>();
        const subprocesses = new Set<string>();
        const maps = new Set<string>();
        const operations = new Set<string>();
        const shapeTypeCounts: Record<string, number> = {};

        for (const shape of process.shapes) {
            shapeTypeCounts[shape.shapeType] = (shapeTypeCounts[shape.shapeType] || 0) + 1;
            if (shape.shapeType === 'note') {
                continue;
            }

            const actionId = `action-${processKey}-${sanitizeId(shape.id)}`;
            const runAfter: Record<string, string[]> = {};
            for (const pred of predecessors.get(shape.id) || []) {
                if (!startIds.has(pred)) {
                    runAfter[`action-${processKey}-${sanitizeId(pred)}`] = ['Succeeded'];
                }
            }

            const resolved =
                shape === receiveShape
                    ? this.receiveTrigger(shape, process, index, processKey)
                    : this.resolveShape(shape, process, index, actionId, processKey);
            if (resolved.trigger) {
                triggers.push(resolved.trigger as unknown as IRTrigger);
            }
            if (resolved.action) {
                if (Object.keys(runAfter).length > 0) {
                    resolved.action['runAfter'] = runAfter;
                }
                actions.push(resolved.action as unknown as IRAction);
            }
            if (resolved.gap) {
                gaps.push(resolved.gap as unknown as IRGap);
            }
            if (resolved.connection) {
                const conn = boomiConnectionToIr(resolved.connection.ref);
                connections.set(conn.id, conn);
            }
            for (const extra of resolved.extraConnections || []) {
                const conn = boomiConnectionToIr(extra);
                connections.set(conn.id, conn);
            }
            if (resolved.subprocess) {
                subprocesses.add(resolved.subprocess);
            }
            if (resolved.map) {
                maps.add(resolved.map);
            }
            if (resolved.operation) {
                operations.add(resolved.operation);
            }
        }

        if (triggers.length === 0) {
            const inferred = this.inferTrigger(process, index, processKey);
            triggers.push(inferred as unknown as IRTrigger);
            const inferredConfig = inferred.config as Record<string, unknown>;
            if (typeof inferredConfig['operationName'] === 'string') {
                operations.add(inferredConfig['operationName']);
            }
            const listenerConn = index.find(inferredConfig['connectionName'] as string | undefined);
            if (listenerConn) {
                const conn = boomiConnectionToIr(listenerConn);
                connections.set(conn.id, conn);
            }
        }

        const { complexity, score } = this.estimateComplexity(process, gaps.length);
        const dialectNote =
            process.dialect === 'synthetic'
                ? 'Synthetic Boomi process XML (migration-test representation, not native AtomSphere export).'
                : 'Native AtomSphere process component export.';

        return {
            ...ir,
            metadata: {
                ...ir.metadata,
                source: {
                    ...ir.metadata.source,
                    platformVersion: process.version || '',
                    application: path.basename(index.rootPath),
                    artifact: {
                        ...ir.metadata.source.artifact,
                        name: process.name,
                        type: 'flow',
                        filePath: inputPath,
                        fileType: 'xml',
                    },
                },
                migration: {
                    ...ir.metadata.migration,
                    complexity,
                    complexityScore: score,
                    notes: [
                        dialectNote,
                        `Shapes: ${process.shapes.length}; actions: ${actions.length}; triggers: ${triggers.length}.`,
                        subprocesses.size > 0
                            ? `Calls sub-processes: ${[...subprocesses].join(', ')}`
                            : 'No sub-process calls.',
                    ],
                },
            },
            triggers,
            actions,
            connections: [...connections.values()],
            gaps,
            extensions: {
                ...ir.extensions,
                boomi: {
                    componentType: 'process',
                    dialect: process.dialect,
                    componentId: process.componentId,
                    folder: process.folder,
                    sourceFile: path.basename(inputPath),
                    shapeCount: process.shapes.length,
                    shapeTypes: shapeTypeCounts,
                    shapes: process.shapes.map((s) => ({
                        id: s.id,
                        type: s.shapeType,
                        label: s.label,
                        ...(s.reference ? { reference: s.reference } : {}),
                        next: s.next,
                    })),
                    subprocesses: [...subprocesses],
                    maps: [...maps],
                    operations: [...operations],
                    connections: [...connections.values()].map((c) => c.name),
                },
            },
        } as unknown as IRDocument;
    }

    private resolveShape(
        shape: BoomiShape,
        process: BoomiProcess,
        index: BoomiProjectIndex,
        actionId: string,
        processKey: string
    ): ResolvedShape {
        const base = (
            type: string,
            category: string,
            logicAppsAction: string,
            gap: boolean,
            config: Record<string, unknown>,
            extra: Record<string, unknown> = {}
        ): Record<string, unknown> => ({
            id: actionId,
            name: shape.label,
            type,
            category,
            config,
            sourceMapping: {
                boomi: {
                    shapeId: shape.id,
                    shapeType: shape.shapeType,
                    ...(shape.reference ? { reference: shape.reference } : {}),
                    ...extra,
                },
            },
            targetMapping: { logicAppsAction, gap },
        });

        // ── Start shape → trigger ───────────────────────────────────────────
        if (shape.shapeType === 'start') {
            return { trigger: this.buildTrigger(shape, index, processKey) };
        }

        // ── Native connector action ─────────────────────────────────────────
        if (shape.shapeType === 'connectoraction') {
            const cfg = shape.configuration['connectoraction'] || {};
            const connRef = index.find(cfg['connectionId']);
            const opRef = index.find(cfg['operationId']);
            const connectorType =
                cfg['connectorType'] || connRef?.connectorType || opRef?.connectorType;
            return this.connectorShape(
                shape,
                base,
                connectorType,
                connRef,
                opRef,
                cfg['actionType'],
                processKey
            );
        }

        // ── Native shapes with component references ─────────────────────────
        if (shape.shapeType === 'processcall' || shape.shapeType === 'processroute') {
            const cfg = shape.configuration[shape.shapeType] || {};
            const target = index.find(cfg['processId'] || cfg['processRouteId']);
            const workflowName = target?.name || cfg['processId'] || shape.label;
            const mapping = BOOMI_SHAPE_MAPPINGS[shape.shapeType];
            return {
                action: base(
                    mapping.actionType,
                    mapping.actionCategory,
                    mapping.logicAppsAction,
                    false,
                    {
                        workflowName,
                        waitForCompletion: cfg['wait'] !== 'false',
                    }
                ),
                subprocess: workflowName,
            };
        }

        if (shape.shapeType === 'map') {
            const cfg = shape.configuration['map'] || {};
            const mapRef = index.find(cfg['mapId']);
            const mapName = mapRef?.name || cfg['mapId'] || shape.label;
            return this.mapShape(base, mapName);
        }

        if (shape.shapeType === 'dataprocess') {
            const hasScript = Object.keys(shape.configuration).some((k) => /script/i.test(k));
            const mapping = BOOMI_SHAPE_MAPPINGS.dataprocess;
            return {
                action: base(
                    mapping.actionType,
                    mapping.actionCategory,
                    mapping.logicAppsAction,
                    hasScript,
                    {
                        customType: 'boomi-dataprocess',
                        properties: shape.configuration,
                    }
                ),
                gap: hasScript
                    ? this.gap(
                          processKey,
                          shape,
                          'custom-code',
                          'medium',
                          'Custom scripting step',
                          'Data Process custom scripting (Groovy/JavaScript) must be re-implemented as Inline Code or a local .NET function.'
                      )
                    : undefined,
            };
        }

        // ── Synthetic component references ──────────────────────────────────
        if (shape.shapeType === 'reference' && shape.reference) {
            if (TRADING_PARTNER_SHAPE.test(shape.reference)) {
                return this.tradingPartnerShape(shape, process, index, base);
            }
            const ref = resolveReference(shape.reference, index);
            if (ref?.kind === 'process' && ref.name !== process.name) {
                const mapping = BOOMI_SHAPE_MAPPINGS.processcall;
                return {
                    action: base(
                        mapping.actionType,
                        mapping.actionCategory,
                        mapping.logicAppsAction,
                        false,
                        {
                            workflowName: ref.name,
                            waitForCompletion: true,
                        }
                    ),
                    subprocess: ref.name,
                };
            }
            if (ref?.kind === 'map') {
                return this.mapShape(base, ref.name);
            }
            if (ref?.kind === 'operation') {
                const connRef = index.find(ref.connection);
                return this.connectorShape(
                    shape,
                    base,
                    ref.connectorType || connRef?.connectorType,
                    connRef,
                    ref,
                    ref.operation,
                    processKey
                );
            }
            if (ref?.kind === 'connection') {
                return this.connectorShape(
                    shape,
                    base,
                    ref.connectorType,
                    ref,
                    undefined,
                    undefined,
                    processKey
                );
            }
            if (ref?.kind === 'script') {
                const mapping = BOOMI_SHAPE_MAPPINGS.dataprocess;
                return {
                    action: base(
                        mapping.actionType,
                        mapping.actionCategory,
                        mapping.logicAppsAction,
                        true,
                        {
                            customType: 'boomi-script',
                            properties: { script: ref.name },
                        }
                    ),
                    gap: this.gap(
                        processKey,
                        shape,
                        'custom-code',
                        'medium',
                        `Custom script: ${ref.name}`,
                        'Boomi custom scripting must be re-implemented as Inline Code or a local .NET function.'
                    ),
                };
            }

            const heuristic = mapShapeByName(shape.reference);
            const linkedConn = matchConnection(shape.reference, heuristic.actionType, index);
            if (linkedConn) {
                return this.connectorShape(
                    shape,
                    base,
                    linkedConn.connectorType,
                    linkedConn,
                    undefined,
                    undefined,
                    processKey
                );
            }
            const lookups =
                heuristic.actionType === 'compose' &&
                /enrich|lookup|crossref/i.test(shape.reference)
                    ? matchByTokens(index.ofKind('cross-reference'), shape.reference)
                    : [];
            if (lookups.length > 0) {
                return {
                    action: base(
                        heuristic.actionType,
                        heuristic.actionCategory,
                        heuristic.logicAppsAction,
                        false,
                        { lookups: lookups.map((l) => l.name) },
                        { crossReferences: lookups.map((l) => l.name) }
                    ),
                };
            }
            return {
                action: base(
                    heuristic.actionType,
                    heuristic.actionCategory,
                    heuristic.logicAppsAction,
                    heuristic.gap ?? false,
                    this.defaultConfig(heuristic.actionType, shape)
                ),
                gap: heuristic.gap
                    ? this.gap(
                          processKey,
                          shape,
                          'other',
                          'low',
                          `Unresolved shape: ${shape.reference}`,
                          `Shape '${shape.reference}' does not reference a known Boomi component; review its behaviour manually.`
                      )
                    : undefined,
            };
        }

        // ── Other native shapes ─────────────────────────────────────────────
        const mapping = BOOMI_SHAPE_MAPPINGS[shape.shapeType];
        if (mapping) {
            return {
                action: base(
                    mapping.actionType,
                    mapping.actionCategory,
                    mapping.logicAppsAction,
                    mapping.gap ?? false,
                    this.defaultConfig(mapping.actionType, shape)
                ),
                gap: mapping.gap
                    ? this.gap(
                          processKey,
                          shape,
                          'unsupported-feature',
                          'medium',
                          `Boomi ${shape.shapeType} shape`,
                          mapping.notes ||
                              `Boomi ${shape.shapeType} shape has no direct Logic Apps equivalent.`
                      )
                    : undefined,
            };
        }

        return {
            action: base(
                'custom',
                'utility',
                'Requires assessment',
                true,
                this.defaultConfig('custom', shape)
            ),
            gap: this.gap(
                processKey,
                shape,
                'unsupported-feature',
                'low',
                `Unknown Boomi shape: ${shape.shapeType}`,
                `Shape type '${shape.shapeType}' is not mapped; review manually.`
            ),
        };
    }

    private connectorShape(
        shape: BoomiShape,
        base: (
            type: string,
            category: string,
            logicAppsAction: string,
            gap: boolean,
            config: Record<string, unknown>,
            extra?: Record<string, unknown>
        ) => Record<string, unknown>,
        connectorType: string | undefined,
        connRef: BoomiComponentRef | undefined,
        opRef: BoomiComponentRef | undefined,
        operation: string | undefined,
        processKey: string
    ): ResolvedShape {
        const mapping = mapConnector(connectorType);
        const connectionName = connRef?.name;
        const action = base(
            mapping.actionType,
            mapping.actionCategory,
            mapping.logicAppsAction,
            mapping.gap ?? false,
            {
                ...(connectionName
                    ? { connectionRef: `conn-boomi-${sanitizeId(connectionName)}` }
                    : {}),
                connectorType: connectorType || 'unknown',
                operation: operation || 'unknown',
                ...(opRef ? { operationName: opRef.name } : {}),
            },
            {
                connectorType,
                ...(connectionName ? { connection: connectionName } : {}),
                ...(opRef ? { operation: opRef.name } : {}),
                ...(operation ? { actionType: operation } : {}),
            }
        );
        return {
            action,
            connection: connRef ? { ref: connRef, mapping } : undefined,
            operation: opRef?.name,
            gap: mapping.gap
                ? this.gap(
                      processKey,
                      shape,
                      'unsupported-adapter',
                      'medium',
                      `Connector requires assessment: ${connectorType || 'unknown'}`,
                      `Boomi connector '${connectorType || 'unknown'}' has no direct Logic Apps Standard connector mapping.`
                  )
                : undefined,
        };
    }

    private mapShape(
        base: (
            type: string,
            category: string,
            logicAppsAction: string,
            gap: boolean,
            config: Record<string, unknown>
        ) => Record<string, unknown>,
        mapName: string
    ): ResolvedShape {
        const mapping = BOOMI_SHAPE_MAPPINGS.map;
        return {
            action: base(
                mapping.actionType,
                mapping.actionCategory,
                mapping.logicAppsAction,
                false,
                {
                    transformType: 'xslt',
                    mapName,
                }
            ),
            map: mapName,
        };
    }

    /**
     * Infer the entry point of a process that has no Start shape (e.g. the
     * synthetic migration-test dialect). Processes called by other processes
     * become child workflows; top-level processes are matched to an
     * unreferenced listener operation that shares a name token.
     */
    private inferTrigger(
        process: BoomiProcess,
        index: BoomiProjectIndex,
        processKey: string
    ): Record<string, unknown> {
        const self = process.name.toLowerCase();
        const callers: string[] = [];
        const referenced = new Set<string>();
        for (const other of index.ofKind('process')) {
            let text = '';
            try {
                text = fs.readFileSync(other.filePath, 'utf-8');
            } catch {
                continue;
            }
            for (const match of text.matchAll(
                /\b(?:type|reference|processId|operationId|componentId)="([^"]+)"/g
            )) {
                const target = resolveReference(match[1], index);
                const name = (target?.name || match[1]).toLowerCase();
                referenced.add(name);
                if (other.name.toLowerCase() !== self && name === self) {
                    callers.push(other.name);
                }
            }
        }

        const base = {
            id: `trigger-${processKey}`,
            name: 'Start',
            config: {} as Record<string, unknown>,
        };

        if (callers.length > 0) {
            return {
                ...base,
                type: 'manual',
                category: 'manual',
                config: { calledBy: [...new Set(callers)].sort() },
                sourceMapping: { boomi: { inferred: true, reason: 'sub-process' } },
                targetMapping: {
                    logicAppsTrigger:
                        'Request trigger (child workflow invoked via the Workflow action)',
                    gap: false,
                },
            };
        }

        const tokens = new Set(nameTokens(process.name));
        const listeners = index
            .ofKind('operation')
            .filter((op) => !referenced.has(op.name.toLowerCase()))
            .filter((op) => {
                const conn = index.find(op.connection);
                return (
                    mapConnector(op.connectorType || conn?.connectorType).connectionType === 'http'
                );
            })
            .filter((op) => nameTokens(op.name).some((t) => tokens.has(t)));

        if (listeners.length > 0) {
            const op = listeners[0];
            const conn = index.find(op.connection);
            return {
                ...base,
                type: 'http',
                category: 'request-response',
                config: {
                    operationName: op.name,
                    ...(op.operation ? { method: op.operation } : {}),
                    ...(conn ? { connectionName: conn.name } : {}),
                },
                sourceMapping: {
                    boomi: { inferred: true, reason: 'listener-operation', operation: op.name },
                },
                targetMapping: { logicAppsTrigger: 'Request (HTTP) trigger', gap: false },
            };
        }

        return {
            ...base,
            type: 'manual',
            category: 'manual',
            sourceMapping: { boomi: { inferred: true, reason: 'no-start-shape' } },
            targetMapping: {
                logicAppsTrigger:
                    'Recurrence or Request trigger — confirm the Boomi deployment schedule / listener',
                gap: false,
            },
        };
    }

    private buildTrigger(
        shape: BoomiShape,
        index: BoomiProjectIndex,
        processKey: string
    ): Record<string, unknown> {
        const cfg = shape.configuration['connectoraction'];
        let type = 'manual';
        let category = 'manual';
        let logicAppsTrigger = 'Request (child workflow / manual invocation)';
        let connectorType: string | undefined;
        let actionType: string | undefined;

        if (cfg) {
            const connRef = index.find(cfg['connectionId']);
            connectorType = cfg['connectorType'] || connRef?.connectorType;
            actionType = cfg['actionType'];
            const mapping = mapConnector(connectorType);
            const listen = /listen/i.test(actionType || '');
            if (mapping.connectionType === 'http' || mapping.connectionType === 'soap' || listen) {
                type = 'http';
                category = 'request-response';
                logicAppsTrigger = 'Request (HTTP) trigger';
            } else if (mapping.connectionType === 'sftp' || mapping.connectionType === 'ftp') {
                type = mapping.connectionType;
                category = 'polling';
                logicAppsTrigger = `${mapping.logicAppsAction} trigger (when files are added)`;
            } else if (mapping.connectionType === 'file-system') {
                type = 'file';
                category = 'polling';
                logicAppsTrigger = 'File System / Blob trigger';
            } else if (
                mapping.connectionType === 'service-bus' ||
                mapping.connectionType === 'event-hub'
            ) {
                type = mapping.connectionType;
                category = 'event';
                logicAppsTrigger = `${mapping.logicAppsAction} trigger`;
            } else if (mapping.connectionType === 'sql-server') {
                type = 'database';
                category = 'polling';
                logicAppsTrigger = 'Recurrence + SQL query (or SQL trigger)';
            } else {
                type = 'custom';
                category = 'polling';
                logicAppsTrigger = 'Recurrence + connector action';
            }
        } else if (shape.configuration['noaction']) {
            type = 'timer';
            category = 'polling';
            logicAppsTrigger = 'Recurrence (Boomi deployment schedule)';
        }

        return {
            id: `trigger-${processKey}`,
            name: shape.label === 'start' ? 'Start' : shape.label,
            type,
            category,
            config: {
                ...(connectorType ? { connectorType } : {}),
                ...(actionType ? { actionType } : {}),
            },
            sourceMapping: {
                boomi: { shapeId: shape.id, shapeType: 'start', connectorType, actionType },
            },
            targetMapping: { logicAppsTrigger, gap: false },
        };
    }

    private defaultConfig(actionType: string, shape: BoomiShape): Record<string, unknown> {
        switch (actionType) {
            case 'terminate':
                return { status: shape.shapeType === 'exception' ? 'Failed' : 'Succeeded' };
            case 'custom':
                return { customType: `boomi-${shape.shapeType}`, properties: shape.configuration };
            default:
                return { boomiShapeType: shape.shapeType, properties: shape.configuration };
        }
    }

    private gap(
        key: string,
        shape: BoomiShape,
        category: string,
        severity: string,
        title: string,
        description: string
    ): Record<string, unknown> {
        return {
            id: `gap-${key}-${sanitizeId(shape.id)}`,
            category,
            severity,
            title,
            description,
            sourceFeature: { platform: 'boomi', name: shape.reference || shape.shapeType },
            status: 'open',
        };
    }

    /** Trading partner send/receive shape → X12/EDIFACT encode/decode + AS2/SFTP transport. */
    private tradingPartnerShape(
        shape: BoomiShape,
        process: BoomiProcess,
        index: BoomiProjectIndex,
        base: ActionBuilder
    ): ResolvedShape {
        const b2b = describePartners(process, index);
        const send = !/receive/i.test(shape.reference || '');
        const transport = b2b.channels
            .map((c) =>
                c === 'AS2' ? 'AS2 Encode + HTTP POST' : c === 'SFTP' ? 'SFTP upload' : `${c} send`
            )
            .join(' / ');
        return {
            action: base(
                'custom',
                'integration',
                send
                    ? `${b2b.standard} Encode (Integration Account agreement) → ${transport || 'partner transport'}`
                    : `${b2b.standard} Decode (Integration Account agreement)`,
                false,
                {
                    customType: send
                        ? 'boomi-trading-partner-send'
                        : 'boomi-trading-partner-receive',
                    standard: b2b.standard,
                    partners: b2b.partners.map((p) => p.name),
                    channels: b2b.channels,
                },
                { tradingPartners: b2b.partners.map((p) => p.name) }
            ),
            extraConnections: b2b.connections,
        };
    }

    /** Leading receive/listen shape of a synthetic process → workflow trigger. */
    private receiveTrigger(
        shape: BoomiShape,
        process: BoomiProcess,
        index: BoomiProjectIndex,
        processKey: string
    ): ResolvedShape {
        const name = shape.reference || shape.label;
        const base = {
            id: `trigger-${processKey}`,
            name: shape.label,
            sourceMapping: { boomi: { shapeId: shape.id, reference: name, inferred: true } },
        };

        if (TRADING_PARTNER_SHAPE.test(name)) {
            const b2b = describePartners(process, index);
            const viaHttp = b2b.channels.length === 0 || b2b.channels.includes('AS2');
            const others = b2b.channels.filter((c) => c !== (viaHttp ? 'AS2' : b2b.channels[0]));
            return {
                trigger: {
                    ...base,
                    type: viaHttp ? 'http' : mapConnector(b2b.channels[0]).connectionType,
                    category: viaHttp ? 'request-response' : 'polling',
                    config: {
                        standard: b2b.standard,
                        partners: b2b.partners.map((p) => p.name),
                        channels: b2b.channels,
                    },
                    targetMapping: {
                        logicAppsTrigger:
                            (viaHttp
                                ? `Request trigger (AS2 inbound) → AS2 Decode → ${b2b.standard} Decode`
                                : `${b2b.channels[0]} trigger (when files are added) → ${b2b.standard} Decode`) +
                            (others.length > 0
                                ? `; ${others.join('/')} partners need a separate polling workflow`
                                : ''),
                        gap: false,
                    },
                },
                extraConnections: b2b.connections,
            };
        }

        if (/event|message|queue|topic|subscribe/i.test(name)) {
            return {
                trigger: {
                    ...base,
                    type: 'service-bus',
                    category: 'event',
                    config: { event: name },
                    targetMapping: {
                        logicAppsTrigger:
                            'Service Bus trigger (built-in) or Event Grid trigger for the source event',
                        gap: false,
                    },
                },
            };
        }

        const conn = matchByTokens(index.ofKind('connection'), name)[0];
        const mapping = mapConnector(conn?.connectorType || 'http');
        const polling = ['sftp', 'ftp', 'file-system', 'storage-blob', 'sql-server'].includes(
            mapping.connectionType
        );
        return {
            trigger: {
                ...base,
                type: polling ? mapping.connectionType : 'http',
                category: polling ? 'polling' : 'request-response',
                config: conn ? { connectionName: conn.name } : {},
                targetMapping: {
                    logicAppsTrigger: polling
                        ? `${mapping.logicAppsAction} trigger`
                        : 'Request (HTTP) trigger',
                    gap: false,
                },
            },
            connection: conn ? { ref: conn, mapping } : undefined,
        };
    }

    private estimateComplexity(
        process: BoomiProcess,
        gapCount: number
    ): { complexity: ComplexityLevel; score: number } {
        const controlShapes = process.shapes.filter((s) =>
            [
                'decision',
                'branch',
                'route',
                'trycatch',
                'catcherrors',
                'flowcontrol',
                'processroute',
            ].includes(s.shapeType)
        ).length;
        const score = Math.min(100, process.shapes.length * 3 + controlShapes * 5 + gapCount * 10);
        const complexity: ComplexityLevel =
            score >= 75 ? 'very-high' : score >= 45 ? 'high' : score >= 15 ? 'medium' : 'low';
        return { complexity, score };
    }
}

const GENERIC_NAME_TOKENS = new Set([
    'process',
    'processing',
    'flow',
    'main',
    'sub',
    'common',
    'handler',
    'api',
    'the',
]);

/** Split a CamelCase / delimited component name into lower-case significant tokens. */
function nameTokens(name: string): string[] {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .map((t) => t.toLowerCase())
        .filter((t) => t.length > 2 && !GENERIC_NAME_TOKENS.has(t));
}

type ActionBuilder = (
    type: string,
    category: string,
    logicAppsAction: string,
    gap: boolean,
    config: Record<string, unknown>,
    extra?: Record<string, unknown>
) => Record<string, unknown>;

/** Synthetic shapes that send to / receive from trading partners (TPSend, TPReceive, ...). */
const TRADING_PARTNER_SHAPE = /^tp(send|receive)|tradingpartner|partner(send|receive)/i;

/** Synthetic shapes that start a process (listener / event subscription). */
const RECEIVE_SHAPE = /^(tp)?receive|^listen|^poll|^subscribe/i;

function findReceiveShape(
    process: BoomiProcess,
    predecessors: Map<string, string[]>
): BoomiShape | undefined {
    const first = process.shapes.find(
        (s) => s.shapeType === 'reference' && !predecessors.has(s.id)
    );
    return first && RECEIVE_SHAPE.test(first.reference || '') ? first : undefined;
}

/**
 * Resolve a synthetic shape name to a project component: exact name/ID, then
 * a unique process/script whose name starts with the shape name
 * (`Generate997` → `Generate997Acknowledgment`), then a unique map whose name
 * covers the shape tokens (`Map850ToCanonical` → `X12_850_To_CanonicalOrder`).
 */
function resolveReference(name: string, index: BoomiProjectIndex): BoomiComponentRef | undefined {
    const exact = index.find(name);
    if (exact) {
        return exact;
    }
    const lower = name.toLowerCase();
    if (lower.length >= 6) {
        for (const kind of ['process', 'script'] as const) {
            const hits = index.ofKind(kind).filter((c) => c.name.toLowerCase().startsWith(lower));
            if (hits.length === 1) {
                return hits[0];
            }
        }
    }
    if (/^(map|transform)/i.test(name)) {
        const tokens = nameTokens(name.replace(/^(map|transform)/i, ''));
        if (tokens.length > 0) {
            const hits = index.ofKind('map').filter((m) => {
                const mapTokens = nameTokens(m.name);
                return tokens.every((t) => mapTokens.some((mt) => mt.startsWith(t)));
            });
            if (hits.length === 1) {
                return hits[0];
            }
        }
    }
    return undefined;
}

/** Candidates ranked by the number of shared name tokens (best first, ≥1 shared). */
function matchByTokens(candidates: BoomiComponentRef[], name: string): BoomiComponentRef[] {
    const tokens = new Set(nameTokens(name));
    return candidates
        .map((c) => ({ c, score: nameTokens(c.name).filter((t) => tokens.has(t)).length }))
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((m) => m.c);
}

/**
 * Link an unresolved integration shape to a connection: a unique best
 * token match (`AuditSuccess` → `AuditDatabase`), or the only HTTP
 * connection for HTTP calls (`SubmitOMS` → `OrderManagementAPI`).
 */
function matchConnection(
    name: string,
    actionType: string,
    index: BoomiProjectIndex
): BoomiComponentRef | undefined {
    const family = /^audit/i.test(name) ? 'persist' : ACTION_FAMILY[actionType];
    if (!family) {
        return undefined;
    }
    const connections = index
        .ofKind('connection')
        .filter((c) => ACTION_FAMILY[mapConnector(c.connectorType).actionType] === family);
    const ranked = matchByTokens(connections, name);
    if (ranked.length === 1) {
        return ranked[0];
    }
    if (ranked.length > 1) {
        const tokens = new Set(nameTokens(name));
        const score = (c: BoomiComponentRef) =>
            nameTokens(c.name).filter((t) => tokens.has(t)).length;
        return score(ranked[0]) > score(ranked[1]) ? ranked[0] : undefined;
    }
    if (actionType === 'http-call') {
        const http = connections.filter(
            (c) => mapConnector(c.connectorType).connectionType === 'http'
        );
        return http.length === 1 ? http[0] : undefined;
    }
    return undefined;
}

/** Integration action families; a shape only links to a connection of the same family. */
const ACTION_FAMILY: Record<string, string> = {
    'http-call': 'http',
    'salesforce-operation': 'http',
    'database-execute': 'persist',
    'database-query': 'persist',
    'file-write': 'persist',
    'file-read': 'persist',
    'sftp-operation': 'persist',
    'ftp-operation': 'persist',
    'queue-send': 'messaging',
    'email-send': 'email',
};

/** Trading partners relevant to a process (filtered by transaction codes in its name). */
function describePartners(
    process: BoomiProcess,
    index: BoomiProjectIndex
): {
    partners: BoomiComponentRef[];
    connections: BoomiComponentRef[];
    channels: string[];
    standard: string;
} {
    const all = index.ofKind('trading-partner');
    const codes: string[] = process.name.match(/\d{3}/g) || [];
    const filtered = all.filter((p) => p.documents?.some((d) => codes.includes(d)));
    const partners = filtered.length > 0 ? filtered : all;
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const connectionList = index.ofKind('connection');
    const connections: BoomiComponentRef[] = [];
    for (const partner of partners) {
        const byName = connectionList.find((c) => normalize(c.name) === normalize(partner.name));
        const byChannel = connectionList.filter(
            (c) =>
                !!partner.communication &&
                normalize(c.connectorType || '') === normalize(partner.communication)
        );
        const conn = byName || (byChannel.length === 1 ? byChannel[0] : undefined);
        if (conn && !connections.includes(conn)) {
            connections.push(conn);
        }
    }
    const channels = [
        ...new Set(partners.map((p) => p.communication?.toUpperCase()).filter(Boolean)),
    ] as string[];
    const standards = [
        ...new Set(partners.map((p) => p.standard?.toUpperCase()).filter(Boolean)),
    ] as string[];
    return {
        partners,
        connections,
        channels,
        standard: standards.join('/') || 'X12',
    };
}

/** Parse XML, rejecting documents with recoverable errors such as unclosed tags. */
function parseStrictXml(xml: string): Document | null {
    let failed = false;
    try {
        const doc = new DOMParser({
            errorHandler: {
                warning: () => undefined,
                error: () => {
                    failed = true;
                },
                fatalError: () => {
                    failed = true;
                },
            },
        }).parseFromString(xml, 'text/xml');
        return failed ? null : (doc as unknown as Document);
    } catch {
        return null;
    }
}
