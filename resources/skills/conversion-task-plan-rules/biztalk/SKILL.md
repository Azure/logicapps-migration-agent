---
name: conversion-task-plan-rules
description: Rules for generating ordered conversion task plans. Covers mandatory task ordering, required task types, descriptive task ID rules, optional vs non-optional tasks, output path conventions, and what each task must contain.
---

# Skill: Conversion Task Plan Rules

> **Purpose**: Authoritative rules for how an AI agent should generate the ordered task plan for converting a flow. Follow exactly.

> **⚠️ DECOMPILATION PREREQUISITE**: Whenever source behavior required to fully implement the workflows exists only in compiled assemblies (.dll/.exe), you MUST follow skill `dependency-and-decompilation-analysis` to decompile BEFORE generating conversion tasks. This applies to orchestrations and any workflow-critical logic — custom pipeline components, helper libraries, functoids, map extension code, and shared business rules. Do NOT generate tasks until all relevant assemblies are decompiled and their logic is understood.

---

## 1. Task Derivation

After reading planning results (`migration_conversion_getPlanningResults`), determine ALL conversion tasks needed based on the specific flow's planned architecture.

---

## 2. Mandatory Task Order

### 2.1 Task 1 — Scaffold (REQUIRED)

- Type: `scaffold-project`
- MUST be the first task.
- Read the skill `scaffold-logic-apps-project` and follow it exactly.
- Do NOT inline scaffold details — just reference the skill.

### 2.2 Artifact Tasks (Middle)

After scaffold, add tasks for:

- Schemas → `{outputLogicAppRoot}/Artifacts/Schemas/`
- Maps → `{outputLogicAppRoot}/Artifacts/Maps/`
- Local functions → using skill `dotnet-local-functions-logic-apps`
- Workflows → `{outputLogicAppRoot}/<Name>/workflow.json`
- Connections → `{outputLogicAppRoot}/connections.json`
- Cloud resource provisioning (only for connectors with no local alternative)

**IMPORTANT Integration Account decision rule:**

- For every artifact-related task, the agent MUST explicitly think through whether an Integration Account is required.
- Use an Integration Account when the design requires Integration Account-only capabilities, especially B2B/EDI scenarios such as X12, EDIFACT, AS2, trading partners, agreements, or centralized shared artifact management.
- If an Integration Account is used for the flow, then ALL deployable artifacts for that flow must be planned for the Integration Account path/use model consistently.
- Do NOT split artifacts between Integration Account and the Logic App artifact folders. These two models are mutually exclusive for a given flow plan.
- If an Integration Account is used, create/provision/configure the Integration Account BEFORE any schema/map/certificate/trading-partner artifact task that depends on it.
- If an Integration Account is used, the Integration Account provisioning task MUST actually deploy/create the Integration Account resource in Azure in that task itself. It must NOT stop at generating deployment scripts or templates only.
- That Integration Account provisioning task MUST retrieve the deployed Integration Account resource ID and callback URL, then update `local.settings.json` with `WORKFLOWS_INTEGRATION_ACCOUNT_ID` and `WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL` in that same task.
- The NEXT Integration Account-related artifact task MUST upload the required schemas/maps/certificates/partners/agreements into the Integration Account itself. Do NOT leave artifact upload implicit or deferred.
- If the flow does NOT require an Integration Account, then use the Logic App artifact folders only.
- If an Integration Account is used, the plan MUST also account for the required Logic Apps Standard app settings: `WORKFLOWS_INTEGRATION_ACCOUNT_ID`, with the Integration Account resource ID as its value (example: `/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.Logic/integrationAccounts/{name}`), and `WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL`, with the correct Integration Account callback URL value.
- Any Integration Account provisioning/configuration task MUST put that app setting requirement directly into its `executionPrompt`, not only in the high-level summary.
- The task plan MUST make this choice explicit in the artifact task descriptions or execution prompts.

### 2.3 Runtime Validation (REQUIRED)

- Type: `validate-runtime`
- Must come after all generation tasks.
- Runs `func start --verbose`, checks for errors, fixes issues, re-runs until clean.

### 2.4 Local E2E Testing (REQUIRED)

- Type: `test-workflows`
- Name: "End to End Testing (Local Environment)"
- Must come after runtime validation.
- Full test matrix (see skill `runtime-validation-and-testing`).

### 2.5 Cloud Testing (OPTIONAL — LAST)

- Type: `cloud-deploy-test`
- Name: "End to End Testing (Cloud Environment) (Only if required)"
- MUST be the ABSOLUTE LAST task.
- Mark as `optional: true` — user decides whether to execute or skip.

---

## 3. Task ID Rules

- Task IDs MUST be descriptive: e.g. `scaffold-project`, `convert-schemas`, `generate-workflow-receive-order`, `provision-servicebus`, `validate-runtime`, `test-workflows`, `cloud-deploy-test`.
- NEVER use generic sequential IDs like `task-1`, `task-2` — they will be REJECTED by the tool.

---

## 4. Required Task Fields

Each task needs:

| Field              | Type     | Required | Description                                       |
| ------------------ | -------- | -------- | ------------------------------------------------- |
| `id`               | string   | Yes      | Descriptive unique ID                             |
| `type`             | string   | Yes      | Short type label                                  |
| `name`             | string   | Yes      | Human-readable name                               |
| `description`      | string   | Yes      | Concise user-facing summary (1-2 lines)           |
| `executionPrompt`  | string   | No       | Detailed agent-only instructions for execution    |
| `dependsOn`        | string[] | Yes      | Prerequisite task IDs                             |
| `order`            | number   | Yes      | 1-based execution sequence                        |
| `artifactIds`      | string[] | No       | Artifact IDs this task operates on                |
| `estimatedMinutes` | number   | No       | Effort estimate                                   |
| `optional`         | boolean  | No       | True for user-skippable tasks (e.g. cloud-deploy) |

---

## 5. Output Path Conventions

- Workspace root: `{outputProjectRoot}/`
- Logic App project: `{outputLogicAppRoot}/`
- Workspace file: `{outputProjectRoot}/{outputProjectName}.code-workspace`
- Every task description MUST state the exact output file path relative to the project root.
- NEVER scaffold into the source project root.

---

## 6. Key Rules for Task Descriptions

- For each task, set `description` to a concise user-facing summary (1-2 lines).
- Put all detailed implementation steps/rules into `executionPrompt`.
- Workflow generation tasks MUST include: "Read skill `source-to-logic-apps-mapping` first, then search reference workflows."
- Connection generation tasks MUST include: "Search with `category=connection` to find exact `connections.json` format."
- Local function tasks MUST reference skill `dotnet-local-functions-logic-apps`.
- ALL code generation tasks MUST follow skill `no-stubs-code-generation`.
