---
name: workflow-json-generation-rules
description: Rules for generating workflow.json files for Logic Apps Standard. Covers connector selection, splitOn preference, file trigger semantics, runAfter structure, and mandatory reference lookup before writing.
---

# Skill: Workflow JSON Generation Rules

> **Purpose**: Authoritative rules for generating `workflow.json` files. Follow exactly.

---

## 1. Mandatory Reference Lookup

BEFORE writing ANY `workflow.json`:

1. Read the skill `source-to-logic-apps-mapping` to get the Logic Apps equivalent connector, service provider ID, and operation names for each source component.
2. Use those operation names to call `migration_searchReferenceWorkflows` and `migration_readReferenceWorkflow` to get exact `operationId` and `serviceProviderConfiguration` for each trigger/action.
3. If the first search returns no relevant results, RETRY 2-4 more times with different word combinations.
4. Also call `migration_readReferenceDoc` with `action="search"` then `action="read"` to verify connector capabilities.
5. Do NOT invent `operationId` values, `serviceProviderConfiguration` structures, or connection formats — ALWAYS copy from references.

---

## 2. Workflow Definition Structure

Each `workflow.json` must contain a `definition` key with:

- `$schema`
- `contentVersion`
- `triggers` — at least one trigger
- `actions` — with `runAfter` (object mapping predecessor action names to status arrays) and `type` for each action

### Action Types

- `Switch` — must have `cases`
- `If` / `Condition` — must have `actions` (true branch) and optionally `else.actions` (false branch)
- `Foreach` / `Until` — nest `actions` inside
- `ServiceProvider` — with `serviceProviderConfiguration`
- `ApiConnection` — only when no built-in ServiceProvider equivalent exists
- `InvokeFunction` — for .NET local functions
- `Workflow` / `InvokeWorkflow` — for calling child workflows

### Preference: ServiceProvider over ApiConnection

Prefer `ServiceProvider` type with `serviceProviderConfiguration` over `ApiConnection` (managed connector) whenever a built-in equivalent exists. Built-in connectors run in-process with lower latency and no connection overhead.

### Parameterization (keep it simple)

- For Logic Apps Standard, prefer `parameters.json` for cross-environment values.
- In `workflow.json`, reference values with `@parameters('name')`.
- In `parameters.json`, `@appsetting('name')` is the only valid expression type.
- In `connections.json`, only `@parameters(...)` and `@appsetting(...)` are valid.
- For more details, fetch Microsoft Learn docs about Standard parameters and app settings (`create-parameters-workflows`, `edit-app-settings-host-settings`).

---

## 3. SplitOn over ForEach

When a trigger returns an array (batch of messages), ALWAYS use `splitOn` on the trigger instead of wrapping actions in a `For_each` loop:

```json
"triggers": {
  "myTrigger": {
    "splitOn": "@triggerOutputs()?['body']",
    ...
  }
}
```

SplitOn debatches the array so each item fires a separate workflow run. Only use `For_each` if splitOn is not supported by that trigger type.

---

## 4. File System Trigger Semantics

- Do NOT add delete/remove/cleanup actions that remove the trigger input file by default.
- The runtime does not re-trigger on the same unchanged file, so deleting is unnecessary unless the user explicitly requests archival/deletion behavior.

---

## 5. Trigger Output Verification (MANDATORY)

> **⚠️ NEVER assume a trigger returns file/message content directly. ALWAYS verify what the trigger actually returns.**

Many triggers return **metadata** (file path, message ID, blob URI) rather than the actual content. You MUST check the trigger's return type from the reference workflow before building downstream actions.

### 5.1 Procedure

1. After selecting a trigger via reference lookup (§1), read the reference workflow AND the reference docs to see what `triggerOutputs()` or `triggerBody()` actually contains.
2. Call `migration_readReferenceDoc` with `action="search"` for the trigger's connector name to find documentation on its output schema and return type.
3. Call `migration_readReferenceDoc` with `action="read"` on the top result to confirm the exact trigger output fields.
4. If the trigger returns a **file path** (e.g. File System `whenFilesAreAdded` returns `path` and `name`), you MUST add a separate **read content** action (e.g. `getFileContent`) before any parsing/processing.
5. If the trigger returns **message content directly** (e.g. HTTP Request trigger, Service Bus `receiveQueueMessage`), you can use `triggerBody()` directly.

### 5.2 Common Trigger Return Types

| Trigger                                   | Returns                          | Content Available Via                     |
| ----------------------------------------- | -------------------------------- | ----------------------------------------- |
| File System `whenFilesAreAdded`           | File metadata (path, name, size) | Add `getFileContent` action with the path |
| File System `whenFilesAreAddedOrModified` | File metadata (path, name, size) | Add `getFileContent` action with the path |
| Azure Blob `whenABlobIsAddedOrModified`   | Blob metadata (path, URI)        | Add `readBlob` action with the path       |
| HTTP Request                              | Full request body                | `triggerBody()` directly                  |
| Service Bus `receiveQueueMessage`         | Message content + properties     | `triggerBody()?['contentData']` directly  |
| Service Bus `peekLockQueueMessagesV2`     | Array of message metadata        | Add `completeMessage` after processing    |
| FTP/SFTP `whenFileIsAdded`                | File metadata                    | Add `getFileContent` action with the path |
| Recurrence / Timer                        | No body                          | N/A — use actions to fetch data           |

### 5.3 Rule

- **If trigger returns metadata/path**: Add a content-reading action BEFORE any XmlParse, Parse JSON, Compose, or processing action.
- **If trigger returns content directly**: Use `triggerBody()` or `triggerOutputs()?['body']` in downstream actions.
- **If unsure**: Check BOTH the reference workflow AND the reference docs. If the reference workflow has a read-content action after the trigger, or the docs show the trigger returns metadata rather than content, you need a content-reading action too.

---

## 6. 1:1 Orchestration to Workflow Rule

- Every orchestration (including sub-orchestrations) MUST be a separate workflow.
- Use the `Workflow` action type to invoke child workflows from parent workflows.
- Do NOT convert orchestrations to local functions.

---

## 7. Plan Adherence

When fixing any errors in workflow.json:

- Do NOT deviate from the planned design.
- Do NOT add/remove actions, change triggers, switch connectors, or alter schemas.
- Before any fix, re-read the planning results to verify compliance.
- If a fix requires changing the design, STOP and report to the user.

---

## 8. Scenario-Specific Action Overrides

These overrides are deterministic — apply them directly without asking the user.

### 8.1 XML Field Extraction

When extracting fields from an XML message body:

1. **FIRST**: Use `XmlParse` built-in action with the schema from `Artifacts/Schemas/`. This replaces the BizTalk XMLReceive pipeline's validation + extraction in one step. Access fields via: `body('Parse_XML')?['Root']?['fieldName']`
2. **ONLY IF** no schema exists and cannot be generated: fall back to `xpath()` expressions.

Do NOT use `xpath()` when an XSD schema is available — XmlParse is a level-1 built-in action and MUST be preferred over level-2 expressions per the Component Priority Ladder.

### 8.2 XML Schema Validation

When validating incoming XML against a schema:

- Use `XmlValidation` built-in action — do NOT write custom validation logic or skip validation.

### 8.3 XML Transformation

When transforming XML documents:

- Use `Xslt` (Transform XML) built-in action with maps from `Artifacts/Maps/` — do NOT use Compose + string manipulation.

### 8.4 Output XML Construction

When constructing XML output documents:

- **FIRST**: Use `XmlCompose` built-in action (XML Operations) to compose XML from structured data. This replaces the BizTalk XML Assembler pipeline.
- `XmlCompose` can reference schemas from **either** the local `Artifacts/Schemas/` folder **or** an **Integration Account** — select the source via the `Source` parameter (`LogicApp` or `IntegrationAccount`). If the flow uses the Integration Account model, use `IntegrationAccount` as the source.
- If the source uses .NET code to build XML (e.g. `XmlDocument`, `XElement`) with complex business logic, use a **.NET local function**.
- If the output is a simple static template with field substitution, `Compose` is acceptable.
- Do NOT approximate XML construction with `Compose` + `concat()` when `XmlCompose` or a local function is more appropriate.

### 8.5 EDI Decode Output Handling

> **⚠️ CRITICAL**: The EDIFACT `EdifactDecode` and X12 `X12Decode` built-in actions return **JSON**, not XML. If a downstream action or function expects XML (e.g. `XmlDocument.LoadXml()`), you MUST add an `XmlCompose` action after the decode action to convert the JSON back to XML using the appropriate message schema.

Pattern:
```
Decode_EDIFACT (EdifactDecode) → JSON output
  → Compose_EDIFACT_XML (XmlCompose, Source: IntegrationAccount, Schema: message schema) → XML output
    → downstream action expecting XML
```

Do NOT pass the JSON decode output directly to XML-expecting code. Do NOT try to parse the JSON as XML — it will fail with "Data at the root level is invalid".

### 8.6 JSON Parsing

When parsing JSON payloads:

- Use `Parse JSON` built-in action — do NOT use `json()` expression for structured access.

---

## 9. Pre-Finalize Validation Checklist

Before storing workflow definitions, cross-check EVERY action against this table. If ANY row in the "DON'T" column matches your output, fix it before proceeding.

| Scenario                    | DO (correct)                                         | DON'T (wrong — fix before storing)                     |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Trigger output assumption   | Verify trigger return type from ref                  | Assume trigger returns file/message content directly   |
| File/Blob/FTP trigger       | Add `getFileContent`/`readBlob` action after trigger | Use `triggerBody()` for content (it only has metadata) |
| XML field extraction        | `XmlParse` action + schema                           | `xpath()` expression when schema exists                |
| XML validation              | `XmlValidation` action                               | Skip validation or custom code                         |
| XML transformation          | `Xslt` action + map file                             | `Compose` + string concat                              |
| XML output assembly         | `XmlCompose` action (Source: LogicApp or IntegrationAccount) | `Compose` + `concat()` for XML                         |
| EDI decode → XML needed     | Add `XmlCompose` after EdifactDecode/X12Decode       | Pass JSON decode output directly to XML-expecting code |
| Complex XML with .NET logic | .NET local function                                  | `Compose` + `concat()` approximation                   |
| JSON parsing                | `Parse JSON` action                                  | `json()` expression for structured access              |
| Array trigger debatching    | `splitOn` on trigger                                 | `For_each` loop wrapping all actions                   |
| File trigger cleanup        | Do nothing (no delete)                               | Delete/archive trigger input file                      |
| Sub-orchestration           | Separate workflow + `Workflow` action                | Merge into parent or local function                    |
| Custom source code          | .NET local function                                  | Expressions or inline approximation                    |
