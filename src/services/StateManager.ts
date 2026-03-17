/**
 * State Manager Service
 *
 * Data storage for the migration workflow.
 * Maintains artifacts, project path, overrides, and user preferences.
 * Implements event-driven architecture for state change notifications.
 */

import * as vscode from 'vscode';
import { produce, enableMapSet } from 'immer';
import { StorageService, StorageKeys } from './StorageService';
import { LoggingService } from './LoggingService';
import { TelemetryService } from './TelemetryService';
import { MigrationStage } from '../types/stages';

// Enable Map and Set support in Immer
enableMapSet();

/**
 * Artifact types discovered during migration
 */
export interface DiscoveredArtifact {
    id: string;
    name: string;
    type: string;
    filePath: string;
    platform: string;
    lastModified?: string;
}

/**
 * Stage completion status
 */
export interface StageStatus {
    stage: MigrationStage;
    startedAt?: string;
    completedAt?: string;
    exitCriteriaChecked: string[];
}

/**
 * Override record for tracking user corrections
 */
export interface Override {
    id: string;
    field: string;
    originalValue: unknown;
    newValue: unknown;
    reason: string;
    source: 'chat' | 'ui' | 'api';
    timestamp: string;
    user?: string;
}

/**
 * Complete migration state
 */
export interface MigrationState {
    /** Current migration stage */
    currentStage: MigrationStage;

    /** Path to the source project */
    projectPath?: string;

    /** Source platform type */
    sourcePlatform?: string;

    /** Discovered artifacts inventory */
    inventory: DiscoveredArtifact[];

    /** Stage completion history */
    stageHistory: StageStatus[];

    /** User overrides */
    overrides: Override[];

    /** IR data cache reference (stored separately due to size) */
    irCacheId?: string;

    /** Last updated timestamp */
    lastUpdated: string;

    /** Extension version that created this state */
    extensionVersion: string;
}

/**
 * State change event payload
 */
export interface StateChangeEvent {
    previousState: MigrationState;
    currentState: MigrationState;
    changedFields: string[];
}

/**
 * Initial/default state
 */
function getInitialState(): MigrationState {
    return {
        currentStage: MigrationStage.NotStarted,
        projectPath: undefined,
        sourcePlatform: undefined,
        inventory: [],
        stageHistory: [],
        overrides: [],
        irCacheId: undefined,
        lastUpdated: new Date().toISOString(),
        extensionVersion: '1.0.0',
    };
}

/**
 * Singleton state manager
 */
export class StateManager implements vscode.Disposable {
    private static instance: StateManager | undefined;
    private state: MigrationState;
    private _context: vscode.ExtensionContext | undefined;

    private readonly _onDidChangeState = new vscode.EventEmitter<StateChangeEvent>();
    public readonly onDidChangeState = this._onDidChangeState.event;

    private readonly _onDidChangeStage = new vscode.EventEmitter<MigrationStage>();
    public readonly onDidChangeStage = this._onDidChangeStage.event;

    private constructor() {
        this.state = getInitialState();
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): StateManager {
        if (!StateManager.instance) {
            StateManager.instance = new StateManager();
        }
        return StateManager.instance;
    }

    /**
     * Initialize the state manager and restore persisted state
     */
    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        this._context = context;

        // Restore state from storage
        const storage = StorageService.getInstance();
        const savedState = storage.getWorkspace<MigrationState | undefined>(
            StorageKeys.MIGRATION_STATE,
            undefined
        );

        if (savedState) {
            this.state = { ...getInitialState(), ...savedState };
            LoggingService.getInstance().info('Migration state restored', {
                stage: this.state.currentStage,
                artifactCount: this.state.inventory.length.toString(),
            });
        } else {
            this.state = getInitialState();
            LoggingService.getInstance().debug('No saved state found, using initial state');
        }
    }

    /**
     * Get the current state (immutable copy)
     */
    public getState(): Readonly<MigrationState> {
        return { ...this.state };
    }

    /**
     * Get the extension context
     */
    public getContext(): vscode.ExtensionContext | undefined {
        return this._context;
    }

    /**
     * Get the current migration stage.
     */
    public getCurrentStage(): MigrationStage {
        return this.state.currentStage;
    }

    /**
     * Update state using Immer for immutable updates
     */
    public async updateState(
        updater: (draft: MigrationState) => void,
        changedFields: string[] = []
    ): Promise<void> {
        const previousState = { ...this.state };

        // Use Immer for immutable state updates
        this.state = produce(this.state, (draft) => {
            updater(draft);
            draft.lastUpdated = new Date().toISOString();
        });

        // Persist to storage
        await this.persistState();

        // Emit change event
        this._onDidChangeState.fire({
            previousState,
            currentState: this.state,
            changedFields,
        });

        // Check if stage changed
        if (previousState.currentStage !== this.state.currentStage) {
            LoggingService.getInstance().info('Stage changed', {
                previousStage: previousState.currentStage,
                currentStage: this.state.currentStage,
            });
            this._onDidChangeStage.fire(this.state.currentStage);
            TelemetryService.getInstance().sendEvent('stage.changed', {
                from: previousState.currentStage,
                to: this.state.currentStage,
            });
        }
    }

    /**
     * Set the project path
     */
    public async setProjectPath(path: string): Promise<void> {
        await this.updateState(
            (draft) => {
                draft.projectPath = path;
            },
            ['projectPath']
        );
    }

    /**
     * Add discovered artifacts to inventory
     */
    public async addArtifacts(artifacts: DiscoveredArtifact[]): Promise<void> {
        await this.updateState(
            (draft) => {
                for (const artifact of artifacts) {
                    const existing = draft.inventory.find((a) => a.id === artifact.id);
                    if (!existing) {
                        draft.inventory.push(artifact);
                    }
                }
            },
            ['inventory']
        );
    }

    /**
     * Add an override record
     */
    public async addOverride(override: Omit<Override, 'id' | 'timestamp'>): Promise<void> {
        await this.updateState(
            (draft) => {
                draft.overrides.push({
                    ...override,
                    id: `override-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                });
            },
            ['overrides']
        );

        TelemetryService.getInstance().sendEvent('override.added', {
            field: override.field,
            source: override.source,
        });
    }

    /**
     * Reset the migration state
     */
    public async resetState(): Promise<void> {
        const previousStage = this.state.currentStage;
        this.state = getInitialState();
        await this.persistState();

        this._onDidChangeState.fire({
            previousState: { ...this.state, currentStage: previousStage },
            currentState: this.state,
            changedFields: ['all'],
        });

        this._onDidChangeStage.fire(MigrationStage.NotStarted);

        LoggingService.getInstance().info('Migration state reset');
        TelemetryService.getInstance().sendEvent('state.reset');
    }

    /**
     * Create a snapshot of the current state for undo functionality
     */
    public createSnapshot(): MigrationState {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Restore state from a snapshot
     */
    public async restoreSnapshot(snapshot: MigrationState): Promise<void> {
        const previousState = { ...this.state };
        this.state = snapshot;
        await this.persistState();

        this._onDidChangeState.fire({
            previousState,
            currentState: this.state,
            changedFields: ['all'],
        });

        if (previousState.currentStage !== this.state.currentStage) {
            this._onDidChangeStage.fire(this.state.currentStage);
        }

        LoggingService.getInstance().info('State restored from snapshot');
    }

    /**
     * Persist state to storage
     */
    private async persistState(): Promise<void> {
        const storage = StorageService.getInstance();
        await storage.setWorkspace(StorageKeys.MIGRATION_STATE, this.state);
    }

    /**
     * Dispose the state manager
     */
    public dispose(): void {
        this._onDidChangeState.dispose();
        this._onDidChangeStage.dispose();
        StateManager.instance = undefined;
    }
}
