import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { testHost } from '../setup';
import { initializeParsers } from '../../parsers';
import { ArtifactScanner } from '../../stages/discovery/ArtifactScanner';
import { InventoryService } from '../../stages/discovery/InventoryService';
import { PlatformDetector } from '../../stages/discovery/PlatformDetector';
import { PlanningService } from '../../stages/planning/PlanningService';
import { PlanningCacheService } from '../../stages/planning/PlanningCacheService';
import { ConversionService } from '../../stages/conversion/ConversionService';

export const generatedAt = '2026-01-01T00:00:00.000Z';
let parsersInitialized = false;

export function createWorkspace(): string {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-stage-test-'));
    testHost.workspaceFolders = [{ uri: { fsPath: workspace }, name: 'Migration tests', index: 0 }];
    testHost.flowGroups = undefined;
    testHost.analyzedFlowIds.clear();
    testHost.logs.length = 0;
    PlanningCacheService.resetInstance();
    if (!parsersInitialized) {
        initializeParsers();
        parsersInitialized = true;
    }
    return workspace;
}

export function disposeWorkspace(workspace: string): void {
    ConversionService.getInstance().dispose();
    PlanningService.getInstance().dispose();
    InventoryService.getInstance().dispose();
    ArtifactScanner.getInstance().dispose();
    PlatformDetector.getInstance().dispose();
    PlanningCacheService.resetInstance();
    testHost.workspaceFolders = [];
    fs.rmSync(workspace, { recursive: true, force: true });
    assert.deepEqual(
        testHost.logs.filter((entry) => entry.level === 'WARN' || entry.level === 'ERROR'),
        [],
        'Unexpected warnings/errors from migration services'
    );
}
