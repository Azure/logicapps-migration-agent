---
name: logic-apps-planning-rules
description: Rules for planning the migration of a TIBCO flow to Azure Logic Apps Standard. Covers workflow split policy, 1-flow-to-1-workflow rule, source coverage requirements, planning artifact store sequence, and design constraints.
---

# Skill: Logic Apps Planning Rules

> **Purpose**: Authoritative rules for how an AI agent should plan the target Logic Apps Standard architecture for a TIBCO migration. Follow exactly.

> **⚠️ DEPENDENCY PREREQUISITE**: Whenever source behavior required to fully implement the workflows exists only in custom Java classes, custom TIBCO modules, or compiled JARs, you MUST follow skill `dependency-and-decompilation-analysis` to analyse dependencies BEFORE designing the target architecture. This applies to flows and any workflow-critical logic — custom Java components, custom transformers, Mapper/XSLT modules with complex logic, and shared utility libraries. Do NOT proceed with planning until all relevant dependencies are analysed and their logic is understood.

---

## 1. Workflow Split Policy

- **Every discovered flow** (including sub-processes invoked via `process-call`) MUST map to its own separate Logic Apps workflow.
- Do NOT collapse sub-processes into local functions or merge them into a parent workflow.
- Use the Workflow action type (`InvokeWorkflow`) to call child workflows from parent workflows, mirroring the `process-call` pattern.
- Small, simple sub-processes (2–3 processors, no branching) MAY be inlined into the parent workflow if it simplifies the design — document this explicitly.
- You MUST enumerate ALL discovered flows and scenarios (happy path + branch/error/contingency paths) before deciding the workflow split.

---

## 2. Source Coverage Requirement

Build a one-to-one source coverage map: every discovered flow/sub-process/processor MUST appear in:

- workflow definitions, OR
- action mappings, OR
- an explicit gap entry.

Nothing from the source may be silently dropped.

---

## 3. Design Constraints

### 3.00 Integration Account Decision Rule

- Explicitly decide during planning whether this flow needs an Integration Account.
- Use an Integration Account only for Integration Account-specific capabilities, especially B2B/EDI scenarios such as X12, EDIFACT, AS2, trading partners, agreements, or centrally managed shared B2B artifacts.
- Do NOT choose Integration Account when Logic Apps Standard artifact folders are sufficient for schemas, maps, templates, and other workflow-local artifacts.
- If Integration Account is used, use it consistently for the flow's deployable artifacts. Do NOT split artifacts between Integration Account and Logic App artifact folders for the same flow.
- If Integration Account is used, the plan MUST include a provisioning task that deploys the Integration Account first, then captures the deployed resource ID and callback URL into `local.settings.json` as `WORKFLOWS_INTEGRATION_ACCOUNT_ID` and `WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL`.
- If Integration Account is used, the plan MUST include a follow-on artifact upload task that uploads the required Integration Account artifacts after provisioning succeeds.

### 3.0 Preserve Source Design

> **⚠️ MANDATORY DESIGN PRESERVATION RULE:** Do NOT independently simplify, optimize, refactor, merge, reorder, or redesign the source flow. The target plan MUST preserve the **same source design and execution intent** unless there is a documented platform gap or the user explicitly asks for a redesign.

- Preserve the original flow boundaries, sub-process call structure, choice branching, scatter-gather parallelism, foreach iteration, sequencing, and error-handler decomposition as closely as Logic Apps permits.
- Do NOT combine separate source processors into one target step merely because it looks simpler, unless the source already treated them as one logical unit or an unavoidable platform limitation requires it.
- Do NOT remove intermediate steps, set-variable operations, logger steps, or transformation stages unless they are explicitly proven redundant from the source behavior.
- If any deviation from source design is unavoidable, document it explicitly in action mappings and gaps with the exact reason.

### 3.1 SplitOn over ForEach

When a trigger returns an array (batch of messages), ALWAYS use `splitOn` on the trigger instead of wrapping actions in a `For_each` loop. SplitOn debatches the array so each item fires a separate workflow run. Only use `For_each` if splitOn is not supported by that trigger type.

### 3.2 File System Trigger Semantics

Do NOT add delete/remove/cleanup actions that remove the trigger input file by default. The runtime does not re-trigger on the same unchanged file, so deleting is unnecessary unless the user explicitly requests it.

### 3.3 Component Priority Ladder

> **⚠️ MANDATORY OVERRIDE — READ THIS FIRST:**
> Source custom code — custom Java classes, custom TIBCO modules/connectors, Java-interop XPath expressions, custom message processors — MUST **ALWAYS** map to **.NET local functions**. Do NOT simplify custom code to expressions, inline code, or any other level. This overrides the ladder below. Translate the real business logic from source code — never approximate with expressions.

For all **other** (non-custom-code) components:

1. Built-in actions (HTTP, Compose, Parse JSON, Select, SQL Connector, Service Bus, Transform XML/Xslt, XmlParse, XmlValidation, Flat File Decode/Encode) → 2. Expressions → 3. Data Mapper/Liquid (for Mapper/XSLT conversions) → 4. Inline Code → 5. .NET local functions → 6. Azure Functions (last resort).

> **AUTO-APPLY RULE**: Always choose the HIGHEST applicable level without asking the user. If a built-in action exists (e.g. SQL Connector for JDBC SQL activities, HTTP for http:request), use it — do NOT fall back to expressions or ask.

> **Mapper/XSLT PROCESSING RULE**: For Mapper/XSLT transformations (`mapper activity`), assess complexity. Simple field mappings (process-data field expressions, basic map/filter) → Liquid templates or Compose actions. Complex scripts with reduce, groupBy, match, custom functions → .NET local functions. Always flag Mapper/XSLT conversions as gaps requiring review.

---

## 4. Reference Lookup (MANDATORY)

Before generating any workflow definition:

1. Read the skill `source-to-logic-apps-mapping` to look up the exact Logic Apps Standard equivalent for every TIBCO processor.
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
8. `migration_planning_storeArtifactDispositions` — flowId and dispositions array. ONLY include artifacts that need conversion or upload: Mapper/XSLT scripts (.dwl → Liquid/XSLT), RAML/OAS specs, JSON/XML schemas, custom Java code (.java → local function), certificates. Do NOT include flow XMLs or property files. Each entry needs: artifactName, artifactType, conversionRequired, uploadDestination (integration-account / logic-app-artifact-folder / azure-function / not-applicable), uploadNotes (REQUIRED). When conversionRequired=true, also include conversionFrom, conversionTo, conversionNotes. If the plan uses Integration Account, artifact dispositions must consistently use `integration-account` instead of mixing destinations.
9. `migration_planning_finalize` — flowId to validate and display the plan.


