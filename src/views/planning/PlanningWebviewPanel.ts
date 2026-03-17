/**
 * Planning Webview Panel
 *
 * Webview panel for the Planning stage. Displays discovered flows in
 * the upper section for selection and shows the generated migration
 * plan in the lower section.
 *
 * @module views/planning/PlanningWebviewPanel
 */

import * as vscode from 'vscode';
import { LoggingService } from '../../services/LoggingService';
import { PlanningService } from '../../stages/planning/PlanningService';
import { PlanningFlow, FlowMigrationPlan } from '../../stages/planning/types';
import {
    PlanningCacheService,
    FlowPlanningResult,
} from '../../stages/planning/PlanningCacheService';
import { PlanningFileService } from '../../stages/planning/PlanningFileService';
import { SourceFlowVisualizer } from '../discovery/SourceFlowVisualizer';
import { UserPrompts } from '../../constants/UserMessages';

// =============================================================================
// Planning Webview Panel
// =============================================================================

/**
 * Webview panel for the Planning stage.
 */
export class PlanningWebviewPanel implements vscode.Disposable {
    public static currentPanel: PlanningWebviewPanel | undefined;
    public static readonly viewType = 'logicAppsMigrationAssistant.planningView';

    private readonly panel: vscode.WebviewPanel;
    private readonly logger = LoggingService.getInstance();
    private readonly planningService = PlanningService.getInstance();
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

        // Listen for planning state changes
        this.disposables.push(
            this.planningService.onStateChange(() => {
                this.update();
            })
        );
    }

    /**
     * Create or show the panel.
     */
    public static createOrShow(extensionUri: vscode.Uri): PlanningWebviewPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (PlanningWebviewPanel.currentPanel) {
            PlanningWebviewPanel.currentPanel.panel.reveal(column);
            PlanningWebviewPanel.currentPanel.update();
            return PlanningWebviewPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            PlanningWebviewPanel.viewType,
            'Planning',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            }
        );

        PlanningWebviewPanel.currentPanel = new PlanningWebviewPanel(panel, extensionUri);
        return PlanningWebviewPanel.currentPanel;
    }

    /**
     * Update the webview content.
     */
    public update(): void {
        // Prevent re-entrant updates from state-change feedback loops
        if (this.updating) {
            return;
        }
        this.updating = true;

        try {
            // Always rebuild flows from discovery to pick up latest grouping
            const flows = this.planningService.buildFlowsFromDiscovery();

            const state = this.planningService.getState();
            const selectedFlowId = state?.selectedFlowId;
            const selectedPlan = selectedFlowId
                ? this.planningService.getPlan(selectedFlowId)
                : undefined;

            // Also check for a cached planning result (has mermaid diagram)
            const cachedPlanResult = selectedFlowId
                ? PlanningCacheService.getInstance().get(selectedFlowId)
                : undefined;

            this.logger.info(
                `[PlanningWebview] update: selectedFlowId=${selectedFlowId}, hasPlan=${!!selectedPlan}, hasCachedResult=${!!cachedPlanResult}, flowCount=${flows.length}`
            );

            this.panel.webview.html = this.getHtmlContent(
                flows,
                selectedFlowId,
                selectedPlan,
                cachedPlanResult
            );
        } catch (err) {
            this.logger.error(
                `[PlanningWebview] update error: ${err instanceof Error ? err.message : String(err)}`
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
            `[PlanningWebview] message received: ${message.command} data=${JSON.stringify(message.data)}`
        );
        switch (message.command) {
            case 'selectFlow': {
                const flowId = message.data as string;
                if (flowId) {
                    void this.planningService.selectFlow(flowId);
                    this.logger.info(`Flow selected for planning: ${flowId}`);
                }
                break;
            }

            case 'startPlanning': {
                const flowId = message.data as string;
                if (flowId) {
                    void this.planningService.selectFlow(flowId);
                    this.logger.info(`Planning started for flow: ${flowId}`);
                    // Trigger plan generation via command
                    vscode.commands
                        .executeCommand('logicAppsMigrationAssistant.generatePlanForFlow', flowId)
                        .then(
                            () =>
                                this.logger.info(`Planning command completed for flow: ${flowId}`),
                            (err) => {
                                this.logger.error(
                                    `Planning command failed for flow: ${flowId} — ${err}`
                                );
                                vscode.window.showErrorMessage(
                                    UserPrompts.failedToStartPlanningPanel(err)
                                );
                            }
                        );
                }
                break;
            }

            case 'replan': {
                const flowId = message.data as string;
                if (flowId) {
                    this.logger.info(`Replan requested for flow: ${flowId}`);
                    // Remove cached plan from disk and memory
                    PlanningCacheService.getInstance()
                        .remove(flowId)
                        .then(() => {
                            // Also remove planning files (new multi-file structure)
                            PlanningFileService.getInstance().removeFlow(flowId);

                            // Reset flow status to not-started so storePlan can set it again
                            const state = this.planningService.getState();
                            const flow = state?.flows.find((f) => f.id === flowId);
                            if (flow) {
                                flow.status = 'not-started';
                            }
                            // Also remove the in-memory plan
                            if (state?.plans[flowId]) {
                                delete state.plans[flowId];
                            }
                            // Trigger plan generation via command (same as startPlanning)
                            void this.planningService.selectFlow(flowId);
                            this.update();
                            vscode.commands
                                .executeCommand('logicAppsMigrationAssistant.generatePlanForFlow', flowId)
                                .then(
                                    () =>
                                        this.logger.info(
                                            `Replan command completed for flow: ${flowId}`
                                        ),
                                    (err) => {
                                        this.logger.error(
                                            `Replan command failed for flow: ${flowId} — ${err}`
                                        );
                                        vscode.window.showErrorMessage(
                                            UserPrompts.failedToReplan(err)
                                        );
                                    }
                                );
                        })
                        .catch((err) => {
                            this.logger.error(`Failed to clear plan for replan: ${err}`);
                            vscode.window.showErrorMessage(UserPrompts.failedToClearPlan(err));
                        });
                }
                break;
            }

            case 'refresh': {
                this.planningService.buildFlowsFromDiscovery();
                this.update();
                break;
            }

            case 'goToDiscovery': {
                void vscode.commands.executeCommand('logicAppsMigrationAssistant.viewFlowVisualization');
                void vscode.commands.executeCommand('logicAppsMigrationAssistant.discovery.focus');
                break;
            }
        }
    }

    /**
     * Get HTML content for webview.
     */
    private getHtmlContent(
        flows: PlanningFlow[],
        selectedFlowId: string | undefined,
        selectedPlan: FlowMigrationPlan | undefined,
        cachedPlanResult?: FlowPlanningResult
    ): string {
        const nonce = this.getNonce();

        if (flows.length === 0) {
            return this.getEmptyStateHtml(nonce);
        }

        const flowRowsHtml = flows
            .map((flow) => {
                const isSelected = flow.id === selectedFlowId;
                const statusBadge = this.getStatusBadgeHtml(flow.status);
                const complexityBadge = flow.complexity
                    ? `<span class="complexity-badge complexity-${flow.complexity}">${flow.complexity}</span>`
                    : '<span class="complexity-badge complexity-unknown">TBD</span>';

                // Check if this flow group has been analyzed in the Discovery stage
                const isAnalyzed =
                    flow.id === 'ungrouped-artifacts' ||
                    !!SourceFlowVisualizer.getGroupAnalysis(flow.id);
                const planButtonDisabled =
                    !isAnalyzed && flow.status !== 'planned' && flow.status !== 'approved';

                return `
                <tr class="flow-row ${isSelected ? 'selected' : ''}" data-flow-id="${this.escapeHtml(flow.id)}">
                    <td>
                        <span class="flow-name" onclick="selectFlow('${this.escapeHtml(flow.id)}')">
                            ${this.escapeHtml(flow.name)}
                        </span>
                    </td>
                    <td>${this.escapeHtml(flow.category)}</td>
                    <td class="center">${flow.artifactCount}</td>
                    <td class="center">${complexityBadge}</td>
                    <td class="center">${statusBadge}</td>
                    <td class="center">
                        ${
                            planButtonDisabled
                                ? `<button class="btn btn-sm btn-disabled" disabled title="Analysis pending — generate the flow visualization in Discovery first">
                                Start Planning
                            </button>`
                                : flow.status === 'in-progress'
                                  ? this.planningService.getPlan(flow.id)
                                      ? `<button class="btn btn-sm btn-secondary"
                                onclick="selectFlow('${this.escapeHtml(flow.id)}')">
                            View Plan
                        </button>`
                                      : `<button class="btn btn-sm btn-secondary"
                                onclick="selectFlow('${this.escapeHtml(flow.id)}')" title="Plan generation is in progress — check the chat panel">
                            In Progress…
                        </button>`
                                  : flow.status === 'planned' || flow.status === 'approved'
                                    ? `<button class="btn btn-sm btn-secondary"
                                onclick="selectFlow('${this.escapeHtml(flow.id)}')">
                            View Plan
                        </button>`
                                    : `<button class="btn btn-sm btn-primary"
                                onclick="startPlanning('${this.escapeHtml(flow.id)}')">
                            Start Planning
                        </button>`
                        }
                        ${flow.status === 'planned' || flow.status === 'approved' || (flow.status === 'in-progress' && this.planningService.getPlan(flow.id)) ? `<button class="btn btn-sm btn-outline" onclick="replanFlow('${this.escapeHtml(flow.id)}')" title="Clear existing plan and re-generate">Replan</button>` : ''}
                    </td>
                </tr>`;
            })
            .join('');

        // Check if the selected flow has been analyzed
        const selectedFlow = selectedFlowId
            ? flows.find((f) => f.id === selectedFlowId)
            : undefined;
        const selectedFlowAnalyzed = selectedFlow
            ? selectedFlow.id === 'ungrouped-artifacts' ||
              !!SourceFlowVisualizer.getGroupAnalysis(selectedFlow.id)
            : false;

        const planSectionHtml = cachedPlanResult
            ? this.getCachedPlanResultHtml(cachedPlanResult)
            : selectedPlan
              ? this.getPlanContentHtml(selectedPlan)
              : selectedFlowId
                ? this.getPlanPlaceholderHtml(selectedFlowId, selectedFlowAnalyzed)
                : this.getSelectFlowPromptHtml();

        // Compute summary stats
        const totalFlows = flows.length;
        const plannedCount = flows.filter(
            (f) => f.status === 'planned' || f.status === 'approved'
        ).length;
        const inProgressCount = flows.filter((f) => f.status === 'in-progress').length;
        const notStartedCount = flows.filter((f) => f.status === 'not-started').length;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src data: https:;">
    <title>Migration Planning</title>
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
        }

        h1, h2, h3, h4 {
            color: var(--vscode-foreground);
            margin-top: 0;
        }

        /* ==================== Header ==================== */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        /* ==================== Stats Bar ==================== */
        .stats-bar {
            display: flex;
            gap: 16px;
            margin-bottom: 20px;
        }

        .stat-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 20px;
            font-size: 12px;
        }

        .stat-pill .stat-count {
            font-weight: bold;
            font-size: 14px;
            color: var(--vscode-textLink-foreground);
        }

        /* ==================== Buttons ==================== */
        .btn {
            padding: 6px 14px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            white-space: nowrap;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-sm {
            padding: 4px 10px;
            font-size: 12px;
        }

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
            opacity: 0.5;
            cursor: not-allowed;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-disabled:hover {
            background: var(--vscode-button-secondaryBackground);
        }

        /* ==================== Layout: Upper & Lower ==================== */
        .upper-section {
            margin-bottom: 24px;
        }

        .lower-section {
            border-top: 2px solid var(--vscode-panel-border);
            padding-top: 20px;
        }

        .section-title {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* ==================== Flow Table ==================== */
        .flow-table-wrapper {
            max-height: 210px; /* ~5 rows */
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            scroll-behavior: smooth;
            position: relative;
        }

        .flow-table-wrapper::after {
            content: '';
            position: sticky;
            bottom: 0;
            left: 0;
            right: 0;
            display: block;
            height: 24px;
            background: linear-gradient(transparent, var(--vscode-editor-background));
            pointer-events: none;
        }

        .flow-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .flow-table th,
        .flow-table td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .flow-table th {
            background: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            position: sticky;
            top: 0;
            z-index: 1;
        }

        .flow-table td.center,
        .flow-table th.center {
            text-align: center;
        }

        .flow-row {
            transition: background-color 0.15s;
        }

        .flow-row:nth-child(even) {
            background: rgba(255,255,255,0.02);
        }

        .flow-row:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .flow-row.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .flow-name {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            font-weight: 500;
        }

        .flow-name:hover {
            text-decoration: underline;
        }

        /* ==================== Badges ==================== */
        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
        }

        .status-not-started {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-descriptionForeground);
        }

        .status-in-progress {
            background: rgba(0, 120, 212, 0.15);
            color: var(--vscode-editorInfo-foreground);
            border: 1px solid var(--vscode-editorInfo-foreground);
        }

        .status-planned {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }

        .status-approved {
            background: var(--vscode-charts-green);
            color: white;
        }

        .complexity-badge {
            display: inline-flex;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
        }

        .complexity-low {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }

        .complexity-medium {
            background: var(--vscode-editorWarning-foreground);
            color: white;
        }

        .complexity-high {
            background: var(--vscode-errorForeground);
            color: white;
        }

        .complexity-very-high {
            background: var(--vscode-errorForeground);
            color: white;
        }

        .complexity-unknown {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-descriptionForeground);
        }

        /* ==================== Plan Section ==================== */
        .plan-placeholder {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .plan-placeholder h3 {
            color: var(--vscode-foreground);
        }

        .plan-content {
            display: grid;
            gap: 16px;
        }

        .plan-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            padding: 16px;
            border: 1px solid var(--vscode-panel-border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
            transition: box-shadow 0.15s;
        }

        .plan-card:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .plan-card h4 {
            margin: 0 0 10px 0;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
        }

        .plan-card h4 .collapse-icon {
            display: inline-flex;
            width: 16px;
            height: 16px;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            transition: transform 0.2s;
            flex-shrink: 0;
            color: var(--vscode-descriptionForeground);
        }

        .plan-card.collapsed h4 .collapse-icon {
            transform: rotate(-90deg);
        }

        .plan-card .plan-card-body {
            transition: max-height 0.25s ease, opacity 0.2s ease;
            overflow: hidden;
        }

        .plan-card.collapsed .plan-card-body {
            max-height: 0 !important;
            opacity: 0;
            margin: 0;
            padding: 0;
        }

        .plan-card h4 .section-count {
            font-size: 11px;
            font-weight: 600;
            padding: 1px 7px;
            border-radius: 10px;
            background: var(--vscode-textLink-foreground);
            color: white;
            margin-left: auto;
        }

        .plan-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
        }

        .plan-stat {
            text-align: center;
        }

        .plan-stat .value {
            font-size: 28px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .plan-stat .label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }

        .mapping-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .mapping-list li {
            padding: 6px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .mapping-list li:last-child {
            border-bottom: none;
        }

        .mapping-type {
            display: inline-flex;
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .mapping-direct {
            background: var(--vscode-testing-iconPassed);
        }

        .mapping-adapted {
            background: var(--vscode-editorWarning-foreground);
        }

        .mapping-gap {
            background: var(--vscode-errorForeground);
        }

        .gap-item {
            padding: 8px 12px;
            margin-bottom: 8px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            border-left: 3px solid;
            font-size: 12px;
        }

        .gap-high { border-color: var(--vscode-errorForeground); }
        .gap-medium { border-color: var(--vscode-editorWarning-foreground); }
        .gap-low { border-color: var(--vscode-editorInfo-foreground); }

        .gap-item .gap-title {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .gap-item .gap-desc {
            color: var(--vscode-descriptionForeground);
        }

        /* ==================== Mermaid Diagram ==================== */
        .mermaid-wrapper {
            position: relative;
        }
        .mermaid-zoom-controls {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: var(--vscode-titleBar-activeBackground);
            border: 1px solid var(--vscode-panel-border);
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            font-size: 12px;
        }
        .mermaid-zoom-controls button {
            padding: 2px 8px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        .mermaid-zoom-controls button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .mermaid-zoom-controls .zoom-level {
            min-width: 40px;
            text-align: center;
            font-weight: 600;
        }
        .mermaid-container {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 0 0 4px 4px;
            padding: 16px;
            overflow: auto;
            max-height: 160vh;
            cursor: grab;
        }
        .mermaid-container:active {
            cursor: grabbing;
        }
        .mermaid-container .mermaid-inner {
            transform-origin: top left;
            transition: transform 0.15s ease;
        }

        .mermaid-source {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            line-height: 1.5;
            margin: 0;
            color: var(--vscode-editor-foreground);
        }

        .plan-details {
            display: grid;
            gap: 16px;
        }

        /* ==================== Sticky Plan Header ==================== */
        .plan-header-sticky {
            position: sticky;
            top: 0;
            z-index: 50;
            background: var(--vscode-editor-background);
            padding: 12px 0;
            margin: -12px 0 0 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        /* ==================== Action Mapping Arrow ==================== */
        .flow-table .mapping-arrow {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .flow-table .mapping-arrow .arrow-icon {
            display: inline-block;
            width: 20px;
            height: 12px;
            position: relative;
        }

        .flow-table .mapping-arrow .arrow-icon::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            width: 14px;
            height: 2px;
            background: var(--vscode-textLink-foreground);
            transform: translateY(-50%);
        }

        .flow-table .mapping-arrow .arrow-icon::after {
            content: '';
            position: absolute;
            top: 50%;
            right: 2px;
            width: 0;
            height: 0;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            border-left: 6px solid var(--vscode-textLink-foreground);
            transform: translateY(-50%);
        }

        /* Zebra striping in plan tables too */
        .plan-card .flow-table tbody tr:nth-child(even) {
            background: rgba(255,255,255,0.02);
        }

        /* ==================== Logic Apps Designer View ==================== */
        .designer-canvas {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 24px 16px;
            overflow-x: auto;
            min-height: 120px;
        }

        .designer-workflow {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0;
            min-width: 260px;
        }

        .designer-connector {
            width: 2px;
            height: 32px;
            background: var(--vscode-textLink-foreground);
            position: relative;
        }

        .designer-connector::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid var(--vscode-textLink-foreground);
        }

        .designer-card {
            width: 260px;
            border-radius: 8px;
            overflow: visible;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            transition: box-shadow 0.15s;
            position: relative;
        }

        .designer-card:hover {
            box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        }

        .designer-card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            font-size: 13px;
            font-weight: 600;
            color: white;
            border-radius: 8px;
            position: relative;
        }

        /* ---- Connection badge (inside card, right side) ---- */
        .designer-conn-badge {
            margin-left: auto;
            flex-shrink: 0;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            cursor: default;
        }

        .designer-card-header.trigger {
            background: linear-gradient(135deg, #0078d4, #005a9e);
        }
        .designer-card-header.action {
            background: linear-gradient(135deg, #7b3fb5, #5c2d91);
        }
        .designer-card-header.condition {
            background: linear-gradient(135deg, #107c10, #0b5e0b);
        }
        .designer-card-header.connector {
            background: linear-gradient(135deg, #c740b0, #9b0089);
        }
        .designer-card-header.response {
            background: linear-gradient(135deg, #e3008c, #b5006f);
        }

        .designer-card-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 4px;
            background: rgba(255,255,255,0.18);
            font-size: 12px;
            flex-shrink: 0;
        }

        /* ---- Tooltip on hover ---- */
        .designer-card {
            position: relative;
        }
        .designer-card-tooltip {
            display: none;
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            min-width: 220px;
            max-width: 380px;
            padding: 10px 14px;
            margin-top: 6px;
            background: var(--vscode-editorHoverWidget-background, #2d2d30);
            border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
            border-radius: 6px;
            font-size: 11.5px;
            color: var(--vscode-editorHoverWidget-foreground, #ccc);
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            pointer-events: none;
        }
        .designer-card:hover .designer-card-tooltip {
            display: block;
        }
        .designer-card-tooltip .tip-label {
            color: var(--vscode-textLink-foreground, #3794ff);
            font-weight: 600;
            margin-right: 4px;
        }
        .designer-card-tooltip .tip-row {
            margin-bottom: 3px;
        }

        .designer-card-body {
            padding: 10px 14px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.5;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .designer-card-body .card-detail {
            display: flex;
            gap: 6px;
            margin-bottom: 4px;
        }

        .designer-card-body .card-detail-label {
            font-weight: 600;
            color: var(--vscode-foreground);
            min-width: 60px;
        }

        .designer-parallel {
            display: flex;
            gap: 0;
            align-items: flex-start;
            position: relative;
        }

        .designer-branch {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 220px;
            padding: 0 12px;
        }

        .designer-branch-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 6px;
            padding: 2px 10px;
            border-radius: 10px;
            background: rgba(0,120,212,0.12);
        }

        /* Horizontal line connecting branches */
        .designer-branch-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            position: relative;
            height: 32px;
        }

        .designer-branch-bar::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--vscode-textLink-foreground);
        }

        /* Vertical connector from branch bar down into each branch */
        .designer-branch-connector {
            width: 2px;
            height: 24px;
            background: var(--vscode-textLink-foreground);
            position: relative;
        }

        .designer-branch-connector::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid var(--vscode-textLink-foreground);
        }

        /* Merge connector after branches rejoin */
        .designer-merge-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            position: relative;
            height: 32px;
        }

        .designer-merge-bar::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--vscode-textLink-foreground);
        }

        .designer-branch .designer-card {
            width: 210px;
        }

        /* Scope/ForEach/Until container */
        .designer-scope-container {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            margin: 4px 0;
            overflow: hidden;
        }
        .designer-scope-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        .designer-scope-header.scope-type-scope {
            background: rgba(100, 100, 200, 0.15);
            border-bottom: 1px solid rgba(100, 100, 200, 0.3);
        }
        .designer-scope-header.scope-type-foreach {
            background: rgba(0, 150, 136, 0.15);
            border-bottom: 1px solid rgba(0, 150, 136, 0.3);
        }
        .designer-scope-header.scope-type-until {
            background: rgba(255, 152, 0, 0.15);
            border-bottom: 1px solid rgba(255, 152, 0, 0.3);
        }
        .designer-scope-header .scope-badge {
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 8px;
            font-weight: 500;
            text-transform: uppercase;
        }
        .scope-type-scope .scope-badge { background: rgba(100, 100, 200, 0.3); color: #aab0ff; }
        .scope-type-foreach .scope-badge { background: rgba(0, 150, 136, 0.3); color: #4db6ac; }
        .scope-type-until .scope-badge { background: rgba(255, 152, 0, 0.3); color: #ffb74d; }
        .designer-scope-body {
            padding: 8px 12px 12px;
        }
        /* runAfter label on connector */
        .designer-connector-label {
            text-align: center;
            font-size: 10px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 8px;
            margin: 2px auto;
            width: fit-content;
        }
        .runafter-failed {
            background: rgba(220, 53, 69, 0.2);
            color: #dc3545;
        }
        .runafter-skipped {
            background: rgba(108, 117, 125, 0.2);
            color: #6c757d;
        }
        .runafter-timedout {
            background: rgba(255, 193, 7, 0.2);
            color: #ffc107;
        }

        .designer-workflow-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
            text-align: center;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .designer-workflow-title::before,
        .designer-workflow-title::after {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--vscode-panel-border);
        }

        .designer-tabs {
            display: flex;
            gap: 2px;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .designer-tab {
            padding: 6px 16px;
            font-size: 12px;
            cursor: pointer;
            border: none;
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border-bottom: 2px solid transparent;
            transition: all 0.15s;
        }

        .designer-tab:hover {
            color: var(--vscode-foreground);
        }

        .designer-tab.active {
            color: var(--vscode-textLink-foreground);
            border-bottom-color: var(--vscode-textLink-foreground);
            font-weight: 600;
        }

        .designer-tab-content {
            display: none;
        }

        .designer-tab-content.active {
            display: block;
        }

        /* ==================== Plan-Level Tabs (Overview / Workflows) ==================== */
        .plan-tabs {
            display: flex;
            gap: 0;
            margin-bottom: 0;
            border-bottom: 2px solid var(--vscode-panel-border);
            overflow-x: auto;
        }

        .plan-tab {
            padding: 10px 20px;
            font-size: 13px;
            cursor: pointer;
            border: none;
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            transition: all 0.15s;
            white-space: nowrap;
            font-weight: 500;
        }

        .plan-tab:hover {
            color: var(--vscode-foreground);
            background: var(--vscode-list-hoverBackground);
        }

        .plan-tab.active {
            color: var(--vscode-textLink-foreground);
            border-bottom-color: var(--vscode-textLink-foreground);
            font-weight: 600;
        }

        .plan-tab-content {
            display: none;
            padding-top: 16px;
        }

        .plan-tab-content.active {
            display: block;
        }

        /* Workflow JSON collapsible */
        .workflow-json-container {
            max-height: 500px;
            overflow-y: auto;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
        }

        .workflow-json-container pre {
            margin: 0;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        /* Code/Designer toggle inside Designer View */
        .designer-view-header {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
        }

        .code-toggle-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            color: var(--vscode-foreground);
            transition: all 0.15s;
        }

        .code-toggle-btn:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-textLink-foreground);
        }

        .code-toggle-btn.active {
            background: var(--vscode-textLink-foreground);
            color: white;
            border-color: var(--vscode-textLink-foreground);
        }

        .code-toggle-btn .toggle-icon {
            font-size: 13px;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>Migration Planning</h1>
            <p style="margin: 0; color: var(--vscode-descriptionForeground)">
                Select a flow to analyze and generate a migration plan
            </p>
        </div>
        <div class="header-actions">
            <button class="btn btn-outline" onclick="refresh()">↻ Refresh</button>
        </div>
    </div>

    ${
        selectedFlowId
            ? ''
            : `
    <!-- Stats Bar -->
    <div class="stats-bar">
        <div class="stat-pill">
            <span class="stat-count">${totalFlows}</span>
            <span>Total Flows</span>
        </div>
        <div class="stat-pill">
            <span class="stat-count">${notStartedCount}</span>
            <span>Not Started</span>
        </div>
        <div class="stat-pill">
            <span class="stat-count">${inProgressCount}</span>
            <span>In Progress</span>
        </div>
        <div class="stat-pill">
            <span class="stat-count">${plannedCount}</span>
            <span>Planned</span>
        </div>
    </div>

    <!-- Upper Section: Flow List -->
    <div class="upper-section">
        <div class="section-title">Discovered Flows</div>
        <div class="flow-table-wrapper">
            <table class="flow-table">
                <thead>
                    <tr>
                        <th>Flow Name</th>
                        <th>Category</th>
                        <th class="center">Artifacts</th>
                        <th class="center">Complexity</th>
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

    <!-- Lower Section: Plan Details -->
    <div class="lower-section">
        <div class="section-title">Migration Plan</div>
        ${planSectionHtml}
    </div>

    <!-- Script 1: Core click handlers (must load before mermaid CDN which may block) -->
    <script>
        const vscode = acquireVsCodeApi();

        // ── Debug overlay (hidden by default; enable manually for troubleshooting) ──
        (function() {
            var showDebugOverlay = false;

            window._dbgLog = function() {};

            if (!showDebugOverlay) {
                return;
            }

            var overlay = document.createElement('div');
            overlay.id = 'js-error-overlay';
            overlay.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:200px;overflow-y:auto;background:rgba(30,0,0,0.92);color:#88cc88;font-family:monospace;font-size:11px;padding:8px 12px;z-index:99999;border-top:2px solid #44aa44;';
            var header = document.createElement('div');
            header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';
            var title = document.createElement('span');
            title.style.cssText = 'font-weight:bold;color:#44aa44;';
            title.textContent = 'JS Console';
            var closeBtn = document.createElement('button');
            closeBtn.textContent = '\u2715';
            closeBtn.style.cssText = 'background:none;border:none;color:#88cc88;cursor:pointer;font-size:14px;';
            closeBtn.addEventListener('click', function() { overlay.style.display = 'none'; });
            header.appendChild(title);
            header.appendChild(closeBtn);
            overlay.appendChild(header);
            var log = document.createElement('div');
            log.id = 'js-error-log';
            overlay.appendChild(log);
            document.body.appendChild(overlay);

            window._dbgLog = function(type, msg) {
                var el = document.getElementById('js-error-log');
                if (!el) return;
                var row = document.createElement('div');
                row.style.cssText = 'padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.1);';
                var color = type === 'error' ? '#ff6b6b' : type === 'warn' ? '#ffaa44' : '#88cc88';
                row.innerHTML = '<span style="color:' + color + ';">[' + type + ']</span> ' + String(msg).replace(/</g, '&lt;');
                el.appendChild(row);
                var ov = document.getElementById('js-error-overlay');
                if (ov) ov.scrollTop = ov.scrollHeight;
            };

            window.onerror = function(msg, src, line, col) {
                window._dbgLog('error', msg + ' (line ' + line + ', col ' + col + ')');
            };
            window.onunhandledrejection = function(e) {
                window._dbgLog('error', 'Unhandled promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
            };
            var origErr = console.error;
            console.error = function() { origErr.apply(console, arguments); window._dbgLog('error', Array.prototype.join.call(arguments, ' ')); };
            var origWarn = console.warn;
            console.warn = function() { origWarn.apply(console, arguments); window._dbgLog('warn', Array.prototype.join.call(arguments, ' ')); };

            window._dbgLog('info', 'Script 1 loaded — core handlers ready');
        })();

        function selectFlow(flowId) {
            window._dbgLog('info', 'selectFlow: ' + flowId);
            vscode.postMessage({ command: 'selectFlow', data: flowId });
        }

        function startPlanning(flowId) {
            window._dbgLog('info', 'startPlanning: ' + flowId);
            vscode.postMessage({ command: 'startPlanning', data: flowId });
        }

        function replanFlow(flowId) {
            window._dbgLog('info', 'replanFlow: ' + flowId);
            vscode.postMessage({ command: 'replan', data: flowId });
        }

        function refresh() {
            window._dbgLog('info', 'refresh');
            vscode.postMessage({ command: 'refresh' });
        }

        function toggleSection(header) {
            var card = header.closest('.plan-card');
            if (card) {
                card.classList.toggle('collapsed');
            }
        }

        // Zoom state per container
        var _zoomLevels = {};
        function zoomDiagram(containerId, delta) {
            var level = _zoomLevels[containerId] || 1.0;
            level = Math.max(0.2, Math.min(3.0, level + delta));
            _zoomLevels[containerId] = level;
            var container = document.getElementById(containerId);
            if (container) {
                var inner = container.querySelector('.mermaid-inner') || container.querySelector('svg');
                if (inner) {
                    inner.style.transform = 'scale(' + level + ')';
                    inner.style.transformOrigin = 'top left';
                }
            }
            var label = document.getElementById(containerId + '-zoom');
            if (label) { label.textContent = Math.round(level * 100) + '%'; }
        }
        function resetZoom(containerId) {
            _zoomLevels[containerId] = 1.0;
            var container = document.getElementById(containerId);
            if (container) {
                var inner = container.querySelector('.mermaid-inner') || container.querySelector('svg');
                if (inner) { inner.style.transform = 'scale(1)'; }
            }
            var label = document.getElementById(containerId + '-zoom');
            if (label) { label.textContent = '100%'; }
        }
        function fitZoom(containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;
            var inner = container.querySelector('.mermaid-inner') || container.querySelector('svg');
            if (!inner) return;
            // Reset first to measure natural size
            inner.style.transform = 'scale(1)';
            var containerWidth = container.clientWidth - 32;
            var innerWidth = inner.scrollWidth || inner.clientWidth;
            if (innerWidth > 0 && containerWidth > 0) {
                var fitLevel = Math.min(1.5, containerWidth / innerWidth);
                _zoomLevels[containerId] = fitLevel;
                inner.style.transform = 'scale(' + fitLevel + ')';
                inner.style.transformOrigin = 'top left';
                var label = document.getElementById(containerId + '-zoom');
                if (label) { label.textContent = Math.round(fitLevel * 100) + '%'; }
            }
        }

        // Mouse-wheel zoom on mermaid containers (Ctrl/Cmd + scroll)
        // Use event delegation on document since containers are rendered dynamically
        document.addEventListener('wheel', function(e) {
            if (!(e.ctrlKey || e.metaKey)) return;
            var target = e.target;
            // Walk up to find the .mermaid-container
            while (target && target !== document) {
                if (target.classList && target.classList.contains('mermaid-container')) {
                    e.preventDefault();
                    var delta = e.deltaY > 0 ? -0.1 : 0.1;
                    zoomDiagram(target.id, delta);
                    return;
                }
                target = target.parentElement;
            }
        }, { passive: false });

        function toggleCodeView(workflowIdx) {
            var prefix = workflowIdx !== undefined ? 'wf' + workflowIdx + '-' : 'wf0-';
            var designerEl = document.getElementById(prefix + 'designer-visual');
            var codeEl = document.getElementById(prefix + 'designer-code');
            var btn = document.getElementById(prefix + 'code-toggle');
            if (!designerEl || !codeEl || !btn) return;
            var showingCode = codeEl.style.display !== 'none';
            if (showingCode) {
                codeEl.style.display = 'none';
                designerEl.style.display = 'block';
                btn.classList.remove('active');
                btn.innerHTML = '<span class="toggle-icon">{}</span> Code';
            } else {
                codeEl.style.display = 'block';
                designerEl.style.display = 'none';
                btn.classList.add('active');
                btn.innerHTML = '<span class="toggle-icon">🎨</span> Designer';
            }
        }

        function switchDesignerTab(tab, workflowIdx) {
            var prefix = workflowIdx !== undefined ? 'wf' + workflowIdx + '-' : '';
            var tabsContainer = workflowIdx !== undefined 
                ? document.getElementById('wf' + workflowIdx + '-designer-tabs')
                : document.querySelector('.designer-tabs');
            if (!tabsContainer) return;
            tabsContainer.querySelectorAll('.designer-tab').forEach(function(t) { t.classList.remove('active'); });
            var btn = tabsContainer.querySelector('.designer-tab[data-tab="' + tab + '"]');
            if (btn) { btn.classList.add('active'); }
            var contentParent = tabsContainer.parentElement;
            if (contentParent) {
                contentParent.querySelectorAll(':scope > .designer-tab-content').forEach(function(c) { c.classList.remove('active'); });
                var panel = document.getElementById(prefix + 'tab-' + tab);
                if (panel) { panel.classList.add('active'); }
            }
            if (tab === 'diagram') {
                var containerId = prefix + 'mermaid-container';
                var container = document.getElementById(containerId);
                if (container && !container.getAttribute('data-rendered')) {
                    container.setAttribute('data-rendered', 'true');
                    window._mermaidRenderQueue = window._mermaidRenderQueue || [];
                    if (typeof renderMermaidForContainer === 'function') {
                        void renderMermaidForContainer(containerId);
                    } else {
                        window._mermaidRenderQueue.push(containerId);
                    }
                }
            }
        }

        function switchPlanTab(tabId) {
            document.querySelectorAll('.plan-tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.plan-tab-content').forEach(function(c) { c.classList.remove('active'); });
            var btn = document.querySelector('.plan-tab[data-plan-tab="' + tabId + '"]');
            if (btn) { btn.classList.add('active'); }
            var panel = document.getElementById('plan-tab-' + tabId);
            if (panel) { panel.classList.add('active'); }
            if (tabId === 'overview') {
                var oc = document.getElementById('overview-mermaid-container');
                if (oc && !oc.getAttribute('data-rendered')) {
                    oc.setAttribute('data-rendered', 'true');
                    window._mermaidRenderQueue = window._mermaidRenderQueue || [];
                    if (typeof renderMermaidForContainer === 'function') {
                        void renderMermaidForContainer('overview-mermaid-container');
                    } else {
                        window._mermaidRenderQueue.push('overview-mermaid-container');
                    }
                }
            }
        }
    </script>

    <!-- Mermaid CDN (synchronous, same pattern as SourceFlowVisualizer) -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

    <!-- Script 2: Mermaid rendering (runs after CDN is loaded) -->
    <script>
        (function() {
            var dbg = typeof window._dbgLog === 'function' ? window._dbgLog : function() {};

            if (typeof mermaid === 'undefined') {
                dbg('error', 'Mermaid CDN failed to load — diagrams will show as text');
                return;
            }
            dbg('info', 'Mermaid CDN loaded successfully');

            var isDark = document.body.classList.contains('vscode-dark') ||
                getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').includes('rgb(3');

            mermaid.initialize({
                startOnLoad: false,
                theme: isDark ? 'dark' : 'default',
                flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
                securityLevel: 'loose'
            });

            function normalizeMermaid(code) {
                var normalized = code.replace(/\\\\n/g, '\\n');
                normalized = normalized.replace(/\\n{3,}/g, '\\n\\n');
                normalized = normalized.split('\\n').map(function(l) { return l.trimEnd(); }).join('\\n');
                return normalized.trim();
            }

            async function tryRenderMermaid(code, containerId) {
                await mermaid.parse(code);
                var result = await mermaid.render('mermaid-' + containerId + '-' + Date.now(), code);
                return result.svg;
            }

            // Expose globally so switchDesignerTab / switchPlanTab can call it
            window.renderMermaidForContainer = async function(containerId) {
                var container = document.getElementById(containerId);
                if (!container) return;

                var encodedMermaid = container.getAttribute('data-mermaid');
                if (!encodedMermaid) return;

                var rawCode = decodeURIComponent(encodedMermaid);
                dbg('info', 'Rendering mermaid for: ' + containerId + ' (' + rawCode.length + ' chars)');

                try {
                    container.innerHTML = await tryRenderMermaid(rawCode, containerId);
                    return;
                } catch (_e1) { }

                try {
                    container.innerHTML = await tryRenderMermaid(normalizeMermaid(rawCode), containerId);
                    return;
                } catch (_e2) { }

                try {
                    var sanitized = normalizeMermaid(rawCode)
                        .replace(/\\"/g, '"')
                        .replace(/<br\\s*\\/?>/gi, '\\n')
                        .replace(/[^\\x20-\\x7E\\n]/g, '')
                        .replace(/[|]>/g, '|')
                        .replace(/\\n{2,}/g, '\\n');
                    container.innerHTML = await tryRenderMermaid(sanitized, containerId);
                    return;
                } catch (finalError) {
                    var message = finalError instanceof Error ? finalError.message : String(finalError);
                    container.insertAdjacentHTML(
                        'afterbegin',
                        '<div style="margin-bottom: 10px; color: var(--vscode-errorForeground); font-size: 12px;">Diagram rendering failed: ' + message + '</div>'
                    );
                    dbg('error', 'Mermaid render failed for ' + containerId + ': ' + message);
                }
            };

            // Auto-render all visible mermaid containers
            async function renderAllMermaidContainers() {
                var containers = document.querySelectorAll('.mermaid-container[data-mermaid]');
                dbg('info', 'Found ' + containers.length + ' mermaid container(s) to render');
                for (var i = 0; i < containers.length; i++) {
                    var c = containers[i];
                    if (!c.getAttribute('data-rendered')) {
                        c.setAttribute('data-rendered', 'true');
                        await window.renderMermaidForContainer(c.id);
                    }
                }
                // Also flush any queued renders from tab switching during load
                var queue = window._mermaidRenderQueue || [];
                window._mermaidRenderQueue = [];
                for (var j = 0; j < queue.length; j++) {
                    await window.renderMermaidForContainer(queue[j]);
                }
            }

            renderAllMermaidContainers();
        })();
    </script>
</body>
</html>`;
    }

    /**
     * Get status badge HTML.
     */
    private getStatusBadgeHtml(status: string): string {
        const labels: Record<string, string> = {
            'not-started': 'Not Started',
            'in-progress': 'In Progress',
            planned: 'Planned',
            approved: 'Approved',
        };
        return `<span class="status-badge status-${status}">${labels[status] || status}</span>`;
    }

    /**
     * Get plan content HTML when a plan exists.
     */
    private getPlanContentHtml(plan: FlowMigrationPlan): string {
        const complexityColor =
            plan.complexity.level === 'low'
                ? 'var(--vscode-testing-iconPassed)'
                : plan.complexity.level === 'medium'
                  ? 'var(--vscode-editorWarning-foreground)'
                  : 'var(--vscode-errorForeground)';

        const actionMappingsHtml =
            plan.actionMappings.length > 0
                ? plan.actionMappings
                      .map(
                          (m) =>
                              `<li>
                    <span class="mapping-type mapping-direct"></span>
                    <strong>${this.escapeHtml(m.sourceAction)}</strong> → ${this.escapeHtml(m.targetAction)}
                    ${m.notes ? `<span style="color: var(--vscode-descriptionForeground);"> — ${this.escapeHtml(m.notes)}</span>` : ''}
                </li>`
                      )
                      .join('')
                : '<li style="color: var(--vscode-descriptionForeground)">No operations mapping yet</li>';

        const gapsHtml =
            plan.gaps.length > 0
                ? plan.gaps
                      .map(
                          (g) =>
                              `<div class="gap-item gap-${g.severity}">
                    <div class="gap-title">${this.escapeHtml(g.component)} (${g.severity})</div>
                    <div class="gap-desc">${this.escapeHtml(g.description)}</div>
                    ${
                        g.resolution
                            ? `<div style="margin-top: 4px; font-size: 11px; color: var(--vscode-textLink-foreground);">
                        Resolution: ${this.escapeHtml(g.resolution.strategy)} — ${this.escapeHtml(g.resolution.description)}
                    </div>`
                            : ''
                    }
                </div>`
                      )
                      .join('')
                : '<div style="color: var(--vscode-descriptionForeground); text-align: center; padding: 12px;">No gaps identified</div>';

        const patternsHtml =
            plan.patterns.length > 0
                ? plan.patterns
                      .map(
                          (p) =>
                              `<li>
                    <span class="mapping-type mapping-${p.confidence === 'high' ? 'direct' : p.confidence === 'medium' ? 'adapted' : 'gap'}"></span>
                    <strong>${this.escapeHtml(p.name)}</strong> → ${this.escapeHtml(p.logicAppsEquivalent)}
                </li>`
                      )
                      .join('')
                : '<li style="color: var(--vscode-descriptionForeground)">No patterns detected yet</li>';

        return `
        <div class="plan-content">
            <div class="plan-card">
                <h4>Overview — ${this.escapeHtml(plan.flowName)}</h4>
                <div class="plan-grid">
                    <div class="plan-stat">
                        <div class="value" style="color: ${complexityColor}">${plan.complexity.score}</div>
                        <div class="label">Complexity (${plan.complexity.level})</div>
                    </div>
                    <div class="plan-stat">
                        <div class="value">${plan.effortEstimate.totalHours}h</div>
                        <div class="label">Estimated Effort</div>
                    </div>
                    <div class="plan-stat">
                        <div class="value">${plan.actionMappings.length}</div>
                        <div class="label">Operations Mapping</div>
                    </div>
                    <div class="plan-stat">
                        <div class="value">${plan.gaps.length}</div>
                        <div class="label">Gaps</div>
                    </div>
                    ${
                        plan.wave !== undefined
                            ? `
                    <div class="plan-stat">
                        <div class="value">${plan.wave}</div>
                        <div class="label">Wave</div>
                    </div>`
                            : ''
                    }
                </div>
                ${plan.summary ? `<p style="margin-top: 12px; font-size: 13px; color: var(--vscode-descriptionForeground);">${this.escapeHtml(plan.summary)}</p>` : ''}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="plan-card">
                    <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 📋 Operations Mapping <span class="section-count">${plan.actionMappings.length}</span></h4>
                    <div class="plan-card-body">
                    <ul class="mapping-list">${actionMappingsHtml}</ul>
                    </div>
                </div>

                <div class="plan-card">
                    <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 🔄 Detected Patterns <span class="section-count">${plan.patterns.length}</span></h4>
                    <div class="plan-card-body">
                    <ul class="mapping-list">${patternsHtml}</ul>
                    </div>
                </div>
            </div>

            <div class="plan-card">
                <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> ⚠️ Migration Gaps <span class="section-count">${plan.gaps.length}</span></h4>
                <div class="plan-card-body">
                ${gapsHtml}
                </div>
            </div>

            <div class="plan-card">
                <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> ⏱️ Effort Breakdown</h4>
                <div class="plan-card-body">
                <div class="plan-grid">
                    <div class="plan-stat">
                        <div class="value">${plan.effortEstimate.breakdown.analysis}h</div>
                        <div class="label">Analysis</div>
                    </div>
                    <div class="plan-stat">
                        <div class="value">${plan.effortEstimate.breakdown.conversion}h</div>
                        <div class="label">Conversion</div>
                    </div>
                    <div class="plan-stat">
                        <div class="value">${plan.effortEstimate.breakdown.testing}h</div>
                        <div class="label">Testing</div>
                    </div>
                    <div class="plan-stat">
                        <div class="value">${plan.effortEstimate.breakdown.deployment}h</div>
                        <div class="label">Deployment</div>
                    </div>
                </div>
                <p style="margin-top: 8px; font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center;">
                    Confidence: ${plan.effortEstimate.confidence}
                </p>
                </div>
            </div>
        </div>`;
    }

    /**
     * Get HTML for a cached planning result with tabbed multi-workflow layout.
     *
     * Layout:
     * - Overview tab: overall mermaid, Azure components, gaps, patterns, summary
     * - Per-workflow tabs: Designer View / Architecture Diagram sub-tabs,
     *   filtered action mappings, collapsible workflow.json
     */
    private getCachedPlanResultHtml(result: FlowPlanningResult): string {
        const hasMultipleWorkflows = result.workflows.length > 1;

        // ── Build Overview tab content ──

        const overviewMermaidEncoded = encodeURIComponent(result.mermaid);

        const gapsHtml =
            result.gaps.length > 0
                ? result.gaps
                      .map(
                          (g) => `
                <div class="gap-item gap-${g.severity}">
                    <div class="gap-title">${this.escapeHtml(g.component)}</div>
                    <div class="gap-desc">${this.escapeHtml(g.gap)}</div>
                    <div style="margin-top: 4px; font-size: 11px; color: var(--vscode-descriptionForeground);">
                        Recommendation: ${this.escapeHtml(g.recommendation)}
                    </div>
                </div>`
                      )
                      .join('')
                : '<div style="color: var(--vscode-descriptionForeground); text-align: center; padding: 12px;">No gaps identified</div>';

        const azureComponentsHtml =
            result.azureComponents.length > 0
                ? `<div class="plan-card">
                    <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> ☁️ Additional Azure Components <span class="section-count">${result.azureComponents.length}</span></h4>
                    <div class="plan-card-body">
                    ${result.azureComponents
                        .map(
                            (c) => `
                        <div style="padding: 6px 0; border-bottom: 1px solid var(--vscode-panel-border);">
                            <strong>${this.escapeHtml(c.name)}</strong> (${this.escapeHtml(c.type)})
                            <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">${this.escapeHtml(c.reason)}</div>
                        </div>`
                        )
                        .join('')}
                    </div>
                   </div>`
                : '';

        const patternsHtml =
            result.patterns.length > 0
                ? `<div class="plan-card">
                    <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 🔄 Integration Patterns <span class="section-count">${result.patterns.length}</span></h4>
                    <div class="plan-card-body">
                    ${result.patterns
                        .map(
                            (p) => `
                        <div style="padding: 6px 0; border-bottom: 1px solid var(--vscode-panel-border);">
                            <div><strong>${this.escapeHtml(p.name)}</strong> <span class="complexity-badge complexity-${p.complexity}">${p.complexity}</span></div>
                            <div style="font-size: 11px; margin-top: 2px;">
                                <strong>Source:</strong> ${this.escapeHtml(p.sourceApproach)}<br/>
                                <strong>Logic Apps:</strong> ${this.escapeHtml(p.logicAppsApproach)}
                            </div>
                        </div>`
                        )
                        .join('')}
                    </div>
                   </div>`
                : '';

        // Overview mermaid diagram
        const overviewArchitectureHtml = `
            <div class="plan-card">
                <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 🏗️ Overall Architecture</h4>
                <div class="plan-card-body">
                    <div class="mermaid-wrapper">
                        <div class="mermaid-zoom-controls">
                            <button onclick="zoomDiagram('overview-mermaid-container', -0.1)">−</button>
                            <span class="zoom-level" id="overview-mermaid-container-zoom">100%</span>
                            <button onclick="zoomDiagram('overview-mermaid-container', 0.1)">+</button>
                            <button onclick="resetZoom('overview-mermaid-container')">Reset</button>
                            <button onclick="fitZoom('overview-mermaid-container')">Fit</button>
                        </div>
                        <div id="overview-mermaid-container" class="mermaid-container" data-mermaid="${overviewMermaidEncoded}">
                            <pre class="mermaid-source">${this.escapeHtml(result.mermaid)}</pre>
                        </div>
                    </div>
                </div>
            </div>`;

        // All action mappings (for single-workflow, show all; for multi, show overview summary)
        const overviewActionMappingsHtml = hasMultipleWorkflows
            ? this.buildActionMappingsOverviewHtml(result)
            : this.buildActionMappingsHtml(result.actionMappings);

        // Artifact dispositions — conversion & upload assessment
        const artifactDispositionsHtml = this.buildArtifactDispositionsHtml(result);

        const overviewContent = `
            <div class="plan-details">
                <div style="margin-bottom: 12px; color: var(--vscode-descriptionForeground); font-size: 13px;">
                    ${this.escapeHtml(result.explanation)}
                </div>
                ${hasMultipleWorkflows ? '' : this.buildSingleWorkflowArchitectureHtml(result, 0)}
                ${hasMultipleWorkflows ? overviewArchitectureHtml : ''}
                ${azureComponentsHtml}
                ${overviewActionMappingsHtml}
                ${artifactDispositionsHtml}
                <div class="plan-card">
                    <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> ⚠️ Migration Gaps <span class="section-count">${result.gaps.length}</span></h4>
                    <div class="plan-card-body">
                    ${gapsHtml}
                    </div>
                </div>
                ${patternsHtml}
                ${result.summary ? `<div class="plan-card"><h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 📝 Summary</h4><div class="plan-card-body"><p style="margin: 0; font-size: 13px;">${this.escapeHtml(result.summary)}</p></div></div>` : ''}
            </div>`;

        // ── Single workflow: no tabs needed ──
        if (!hasMultipleWorkflows) {
            return `
            <div class="plan-details">
                <div class="plan-header-sticky">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;">Target Architecture: ${this.escapeHtml(result.flowName)}</h3>
                        <span class="status-badge status-planned">Planned</span>
                    </div>
                </div>
                ${overviewContent}
                <p style="font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; margin-top: 8px;">
                    Generated: ${new Date(result.generatedAt).toLocaleString()}
                </p>
            </div>`;
        }

        // ── Multi-workflow: build tabs ──

        // Tab buttons
        const tabButtons = [
            `<button class="plan-tab active" data-plan-tab="overview" onclick="switchPlanTab('overview')">Overview</button>`,
            ...result.workflows.map(
                (w, idx) =>
                    `<button class="plan-tab" data-plan-tab="wf${idx}" onclick="switchPlanTab('wf${idx}')">${this.escapeHtml(w.name)}</button>`
            ),
        ].join('');

        // Per-workflow tab contents
        const workflowTabContents = result.workflows
            .map((w, idx) => {
                // Filter action mappings for this workflow
                const wfMappings = result.actionMappings.filter((m) => m.workflowName === w.name);

                // Build per-workflow architecture sub-tabs (Designer + Mermaid)
                const architectureHtml = this.buildSingleWorkflowArchitectureHtml(result, idx);

                // Filtered action mappings
                const mappingsHtml = this.buildActionMappingsHtml(wfMappings);

                return `
                <div id="plan-tab-wf${idx}" class="plan-tab-content">
                    <div class="plan-details">
                        <div style="margin-bottom: 8px;">
                            <h3 style="margin: 0 0 4px 0;">${this.escapeHtml(w.name)}</h3>
                            <p style="margin: 0; font-size: 13px; color: var(--vscode-descriptionForeground);">
                                ${this.escapeHtml(w.description)}
                            </p>
                            <div style="margin-top: 6px; font-size: 12px;">
                                <strong>Trigger:</strong> ${this.escapeHtml(w.triggerType)} &nbsp;|&nbsp;
                                <strong>Actions:</strong> ${w.actions.length} &nbsp;|&nbsp;
                                <strong>Mappings:</strong> ${wfMappings.length}
                            </div>
                        </div>
                        ${architectureHtml}
                        ${mappingsHtml}
                    </div>
                </div>`;
            })
            .join('');

        return `
        <div class="plan-details">
            <div class="plan-header-sticky">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0;">Target Architecture: ${this.escapeHtml(result.flowName)}</h3>
                    <span class="status-badge status-planned">Planned</span>
                </div>
                <div class="plan-tabs" style="margin-top: 12px;">
                    ${tabButtons}
                </div>
            </div>

            <div id="plan-tab-overview" class="plan-tab-content active">
                ${overviewContent}
            </div>

            ${workflowTabContents}

            <p style="font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; margin-top: 8px;">
                Generated: ${new Date(result.generatedAt).toLocaleString()}
            </p>
        </div>`;
    }

    /**
     * Build the Designer View / Architecture Diagram sub-tabs for a single workflow.
     */
    private buildSingleWorkflowArchitectureHtml(
        result: FlowPlanningResult,
        workflowIdx: number
    ): string {
        const w = result.workflows[workflowIdx];
        if (!w) {
            return '';
        }

        // Build a temporary result with just this workflow for getDesignerViewHtml
        const singleWorkflowResult: FlowPlanningResult = {
            ...result,
            workflows: [w],
        };

        const prefix = `wf${workflowIdx}-`;

        // Per-workflow mermaid: use workflow's own mermaid, fallback to overall (only for single-workflow)
        const wfMermaid = w.mermaid || (result.workflows.length === 1 ? result.mermaid : '');
        const hasMermaid = !!wfMermaid;
        const mermaidEncoded = hasMermaid ? encodeURIComponent(wfMermaid) : '';

        // Diagram tab content
        const diagramTabContent = hasMermaid
            ? `<div class="mermaid-wrapper">
                    <div class="mermaid-zoom-controls">
                        <button onclick="zoomDiagram('${prefix}mermaid-container', -0.1)">−</button>
                        <span class="zoom-level" id="${prefix}mermaid-container-zoom">100%</span>
                        <button onclick="zoomDiagram('${prefix}mermaid-container', 0.1)">+</button>
                        <button onclick="resetZoom('${prefix}mermaid-container')">Reset</button>
                        <button onclick="fitZoom('${prefix}mermaid-container')">Fit</button>
                    </div>
                    <div id="${prefix}mermaid-container" class="mermaid-container" data-mermaid="${mermaidEncoded}">
                        <pre class="mermaid-source">${this.escapeHtml(wfMermaid)}</pre>
                    </div>
               </div>`
            : `<div style="text-align: center; padding: 24px; color: var(--vscode-descriptionForeground);">
                    No architecture diagram available for this workflow.
               </div>`;

        // Code view (workflow.json)
        const codeViewHtml = w.workflowDefinition
            ? `<div id="${prefix}designer-code" style="display: none;">
                    <div class="workflow-json-container">
                        <pre>${this.escapeHtml(JSON.stringify(w.workflowDefinition, null, 2))}</pre>
                    </div>
               </div>`
            : '';

        const hasCodeView = !!w.workflowDefinition;

        return `
            <div class="plan-card">
                <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 🏗️ ${result.workflows.length > 1 ? this.escapeHtml(w.name) + ' — ' : ''}Architecture</h4>
                <div class="plan-card-body">
                    <div id="${prefix}designer-tabs" class="designer-tabs">
                        <button class="designer-tab active" data-tab="designer" onclick="switchDesignerTab('designer', ${workflowIdx})">Designer View</button>
                        <button class="designer-tab" data-tab="diagram" onclick="switchDesignerTab('diagram', ${workflowIdx})">Architecture Diagram</button>
                    </div>
                    <div id="${prefix}tab-designer" class="designer-tab-content active">
                        ${hasCodeView ? `<div class="designer-view-header"><button id="${prefix}code-toggle" class="code-toggle-btn" onclick="toggleCodeView(${workflowIdx})"><span class="toggle-icon">{}</span> Code</button></div>` : ''}
                        <div id="${prefix}designer-visual">
                            ${this.getDesignerViewHtml(singleWorkflowResult)}
                        </div>
                        ${codeViewHtml}
                    </div>
                    <div id="${prefix}tab-diagram" class="designer-tab-content">
                        ${diagramTabContent}
                    </div>
                </div>
            </div>`;
    }

    /**
     * Build action mappings table HTML from a list of action mappings.
     */
    private buildActionMappingsHtml(mappings: FlowPlanningResult['actionMappings']): string {
        if (mappings.length === 0) {
            return '';
        }

        return `<div class="plan-card">
            <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 📋 Operations Mapping <span class="section-count">${mappings.length}</span></h4>
            <div class="plan-card-body">
            <table class="flow-table" style="margin: 0;">
                <thead><tr><th>Source</th><th></th><th>Logic Apps Target</th><th>Notes</th></tr></thead>
                <tbody>
                    ${mappings
                        .map(
                            (m) => `
                        <tr>
                            <td>${this.escapeHtml(m.source)}</td>
                            <td style="width: 28px; padding: 10px 4px;"><span class="mapping-arrow"><span class="arrow-icon"></span></span></td>
                            <td>${this.escapeHtml(m.target)}</td>
                            <td>${m.notes ? this.escapeHtml(m.notes) : ''}</td>
                        </tr>`
                        )
                        .join('')}
                </tbody>
            </table>
            </div>
           </div>`;
    }

    /**
     * Build an overview of action mappings grouped by workflow (for multi-workflow views).
     */
    private buildActionMappingsOverviewHtml(result: FlowPlanningResult): string {
        if (result.actionMappings.length === 0) {
            return '';
        }

        // Group by workflowName
        const grouped = new Map<string, typeof result.actionMappings>();
        for (const m of result.actionMappings) {
            const key = m.workflowName || 'Unassigned';
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)?.push(m);
        }

        const rows = Array.from(grouped.entries())
            .map(
                ([wfName, mappings]) => `
                <div style="padding: 6px 0; border-bottom: 1px solid var(--vscode-panel-border);">
                    <strong>${this.escapeHtml(wfName)}</strong>
                    <span style="font-size: 11px; color: var(--vscode-descriptionForeground);"> — ${mappings.length} mapping${mappings.length !== 1 ? 's' : ''}</span>
                </div>`
            )
            .join('');

        return `<div class="plan-card">
            <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 📋 Operations Mapping Overview <span class="section-count">${result.actionMappings.length}</span></h4>
            <div class="plan-card-body">
                ${rows}
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 8px; text-align: center;">
                    Select a workflow tab above to view detailed operations mapping
                </div>
            </div>
           </div>`;
    }

    /**
     * Build HTML for the Artifact Dispositions section.
     * Shows two sub-sections:
     * 1. Artifacts Requiring Conversion — what needs to be converted and why
     * 2. Artifact Upload Destinations — where each artifact goes and why
     */
    private buildArtifactDispositionsHtml(result: FlowPlanningResult): string {
        const dispositions = result.artifactDispositions;
        if (!dispositions || dispositions.length === 0) {
            return '';
        }

        // ── Sub-section 1: Artifacts Requiring Conversion ──
        const conversionItems = dispositions.filter((d) => d.conversionRequired);
        const noConversionItems = dispositions.filter((d) => !d.conversionRequired);

        const conversionRowsHtml =
            conversionItems.length > 0
                ? conversionItems
                      .map(
                          (d) => `
                <tr>
                    <td style="padding: 6px 8px; font-weight: 500;">${this.escapeHtml(d.artifactName)}</td>
                    <td style="padding: 6px 8px;"><code>${this.escapeHtml(d.artifactType)}</code></td>
                    <td style="padding: 6px 8px;">
                        ${
                            d.conversionFrom && d.conversionTo
                                ? `<code>${this.escapeHtml(d.conversionFrom)}</code> <span style="color: var(--vscode-charts-green);">→</span> <code>${this.escapeHtml(d.conversionTo)}</code>`
                                : '<span style="color: var(--vscode-charts-yellow);">Conversion needed</span>'
                        }
                    </td>
                    <td style="padding: 6px 8px; font-size: 11px; color: var(--vscode-descriptionForeground);">${this.escapeHtml(d.conversionNotes || '')}</td>
                </tr>`
                      )
                      .join('')
                : '';

        const noConversionRowsHtml =
            noConversionItems.length > 0
                ? noConversionItems
                      .map(
                          (d) => `
                <tr style="opacity: 0.7;">
                    <td style="padding: 6px 8px;">${this.escapeHtml(d.artifactName)}</td>
                    <td style="padding: 6px 8px;"><code>${this.escapeHtml(d.artifactType)}</code></td>
                    <td style="padding: 6px 8px; color: var(--vscode-charts-green);">✓ No conversion</td>
                    <td style="padding: 6px 8px; font-size: 11px; color: var(--vscode-descriptionForeground);">${this.escapeHtml(d.conversionNotes || 'Can be used as-is')}</td>
                </tr>`
                      )
                      .join('')
                : '';

        const conversionSectionHtml = `
            <div style="margin-bottom: 16px;">
                <h5 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground);">
                    🔄 Artifacts Requiring Conversion
                    <span style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 6px; border-radius: 8px; font-size: 11px; margin-left: 6px;">${conversionItems.length}</span>
                </h5>
                ${
                    conversionItems.length > 0
                        ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--vscode-panel-border); text-align: left;">
                            <th style="padding: 6px 8px;">Artifact</th>
                            <th style="padding: 6px 8px;">Type</th>
                            <th style="padding: 6px 8px;">Conversion</th>
                            <th style="padding: 6px 8px;">Notes</th>
                        </tr>
                    </thead>
                    <tbody style="border-bottom: 1px solid var(--vscode-panel-border);">
                        ${conversionRowsHtml}
                    </tbody>
                </table>`
                        : '<div style="color: var(--vscode-charts-green); padding: 8px 0; font-size: 12px;">✓ No artifacts require conversion</div>'
                }
                ${
                    noConversionItems.length > 0
                        ? `
                <details style="margin-top: 8px;">
                    <summary style="cursor: pointer; font-size: 11px; color: var(--vscode-descriptionForeground);">
                        ${noConversionItems.length} artifact${noConversionItems.length !== 1 ? 's' : ''} with no conversion needed
                    </summary>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px;">
                        <tbody>
                            ${noConversionRowsHtml}
                        </tbody>
                    </table>
                </details>`
                        : ''
                }
            </div>`;

        // ── Sub-section 2: Artifact Upload Destinations ──
        const destinationLabels: Record<string, { label: string; icon: string }> = {
            'integration-account': { label: 'Integration Account', icon: '🏦' },
            'logic-app-artifact-folder': { label: 'Logic App Artifact Folder', icon: '📂' },
            'azure-function': { label: 'Azure Function', icon: '⚡' },
            'not-applicable': { label: 'Not Applicable', icon: '—' },
        };

        // Group by destination
        const byDestination = new Map<string, typeof dispositions>();
        for (const d of dispositions) {
            const key = d.uploadDestination;
            if (!byDestination.has(key)) {
                byDestination.set(key, []);
            }
            const arr = byDestination.get(key);
            if (arr) {
                arr.push(d);
            }
        }

        const uploadSectionHtml = `
            <div>
                <h5 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground);">
                    📤 Upload Destinations
                </h5>
                ${Array.from(byDestination.entries())
                    .map(([dest, items]) => {
                        const info = destinationLabels[dest] || { label: dest, icon: '📦' };
                        return `
                    <div style="margin-bottom: 12px; padding: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px;">
                        <div style="font-weight: 600; margin-bottom: 6px;">
                            ${info.icon} ${info.label}
                            <span style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 6px; border-radius: 8px; font-size: 11px; margin-left: 6px;">${items.length}</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--vscode-panel-border); text-align: left;">
                                    <th style="padding: 4px 8px;">Artifact</th>
                                    <th style="padding: 4px 8px;">Type</th>
                                    <th style="padding: 4px 8px;">Path</th>
                                    <th style="padding: 4px 8px;">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items
                                    .map(
                                        (d) => `
                                <tr style="border-bottom: 1px solid var(--vscode-panel-border);">
                                    <td style="padding: 4px 8px;">${this.escapeHtml(d.artifactName)}</td>
                                    <td style="padding: 4px 8px;"><code>${this.escapeHtml(d.artifactType)}</code></td>
                                    <td style="padding: 4px 8px; font-size: 11px;"><code>${this.escapeHtml(d.uploadPath || '—')}</code></td>
                                    <td style="padding: 4px 8px; font-size: 11px; color: var(--vscode-descriptionForeground);">${this.escapeHtml(d.uploadNotes || '')}</td>
                                </tr>`
                                    )
                                    .join('')}
                            </tbody>
                        </table>
                    </div>`;
                    })
                    .join('')}
            </div>`;

        return `<div class="plan-card">
            <h4 onclick="toggleSection(this)"><span class="collapse-icon">▼</span> 📦 Artifact Dispositions <span class="section-count">${dispositions.length}</span></h4>
            <div class="plan-card-body">
                ${conversionSectionHtml}
                ${uploadSectionHtml}
            </div>
           </div>`;
    }

    /**
     * Build a Logic Apps Designer-style visual workflow from planning result.
     * If workflowDefinition is present, parses the actual workflow.json to
     * render triggers, actions, branches (Switch/If), and loops accurately.
     * Falls back to flat action list rendering otherwise.
     */
    private getDesignerViewHtml(result: FlowPlanningResult): string {
        if (!result.workflows || result.workflows.length === 0) {
            return '<div style="text-align: center; padding: 32px; color: var(--vscode-descriptionForeground);">No workflow data available for designer view.</div>';
        }

        // ── Icon helpers ──

        const iconForType = (type: string, name: string): string => {
            const lower = (type + ' ' + name).toLowerCase();
            if (lower.includes('request') || lower.includes('http')) {
                return '🌐';
            }
            if (lower.includes('file') || lower.includes('blob') || lower.includes('folder')) {
                return '📁';
            }
            if (
                lower.includes('recurrence') ||
                lower.includes('schedule') ||
                lower.includes('timer') ||
                lower.includes('poll')
            ) {
                return '⏱️';
            }
            if (
                lower.includes('servicebus') ||
                lower.includes('service bus') ||
                lower.includes('queue') ||
                lower.includes('topic')
            ) {
                return '📨';
            }
            if (lower.includes('event')) {
                return '⚡';
            }
            if (lower.includes('sql') || lower.includes('database')) {
                return '🗄️';
            }
            if (lower.includes('parse') || lower.includes('xml') || lower.includes('json')) {
                return '📋';
            }
            if (
                lower.includes('transform') ||
                lower.includes('xslt') ||
                lower.includes('map') ||
                lower.includes('compose')
            ) {
                return '🔄';
            }
            if (lower.includes('switch') || lower.includes('if') || lower.includes('condition')) {
                return '🔀';
            }
            if (lower.includes('response') || lower.includes('reply')) {
                return '↩️';
            }
            if (lower.includes('send') || lower.includes('email')) {
                return '📤';
            }
            if (lower.includes('create') || lower.includes('write') || lower.includes('insert')) {
                return '💾';
            }
            if (
                lower.includes('get') ||
                lower.includes('read') ||
                lower.includes('fetch') ||
                lower.includes('select')
            ) {
                return '📥';
            }
            if (lower.includes('delete') || lower.includes('remove')) {
                return '🗑️';
            }
            if (lower.includes('foreach') || lower.includes('until') || lower.includes('loop')) {
                return '🔁';
            }
            if (lower.includes('delay') || lower.includes('wait')) {
                return '⏸️';
            }
            if (lower.includes('scope') || lower.includes('try') || lower.includes('catch')) {
                return '📦';
            }
            if (
                lower.includes('set') ||
                lower.includes('variable') ||
                lower.includes('initialize')
            ) {
                return '📝';
            }
            if (
                lower.includes('function') ||
                lower.includes('.net') ||
                lower.includes('assembly')
            ) {
                return '⚙️';
            }
            return '▪️';
        };

        const styleForType = (type: string, name: string): string => {
            const lower = (type + ' ' + name).toLowerCase();
            if (lower.includes('switch') || lower.includes('if') || lower.includes('condition')) {
                return 'condition';
            }
            if (lower.includes('response') || lower.includes('reply')) {
                return 'response';
            }
            if (
                lower.includes('http') ||
                lower.includes('api') ||
                lower.includes('servicebus') ||
                lower.includes('service bus') ||
                lower.includes('sql') ||
                lower.includes('blob') ||
                lower.includes('file')
            ) {
                return 'connector';
            }
            return 'action';
        };

        // ── Card renderer ──

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buildTooltip = (def?: Record<string, any>): string => {
            if (!def) {
                return '';
            }
            const tooltipFields: { key: string; label: string }[] = [
                { key: 'type', label: 'Type' },
                { key: 'kind', label: 'Kind' },
                { key: 'inputs', label: 'Inputs' },
                { key: 'recurrence', label: 'Recurrence' },
                { key: 'foreach', label: 'ForEach' },
                { key: 'expression', label: 'Expression' },
                { key: 'runtimeConfiguration', label: 'Runtime Config' },
                { key: 'retryPolicy', label: 'Retry Policy' },
            ];
            const rows: string[] = [];
            for (const f of tooltipFields) {
                const val = def[f.key];
                if (val === undefined || val === null) {
                    continue;
                }
                let display: string;
                if (typeof val === 'string') {
                    display = val;
                } else {
                    display = JSON.stringify(val, null, 2);
                    // Truncate very long values
                    if (display.length > 300) {
                        display = display.substring(0, 297) + '...';
                    }
                }
                rows.push(
                    `<div class="tip-row"><span class="tip-label">${f.label}:</span>${this.escapeHtml(display)}</div>`
                );
            }
            if (rows.length === 0) {
                return '';
            }
            return `<div class="designer-card-tooltip">${rows.join('')}</div>`;
        };

        const renderCard = (
            name: string,
            type: string,
            styleCls: string,
            extra?: string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            definition?: Record<string, any>
        ): string => {
            const icon = iconForType(type, name);
            const displayName = name.replace(/_/g, ' ');
            const tooltip = buildTooltip(definition);
            return `
            <div class="designer-card">
                <div class="designer-card-header ${styleCls}">
                    <div class="designer-card-icon">${icon}</div>
                    <span>${this.escapeHtml(displayName)}</span>
                    ${extra || ''}
                </div>
                ${tooltip}
            </div>`;
        };

        const connector = '<div class="designer-connector"></div>';

        // ── Workflow.json parser ──

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const renderActionsFromDefinition = (actions: Record<string, any>): string => {
            if (!actions || Object.keys(actions).length === 0) {
                return '';
            }

            // Helper: get the runAfter dependency key for an action (sorted dep names)
            const getRunAfterKey = (name: string): string => {
                const runAfter = actions[name]?.runAfter;
                if (
                    !runAfter ||
                    typeof runAfter !== 'object' ||
                    Object.keys(runAfter).length === 0
                ) {
                    return '';
                }
                return Object.keys(runAfter).sort().join(',');
            };

            // Helper: get the set of actions that depend on a given action
            const getDependents = (parentName: string): string[] => {
                return Object.keys(actions).filter((n) => {
                    const ra = actions[n]?.runAfter;
                    return ra && typeof ra === 'object' && parentName in ra;
                });
            };

            // Helper: follow a single chain of actions from startName until a fork or end
            const followChain = (startName: string, visited: Set<string>): string[] => {
                const chain: string[] = [startName];
                visited.add(startName);
                let current = startName;
                while (true) {
                    const deps = getDependents(current);
                    // Filter to unvisited deps that ONLY depend on current (single parent)
                    const singleParentDeps = deps.filter(
                        (d) => !visited.has(d) && getRunAfterKey(d) === current
                    );
                    if (singleParentDeps.length === 1) {
                        // Single next action — continue the chain
                        const next = singleParentDeps[0];
                        chain.push(next);
                        visited.add(next);
                        current = next;
                    } else {
                        // 0 or multiple — stop chain here (fork or end)
                        break;
                    }
                }
                return chain;
            };

            // Render a single action by name (handles Switch, If, Scope, Loop, etc.)
            const renderSingleAction = (name: string): string => {
                const action = actions[name];
                const type: string = action.type || '';
                const typeLower = type.toLowerCase();

                // Switch action — render cases as branches
                if (typeLower === 'switch') {
                    const switchHtml =
                        connector + renderCard(name, type, 'condition', undefined, action);
                    const cases = action.cases || {};
                    const defaultCase = action.default;
                    const caseEntries = Object.entries(cases) as [
                        string,
                        { actions?: Record<string, unknown> },
                    ][];

                    if (caseEntries.length === 0 && !defaultCase) {
                        return switchHtml;
                    }

                    const branchesHtml = caseEntries
                        .map(([caseName, caseDef]) => {
                            const caseActions = caseDef.actions
                                ? renderActionsFromDefinition(
                                      caseDef.actions as Record<string, unknown>
                                  )
                                : '';
                            return `
                    <div class="designer-branch">
                        <div class="designer-branch-connector"></div>
                        <div class="designer-branch-label">${this.escapeHtml(caseName)}</div>
                        ${caseActions}
                    </div>`;
                        })
                        .join('');

                    const defaultHtml = defaultCase?.actions
                        ? (() => {
                              const defActions = renderActionsFromDefinition(defaultCase.actions);
                              return `
                    <div class="designer-branch">
                        <div class="designer-branch-connector"></div>
                        <div class="designer-branch-label">Default</div>
                        ${defActions}
                    </div>`;
                          })()
                        : '';

                    return `${switchHtml}
                <div class="designer-branch-bar"></div>
                <div class="designer-parallel">
                    ${branchesHtml}${defaultHtml}
                </div>
                <div class="designer-merge-bar"></div>`;
                }

                // If/Condition action — true/false branches
                if (typeLower === 'if') {
                    const ifHtml =
                        connector + renderCard(name, type, 'condition', undefined, action);
                    const trueBranch = action.actions
                        ? renderActionsFromDefinition(action.actions)
                        : '';
                    const falseBranch = action.else?.actions
                        ? renderActionsFromDefinition(action.else.actions)
                        : '';

                    if (!trueBranch && !falseBranch) {
                        return ifHtml;
                    }

                    const branches = [];
                    if (trueBranch) {
                        branches.push(`
                    <div class="designer-branch">
                        <div class="designer-branch-connector"></div>
                        <div class="designer-branch-label">True</div>
                        ${trueBranch}
                    </div>`);
                    }
                    if (falseBranch) {
                        branches.push(`
                    <div class="designer-branch">
                        <div class="designer-branch-connector"></div>
                        <div class="designer-branch-label">False</div>
                        ${falseBranch}
                    </div>`);
                    }

                    return `${ifHtml}
                <div class="designer-branch-bar"></div>
                <div class="designer-parallel">
                    ${branches.join('')}
                </div>
                <div class="designer-merge-bar"></div>`;
                }

                // Foreach / Until — render as a container box with nested actions
                if (typeLower === 'foreach' || typeLower === 'until') {
                    const loopLabel = typeLower === 'foreach' ? 'For Each' : 'Until';
                    const scopeTypeClass =
                        typeLower === 'foreach' ? 'scope-type-foreach' : 'scope-type-until';
                    const nestedActions = action.actions
                        ? renderActionsFromDefinition(action.actions)
                        : '';
                    return `${connector}
                <div class="designer-scope-container">
                    <div class="designer-scope-header ${scopeTypeClass}">
                        <span class="scope-badge">${loopLabel}</span>
                        <span>${this.escapeHtml(name)}</span>
                    </div>
                    <div class="designer-scope-body">
                        ${nestedActions || '<div style="opacity:0.5;font-size:12px;text-align:center;padding:8px;">Empty</div>'}
                    </div>
                </div>`;
                }

                // Scope — render as a container box with nested actions
                if (typeLower === 'scope') {
                    const nestedActions = action.actions
                        ? renderActionsFromDefinition(action.actions)
                        : '';
                    // Check if this scope has a special runAfter condition (e.g. Failed)
                    const runAfter = action.runAfter;
                    let runAfterLabel = '';
                    if (runAfter && typeof runAfter === 'object') {
                        const statuses = Object.values(runAfter).flat() as string[];
                        const nonSucceeded = statuses.filter((s: string) => s !== 'Succeeded');
                        if (nonSucceeded.length > 0) {
                            const statusLabels: Record<string, string> = {
                                Failed: 'On failure',
                                Skipped: 'On skipped',
                                TimedOut: 'On timeout',
                            };
                            const label =
                                statusLabels[nonSucceeded[0]] ||
                                `runAfter: ${nonSucceeded.join(', ')}`;
                            const cssClass =
                                nonSucceeded[0] === 'Failed'
                                    ? 'runafter-failed'
                                    : nonSucceeded[0] === 'Skipped'
                                      ? 'runafter-skipped'
                                      : nonSucceeded[0] === 'TimedOut'
                                        ? 'runafter-timedout'
                                        : '';
                            runAfterLabel = `<div class="designer-connector-label ${cssClass}">${label}</div>`;
                        }
                    }
                    return `${connector}${runAfterLabel}
                <div class="designer-scope-container">
                    <div class="designer-scope-header scope-type-scope">
                        <span class="scope-badge">Scope</span>
                        <span>${this.escapeHtml(name)}</span>
                    </div>
                    <div class="designer-scope-body">
                        ${nestedActions || '<div style="opacity:0.5;font-size:12px;text-align:center;padding:8px;">Empty</div>'}
                    </div>
                </div>`;
                }

                // Regular action
                const style = styleForType(type, name);
                return connector + renderCard(name, type, style, undefined, action);
            };

            // ── Main rendering logic with parallel branch detection ──

            // Walk the action graph, rendering chains and detecting forks
            const visited = new Set<string>();
            const htmlParts: string[] = [];

            // Start with root actions (no runAfter or empty runAfter)
            const rootActions = Object.keys(actions).filter((n) => {
                const ra = actions[n]?.runAfter;
                return !ra || typeof ra !== 'object' || Object.keys(ra).length === 0;
            });

            // Process queue: each item is a set of action names at the same "level"
            let currentLevel = rootActions.length > 0 ? rootActions : Object.keys(actions);

            while (currentLevel.length > 0) {
                const unvisited = currentLevel.filter((n) => !visited.has(n));
                if (unvisited.length === 0) {
                    break;
                }

                if (unvisited.length === 1) {
                    // Single action — follow its chain
                    const chain = followChain(unvisited[0], visited);
                    for (const actionName of chain) {
                        htmlParts.push(renderSingleAction(actionName));
                    }
                    // After the chain ends, find what comes next
                    const lastInChain = chain[chain.length - 1];
                    const nextActions = getDependents(lastInChain).filter((n) => !visited.has(n));
                    currentLevel = nextActions;
                } else {
                    // Multiple actions at the same level — parallel branches!
                    const branches: string[][] = [];
                    for (const startName of unvisited) {
                        const chain = followChain(startName, visited);
                        branches.push(chain);
                    }

                    // Render as parallel
                    const branchesHtml = branches
                        .map((chain) => {
                            const chainHtml = chain.map((n) => renderSingleAction(n)).join('');
                            return `
                    <div class="designer-branch">
                        <div class="designer-branch-connector"></div>
                        ${chainHtml}
                    </div>`;
                        })
                        .join('');

                    htmlParts.push(`
                <div class="designer-branch-bar"></div>
                <div class="designer-parallel">
                    ${branchesHtml}
                </div>
                <div class="designer-merge-bar"></div>`);

                    // Find what comes after all branches (actions that depend on any branch tail)
                    const branchTails = branches.map((chain) => chain[chain.length - 1]);
                    const nextActions = new Set<string>();
                    for (const tail of branchTails) {
                        for (const dep of getDependents(tail)) {
                            if (!visited.has(dep)) {
                                nextActions.add(dep);
                            }
                        }
                    }
                    currentLevel = Array.from(nextActions);
                }
            }

            return htmlParts.join('');
        };

        // ── Render each workflow ──

        const workflowsHtml = result.workflows
            .map((w, idx) => {
                const def = w.workflowDefinition;
                const definition = def?.definition || def;

                const title =
                    result.workflows.length > 1
                        ? `<div class="designer-workflow-title">Workflow ${idx + 1}: ${this.escapeHtml(w.name)}</div>`
                        : '';

                // If we have a workflowDefinition, parse it properly
                if (definition?.triggers && definition?.actions) {
                    const triggers = definition.triggers as Record<
                        string,
                        { type?: string; inputs?: unknown }
                    >;
                    const triggerEntries = Object.entries(triggers);

                    // Render triggers
                    const triggersHtml = triggerEntries
                        .map(([trigName, trigDef]) => {
                            const trigType = (trigDef as { type?: string }).type || '';
                            const displayName = trigName.replace(/_/g, ' ');
                            return renderCard(
                                displayName,
                                trigType,
                                'trigger',
                                undefined,
                                trigDef as Record<string, unknown>
                            );
                        })
                        .join('');

                    // Render actions from definition
                    const actionsHtml = renderActionsFromDefinition(definition.actions);

                    return `
                    <div class="designer-workflow">
                        ${title}
                        ${triggersHtml}
                        ${actionsHtml}
                    </div>`;
                }

                // Fallback: use flat actions list + triggerType
                const triggerCard = renderCard(w.triggerType, w.triggerType, 'trigger');
                const actionCards = w.actions
                    .map((action) => {
                        const style = styleForType('', action);
                        return connector + renderCard(action, '', style);
                    })
                    .join('');

                return `
                <div class="designer-workflow">
                    ${title}
                    ${triggerCard}
                    ${actionCards}
                </div>`;
            })
            .join('<div style="height: 32px;"></div>');

        return `<div class="designer-canvas">${workflowsHtml}</div>`;
    }

    /**
     * Get plan placeholder HTML when a flow is selected but no plan exists yet.
     */
    private getPlanPlaceholderHtml(flowId: string, isAnalyzed = true): string {
        const flow = this.planningService.getFlows().find((f) => f.id === flowId);
        const flowName = flow ? flow.name : flowId;

        if (!isAnalyzed) {
            return `
            <div class="plan-placeholder">
                <h3>Plan for "${this.escapeHtml(flowName)}"</h3>
                <p style="color: var(--vscode-editorWarning-foreground);">⚠ Analysis pending — generate the flow visualization in the Discovery stage before planning this flow.</p>
                <button class="btn" onclick="vscode.postMessage({ command: 'goToDiscovery' })">
                    Go to Discovery
                </button>
            </div>`;
        }

        // If the flow is already in-progress, show a generating indicator
        // instead of a redundant "Generate Migration Plan" button.
        if (flow?.status === 'in-progress') {
            return `
            <div class="plan-placeholder">
                <h3>Plan for "${this.escapeHtml(flowName)}"</h3>
                <p>Generating migration plan… check the chat panel for progress.</p>
            </div>`;
        }

        return `
        <div class="plan-placeholder">
            <h3>Plan for "${this.escapeHtml(flowName)}"</h3>
            <p>No migration plan has been generated for this flow yet.</p>
            <button class="btn" onclick="startPlanning('${this.escapeHtml(flowId)}')">
                Generate Migration Plan
            </button>
        </div>`;
    }

    /**
     * Get HTML prompting user to select a flow.
     */
    private getSelectFlowPromptHtml(): string {
        return `
        <div class="plan-placeholder">
            <h3>Select a Flow</h3>
            <p>Choose a flow from the list above to view or generate its migration plan.</p>
        </div>`;
    }

    /**
     * Get empty state HTML.
     */
    private getEmptyStateHtml(_nonce: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Migration Planning</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 40px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }
        h2 { color: var(--vscode-foreground); }
        .btn {
            margin-top: 16px;
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h2>No Flows Discovered</h2>
    <p>Complete the Discovery stage first to identify integration flows.</p>
    <button class="btn" onclick="vscode.postMessage({ command: 'goToDiscovery' })">
        Go to Discovery
    </button>
    <script>
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Dispose of resources.
     */
    public dispose(): void {
        PlanningWebviewPanel.currentPanel = undefined;
        this.panel.dispose();
        this.disposables.forEach((d) => d.dispose());
    }
}
