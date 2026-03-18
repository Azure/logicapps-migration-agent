---
name: conversion-task-plan-rules
description: Rules for generating ordered conversion task plans. Covers mandatory task ordering, required task types, descriptive task ID rules, optional vs non-optional tasks, output path conventions, and what each task must contain.
---

# Skill: Conversion Task Plan Rules

> **Purpose**: Authoritative rules for how an AI agent should generate the ordered task plan for converting a flow. Follow exactly.

> **⚠️ DEPENDENCY PREREQUISITE**: Whenever source behavior required to fully implement the workflows exists only in custom Java classes, custom Mule modules, or compiled JAR files, you MUST follow skill `dependency-and-decompilation-analysis` to analyse dependencies BEFORE generating conversion tasks. This applies to flows and any workflow-critical logic — custom Java components, custom transformers, DataWeave modules with complex logic, and shared utility libraries. Do NOT generate tasks until all relevant dependencies are analysed and their logic is understood.

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
