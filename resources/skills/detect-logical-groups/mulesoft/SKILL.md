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
- **Shared-connection edges**: The `connectionGraph` includes `shared-connection` edges when multiple flows use the same global configuration (e.g., same `http:listener-config`, same `db:config`). Flows sharing configs SHOULD be in the same group unless they are clearly independent.
- Only create separate groups for flows that use DIFFERENT sub-flows with no transitive connection.
- Transitively connected artifacts belong in the SAME group.
- Name each group by business purpose (derived from flow names and HTTP listener paths).

---

## 2. Fallback Rules (When no HTTP listeners or schedulers exist)

Do NOT return empty groups. Use this fallback order:

1. **Flow-root grouping** — one group per CONNECTED flow cluster. Follow `call-workflow` edges to find clusters. Do NOT create one group per individual flow when they reference each other.
2. **Trigger-capability grouping** — flows with sources (http:listener, scheduler, jms:listener, file:listener, vm:listener) as entry points. `receiveLocationCount` includes all triggers.
3. **Connected-component grouping** — from graph edges (`call-workflow`, `shared-connection`) and any remaining connections.

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

1. Call `migration_detectFlowGroups` to get the artifact connection graph and summaries.
2. Determine logical flow groups using the flow-reference chain strategy above.
3. Call `migration_discovery_storeFlowGroups` with the groups array, `ungroupedArtifactIds`, and explanation.
4. Do NOT read source files or generate architecture diagrams — only detect and store groups.

---

## 5. What NOT to Do

- Do NOT read source files during flow group detection.
- Do NOT generate architecture diagrams.
- Do NOT create empty `artifactIds` arrays.
- Do NOT split flows linked by flow-ref chains into separate groups.
