import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { LoggingService } from '../../services/LoggingService';

const DISCOVERY_COMMAND = 'logicAppsMigrationAgent.discoverBizTalkEnvironment';
const PENDING_PREFIX = 'bizTalkDiscovery.pending:';

/** Opening the first folder restarts the extension host, so resume after activation. */
export async function ensureDiscoveryWorkspace(
    context: vscode.ExtensionContext
): Promise<vscode.WorkspaceFolder | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder) {
        if (folder.uri.scheme !== 'file') {
            throw new Error('BizTalk discovery requires a local filesystem workspace.');
        }
        return folder;
    }

    const baseDir = path.join(os.homedir(), 'LogicAppsMigration');
    await fs.promises.mkdir(baseDir, { recursive: true });
    const workspacePath = await fs.promises.mkdtemp(path.join(baseDir, 'BizTalk-'));
    const pendingKey = `${PENDING_PREFIX}${workspacePath}`;
    await context.globalState.update(pendingKey, true);
    LoggingService.getInstance().info('Created workspace for BizTalk discovery', { workspacePath });
    try {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspacePath), {
            forceReuseWindow: true,
        });
    } catch (error) {
        await context.globalState.update(pendingKey, undefined);
        throw error;
    }
    return undefined;
}

export async function resumePendingBizTalkDiscovery(
    context: vscode.ExtensionContext
): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || folder.uri.scheme !== 'file') {
        return;
    }
    const pendingKey = `${PENDING_PREFIX}${folder.uri.fsPath}`;
    if (!context.globalState.get<boolean>(pendingKey)) {
        return;
    }
    await context.globalState.update(pendingKey, undefined);
    await vscode.commands.executeCommand(DISCOVERY_COMMAND);
}
