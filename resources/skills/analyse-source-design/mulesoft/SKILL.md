---
name: analyse-source-design
description: Rules for analysing a single MuleSoft flow group's architecture. Covers source file reading depth, Mermaid diagram rules, flow/sub-flow rendering, processor mapping priority ladder, and the required multi-step store tool sequence.
---

# Skill: Analysing Flow Architecture

> **Purpose**: Authoritative rules for how an AI agent should analyse a single MuleSoft flow group, generate an architecture visualization, and store the discovery results. Follow exactly.

---

## 1. Source Reading Depth

- Call `migration_getArtifactDetails` AND `migration_readSourceFile` for EVERY artifact in the group.
- Extract ALL configuration details — connector type, HTTP listener paths, DataWeave scripts, scheduler expressions, database queries, error handler strategies, global config references, flow-ref targets, choice/scatter-gather branches, variable assignments.
- ZERO HALLUCINATION — every value in the architecture diagram MUST come from source files.

---

## 2. Reference Lookup (MANDATORY)

Before classifying any component's Azure equivalent:

1. Read the skill `source-to-logic-apps-mapping` to look up the exact Logic Apps Standard equivalent.
2. For EACH connector/processor/technology, use the connector name and operation names from that skill as search terms:
    - Call `migration_readReferenceDoc` with `action="search"` and a TARGETED query.
    - Call `migration_readReferenceDoc` with `action="read"` for the TOP result.
3. Do NOT combine all connectors into one generic search.
4. Do NOT assume any connector lacks native support without checking the skill and docs first.

---

## 3. Mermaid Architecture Diagram Rules

Generate a `flowchart TB` with subgraphs for: **SOURCES (TRIGGERS)**, **GLOBAL CONFIGS**, **FLOWS**, **SUB-FLOWS**, **OUTBOUND CONNECTORS**.

### 3.1 Flow Source Rules

- Each flow with a source (http:listener, scheduler, jms:listener, etc.) gets an entry point node in the SOURCES subgraph.
- Pattern: Source → Flow → Processors → Outbound Connectors.
- Use cylinder shape `[("..")]` for queue/topic destinations.

### 3.2 Flow Reference Rules

- `flow-ref` links from one flow/sub-flow to another MUST be shown as arrows between subgraphs.
- CORRECT: `FLOW1 --> SUB_FLOW1`, where the arrow label is `"flow-ref: sub-flow-name"`.
- Sub-flows have NO source — they are always invoked via `flow-ref`.

### 3.3 Global Config References

Read the Mule XML carefully for global connector configurations:

| Config Type                   | Meaning                                               | Diagram               |
| ----------------------------- | ----------------------------------------------------- | --------------------- |
| `http:listener-config`        | Shared HTTP listener configuration (host, port, TLS)  | Sources → Flows       |
| `http:request-config`         | Outbound HTTP client configuration (host, auth)       | Flow → External API   |
| `db:config`                   | Database connection pool (host, DB name, credentials) | Flow → Database       |
| `jms:config` / `vm:config`    | Messaging connector (broker URL, queues)              | Flow → Message Broker |
| `file:config` / `sftp:config` | File system or SFTP connection                        | Flow → File System    |

Show global configs as shared resources that multiple flows reference via `config-ref`.

### 3.4 Flow Internal Detail (MANDATORY)

Do NOT draw a flow as a single box. Each flow MUST be a subgraph containing its individual processors as separate nodes:

- HTTP Listener, ee:transform, choice (with when/otherwise branches), scatter-gather (with routes), foreach, try (with error-handler), flow-ref, set-variable, logger, http:request, db:select/insert, etc.
- Show the execution flow between processors with arrows.
- Include for each processor: doc:name (display name), processor type, config-ref, key attributes (path, method, DataWeave script reference, collection expression).
- Label every arrow with what happens at that step.
- For `choice` routers, show each `when` branch condition and the `otherwise` branch.
- For `scatter-gather`, show parallel routes as parallel branches converging.

### 3.5 Sub-Flow Expansion (MANDATORY)

If any flow invokes a sub-flow via `flow-ref`:

1. **Each invoked sub-flow MUST be expanded** as its own subgraph with full internal processors — exactly like the parent flow (§3.4). Do NOT render sub-flows as collapsed leaf nodes (e.g., `flow-ref_1`, `subflow_2`).
2. **Read the target sub-flow's source file** using `migration_readSourceFile` to get its processors.
3. **Connect parent → sub-flow** with an arrow labeled `"flow-ref: {sub-flow-name}"`.
4. **Recurse**: if the sub-flow itself calls further sub-flows, expand those too — all the way down the call tree.

### 3.6 No Collapsed Invocation Targets

Leaf nodes like `flow-ref_1` or `subflow_2` are NOT acceptable final output. Every invoked sub-flow must be a fully expanded subgraph unless:
- The target sub-flow is NOT in the flow group's artifact list (in which case, label the node as "External: {name} (not in group)").

### 3.7 Overflow Handling

When the diagram becomes too large (more than ~30 flow/sub-flow subgraphs or ~200 processor nodes):
- Split into parent diagram + child detail diagrams.
- The parent diagram shows flow-level boxes with flow-ref relationships.
- Each child detail diagram shows the full internal processors for one flow.
- Store the parent diagram via `storeArchitecture`; reference child details in `storeComponents`.

### 3.8 Pre-Store Validation Gates

Before calling `migration_discovery_storeArchitecture` or `migration_discovery_finalize`, verify:

- [ ] ALL invoked sub-flows in the flow group are expanded as subgraphs with internal processors
- [ ] ALL processors are labeled with doc:name, type, and relevant details
- [ ] ALL arrows between processors have step-level labels
- [ ] NO collapsed invocation targets remain (no bare `flow-ref_*` or `subflow_*` leaf nodes)

**If any gate fails, do NOT call storeArchitecture or finalize.** Fix the diagram first.

---

## 4. Component Mapping Priority Ladder

> **⚠️ MANDATORY OVERRIDE — READ THIS FIRST:**
> Source custom code — custom Java classes, custom Mule modules, MEL (Mule Expression Language) scripts with complex Java interop, custom transformers, custom policies — MUST **ALWAYS** map to **.NET local functions** (level 5). Do NOT simplify custom code to expressions, inline code, or any other level. This rule overrides the priority ladder below. If source code exists, the conversion agent MUST translate the real business logic into a .NET local function — never a stub, never an expression approximation.

For all **other** (non-custom-code) components, follow this priority for `azureEquivalent`:

1. **Built-in actions** — HTTP trigger/action, Compose, Parse JSON, Select, Transform XML (Xslt), XML Parse (XmlParse), XML Compose (XmlCompose), Validate XML (XmlValidation), Flat File Decode/Encode, Service Bus, SQL Connector, File/FTP/SFTP connectors.
2. **Workflow expressions** — `@concat()`, `@add()`, `@if()`, `@body()`, `@items()` — ONLY when no built-in action exists.
3. **Data Mapper / Liquid** — for DataWeave-to-Liquid field mapping conversions.
4. **Inline Code** — for moderate logic (simple DataWeave expressions that can be inlined).
5. **.NET local functions** — for complex DataWeave scripts, Java-based custom code, or logic that cannot be expressed in Liquid.
6. **Azure Functions** — ONLY for truly external services (last resort).

> **AUTO-APPLY RULE**: Always choose the HIGHEST applicable level without asking. If a built-in action exists for the task (e.g. SQL connector for db:select, HTTP action for http:request), use it — do NOT fall back to expressions or ask the user. The ladder is deterministic: pick the first level that works.

> **DATAWEAVE PROCESSING RULE**: For DataWeave transformations (`ee:transform`), assess complexity. Simple field mappings → Liquid templates. Complex scripts with functions, reduce, groupBy, match → .NET local functions or Azure Functions. Always flag DataWeave conversions as gaps requiring review.

### Additional Rules

- Every flow (type=flow) MUST have `azureEquivalent='Logic Apps Standard workflow'` — NEVER `'local function'`.
- Sub-flows → child workflows invoked via Workflow action type, OR inlined into the parent workflow if simple enough.
- .NET local function = NATIVE (`isLogicAppsNative=true`); custom built-in connector = NOT native (`isLogicAppsNative=false`).

---

## 5. Required Store Tool Sequence

Store discovery results in THIS order:

1. `migration_discovery_storeMeta` — explanation, summary (with flows, subFlows, globalConfigs, connectors, dataweaveFiles, errorHandlers arrays), title.
2. `migration_discovery_storeArchitecture` — complete Mermaid diagram string.
3. `migration_discovery_storeComponents` — componentDetails array (id, name, type, description, purpose, connectedTo, properties, azureEquivalent, isLogicAppsNative).
4. `migration_discovery_storeMessageFlow` — messageFlow array (step, component, componentType, action, messageType, description, pipelineComponents, properties, subscriptionFilter, additionalDetails). `additionalDetails` is MANDATORY and MUST be an object of named fields, never a raw string. If there is only one free-text note, put it in `description` or use `additionalDetails: { note: "..." }`. If there are no extra structured details, send `additionalDetails: {}`.
5. `migration_discovery_storeGaps` — gapAnalysis array (component, componentType, gap, severity, options, recommendation).
6. `migration_discovery_storePatterns` — migrationPatterns array (pattern, description, complexity, mulesoftApproach, logicAppsApproach, components).
7. `migration_discovery_storeDependencies` — missingDependencies array + summary + allCriticalResolved + counts.
8. `migration_discovery_finalize` — assemble all files and open visualization.

Do NOT call `migration_discovery_storeAnalysis` — use the individual tools above.
