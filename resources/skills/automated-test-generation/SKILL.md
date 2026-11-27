---
name: automated-test-generation
description: Rules for generating re-runnable automated tests for a converted flow — Logic Apps Standard workflow unit tests with mocked triggers and connectors, map regression tests and schema validation tests — that run with dotnet test and need no Azure access.
---

# Skill: Automated Test Generation

> **Purpose**: Every converted flow ships with tests the customer can re-run locally and in CI without Azure resources. Agent-run checks (`validate-runtime`, `test-workflows`) and reports do not replace them.

---

## 1. Task

- Type: `generate-tests` (REQUIRED) — after all schema, map, function and workflow tasks; before `validate-runtime`.
- `artifactIds`: the source orchestrations/flows, maps and schemas the tests cover.
- Output root: `{outputProjectRoot}/Tests/` (next to the Logic App project; never inside deployable Logic App content).
- Follow `no-stubs-code-generation`: every test asserts real values derived from the source behavior.

---

## 2. Workflow Unit Tests (Logic Apps Standard testing framework)

1. Read the reference doc **Create unit tests from Standard workflow definitions** (`migration_readReferenceDoc`, search "unit tests standard workflow definitions") and follow its layout: `Tests/<logic-app-name>/<workflow-name>/` with `testSettings.config`, `MockOutputs/` classes per mocked operation, and C# MSTest classes using `TestExecutor`, `TestMockDefinition`, trigger mocks and `ActionMock`s.
2. For every workflow, cover the happy path, each error/compensation path (scopes, terminate, retries exhausted) and each decision branch that exists in the source orchestration or flow.
3. Mock the trigger and every connector action (Service Bus, SQL, file, HTTP, SAP, …). Assert the run status and, field by field, the inputs of the mocked outbound actions (for example the message published to a topic or written to a file).
4. Framework limits: integration account and EDI encode/decode actions are not supported. Cover their behavior with the map and schema tests below and list the gap in TEST-REPORT.md.

---

## 3. Map Regression Tests

1. For every converted map, store input/expected-output pairs under `Tests/TestData/Maps/<MapName>/`. Take samples, in this order, from: BizTalk map test instances (TestMap input/output instance paths in the `.btm`/`.btproj`), sample messages in the source repository, the user's black-box test folder; otherwise generate an instance from the source schema that fills every mapped field and repeats each repeating record at least twice.
2. Expected output must come from the **source** map behavior (embedded or generated XSLT of the source map), never from the new implementation.
3. Tests run the converted XSLT with `XslCompiledTransform` (extension objects for scripting functoids) and compare canonicalized XML, reporting the first differing XPath on failure.
4. When the plan's `map-strategy` is `azure-function` or `local-function`, run the same cases against that implementation and compare its output with the XSLT output — the XSLT remains the regression oracle.

---

## 4. Schema Tests

For every converted schema, validate at least one valid and one invalid sample (`XmlSchemaSet` for XSD, a JSON Schema validator for JSON). Assert that the valid sample passes and the invalid sample fails for the expected reason.

---

## 5. Project and Execution

- Put map and schema tests in `Tests/<WorkspaceName>.ArtifactTests/` (MSTest, .NET 8) next to the workflow unit-test folders; reference converted artifacts by relative path, do not copy them.
- `dotnet test` run from `{outputProjectRoot}/Tests` must pass without Azure sign-in, network calls or secrets. Use only synthetic or anonymized test data.
- Record the command and per-category pass/fail counts in TEST-REPORT.md and include every generated test file in `generatedFiles`.
