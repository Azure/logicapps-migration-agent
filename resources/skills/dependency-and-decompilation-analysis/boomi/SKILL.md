---
name: dependency-and-decompilation-analysis
description: Rules for discovering, analysing, and classifying missing dependencies during Dell Boomi process analysis. Covers referenced-component closure (connections, operations, profiles, maps, scripts, sub-processes, trading partners, cross references), Custom Library JAR decompilation, environment extensions, and what blocks migration.
---

# Skill: Dependency & Decompilation Analysis (Dell Boomi)

> **Purpose**: Authoritative rules for how an AI agent should find, analyse, and classify the dependencies of a Dell Boomi process group. Boomi processes are assembled from many separately exported components; a migration is only complete when every referenced component's behaviour is available.

---

## 1. Dependency Discovery

### 1.1 Inventory

Call `migration_listArtifacts` (all categories, then `category="custom-code"`) to list every exported component: processes, connections, operations, profiles, maps, trading partners, cross-reference tables, process properties, scripts (`.groovy`, `.js`), and any Custom Library JARs (`.jar`).

### 1.2 Reference Closure (MANDATORY)

For EVERY process in the group, read the process XML and resolve every reference to a concrete exported component:

| Reference in process                                            | Must resolve to                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Connector shape `connectionId` / `connection=`                  | Connection component (connector type, URL/host, auth)                   |
| Connector shape `operationId` / `operation=`                    | Operation component (action, object, request/response profiles)         |
| Map shape `mapId` / `map=`                                      | Map component, and the source/target Profiles it references             |
| Data Process shape (Custom Scripting)                           | Inline script text or a Script component (`.groovy`/`.js`)              |
| Process Call / Process Route shape `processId` / `process=`     | Sub-process component (recurse into it)                                 |
| Trading Partner shape / TP receive start                        | Trading Partner components, their standard and communication channels   |
| Map function "Cross Reference Lookup"                           | Cross Reference Table component (`.csv`/`.json`)                        |
| Set Properties / Decision referencing process properties        | Process Property component or extensions                                |
| Custom connector / Connector SDK type                           | Connector source or documentation                                       |
| Script `import` of non-JDK classes                              | Custom Library JAR (source or decompiled code)                          |

- Component IDs in native exports are GUIDs; match them against the `componentId` of exported files. Synthetic exports reference components by name.
- A component that is referenced but NOT exported is a **missing dependency**.

### 1.3 What NOT to Do

- Do NOT conclude dependency closure from the file list alone.
- Do NOT assume a Map is self-contained — check for scripting functions, cross-reference lookups and user-defined functions.
- Do NOT treat `${...}` credential placeholders as missing dependencies; they become app settings / Key Vault references. Record them as `info` configuration dependencies.

---

## 2. Custom Library JAR Analysis

Groovy scripts and Custom Scripting map functions may import classes from Custom Library components (JARs deployed to the Atom).

### 2.1 When to Decompile

Decompile **on demand** only when a script or connector references a class whose source is not present:

1. If `.java`/`.groovy` source is present, read it directly.
2. Otherwise, run `cfr <JarPath> --outputdir out/__decompiled__/<JarName>/` (or `jar xf` then decompile the `.class` files).
3. Read the decompiled code to understand the business rules used by the script.

### 2.2 Recursive Walk

After decompiling a JAR, check what it imports. Continue recursively for JARs present in the source folder. Stop when the reference is a standard runtime library (`java.*`, `javax.*`, `groovy.*`, `com.boomi.execution.*` Boomi runtime API) or the code is not reachable from the group's processes.

### 2.3 Boomi Runtime API Usage

Scripts commonly use `dataContext`, `ExecutionUtil`, `getDynamicProcessProperty`, `setDynamicProcessProperty`, document properties (`document.dynamic.userdefined.*`) and `ExecutionUtil.getRuntimeExecutionProperty`. These are **standard platform** APIs — map their semantics (workflow variables, parameters, trigger outputs, `workflow().run.name`) rather than flagging them as missing.

### 2.4 Verification Gates

- [ ] Every component referenced by the group's processes is exported (or flagged missing)
- [ ] Every sub-process in the call tree has been read
- [ ] Every Map has had its functions and lookups checked
- [ ] Every script has been read and its imports resolved
- [ ] Every Custom Library class used by a script has source or decompiled code

---

## 3. Source vs Decompiled Precedence

- If the source (`.groovy`, `.js`, `.java`, inline Data Process script, Map function script) is present, do NOT mark it as missing.
- Only mark a dependency as missing when NEITHER source NOR understandable decompiled code is available.
- An import or component-ID reference alone does not resolve dependency status.

---

## 4. What Counts as Missing

- Referenced Connection/Operation/Profile/Map/sub-process components that were not exported.
- Script components or Custom Library JARs without source.
- Custom connectors (Connector SDK) without source or documentation.
- Cross Reference Tables referenced by maps but not exported (lookup data is required to preserve behaviour).
- Trading Partner components referenced by a TP shape but not exported, or X12/EDIFACT profiles without segment definitions.
- Certificates (AS2 signing/encryption, SFTP keys, client TLS) needed in the target environment.
- Environment extensions / Atom properties that hold behaviour-changing values, not just credentials.
- Boomi platform services used by the process: Atom Queues, Shared Web Server settings, API Management, Master Data Hub, Flow — flag them and name the Azure equivalent needed.

---

## 5. Classification

Each missing dependency MUST have:

| Field               | Type    | Description                                                                                  |
| ------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `id`                | string  | Unique identifier                                                                            |
| `name`              | string  | Dependency name                                                                              |
| `type`              | string  | component/connection/operation/profile/map/script/jar/connector/cross-reference/trading-partner/certificate/property-file/other |
| `origin`            | string  | One of `standard-framework` (Java/Groovy runtime), `standard-platform` (Boomi runtime/standard connectors), `third-party`, `custom`, `unknown`. Do NOT invent other values. |
| `severity`          | string  | critical/warning/info                                                                        |
| `referencedBy`      | array   | Artifact names that reference this dependency                                                |
| `reason`            | string  | Why it is needed                                                                             |
| `blocksMigration`   | boolean | True if it prevents a complete non-stub implementation                                       |
| `migrationRelevant` | boolean | False for design-time-only dependencies (e.g. test harness components)                       |
| `resolution`        | string  | MUST follow format: "Add the source code or binary for {name} to the migration source folder and re-run discovery." Do NOT suggest code changes or workarounds — the user must provide the missing artifact. |

Also provide: `summary` (string), `allCriticalResolved` (boolean), `counts` ({ critical, warning, info }).

### 5.1 Fail-Closed Decision Rule

When evidence is incomplete or ambiguous, mark the dependency as missing with appropriate severity rather than reporting full resolution. A "no missing dependencies" conclusion is valid only when all verification gates in §2.4 pass with explicit evidence.