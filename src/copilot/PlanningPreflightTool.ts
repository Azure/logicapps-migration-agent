import * as vscode from 'vscode';
import { LoggingService } from '../services/LoggingService';
import { UserPrompts } from '../constants/UserMessages';
import { PlanningDecisionService } from '../stages/planning/PlanningDecisionService';
import { PlanningQuestion } from '../stages/planning/PlanningDecisions';
import { PlanningFileService } from '../stages/planning/PlanningFileService';

interface PlanningPreflightInput {
    flowId: string;
    action: 'read' | 'resolve';
    questions?: PlanningQuestion[];
    reconsider?: boolean;
    deploymentTarget?: string;
}

export class PlanningPreflightTool implements vscode.LanguageModelTool<PlanningPreflightInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<PlanningPreflightInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const {
            flowId,
            action,
            questions = [],
            reconsider = false,
            deploymentTarget,
        } = options.input;
        try {
            if (
                !flowId?.trim() ||
                !['read', 'resolve'].includes(action) ||
                !Array.isArray(questions)
            ) {
                throw new Error(
                    'Provide a flowId, action (read or resolve), and an optional questions array.'
                );
            }
            const preferences =
                action === 'read'
                    ? PlanningFileService.getInstance().readPreferences(flowId)
                    : await new PlanningDecisionService().resolve(
                          flowId,
                          questions,
                          token,
                          reconsider,
                          deploymentTarget
                      );
            return this.result({
                preferences: preferences ?? null,
                ready: preferences?.status === 'ready',
                message:
                    action === 'read'
                        ? 'Reuse saved answers. Resolve hosting first, verify capabilities, then ask only remaining critical choices before generating one plan.'
                        : preferences?.status === 'pending'
                          ? 'Do not generate artifacts yet. Pending questions remain saved. Verify their options for the selected host, then resolve those questions. A hosting-only call does not clear unresolved decisions.'
                          : 'Use these choices for one plan. Make minor behavior-preserving decisions automatically; record alternatives and modernization opportunities in the brief.',
            });
        } catch (error) {
            if (error instanceof vscode.CancellationError) {
                await this.pausePlanning(flowId);
                void vscode.window.showInformationMessage(UserPrompts.PLANNING_CHOICES_PAUSED);
                return this.result({
                    cancelled: true,
                    ready: false,
                    message:
                        'Stop planning. Do not choose defaults or generate artifacts; answered choices are saved.',
                });
            }
            LoggingService.getInstance().error(
                '[PlanningPreflight] Failed',
                error instanceof Error ? error : new Error(String(error))
            );
            if (typeof flowId === 'string' && flowId.trim()) {
                await this.pausePlanning(flowId);
            }
            return this.result({
                error: error instanceof Error ? error.message : String(error),
                ready: false,
            });
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<PlanningPreflightInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return { invocationMessage: `Planning choices for ${options.input.flowId}` };
    }

    private result(value: unknown): vscode.LanguageModelToolResult {
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(value)),
        ]);
    }

    private async pausePlanning(flowId: string): Promise<void> {
        const { SourceFlowVisualizer } = await import('../views/discovery/SourceFlowVisualizer');
        SourceFlowVisualizer.planningGroupIds.delete(flowId);
        if (SourceFlowVisualizer.currentPanel) {
            SourceFlowVisualizer.showFlowGroupSelector(
                SourceFlowVisualizer.currentPanel.extensionUri
            );
        }
        const { PlanningService } = await import('../stages/planning/PlanningService');
        await PlanningService.getInstance().pausePlanning(flowId);
    }
}
