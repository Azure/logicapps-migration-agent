---
name: dependency-and-decompilation-analysis
description: Rules for discovering, analysing, and classifying missing dependencies during TIBCO flow analysis. Covers JAR/Java decompilation, Maven dependency analysis, custom module classification, and what blocks migration.
---

# Skill: Dependency and Decompilation Analysis

> **Purpose**: Authoritative rules for discovering and classifying dependencies during TIBCO flow analysis. Follow exactly.

---

## 1. Dependency Discovery

Call `migration_listArtifacts` with `category="custom-code"` to find all `.jar`, `.java`, `.dwl`, `.xml`, `.raml`, `.properties`, `.yaml` files.

Also examine:

- `pom.xml` for Maven dependencies — especially those with `classifier=TIBCO-plugin` (TIBCO connectors).
- `TIBCO-artifact.json` for exported resources and class loader settings.
- `src/main/java/` for custom Java classes.
- `src/main/resources/` for Mapper/XSLT modules (`.dwl`), property files, and API specs.

### 1.1 Mandatory Coverage Guardrails [**NO FALSE NEGATIVES**]

1. Build the dependency candidate list from **artifact inventory and source references**, not from a root-folder file loop.
2. Do NOT assume "all root `.jar` files were decompiled" means dependency analysis is complete.
3. Treat any class/library referenced by flow-used code as a dependency candidate until explicitly resolved.
4. If a referenced library cannot be located in scanned source artifacts or `pom.xml`, mark it missing (fail-closed).

Anti-pattern to avoid:

- Scanning only the workspace root for `.jar` files and concluding dependency closure from that result.

---

## 2. Java Class / JAR Analysis Procedure

### 2.1 When to Decompile

Do NOT blindly decompile every `.jar` in the source folder. Instead, decompile **on demand** when a JAR/class reference is encountered during analysis:

- A TIBCO flow references a custom Java component (transformer, message processor, interceptor)
- A Mapper/XSLT expression calls a Java function
- A `pom.xml` dependency with `classifier=TIBCO-plugin` has no standard Logic Apps equivalent
- A class is imported but its `.java` source is not in `src/main/java/`

### 2.2 How to Decompile

When you decide a JAR needs decompilation:

1. If `.java` source files exist under `src/main/java/`, read them directly — no decompilation needed.
2. For JAR files without source, attempt decompilation:
    - Run `cfr <JarPath> --outputdir out/__decompiled__/<JarName>/` in the terminal.
    - Alternatively, use `jar xf <JarPath>` to extract and then decompile `.class` files.
3. ALWAYS write decompilation output to `out/__decompiled__/` in the **current migration workspace directory**. NEVER write to the source folder or any other external location.
4. Read the decompiled `.java` files to understand classes, methods, and business rules.
5. If decompilation fails (obfuscated, native), mark it as a critical missing dependency.

### 2.3 Recursive Dependency Tree Resolution [**IMPORTANT**]

After decompiling a JAR, inspect what IT depends on and **walk the full tree**:

1. **Read the decompiled code** — look for `import` statements, type references, and method calls that reference other libraries.
2. **For each referenced library**, check if it exists in the source folder (as `.jar`, `.java`, or in `pom.xml`).
3. **If it is a `.jar` in the source folder but not yet decompiled** — decompile it too (repeat from §2.2).
4. **If that child JAR itself references more JARs** — continue recursively.
5. **Stop recursion** when a dependency is:
    - Already decompiled, OR
    - A standard TIBCO/Java runtime library (`org.TIBCO.*`, `java.*`, `javax.*`), OR
    - Not found in the source folder → mark as missing dependency.

### 2.4 Decompilation Checklist

Before moving to dependency classification, confirm:
- [ ] Every JAR **referenced by flow artifacts** has been decompiled (or its source code is available)
- [ ] Every child JAR discovered inside decompiled code has also been traced recursively
- [ ] Custom transformers, message processors, and interceptors are fully understood
- [ ] Shared utility classes referenced by multiple flows are catalogued

### 2.5 Verification Gates Before "No Missing Dependencies"

You MUST pass all gates below before storing an empty `missingDependencies` array:

1. **Reference-to-artifact gate**: every non-runtime import/type referenced by flow-used classes maps to one of:
    - source code present, OR
    - decompiled JAR present, OR
    - explicit missing dependency entry.
2. **Instantiation/call-site gate**: if code contains constructor calls or casts to external types (e.g., `new CustomService()`, `(ICustomService)factory.create()`), the implementing library is mandatory.
3. **Import/type gate**: an `import` of a custom package with no resolvable artifact is NOT ignored; it must be justified as unused by symbol-level evidence or marked missing.
4. **Flow relevance gate**: unresolved dependencies in code paths executed by the analyzed flow are `migrationRelevant=true`; if they block non-stub implementation, set `severity=critical` and `blocksMigration=true`.

If any gate fails, do NOT return zero missing dependencies.

---

## 3. Source vs Decompiled Precedence

- If the source code (`.java`, `.dwl` files) for a referenced class/module is PRESENT in the scanned source folder (listed as dependency artifacts), do NOT mark it as a missing dependency — the conversion agent can use the source code directly.
- Only mark a dependency as missing when NEITHER source code NOR understandable decompiled code is available.
- Presence of a package/import reference alone does not resolve dependency status; resolution requires source/decompiled implementation availability.

---

## 4. What Counts as Missing

- JAR files whose source code is NOT found in the source folder.
- Custom TIBCO connectors (non-standard `TIBCO-plugin` dependencies) without source.
- Custom Java components (transformers, message processors, interceptors) without source.
- External RAML/OAS API specifications not present in the project.
- Mapper/XSLT modules imported from external libraries not present locally.
- Third-party connector dependencies without a Logic Apps equivalent and no source code.
- TIBCO Enterprise connectors that require specific licensing (SAP, Salesforce, etc.) — flag as needing equivalent Azure connectors.
- Configuration/certificates/connection strings needed for target environment.
- TIBCO Platform dependencies (API Manager policies, Object Store V2, CloudHub properties).

---

## 5. Classification

Each missing dependency MUST have:

| Field               | Type    | Description                                                                                  |
| ------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `id`                | string  | Unique identifier                                                                            |
| `name`              | string  | Dependency name                                                                              |
| `type`              | string  | jar/java-class/dwl-module/connector/raml/schema/api-spec/property-file/custom-code/other     |
| `origin`            | string  | standard-TIBCO-runtime/standard-TIBCO-connector/TIBCO-enterprise/third-party/custom/unknown |
| `severity`          | string  | critical/warning/info                                                                        |
| `referencedBy`      | array   | Artifact names that reference this dependency                                                |
| `reason`            | string  | Why it is needed                                                                             |
| `blocksMigration`   | boolean | True if prevents complete non-stub implementation                                            |
| `migrationRelevant` | boolean | False for build-only or design-time-only dependencies (e.g. MUnit test dependencies)         |
| `resolution`        | string  | MUST follow format: "Add the source code or binary for {name} to the migration source folder and re-run discovery." Do NOT suggest code changes or workarounds — the user must provide the missing artifact. |

Also provide: `summary` (string), `allCriticalResolved` (boolean), `counts` ({ critical, warning, info }).

### 5.1 Fail-Closed Decision Rule

When evidence is incomplete or ambiguous, default to marking the dependency as missing with appropriate severity rather than reporting full resolution.

A "no missing dependencies" conclusion is valid only when all verification gates in §2.5 pass with explicit evidence.


