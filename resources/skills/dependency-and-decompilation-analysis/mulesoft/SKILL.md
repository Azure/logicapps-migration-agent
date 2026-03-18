---
name: dependency-and-decompilation-analysis
description: Rules for discovering, analysing, and classifying missing dependencies during MuleSoft flow analysis. Covers JAR/Java decompilation, Maven dependency analysis, custom module classification, and what blocks migration.
---

# Skill: Dependency and Decompilation Analysis

> **Purpose**: Authoritative rules for discovering and classifying dependencies during MuleSoft flow analysis. Follow exactly.

---

## 1. Dependency Discovery

Call `migration_listArtifacts` with `category="dependency"` to find all `.jar`, `.java`, `.dwl`, `.xml`, `.raml`, `.properties`, `.yaml` files.

Also examine:

- `pom.xml` for Maven dependencies — especially those with `classifier=mule-plugin` (Mule connectors).
- `mule-artifact.json` for exported resources and class loader settings.
- `src/main/java/` for custom Java classes.
- `src/main/resources/` for DataWeave modules (`.dwl`), property files, and API specs.

---

## 2. Java Class / JAR Analysis Procedure

For each custom Java class or JAR file in the source:

1. If `.java` source files exist under `src/main/java/`, read them directly to understand classes, methods, and business logic.
2. For JAR files without source, attempt decompilation:
    - Run `jad <JarPath>` or `cfr <JarPath> --outputdir out/__decompiled__/<JarName>/` in the terminal.
    - Alternatively, use `jar xf <JarPath>` to extract and then decompile `.class` files.
3. ALWAYS use the `out/__decompiled__/` folder under the workspace root as output.
4. Read the decompiled `.java` files to understand classes, methods, and business rules.
5. These JARs/classes often contain custom Mule components, custom transformers, custom message processors, Java-based business logic called from MEL/DataWeave, or shared utility libraries CRITICAL for the complete flow.
6. If decompilation fails (obfuscated, native), mark it as a critical missing dependency.

---

## 3. Source vs Decompiled Precedence

- If the source code (`.java`, `.dwl` files) for a referenced class/module is PRESENT in the scanned source folder (listed as dependency artifacts), do NOT mark it as a missing dependency — the conversion agent can use the source code directly.
- Only mark a dependency as missing when NEITHER source code NOR understandable decompiled code is available.

---

## 4. What Counts as Missing

- JAR files whose source code is NOT found in the source folder.
- Custom Mule connectors (non-standard `mule-plugin` dependencies) without source.
- Custom Java components (transformers, message processors, interceptors) without source.
- External RAML/OAS API specifications not present in the project.
- DataWeave modules imported from external libraries not present locally.
- Third-party connector dependencies without a Logic Apps equivalent and no source code.
- MuleSoft Enterprise connectors that require specific licensing (SAP, Salesforce, etc.) — flag as needing equivalent Azure connectors.
- Configuration/certificates/connection strings needed for target environment.
- Anypoint Platform dependencies (API Manager policies, Object Store V2, CloudHub properties).

---

## 5. Classification

Each missing dependency MUST have:

| Field               | Type    | Description                                                                                  |
| ------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `id`                | string  | Unique identifier                                                                            |
| `name`              | string  | Dependency name                                                                              |
| `type`              | string  | jar/java-class/dwl-module/connector/raml/schema/api-spec/property-file/custom-code/other     |
| `origin`            | string  | standard-mule-runtime/standard-mule-connector/mulesoft-enterprise/third-party/custom/unknown |
| `severity`          | string  | critical/warning/info                                                                        |
| `referencedBy`      | array   | Artifact names that reference this dependency                                                |
| `reason`            | string  | Why it is needed                                                                             |
| `blocksMigration`   | boolean | True if prevents complete non-stub implementation                                            |
| `migrationRelevant` | boolean | False for build-only or design-time-only dependencies (e.g. MUnit test dependencies)         |

Also provide: `summary` (string), `allCriticalResolved` (boolean), `counts` ({ critical, warning, info }).
