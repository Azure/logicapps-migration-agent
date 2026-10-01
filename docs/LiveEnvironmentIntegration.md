# Live BizTalk Environment Integration — Discovery & Message-Box/Tracking-Based Validation

**Status:** Draft / Proposal
**Owners:** Logic Apps Migration Agent team
**Related docs:** [IRSchema.md](./IRSchema.md), [UserFlow.md](./UserFlow.md), [SourceFlowVisualization.md](./SourceFlowVisualization.md)

## 1. Summary

Today the Migration Agent discovers artifacts by scanning a **source folder** (BizTalk solution/project files on disk). This proposal adds an optional second discovery mode that connects directly to a **running BizTalk Group** (Management DB, via Windows Integrated Auth on the same/domain-joined machine) to:

1. Enumerate all **installed Applications** and their resources (orchestrations, ports, pipelines, schemas, maps, bindings) without requiring the user to locate source manually.
2. Correlate discovered resources back to source projects where available (for logic conversion), and flag metadata-only resources when source isn't found.
3. Use the **BizTalk Tracking DB (BizTalkDTADb)** and, where still resident, the **MessageBox (BizTalkMsgBoxDb)** to pull real historical **input/output message pairs** per port/orchestration, replay the same inputs against the migrated Logic Apps Standard workflow, and diff actual vs. expected output as an automated **Validation** stage.

## 2. Motivation

- Manually pointing at a source folder misses **drift**: what's deployed/running in production often differs from what's in source control (hotfix bindings, ad-hoc port changes).
- Environment discovery gives an authoritative **application/resource inventory** straight from the BizTalk Group, including live binding/adapter configuration (physical URIs, host mapping) that is often more accurate than source-controlled bindings.
- Regression-testing a migration by hand is slow and error-prone. BizTalk already recorded real production traffic (tracked message events); replaying it against the new Logic App and diffing output is a low-effort, high-confidence validation technique — no synthetic test data needed.

## 3. Current State

- `SourceFolderService` + `PlatformDetector` + `ArtifactScanner` (src/stages/discovery) drive discovery purely from files on disk.
- Parsers (`src/parsers/biztalk/*`) require **source artifacts** (`.odx`, `.btm`, `.xsd`, `.btp`, bindings XML) to build the IR — business logic is not reconstructable from the Management DB alone (it only holds deployment/binding metadata, not orchestration shapes or map XSLT).
- There is no live-environment connector and no automated output-validation stage today; validation is manual.

## 4. Goals / Non-Goals

**Goals**
- Read-only discovery of installed BizTalk Applications and bindings from a live Group.
- Best-effort mapping of each discovered resource to its source project for full-fidelity parsing; graceful metadata-only fallback otherwise.
- Pull archived input/output message pairs and use them as automated validation fixtures against the converted Logic App.
- V1 uses Windows Integrated Authentication only; no credential storage. The connector runs under the identity of the already-logged-in BizTalk administrator.
- SQL authentication is explicitly deferred to a later version and is not part of the V1 credential or connection model.

**Non-Goals**
- Decompiling compiled orchestration/map assemblies when source is unavailable (out of scope — flagged as a gap for manual migration instead).
- Writing back to any BizTalk database (strictly read-only).
- Real-time/live traffic mirroring (this is retrospective replay of already-tracked messages, not a live shadow-traffic proxy).

## 5. Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Discovery Stage (extended)                      │
├───────────────────────────────┬───────────────────────────────────--┤
│  File-based (existing)        │  Environment-based (new)             │
│  SourceFolderService           │  EnvironmentDiscoveryService          │
│  ArtifactScanner                │   ├─ BizTalkAdminConnector           │
│                                  │   │   (WMI + Mgmt DB, integrated    │
│                                  │   │    auth, read-only)             │
│                                  │   └─ SourceResolverService           │
│                                  │       (assembly/strong-name →       │
│                                  │        local/repo source lookup)    │
└───────────────────────────────┴───────────────────────────────────--┘
                              │
                              ▼
                    Common ArtifactInventory / IR
                              │
                 Planning → Conversion (unchanged)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Validation Stage (new)                             │
│  MessageFixtureExtractor  →  BizTalkDTADb / MsgBoxDb (read-only)     │
│      (input+output pairs, correlated by ActivityID/InstanceID)      │
│  LogicAppReplayRunner     →  invokes migrated workflow with input    │
│  OutputDiffService        →  normalizes & diffs actual vs expected   │
│  ValidationReportService  →  pass/fail + diff report per artifact    │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.1 Environment Discovery

- **`BizTalkAdminConnector`**: uses a narrow, parameterized SQL projection against the BizTalk Management DB to retrieve only the application and artifact metadata needed for `EnvironmentInventory` (application names/IDs, artifact names/types, assembly identity, and application-reference relationships). V1 uses Windows Integrated Auth and read-only access.
- The query must select explicit columns, use filters and bounded batches, and return a compact JSON application/artifact projection rather than raw rows, minimizing data and token usage. The connector supports a `{{BATCH_SIZE}}` placeholder for a bounded `TOP` clause and never permits `SELECT *`.
- The SQL projection is isolated behind a versioned adapter because BizTalk schemas can vary by release. Use `Microsoft.BizTalk.ExplorerOM`, WMI (`root\MicrosoftBizTalkServer`), or the BizTalk PowerShell module as a fallback for metadata not exposed by the supported SQL projection.
- Produces `EnvironmentInventory`: applications → resources (orchestrations, ports, pipelines, schemas, maps) with assembly names, strong names, dependencies, and live binding config (physical adapter properties, URIs — with secrets/credentials redacted).
- **V1 auth model:** runs under the caller's Windows identity, which must already be a member of the **BizTalk Application Users**/**BizTalk Administrators** group. No credential prompt, no secret storage in the extension. SQL authentication is deferred to a subsequent version.

### 5.2 Source Resolution

Live discovery reuses the open local VS Code workspace (the first folder in a
multi-root workspace). When no folder is open, discovery creates a folder under
`%USERPROFILE%\LogicAppsMigration\BizTalk-<unique-id>`, opens it in the current
window, and automatically resumes discovery after the extension host reloads.
Workspace creation and artifact persistence happen during discovery, before
planning. An existing BizTalk source project is not required.
Recovered artifacts are saved under
`.vscode\migration\artifacts\biztalk-<environment-id>\<application-name-id>\`.
Application bindings are retained as `BindingInfo.xml`; each artifact has its
own collision-safe folder with `metadata.json` and recovered `.xsd`,
`.btp`, or other XML content. Resolved source files are copied there too.
Parsing and source reads use these real workspace files, not `environment://`
paths or deleted temporary files. Failed parses retain their files and report
an error; unavailable content remains a metadata-only warning, not a fabricated
schema or DLL. Rerun discovery to replace older URI-based inventory entries.
These exports can contain sensitive deployment configuration: protect the
workspace and do not commit them to source control. Migration reset removes them
along with the other `.vscode\migration` data.

- **`SourceResolverService`** takes each discovered resource (by assembly strong name / GAC entry) and searches configured local paths / connected Git repos for a matching `.btproj`/`.odx`/`.btm` by project output assembly name.
- If found → feed into existing parsers exactly as today (full-fidelity IR).
- If not found → create a **metadata-only `InventoryItem`** (bindings/ports still convert to Logic App connection scaffolding) tagged `sourceUnavailable: true`, surfaced in the gap-analysis report for manual follow-up. Decompilation is explicitly out of scope (see Non-Goals).

### 5.3 Message-Box/Tracking-Based Validation

- **`MessageFixtureExtractor`** queries `BizTalkDTADb` (Tracking DB) for tracked message events on the relevant receive/send ports and orchestrations, where **body tracking** was enabled. It correlates request/response pairs via `ActivityID`/`InstanceID`/`InterchangeID`.
  - `BizTalkMsgBoxDb` is transient (in-flight + very recent messages before cleanup); it is consulted opportunistically for very recent instances still resident, but `BizTalkDTADb` is the primary, durable source since MessageBox data is purged aggressively.
  - Output: a set of `ValidationCase { sourceArtifactId, input, expectedOutput, capturedAt, correlationId }` fixtures per migrated flow.
- **`LogicAppReplayRunner`** invokes the converted Logic Apps Standard workflow (local runtime for pre-deployment testing, or the deployed workflow's trigger endpoint) with each captured input.
- **`OutputDiffService`** normalizes both outputs (ignoring inherently-divergent fields: timestamps, GUIDs, correlation IDs — configurable ignore-rules) and produces a structured diff.
- **`ValidationReportService`** aggregates pass/fail per artifact into the existing report/UI patterns (similar to gap-analysis reporting in Planning).

### 5.4 Dependency-Ordered Application Migration

Applications must be migrated in dependency order, not alphabetically or in
discovery order. The planner should build an application-level directed graph
from BizTalk application references, orchestration calls, referenced schemas
and maps, shared pipelines, and other cross-application resources.

The scheduler should use a topological order:

1. Migrate applications with no references to other applications first.
2. Migrate shared/common applications once before the applications that depend
   on them.
3. Recalculate readiness after each application is converted and validated.
   A dependent application is ready only when its prerequisites have completed
   successfully or an exception has been explicitly accepted.
4. Detect circular dependencies and stop automatic ordering for that cycle.
   Show the cycle and allow an explicit user-selected sequence or documented
   staged/manual migration.

The migration plan should display each application's dependencies, dependents,
conversion status, and validation status. This ensures common components are
available before dependent applications are converted.

## 6. Security & Data Governance

- **Read-only everywhere** — no writes to BizTalk databases; SQL principal only needs `db_datareader` on `BizTalkDTADb`/`BizTalkMsgBoxDb` and Mgmt DB, scoped to least privilege.
- V1 requests, stores, and transmits no database credentials. It uses Windows Integrated Auth and the invoking user's existing BizTalk permissions. SQL authentication, including secure secret acquisition and storage, is deferred to a later version.
- Captured message bodies may contain **business/PII data**. This must be an explicit **opt-in** feature with:
  - A configurable redaction/masking rule set applied before bodies are written to any local report artifact.
  - Local-only storage of captured fixtures (never uploaded), with a setting to purge fixtures after a validation run.
- Adapter/port bindings may include connection strings/secrets — always redact these fields when displaying/exporting inventory.

## 7. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| DTA schema varies across BizTalk versions (2013 R2/2016/2020) | Version-detect and use version-specific query adapters; start with 2016/2020 (already-supported source versions per README). |
| Body tracking may not be enabled on the ports being migrated | Detect and clearly report "no fixtures available" rather than fail; fall back to manual test authoring guidance. |
| Large/binary message bodies, high fixture volume | Cap sample size (e.g., N most-recent per port, configurable), stream rather than load-all-in-memory. |
| Source resolution ambiguity (multiple candidate projects) | Present resolution candidates to the user for manual confirmation rather than silently guessing. |
| Compliance/PII exposure of captured production data | Opt-in only, redaction rules, local-only storage, documented in Extension Settings. |
| Running admin-scope queries against a production Group | Strict read-only connections; document required least-privilege SQL role; no code path performs writes. |

## 8. Phased Delivery Plan

| Phase | Scope | Outcome |
| --- | --- | --- |
| **Phase 1** | `BizTalkAdminConnector` (minimal-column SQL projection for applications and artifacts with Windows Integrated Auth, plus WMI/PowerShell fallback) + `EnvironmentInventory` model | User can discover installed applications and artifacts directly from a live Group while minimizing data and token transfer. |
| **Phase 2** | `SourceResolverService` + integration into existing Discovery pipeline (`ArtifactInventory` merge) | Discovered resources link to real source when available; metadata-only items flagged in gap analysis. |
| **Phase 2** | Application dependency graph and topological migration scheduler | Common and dependency-free applications migrate first; dependents wait for prerequisites; cycles are surfaced for manual sequencing. |
| **Phase 3** | `MessageFixtureExtractor` (DTA/MsgBox query + correlation) | Extract validated input/output fixture sets per migrated flow, opt-in with redaction. |
| **Phase 4** | `LogicAppReplayRunner` + `OutputDiffService` + `ValidationReportService` + UI/report surface | End-to-end automated Validation stage: replay real traffic, diff, and report pass/fail. |
| **Phase 5** | Hardening: version matrix support, performance tuning, CI-style repeatable validation runs | Production-ready feature, documented in README/Extension Settings. |

## 9. Open Questions

- V1 supports Windows Integrated Auth only. SQL authentication is planned for a later version, including its secure credential acquisition, storage, rotation, and least-privilege model.
- What is the retention window we can rely on in `BizTalkDTADb` in typical customer environments (affects how many fixtures we can realistically extract)?
- Should replay run against the **local Logic Apps runtime** (pre-deployment) or a **deployed** Standard app (post-deployment, Stage 5)? Likely need to support both.
- How do we handle orchestrations with side effects (e.g., calls to external systems) during replay — dry-run/stub mode required?

## 10. Task Breakdown

See tracked tasks (grouped by phase, with dependencies) — summarized below:

| # | Task | Phase | Depends on |
| - | --- | --- | --- |
| 1 | Define `EnvironmentInventory` / `EnvironmentDiscoveryService` types | 1 | — |
| 2 | Implement `BizTalkAdminConnector` (minimal-column SQL projection for applications and artifacts with Windows Integrated Auth, plus WMI/PowerShell fallback) | 1 | 1 |
| 3 | Wire environment discovery into Discovery stage UI as alternate entry point | 1 | 2 |
| 4 | Implement `SourceResolverService` (assembly → project match) | 2 | 1 |
| 5 | Merge environment + resolved-source items into `ArtifactInventory`; flag metadata-only items | 2 | 3, 4 |
| 6 | Extend gap-analysis reporting for `sourceUnavailable` items | 2 | 5 |
| 7 | Build application dependency graph and topological migration scheduler | 2 | 5 |
| 8 | Define `ValidationCase` model + redaction rule config (Extension Settings) | 3 | — |
| 9 | Implement `MessageFixtureExtractor` against `BizTalkDTADb` (+ `BizTalkMsgBoxDb` opportunistic) | 3 | 8 |
| 10 | Implement correlation logic (ActivityID/InstanceID/InterchangeID request-response pairing) | 3 | 9 |
| 11 | Implement `LogicAppReplayRunner` (local runtime invocation) | 4 | 10 |
| 12 | Implement `LogicAppReplayRunner` (deployed workflow invocation, post Stage 5) | 4 | 11 |
| 13 | Implement `OutputDiffService` with configurable ignore-rules (timestamps/GUIDs) | 4 | 11 |
| 14 | Implement `ValidationReportService` + UI surface (pass/fail, diffs) | 4 | 13 |
| 15 | Add Extension Settings for opt-in, redaction, fixture sample size/retention | 3/4 | 8 |
| 16 | Version-matrix testing (BizTalk 2016/2020) + performance tuning on large Groups | 5 | 3, 10 |
| 17 | Documentation: README + new docs page for Live Environment Integration usage | 5 | 3, 14 |

---
*This document is a proposal; implementation should begin with Phase 1 behind a feature flag, validated on a non-production BizTalk Group before wider rollout.*

## 11. Stage 3 Implementation Notes

Stage 3 now provides a `MessageFixtureExtractor` and `ValidationCase` model
under `src/stages/validation`. The extractor runs a caller-supplied,
version-specific, read-only SQL projection using Windows Integrated Auth,
supports bounded `{{BATCH_SIZE}}` queries, correlates input/output rows by
`sourceArtifactId` and `correlationId`, and applies opt-in redaction rules
before fixtures are returned. It rejects `SELECT *` projections and enforces a
maximum message-body size.

## 12. Stage 4 Implementation Notes

Stage 4 provides `LogicAppReplayRunner`, `OutputDiffService`, and
`ValidationReportService` under `src/stages/validation`. Replay posts each
captured input to either a local or deployed Logic Apps Standard HTTP trigger,
with timeout and explicit failure results. Output comparison supports ignored
paths and normalization for timestamps, GUIDs, and correlation identifiers.
The report contains per-case replay status, structured differences, and
aggregate pass/fail counts.

## 13. Stage 5 Operational Hardening

### BizTalk version matrix

The SQL projection is intentionally supplied by a version-specific adapter
rather than embedding undocumented Management DB table assumptions in the
extension. Before enabling a projection for a customer environment, validate
it against:

| Environment | Required checks |
| --- | --- |
| BizTalk Server 2016 | Application and artifact identifiers, application references, assembly identity, and read-only permissions |
| BizTalk Server 2020 | Same checks plus schema/query compatibility with the deployed cumulative update |

For either version, run discovery against a non-production group first and
compare the SQL projection with `ExplorerOM`/BizTalk PowerShell output for
application count, artifact count, and dependency edges. Any metadata not
available through the approved projection must use the WMI/PowerShell fallback.

### Large-group performance controls

- Keep projections minimal and return compact JSON rather than raw rows.
- Use `{{BATCH_SIZE}}` with a bounded `TOP` clause; the connector limits the
  batch size to 1–1000 applications.
- Filter by application or deployment scope in the projection when a customer
  group is large.
- Keep message-fixture extraction opt-in, cap body size, and limit the number
  of tracked messages returned per query.
- Resolve source files only under configured roots and skip `node_modules`,
  `.git`, `bin`, and `obj`.
- Never log message bodies, connection secrets, or raw binding credentials.
- Monitor query duration and explicitly report failures; do not silently
  replace incomplete inventory with a success-shaped result.

The remaining SQL authentication design is intentionally deferred from V1.
