---
name: detect-logical-groups
description: Rules for detecting and grouping Dell Boomi integration artifacts into logical flow groups using a Process Call chain strategy. Covers Process Call/Process Route chains, shared connections and trading partners, fallback grouping when no start listeners exist, and required output fields.
---

# Skill: Detecting Flow Groups (Dell Boomi)

> **Purpose**: Authoritative rules for how an AI agent should group discovered Dell Boomi processes into logical flow groups. The agent MUST follow these rules exactly.

---

## 1. Grouping Strategy (Process Call Chains)

- **HIGHEST PRIORITY**: If multiple processes call the SAME sub-process via a Process Call or Process Route shape (directly or transitively), they MUST be in the SAME group — the shared sub-process is the unifying element.
- **Call-workflow edges**: The `connectionGraph` includes `call-workflow` edges for Process Call / Process Route shapes. Processes linked by these edges (directly or transitively) MUST be in the SAME group. Example: Inbound850Orchestration calls Generate997Acknowledgment, Generate855PurchaseOrderAck and ExceptionSubprocess — all four belong in ONE group.
- **Shared-connection edges**: The `connectionGraph` includes `shared-connection` edges when processes use the same Connection component. Processes sharing a connection SHOULD be in the same group unless they are clearly independent business flows (e.g. a shared audit database alone is NOT a reason to merge).
- **B2B transaction sets**: Processes exchanging documents for the same trading partners and the same business transaction family (e.g. X12 850 → 855/856/810 order-to-cash) MAY be grouped when they share sub-processes or partner agreements; otherwise keep inbound and outbound transactions as separate groups.
- Only create separate groups for processes with NO transitive connection.
- Name each group by business purpose (derived from process names, manifest descriptions, listener paths or transaction sets).

Supporting components (connections, operations, profiles, maps, scripts, trading partners, cross references) are NOT flows. Include them in the `artifactIds` of every group whose processes reference them.

---

## 2. Fallback Rules (When no listener/schedule start shapes exist)

Do NOT return empty groups. Use this fallback order:

1. **Process-root grouping** — one group per CONNECTED process cluster, following `call-workflow` edges.
2. **Trigger-capability grouping** — processes whose Start shape is a listener (Web Services Server, HTTP, JMS, AS2/Trading Partner receive), schedule, or event subscription are entry points. `receiveLocationCount` includes all triggers.
3. **Connected-component grouping** — from graph edges (`call-workflow`, `shared-connection`) and any remaining references.

Only leave artifacts in `ungroupedArtifactIds` if they are truly isolated.

For fallback groups, set `entryPoint` to flow/trigger/internal-entry (not receive-location).

---

## 3. Required Output Fields

Each group MUST have:

| Field         | Type     | Description                                      |
| ------------- | -------- | ------------------------------------------------ |
| `id`          | string   | Unique group ID (e.g. `flow-1-order-processing`) |
| `name`        | string   | Human-readable name by business purpose          |
| `description` | string   | What this flow does                              |
| `category`    | string   | e.g. `message-flow`, `b2b-edi`, `shared-infrastructure` |
| `artifactIds` | string[] | MUST NOT be empty                                |
| `entryPoint`  | object   | Entry point (type, name, messageType)            |
| `exitPoints`  | array    | Exit points (type, name, messageType)            |

---

## 4. Procedure

1. Call `migration_detectFlowGroups` to get the artifact connection graph and summaries.
2. **If the connectionGraph has few or no `call-workflow` edges**, read the process files (`migration_readSourceFile`) to find Process Call/Process Route targets (`processId`, `process=` or shape names such as `Generate997…` that match a process) and shared connection references.
3. Determine logical groups using the Process Call chain strategy, incorporating graph edges AND the call chains found in step 2.
4. Call `migration_discovery_storeFlowGroups` with the groups array, `ungroupedArtifactIds`, and explanation.

---

## 5. What NOT to Do

- Do NOT create empty `artifactIds` arrays.
- Do NOT split processes linked by Process Call chains into separate groups.
- Do NOT create a group for a sub-process that has callers — it belongs to its callers' group.
- Do NOT skip source reading when call-chain edges are missing.