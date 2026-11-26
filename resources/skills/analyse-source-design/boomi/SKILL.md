---
name: analyse-source-design
description: Rules for analysing a single Dell Boomi process group's architecture. Covers source file reading depth (process XML, connections, operations, profiles, maps, trading partners, scripts), Mermaid diagram rules, process/sub-process rendering, shape mapping priority ladder, and the required multi-step store tool sequence.
---

# Skill: Analysing Flow Architecture (Dell Boomi)

> **Purpose**: Authoritative rules for how an AI agent should analyse a single Dell Boomi process group, generate an architecture visualization, and store the discovery results. Follow exactly.

---

## 1. Source Reading Depth

- Call `migration_getArtifactDetails` AND `migration_readSourceFile` for EVERY artifact in the group.
- Boomi projects are a set of exported components. Read ALL component types referenced by the group:

| Component                         | Typical location / format                                   | What to extract                                                                 |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Process                           | `Processes/*.xml` (`<bns:Component type="process">` or `<syntheticBoomiProcess>`) | Start shape (connector + operation, listener, schedule), every shape, `dragpoint`/`next` links, branch order |
| Connection                        | `Connections/*.xml` / `*.json`                              | Connector type (HTTP Client, Database, Disk, SFTP, JMS, Salesforce, AS2…), URL/host, auth, `${...}` placeholders |
| Operation                         | `Operations/*.xml` / `*.json`                               | Action (GET/QUERY/SEND/UPSERT…), object/path, request/response profiles         |
| Profile                           | `Profiles/*` (XML, JSON, Flat File, Database, EDI)          | Structure, required elements, X12/EDIFACT segments and loops                    |
| Map                               | `Maps/*.xml` / `*.json`                                     | Source/target profiles, field links, functions, scripting, lookups, validations |
| Trading Partner                   | `TradingPartners/*.json` / `*.xml`                          | Standard (X12/EDIFACT/HL7/RosettaNet), identifiers (ISA/GS qualifiers), documents, communication (AS2/SFTP/HTTP) |
| Cross Reference Table             | `CrossReferences/*.csv` / `*.json`                          | Columns and rows used by lookups                                                |
| Script                            | `Scripts/**/*.groovy` / `*.js`                              | Full business logic, process/document properties read and written              |
| Process Property / Extensions     | `ProcessProperties/*`, `extensions*`                        | Default values, which values are environment-specific                           |
| Manifest                          | `migration-manifest.json`                                   | Declared processes, transactions, migration targets, features, warnings        |

- Extract ALL configuration details — connector type and operation, listener paths, schedules, Decision/Route conditions, Branch order, Try/Catch scopes, Process Call targets, Set Properties assignments, Map functions, Notify messages, Exception/Stop shapes, document batching.
- Sample payloads (`Samples/*.edi`, `*.json`) and `Tests/test-cases.json` describe expected behaviour; use them as evidence, not as artifacts to migrate.
- ZERO HALLUCINATION — every value in the architecture diagram MUST come from source files.

---

## 2. Reference Lookup (MANDATORY)

Before classifying any component's Azure equivalent:

1. Read the skill `source-to-logic-apps-mapping` to look up the exact Logic Apps Standard equivalent.
2. For EACH connector/shape/technology, use the connector name and operation names from that skill as search terms:
    - Call `migration_readReferenceDoc` with `action="search"` and a TARGETED query.
    - Call `migration_readReferenceDoc` with `action="read"` for the TOP result.
3. Do NOT combine all connectors into one generic search.
4. Do NOT assume any connector lacks native support without checking the skill and docs first (e.g. X12, AS2, EDIFACT, SFTP, SQL, Service Bus, Salesforce all have native support).

---

## 3. Mermaid Architecture Diagram Rules

Generate a `flowchart TB` with subgraphs for: **SOURCES (START SHAPES)**, **CONNECTIONS**, **PROCESSES**, **SUB-PROCESSES**, **TRADING PARTNERS** (when B2B), **OUTBOUND CONNECTORS**.

### 3.1 Start Shape Rules

- Each process whose Start shape is a connector listener, Web Services Server, schedule, or Trading Partner receive gets an entry node in the SOURCES subgraph.
- A Start shape of type **No Data** or **Data Passthrough** means the process is a sub-process (invoked by Process Call) or a scheduled process — check the manifest/schedules and the callers.
- Pattern: Source → Process → Shapes → Outbound Connectors.
- Use cylinder shape `[("..")]` for queue/topic/table destinations.

### 3.2 Process Call Rules

- Process Call / Process Route links from one process to another MUST be shown as arrows between subgraphs labelled `"Process Call: {sub-process-name}"` (add `wait=true/false` when known).
- Sub-processes have NO source — they are always invoked via Process Call or Process Route.

### 3.3 Connection References

Show each Connection component as a shared resource node referenced by Connector shapes (via their Operation):

| Connector type                         | Diagram                    |
| -------------------------------------- | -------------------------- |
| HTTP Client / Web Services SOAP Client | Process → External API     |
| Web Services Server / HTTP listener    | Sources → Process          |
| Database                               | Process → Database         |
| Disk / FTP / SFTP                      | Process → File System      |
| JMS / AMQP / Kafka / Event Streams     | Process → Message Broker   |
| AS2 / Trading Partner                  | Partner ↔ Process          |
| Salesforce / NetSuite / SAP            | Process → SaaS application |

### 3.4 Process Internal Detail (MANDATORY)

Do NOT draw a process as a single box. Each process MUST be a subgraph containing its shapes as separate nodes:

- Start, Connector (Get/Send/Query/Upsert), Map, Data Process, Set Properties, Decision (true/false), Route, Branch (numbered branches), Try/Catch, Business Rules, Cleanse, Process Call, Notify, Message, Add to Cache / Retrieve from Cache, Flow Control, Trading Partner, Exception, Stop, Return Documents.
- Show the execution order between shapes with arrows (`dragpoint toShape` / `next`).
- Include for each shape: user label, shape type, referenced component (connection, operation, map, script, sub-process), key attributes.
- For Decision shapes show the condition and both `true`/`false` paths. For Route shapes show every route key. For Branch shapes number the branches — they execute **sequentially**, not in parallel.
- For Try/Catch show the try path and the catch path.

### 3.5 Sub-process Expansion (MANDATORY)

If any process invokes a sub-process:

1. **Each invoked sub-process MUST be expanded** as its own subgraph with all shapes — exactly like the parent process (§3.4). Do NOT render sub-processes as collapsed leaf nodes.
2. **Read the target sub-process's source file** using `migration_readSourceFile`.
3. **Connect parent → sub-process** with an arrow labelled `"Process Call: {sub-process-name}"`.
4. **Recurse** down the full call tree (e.g. error handler, 997/855 acknowledgment generators).

### 3.6 No Collapsed Invocation Targets

Every invoked sub-process must be a fully expanded subgraph unless the target is NOT in the group's artifact list (label it "External: {name} (not in group)").

### 3.7 Overflow Handling

When the diagram becomes too large (more than ~30 process subgraphs or ~200 shape nodes): split into a parent diagram with process-level boxes and Process Call relationships, plus child detail diagrams. Store the parent via `storeArchitecture`; reference child details in `storeComponents`.

### 3.8 Pre-Store Validation Gates

Before calling `migration_discovery_storeArchitecture` or `migration_discovery_finalize`, verify:

- [ ] ALL invoked sub-processes in the group are expanded as subgraphs with their shapes
- [ ] ALL shapes are labelled with name, type, and referenced component
- [ ] ALL arrows between shapes have step-level labels
- [ ] ALL trading partners and B2B standards used are shown
- [ ] NO collapsed invocation targets remain

**If any gate fails, do NOT call storeArchitecture or finalize.** Fix the diagram first.

---

## 4. Component Mapping Priority Ladder

> **⚠️ MANDATORY OVERRIDE — READ THIS FIRST:**
> Source custom code — Groovy/JavaScript Data Process scripts, Map scripting functions, Custom Library JARs, custom connectors — MUST **ALWAYS** map to **.NET local functions** (level 5). Do NOT simplify custom code to expressions, inline code, or any other level. If source code exists, the conversion agent MUST translate the real business logic into a .NET local function — never a stub, never an expression approximation.

For all **other** (non-custom-code) components, follow this priority for `azureEquivalent`:

1. **Built-in actions** — HTTP trigger/action, Compose, Parse JSON, Select, Transform XML (Xslt), XML Validation, Flat File Decode/Encode, X12/EDIFACT/AS2 encode/decode, Service Bus, SQL, File/FTP/SFTP, Blob.
2. **Workflow expressions** — only when no built-in action exists.
3. **Data Mapper / Liquid** — Boomi Map field links and standard functions.
4. **Inline Code** — moderate logic that is not source custom code.
5. **.NET local functions** — Groovy/JavaScript scripts, Map scripting, complex user-defined functions.
6. **Azure Functions** — ONLY for truly external services (last resort).

> **AUTO-APPLY RULE**: Always choose the HIGHEST applicable level without asking. If a built-in action exists (e.g. SQL connector for a Database operation, HTTP action for an HTTP Client operation, X12 Decode for an X12 profile), use it.

> **BOOMI MAP RULE**: Simple field links + standard functions → Liquid/Data Mapper/XSLT. Scripting functions, cross-reference lookups or document cache joins → .NET local function or Transform + lookup actions. Always flag Map conversions as gaps requiring review.

### Additional Rules

- Every process (type=flow) MUST have `azureEquivalent='Logic Apps Standard workflow'` — NEVER `'local function'`.
- Sub-processes → child workflows invoked via the Workflow action type, OR inlined into the parent workflow if trivially small.
- Trading partners / X12 profiles → Integration Account partners, agreements and schemas.
- .NET local function = NATIVE (`isLogicAppsNative=true`); custom built-in connector = NOT native (`isLogicAppsNative=false`).

---

## 5. Required Store Tool Sequence

Store discovery results in THIS order:

1. `migration_discovery_storeMeta` — explanation, summary (with flows, subProcesses, globalConfigs, connectors, maps, tradingPartners, scripts, errorHandlers arrays), title.
2. `migration_discovery_storeArchitecture` — complete Mermaid diagram string.
3. `migration_discovery_storeComponents` — componentDetails array (id, name, type, description, purpose, connectedTo, properties, azureEquivalent, isLogicAppsNative).
4. `migration_discovery_storeMessageFlow` — messageFlow array (step, component, componentType, action, messageType, description, pipelineComponents, properties, subscriptionFilter, additionalDetails). `additionalDetails` is MANDATORY and MUST be an object of named fields, never a raw string. If there are no extra structured details, send `additionalDetails: {}`.
5. `migration_discovery_storeGaps` — gapAnalysis array (component, componentType, gap, severity, options, recommendation).
6. `migration_discovery_storePatterns` — migrationPatterns array (pattern, description, complexity, biztalkApproach — describe the **Boomi** approach in this field, logicAppsApproach, components).
7. `migration_discovery_storeDependencies` — missingDependencies array + summary + allCriticalResolved + counts.
8. `migration_discovery_finalize` — assemble all files and open visualization.

Do NOT call `migration_discovery_storeAnalysis` — use the individual tools above.