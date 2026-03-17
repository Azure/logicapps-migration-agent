---
name: dependency-and-decompilation-analysis
description: Rules for discovering, decompiling, and classifying missing dependencies during flow analysis. Covers DLL decompilation with ilspycmd, source-vs-decompiled precedence, missing dependency classification, and what blocks migration.
---

# Skill: Dependency and Decompilation Analysis

> **Purpose**: Authoritative rules for discovering and classifying dependencies during flow analysis. Follow exactly.

---

## 1. DLL Discovery

Call `migration_listArtifacts` with `category="dependency"` to find all `.dll`, `.jar`, `.cs`, `.vb` files.

---

## 2. Decompilation Procedure

For each `.dll` file in the source folder:

1. Run `ilspycmd <DllPath> -o out/__decompiled__/<DllNameWithoutExtension>/` in the terminal.
2. Install first if needed: `dotnet tool install -g ilspycmd`.
3. ALWAYS use the `out/__decompiled__/` folder under the workspace root as output.
4. Read the decompiled `.cs` files to understand classes, methods, and business rules.
5. These DLLs often contain custom pipeline components, helper libraries, functoid implementations, map extension code, or shared business rules CRITICAL for the complete flow.
6. If decompilation fails (native DLL, obfuscated), mark it as a critical missing dependency.

---

## 3. Source vs Decompiled Precedence

- If the source code (`.cs`, `.vb`, `.java` files) for a referenced assembly/DLL is PRESENT in the scanned source folder (listed as dependency artifacts), do NOT mark it as a missing dependency — the conversion agent can use the source code directly.
- Only mark a dependency as missing when NEITHER source code NOR understandable decompiled code is available.

---

## 4. What Counts as Missing

- DLLs/assemblies whose source code is NOT found in the source folder.
- External schemas/maps not present.
- Custom pipeline components without source.
- Third-party libraries without Azure equivalent and no source code.
- Scripting functoid assemblies not decompilable.
- Configuration/certificates/connection strings needed for target environment.

---

## 5. Classification

Each missing dependency MUST have:

| Field               | Type    | Description                                                                            |
| ------------------- | ------- | -------------------------------------------------------------------------------------- |
| `id`                | string  | Unique identifier                                                                      |
| `name`              | string  | Dependency name                                                                        |
| `type`              | string  | dll/assembly/jar/schema/map/pipeline/orchestration/connector/library/custom-code/other |
| `origin`            | string  | standard-framework/standard-biztalk/standard-platform/third-party/custom/unknown       |
| `severity`          | string  | critical/warning/info                                                                  |
| `referencedBy`      | array   | Artifact names that reference this dependency                                          |
| `reason`            | string  | Why it is needed                                                                       |
| `blocksMigration`   | boolean | True if prevents complete non-stub implementation                                      |
| `migrationRelevant` | boolean | False for build-only or design-time-only dependencies                                  |

Also provide: `summary` (string), `allCriticalResolved` (boolean), `counts` ({ critical, warning, info }).
