/**
 * UserPrompts - Centralized user-facing string constants
 *
 * All prompt strings shown to users through VS Code notifications,
 * dialogs, quick picks, and progress indicators are defined here.
 * Template strings use static methods that accept parameters.
 *
 * Usage:
 *   import { UserPrompts } from '../constants/UserPrompts';
 *   vscode.window.showInformationMessage(UserPrompts.migrationReset());
 *   vscode.window.showErrorMessage(UserPrompts.discoveryFailed(errMsg));
 */

// ============================================================================
// String format helper
// ============================================================================

/**
 * Simple string format function that replaces {0}, {1}, ... with arguments.
 *
 * Example:
 *   format('Found {0} artifact(s) in {1}.', 5, 'MyProject')
 *   // => 'Found 5 artifact(s) in MyProject.'
 */
function format(template: string, ...args: (string | number)[]): string {
    return template.replace(/\{(\d+)\}/g, (_, index) => {
        const i = parseInt(index, 10);
        return i < args.length ? String(args[i]) : `{${index}}`;
    });
}

// ============================================================================
// UserPrompts class
// ============================================================================

export class UserPrompts {
    // ========================================================================
    // Common Button Labels
    // ========================================================================

    static readonly BUTTON_RELOAD_WINDOW = 'Reload Window';
    static readonly BUTTON_LATER = 'Later';
    static readonly BUTTON_CANCEL = 'Cancel';
    static readonly BUTTON_RESET = 'Reset';
    static readonly BUTTON_YES_CANCEL = 'Yes, Cancel';
    static readonly BUTTON_NO = 'No';
    static readonly BUTTON_VIEW_RESULTS = 'View Results';
    static readonly BUTTON_CHANGE_SOURCE_FOLDER = 'Change Source Folder';
    static readonly BUTTON_RUN_DISCOVERY = 'Run Discovery';
    static readonly BUTTON_EXTRACT_AND_DISCOVER = 'Extract & Discover';
    static readonly BUTTON_RESET_AND_CONTINUE = 'Reset & Continue';
    static readonly BUTTON_SELECT_ANYWAY = 'Select Anyway';
    static readonly BUTTON_CHOOSE_DIFFERENT_FOLDER = 'Choose Different Folder';
    static readonly BUTTON_YES_CHANGE_FOLDER = 'Yes, Change Folder';
    static readonly BUTTON_INSTALL_REQUIRED = 'Install Required';
    static readonly BUTTON_LEARN_MORE = 'Learn More';
    static readonly BUTTON_INSTALL = 'Install';
    static readonly BUTTON_DONT_SHOW_AGAIN = "Don't Show Again";
    static readonly BUTTON_SHOW_LOGS = 'Show Logs';
    static readonly BUTTON_OPEN_FILE = 'Open File';
    static readonly BUTTON_VIEW_ISSUES = 'View Issues';
    static readonly BUTTON_CHECK_AZURE = 'Check Azure';
    static readonly BUTTON_REPORT_ISSUE = 'Report Issue';
    static readonly BUTTON_RETRY = 'Retry';
    static readonly BUTTON_DISMISS = 'Dismiss';
    static readonly BUTTON_SELECT = 'Select';

    // ========================================================================
    // Extension (extension.ts)
    // ========================================================================

    static extensionUpdated(version: string): string {
        return format(
            'Logic Apps Migration Agent updated to v{0}. A window reload is recommended to register new tools.',
            version
        );
    }

    // ========================================================================
    // Command Registry — Start Migration
    // ========================================================================

    static migrationInProgress(folderName: string, stage: string): string {
        return format('Migration in progress for "{0}" (stage: {1}).', folderName, stage);
    }

    static sourceFolderSelectedNotComplete(folderName: string): string {
        return format('Source folder selected: "{0}". Discovery not yet complete.', folderName);
    }

    // ========================================================================
    // Command Registry — Select Source Folder
    // ========================================================================

    static readonly SELECT_SOURCE_FOLDER_OPEN_LABEL = 'Select Source Project Folder or MSI';
    static readonly SELECT_SOURCE_FOLDER_TITLE = 'Select Integration Project Folder or BizTalk MSI';
    static readonly MSI_EXTRACTION_WINDOWS_ONLY = 'MSI extraction is only supported on Windows.';

    static msiFilesFound(count: number, names: string): string {
        return format(
            'Found {0} MSI file(s): {1}. Extract to discover BizTalk artifacts?',
            count,
            names
        );
    }

    static readonly PROGRESS_EXTRACTING_MSI = 'Extracting MSI Package(s)';

    static msiExtractionFailed(errors: string): string {
        return format('MSI extraction failed: {0}', errors);
    }

    static msiExtractionSuccess(totalLeaves: number, successCount: number): string {
        return format(
            'Extracted {0} artifact(s) from {1} MSI file(s). Proceeding with discovery on extracted content.',
            totalLeaves,
            successCount
        );
    }

    static readonly MIGRATION_RESET_WARNING =
        'A migration is already in progress. Selecting a new folder will reset all progress.';
    static readonly PROGRESS_RUNNING_DISCOVERY = 'Running Discovery';

    static discoveryComplete(artifactCount: number): string {
        return format('Discovery complete! Found {0} artifact(s).', artifactCount);
    }

    static discoveryCancelled(reason: string): string {
        return format('Discovery cancelled: {0}', reason);
    }

    // ========================================================================
    // Command Registry — View Inventory / Export / Reset
    // ========================================================================

    static readonly RESET_MIGRATION_CONFIRM =
        'Are you sure you want to reset the migration? All progress will be lost.';
    static readonly MIGRATION_HAS_BEEN_RESET = 'Migration has been reset.';

    // ========================================================================
    // Command Registry — Run Discovery / Rescan
    // ========================================================================

    static discoveryCompleteCount(count: number): string {
        return format('Discovery complete: Found {0} artifacts', count);
    }

    static discoveryFailed(errorMsg: string): string {
        return format('Discovery failed: {0}', errorMsg);
    }

    static rescanComplete(count: number): string {
        return format('Rescan complete: Found {0} artifacts', count);
    }

    static rescanFailed(errorMsg: string): string {
        return format('Rescan failed: {0}', errorMsg);
    }

    // ========================================================================
    // Command Registry — Flow Visualization
    // ========================================================================

    static readonly NO_ARTIFACTS_RUN_DISCOVERY =
        'No artifacts discovered yet. Run discovery first.';

    static flowGroupDetectionFailed(errorMsg: string): string {
        return format('Failed to start flow group detection: {0}', errorMsg);
    }

    // ========================================================================
    // Command Registry — Dependency Graph
    // ========================================================================

    static readonly DEPENDENCY_GRAPH_IN_DISCOVERY =
        'Dependency graph is included in the Discovery Results panel.';
    static readonly NO_DISCOVERY_RESULTS = 'No discovery results available. Run discovery first.';

    // ========================================================================
    // Command Registry — Planning
    // ========================================================================

    static readonly NO_FLOW_SPECIFIED_PLANNING = 'No flow specified for planning.';

    static generatingPlanForFlow(flowName: string): string {
        return format(
            'Generating migration plan for "{0}" in a new Agent chat session...',
            flowName
        );
    }

    static failedToOpenAgentChatPlanning(errorMsg: string): string {
        return format('Failed to open agent chat for planning. {0}', errorMsg);
    }

    // ========================================================================
    // Command Registry — Conversion
    // ========================================================================

    static readonly NO_FLOW_SPECIFIED_CONVERSION = 'No flow specified for conversion.';

    static analysingConversionTasks(flowName: string): string {
        return format(
            'Analysing conversion tasks for "{0}" in a new Agent chat session...',
            flowName
        );
    }

    static failedToOpenAgentChatConversion(errorMsg: string): string {
        return format('Failed to open agent chat for conversion. {0}', errorMsg);
    }

    // ========================================================================
    // Command Registry — Execute Conversion Task
    // ========================================================================

    static readonly NO_FLOW_OR_TASK_SPECIFIED = 'No flow or task specified.';
    static readonly NO_TASK_PLAN_FOUND = 'No task plan found. Run "Plan Conversion" first.';

    static taskNotFound(taskId: string): string {
        return format('Task "{0}" not found in the task plan.', taskId);
    }

    static cannotExecuteTaskWaiting(taskName: string, deps: string): string {
        return format('Cannot execute "{0}" — waiting for: {1}', taskName, deps);
    }

    static failedToStartTaskExecution(errorMsg: string): string {
        return format('Failed to start task execution. {0}', errorMsg);
    }

    // ========================================================================
    // Command Registry — Execute All Conversion Tasks
    // ========================================================================

    static readonly NO_FLOW_SPECIFIED = 'No flow specified.';
    static readonly ALL_TASKS_COMPLETE = 'All conversion tasks are already complete!';
    static readonly NO_EXECUTABLE_TASKS =
        'No executable tasks found — some tasks may be waiting for in-progress dependencies.';

    static failedToStartConversion(errorMsg: string): string {
        return format('Failed to start conversion. {0}', errorMsg);
    }

    // ========================================================================
    // Prerequisites Checker
    // ========================================================================

    static missingRequiredExtensions(count: number): string {
        return format('Logic Apps Migration Agent: {0} required extension(s) missing.', count);
    }

    static readonly COPILOT_RECOMMENDED =
        'GitHub Copilot recommended for AI-powered migration analysis.';

    // ========================================================================
    // Error Handler
    // ========================================================================

    static readonly VALIDATION_ISSUES_PLACEHOLDER = 'Validation Issues';

    static validationIssuesTitle(errorCount: number, warningCount: number): string {
        return format('{0} errors, {1} warnings', errorCount, warningCount);
    }

    static readonly RETRY_FAILED = 'Retry failed. Please try again.';

    // ========================================================================
    // Discovery Service
    // ========================================================================

    static readonly PROGRESS_DISCOVERY_STAGE = 'Discovery Stage';
    static readonly NO_SOURCE_FOLDER_SELECTED = 'No source folder selected';

    // ========================================================================
    // Artifact Scanner
    // ========================================================================

    static readonly PROGRESS_SCANNING_ARTIFACTS = 'Scanning for artifacts...';

    // ========================================================================
    // Source Folder Service
    // ========================================================================

    static readonly SELECT_SOURCE_PROJECT_LABEL = 'Select Source Project';
    static readonly SELECT_INTEGRATION_PROJECT_TITLE = 'Select Integration Project Folder';

    static noIntegrationFilesFound(folderName: string): string {
        return format(
            'No recognizable integration files found in "{0}". This folder may not contain a supported integration project.',
            folderName
        );
    }

    static readonly CHANGE_FOLDER_CONFIRM =
        'Changing the source folder will clear existing discovery data. Continue?';

    // ========================================================================
    // Platform Detector
    // ========================================================================

    static readonly PLATFORM_PICKER_PLACEHOLDER = 'Confirm or select the source platform';
    static readonly PLATFORM_PICKER_TITLE = 'Select Source Platform';

    // ========================================================================
    // Inventory Service
    // ========================================================================

    static inventoryExportedTo(filePath: string): string {
        return format('Inventory exported to {0}', filePath);
    }

    // ========================================================================
    // Quick Pick Dialogs
    // ========================================================================

    static readonly SOURCE_PLATFORM_PLACEHOLDER = 'Select the source integration platform';
    static readonly SOURCE_PLATFORM_TITLE = 'Source Platform';
    static readonly SELECT_ARTIFACTS_PLACEHOLDER = 'Select artifacts to include';
    static readonly SELECT_ARTIFACTS_TITLE = 'Select Artifacts';

    static proceedToStageLabel(stageLabel: string): string {
        return format('$(arrow-right) Proceed to {0}', stageLabel);
    }

    static readonly MOVE_TO_NEXT_STAGE = 'Move to the next stage';

    static reviewStageResultsLabel(stageLabel: string): string {
        return format('$(eye) Review {0} Results', stageLabel);
    }

    static readonly REVIEW_BEFORE_PROCEEDING = 'Review before proceeding';
    static readonly GO_BACK_LABEL = '$(arrow-left) Go Back';
    static readonly RETURN_TO_PREVIOUS_STAGE = 'Return to previous stage';

    static stayInStageLabel(stageLabel: string): string {
        return format('$(x) Stay in {0}', stageLabel);
    }

    static readonly CONTINUE_WORKING = 'Continue working in current stage';
    static readonly EXIT_CRITERIA_MET_PLACEHOLDER = 'All exit criteria met. Ready to proceed?';
    static readonly EXIT_CRITERIA_NOT_MET_PLACEHOLDER =
        'Exit criteria not complete. What would you like to do?';

    static stageCompleteTitle(stageLabel: string): string {
        return format('{0} Complete', stageLabel);
    }

    static readonly AUTO_GENERATE_LABEL = '$(tools) Auto-generate';
    static readonly AUTO_GENERATE_DESC = 'Create scaffold, stub, or placeholder code';
    static readonly AUTO_GENERATE_DETAIL = 'The extension will generate boilerplate code for you';
    static readonly USE_ALTERNATIVE_LABEL = '$(lightbulb) Use Alternative';
    static readonly USE_ALTERNATIVE_DEFAULT_DESC = 'Apply recommended Logic Apps pattern';
    static readonly USE_ALTERNATIVE_DETAIL =
        'Use a different approach that achieves similar results';
    static readonly MANUAL_LABEL = '$(pencil) Manual';
    static readonly MANUAL_DESC = 'Mark for manual implementation';
    static readonly MANUAL_DETAIL = 'Add TODO with implementation guide';
    static readonly SKIP_LABEL = '$(debug-step-over) Skip';
    static readonly SKIP_DESC = 'Exclude feature and revisit later';
    static readonly SKIP_DETAIL = 'Add comment to revisit in the future';

    static gapResolutionPlaceholder(gapTitle: string): string {
        return format('How would you like to handle: {0}?', gapTitle);
    }

    static readonly GAP_RESOLUTION_TITLE = 'Gap Resolution';
    static readonly SELECT_FOLDER_DEFAULT_TITLE = 'Select Folder';
    static readonly SELECT_FILE_DEFAULT_TITLE = 'Select File';

    // ========================================================================
    // Progress Notifications
    // ========================================================================

    static parsingProgress(artifactCount: number): string {
        return format('Parsing {0} artifacts...', artifactCount);
    }

    static convertingProgress(workflowCount: number): string {
        return format('Converting {0} workflows...', workflowCount);
    }

    static readonly PROGRESS_DEPLOYING = 'Deploying to Azure...';
    static readonly PROGRESS_VALIDATING = 'Validating artifacts...';

    // ========================================================================
    // Welcome Panel
    // ========================================================================

    static readonly WELCOME_PANEL_TITLE = 'Welcome to Logic Apps Migration Agent';
    static readonly SELECT_SOURCE_FOLDER_LABEL = 'Select Source Folder';
    static readonly SELECT_INTEGRATION_SOURCE_TITLE = 'Select Integration Source Folder';

    // ========================================================================
    // Migration Plan Panel
    // ========================================================================

    static readonly MIGRATION_PLAN_TITLE = 'Migration Plan';

    static cannotMoveViolation(violation: string): string {
        return format('Cannot move: {0}', violation);
    }

    static migrationPlanExported(filePath: string): string {
        return format('Migration plan exported to {0}', filePath);
    }

    // ========================================================================
    // Conversion Preview Panel
    // ========================================================================

    static readonly CONVERSION_PREVIEW_TITLE = 'Conversion Preview';
    static readonly COPIED_TO_CLIPBOARD = 'Copied to clipboard';

    static savedToPath(filePath: string): string {
        return format('Saved to {0}', filePath);
    }

    // ========================================================================
    // Deployment Panel
    // ========================================================================

    static readonly DEPLOYMENT_STATUS_TITLE = 'Deployment Status';
    static readonly CANCEL_DEPLOYMENT_CONFIRM = 'Are you sure you want to cancel the deployment?';

    // ========================================================================
    // Source Flow Visualizer
    // ========================================================================

    static readonly FLOW_VIZ_ALREADY_IN_PROGRESS =
        'Flow visualization generation is already in progress.';
    static readonly PNG_EXPORT_NOT_IMPLEMENTED = 'PNG export not yet implemented';
    static readonly SVG_EXPORT_NOT_IMPLEMENTED = 'SVG export not yet implemented';
    static readonly FLOW_GROUP_ALREADY_GENERATING =
        'Generation for this flow group is already in progress.';
    static readonly FLOW_NOT_ANALYSED =
        'This flow has not been analysed yet. Click "Analyse" to start.';
    static readonly ANOTHER_FLOW_ANALYSING =
        'Another flow is currently being analysed. Please wait for it to complete.';

    static failedToOpenAgentChat(errorMsg: string): string {
        return format('Failed to open agent chat: {0}', errorMsg);
    }

    static failedToStartPlanning(errorMsg: string): string {
        return format('Failed to start planning: {0}', errorMsg);
    }

    static failedToOpenPlan(errorMsg: string): string {
        return format('Failed to open plan: {0}', errorMsg);
    }

    static failedToStartConversionVisualizer(errorMsg: string): string {
        return format('Failed to start conversion: {0}', errorMsg);
    }

    static failedToOpenConversion(errorMsg: string): string {
        return format('Failed to open conversion: {0}', errorMsg);
    }

    static failedToExecute(errorMsg: string): string {
        return format('Failed to execute: {0}', errorMsg);
    }

    static readonly NO_PROJECT_FOLDER = 'No project folder found.';
    static readonly NO_CODE_WORKSPACE_FILE =
        'No .code-workspace file found. Run Execute first to generate the project.';

    static failedToOpenProject(errorMsg: string): string {
        return format('Failed to open project: {0}', errorMsg);
    }

    static flowGroupGenerationInProgress(groupName: string): string {
        return format(
            'Generation for "{0}" is already in progress. Check the Agent chat panel.',
            groupName
        );
    }

    static generatingGroupInChat(groupName: string): string {
        return format('Generating "{0}" in a new Agent chat session...', groupName);
    }

    static failedToOpenAgentChatForGroup(groupName: string): string {
        return format('Failed to open agent chat for "{0}"', groupName);
    }

    static readonly CHAT_CONTEXT_COPIED =
        'Chat context copied to clipboard. Paste it into a Copilot Chat window.';

    // ========================================================================
    // Planning Webview Panel
    // ========================================================================

    static failedToStartPlanningPanel(error: string): string {
        return format('Failed to start planning: {0}', error);
    }

    static failedToReplan(error: string): string {
        return format('Failed to replan: {0}', error);
    }

    static failedToClearPlan(error: string): string {
        return format('Failed to clear existing plan: {0}', error);
    }

    // ========================================================================
    // Conversion Webview Panel
    // ========================================================================

    static failedToStartConversionPanel(error: string): string {
        return format('Failed to start conversion: {0}', error);
    }

    static failedToReconvert(error: string): string {
        return format('Failed to reconvert: {0}', error);
    }

    static failedToExecuteTask(error: string): string {
        return format('Failed to execute task: {0}', error);
    }

    static failedToExecuteAllTasks(error: string): string {
        return format('Failed to Execute All tasks: {0}', error);
    }

    static readonly NO_CONVERSION_TASK_PLAN =
        'No conversion task plan found. Run "Plan Conversion" first.';
    static readonly NO_WORKSPACE_FOLDER = 'No workspace folder found.';

    static projectFolderNotFound(projectPath: string): string {
        return format('Project folder not found: {0}. Run the scaffold task first.', projectPath);
    }
}
