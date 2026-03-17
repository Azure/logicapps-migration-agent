/**
 * Discovery Webview Panel
 *
 * Webview panel for displaying detailed discovery results including
 * statistics, artifact list, and dependency graph visualization.
 *
 * @module views/discovery/DiscoveryWebviewPanel
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LoggingService } from '../../services/LoggingService';
import { DiscoveryService } from '../../stages/discovery/DiscoveryService';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { DependencyGraphService } from '../../stages/discovery/DependencyGraphService';
import { ArtifactInventory, DependencyGraph } from '../../stages/discovery/types';

// =============================================================================
// Discovery Webview Panel
// =============================================================================

/**
 * Webview panel for discovery results.
 */
export class DiscoveryWebviewPanel implements vscode.Disposable {
    public static currentPanel: DiscoveryWebviewPanel | undefined;
    public static readonly viewType = 'logicAppsMigrationAssistant.discoveryResults';

    private readonly panel: vscode.WebviewPanel;
    private readonly logger = LoggingService.getInstance();
    private readonly inventoryService = InventoryService.getInstance();
    private readonly dependencyGraphService = DependencyGraphService.getInstance();
    private readonly disposables: vscode.Disposable[] = [];

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

        // Listen for inventory changes
        this.disposables.push(
            this.inventoryService.onInventoryChanged(() => {
                this.update();
            })
        );
    }

    /**
     * Create or show the panel.
     */
    public static createOrShow(extensionUri: vscode.Uri): DiscoveryWebviewPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DiscoveryWebviewPanel.currentPanel) {
            DiscoveryWebviewPanel.currentPanel.panel.reveal(column);
            return DiscoveryWebviewPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            DiscoveryWebviewPanel.viewType,
            'Discovery Results',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            }
        );

        DiscoveryWebviewPanel.currentPanel = new DiscoveryWebviewPanel(panel, extensionUri);
        return DiscoveryWebviewPanel.currentPanel;
    }

    /**
     * Update the webview content.
     */
    public update(): void {
        const inventory = this.inventoryService.getInventory();
        const graph = this.dependencyGraphService.getGraph();

        this.panel.webview.html = this.getHtmlContent(inventory, graph);
    }

    /**
     * Handle messages from webview.
     */
    private handleMessage(message: { command: string; data?: unknown }): void {
        switch (message.command) {
            case 'openFile': {
                const filePath = message.data as string;
                if (filePath) {
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
                }
                break;
            }

            case 'exportInventory': {
                const format = (message.data as string) || 'json';
                this.inventoryService.exportToFile(format as 'json' | 'csv');
                break;
            }

            case 'refresh':
                DiscoveryService.getInstance().rescan();
                break;

            case 'showArtifact': {
                const artifactId = message.data as string;
                this.logger.debug('Show artifact', { id: artifactId });
                // Artifact detail navigation — reserved for future implementation
                break;
            }
        }
    }

    /**
     * Get HTML content for webview.
     */
    private getHtmlContent(
        inventory: ArtifactInventory | undefined,
        graph: DependencyGraph | undefined
    ): string {
        const nonce = this.getNonce();

        if (!inventory) {
            return this.getEmptyStateHtml(nonce);
        }

        const stats = inventory.statistics;
        const categoryData = this.getCategoryChartData(stats);
        // Graph data for future dependency visualization
        void (graph ? this.dependencyGraphService.exportToD3Format() : null);

        return `<!DOCTYPE html>>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Discovery Results</title>
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
        }
        
        h1, h2, h3 {
            color: var(--vscode-foreground);
            margin-top: 0;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .header-actions {
            display: flex;
            gap: 8px;
        }
        
        .btn {
            padding: 6px 14px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
        }
        
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        
        .stat-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 16px;
            border-radius: 4px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        
        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        
        .section {
            margin-bottom: 24px;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .artifact-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        
        .artifact-table th,
        .artifact-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .artifact-table th {
            background: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: 600;
        }
        
        .artifact-table tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .artifact-name {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
        }
        
        .artifact-name:hover {
            text-decoration: underline;
        }
        
        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
        }
        
        .status-parsed {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }
        
        .status-warning {
            background: var(--vscode-editorWarning-foreground);
            color: white;
        }
        
        .status-error {
            background: var(--vscode-errorForeground);
            color: white;
        }
        
        .category-chart {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .category-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 12px;
        }
        
        .category-count {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        
        .dependency-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }
        
        .dep-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px;
            border-radius: 4px;
        }
        
        .dep-card h4 {
            margin: 0 0 8px 0;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        
        .dep-value {
            font-size: 18px;
            font-weight: bold;
        }
        
        .shared-resource {
            padding: 4px 0;
            font-size: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .shared-resource:last-child {
            border-bottom: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>${inventory.projectName}</h1>
            <p style="margin: 0; color: var(--vscode-descriptionForeground)">
                ${inventory.platform}${inventory.platformVersion ? ` ${inventory.platformVersion}` : ''} • 
                Last updated: ${new Date(inventory.updatedAt).toLocaleString()}
            </p>
        </div>
        <div class="header-actions">
            <button class="btn btn-secondary" onclick="refresh()">Refresh</button>
            <button class="btn btn-secondary" onclick="exportInventory('csv')">Export CSV</button>
            <button class="btn" onclick="exportInventory('json')">Export JSON</button>
        </div>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">${stats.totalCount}</div>
            <div class="stat-label">Total Artifacts</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.byStatus.parsed}</div>
            <div class="stat-label">Parsed</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.byStatus.warning}</div>
            <div class="stat-label">Warnings</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.byStatus.error}</div>
            <div class="stat-label">Errors</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${this.formatFileSize(stats.totalFileSize)}</div>
            <div class="stat-label">Total Size</div>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">Artifacts by Category</div>
        <div class="category-chart">
            ${categoryData
                .map(
                    (c) => `
                <div class="category-item">
                    <span class="category-count">${c.count}</span>
                    <span>${c.label}</span>
                </div>
            `
                )
                .join('')}
        </div>
    </div>
    
    ${
        graph
            ? `
    <div class="section">
        <div class="section-title">Dependency Analysis</div>
        <div class="dependency-info">
            <div class="dep-card">
                <h4>Relationships</h4>
                <div class="dep-value">${graph.edges.length}</div>
            </div>
            <div class="dep-card">
                <h4>Root Artifacts</h4>
                <div class="dep-value">${graph.rootNodeIds.length}</div>
            </div>
            <div class="dep-card">
                <h4>Shared Resources</h4>
                <div class="dep-value">${graph.sharedResources.length}</div>
            </div>
            <div class="dep-card">
                <h4>Circular Dependencies</h4>
                <div class="dep-value" style="color: ${graph.circularDependencies.length > 0 ? 'var(--vscode-errorForeground)' : 'inherit'}">
                    ${graph.circularDependencies.length}
                </div>
            </div>
        </div>
        ${
            graph.sharedResources.length > 0
                ? `
        <div style="margin-top: 16px;">
            <div class="section-title">Top Shared Resources</div>
            <div class="dep-card">
                ${graph.sharedResources
                    .slice(0, 5)
                    .map(
                        (r) => `
                    <div class="shared-resource">
                        <strong>${r.name}</strong> (${r.category}) - used by ${r.usageCount} artifacts
                    </div>
                `
                    )
                    .join('')}
            </div>
        </div>
        `
                : ''
        }
    </div>
    `
            : ''
    }
    
    <div class="section">
        <div class="section-title">All Artifacts (${inventory.items.length})</div>
        <table class="artifact-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Path</th>
                    <th>Status</th>
                    <th>Size</th>
                </tr>
            </thead>
            <tbody>
                ${inventory.items
                    .slice(0, 100)
                    .map(
                        (item) => `
                    <tr>
                        <td>
                            <span class="artifact-name" onclick="openFile('${this.escapeHtml(item.sourcePath)}')">
                                ${this.escapeHtml(item.name)}
                            </span>
                        </td>
                        <td>${item.category}</td>
                        <td style="color: var(--vscode-descriptionForeground); font-size: 11px;">
                            ${this.escapeHtml(path.dirname(item.sourcePath))}
                        </td>
                        <td>
                            <span class="status-badge status-${item.status}">${item.status}</span>
                        </td>
                        <td>${this.formatFileSize(item.metadata.fileSize)}</td>
                    </tr>
                `
                    )
                    .join('')}
                ${
                    inventory.items.length > 100
                        ? `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--vscode-descriptionForeground);">
                            ... and ${inventory.items.length - 100} more artifacts
                        </td>
                    </tr>
                `
                        : ''
                }
            </tbody>
        </table>
    </div>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        function openFile(filePath) {
            vscode.postMessage({ command: 'openFile', data: '${inventory.sourcePath}/' + filePath });
        }
        
        function exportInventory(format) {
            vscode.postMessage({ command: 'exportInventory', data: format });
        }
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Get empty state HTML.
     */
    private getEmptyStateHtml(nonce: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Discovery Results</title>
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
    <h2>No Discovery Results</h2>
    <p>Run the Discovery stage to scan for integration artifacts.</p>
    <button class="btn" onclick="vscode.postMessage({ command: 'startDiscovery' })">
        Start Discovery
    </button>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private getCategoryChartData(
        stats: ArtifactInventory['statistics']
    ): { label: string; count: number }[] {
        return Object.entries(stats.byCategory)
            .filter(([_, count]) => count > 0)
            .map(([category, count]) => ({
                label: this.getCategoryLabel(category as keyof typeof stats.byCategory),
                count,
            }))
            .sort((a, b) => b.count - a.count);
    }

    private getCategoryLabel(category: string): string {
        const labels: Record<string, string> = {
            orchestration: 'Orchestrations',
            flow: 'Flows',
            process: 'Processes',
            workflow: 'Workflows',
            map: 'Maps',
            schema: 'Schemas',
            pipeline: 'Pipelines',
            binding: 'Bindings',
            dataweave: 'DataWeave',
            esql: 'ESQL',
            api: 'APIs',
            connector: 'Connectors',
            config: 'Config',
            other: 'Other',
        };
        return labels[category] || category;
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

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
        DiscoveryWebviewPanel.currentPanel = undefined;
        this.panel.dispose();
        this.disposables.forEach((d) => d.dispose());
    }
}
