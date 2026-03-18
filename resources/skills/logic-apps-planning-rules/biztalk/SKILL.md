---
name: logic-apps-planning-rules
description: Rules for planning the migration of a flow to Azure Logic Apps Standard. Covers workflow split policy, 1-orchestration-to-1-workflow rule, source coverage requirements, planning artifact store sequence, and design constraints.
---

# Skill: Logic Apps Planning Rules

> **Purpose**: Authoritative rules for how an AI agent should plan the target Logic Apps Standard architecture. Follow exactly.

> **⚠️ DECOMPILATION PREREQUISITE**: Whenever source behavior required to fully implement the workflows exists only in compiled assemblies (.dll/.exe), you MUST follow skill `dependency-and-decompilation-analysis` to decompile BEFORE designing the target architecture. This applies to orchestrations and any workflow-critical logic — custom pipeline components, helper libraries, functoids, map extension code, and shared business rules. Do NOT proceed with planning until all relevant assemblies are decompiled and their logic is understood.

---

## 1. Workflow Split Policy

- **Every discovered orchestration** (including sub-orchestrations called via Call Orchestration or Start Orchestration) MUST map to its own separate Logic Apps workflow.
- Do NOT collapse sub-orchestrations into local functions or merge them into a parent workflow.
- Use the Workflow action type (`InvokeWorkflow`) to call child workflows from parent workflows.
- You MUST enumerate ALL discovered orchestrations and scenarios (happy path + branch/error/contingency paths) before deciding the workflow split.

---

## 2. Source Coverage Requirement

Build a one-to-one source coverage map: every discovered orchestration/scenario MUST appear in:

- workflow definitions, OR
- action mappings, OR
- an explicit gap entry.

Nothing from the source may be silently dropped.

---

## 3. Design Constraints

### 3.0 Preserve Source Design

> **⚠️ MANDATORY DESIGN PRESERVATION RULE:** Do NOT independently simplify, optimize, refactor, merge, reorder, or redesign the BizTalk flow. The target plan MUST preserve the **same source design and execution intent** unless there is a documented platform gap or the user explicitly asks for a redesign.

- Preserve the original orchestration boundaries, call structure, branching shape, sequencing, message construction pattern, and helper/local processing decomposition as closely as Logic Apps permits.
- Do NOT combine separate source steps into one target step merely because it looks simpler, unless the source already treated them as one logical unit or an unavoidable platform limitation requires it.
- Do NOT remove intermediate steps, wrapper/message-construction steps, helper calls, or transformation stages unless they are explicitly proven redundant from the source behavior.
- If any deviation from source design is unavoidable, document it explicitly in action mappings and gaps with the exact reason.

### 3.1 SplitOn over ForEach

When a trigger returns an array (batch of messages), ALWAYS use `splitOn` on the trigger instead of wrapping actions in a `For_each` loop. SplitOn debatches the array so each item fires a separate workflow run. Only use `For_each` if splitOn is not supported by that trigger type.

### 3.2 File System Trigger Semantics

Do NOT add delete/remove/cleanup actions that remove the trigger input file by default. The runtime does not re-trigger on the same unchanged file, so deleting is unnecessary unless the user explicitly requests it.

### 3.3 Component Priority Ladder

> **⚠️ MANDATORY OVERRIDE — READ THIS FIRST:**
> Source custom code — scripting functoids, external assemblies (.dll), custom pipeline components, helper libraries, map extension objects — MUST **ALWAYS** map to **.NET local functions**. Do NOT simplify custom code to expressions, inline code, or any other level. This overrides the ladder below. Translate the real business logic from source or decompiled code — never approximate with expressions.

For all **other** (non-custom-code) components:

1. Built-in actions (XmlParse, XmlValidation, Xslt, Compose, Parse JSON, Select, Flat File Decode/Encode) → 2. Expressions → 3. Data Mapper/Liquid → 4. Inline Code → 5. .NET local functions → 6. Azure Functions (last resort).

> **AUTO-APPLY RULE**: Always choose the HIGHEST applicable level without asking the user. If a built-in action exists (e.g. XmlParse for XML processing), use it — do NOT fall back to expressions or ask.

> **XML PROCESSING RULE**: For XML parsing, validation, or structured access, ALWAYS use XmlParse / XmlValidation (built-in XML Operations) instead of `xpath()` expressions. XmlParse validates against schemas and returns structured JSON. xpath() skips validation and is verbose. This applies to all BizTalk XMLReceive pipeline replacements.

---

## 4. Reference Lookup (MANDATORY)

Before generating any workflow definition:

1. Read the skill `source-to-logic-apps-mapping` to look up the exact Logic Apps Standard equivalent for every component.
2. Call `migration_searchReferenceWorkflows` and `migration_readReferenceWorkflow` to find real reference examples.
3. Use the operation names from the mapping skill as search terms.
4. Copy exact `serviceProviderConfiguration` and `operationId` values from references — do NOT invent these.
5. If the first search returns no relevant results, RETRY 2-4 more times with different word combinations.
6. Also call `migration_readReferenceDoc` to verify connector capabilities.

---

## 5. Required Planning Store Sequence

Store planning results in THIS order:

1. `migration_planning_storeMeta` — flowId, flowName, explanation, summary.
2. `migration_planning_storeArchitecture` — flowId and Mermaid `flowchart TB` diagram.
3. `migration_planning_storeWorkflowDefinition` — call once PER workflow. Each call MUST include `flowId`, `name`, `workflowDefinition` (with `definition.triggers`, `definition.actions` with `runAfter`, `type` for each action), and a `mermaid` field with a `flowchart TB` diagram. The mermaid field is ENFORCED and will be rejected if missing when multiple workflows exist.
4. `migration_planning_storeAzureComponents` — flowId and components array.
5. `migration_planning_storeActionMappings` — flowId and mappings array (source → target for each component; include `workflowName` when multiple workflows exist).
6. `migration_planning_storeGaps` — flowId and gaps array (empty if none).
7. `migration_planning_storePatterns` — flowId and patterns array (empty if none).
8. `migration_planning_storeArtifactDispositions` — flowId and dispositions array. ONLY include artifacts that need conversion or upload: schemas (.xsd), maps (.btm → XSLT), custom code (.cs/.dll → local function), certificates. Do NOT include orchestrations, pipelines, or bindings. Each entry needs: artifactName, artifactType, conversionRequired, uploadDestination (integration-account / logic-app-artifact-folder / azure-function / not-applicable), uploadNotes (REQUIRED). When conversionRequired=true, also include conversionFrom, conversionTo, conversionNotes.
9. `migration_planning_finalize` — flowId to validate and display the plan.
