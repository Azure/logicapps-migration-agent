import * as path from 'path';
import mock from 'mock-require';
import type * as vscode from 'vscode';
import type { FlowGroupsResult } from '../services/LLMFlowGenerator';

class TestEventEmitter<T> {
    private readonly listeners = new Set<(event: T) => unknown>();

    public readonly event = (
        listener: (event: T) => unknown,
        thisArgs?: unknown,
        disposables?: vscode.Disposable[]
    ): vscode.Disposable => {
        const boundListener = listener.bind(thisArgs);
        this.listeners.add(boundListener);
        const disposable = {
            dispose: () => {
                this.listeners.delete(boundListener);
            },
        };
        disposables?.push(disposable);
        return disposable;
    };

    public fire(event: T): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    public dispose(): void {
        this.listeners.clear();
    }
}

export const testHost = {
    workspaceFolders: [] as { uri: { fsPath: string }; name: string; index: number }[],
    flowGroups: undefined as FlowGroupsResult | undefined,
    analyzedFlowIds: new Set<string>(),
    logs: [] as { level: string; message: string }[],
};

mock('vscode', {
    EventEmitter: TestEventEmitter,
    workspace: {
        get workspaceFolders() {
            return testHost.workspaceFolders;
        },
    },
});

// Keep UI/LLM and telemetry boundaries out of the Node unit-test process.
mock(path.resolve(__dirname, '../views/discovery/SourceFlowVisualizer.js'), {
    SourceFlowVisualizer: {
        getStaticCachedFlowGroups: () => testHost.flowGroups,
        getGroupAnalysis: (flowId: string) => testHost.analyzedFlowIds.has(flowId),
    },
});
mock(path.resolve(__dirname, '../services/TelemetryService.js'), {
    TelemetryService: {
        getInstance: () => ({
            sendLog: (level: string, message: string) => {
                testHost.logs.push({ level, message });
            },
        }),
    },
});
