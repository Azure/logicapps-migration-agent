# Telemetry Queries (Kusto / KQL)

PM-level analytics queries for the **Logic Apps Migration Agent** extension telemetry.

## How to read this doc

- Telemetry is emitted with `@vscode/extension-telemetry`, which **prefixes every event
  name** with the extension id. So an event logged in code as `analysis.started` arrives in
  Application Insights as:

    ```
    microsoft.logicapps-migration-agent/analysis.started
    ```

    Every query below defines the prefix once as `let P = "microsoft.logicapps-migration-agent/";`
    and normalizes the event into a short `evt` column, so you can filter on the readable name
    (`analysis.started`) instead of the full string.

- All events land in the **`customEvents`** table. String/boolean fields are in
  **`customDimensions`**; numeric fields are in **`customMeasurements`**. All `durationMs`
  values are **milliseconds**.
- Every event carries `customDimensions.migrationId` — the per-folder migration session id
  (generated once per migration, regenerated on reset). Per-flow events also carry
  `customDimensions.flowId`.
- Extension version is available on every event as `customDimensions.["common.extversion"]`.

> **Log Analytics variant:** if telemetry is continuously exported to a Log Analytics
> workspace instead of queried in Application Insights, replace `customEvents` → `AppEvents`,
> `customDimensions` → `Properties`, and `customMeasurements` → `Measurements`.

> **Note on history:** migrations that ran before the `migrationId` change won't have one;
> funnel/correlation queries filter them out with `isnotempty(migrationId)`, so they reflect
> data from that release forward.

---

## Event catalog

| Event (`evt`)                    | Dimensions (string/bool)                                 | Measurements (numeric)                                                                     |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `extension.activated`            | platform, vscodeVersion                                  | —                                                                                          |
| `extension.deactivated`          | —                                                        | —                                                                                          |
| `command.executed`               | commandId                                                | —                                                                                          |
| `command.completed`              | commandId, duration _(ms, string)_                       | —                                                                                          |
| `command.failed`                 | commandId, duration _(ms, string)_, error                | —                                                                                          |
| `tool.invoked`                   | toolId, source, success, duration _(ms, string)_         | —                                                                                          |
| `stage.changed`                  | from, to                                                 | —                                                                                          |
| `override.added`                 | field, source                                            | —                                                                                          |
| `state.reset`                    | —                                                        | —                                                                                          |
| `migration.reset`                | scope                                                    | —                                                                                          |
| `migration.flow.reset`           | flowId, flowName                                         | —                                                                                          |
| `discovery.started`              | trigger _(initial \| rescan)_                            | —                                                                                          |
| `platform.detected`              | platform                                                 | confidence                                                                                 |
| `discovery.completed`            | trigger                                                  | artifactCount, dependencyCount, durationMs                                                 |
| `discovery.failed`               | trigger, errorMessage                                    | durationMs                                                                                 |
| `flowgroups.detection.started`   | —                                                        | artifactCount                                                                              |
| `flowgroups.detection.completed` | flows                                                    | flowGroupCount                                                                             |
| `analysis.started`               | flowId, flowName, trigger _(initial \| reanalyse)_       | —                                                                                          |
| `analysis.completed`             | flowId, flowName                                         | componentCount, criticalMissingDependencies, criticalRisks, durationMs                     |
| `analysis.failed`                | flowId, flowName, errorMessage                           | durationMs                                                                                 |
| `planning.started`               | flowId, flowName, trigger _(initial \| replan)_          | —                                                                                          |
| `planning.completed`             | flowId, flowName                                         | workflowCount, azureComponentCount, actionMappingCount, gapCount, patternCount, durationMs |
| `planning.failed`                | flowId, flowName, errorMessage                           | durationMs                                                                                 |
| `conversion.tasklist.started`    | flowId, flowName                                         | —                                                                                          |
| `conversion.tasklist.completed`  | flowId, flowName, tasks                                  | taskCount                                                                                  |
| `conversion.task.started`        | flowId, flowName, taskId, taskName, taskType             | —                                                                                          |
| `conversion.task.completed`      | flowId, flowName, taskId, taskType, status               | generatedFileCount, durationMs                                                             |
| `conversion.task.rejected`       | flowId, taskId, taskType, reason                         | —                                                                                          |
| `conversion.batch.started`       | flowId, flowName                                         | totalTasks                                                                                 |
| `suggestion.requested`           | stage _(analysis \| planning)_, flowId, message          | messageLength                                                                              |
| `report.exported`                | type _(analysis \| planning)_, flowId, flowName, success | —                                                                                          |
| `log`                            | level, message, _(+ metadata)_                           | —                                                                                          |
| `error`                          | errorName, errorMessage, _(+ context)_                   | —                                                                                          |

---

## A. Adoption & activation

### A1. New migrations started per week

Top-of-funnel growth: distinct migrations that began discovery for the first time.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(90d)
| where name == strcat(P, "discovery.started")
| where tostring(customDimensions.trigger) == "initial"
| extend migrationId = tostring(customDimensions.migrationId)
| summarize NewMigrations = dcount(migrationId) by bin(timestamp, 7d)
| render columnchart
```

### A2. Source-platform distribution

Where demand is concentrated (BizTalk vs MuleSoft vs TIBCO).

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(90d)
| where name == strcat(P, "platform.detected")
| summarize Migrations = count() by Platform = tostring(customDimensions.platform)
| render piechart
```

---

## B. The migration funnel (hero metric)

### B1. Stage conversion rates across all migrations

How far migrations progress through the pipeline.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(90d)
| where name startswith P
| extend evt = substring(name, strlen(P)), migrationId = tostring(customDimensions.migrationId)
| where isnotempty(migrationId)
| summarize
    hasDiscovery  = countif(evt == "discovery.completed")       > 0,
    hasAnalysis   = countif(evt == "analysis.completed")        > 0,
    hasPlanning   = countif(evt == "planning.completed")        > 0,
    hasConversion = countif(evt == "conversion.task.completed") > 0
    by migrationId
| summarize
    Migrations = count(),
    Discovered = countif(hasDiscovery),
    Analysed   = countif(hasAnalysis),
    Planned    = countif(hasPlanning),
    Converted  = countif(hasConversion)
| extend Discovered_pct = round(100.0 * Discovered / Migrations, 1),
         Analysed_pct   = round(100.0 * Analysed   / Migrations, 1),
         Planned_pct    = round(100.0 * Planned    / Migrations, 1),
         Converted_pct  = round(100.0 * Converted  / Migrations, 1)
```

### B2. Drop-off — furthest stage each migration reached

Where users abandon.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(90d)
| where name startswith P
| extend evt = substring(name, strlen(P)), migrationId = tostring(customDimensions.migrationId)
| where isnotempty(migrationId)
| summarize
    d = countif(evt == "discovery.completed")       > 0,
    a = countif(evt == "analysis.completed")        > 0,
    p = countif(evt == "planning.completed")        > 0,
    c = countif(evt == "conversion.task.completed") > 0
    by migrationId
| extend FurthestStage = case(c, "4-Conversion", p, "3-Planning", a, "2-Analysis", d, "1-Discovery", "0-Abandoned at start")
| summarize Migrations = count() by FurthestStage
| order by FurthestStage asc
```

### B3. Funnel by source platform

Do some source platforms convert better than others?

```kql
let P = "microsoft.logicapps-migration-agent/";
let platforms = customEvents
    | where name == strcat(P, "platform.detected")
    | summarize Platform = any(tostring(customDimensions.platform)) by migrationId = tostring(customDimensions.migrationId);
customEvents
| where name startswith P
| extend evt = substring(name, strlen(P)), migrationId = tostring(customDimensions.migrationId)
| where isnotempty(migrationId)
| summarize Planned   = countif(evt == "planning.completed")        > 0,
            Converted = countif(evt == "conversion.task.completed") > 0 by migrationId
| join kind=leftouter platforms on migrationId
| summarize Migrations = count(), Planned = countif(Planned), Converted = countif(Converted) by Platform
| extend Converted_pct = round(100.0 * Converted / Migrations, 1)
| order by Migrations desc
```

---

## C. Success & reliability

### C1. Stage success rate (analysis & planning)

Quality of the AI generation steps.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name startswith P
| extend evt = substring(name, strlen(P))
| where evt in ("analysis.completed", "analysis.failed", "planning.completed", "planning.failed")
| extend Stage = iff(evt startswith "analysis", "analysis", "planning"), ok = evt endswith "completed"
| summarize Total = count(), Success = countif(ok) by Stage
| extend SuccessRate_pct = round(100.0 * Success / Total, 1)
```

### C2. Conversion first-pass rate

How often a generated task passes validation vs gets rejected — the core converter-quality signal.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name startswith P
| extend evt = substring(name, strlen(P))
| where evt in ("conversion.task.completed", "conversion.task.rejected")
| summarize Completed = countif(evt == "conversion.task.completed"),
            Rejected  = countif(evt == "conversion.task.rejected")
| extend FirstPassRate_pct = round(100.0 * Completed / (Completed + Rejected), 1)
```

### C3. Top failure messages

What's actually breaking, ranked.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name startswith P
| extend evt = substring(name, strlen(P))
| where evt in ("analysis.failed", "planning.failed", "discovery.failed")
| summarize Failures = count() by Stage = evt, ErrorMessage = tostring(customDimensions.errorMessage)
| order by Failures desc
| take 25
```

---

## D. Velocity / time-to-value

### D1. Median & P90 duration per stage (seconds)

How long users wait at each step.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name startswith P
| extend evt = substring(name, strlen(P))
| where evt in ("analysis.completed", "planning.completed", "conversion.task.completed")
| extend sec = toreal(customMeasurements.durationMs) / 1000.0
| where isnotnull(sec)
| summarize P50_s = round(percentile(sec, 50), 1),
            P90_s = round(percentile(sec, 90), 1),
            Runs  = count() by Stage = evt
```

### D2. End-to-end time-to-first-conversion per migration (hours)

True time-to-value: discovery start → first completed conversion task.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(90d)
| where name startswith P
| extend evt = substring(name, strlen(P)), migrationId = tostring(customDimensions.migrationId)
| where isnotempty(migrationId)
| summarize Start     = minif(timestamp, evt == "discovery.started"),
            FirstConv = minif(timestamp, evt == "conversion.task.completed") by migrationId
| where isnotnull(Start) and isnotnull(FirstConv)
| extend Hours = datetime_diff('minute', FirstConv, Start) / 60.0
| summarize P50_h = round(percentile(Hours, 50), 1),
            P90_h = round(percentile(Hours, 90), 1),
            Migrations = count()
```

---

## E. Quality & friction

### E1. Top conversion rejection reasons by task type

The #1 list for "where the converter is weak / what frustrates users."

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name == strcat(P, "conversion.task.rejected")
| summarize Rejections = count()
    by Reason = tostring(customDimensions.reason), TaskType = tostring(customDimensions.taskType)
| order by Rejections desc
```

### E2. Rework signal — re-analysis & re-plan rate

A high share of `reanalyse` / `replan` means users aren't satisfied with first output.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name startswith P
| extend evt = substring(name, strlen(P))
| where evt in ("analysis.started", "planning.started")
| extend Trigger = tostring(customDimensions.trigger)
| summarize Count = count() by Stage = evt, Trigger
| evaluate pivot(Trigger, sum(Count))
```

---

## F. Engagement (UI features)

### F1. "Suggest a Change" usage by stage

Is the feedback feature used, and across how many migrations?

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name == strcat(P, "suggestion.requested")
| summarize Suggestions = count(), Migrations = dcount(tostring(customDimensions.migrationId))
    by Stage = tostring(customDimensions.stage)
```

### F2. Voice of customer — actual change requests

Read what users ask to change; a goldmine for the roadmap.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name == strcat(P, "suggestion.requested")
| project timestamp,
          Stage   = tostring(customDimensions.stage),
          flowId  = tostring(customDimensions.flowId),
          Request = tostring(customDimensions.message)
| order by timestamp desc
```

### F3. Report exports — adoption & success by type

Are users exporting Analysis vs Planning reports, and do exports succeed?

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name == strcat(P, "report.exported")
| summarize Exports = count()
    by Type = tostring(customDimensions.type), Success = tostring(customDimensions.success)
```

---

## G. Operational deep-dive

### G1. Single migration timeline

Full event trace for one migration (support / debugging). Paste a `migrationId`.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(90d)
| where tostring(customDimensions.migrationId) == "mig-20260622-000000-xxxx"  // <- paste id
| where name startswith P
| extend evt = substring(name, strlen(P))
| project timestamp, Event = evt,
          flowId  = tostring(customDimensions.flowId),
          Details = customDimensions
| order by timestamp asc
```

### G2. All events for a migration, by version

Useful when correlating behavior with a specific extension build.

```kql
let P = "microsoft.logicapps-migration-agent/";
customEvents
| where timestamp > ago(30d)
| where name startswith P
| extend evt        = substring(name, strlen(P)),
         migrationId = tostring(customDimensions.migrationId),
         extVersion  = tostring(customDimensions.["common.extversion"])
| where isnotempty(migrationId)
| summarize Events = count() by extVersion, evt
| order by extVersion desc, Events desc
```
