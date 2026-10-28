import type * as vscode from 'vscode';
import Module from 'module';
import * as path from 'path';

interface ModuleLoader {
    _load(request: string, parent: NodeModule | undefined, isMain: boolean): unknown;
}

export const mockState = {
    workspacePath: undefined as string | undefined,
    explicitDeployment: undefined as string | undefined,
    answers: [] as (string | undefined)[],
    prompts: [] as string[],
    notifications: [] as string[],
    planningGroupIds: new Set<string>(),
    tools: new Map<string, vscode.LanguageModelTool<unknown>>(),
};

class CancellationError extends Error {}

export const cancellationToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => undefined }),
};

const vscodeMock = {
    CancellationError,
    EventEmitter: class {
        event = () => ({ dispose: () => undefined });
        fire(): undefined {
            return undefined;
        }
        dispose(): undefined {
            return undefined;
        }
    },
    workspace: {
        get workspaceFolders() {
            return mockState.workspacePath
                ? [{ uri: { fsPath: mockState.workspacePath } }]
                : undefined;
        },
        getConfiguration: () => ({
            inspect: () => ({ workspaceValue: mockState.explicitDeployment }),
            get: () => undefined,
        }),
        fs: { readDirectory: async () => [] },
    },
    window: {
        showQuickPick: async (items: { optionId: string }[], options: { placeHolder: string }) => {
            mockState.prompts.push(options.placeHolder);
            const answer = mockState.answers.shift();
            return items.find((item) => item.optionId === answer);
        },
        showInformationMessage: async (message: string) => {
            mockState.notifications.push(message);
        },
        showErrorMessage: async (message: string) => {
            mockState.notifications.push(message);
        },
        showWarningMessage: async (message: string) => {
            mockState.notifications.push(message);
        },
    },
    LanguageModelTextPart: class {
        constructor(public value: string) {}
    },
    LanguageModelToolResult: class {
        constructor(public content: unknown[]) {}
    },
    env: { isTelemetryEnabled: false },
    extensions: {
        getExtension: () => ({
            extensionUri: { fsPath: path.resolve(__dirname, '..', '..', '..') },
        }),
    },
    Uri: {
        file: (fsPath: string) => ({ fsPath }),
        joinPath: (uri: { fsPath: string }, ...segments: string[]) => ({
            fsPath: path.join(uri.fsPath, ...segments),
        }),
    },
    lm: {
        registerTool(name: string, tool: vscode.LanguageModelTool<unknown>) {
            mockState.tools.set(name, tool);
            return { dispose: () => mockState.tools.delete(name) };
        },
    },
};

const loader = Module as typeof Module & ModuleLoader;
const originalLoad = loader._load;
loader._load = function (request, parent, isMain) {
    if (request === 'vscode') {
        return vscodeMock;
    }
    if (
        request.endsWith('/views/discovery/SourceFlowVisualizer') ||
        request.endsWith('../discovery/SourceFlowVisualizer')
    ) {
        return {
            SourceFlowVisualizer: {
                planningGroupIds: mockState.planningGroupIds,
                currentPanel: undefined,
                getGroupAnalysis: () => ({}),
                getStaticCachedFlowGroups: () => undefined,
            },
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
