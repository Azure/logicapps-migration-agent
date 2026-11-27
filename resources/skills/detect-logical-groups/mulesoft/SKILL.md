---
name: detect-logical-groups
description: Rules for detecting and grouping MuleSoft integration artifacts into logical flow groups using flow-reference strategy. Covers flow-ref call-chain rules, fallback grouping when no sources exist, and required output fields.
---

# Skill: Detecting Flow Groups

> **Purpose**: Authoritative rules for how an AI agent should group discovered MuleSoft integration artifacts into logical flow groups. The agent MUST follow these rules exactly.

---

## 1. Grouping Strategy (Flow Reference Chains)

- **HIGHEST PRIORITY**: If multiple flows reference the SAME sub-flow via `flow-ref` (directly or transitively), they MUST be in the SAME group — the shared sub-flow is the unifying element.
- **Call-workflow edges**: The `connectionGraph` includes `call-workflow` edges when one flow calls another flow or sub-flow via `flow-ref`. Flows linked by these edges (directly or transitively) MUST be in the SAME group. Example: If Flow-A calls Sub-Flow-B and Sub-Flow-B calls Sub-Flow-C, all three belong in ONE group.
- **Shared configuration does not merge flows**: the `connectionGraph` includes `shared-connection` edges when multiple flows use the same global configuration (e.g., same `http:listener-config`, same `db:config`). Do NOT merge flows only because of these edges; list the configuration artifact in `sharedArtifactIds` and in the `artifactIds` of every group that uses it.
- **Start from `proposedGroups`** returned by `migration_detectFlowGroups` (computed deterministically from `flow-ref` chains). Keep the proposed `id` and `artifactIds`; improve only `name` and `description`. Do not split a proposed group.
- Only create separate groups for flows that use DIFFERENT sub-flows with no transitive connection.
- Transitively connected artifacts belong in the SAME group.
- Name each group by business purpose (derived from flow names and HTTP listener paths).

---

## 2. Fallback Rules (When no HTTP listeners or schedulers exist)

Do NOT return empty groups. Use this fallback order:

1. **Flow-root grouping** — one group per CONNECTED flow cluster. Follow `call-workflow` edges to find clusters. Do NOT create one group per individual flow when they reference each other.
2. **Trigger-capability grouping** — flows with sources (http:listener, scheduler, jms:listener, file:listener, vm:listener) as entry points. `receiveLocationCount` includes all triggers.
3. **Connected-component grouping** — from `call-workflow` edges and any remaining connections, ignoring `shared-connection` edges and edges into shared artifacts.

Only leave artifacts in `ungroupedArtifactIds` if they are truly isolated with no meaningful edges or entry semantics.

For fallback groups, set `entryPoint` to flow/trigger/internal-entry (not receive-location).

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

1. Call `migration_detectFlowGroups` to get `proposedGroups`, `proposedSharedArtifactIds`, `proposedUngroupedArtifactIds`, the artifact connection graph and summaries.
2. **Only if `proposedGroups` is empty or the connectionGraph has few or no `call-workflow` edges**, the flow-ref data may be incomplete. In that case:
   a. Call `migration_listArtifacts` with `category="custom-code"` to find JARs and custom Java classes.
   b. Read flow source files (`migration_readSourceFile`) to find `flow-ref` targets.
   c. Merge groups only with the call chains discovered this way.
3. Determine logical flow groups using the flow-reference chain strategy above, incorporating both graph edges AND any call chains discovered in step 2.
4. Call `migration_discovery_storeFlowGroups` with the groups array, `sharedArtifactIds`, `ungroupedArtifactIds`, and explanation.

---

## 5. What NOT to Do

- Do NOT create empty `artifactIds` arrays.
- Do NOT split flows linked by flow-ref chains into separate groups.
- Do NOT merge flows only because they share a global configuration, schema or library — mark those artifacts shared.
- Do NOT skip source reading when the connectionGraph has missing call-chain edges — incomplete grouping causes downstream analysis failures.
