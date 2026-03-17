/**
 * Error Handler
 *
 * Global error handling with user notifications and recovery suggestions.
 */

import * as vscode from 'vscode';
import { LoggingService } from '../services/LoggingService';
import { TelemetryService } from '../services/TelemetryService';
import { MigrationError } from './MigrationError';
import { ParseError } from './ParseError';
import { ValidationError } from './ValidationError';
import { DeploymentError } from './DeploymentError';
import { UserPrompts } from '../constants/UserMessages';

/**
 * Error notification action
 */
interface ErrorAction {
    title: string;
    action: () => void | Promise<void>;
}

/**
 * Singleton error handler
 */
export class ErrorHandler implements vscode.Disposable {
    private static instance: ErrorHandler | undefined;
    private context: vscode.ExtensionContext | undefined;
    private readonly issueUrl =
        'https://github.com/microsoft/integration-migration-agent/issues/new';

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Initialize the error handler
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;

        // Note: We don't set up a global unhandledRejection handler because
        // it would catch errors from other extensions too. Instead, we use
        // try/catch and withErrorBoundary for our own async operations.

        LoggingService.getInstance().debug('Error handler initialized');
    }

    /**
     * Handle an error with appropriate logging, telemetry, and user notification
     */
    public handleError(error: unknown, context?: string): void {
        const migrationError = this.normalizeError(error, context);

        // Log the error
        LoggingService.getInstance().error(migrationError.message, migrationError, {
            code: migrationError.code,
            context,
        });

        // Send telemetry
        TelemetryService.getInstance().sendError(migrationError, {
            code: migrationError.code,
            context: context ?? 'unknown',
        });

        // Show user notification
        this.showErrorNotification(migrationError);
    }

    /**
     * Handle an error silently (log only, no user notification)
     */
    public handleErrorSilent(error: unknown, context?: string): void {
        const migrationError = this.normalizeError(error, context);

        LoggingService.getInstance().error(migrationError.message, migrationError, {
            code: migrationError.code,
            context,
        });

        TelemetryService.getInstance().sendError(migrationError, {
            code: migrationError.code,
            context: context ?? 'unknown',
        });
    }

    /**
     * Normalize any error to a MigrationError
     */
    private normalizeError(error: unknown, context?: string): MigrationError {
        if (error instanceof MigrationError) {
            return error;
        }

        return MigrationError.fromUnknown(error, context);
    }

    /**
     * Show an error notification to the user
     */
    private showErrorNotification(error: MigrationError): void {
        const actions = this.getErrorActions(error);
        const actionTitles = actions.map((a) => a.title);

        vscode.window.showErrorMessage(error.userMessage, ...actionTitles).then((selected) => {
            if (selected) {
                const action = actions.find((a) => a.title === selected);
                action?.action();
            }
        });
    }

    /**
     * Get available actions for an error
     */
    private getErrorActions(error: MigrationError): ErrorAction[] {
        const actions: ErrorAction[] = [];

        // Show logs action (always available)
        actions.push({
            title: UserPrompts.BUTTON_SHOW_LOGS,
            action: () => {
                LoggingService.getInstance().showOutputChannel();
            },
        });

        // Add error-specific actions
        if (error instanceof ParseError && error.filePath) {
            const errorFilePath = error.filePath;
            actions.push({
                title: UserPrompts.BUTTON_OPEN_FILE,
                action: async () => {
                    const uri = vscode.Uri.file(errorFilePath);
                    await vscode.window.showTextDocument(uri);
                },
            });
        }

        if (error instanceof ValidationError && error.issues.length > 0) {
            actions.push({
                title: UserPrompts.BUTTON_VIEW_ISSUES,
                action: () => {
                    this.showValidationIssues(error);
                },
            });
        }

        if (error instanceof DeploymentError) {
            actions.push({
                title: UserPrompts.BUTTON_CHECK_AZURE,
                action: async () => {
                    await vscode.env.openExternal(vscode.Uri.parse('https://portal.azure.com'));
                },
            });
        }

        // Report issue action
        actions.push({
            title: UserPrompts.BUTTON_REPORT_ISSUE,
            action: async () => {
                await this.reportIssue(error);
            },
        });

        return actions;
    }

    /**
     * Show validation issues in a quick pick
     */
    private showValidationIssues(error: ValidationError): void {
        const items = error.issues.map((issue) => ({
            label: `$(${issue.severity === 'error' ? 'error' : 'warning'}) ${issue.path}`,
            description: issue.message,
            detail: issue.severity,
        }));

        vscode.window.showQuickPick(items, {
            placeHolder: UserPrompts.VALIDATION_ISSUES_PLACEHOLDER,
            title: UserPrompts.validationIssuesTitle(
                error.getErrorCount(),
                error.getWarningCount()
            ),
        });
    }

    /**
     * Open browser to report an issue
     */
    private async reportIssue(error: MigrationError): Promise<void> {
        const title = encodeURIComponent(`[Bug] ${error.code}: ${error.message.slice(0, 50)}`);
        const body = encodeURIComponent(this.formatIssueBody(error));

        const url = `${this.issueUrl}?title=${title}&body=${body}&labels=bug`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
    }

    /**
     * Format the issue body for GitHub
     */
    private formatIssueBody(error: MigrationError): string {
        return `
## Error Details

- **Error Code**: ${error.code}
- **Message**: ${error.message}
- **VS Code Version**: ${vscode.version}
- **Extension Version**: ${this.context?.extension.packageJSON.version ?? 'unknown'}
- **OS**: ${process.platform}

## Steps to Reproduce

1. 
2. 
3. 

## Expected Behavior



## Actual Behavior

${error.userMessage}

## Additional Context

${error.suggestion ?? 'N/A'}

<details>
<summary>Stack Trace</summary>

\`\`\`
${error.stack ?? 'No stack trace available'}
\`\`\`

</details>
`.trim();
    }

    /**
     * Create an error boundary for async operations
     */
    public async withErrorBoundary<T>(
        operation: () => Promise<T>,
        context: string,
        options?: {
            silent?: boolean;
            rethrow?: boolean;
            defaultValue?: T;
        }
    ): Promise<T | undefined> {
        try {
            return await operation();
        } catch (error) {
            if (options?.silent) {
                this.handleErrorSilent(error, context);
            } else {
                this.handleError(error, context);
            }

            if (options?.rethrow) {
                throw error;
            }

            return options?.defaultValue;
        }
    }

    /**
     * Dispose the error handler
     */
    public dispose(): void {
        ErrorHandler.instance = undefined;
    }
}
