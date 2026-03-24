/**
 * Conversion Webview Panel
 *
 * Webview panel for the Conversion stage. Displays planned flows in
 * the upper section for selection and shows the ordered conversion
 * task list in the lower section.
 *
 * @module views/conversion/ConversionWebviewPanel
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { ConversionService } from '../../stages/conversion/ConversionService';
import { ConversionFileService } from '../../stages/conversion/ConversionFileService';
import {
    ConversionFlow,
    ConversionFlowStatus,
    ConversionTaskPlan,
    ConversionTaskStatus,
    ConversionTaskOutput,
} from '../../stages/conversion/types';
import { UserPrompts } from '../../constants/UserMessages';

// =============================================================================
// Conversion Webview Panel
// =============================================================================

/**
 * Webview panel for the Conversion stage.
 */
export class ConversionWebviewPanel implements vscode.Disposable {
    public static currentPanel: ConversionWebviewPanel | undefined;
    public static readonly viewType = 'logicAppsMigrationAssistant.conversionView';

    private readonly panel: vscode.WebviewPanel;
    private readonly logger = LoggingService.getInstance();
    private readonly conversionService = ConversionService.getInstance();
    private readonly disposables: vscode.Disposable[] = [];
    private updating = false;

    private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
        this.panel = panel;

        // Set initial content
        this.update();

        // Listen for panel disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            this.handleMessage.bind(this),
            null,
            this.disposables
        );

        // Listen for conversion state changes
        this.disposables.push(
            this.conversionService.onStateChange(() => {
                this.update();
            })
        );
    }

    /**
     * Create or show the panel.
     */
    public static createOrShow(extensionUri: vscode.Uri): ConversionWebviewPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ConversionWebviewPanel.currentPanel) {
            ConversionWebviewPanel.currentPanel.panel.reveal(column);
            ConversionWebviewPanel.currentPanel.update();
            return ConversionWebviewPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            ConversionWebviewPanel.viewType,
            'Conversion',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            }
        );

        ConversionWebviewPanel.currentPanel = new ConversionWebviewPanel(panel, extensionUri);
        return ConversionWebviewPanel.currentPanel;
    }

    /**
     * Update the webview content.
     */
    public update(): void {
        if (this.updating) {
            return;
        }
        this.updating = true;

        try {
            const flows = this.conversionService.buildFlowsFromPlanning();

            const state = this.conversionService.getState();
            const selectedFlowId = state?.selectedFlowId;
            const taskPlan = selectedFlowId
                ? this.conversionService.getTaskPlan(selectedFlowId)
                : undefined;

            this.logger.info(
                `[ConversionWebview] update: selectedFlowId=${selectedFlowId}, hasTaskPlan=${!!taskPlan}, flowCount=${flows.length}`
            );

            // Update tab title with flow name
            const selectedFlowName2 =
                taskPlan?.flowName || flows.find((f) => f.id === selectedFlowId)?.name;
            this.panel.title = selectedFlowName2 ? `⚙️ ${selectedFlowName2}` : 'Conversion';

            this.panel.webview.html = this.getHtmlContent(flows, selectedFlowId, taskPlan);
        } catch (err) {
            this.logger.error(
                `[ConversionWebview] update error: ${err instanceof Error ? err.message : String(err)}`
            );
        } finally {
            this.updating = false;
        }
    }

    /**
     * Handle messages from webview.
     */
    private handleMessage(message: { command: string; data?: unknown }): void {
        this.logger.info(
            `[ConversionWebview] message received: ${message.command} data=${JSON.stringify(message.data)}`
        );
        switch (message.command) {
            case 'selectFlow': {
                const flowId = message.data as string;
                if (flowId) {
                    void this.conversionService.selectFlow(flowId);
                    this.logger.info(`Flow selected for conversion: ${flowId}`);
                }
                break;
            }

            case 'startConversion': {
                const flowId = message.data as string;
                if (flowId) {
                    void this.conversionService.selectFlow(flowId);
                    // Immediately mark the flow as 'thinking' so the UI updates
                    const state = this.conversionService.getState();
                    const flow = state?.flows.find((f: ConversionFlow) => f.id === flowId);
                    if (flow && flow.status === 'not-started') {
                        flow.status = 'thinking';
                        this.update();
                    }
                    this.logger.info(`Conversion started for flow: ${flowId}`);
                    vscode.commands
                        .executeCommand(
                            'logicAppsMigrationAssistant.generateConversionForFlow',
                            flowId
                        )
                        .then(
                            () =>
                                this.logger.info(
                                    `Conversion command completed for flow: ${flowId}`
                                ),
                            (err) => {
                                this.logger.error(
                                    `Conversion command failed for flow: ${flowId} — ${err}`
                                );
                                vscode.window.showErrorMessage(
                                    UserPrompts.failedToStartConversionPanel(err)
                                );
                            }
                        );
                }
                break;
            }

            case 'reconvert': {
                const flowId = message.data as string;
                if (flowId) {
                    this.logger.info(`Reconvert requested for flow: ${flowId}`);

                    // Kill func processes before deleting output
                    void vscode.commands.executeCommand(
                        'logicAppsMigrationAssistant.killFuncProcesses'
                    );

                    // Delete generated output folder for this flow
                    const wsFolder = vscode.workspace.workspaceFolders?.[0];
                    if (wsFolder) {
                        const cfs = ConversionFileService.getInstance();
                        const taskPlan = cfs.readTaskPlan(flowId);
                        const outCandidates = new Set<string>();
                        outCandidates.add(flowId);
                        outCandidates.add(flowId.replace(/[^a-zA-Z0-9_-]/g, '_'));
                        // From task plan generated files
                        if (taskPlan?.tasks) {
                            for (const task of taskPlan.tasks) {
                                const output = task.output as
                                    | { generatedFiles?: string[] }
                                    | undefined;
                                if (output?.generatedFiles) {
                                    for (const f of output.generatedFiles) {
                                        const m = f.replace(/\\/g, '/').match(/^out\/([^/]+)/);
                                        if (m) {
                                            outCandidates.add(m[1]);
                                        }
                                    }
                                }
                            }
                        }
                        // From flow name
                        const state = this.conversionService.getState();
                        const flowName =
                            taskPlan?.flowName ||
                            state?.flows.find((f: ConversionFlow) => f.id === flowId)?.name;
                        if (flowName) {
                            outCandidates.add(
                                flowName
                                    .replace(/[^a-zA-Z0-9_-]/g, '-')
                                    .replace(/-+/g, '-')
                                    .replace(/^-|-$/g, '')
                            );
                        }
                        for (const candidate of outCandidates) {
                            const outPath = path.join(wsFolder.uri.fsPath, 'out', candidate);
                            if (fs.existsSync(outPath)) {
                                fs.rmSync(outPath, { recursive: true, force: true });
                                this.logger.info(`[Reconvert] Deleted output folder: ${outPath}`);
                            }
                        }
                    }

                    ConversionFileService.getInstance().removeFlow(flowId);

                    // Reset flow status
                    const state = this.conversionService.getState();
                    const flow = state?.flows.find((f: ConversionFlow) => f.id === flowId);
                    if (flow) {
                        flow.status = 'thinking';
                    }
                    if (state?.taskPlans[flowId]) {
                        delete state.taskPlans[flowId];
                    }

                    void this.conversionService.selectFlow(flowId);
                    this.update();
                    vscode.commands
                        .executeCommand(
                            'logicAppsMigrationAssistant.generateConversionForFlow',
                            flowId
                        )
                        .then(
                            () =>
                                this.logger.info(`Reconvert command completed for flow: ${flowId}`),
                            (err) => {
                                this.logger.error(
                                    `Reconvert command failed for flow: ${flowId} — ${err}`
                                );
                                vscode.window.showErrorMessage(UserPrompts.failedToReconvert(err));
                            }
                        );
                }
                break;
            }

            case 'refresh': {
                this.conversionService.buildFlowsFromPlanning();
                this.update();
                break;
            }

            case 'openInVSCode': {
                const flowId = message.data as string;
                if (flowId) {
                    this.openProjectInVSCode(flowId);
                }
                break;
            }

            case 'executeTask': {
                const payload = message.data as { flowId: string; taskId: string };
                if (payload?.flowId && payload?.taskId) {
                    this.logger.info(
                        `Execute task requested: flow=${payload.flowId} task=${payload.taskId}`
                    );
                    vscode.commands
                        .executeCommand(
                            'logicAppsMigrationAssistant.executeConversionTask',
                            payload.flowId,
                            payload.taskId,
                            { origin: 'single-ui' }
                        )
                        .then(
                            () =>
                                this.logger.info(
                                    `Execute task command completed: ${payload.taskId}`
                                ),
                            (err) => {
                                this.logger.error(
                                    `Execute task command failed: ${payload.taskId} — ${err}`
                                );
                                vscode.window.showErrorMessage(
                                    UserPrompts.failedToExecuteTask(err)
                                );
                            }
                        );
                }
                break;
            }

            case 'convertAll': {
                const flowId = message.data as string;
                if (flowId) {
                    this.logger.info(`Convert all tasks requested for flow: ${flowId}`);
                    vscode.commands
                        .executeCommand(
                            'logicAppsMigrationAssistant.executeAllConversionTasks',
                            flowId
                        )
                        .then(
                            () =>
                                this.logger.info(
                                    `Convert all command completed for flow: ${flowId}`
                                ),
                            (err) => {
                                this.logger.error(`Convert all command failed: ${flowId} — ${err}`);
                                vscode.window.showErrorMessage(
                                    UserPrompts.failedToExecuteAllTasks(err)
                                );
                            }
                        );
                }
                break;
            }

            case 'skipTask': {
                const skipPayload = message.data as { flowId: string; taskId: string };
                if (skipPayload?.flowId && skipPayload?.taskId) {
                    this.logger.info(
                        `Skip task requested: flow=${skipPayload.flowId} task=${skipPayload.taskId}`
                    );
                    const cs = ConversionService.getInstance();
                    cs.updateTask(skipPayload.flowId, skipPayload.taskId, {
                        status: 'skipped',
                        output: {
                            completedAt: new Date().toISOString(),
                            summary: 'Skipped by user — optional task',
                        },
                    }).then(
                        () => this.logger.info(`Task skipped: ${skipPayload.taskId}`),
                        (err) => this.logger.error(`Skip task failed: ${err}`)
                    );
                    // Also persist to disk
                    const cfs = ConversionFileService.getInstance();
                    cfs.updateTaskStatus(skipPayload.flowId, skipPayload.taskId, 'skipped');
                }
                break;
            }

            case 'goToPlanning': {
                void vscode.commands.executeCommand('logicAppsMigrationAssistant.openPlanningView');
                break;
            }

            case 'goToDiscovery': {
                void vscode.commands.executeCommand(
                    'logicAppsMigrationAssistant.viewFlowVisualization'
                );
                break;
            }
        }
    }

    /**
     * Get HTML content for webview.
     */
    private getHtmlContent(
        flows: ConversionFlow[],
        selectedFlowId: string | undefined,
        taskPlan: ConversionTaskPlan | undefined
    ): string {
        const nonce = this.getNonce();

        if (flows.length === 0) {
            return this.getEmptyStateHtml(nonce);
        }

        const flowRowsHtml = flows
            .map((flow) => {
                const isSelected = flow.id === selectedFlowId;
                const statusBadge = this.getStatusBadgeHtml(flow.status);

                const actionButton = this.getFlowActionButton(flow);

                return `
                <tr class="flow-row ${isSelected ? 'selected' : ''}" data-flow-id="${this.escapeHtml(flow.id)}">
                    <td>
                        <span class="flow-name" onclick="selectFlow('${this.escapeHtml(flow.id)}')">
                            ${this.escapeHtml(flow.name)}
                        </span>
                    </td>
                    <td>${this.escapeHtml(flow.category)}</td>
                    <td class="center">${flow.artifactCount}</td>
                    <td class="center">${statusBadge}</td>
                    <td class="center">
                        ${actionButton}
                    </td>
                </tr>`;
            })
            .join('');

        const taskSectionHtml = taskPlan
            ? this.getTaskPlanHtml(taskPlan)
            : selectedFlowId
              ? this.getTaskPlaceholderHtml(selectedFlowId)
              : this.getSelectFlowPromptHtml();

        // Compute summary stats
        const totalFlows = flows.length;
        const completedCount = flows.filter((f) => f.status === 'completed').length;
        const inProgressCount = flows.filter(
            (f) =>
                f.status === 'thinking' || f.status === 'in-progress' || f.status === 'tasks-ready'
        ).length;
        const notStartedCount = flows.filter((f) => f.status === 'not-started').length;
        const selectedFlowName =
            taskPlan?.flowName || flows.find((f) => f.id === selectedFlowId)?.name || '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${this.panel.webview.cspSource} data:;">
    <title>Migration Conversion</title>
    <style>
        :root {
            --vscode-font-family: var(--vscode-editor-font-family, 'Segoe UI', sans-serif);
            --container-padding: 20px;
        }

        body {
            font-family: var(--vscode-font-family);
            padding: var(--container-padding);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            max-width: 1200px;
            margin-left: auto;
            margin-right: auto;
        }

        h1, h2, h3, h4 { color: var(--vscode-foreground); margin-top: 0; }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header-actions { display: flex; gap: 8px; }

        .stats-bar { display: flex; gap: 16px; margin-bottom: 20px; }
        .stat-pill {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 14px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 20px; font-size: 12px;
        }
        .stat-pill .stat-count {
            font-weight: bold; font-size: 14px;
            color: var(--vscode-textLink-foreground);
        }

        /* Buttons */
        .btn {
            padding: 6px 14px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none; border-radius: 4px;
            cursor: pointer; font-size: 13px; white-space: nowrap;
        }
        .btn:hover { background: var(--vscode-button-hoverBackground); }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-sm { padding: 4px 10px; font-size: 12px; }
        .btn-outline {
            background: transparent;
            color: var(--vscode-button-background);
            border: 1px solid var(--vscode-button-background);
            margin-left: 6px;
        }
        .btn-outline:hover {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-disabled {
            opacity: 0.5; cursor: not-allowed;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-disabled:hover { background: var(--vscode-button-secondaryBackground); }
        .btn-icon {
            background: transparent;
            border: 1px solid var(--vscode-button-background);
            color: var(--vscode-button-background);
            padding: 3px 7px;
            margin-left: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
        }
        .btn-icon:hover {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-icon:hover svg path { fill: var(--vscode-button-foreground); }
        .btn-icon svg { width: 16px; height: 16px; }

        /* Layout */
        .upper-section { margin-bottom: 24px; }
        .lower-section {
            border-top: 2px solid var(--vscode-panel-border);
            padding-top: 20px;
        }
        .section-title {
            font-size: 15px; font-weight: 600;
            margin-bottom: 12px; display: flex;
            align-items: center; gap: 8px;
        }

        /* Flow Table */
        .flow-table-wrapper {
            max-height: 210px; overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px; scroll-behavior: smooth;
            position: relative;
        }
        .flow-table-wrapper::after {
            content: ''; position: sticky;
            bottom: 0; left: 0; right: 0;
            display: block; height: 24px;
            background: linear-gradient(transparent, var(--vscode-editor-background));
            pointer-events: none;
        }
        .flow-table {
            width: 100%; border-collapse: collapse; font-size: 13px;
        }
        .flow-table th, .flow-table td {
            padding: 10px 12px; text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .flow-table th {
            background: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: 600; font-size: 12px;
            text-transform: uppercase; letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            position: sticky; top: 0; z-index: 1;
        }
        .flow-table td.center, .flow-table th.center { text-align: center; }
        .flow-row { transition: background-color 0.15s; }
        .flow-row:nth-child(even) { background: rgba(255,255,255,0.02); }
        .flow-row:hover { background: var(--vscode-list-hoverBackground); }
        .flow-row.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        .flow-name {
            color: var(--vscode-textLink-foreground);
            cursor: pointer; font-weight: 500;
        }
        .flow-name:hover { text-decoration: underline; }

        /* Badges */
        .status-badge {
            display: inline-flex; align-items: center;
            padding: 2px 8px; border-radius: 10px;
            font-size: 11px; font-weight: 500;
        }
        .status-not-started {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-descriptionForeground);
        }
        .status-thinking {
            background: rgba(0, 120, 212, 0.15);
            color: var(--vscode-editorInfo-foreground);
            border: 1px solid var(--vscode-editorInfo-foreground);
        }
        .status-tasks-ready {
            background: rgba(0, 120, 212, 0.25);
            color: var(--vscode-editorInfo-foreground);
            border: 1px solid var(--vscode-editorInfo-foreground);
        }
        .status-in-progress {
            background: rgba(0, 120, 212, 0.15);
            color: var(--vscode-editorInfo-foreground);
            border: 1px solid var(--vscode-editorInfo-foreground);
        }
        .status-completed {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }
        .status-failed {
            background: var(--vscode-errorForeground);
            color: white;
        }

        /* Task List */
        .task-placeholder {
            text-align: center; padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }
        .task-placeholder h3 { color: var(--vscode-foreground); }

        .task-list {
            display: flex; flex-direction: column; gap: 8px;
        }

        .task-card {
            display: flex; align-items: flex-start; gap: 12px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px; padding: 14px 16px;
            border: 1px solid var(--vscode-panel-border);
            transition: box-shadow 0.15s;
        }
        .task-card:hover {
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }

        .task-order {
            display: flex; align-items: center; justify-content: center;
            width: 28px; height: 28px; min-width: 28px;
            border-radius: 50%;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            font-weight: 600; font-size: 13px;
        }
        .task-order.completed {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }
        .task-order.in-progress {
            background: var(--vscode-editorInfo-foreground);
            color: white;
        }
        .task-order.failed {
            background: var(--vscode-errorForeground);
            color: white;
        }

        .task-body { flex: 1; }
        .task-name-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 4px;
        }
        .task-name {
            font-weight: 600; font-size: 13px;
            flex: 1;
        }
        .task-action {
            flex-shrink: 0;
        }
        .task-action-btn {
            font-size: 11px;
            padding: 3px 10px;
        }
        .task-done-label {
            font-size: 11px;
            color: var(--vscode-testing-iconPassed);
            font-weight: 600;
        }
        .task-desc {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
        }
        .task-meta {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            display: flex; gap: 12px; flex-wrap: wrap;
        }
        .task-meta-item {
            display: flex; align-items: center; gap: 4px;
        }

        .task-status-badge {
            display: inline-flex; align-items: center;
            padding: 2px 8px; border-radius: 10px;
            font-size: 11px; font-weight: 500;
        }
        .task-status-pending {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-descriptionForeground);
        }
        .task-status-in-progress {
            background: rgba(0, 120, 212, 0.15);
            color: var(--vscode-editorInfo-foreground);
            border: 1px solid var(--vscode-editorInfo-foreground);
        }
        .task-status-completed {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }
        .task-status-failed {
            background: var(--vscode-errorForeground);
            color: white;
        }
        .task-status-skipped {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px dashed var(--vscode-descriptionForeground);
        }
        .task-optional-badge {
            display: inline-flex; align-items: center;
            padding: 2px 8px; border-radius: 10px;
            font-size: 10px; font-weight: 600; text-transform: uppercase;
            background: transparent;
            color: var(--vscode-editorWarning-foreground, #cca700);
            border: 1px solid var(--vscode-editorWarning-foreground, #cca700);
            margin-left: 4px;
        }
        .btn-secondary {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-descriptionForeground);
            cursor: pointer;
        }
        .btn-secondary:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .task-output {
            margin-top: 8px; padding: 10px 12px;
            background: var(--vscode-editor-background);
            border-radius: 6px; border: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }
        .task-output summary {
            cursor: pointer; font-weight: 500;
            color: var(--vscode-textLink-foreground);
        }
        .task-output-files {
            margin-top: 6px; padding-left: 16px;
        }
        .task-output-files li {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px; margin-bottom: 2px;
        }

        .conversion-summary {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px; padding: 16px;
            border: 1px solid var(--vscode-panel-border);
            margin-bottom: 16px;
        }
        .conversion-summary-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .conversion-summary-header h4 { margin: 0; }
        .conversion-summary-actions { flex-shrink: 0; }
        .conversion-summary p {
            font-size: 13px; margin: 0;
            color: var(--vscode-descriptionForeground);
        }

        .prereqs-list {
            margin-top: 8px; padding-left: 20px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .prereqs-list li { margin-bottom: 4px; }

        .dependency-arrow {
            display: flex; justify-content: center;
            padding: 2px 0;
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
        }

        .empty-state {
            text-align: center; padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state h2 { color: var(--vscode-foreground); }
    </style>
</head>
<body>
    ${
        selectedFlowId
            ? ''
            : `
    <div class="header">
        <h1>Migration Conversion</h1>
        <div class="header-actions">
            <button class="btn btn-outline" onclick="refresh()">↻ Refresh</button>
        </div>
    </div>
    `
    }

    ${
        selectedFlowId
            ? ''
            : `
    <div class="stats-bar">
        <div class="stat-pill">
            <span class="stat-count">${totalFlows}</span> Total Flows
        </div>
        <div class="stat-pill">
            <span class="stat-count">${notStartedCount}</span> Not Started
        </div>
        <div class="stat-pill">
            <span class="stat-count">${inProgressCount}</span> In Progress
        </div>
        <div class="stat-pill">
            <span class="stat-count">${completedCount}</span> Completed
        </div>
    </div>

    <div class="upper-section">
        <div class="section-title">Planned Flows</div>
        <div class="flow-table-wrapper">
            <table class="flow-table">
                <thead>
                    <tr>
                        <th>Flow Name</th>
                        <th>Category</th>
                        <th class="center">Artifacts</th>
                        <th class="center">Status</th>
                        <th class="center">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${flowRowsHtml}
                </tbody>
            </table>
        </div>
    </div>
    `
    }

    ${selectedFlowId ? '' : '<div class="lower-section">'}
        ${selectedFlowId ? `<div class="section-title" style="display: flex; justify-content: space-between; align-items: center;"><div><button class="btn" onclick="goToHome()" title="Back to Home" style="padding: 4px 6px; margin-right: 8px; background: transparent; border: none;"><svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align: -4px;" fill="none" stroke="var(--vscode-button-background)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></button>Conversion Tasks — ${this.escapeHtml(selectedFlowName)}</div></div>` : '<div class="section-title">Conversion Tasks</div>'}
        ${taskSectionHtml}
    ${selectedFlowId ? '' : '</div>'}

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        function selectFlow(flowId) {
            vscode.postMessage({ command: 'selectFlow', data: flowId });
        }

        function startConversion(flowId) {
            vscode.postMessage({ command: 'startConversion', data: flowId });
        }

        function reconvertFlow(flowId) {
            vscode.postMessage({ command: 'reconvert', data: flowId });
        }

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }

        function goToHome() {
            vscode.postMessage({ command: 'goToDiscovery' });
        }

        function goToPlanning() {
            vscode.postMessage({ command: 'goToPlanning' });
        }

        function openInVSCode(flowId) {
            vscode.postMessage({ command: 'openInVSCode', data: flowId });
        }

        function executeTask(flowId, taskId) {
            vscode.postMessage({ command: 'executeTask', data: { flowId, taskId } });
        }

        function skipTask(flowId, taskId) {
            vscode.postMessage({ command: 'skipTask', data: { flowId, taskId } });
        }

        function convertAll(flowId) {
            vscode.postMessage({ command: 'convertAll', data: flowId });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Get action button for a flow row.
     */
    private getFlowActionButton(flow: ConversionFlow): string {
        switch (flow.status) {
            case 'not-started':
                return `<button class="btn btn-sm btn-primary" onclick="startConversion('${this.escapeHtml(flow.id)}')">Plan Conversion</button>`;
            case 'thinking':
                return `<button class="btn btn-sm btn-disabled" disabled>Thinking...</button>`;
            case 'tasks-ready':
            case 'in-progress':
                return (
                    `<button class="btn btn-sm btn-secondary" onclick="selectFlow('${this.escapeHtml(flow.id)}')">View Tasks</button>` +
                    `<button class="btn btn-sm btn-outline" onclick="reconvertFlow('${this.escapeHtml(flow.id)}')" title="Clear and re-generate conversion tasks">Replan Conversion</button>` +
                    `<button class="btn btn-sm btn-icon" onclick="openInVSCode('${this.escapeHtml(flow.id)}')" title="Open generated Logic Apps project in new VS Code window">${this.getVSCodeIconSvg()}</button>`
                );
            case 'completed':
                return (
                    `<button class="btn btn-sm btn-secondary" onclick="selectFlow('${this.escapeHtml(flow.id)}')">${flow.status === 'completed' ? 'View Tasks' : 'View Tasks'}</button>` +
                    `<button class="btn btn-sm btn-outline" onclick="reconvertFlow('${this.escapeHtml(flow.id)}')" title="Clear and re-generate conversion tasks">Replan Conversion</button>` +
                    `<button class="btn btn-sm btn-icon" onclick="openInVSCode('${this.escapeHtml(flow.id)}')" title="Open generated Logic Apps project in new VS Code window">${this.getVSCodeIconSvg()}</button>`
                );
            case 'failed':
                return `<button class="btn btn-sm btn-primary" onclick="startConversion('${this.escapeHtml(flow.id)}')">Retry</button>`;
            default:
                return '';
        }
    }

    /**
     * Render the task plan for the selected flow.
     */
    private getTaskPlanHtml(plan: ConversionTaskPlan): string {
        const sortedTasks = [...plan.tasks].sort((a, b) => a.order - b.order);

        const completedCount = sortedTasks.filter(
            (t) => t.status === 'completed' || t.status === 'skipped'
        ).length;
        const totalCount = sortedTasks.length;

        const prerequisitesHtml =
            plan.prerequisites && plan.prerequisites.length > 0
                ? `<ul class="prereqs-list">${plan.prerequisites.map((p) => `<li>${this.escapeHtml(p)}</li>`).join('')}</ul>`
                : '';

        const taskCardsHtml = sortedTasks
            .map((task, index) => {
                const orderClass =
                    task.status === 'completed' || task.status === 'skipped'
                        ? 'completed'
                        : task.status === 'in-progress'
                          ? 'in-progress'
                          : task.status === 'failed'
                            ? 'failed'
                            : '';

                const statusBadge = this.getTaskStatusBadgeHtml(task.status);

                const dependsOnHtml =
                    task.dependsOn.length > 0
                        ? `<span class="task-meta-item">Depends on: ${task.dependsOn.map((d) => `#${this.escapeHtml(d)}`).join(', ')}</span>`
                        : '';

                const estimateHtml =
                    task.estimatedMinutes !== undefined
                        ? `<span class="task-meta-item">~${task.estimatedMinutes}min</span>`
                        : '';

                const outputHtml = task.output ? this.getTaskOutputHtml(task.output) : '';

                // Determine if task can be executed
                const depsCompleted = task.dependsOn.every((depId) => {
                    const depTask = sortedTasks.find((t) => t.id === depId);
                    return (
                        depTask && (depTask.status === 'completed' || depTask.status === 'skipped')
                    );
                });
                const canExecute =
                    (task.status === 'pending' || task.status === 'failed') && depsCompleted;
                const isRunning = task.status === 'in-progress';
                const isDone = task.status === 'completed' || task.status === 'skipped';

                // Check if the flow is in-progress (Convert All running) — disable individual buttons
                const flowObj = this.conversionService.getFlows().find((f) => f.id === plan.flowId);
                const flowBusy =
                    flowObj?.status === 'in-progress' ||
                    flowObj?.executeAllActive === true ||
                    this.conversionService.isExecuteAllActive(plan.flowId);

                let taskActionHtml = '';
                // Optional tasks remain actionable even during Execute All (since they're excluded from it)
                const effectiveFlowBusy = flowBusy && !task.optional;
                const skipBtnHtml =
                    task.optional && canExecute && !effectiveFlowBusy
                        ? ` <button class="btn btn-sm btn-secondary task-action-btn" onclick="skipTask('${this.escapeHtml(plan.flowId)}', '${this.escapeHtml(task.id)}')" title="Skip this optional task">⏭ Skip</button>`
                        : '';
                if (canExecute && !effectiveFlowBusy) {
                    taskActionHtml = `<button class="btn btn-sm btn-primary task-action-btn" onclick="executeTask('${this.escapeHtml(plan.flowId)}', '${this.escapeHtml(task.id)}')" title="Execute this conversion task">▶ Execute</button>${skipBtnHtml}`;
                } else if (isRunning || (canExecute && effectiveFlowBusy)) {
                    taskActionHtml = `<button class="btn btn-sm btn-disabled task-action-btn" disabled>Executing...</button>`;
                } else if (isDone) {
                    taskActionHtml = `<span class="task-done-label">✓ Done</span> <button class="btn btn-sm btn-outline" onclick="executeTask('${this.escapeHtml(plan.flowId)}', '${this.escapeHtml(task.id)}')" title="Re-execute this task" style="margin-left: 4px;">↻ Re-Execute</button>`;
                } else {
                    taskActionHtml = `<button class="btn btn-sm btn-disabled task-action-btn" disabled title="Waiting for dependencies: ${task.dependsOn.join(', ')}">▶ Execute</button>`;
                }

                const arrowHtml =
                    index < sortedTasks.length - 1 ? '<div class="dependency-arrow">↓</div>' : '';

                const optionalBadge = task.optional
                    ? '<span class="task-optional-badge">Optional</span>'
                    : '';

                return `
                    <div class="task-card">
                        <div class="task-order ${orderClass}">${task.order}</div>
                        <div class="task-body">
                            <div class="task-name-row">
                                <div class="task-name">${this.escapeHtml(task.name)} ${statusBadge} ${optionalBadge}</div>
                                <div class="task-action">${taskActionHtml}</div>
                            </div>
                            <div class="task-desc">${this.escapeHtml(task.description)}</div>
                            <div class="task-meta">
                                <span class="task-meta-item">Type: ${this.escapeHtml(task.type)}</span>
                                ${dependsOnHtml}
                                ${estimateHtml}
                            </div>
                            ${outputHtml}
                        </div>
                    </div>
                    ${arrowHtml}`;
            })
            .join('');

        const hasPendingTasks = sortedTasks.some(
            (t) => t.status === 'pending' || t.status === 'failed'
        );
        const hasRunningTask = sortedTasks.some((t) => t.status === 'in-progress');
        const allDone = completedCount === totalCount;

        // Also check if the flow itself is marked as in-progress (Convert All still running
        // even if no individual task is currently in-progress between task transitions)
        const flowState = this.conversionService.getFlows().find((f) => f.id === plan.flowId);
        const flowInProgress =
            flowState?.status === 'in-progress' ||
            flowState?.executeAllActive === true ||
            this.conversionService.isExecuteAllActive(plan.flowId);

        let convertAllBtnHtml = '';
        if (allDone) {
            convertAllBtnHtml = `<span class="task-done-label" style="font-size: 13px;">✓ All tasks complete</span>`;
        } else if (hasRunningTask || flowInProgress) {
            convertAllBtnHtml = `<button class="btn btn-sm btn-disabled" disabled>Executing...</button>`;
        } else if (hasPendingTasks) {
            convertAllBtnHtml = `<button class="btn btn-sm btn-primary" onclick="convertAll('${this.escapeHtml(plan.flowId)}')">▶ Execute All</button>`;
        }

        return `
            <div class="conversion-summary">
                <div class="conversion-summary-header">
                    <h4>Conversion Plan — ${completedCount}/${totalCount} tasks complete</h4>
                    <div class="conversion-summary-actions" style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-outline" onclick="reconvertFlow('${this.escapeHtml(plan.flowId)}')" title="Clear and regenerate conversion tasks">↻ Regenerate Tasks</button>
                        ${convertAllBtnHtml}
                    </div>
                </div>
                <p>${this.escapeHtml(plan.summary)}</p>
                ${prerequisitesHtml}
            </div>
            <div class="task-list">
                ${taskCardsHtml}
            </div>`;
    }

    /**
     * Render output details for a completed task.
     */
    private getTaskOutputHtml(output: ConversionTaskOutput): string {
        const filesHtml =
            output.generatedFiles && output.generatedFiles.length > 0
                ? `<ul class="task-output-files">${output.generatedFiles.map((f: string) => `<li>${this.escapeHtml(f)}</li>`).join('')}</ul>`
                : '';

        const warningsHtml =
            output.warnings && output.warnings.length > 0
                ? `<div style="margin-top: 4px; color: var(--vscode-editorWarning-foreground);">⚠ ${output.warnings.map((w: string) => this.escapeHtml(w)).join('<br>')}</div>`
                : '';

        return `
            <details class="task-output">
                <summary>Output: ${this.escapeHtml(output.summary)}</summary>
                ${filesHtml}
                ${warningsHtml}
            </details>`;
    }

    /**
     * Placeholder when a flow is selected but has no task plan yet.
     */
    private getTaskPlaceholderHtml(flowId: string): string {
        // Check if the flow is currently in 'thinking' state
        const flow = this.conversionService.getFlows().find((f) => f.id === flowId);
        if (flow?.status === 'thinking') {
            return `
            <div class="task-placeholder">
                <h3>Generating Conversion Tasks…</h3>
                <p>The converter agent is analysing the planning results. Check the chat panel for progress.</p>
            </div>`;
        }

        return `
            <div class="task-placeholder">
                <h3>Ready to Execute</h3>
                <p>Click "Plan Conversion" to have the converter agent analyse the planning results and determine the ordered conversion tasks for this flow.</p>
                <br>
                <button class="btn btn-primary" onclick="startConversion('${this.escapeHtml(flowId)}')">
                    Plan Conversion
                </button>
            </div>`;
    }

    /**
     * Prompt to select a flow.
     */
    private getSelectFlowPromptHtml(): string {
        return `
            <div class="task-placeholder">
                <h3>Select a Flow</h3>
                <p>Select a planned flow from the table above to view or start its conversion tasks.</p>
            </div>`;
    }

    /**
     * Empty state when no planned flows exist.
     */
    private getEmptyStateHtml(nonce: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${this.panel.webview.cspSource} data:;">
    <title>Migration Conversion</title>
    <style>
        body {
            font-family: var(--vscode-editor-font-family, 'Segoe UI', sans-serif);
            padding: 20px; color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            text-align: center;
        }
        .empty-state { padding: 60px 20px; }
        .empty-state h2 { color: var(--vscode-foreground); }
        .empty-state p { color: var(--vscode-descriptionForeground); }
        .btn {
            padding: 8px 18px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none; border-radius: 4px;
            cursor: pointer; font-size: 13px;
        }
        .btn:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <div class="empty-state">
        <h2>No Planned Flows Available</h2>
        <p>Complete the Planning stage first to generate migration plans for your flows.</p>
        <br>
        <button class="btn" onclick="goToPlanning()">Go to Planning</button>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        function goToPlanning() {
            vscode.postMessage({ command: 'goToPlanning' });
        }
    </script>
</body>
</html>`;
    }

    // =========================================================================
    // Badge Helpers
    // =========================================================================

    private getStatusBadgeHtml(status: ConversionFlowStatus): string {
        const labels: Record<ConversionFlowStatus, string> = {
            'not-started': 'Not Started',
            thinking: 'Thinking…',
            'tasks-ready': 'Tasks Ready',
            'in-progress': 'In Progress',
            completed: 'Completed',
            failed: 'Failed',
        };
        return `<span class="status-badge status-${status}">${labels[status]}</span>`;
    }

    private getTaskStatusBadgeHtml(status: ConversionTaskStatus): string {
        const labels: Record<ConversionTaskStatus, string> = {
            pending: 'Pending',
            'in-progress': 'In Progress',
            completed: 'Completed',
            failed: 'Failed',
            skipped: 'Skipped',
        };
        return `<span class="task-status-badge task-status-${status}">${labels[status]}</span>`;
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Get the VS Code icon as inline SVG.
     */
    private getVSCodeIconSvg(): string {
        // Use the official VS Code icon as inline SVG with proper colors
        return `<svg width="20" height="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><path d="M180.828 252.605a15.872 15.872 0 0 0 12.65-.486l52.501-25.262a15.94 15.94 0 0 0 9.025-14.364V43.507a15.94 15.94 0 0 0-9.025-14.363L193.477 3.881a15.913 15.913 0 0 0-18.14 3.317L74.862 105.282 31.093 71.825a10.636 10.636 0 0 0-13.593.876L3.467 85.578c-5.006 4.56-5.006 12.284 0 16.844l37.987 34.713-37.987 34.712c-5.006 4.561-5.006 12.285 0 16.845l14.033 12.876a10.636 10.636 0 0 0 13.593.877l43.769-33.457 100.475 98.084a15.857 15.857 0 0 0 5.491 3.533zM193.479 69.07l-75.14 58.062 75.14 58.063V69.07z" fill="#0078d4"/></svg>`;
    }

    /**
     * Open the generated Logic Apps project in a new VS Code window.
     */
    private openProjectInVSCode(flowId: string): void {
        const taskPlan = this.conversionService.getTaskPlan(flowId);
        if (!taskPlan) {
            vscode.window.showWarningMessage(UserPrompts.NO_CONVERSION_TASK_PLAN);
            return;
        }

        // Find the scaffold task output to get the project root
        const scaffoldTask = taskPlan.tasks.find(
            (t) => t.type === 'scaffold-project' || t.order === 1
        );

        let projectPath: string | undefined;

        if (scaffoldTask?.output?.generatedFiles && scaffoldTask.output.generatedFiles.length > 0) {
            const generated = scaffoldTask.output.generatedFiles.map((f) => f.replace(/\\/g, '/'));
            const workspaceFile = generated.find((f) => f.endsWith('.code-workspace'));

            if (workspaceFile) {
                projectPath = path.posix.dirname(workspaceFile);
            } else {
                const hostFile = generated.find(
                    (f) => f.endsWith('/host.json') || f === 'host.json'
                );
                if (hostFile) {
                    projectPath = path.posix.dirname(hostFile);
                } else {
                    const firstFile = generated[0];
                    projectPath = path.posix.dirname(firstFile);
                }
            }

            if (!projectPath || projectPath === '.') {
                projectPath = undefined;
            }
        }

        // Fallback: look through all tasks for any generated files
        if (!projectPath) {
            for (const task of taskPlan.tasks) {
                if (task.output?.generatedFiles && task.output.generatedFiles.length > 0) {
                    const generated = task.output.generatedFiles.map((f) => f.replace(/\\/g, '/'));
                    const workspaceFile = generated.find((f) => f.endsWith('.code-workspace'));
                    const candidate = workspaceFile
                        ? path.posix.dirname(workspaceFile)
                        : path.posix.dirname(generated[0]);
                    if (candidate && candidate !== '.') {
                        projectPath = candidate;
                        break;
                    }
                }
            }
        }

        // Fallback: use out/<flow-name> as folder name
        if (!projectPath) {
            const safeName = taskPlan.flowName
                .replace(/[^a-zA-Z0-9_-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            projectPath = path.posix.join('out', safeName);
        }

        // Resolve against workspace folder
        const wsFolder = vscode.workspace.workspaceFolders?.[0];
        if (!wsFolder) {
            vscode.window.showErrorMessage(UserPrompts.NO_WORKSPACE_FOLDER);
            return;
        }

        const fullPath = vscode.Uri.joinPath(wsFolder.uri, projectPath);

        // Look for a .code-workspace file in the project folder
        const projectDir = fullPath.fsPath;

        let workspaceFile: string | undefined;
        if (fs.existsSync(projectDir)) {
            const files = fs.readdirSync(projectDir) as string[];
            workspaceFile = files.find((f: string) => f.endsWith('.code-workspace'));
        }

        if (workspaceFile) {
            const workspaceUri = vscode.Uri.file(path.join(projectDir, workspaceFile));
            this.logger.info(`[ConversionWebview] Opening workspace file: ${workspaceUri.fsPath}`);
            vscode.commands.executeCommand('vscode.openFolder', workspaceUri, {
                forceNewWindow: true,
            });
        } else if (fs.existsSync(projectDir)) {
            // Auto-create .code-workspace file — required by Logic Apps Standard extension
            const folderName = path.basename(projectDir);
            const wsFileName = `${folderName}.code-workspace`;
            const wsFilePath = path.join(projectDir, wsFileName);
            const wsContent = JSON.stringify({ folders: [{ path: '.' }], settings: {} }, null, 2);
            fs.writeFileSync(wsFilePath, wsContent, 'utf-8');
            this.logger.info(
                `[ConversionWebview] Created ${wsFileName} and opening workspace: ${wsFilePath}`
            );
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(wsFilePath), {
                forceNewWindow: true,
            });
        } else {
            this.logger.warn(`[ConversionWebview] Project folder not found: ${fullPath.fsPath}`);
            vscode.window.showWarningMessage(UserPrompts.projectFolderNotFound(projectPath));
        }
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    // =========================================================================
    // Disposable
    // =========================================================================

    public dispose(): void {
        ConversionWebviewPanel.currentPanel = undefined;
        this.panel.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
