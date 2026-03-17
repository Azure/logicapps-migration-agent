---
name: scaffold-logic-apps-project
description: Scaffolds the initial Logic Apps Standard project structure for migration. Contains exact files, folder layout, VS Code configuration, runtime settings, workspace file format, and workflow-designtime config for a valid, runnable project.
---

# Skill: Scaffolding a Logic Apps Standard Project for Migration

> **Purpose**: This document is a definitive reference for AI agents creating the initial scaffold project structure for a Logic Apps Standard migration. It contains the **exact files, folder structure, VS Code configuration, and runtime settings** taken from a verified working project. Following this document precisely will produce a valid, runnable Logic Apps Standard project on the first attempt.
>
> The scaffold creates the Logic App project and workspace file only. Custom code (local .NET functions) is **NOT** created during scaffolding — it is added later by a separate task using the **dotnet-local-functions-logic-apps** skill.

---

## Table of Contents

<!-- TOC - using HTML anchors to avoid markdown link validation issues -->

1. <a href="#1-overview">Overview</a>
2. <a href="#2-scaffold-output-structure">Scaffold Output Structure</a>
3. <a href="#3-naming-conventions">Naming Conventions</a>
4. <a href="#4-complete-file-reference">Complete File Reference</a>
5. <a href="#5-step-by-step-creation-guide">Step-by-Step Creation Guide</a>
6. <a href="#6-file-manifest--verification-checklist">File Manifest &amp; Verification Checklist</a>
7. <a href="#7-troubleshooting">Troubleshooting</a>

---

## 1. Overview

### What the Scaffold Creates

The scaffold produces a **ready-to-run** Logic Apps Standard workspace that:

- Opens correctly in VS Code as a multi-root workspace
- Is recognized by the Azure Logic Apps (Standard) VS Code extension
- Can run locally with Azure Functions Core Tools and Azurite
- Has all required configuration for workflow design, debugging, and deployment
- Has a placeholder for custom code functions (folder created later, not during scaffold)
- Contains empty workflow folders ready for workflow definitions to be added

### What the Scaffold Does NOT Create

- **Custom code / local .NET functions** — created later by the local functions skill
- **Workflow definitions** — `workflow.json` files are added during the conversion stage
- **Connections** — `connections.json` is created when connectors are configured
- **Build outputs** — `lib/custom/net8/` or `lib/custom/net472/` DLLs are produced by building the Functions project

### When to Use This Skill

- At the start of a migration conversion, before any workflows or custom code are generated
- When creating a new Logic Apps Standard project from scratch
- When the agent needs to set up the target project structure for BizTalk/MuleSoft/TIBCO/etc. migrations

---

## 2. Scaffold Output Structure

### 2.1 Directory Tree

```
out/
└── {workspaceName}/
    ├── {workspaceName}.code-workspace          ← VS Code multi-root workspace file
    │
    ├── {logicAppName}/                          ← Logic Apps Standard project
    │   ├── host.json                            ← Functions host configuration
    │   ├── local.settings.json                  ← Runtime settings (CRITICAL)
    │   ├── .funcignore                          ← Deployment exclusions
    │   ├── .gitignore                           ← Git ignore rules
    │   │
    │   ├── .vscode/
    │   │   ├── extensions.json                  ← Recommended VS Code extensions
    │   │   ├── launch.json                      ← Debug configuration
    │   │   ├── settings.json                    ← Logic App project settings
    │   │   └── tasks.json                       ← Build & run tasks
    │   │
    │   ├── Artifacts/                           ← Logic App artifacts
    │   │   ├── Maps/                            ← XSLT/Liquid maps (empty initially)
    │   │   ├── Rules/                           ← Business rules (empty initially)
    │   │   └── Schemas/                         ← XML/JSON schemas (empty initially)
    │   │
    │   ├── lib/
    │   │   ├── builtinOperationSdks/
    │   │   │   ├── JAR/                         ← Java SDKs (empty, runtime-managed)
    │   │   │   └── net472/                      ← .NET 472 SDKs (empty, runtime-managed)
    │   │   └── custom/                          ← Custom code outputs (populated by build later)
    │   │
    │   └── workflow-designtime/                 ← Design-time configuration
    │       ├── host.json                        ← Enables function discovery in designer
    │       └── local.settings.json              ← Design-time runtime settings
    │
    └── (Functions/)                             ← NOT created during scaffold
                                                    Created later by local functions skill
```

### 2.2 Key Points

1. **`out/` is the output root** — all scaffolded projects go under `out/`
2. **`{workspaceName}` is the workspace root** — contains the `.code-workspace` file and project folders
3. **`{logicAppName}` is the Logic App project** — fully scaffolded with all config files
4. **`Functions/` is NOT created** — it's a provision for the custom code task, created later using the local functions skill
5. **No workflow folders are created** — workflow directories (e.g., `my-workflow/workflow.json`) are added during conversion
6. **No `connections.json`** — created when connectors are configured, not during scaffold

---

## 3. Naming Conventions

### 3.1 Input Parameters

The scaffold requires these naming inputs:

| Parameter       | Description                           | Example             | Used In                                 |
| --------------- | ------------------------------------- | ------------------- | --------------------------------------- |
| `workspaceName` | Name of the workspace and root folder | `contoso-migration` | Folder name, `.code-workspace` filename |
| `logicAppName`  | Name of the Logic App project folder  | `contoso-logicapp`  | Folder name, workspace file reference   |

### 3.2 Naming Rules

- **`workspaceName`**: Use lowercase with hyphens. This becomes the folder name and the `.code-workspace` filename.
- **`logicAppName`**: Use lowercase with hyphens. This becomes the Logic App folder name and is referenced in the workspace file, launch.json, and local.settings.json.
- **No spaces** in either name — use hyphens (`-`) as separators.
- **Keep names short** — they appear in paths, debug labels, and VS Code UI.

### 3.3 Derived Values

| Derived Value        | Formula                                                    | Example                                                      |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Workspace file       | `{workspaceName}.code-workspace`                           | `contoso-migration.code-workspace`                           |
| Workspace root       | `out/{workspaceName}/`                                     | `out/contoso-migration/`                                     |
| Logic App root       | `out/{workspaceName}/{logicAppName}/`                      | `out/contoso-migration/contoso-logicapp/`                    |
| Launch config name   | `"Run/Debug logic app with local function {logicAppName}"` | `"Run/Debug logic app with local function contoso-logicapp"` |
| ProjectDirectoryPath | Absolute path to `{logicAppName}/` folder                  | `C:\projects\out\contoso-migration\contoso-logicapp`         |

---

## 4. Complete File Reference

Every file below must be created exactly as shown. Placeholders `{workspaceName}`, `{logicAppName}`, and `{absoluteLogicAppPath}` must be substituted with actual values.

### 4.1 Workspace File — `{workspaceName}.code-workspace`

```json
{
    "folders": [
        {
            "name": "{logicAppName}",
            "path": "./{logicAppName}"
        }
    ],
    "settings": {}
}
```

> **IMPORTANT**: The Logic App folder is listed **first** (and only, during scaffold). When the Functions project is added later, it will be appended as a second entry in the `folders` array. The Logic App must always remain first.

> **Note on settings**: The `settings` block can optionally include `terminal.integrated.env.windows` with a PATH to the Logic Apps DotNetSDK for local development. During scaffold, leave it as `{}`.

### 4.2 host.json

```json
{
    "version": "2.0",
    "logging": {
        "applicationInsights": {
            "samplingSettings": {
                "isEnabled": true,
                "excludedTypes": "Request"
            }
        }
    },
    "extensionBundle": {
        "id": "Microsoft.Azure.Functions.ExtensionBundle.Workflows",
        "version": "[1.*, 2.0.0)"
    }
}
```

**Key details:**

- `"version": "2.0"` — Azure Functions v2+ host
- `extensionBundle` — Uses the **Workflows** extension bundle (NOT the standard Functions bundle). This provides all the Logic Apps built-in connectors and operations.
- The bundle version range `[1.*, 2.0.0)` means any 1.x version but not 2.x

### 4.3 local.settings.json (CRITICAL)

```json
{
    "IsEncrypted": false,
    "Values": {
        "AzureWebJobsStorage": "UseDevelopmentStorage=true",
        "FUNCTIONS_INPROC_NET8_ENABLED": "1",
        "FUNCTIONS_WORKER_RUNTIME": "dotnet",
        "APP_KIND": "workflowapp",
        "AzureWebJobsFeatureFlags": "EnableMultiLanguageWorker",
        "ProjectDirectoryPath": "{absoluteLogicAppPath}",
        "WORKFLOWS_SUBSCRIPTION_ID": ""
    }
}
```

| Setting                         | Value                            | Why                                                                                                |
| ------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `AzureWebJobsStorage`           | `"UseDevelopmentStorage=true"`   | Uses Azurite for local development storage                                                         |
| `FUNCTIONS_INPROC_NET8_ENABLED` | `"1"`                            | Enables .NET 8 host for loading custom code assemblies. Required even before custom code is added. |
| `FUNCTIONS_WORKER_RUNTIME`      | `"dotnet"`                       | **NEVER** use `"dotnet-isolated"` — Logic Apps Standard always uses `"dotnet"`                     |
| `APP_KIND`                      | `"workflowapp"`                  | Identifies this as a Logic App Standard project (note: lowercase 'a' in 'app')                     |
| `AzureWebJobsFeatureFlags`      | `"EnableMultiLanguageWorker"`    | Required for custom code execution alongside the workflow engine                                   |
| `ProjectDirectoryPath`          | Absolute path to logicapp folder | Tells the runtime where to find workflow definitions. Use forward slashes or escaped backslashes.  |
| `WORKFLOWS_SUBSCRIPTION_ID`     | `""`                             | Azure subscription ID — empty for local development                                                |

> **⚠️ CRITICAL**: All these settings must be present from the start. Missing any of them will cause runtime failures when workflows or custom code are added later.

### 4.4 .vscode/extensions.json

```json
{
    "recommendations": ["ms-azuretools.vscode-azurelogicapps"]
}
```

### 4.5 .vscode/launch.json

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run/Debug logic app with local function {logicAppName}",
            "type": "logicapp",
            "request": "launch",
            "funcRuntime": "coreclr",
            "customCodeRuntime": "coreclr",
            "isCodeless": true
        }
    ]
}
```

**Key details:**

- `"type": "logicapp"` — requires the Azure Logic Apps (Standard) VS Code extension
- `"funcRuntime": "coreclr"` — Logic Apps host runtime
- `"customCodeRuntime": "coreclr"` — .NET 8 custom code runtime (default for new projects). If the project will use .NET 4.7.2 custom code, change to `"clr"`.
- `"isCodeless": true` — indicates this is a Logic Apps project (not a raw Azure Functions project)

### 4.6 .vscode/settings.json

```json
{
    "azureLogicAppsStandard.projectLanguage": "JavaScript",
    "azureLogicAppsStandard.projectRuntime": "~4",
    "debug.internalConsoleOptions": "neverOpen",
    "azureFunctions.suppressProject": true
}
```

**Key details:**

- `"azureLogicAppsStandard.projectLanguage": "JavaScript"` — This is correct even though custom code uses C#. This setting refers to the Logic Apps workflow **engine** language, not the custom code language.
- `"azureFunctions.suppressProject": true` — Prevents the Azure Functions extension from treating this as a Functions project and interfering with the Logic Apps extension.

### 4.7 .vscode/tasks.json

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "generateDebugSymbols",
            "command": "${config:azureLogicAppsStandard.dotnetBinaryPath}",
            "args": ["${input:getDebugSymbolDll}"],
            "type": "process",
            "problemMatcher": "$msCompile"
        },
        {
            "type": "shell",
            "command": "${config:azureLogicAppsStandard.funcCoreToolsBinaryPath}",
            "args": ["host", "start"],
            "options": {
                "env": {
                    "PATH": "${config:azureLogicAppsStandard.autoRuntimeDependenciesPath}\\NodeJs;${config:azureLogicAppsStandard.autoRuntimeDependenciesPath}\\DotNetSDK;$env:PATH"
                }
            },
            "problemMatcher": "$func-watch",
            "isBackground": true,
            "label": "func: host start",
            "group": {
                "kind": "build",
                "isDefault": true
            }
        }
    ],
    "inputs": [
        {
            "id": "getDebugSymbolDll",
            "type": "command",
            "command": "azureLogicAppsStandard.getDebugSymbolDll"
        }
    ]
}
```

**Key details:**

- `"generateDebugSymbols"` task — generates PDB files for debugging custom code
- `"func: host start"` task — starts the Azure Functions host, which runs the Logic App locally
- Both tasks reference `azureLogicAppsStandard.*` config paths provided by the Logic Apps extension
- The `func: host start` task sets up PATH to include NodeJs and DotNetSDK from the extension's auto-installed dependencies

### 4.8 workflow-designtime/host.json

```json
{
    "version": "2.0",
    "extensionBundle": {
        "id": "Microsoft.Azure.Functions.ExtensionBundle.Workflows",
        "version": "[1.*, 2.0.0)"
    },
    "extensions": {
        "workflow": {
            "settings": {
                "Runtime.WorkflowOperationDiscoveryHostMode": "true"
            }
        }
    }
}
```

**Purpose**: This file enables the Logic Apps **designer** to discover available operations (built-in actions, connectors, and custom functions) at design time. Without this file:

- The visual designer won't show the "Call a local function" action
- Connector discovery may not work correctly in the designer

### 4.9 workflow-designtime/local.settings.json

```json
{
    "IsEncrypted": false,
    "Values": {
        "APP_KIND": "workflowapp",
        "ProjectDirectoryPath": "{absoluteLogicAppPath}",
        "FUNCTIONS_WORKER_RUNTIME": "node",
        "AzureWebJobsSecretStorageType": "Files"
    }
}
```

**Key details:**

- `"FUNCTIONS_WORKER_RUNTIME": "node"` — This is intentionally `"node"` for design-time (NOT `"dotnet"`). The design-time host uses Node.js for operation discovery.
- `"AzureWebJobsSecretStorageType": "Files"` — Stores secrets as local files during development
- `"ProjectDirectoryPath"` — Must match the same absolute path used in the runtime `local.settings.json`

### 4.10 .funcignore

```
.debug
.git*
.vscode
__azurite_db*__.json
__blobstorage__
__queuestorage__
global.json
local.settings.json
test
workflow-designtime/
```

**Purpose**: Specifies files/folders to exclude when deploying the Logic App to Azure. These are development-only artifacts.

### 4.11 .gitignore

```
# Azure logic apps artifacts
bin
obj
appsettings.json
local.settings.json
__blobstorage__
.debug
__queuestorage__
__azurite_db*__.json

# Added folders and file patterns
workflow-designtime/

*.code-workspace
```

**Purpose**: Standard git ignore for Logic Apps projects. Note that `local.settings.json` is excluded (contains local-only settings and potentially secrets) and `workflow-designtime/` is excluded (generated/local-only).

### 4.12 Empty Directories

The following directories must be created empty (no files inside). They serve as required structural placeholders.

| Directory                          | Purpose                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `Artifacts/Maps/`                  | XSLT or Liquid transformation maps                                    |
| `Artifacts/Rules/`                 | Business rules files                                                  |
| `Artifacts/Schemas/`               | XML (XSD) or JSON schemas                                             |
| `lib/builtinOperationSdks/JAR/`    | Java-based built-in operation SDKs (runtime-managed)                  |
| `lib/builtinOperationSdks/net472/` | .NET 4.7.2 built-in operation SDKs (runtime-managed)                  |
| `lib/custom/`                      | Custom code build outputs — populated when Functions project is built |

> **⚠️ CRITICAL — ALL empty directories MUST be truly empty (no `.gitkeep`, no files).**
> Do **NOT** put `.gitkeep` or any other file in any of these directories. For `lib/builtinOperationSdks/JAR/` and `lib/builtinOperationSdks/net472/`, the Azure Functions runtime detects non-empty folders and attempts to load Java (JdbcJavaTriggerFunction) and .NET Framework (NetFxLanguageWorkerFunction) workers. If JAVA_HOME is not set or the workers fail to initialize, the .NET 8 worker also fails — causing `InvokeFunction` to error with "function does not exist". For `Artifacts/Maps/`, `Artifacts/Rules/`, `Artifacts/Schemas/`, and `lib/custom/`, `.gitkeep` files are unnecessary and should not be added.

> **Tip for agents**: To create empty directories, use the filesystem API to create the directory directly (e.g., `mkdir -p` or `fs.mkdirSync`). Do **NOT** place `.gitkeep` or any placeholder file in any scaffold directory.

---

## 5. Step-by-Step Creation Guide

### Step 1: Determine Names

Determine the `workspaceName` and `logicAppName` from the migration context:

- `workspaceName`: Typically derived from the source project name or the migration task name (e.g., `contoso-order-processing`)
- `logicAppName`: Typically the target Logic App name (e.g., `contoso-logicapp` or `order-processing-logicapp`)

### Step 2: Compute the Absolute Path

Compute `{absoluteLogicAppPath}` — the full absolute path to the Logic App folder:

```
{outputRoot}\{workspaceName}\{logicAppName}
```

Example: `C:\projects\out\contoso-migration\contoso-logicapp`

This path is used in `local.settings.json` and `workflow-designtime/local.settings.json`.

### Step 3: Create Workspace File

Create `out/{workspaceName}/{workspaceName}.code-workspace` (see §4.1)

### Step 4: Create Logic App Config Files

Create these files in `out/{workspaceName}/{logicAppName}/`:

| #   | File                  | Reference |
| --- | --------------------- | --------- |
| 1   | `host.json`           | §4.2      |
| 2   | `local.settings.json` | §4.3      |
| 3   | `.funcignore`         | §4.10     |
| 4   | `.gitignore`          | §4.11     |

### Step 5: Create .vscode/ Files

Create these files in `out/{workspaceName}/{logicAppName}/.vscode/`:

| #   | File              | Reference |
| --- | ----------------- | --------- |
| 5   | `extensions.json` | §4.4      |
| 6   | `launch.json`     | §4.5      |
| 7   | `settings.json`   | §4.6      |
| 8   | `tasks.json`      | §4.7      |

### Step 6: Create workflow-designtime/ Files

Create these files in `out/{workspaceName}/{logicAppName}/workflow-designtime/`:

| #   | File                  | Reference |
| --- | --------------------- | --------- |
| 9   | `host.json`           | §4.8      |
| 10  | `local.settings.json` | §4.9      |

### Step 7: Create Empty Directories

Create these empty directories under `out/{workspaceName}/{logicAppName}/`:

| #   | Directory                          |
| --- | ---------------------------------- |
| 11  | `Artifacts/Maps/`                  |
| 12  | `Artifacts/Rules/`                 |
| 13  | `Artifacts/Schemas/`               |
| 14  | `lib/builtinOperationSdks/JAR/`    |
| 15  | `lib/builtinOperationSdks/net472/` |
| 16  | `lib/custom/`                      |

### Step 8: Verify

Verify the scaffold by checking:

- [ ] All 10 files exist with correct content
- [ ] All 6 empty directories exist
- [ ] `local.settings.json` has the correct `ProjectDirectoryPath`
- [ ] `workflow-designtime/local.settings.json` has the correct `ProjectDirectoryPath`
- [ ] Workspace file references the `{logicAppName}` folder correctly

---

## 6. File Manifest & Verification Checklist

### Complete File List (10 files + 6 empty directories)

| #   | Relative Path (from workspace root)                      | Type      | Template?                      |
| --- | -------------------------------------------------------- | --------- | ------------------------------ |
| 1   | `{workspaceName}.code-workspace`                         | File      | Yes — `{logicAppName}`         |
| 2   | `{logicAppName}/host.json`                               | File      | No — static content            |
| 3   | `{logicAppName}/local.settings.json`                     | File      | Yes — `{absoluteLogicAppPath}` |
| 4   | `{logicAppName}/.funcignore`                             | File      | No — static content            |
| 5   | `{logicAppName}/.gitignore`                              | File      | No — static content            |
| 6   | `{logicAppName}/.vscode/extensions.json`                 | File      | No — static content            |
| 7   | `{logicAppName}/.vscode/launch.json`                     | File      | Yes — `{logicAppName}`         |
| 8   | `{logicAppName}/.vscode/settings.json`                   | File      | No — static content            |
| 9   | `{logicAppName}/.vscode/tasks.json`                      | File      | No — static content            |
| 10  | `{logicAppName}/workflow-designtime/host.json`           | File      | No — static content            |
| 11  | `{logicAppName}/workflow-designtime/local.settings.json` | File      | Yes — `{absoluteLogicAppPath}` |
| 12  | `{logicAppName}/Artifacts/Maps/`                         | Empty Dir | —                              |
| 13  | `{logicAppName}/Artifacts/Rules/`                        | Empty Dir | —                              |
| 14  | `{logicAppName}/Artifacts/Schemas/`                      | Empty Dir | —                              |
| 15  | `{logicAppName}/lib/builtinOperationSdks/JAR/`           | Empty Dir | —                              |
| 16  | `{logicAppName}/lib/builtinOperationSdks/net472/`        | Empty Dir | —                              |
| 17  | `{logicAppName}/lib/custom/`                             | Empty Dir | —                              |

### Verification Checklist

- [ ] **Workspace file** exists at `out/{workspaceName}/{workspaceName}.code-workspace`
- [ ] **Workspace file** `folders` array contains the Logic App folder with correct name and path
- [ ] **host.json** has `extensionBundle` with `Microsoft.Azure.Functions.ExtensionBundle.Workflows`
- [ ] **local.settings.json** has ALL 7 required settings:
    - `AzureWebJobsStorage`
    - `FUNCTIONS_INPROC_NET8_ENABLED`
    - `FUNCTIONS_WORKER_RUNTIME` = `"dotnet"`
    - `APP_KIND` = `"workflowapp"`
    - `AzureWebJobsFeatureFlags` = `"EnableMultiLanguageWorker"`
    - `ProjectDirectoryPath` (absolute path)
    - `WORKFLOWS_SUBSCRIPTION_ID`
- [ ] **launch.json** has `"type": "logicapp"` and `"customCodeRuntime": "coreclr"`
- [ ] **settings.json** has `"azureFunctions.suppressProject": true`
- [ ] **workflow-designtime/host.json** has `Runtime.WorkflowOperationDiscoveryHostMode` = `"true"`
- [ ] **workflow-designtime/local.settings.json** has `FUNCTIONS_WORKER_RUNTIME` = `"node"` (design-time!)
- [ ] **All 6 empty directories** exist
- [ ] **No `Functions/` folder** exists (created later by local functions task)
- [ ] **No workflow folders** exist (created during conversion)
- [ ] **No `connections.json`** exists (created when connectors are configured)

---

## 7. Troubleshooting

### Common Scaffold Issues

| Issue                                                 | Cause                                                               | Fix                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Logic Apps extension doesn't recognize project        | Missing `APP_KIND` in local.settings.json                           | Add `"APP_KIND": "workflowapp"`                                                          |
| Designer shows no operations                          | Missing `workflow-designtime/` folder                               | Create `workflow-designtime/host.json` with `Runtime.WorkflowOperationDiscoveryHostMode` |
| F5 debugging fails                                    | Missing `launch.json` or wrong `type`                               | Ensure `"type": "logicapp"` in launch.json                                               |
| "Not a Functions project" warning                     | `azureFunctions.suppressProject` not set                            | Add `"azureFunctions.suppressProject": true` to `.vscode/settings.json`                  |
| Storage errors on run                                 | `AzureWebJobsStorage` missing or Azurite not running                | Ensure `"UseDevelopmentStorage=true"` and start Azurite                                  |
| Workflows not found                                   | `ProjectDirectoryPath` incorrect                                    | Set to the correct absolute path of the Logic App folder                                 |
| Custom code not discovered later                      | `AzureWebJobsFeatureFlags` missing                                  | Add `"EnableMultiLanguageWorker"` from the start                                         |
| Workspace doesn't open correctly                      | `.code-workspace` file malformed                                    | Ensure `folders[0].path` matches the Logic App folder name                               |
| `InvokeFunction` fails with "function does not exist" | `.gitkeep` or files in `lib/builtinOperationSdks/JAR/` or `net472/` | Remove ALL files from those directories — they must be truly empty. See §4.12 warning.   |

### Post-Scaffold: Adding Workflows

After scaffolding, workflows are added by creating folders under the Logic App root:

```
{logicAppName}/
├── my-workflow/
│   └── workflow.json
├── another-workflow/
│   └── workflow.json
```

Each workflow is a subfolder containing a single `workflow.json` file. See the Logic Apps workflow schema for `workflow.json` structure.

### Post-Scaffold: Adding Custom Code

When custom code is needed, use the **dotnet-local-functions-logic-apps** skill to:

1. Create the `Functions/` project as a sibling folder
2. Add the Functions folder to the workspace file's `folders` array
3. Build the Functions project to populate `lib/custom/`

The workspace file will be updated from:

```json
{
    "folders": [{ "name": "{logicAppName}", "path": "./{logicAppName}" }]
}
```

To:

```json
{
    "folders": [
        { "name": "{logicAppName}", "path": "./{logicAppName}" },
        { "name": "Functions", "path": "./Functions" }
    ]
}
```

### Post-Scaffold: Adding Connections

When connectors (e.g., Service Bus, SQL, HTTP) are used in workflows, a `connections.json` file is created at the Logic App root:

```
{logicAppName}/
├── connections.json      ← Created when connectors are configured
├── host.json
├── local.settings.json
└── ...
```

---

## 8. Quick Reference Card

```
┌──────────────────────────────────────────────────────────────────────┐
│     Logic Apps Standard — Scaffold Project Structure                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  OUTPUT:                                                             │
│    out/{workspaceName}/                                              │
│    ├── {workspaceName}.code-workspace                                │
│    └── {logicAppName}/                                               │
│        ├── host.json                                                 │
│        ├── local.settings.json         ← 7 required settings        │
│        ├── .funcignore                                               │
│        ├── .gitignore                                                │
│        ├── .vscode/                    ← 4 files                    │
│        ├── Artifacts/{Maps,Rules,Schemas}/                           │
│        ├── lib/{builtinOperationSdks,custom}/                        │
│        └── workflow-designtime/        ← 2 files                    │
│                                                                      │
│  TOTAL: 10 files + 6 empty directories                               │
│                                                                      │
│  PLACEHOLDERS TO SUBSTITUTE:                                         │
│    {workspaceName}      → workspace folder + filename                │
│    {logicAppName}       → Logic App folder name                      │
│    {absoluteLogicAppPath} → full path to logicapp folder             │
│                                                                      │
│  CRITICAL SETTINGS (local.settings.json):                            │
│    FUNCTIONS_WORKER_RUNTIME     = "dotnet"                           │
│    FUNCTIONS_INPROC_NET8_ENABLED = "1"                               │
│    APP_KIND                     = "workflowapp"                      │
│    AzureWebJobsFeatureFlags     = "EnableMultiLanguageWorker"        │
│    AzureWebJobsStorage          = "UseDevelopmentStorage=true"       │
│                                                                      │
│  NOT CREATED IN SCAFFOLD:                                            │
│    ✗ Functions/ project    (added later by custom code task)         │
│    ✗ workflow.json files   (added during conversion)                 │
│    ✗ connections.json      (added when connectors configured)        │
│                                                                      │
│  DESIGN-TIME:                                                        │
│    workflow-designtime/host.json must have:                           │
│      Runtime.WorkflowOperationDiscoveryHostMode = "true"             │
│    workflow-designtime/local.settings.json must have:                 │
│      FUNCTIONS_WORKER_RUNTIME = "node" (NOT "dotnet"!)               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Document Metadata

| Field                | Value                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Created**          | 2026-03-12                                                                                                             |
| **Source**           | Verified working project: Q:\LAWorkspace\net8-customcode-workspace                                                     |
| **Related Skills**   | **dotnet-local-functions-logic-apps** (for adding custom code post-scaffold)                                           |
| **Verified Against** | Azure Functions Core Tools v4, Extension Bundle Workflows [1.\*, 2.0.0), Azure Logic Apps (Standard) VS Code extension |
| **Applicable To**    | Logic Apps Standard (single-tenant), VS Code development, local + cloud deployment                                     |
