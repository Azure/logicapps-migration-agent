/**
 * Shared decompilation guidance used across planning/conversion prompts.
 */

/**
 * Instruction that enforces decompilation whenever compiled assemblies are
 * required to fully implement target workflows.
 */
export const WORKFLOW_COMPLETENESS_DECOMPILE_INSTRUCTION =
    'CRITICAL RULE — Auto-Decompile for workflow completeness: Whenever source behavior required to fully implement the workflows exists only in compiled assemblies (.dll/.exe), you MUST decompile the relevant assemblies using ILSpy CLI before designing or implementing workflows. This applies to orchestrations and any other workflow-critical logic (custom pipeline components, helper libraries, functoids, map extension code, shared business rules). Install if needed: dotnet tool install -g ilspycmd. Decompile into a FIXED location: ilspycmd <DllPath> -o out/__decompiled__/<DllNameWithoutExtension>/ (always use the out/__decompiled__/ folder under the workspace root so decompiled sources are consistent across runs and co-located with conversion outputs). Read the decompiled .cs files and implement complete workflow behavior. IMPORTANT: If the original source code (.cs, .vb files) is already present in the workspace, use it DIRECTLY — no decompilation needed. Always generate FULL, COMPLETE implementations with real business logic. Do NOT leave stub implementations, placeholder actions, NotImplementedException, TODO comments, or generic InvokeFunction catch-alls.';
