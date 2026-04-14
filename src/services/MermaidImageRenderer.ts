/**
 * Mermaid Image Renderer Service
 *
 * Converts Mermaid diagram code to PNG images using a hidden VS Code webview.
 * The webview loads the mermaid library, renders the diagram to SVG,
 * draws it onto a canvas, and sends the PNG data back via postMessage.
 * Renders with white background and black lines for professional report embedding.
 */

import * as vscode from 'vscode';
import { LoggingService } from './LoggingService';

export class MermaidImageRenderer implements vscode.Disposable {
    private static instance: MermaidImageRenderer | undefined;
    private readonly logger = LoggingService.getInstance();
    private readonly disposables: vscode.Disposable[] = [];

    private constructor() {}

    public static getInstance(): MermaidImageRenderer {
        if (!MermaidImageRenderer.instance) {
            MermaidImageRenderer.instance = new MermaidImageRenderer();
        }
        return MermaidImageRenderer.instance;
    }

    /**
     * Render a Mermaid diagram string to a PNG buffer using a hidden webview.
     * Returns undefined if rendering fails.
     */
    public async renderToBuffer(mermaidCode: string): Promise<Buffer | undefined> {
        try {
            const pngDataUri = await this.renderInWebview(mermaidCode);
            if (!pngDataUri) {
                return undefined;
            }
            // Strip the data:image/png;base64, prefix
            const base64 = pngDataUri.replace(/^data:image\/png;base64,/, '');
            return Buffer.from(base64, 'base64');
        } catch (err) {
            this.logger.warn(
                `[MermaidImageRenderer] Rendering failed: ${err instanceof Error ? err.message : String(err)}`
            );
            return undefined;
        }
    }

    /**
     * Uses a hidden VS Code webview panel to render Mermaid → SVG → PNG.
     * Returns a base64 data URI for the PNG, or undefined on failure.
     */
    private renderInWebview(mermaidCode: string): Promise<string | undefined> {
        return new Promise((resolve) => {
            const panel = vscode.window.createWebviewPanel(
                'mermaidRenderer',
                'Mermaid Renderer',
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                { enableScripts: true, retainContextWhenHidden: true }
            );

            // Auto-cleanup timeout (30s)
            const timeout = setTimeout(() => {
                this.logger.warn('[MermaidImageRenderer] Render timed out after 30s');
                panel.dispose();
                resolve(undefined);
            }, 30000);

            panel.webview.onDidReceiveMessage(
                (message: { command: string; data?: string; error?: string }) => {
                    clearTimeout(timeout);
                    if (message.command === 'renderResult' && message.data) {
                        resolve(message.data);
                    } else if (message.command === 'renderError') {
                        this.logger.warn(
                            `[MermaidImageRenderer] Webview render error: ${message.error}`
                        );
                        resolve(undefined);
                    } else {
                        resolve(undefined);
                    }
                    panel.dispose();
                },
                null,
                this.disposables
            );

            // Hide the panel immediately so the user doesn't see it flash
            // (VS Code doesn't have truly invisible webviews, but we minimize disruption)

            const escapedMermaid = mermaidCode
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`')
                .replace(/\$/g, '\\$');

            panel.webview.html = this.getRendererHtml(escapedMermaid);
        });
    }

    private getRendererHtml(escapedMermaidCode: string): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data:;">
    <style>
        body { margin: 0; padding: 20px; background: #ffffff; }
        #container { background: #ffffff; }
    </style>
</head>
<body>
    <div id="container"></div>
    <canvas id="canvas" style="display:none;"></canvas>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();

        async function renderDiagram() {
            try {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    themeVariables: {
                        primaryColor: '#f4f4f4',
                        primaryTextColor: '#000000',
                        primaryBorderColor: '#333333',
                        lineColor: '#333333',
                        secondaryColor: '#e8e8e8',
                        tertiaryColor: '#ffffff',
                        background: '#ffffff',
                        mainBkg: '#f4f4f4',
                        nodeBorder: '#333333',
                        clusterBkg: '#f9f9f9',
                        clusterBorder: '#aaaaaa',
                        titleColor: '#000000',
                        edgeLabelBackground: '#ffffff'
                    },
                    flowchart: { htmlLabels: false, curve: 'basis' },
                    securityLevel: 'loose'
                });

                const code = \`${escapedMermaidCode}\`;
                const { svg } = await mermaid.render('mermaid-diagram', code);

                // Insert SVG into DOM to get dimensions
                const container = document.getElementById('container');
                container.innerHTML = svg;

                const svgEl = container.querySelector('svg');
                if (!svgEl) {
                    vscode.postMessage({ command: 'renderError', error: 'SVG element not found' });
                    return;
                }

                // Get the actual rendered size
                const bbox = svgEl.getBoundingClientRect();
                const width = Math.ceil(bbox.width) || 1600;
                const height = Math.ceil(bbox.height) || 900;

                // Scale up for crisp output (2x)
                const scale = 2;
                const canvas = document.getElementById('canvas');
                canvas.width = width * scale;
                canvas.height = height * scale;
                const ctx = canvas.getContext('2d');

                // White background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);

                // Convert SVG to image via base64 data URI (more reliable than Blob URL in webviews)
                const svgData = new XMLSerializer().serializeToString(svgEl);
                const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
                const dataUri = 'data:image/svg+xml;base64,' + svgBase64;

                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, width, height);
                    const pngDataUri = canvas.toDataURL('image/png');
                    vscode.postMessage({ command: 'renderResult', data: pngDataUri });
                };
                img.onerror = (e) => {
                    vscode.postMessage({ command: 'renderError', error: 'Image load failed: ' + e });
                };
                img.src = dataUri;

            } catch (err) {
                vscode.postMessage({ command: 'renderError', error: String(err) });
            }
        }

        renderDiagram();
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
        MermaidImageRenderer.instance = undefined;
    }
}
