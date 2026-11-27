---
name: detect-logical-groups
description: Rules for detecting and grouping BizTalk artifacts into logical flow groups. Start from the deterministic proposal; orchestration call chains define a flow, shared artifacts (canonical schemas, binding files, common code) are listed in every flow that uses them instead of merging flows. Covers fallback grouping and required output fields.
---

# Skill: Detecting Flow Groups

> **Purpose**: Authoritative rules for how an AI agent should group discovered integration artifacts into logical flow groups. The agent MUST follow these rules exactly.

> The extension groups BizTalk sources deterministically by default (setting `logicAppsMigrationAgent.discovery.groupingMode`). This skill applies when Copilot stores the groups.

---

## 1. Grouping Strategy

- **Start from `proposedGroups`** returned by `migration_detectFlowGroups`. They are computed from Call/Start Orchestration chains, map and message-type references, orchestration port bindings and send-port subscription filters, so the same source always yields the same groups. Keep each proposed `id`, `artifactIds`, `endpointNames`, `entryPoint` and `exitPoints`; improve only `name` and `description`.
- **Orchestration call chains define a flow**: orchestrations linked by `orchestration-calls` edges (Call or Start Orchestration, directly or transitively) MUST be in the SAME group.
- **Receive locations that feed the same orchestration** belong to that orchestration's group. Do NOT create one group per receive location.
- **Messaging-only routes**: a receive port routed to send ports by a subscription filter (`BTS.ReceivePortName == …`) without an orchestration is its own group.
- **Shared artifacts do not merge flows**: artifacts used by more than one flow — canonical/common schemas (e.g. a canonical data model project), common pipelines or helper code, and binding files that hold the ports of several flows — go in `sharedArtifactIds` AND in the `artifactIds` of every group that uses them.
- **Scope binding files**: set each group's `endpointNames` to its receive locations/ports and send ports. Ports of other flows in a shared binding file are not part of the group.
- Name each group after its main orchestration or business purpose so users can map it back to the source.

---

## 2. Fallback Rules (When receiveLocationCount = 0 or proposedGroups is empty)

Do NOT return empty groups. Use this fallback order:

1. **Orchestration-root grouping** — one group per CONNECTED orchestration cluster. Follow `orchestration-calls` edges to find clusters. Do NOT create one group per individual orchestration when they call each other.
2. **Trigger-capability grouping** — file/queue/http/timer/db-poller entry-capable artifacts.
3. **Connected-component grouping** — from the graph edges, ignoring edges into shared artifacts.

Only leave artifacts in `ungroupedArtifactIds` if no group references them.

For fallback groups, set `entryPoint` to orchestration/trigger/internal-entry (not receive-location).

---

## 3. Required Output Fields

Each group MUST have:

| Field           | Type     | Description                                                          |
| --------------- | -------- | -------------------------------------------------------------------- |
| `id`            | string   | Unique group ID — keep the proposed ID (e.g. `flow-ordernotification`) |
| `name`          | string   | Human-readable name by main orchestration or business purpose       |
| `description`   | string   | What this flow does                                                  |
| `category`      | string   | e.g. `message-flow`, `business-process`                              |
| `artifactIds`   | string[] | MUST NOT be empty; includes the shared artifacts the flow uses       |
| `entryPoint`    | object   | Entry point (type, name, messageType)                                |
| `exitPoints`    | array    | Exit points (type, name, messageType)                                |
| `endpointNames` | string[] | Receive locations/ports and send ports of this flow                  |

Also pass `sharedArtifactIds` and `ungroupedArtifactIds` at the top level.

---

## 4. Procedure

1. Call `migration_detectFlowGroups` to get `proposedGroups`, `proposedSharedArtifactIds`, `proposedUngroupedArtifactIds`, `missingProjects`, the artifact summaries and the connection graph.
2. If `proposedGroups` is not empty, store it as-is (improved names/descriptions only). Do NOT read or decompile sources to re-derive groups.
3. Only when orchestrations exist solely in compiled assemblies (no `.odx` artifacts) or `proposedGroups` is empty:
   a. Call `migration_listArtifacts` with `category="custom-code"` to find DLLs.
   b. Decompile relevant DLLs per skill `dependency-and-decompilation-analysis` §2 to discover orchestration call relationships.
   c. Merge groups only with that direct call evidence and state it in `explanation`.
4. Call `migration_discovery_storeFlowGroups` with `groups`, `sharedArtifactIds`, `ungroupedArtifactIds`, and `explanation`. If `missingProjects` is not empty, say in `explanation` that those projects must be added to the source folder.

---

## 5. What NOT to Do

- Do NOT create empty `artifactIds` arrays.
- Do NOT split orchestrations linked by call chains into separate groups, and do NOT split a proposed group.
- Do NOT merge flows only because they use the same schema, pipeline, helper library or binding file — mark those artifacts shared.
- Do NOT create a group per receive location or expect at least one group per receive location.
