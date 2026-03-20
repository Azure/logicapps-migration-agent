---
name: detect-logical-groups
description: Rules for detecting and grouping integration artifacts into logical flow groups using shared-orchestration strategy. Covers orchestration call-chain rules, fallback grouping when no receive locations exist, and required output fields.
---

# Skill: Detecting Flow Groups

> **Purpose**: Authoritative rules for how an AI agent should group discovered integration artifacts into logical flow groups. The agent MUST follow these rules exactly.

---

## 1. Grouping Strategy (Shared Orchestration)

- **HIGHEST PRIORITY**: If multiple Receive Locations feed into the SAME Orchestration (directly or transitively), they MUST be in the SAME group — the orchestration is the unifying element.
- **Orchestration Call Chains**: The `connectionGraph` includes `orchestration-calls` edges when one orchestration calls/starts another. Orchestrations linked by these edges (directly or transitively) MUST be in the SAME group. Example: If Orch-A calls Orch-B and Orch-B calls Orch-C, all three belong in ONE group.
- Only create separate groups for Receive Locations that feed into DIFFERENT orchestrations with no transitive connection.
- Transitively connected artifacts belong in the SAME group.
- Name each group by business purpose.

---

## 2. Fallback Rules (When receiveLocationCount = 0)

Do NOT return empty groups. Use this fallback order:

1. **Orchestration-root grouping** — one group per CONNECTED orchestration cluster. Follow `orchestration-calls` edges to find clusters. Do NOT create one group per individual orchestration when they call each other.
2. **Trigger-capability grouping** — file/queue/http/timer/db-poller entry-capable artifacts.
3. **Connected-component grouping** — from the graph edges.

Only leave artifacts in `ungroupedArtifactIds` if they are truly isolated with no meaningful edges or entry semantics.

For fallback groups, set `entryPoint` to orchestration/trigger/internal-entry (not receive-location).

---

## 3. Required Output Fields

Each group MUST have:

| Field         | Type     | Description                                      |
| ------------- | -------- | ------------------------------------------------ |
| `id`          | string   | Unique group ID (e.g. `flow-1-order-processing`) |
| `name`        | string   | Human-readable name by business purpose          |
| `description` | string   | What this flow does                              |
| `category`    | string   | e.g. `message-flow`, `shared-infrastructure`     |
| `artifactIds` | string[] | MUST NOT be empty                                |
| `entryPoint`  | object   | Entry point (type, name, messageType)            |
| `exitPoints`  | array    | Exit points (type, name, messageType)            |

---

## 4. Procedure

1. Call `migration_detectFlowGroups` to get the artifact connection graph and summaries.
2. **If the connectionGraph has few or no `orchestration-calls` edges**, the call-chain data may be incomplete. In that case:
   a. Call `migration_listArtifacts` with `category="custom-code"` to find DLLs.
   b. Decompile relevant DLLs per skill `dependency-and-decompilation-analysis` §2 to discover orchestration call relationships hidden in compiled code.
   c. Read orchestration source files (`migration_readSourceFile`) to find `Call Orchestration` / `Start Orchestration` shapes and their targets.
   d. Use the discovered call chains to merge groups that should be together.
3. Determine logical flow groups using the shared-orchestration strategy above, incorporating both graph edges AND any call chains discovered in step 2.
4. Call `migration_discovery_storeFlowGroups` with the groups array, `ungroupedArtifactIds`, and explanation.

---

## 5. What NOT to Do

- Do NOT create empty `artifactIds` arrays.
- Do NOT split orchestrations linked by call chains into separate groups.
- Do NOT skip decompilation/source reading when the connectionGraph has missing call-chain edges — incomplete grouping causes downstream analysis failures.
