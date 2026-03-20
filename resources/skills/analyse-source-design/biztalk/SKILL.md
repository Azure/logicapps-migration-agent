---
name: analyse-source-design
description: Rules for analysing a single flow group's architecture. Covers source file reading depth, Mermaid diagram rules, MessageBox modeling, orchestration shape rendering, component mapping priority ladder, and the required multi-step store tool sequence.
---

# Skill: Analysing Flow Architecture

> **Purpose**: Authoritative rules for how an AI agent should analyse a single flow group, generate an architecture visualization, and store the discovery results. Follow exactly.

---

## 1. Source Reading Depth

- Call `migration_getArtifactDetails` AND `migration_readSourceFile` for EVERY artifact in the group.
- Extract ALL configuration details — adapter type, paths, polling intervals, pipeline stages, port names, schema fields, orchestration shapes, map field mappings, retry config.
- ZERO HALLUCINATION — every value in the architecture diagram MUST come from source files.

---

## 2. Reference Lookup (MANDATORY)

Before classifying any component's Azure equivalent:

1. Read the skill `source-to-logic-apps-mapping` to look up the exact Logic Apps Standard equivalent.
2. For EACH protocol/adapter/technology, use the connector name and operation names from that skill as search terms:
    - Call `migration_readReferenceDoc` with `action="search"` and a TARGETED query.
    - Call `migration_readReferenceDoc` with `action="read"` for the TOP result.
3. Do NOT combine all protocols into one generic search.
4. Do NOT assume any protocol lacks native support without checking the skill and docs first.

---

## 3. Mermaid Architecture Diagram Rules

Generate a `flowchart TB` with subgraphs for: **INBOUND**, **MESSAGE SCHEMAS**, **MESSAGEBOX**, **ORCHESTRATION**, **OUTBOUND**.

### 3.1 MessageBox Rules

- ONE MessageBox subgraph — ALL messages route through it.
- Pattern: Inbound → MessageBox → Orchestration → MessageBox → Outbound.
- Use cylinder shape `[("..")]` for Publish nodes.

### 3.2 Subscription Rules

- Subscription activates the ORCHESTRATION INSTANCE (`ORCH1`), NOT the first receive shape (`RCV1`).
- CORRECT: `SUB1 --> ORCH1`, `ORCH1 --> RCV1`.
- Outbound subscription label: `"Orchestration Port Binding / Routed to [name]"`, NOT `"SendPortName == [name]"`.

### 3.3 Orchestration Binding Types

Read `.odx` files carefully for `PortDeclaration DirectBindingType`:

| Binding Type   | Meaning                                                  | Diagram                    |
| -------------- | -------------------------------------------------------- | -------------------------- |
| `MessageBox`   | Subscribes DIRECTLY to MessageBox with a filter          | MessageBox → Orchestration |
| `PartnerPort`  | Receives from ANOTHER orchestration via partner port     | OrchA → OrchB              |
| `SpecifyLater` | Bound to a physical Receive/Send Port at deployment time | Receive/Send Port → Orch   |

Do NOT assume all orchestrations subscribe to the MessageBox.

### 3.4 Orchestration Internal Detail (MANDATORY)

Do NOT draw an orchestration as a single box. Each orchestration MUST be a subgraph containing its individual shapes as separate nodes:

- Receive shapes, Send shapes, Construct/Transform shapes, Decide shapes, Expression shapes, Scope shapes, Suspend shapes, etc.
- Show the execution flow between shapes with arrows.
- Include for each shape: shape name, shape type, logical port name, message variable, and map name (for transforms).
- Label every arrow with what happens at that step.

### 3.5 Child Orchestration Expansion (MANDATORY)

If any orchestration invokes another orchestration via `Exec/StartOrchestration`, `Call Orchestration`, or `Start Orchestration` shapes:

1. **Each invoked orchestration MUST be expanded** as its own subgraph with full internal shapes — exactly like the parent orchestration (§3.4). Do NOT render child orchestrations as collapsed leaf nodes (e.g., `StartOrchestration_1`, `StartOrchestration_6`).
2. **Read the target orchestration's source file** using `migration_readSourceFile` to get its Receive/Send/Construct/Decide/Expression shapes.
3. **Connect parent → child** with an arrow labeled with the call type (e.g., "Call Orchestration: ChildName").
4. **Recurse**: if the child orchestration itself calls further orchestrations, expand those too — all the way down the call tree.

### 3.6 No Collapsed Invocation Targets

Leaf nodes like `StartOrchestration_1` or `CallOrchestration_2` are NOT acceptable final output. Every invocation target must be a fully expanded subgraph unless:

- The target orchestration is NOT in the flow group's artifact list (in which case, label the node as "External: {name} (not in group)").

### 3.7 Overflow Handling

When the diagram becomes too large (more than ~30 orchestration subgraphs or ~200 shape nodes):

- Split into parent diagram + child detail diagrams.
- The parent diagram shows orchestration-level boxes with call relationships.
- Each child detail diagram shows the full internal shapes for one orchestration.
- Store the parent diagram via `storeArchitecture`; reference child details in `storeComponents`.

### 3.8 Pre-Store Validation Gates

Before calling `migration_discovery_storeArchitecture` or `migration_discovery_finalize`, verify:

- [ ] ALL invoked orchestrations in the flow group are expanded as subgraphs with internal shapes
- [ ] ALL orchestration shapes are labeled with shape name, type, and relevant details
- [ ] ALL arrows between shapes have step-level labels
- [ ] NO collapsed invocation targets remain (no bare `StartOrchestration_*` or `CallOrchestration_*` leaf nodes)

**If any gate fails, do NOT call storeArchitecture or finalize.** Fix the diagram first.

---

## 4. Component Mapping Priority Ladder

> **⚠️ MANDATORY OVERRIDE — READ THIS FIRST:**
> Source custom code — scripting functoids, external assemblies (.dll), custom pipeline components, helper libraries, map extension objects — MUST **ALWAYS** map to **.NET local functions** (level 5). Do NOT simplify custom code to expressions, inline code, or any other level. This rule overrides the priority ladder below. If source code or decompiled code exists, the conversion agent MUST translate the real business logic into a .NET local function — never a stub, never an expression approximation.

For all **other** (non-custom-code) components, follow this priority for `azureEquivalent`:

1. **Built-in actions** — XML Parse (XmlParse), XML Compose (XmlCompose), Validate XML (XmlValidation), Transform XML (Xslt), Compose, Parse JSON, Select, Flat File Decode/Encode.
2. **Workflow expressions** — `@concat()`, `@add()`, `@if()` — ONLY when no built-in action exists.
3. **Data Mapper / Liquid** — for field mapping.
4. **Inline Code** — for moderate logic.
5. **.NET local functions** — for complex .NET logic.
6. **Azure Functions** — ONLY for truly external services (last resort).

> **AUTO-APPLY RULE**: Always choose the HIGHEST applicable level without asking. If a built-in action exists for the task (e.g. XmlParse for XML processing, XmlValidation for schema validation), use it — do NOT fall back to expressions or ask the user. The ladder is deterministic: pick the first level that works.

> **XML PROCESSING RULE**: For any XML parsing, validation, or access pattern, ALWAYS use the built-in XML Operations actions (XmlParse, XmlValidation) instead of `xpath()` expressions. XmlParse validates against schemas and returns structured JSON; xpath() skips validation and produces verbose code. This applies to BizTalk XMLReceive pipeline replacements, schema validation, and any XML-to-JSON conversion.

### Additional Rules

- Every orchestration (type=orchestration) MUST have `azureEquivalent='Logic Apps Standard workflow'` — NEVER `'local function'`.
- Sub-orchestrations → child workflows invoked via Workflow action type.
- .NET local function = NATIVE (`isLogicAppsNative=true`); custom built-in connector = NOT native (`isLogicAppsNative=false`).

---

## 5. Required Store Tool Sequence

Store discovery results in THIS order:

1. `migration_discovery_storeMeta` — explanation, summary (with receiveLocations, receivePipelines, receivePorts, orchestrations, maps, schemas, sendPorts, sendPipelines arrays), title.
2. `migration_discovery_storeArchitecture` — complete Mermaid diagram string.
3. `migration_discovery_storeComponents` — componentDetails array (id, name, type, description, purpose, connectedTo, properties, azureEquivalent, isLogicAppsNative).
4. `migration_discovery_storeMessageFlow` — messageFlow array (step, component, componentType, action, messageType, description, pipelineComponents, properties, subscriptionFilter, additionalDetails). `additionalDetails` is MANDATORY and MUST be an object of named fields, never a raw string. If there is only one free-text note, put it in `description` or use `additionalDetails: { note: "..." }`. If there are no extra structured details, send `additionalDetails: {}`.
5. `migration_discovery_storeGaps` — gapAnalysis array (component, componentType, gap, severity, options, recommendation).
6. `migration_discovery_storePatterns` — migrationPatterns array (pattern, description, complexity, biztalkApproach, logicAppsApproach, components).
7. `migration_discovery_storeDependencies` — missingDependencies array + summary + allCriticalResolved + counts.
8. `migration_discovery_finalize` — assemble all files and open visualization.

Do NOT call `migration_discovery_storeAnalysis` — use the individual tools above.
