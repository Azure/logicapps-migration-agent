---
name: dependency-and-decompilation-analysis
description: Rules for discovering, decompiling, and classifying missing dependencies during flow analysis. Covers DLL decompilation with ilspycmd, source-vs-decompiled precedence, missing dependency classification, and what blocks migration.
---

# Skill: Dependency and Decompilation Analysis

> **Purpose**: Authoritative rules for discovering, decompiling, and classifying missing dependencies during flow analysis. Follow exactly.

---

## 1. DLL Discovery

Call `migration_listArtifacts` with `category="custom-code"` to find all `.dll`, `.jar`, `.cs`, `.vb` files.

### 1.1 Mandatory Coverage Guardrails [**NO FALSE NEGATIVES**]

1. Build the dependency candidate list from **artifact inventory and source references**, not from a root-folder file loop.
2. Do NOT assume "all root `.dll` files were decompiled" means dependency analysis is complete.
3. Treat any assembly/namespace referenced by flow-used code as a dependency candidate until explicitly resolved.
4. If a referenced assembly cannot be located in scanned source artifacts, mark it missing (fail-closed).

Anti-pattern to avoid:

- Running `Get-ChildItem -Filter *.dll` only at workspace root and concluding dependency closure from that result.

---

## 2. Decompilation Procedure

### 2.1 When to Decompile

Do NOT blindly decompile every `.dll` in the source folder. Instead, decompile **on demand** when a DLL reference is encountered during analysis:

- An orchestration references a .NET helper class in a DLL
- A map uses a scripting functoid that calls into a DLL
- A custom pipeline component lives in a DLL
- A binding references an assembly not available as source code

### 2.2 How to Decompile

When you decide a DLL needs decompilation:

1. Run `ilspycmd <DllPath> -o out/__decompiled__/<DllNameWithoutExtension>/` in the terminal.
2. Install first if needed: `dotnet tool install -g ilspycmd`.
3. ALWAYS write decompilation output to `out/__decompiled__/` in the **current migration workspace directory**. NEVER write to the source folder, extracted MSI folder, or any other external location.
4. Read the decompiled `.cs` files to understand classes, methods, and business rules.
5. If decompilation fails (native DLL, obfuscated), mark it as a critical missing dependency.

### 2.3 Recursive Dependency Tree Resolution [**IMPORTANT**]

After decompiling a DLL, inspect what IT depends on and **walk the full tree**:

1. **Read the decompiled code** — look for `using` directives, type references, method calls, and base class inheritance that reference other assemblies.
2. **For each referenced assembly**, check if it exists in the source folder (as `.dll`, `.cs`, or `.csproj`).
3. **If it is a `.dll` in the source folder but not yet decompiled** — decompile it too (repeat from §2.2).
4. **If that child DLL itself references more DLLs** — continue recursively.
5. **Stop recursion** when a dependency is:
    - Already decompiled, OR
    - A standard framework/BizTalk assembly (`System.*`, `Microsoft.BizTalk.*`, `Microsoft.XLANGs.*`), OR
    - Not found in the source folder → mark as missing dependency.

This ensures the entire dependency tree is resolved, not just the top-level DLL.

### 2.4 Decompilation Checklist

Before moving to dependency classification, confirm:

- [ ] Every DLL **referenced by flow artifacts** has been decompiled (or its source code is available)
- [ ] Every child DLL discovered inside decompiled code has also been traced recursively
- [ ] Helper/utility libraries (e.g., `XmlHelper`, `ResourceHelper`, domain classes) are fully decompiled and their public APIs are understood
- [ ] Custom pipeline components are identified and their `Execute`/`Disassemble`/`GetNext` methods are read
- [ ] Shared domain model classes referenced by multiple orchestrations are catalogued

### 2.5 Verification Gates Before "No Missing Dependencies"

You MUST pass all gates below before storing an empty `missingDependencies` array:

1. **Reference-to-artifact gate**: every non-framework namespace/type referenced by flow-used classes maps to one of:
    - source code present, OR
    - decompiled assembly present, OR
    - explicit missing dependency entry.
2. **Instantiation/call-site gate**: if code contains constructor calls or casts to external repo/service types (e.g., `new XRepositorio()`, `(IXRepositorio)new XRepositorio()`), the implementing assembly is mandatory.
3. **Using/type gate**: a `using` or type reference to a custom namespace with no resolvable artifact is NOT ignored; it must be justified as unused by symbol-level evidence or marked missing.
4. **Flow relevance gate**: unresolved dependencies in code paths executed by the analyzed flow are `migrationRelevant=true`; if they block non-stub implementation, set `severity=critical` and `blocksMigration=true`.

If any gate fails, do NOT return zero missing dependencies.

---

## 3. Source vs Decompiled Precedence

- If the source code (`.cs`, `.vb`, `.java` files) for a referenced assembly/DLL is PRESENT in the scanned source folder (listed as dependency artifacts), do NOT mark it as a missing dependency — the conversion agent can use the source code directly.
- If the `.dll` was decompiled successfully and the decompiled code is readable, do NOT mark it as missing — include the decompiled code location in the `resolution` field.
- Only mark a dependency as missing when NEITHER source code NOR understandable decompiled code is available.
- Presence of a namespace reference alone does not resolve dependency status; resolution requires source/decompiled implementation availability.

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

| Field               | Type    | Description                                                                                                                                                                                                  |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                | string  | Unique identifier                                                                                                                                                                                            |
| `name`              | string  | Dependency name                                                                                                                                                                                              |
| `type`              | string  | dll/assembly/jar/schema/map/pipeline/orchestration/connector/library/custom-code/other                                                                                                                       |
| `origin`            | string  | standard-framework/standard-biztalk/standard-platform/third-party/custom/unknown                                                                                                                             |
| `severity`          | string  | critical/warning/info                                                                                                                                                                                        |
| `referencedBy`      | array   | Artifact names that reference this dependency                                                                                                                                                                |
| `reason`            | string  | Why it is needed                                                                                                                                                                                             |
| `blocksMigration`   | boolean | True if prevents complete non-stub implementation                                                                                                                                                            |
| `migrationRelevant` | boolean | False for build-only or design-time-only dependencies                                                                                                                                                        |
| `resolution`        | string  | MUST follow format: "Add the source code or binary for {name} to the migration source folder and re-run discovery." Do NOT suggest code changes or workarounds — the user must provide the missing artifact. |

Also provide: `summary` (string), `allCriticalResolved` (boolean), `counts` ({ critical, warning, info }).

### 5.1 Fail-Closed Decision Rule

When evidence is incomplete or ambiguous, default to marking the dependency as missing with appropriate severity rather than reporting full resolution.

A "no missing dependencies" conclusion is valid only when all verification gates in §2.5 pass with explicit evidence.
