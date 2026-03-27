/**
 * ChatPrompts - Centralized chat prompt string constants
 *
 * All prompt strings sent to the agent chat via `workbench.action.chat.open`
 * are defined here. Template strings use static methods that accept parameters.
 *
 * Skills are referenced by name (backtick-quoted) and the agent reads them
 * via the VS Code skill system. If prompt and skill conflict, skill wins.
 *
 * Usage:
 *   import { ChatPrompts } from '../constants/ChatPrompts';
 *   const query = ChatPrompts.planForFlow({ flowName, flowId, artifactList, decompileInstruction });
 *   await vscode.commands.executeCommand('workbench.action.chat.open', { mode: 'agent', query });
 */

// ============================================================================
// Shared prompt fragments (kept minimal — detail lives in skills)
// ============================================================================

const AUTONOMOUS_MODE_SHORT =
    'AUTONOMOUS MODE: Execute ALL steps without asking for confirmation. Do NOT pause to ask questions. Run all tool calls directly. ';

const SKILL_AUTHORITY =
    'SKILL AUTHORITY: You MUST read every referenced skill BEFORE starting work. Treat skills as authoritative — if this prompt and a skill conflict, the skill wins. Your output will be rejected if it violates a skill. ';

const GLOBAL_LOOKUP_POLICY =
    'SCOPE POLICY: Start from the selected flow/task artifacts, but if any required dependency, import/using, schema, map, connector, class, or configuration detail is missing or unclear, you MUST expand to full-project lookup using migration_listArtifacts, migration_searchArtifacts, migration_getArtifactDetails, and migration_readSourceFile. Do NOT assume dependencies are group-local. ';

// ============================================================================
// ChatPrompts class
// ============================================================================

interface PlanForFlowParams {
    flowName: string;
    flowId: string;
    artifactList: string;
}

interface ConversionForFlowParams {
    flowName: string;
    flowId: string;
    azureResourceGroup: string;
    azureLocation: string;
    azureSubscriptionId: string;
    outputProjectName: string;
    outputProjectRoot: string;
    outputLogicAppName: string;
    outputLogicAppRoot: string;
}

interface ExecuteSingleTaskParams {
    taskName: string;
    taskId: string;
    flowName: string;
    flowId: string;
    taskType: string;
    taskDescription: string;
    taskExecutionPrompt: string;
    taskOrder: number;
    taskDependsOn: string;
    artifactContext: string;
    completedContext: string;
    scaffoldExtra: string;
    outputProjectRoot: string;
    outputLogicAppRoot: string;
    resourceGroup: string;
    location: string;
}

interface ExecuteAllTasksParams {
    flowName: string;
    flowId: string;
    nextTaskName: string;
    nextTaskId: string;
    nextTaskType: string;
    nextTaskDescription: string;
    nextTaskExecutionPrompt: string;
    nextTaskOrder: number;
    nextTaskDependsOn: string;
    artifactContext: string;
    completedContext: string;
    remainingContext: string;
    scaffoldExtra: string;
    outputProjectRoot: string;
    outputLogicAppRoot: string;
    resourceGroup: string;
    location: string;
}

interface FlowAnalysisParams {
    flowName: string;
    flowId: string;
}

interface OpenFlowChatParams {
    groupLabel: string;
    explanationBlock: string;
    mermaid: string;
    userQuery: string;
}

export class ChatPrompts {
    // ========================================================================
    // Flow Group Detection (Discovery)
    // ========================================================================

    static flowGroupDetection(): string {
        return (
            '@migration-analyser Detect flow groups for the discovered integration artifacts.\n' +
            AUTONOMOUS_MODE_SHORT +
            SKILL_AUTHORITY +
            '\nREQUIRED SKILLS: Read `detect-logical-groups` first and follow it exactly.\n' +
            'The skill contains all grouping rules, fallback logic, and required output fields.\n' +
            'Do NOT read source files or generate architecture diagrams — only detect and store groups.'
        );
    }

    // ========================================================================
    // Plan for Flow (Planning)
    // ========================================================================

    static planForFlow(params: PlanForFlowParams): string {
        return (
            `@migration-planner Plan the migration for flow "${params.flowName}" (flowId: "${params.flowId}").\n` +
            AUTONOMOUS_MODE_SHORT +
            SKILL_AUTHORITY +
            GLOBAL_LOOKUP_POLICY +
            '\nREQUIRED SKILLS (read ALL before starting):\n' +
            '- `logic-apps-planning-rules` — workflow split policy, coverage requirements, planning store sequence\n' +
            '- `dependency-and-decompilation-analysis` — MUST decompile any .dll/.exe whose source is missing before designing workflows\n' +
            '- `source-to-logic-apps-mapping` — component equivalents, service provider IDs, operation names\n' +
            '- `workflow-json-generation-rules` — workflow.json authoring, splitOn, file trigger semantics\n' +
            '- `connections-json-generation-rules` — connections.json format and connector parameters\n' +
            `\n${params.artifactList}\n` +
            '\nPROCEDURE:\n' +
            `1. Call migration_detectFlowGroups with groupId="${params.flowId}", then call migration_getDiscoveryAnalysis to get cached analysis.\n` +
            '2. If discovery analysis is available, use it. Otherwise fall back to migration_getArtifactDetails and migration_readSourceFile.\n' +
            '3. If any dependency or detail cannot be resolved from this flow group context, run full-project artifact search and source reads before finalizing the plan.\n' +
            '4. Design the target architecture per skill `logic-apps-planning-rules`.\n' +
            '5. Generate Mermaid flowchart TB showing target architecture.\n' +
            '6. Look up every component in skill `source-to-logic-apps-mapping`, then search reference workflows with those names.\n' +
            '7. Store planning results in the exact order specified by skill `logic-apps-planning-rules` (storeMeta → storeArchitecture → storeWorkflowDefinition per workflow → storeAzureComponents → storeActionMappings → storeGaps → storePatterns → storeArtifactDispositions → finalize).'
        );
    }

    // ========================================================================
    // Conversion for Flow (Generate Tasks)
    // ========================================================================

    static conversionForFlow(params: ConversionForFlowParams): string {
        const subscriptionSuffix = params.azureSubscriptionId
            ? `, SubscriptionId="${params.azureSubscriptionId}"`
            : '';
        return (
            `@migration-converter Convert the flow "${params.flowName}" (flowId: "${params.flowId}").\n` +
            AUTONOMOUS_MODE_SHORT +
            SKILL_AUTHORITY +
            GLOBAL_LOOKUP_POLICY +
            '\nREQUIRED SKILLS (read ALL before starting):\n' +
            '- `conversion-task-plan-rules` — task ordering, required types, ID rules, output paths\n' +
            '- `scaffold-logic-apps-project` — exact scaffold files and structure\n' +
            '- `workflow-json-generation-rules` — workflow.json authoring and connector selection\n' +
            '- `connections-json-generation-rules` — connections.json format and parameters\n' +
            '- `no-stubs-code-generation` — all code must be fully implemented\n' +
            '- `dependency-and-decompilation-analysis` — MUST decompile any .dll/.exe whose source is missing before generating tasks\n' +
            '- `runtime-validation-and-testing` — validation, test matrix, reporting\n' +
            '- `cloud-deployment-and-testing` — optional cloud deploy task rules\n' +
            '- `source-to-logic-apps-mapping` — component equivalents\n' +
            '- `dotnet-local-functions-logic-apps` — .NET local function project structure\n' +
            `\nAZURE SETTINGS: Resource Group="${params.azureResourceGroup}", Location="${params.azureLocation}"${subscriptionSuffix}.\n` +
            `OUTPUT PATHS: Workspace root="${params.outputProjectRoot}/", Logic App="${params.outputLogicAppRoot}/", ` +
            `Workspace file="${params.outputProjectRoot}/${params.outputProjectName}.code-workspace".\n` +
            `Scaffold params: workspaceName="${params.outputProjectName}", logicAppName="${params.outputLogicAppName}".\n` +
            '\nPROCEDURE:\n' +
            '1. Call migration_conversion_getPlanningResults to get the finalized plan.\n' +
            '2. Determine ALL conversion tasks per skill `conversion-task-plan-rules`.\n' +
            '3. Call migration_conversion_storeTaskPlan with flowId, summary, and task list.\n' +
            'Task IDs MUST be descriptive (not "task-1") — see skill for rules.'
        );
    }

    // ========================================================================
    // Execute Single Conversion Task
    // ========================================================================

    static executeSingleTask(params: ExecuteSingleTaskParams): string {
        return (
            `@migration-converter Execute conversion task "${params.taskName}" (taskId: "${params.taskId}") ` +
            `for flow "${params.flowName}" (flowId: "${params.flowId}").\n` +
            AUTONOMOUS_MODE_SHORT +
            SKILL_AUTHORITY +
            GLOBAL_LOOKUP_POLICY +
            '\nREQUIRED SKILLS: Read `workflow-json-generation-rules`, `connections-json-generation-rules`, `no-stubs-code-generation`, ' +
            '`dependency-and-decompilation-analysis` (decompile .dll/.exe when source is unavailable), `runtime-validation-and-testing`, `source-to-logic-apps-mapping` as needed for this task type.\n' +
            `\nAZURE SETTINGS: Resource Group="${params.resourceGroup}", Location="${params.location}".\n` +
            `OUTPUT PATHS: Project="${params.outputProjectRoot}/", LogicApp="${params.outputLogicAppRoot}/".\n` +
            `\nTask details:\n- Type: ${params.taskType}\n- Description: ${params.taskDescription}\n` +
            `- Execution Prompt: ${params.taskExecutionPrompt}\n- Order: ${params.taskOrder}\n- Dependencies: ${params.taskDependsOn}\n` +
            `${params.artifactContext}${params.completedContext}${params.scaffoldExtra}` +
            '\nPROCEDURE:\n' +
            '1. Call migration_conversion_getPlanningResults to get the full planning context.\n' +
            '2. If you need source details, use migration_readSourceFile and migration_getArtifactDetails.\n' +
            '3. Execute the task per the execution prompt and applicable skills.\n' +
            `4. Call migration_conversion_storeTaskOutput with flowId="${params.flowId}", taskId="${params.taskId}", summary, and generatedFiles.\n` +
            'Do NOT re-plan or re-generate the task plan — only execute this specific task.\n' +
            'PLAN ADHERENCE: Do not deviate from the planned design. If a fix requires design changes, STOP and report.'
        );
    }

    // ========================================================================
    // Execute All Conversion Tasks
    // ========================================================================

    static executeAllTasks(params: ExecuteAllTasksParams): string {
        return (
            `@migration-converter Execute ALL remaining conversion tasks for flow "${params.flowName}" (flowId: "${params.flowId}"), starting with task "${params.nextTaskName}" (taskId: "${params.nextTaskId}").\n` +
            AUTONOMOUS_MODE_SHORT +
            SKILL_AUTHORITY +
            GLOBAL_LOOKUP_POLICY +
            '\nREQUIRED SKILLS (read ALL before starting):\n' +
            '- `workflow-json-generation-rules` — workflow.json authoring\n' +
            '- `connections-json-generation-rules` — connections.json format\n' +
            '- `no-stubs-code-generation` — all code fully implemented\n' +
            '- `dependency-and-decompilation-analysis` — MUST decompile any .dll/.exe whose source is missing before implementing\n' +
            '- `runtime-validation-and-testing` — validation, test matrix, local-first strategy, reporting\n' +
            '- `source-to-logic-apps-mapping` — component equivalents\n' +
            `\nAZURE SETTINGS: Resource Group="${params.resourceGroup}", Location="${params.location}".\n` +
            `OUTPUT PATHS: Project="${params.outputProjectRoot}/", LogicApp="${params.outputLogicAppRoot}/".\n` +
            `\nCurrent task:\n- Type: ${params.nextTaskType}\n- Description: ${params.nextTaskDescription}\n` +
            `- Execution Prompt: ${params.nextTaskExecutionPrompt}\n- Order: ${params.nextTaskOrder}\n- Dependencies: ${params.nextTaskDependsOn}\n` +
            `${params.artifactContext}${params.completedContext}${params.remainingContext}${params.scaffoldExtra}` +
            '\nPROCEDURE:\n' +
            '1. Call migration_conversion_getPlanningResults to get the full planning context.\n' +
            '2. For each task in order:\n' +
            '   a. Read source artifacts if needed.\n' +
            '   b. Execute the task per its execution prompt and applicable skills.\n' +
            '   c. Call migration_conversion_storeTaskOutput with flowId, taskId, summary, generatedFiles.\n' +
            '   d. Move to the NEXT pending task — do NOT stop.\n' +
            '3. After ALL tasks complete, call migration_conversion_finalize.\n' +
            'Execute tasks sequentially. Do NOT stop between tasks. Do NOT execute optional tasks (like cloud-deploy-test).\n' +
            'PLAN ADHERENCE: Do not deviate from the planned design. If a fix requires design changes, STOP and report.'
        );
    }

    // ========================================================================
    // Flow Analysis (Discovery — per-flow)
    // ========================================================================

    static flowAnalysis(params: FlowAnalysisParams): string {
        return (
            `@migration-analyser Analyse the "${params.flowName}" flow group (groupId: "${params.flowId}") and generate a full architecture visualization.\n` +
            AUTONOMOUS_MODE_SHORT +
            SKILL_AUTHORITY +
            GLOBAL_LOOKUP_POLICY +
            '\nREQUIRED SKILLS (read ALL before starting):\n' +
            '- `analyse-source-design` — source reading depth, Mermaid diagram rules, MessageBox modeling, orchestration shapes, component mapping priority ladder, store tool sequence\n' +
            '- `dependency-and-decompilation-analysis` — DLL decompilation, missing dependency classification\n' +
            '- `source-to-logic-apps-mapping` — component equivalents, service provider IDs, operation names\n' +
            `\nPROCEDURE:\n` +
            `1. Call migration_detectFlowGroups with groupId="${params.flowId}" to retrieve the cached group artifact list.\n` +
            '2. Call migration_getArtifactDetails and migration_readSourceFile for EVERY artifact per skill `analyse-source-design`.\n' +
            '3. If any required dependency/detail is unresolved, expand to full-project lookup (all artifacts), then continue analysis.\n' +
            '4. Perform dependency analysis per skill `dependency-and-decompilation-analysis` (decompile DLLs/JARs, classify missing deps).\n' +
            '5. Look up every component in skill `source-to-logic-apps-mapping`, then search reference docs with those names.\n' +
            '6. Generate Mermaid architecture diagram per skill `analyse-source-design` rules.\n' +
            `7. Store discovery results in the exact order specified by skill \`analyse-source-design\` (storeMeta → storeArchitecture → storeComponents → storeMessageFlow → storeGaps → storePatterns → storeDependencies → finalize), all with flowId="${params.flowId}".`
        );
    }

    // ========================================================================
    // Open Flow Chat (review diagram)
    // ========================================================================

    static openFlowChat(params: OpenFlowChatParams): string {
        return [
            `I'm looking at an integration flow diagram${params.groupLabel}.${params.explanationBlock}`,
            '',
            'Here is the current Mermaid diagram:',
            '```mermaid',
            params.mermaid,
            '```',
            '',
            params.userQuery,
        ].join('\n');
    }

    // ========================================================================
    // Scaffold Extra (reusable fragment)
    // ========================================================================

    static scaffoldExtra(
        outputProjectName: string,
        outputLogicAppName: string,
        outputProjectRoot: string,
        outputLogicAppRoot: string
    ): string {
        return (
            '\nSCAFFOLD REQUIREMENT: \nYou MUST read the skill `scaffold-logic-apps-project` FIRST and follow it exactly. ' +
            `\nPass workspaceName="${outputProjectName}" and logicAppName="${outputLogicAppName}". ` +
            `\nThe workspace root is "${outputProjectRoot}/" and the Logic App folder is "${outputLogicAppRoot}/". ` +
            '\nDo NOT guess or hardcode file contents — use the exact contents from the skill. ' +
            '\nDo NOT create connections.json, workflow folders, or Functions/ folder during scaffold.\n'
        );
    }

    // ========================================================================
    // Remaining Tasks Context
    // ========================================================================

    static remainingTasksContext(remainingCount: number, remainingIds: string): string {
        if (remainingCount > 0) {
            return (
                `\nAfter completing this task, there are ${remainingCount} more tasks remaining: ${remainingIds}. ` +
                'After calling migration_conversion_storeTaskOutput for this task, ' +
                'IMMEDIATELY proceed to execute the next pending task in order — ' +
                'do NOT wait for user input. Continue until all tasks are done, then call migration_conversion_finalize. ' +
                'NOTE: Optional tasks (like cloud-deploy-test) are NOT included — do NOT execute them. They are handled separately by the user.\n'
            );
        }
        return '\nThis is the LAST task. After calling migration_conversion_storeTaskOutput, call migration_conversion_finalize to complete the flow.\n';
    }
}
