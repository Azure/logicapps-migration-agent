---
name: dotnet-local-functions-logic-apps
description: Creates .NET local functions (custom code) for Azure Logic Apps Standard. Covers exact NuGet packages, namespaces, csproj, MSBuild targets, VS Code config, function.json, and workflow InvokeFunction patterns for both .NET 8 and .NET Framework 4.7.2.
---

# Skill: Creating .NET Local Functions for Azure Logic Apps Standard

> **Purpose**: This document is a definitive reference for AI agents generating .NET local functions (custom code) that run inside Azure Logic Apps Standard workflows. It contains the **exact files, folder structure, NuGet packages, MSBuild targets, VS Code configuration, and workflow invocation patterns** taken from verified working projects. Following this document precisely will produce a working project on the first attempt.
>
> **Two approaches are documented**: .NET Framework 4.7.2 (legacy, in-process) and .NET 8 (modern, recommended). Both use the same workspace layout pattern. Pick one based on your needs.

---

## Table of Contents

<!-- TOC - using HTML anchors to avoid markdown link validation issues -->

1. <a href="#1-overview">Overview</a>
2. <a href="#2-architecture--workspace-layout-both-approaches">Architecture &amp; Workspace Layout (Both Approaches)</a>
3. <a href="#3-critical-nuget-package-information">Critical NuGet Package Information</a>
4. <a href="#4-approach-a--net-8-recommended">Approach A — .NET 8 (RECOMMENDED)</a>
5. <a href="#5-approach-b--net-framework-472-legacy">Approach B — .NET Framework 4.7.2 (Legacy)</a>
6. <a href="#6-shared-logic-app-project-files-both-approaches">Shared Logic App Project Files (Both Approaches)</a>
7. <a href="#7-calling-custom-code-from-workflowjson">Calling Custom Code from workflow.json</a>
8. <a href="#8-functionjson-reference">function.json Reference</a>
9. <a href="#9-building-and-running-locally">Building and Running Locally</a>
10. <a href="#10-supported-parameter--return-types">Supported Parameter &amp; Return Types</a>
11. <a href="#11-verification-checklists">Verification Checklists</a>
12. <a href="#12-troubleshooting-guide">Troubleshooting Guide</a>
13. <a href="#13-complete-working-examples">Complete Working Examples</a>
14. <a href="#14-quick-reference-card">Quick Reference Card</a>
15. <a href="#15-step-by-step-creation-guide-for-agents">Step-by-Step Creation Guide for Agents</a>

---

## 1. Overview

Logic Apps Standard supports calling custom .NET code directly from workflows using the **"Call a local function in this logic app"** built-in action (`InvokeFunction` type). The .NET code runs alongside the Logic Apps runtime — no separate Azure Function hosting is needed.

### When to Use

- Porting MuleSoft custom Java components, complex DataWeave logic, or MEL expressions to .NET
- Custom business logic (calculations, transformations, validations)
- XML/JSON document construction using System.Xml or System.Text.Json
- Any scenario where built-in Logic Apps actions/expressions are insufficient

### When NOT to Use

- Processes that take more than 10 minutes
- Large message/data transformations (use Data Mapper instead)
- Complex batching/debatching
- MuleSoft streaming transformations or large payload processing

### Which Approach to Choose

| Factor                        | .NET Framework 4.7.2 (`net472`)               | .NET 8 (`net8`)                               |
| ----------------------------- | --------------------------------------------- | --------------------------------------------- |
| **Status**                    | Legacy — still works                          | **Recommended** — modern path                 |
| **Worker model**              | In-process (classic)                          | Isolated worker                               |
| **Function attribute**        | `[FunctionName("...")]`                       | `[Function("...")]`                           |
| **Using for function attr**   | `Microsoft.Azure.WebJobs`                     | `Microsoft.Azure.Functions.Worker`            |
| **Build output folder**       | `lib/custom/net472/`                          | `lib/custom/net8/`                            |
| **function.json Language**    | `"net472"`                                    | `"net8"`                                      |
| **VS Code customCodeRuntime** | `"clr"`                                       | `"coreclr"`                                   |
| **Project layout**            | **Sibling** `Functions/` and LogicApp folders | **Sibling** `Functions/` and LogicApp folders |
| **Best for**                  | Quick ports of existing .NET Framework code   | Production projects, CI/CD, new development   |

---

## 2. Architecture & Workspace Layout (Both Approaches)

> **CRITICAL**: Both .NET 8 and .NET 4.7.2 use the **same workspace layout pattern** — the Functions project and Logic App project are **sibling folders** with a `.code-workspace` file at the root. The Functions project is **NOT** nested inside the Logic App.

### 2.1 Complete Directory Structure

```
<workspace-root>/
├── <workspace-name>.code-workspace       ← VS Code workspace file
│
├── Functions/                             ← .NET function project (sibling)
│   ├── Functions.csproj                   ← Project file with MSBuild auto-deploy targets
│   ├── <FunctionName>.cs                  ← One or more C# function files
│   └── .vscode/
│       ├── extensions.json
│       ├── settings.json
│       └── tasks.json
│
└── <logicapp-name>/                       ← Logic Apps Standard project (sibling)
    ├── host.json                          ← Functions host configuration
    ├── local.settings.json                ← Runtime settings (CRITICAL)
    ├── .funcignore                        ← Files to exclude from deployment
    ├── .gitignore                         ← Git ignore rules
    │
    ├── .vscode/
    │   ├── extensions.json
    │   ├── launch.json                    ← Debug configuration (CRITICAL: customCodeRuntime differs!)
    │   ├── settings.json
    │   └── tasks.json
    │
    ├── lib/
    │   └── custom/                        ← Build outputs auto-copied here
    │       ├── <FunctionName>/            ← Contains function.json (auto-generated)
    │       │   └── function.json
    │       └── net8/ OR net472/           ← Contains DLLs (auto-copied by build)
    │           ├── Functions.dll
    │           ├── Functions.pdb
    │           └── (dependency DLLs)
    │
    ├── <workflow-name>/                   ← One or more workflow folders
    │   └── workflow.json
    │
    └── workflow-designtime/               ← Design-time configuration
        ├── host.json
        └── local.settings.json
```

### 2.2 Key Structural Rules

1. **Functions/ and LogicApp are siblings** — they sit next to each other under the workspace root
2. **The workspace file references both folders** — so VS Code opens them as a multi-root workspace
3. **Build auto-deploys** — MSBuild targets in the `.csproj` copy DLLs and `function.json` to `lib/custom/`
4. **`lib/custom/` is the bridge** — DLLs go in `lib/custom/net8/` or `lib/custom/net472/`, function metadata goes in `lib/custom/<FunctionName>/function.json`
5. **workflow-designtime/** is required — it enables the Logic Apps designer to discover custom functions

---

## 3. Critical NuGet Package Information

### ⚠️ THE #1 MISTAKE: Wrong Package Name

| What you might guess                             | Exists on NuGet? | Correct? |
| ------------------------------------------------ | ---------------- | -------- |
| `Microsoft.Azure.Functions.Extensions.Workflows` | **NO** ❌        | ❌       |
| `Microsoft.Azure.Workflows.WebJobs.Sdk`          | **YES** ✅       | ✅       |

**Why this is confusing**: The NuGet _package ID_ is `Microsoft.Azure.Workflows.WebJobs.Sdk`, but the _DLL_ inside the package is named `Microsoft.Azure.Functions.Extensions.Workflows.Sdk.dll`, and the _namespace_ for the `WorkflowActionTrigger` attribute is `Microsoft.Azure.Functions.Extensions.Workflows`. Three different naming conventions for the same thing.

### ⚠️ THE #2 MISTAKE: Wrong Namespace in Using Statements

| Using statement                                         | Compiles?  | Correct? |
| ------------------------------------------------------- | ---------- | -------- |
| `using Microsoft.Azure.Workflows.WebJobs.Sdk;`          | **NO** ❌  | ❌       |
| `using Microsoft.Azure.Functions.Extensions.Workflows;` | **YES** ✅ | ✅       |

**Both approaches use the same `[WorkflowActionTrigger]` attribute from the same namespace**. The difference is the function declaration attribute and its associated packages.

### Package Verification Command

```bash
dotnet package search "Microsoft.Azure.Workflows" --take 5
# Expected result: Microsoft.Azure.Workflows.WebJobs.Sdk
```

---

## 4. Approach A — .NET 8 (RECOMMENDED)

### 4.1 Project File (`Functions/Functions.csproj`)

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <TargetFramework>net8</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Library</OutputType>
    <PlatformTarget>AnyCPU</PlatformTarget>
    <LogicAppFolderToPublish>$(MSBuildProjectDirectory)\..\my-logicapp</LogicAppFolderToPublish>
    <CopyToOutputDirectory>Always</CopyToOutputDirectory>
    <SelfContained>false</SelfContained>
 </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.Abstractions" Version="1.3.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Sdk" Version="1.15.1" />
    <PackageReference Include="Microsoft.Azure.Workflows.Webjobs.Sdk" Version="1.2.0" />
    <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="6.0.0" />
    <PackageReference Include="Microsoft.Extensions.Logging" Version="6.0.0" />
  </ItemGroup>

  <Target Name="TriggerPublishOnBuild" AfterTargets="Build">
      <CallTarget Targets="Publish" />
  </Target>
</Project>
```

### 4.2 Critical csproj Details — .NET 8

| Property/Element               | Value                                       | Why It Matters                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<TargetFramework>`            | `net8`                                      | Must be `net8` — NOT `net8.0` (Logic Apps convention)                                                                                                                                                    |
| `<AzureFunctionsVersion>`      | `v4`                                        | Required for Azure Functions v4 runtime                                                                                                                                                                  |
| `<OutputType>`                 | `Library`                                   | Functions are libraries, not executables                                                                                                                                                                 |
| `<PlatformTarget>`             | `AnyCPU`                                    | Standard target for .NET 8                                                                                                                                                                               |
| `<LogicAppFolderToPublish>`    | `$(MSBuildProjectDirectory)\..\my-logicapp` | **Absolute path** to the sibling Logic App folder — the Publish target uses this to know where to deploy outputs. Replace `my-logicapp` with your Logic App folder name.                                 |
| `<SelfContained>`              | `false`                                     | Must NOT be self-contained — Logic Apps runtime provides the host                                                                                                                                        |
| `TriggerPublishOnBuild` target | Calls `Publish` AfterTargets `Build`        | **This is the auto-deploy mechanism** — on every build, the Publish target automatically copies DLLs to `lib/custom/net8/` and function.json to `lib/custom/<FunctionName>/` inside the Logic App folder |

> **IMPORTANT**: The .NET 8 approach uses a simple `TriggerPublishOnBuild` target that calls `Publish`. The Publish target (from the Worker SDK) handles all file copying automatically. You do NOT need manual copy targets.

### 4.3 Required Packages — .NET 8

| Package                                                    | Version | Why It's Needed                                            |
| ---------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `Microsoft.Azure.Functions.Worker.Extensions.Abstractions` | 1.3.0   | Isolated worker abstractions                               |
| `Microsoft.Azure.Functions.Worker.Sdk`                     | 1.15.1  | Worker SDK — generates `function.json` and handles Publish |
| `Microsoft.Azure.Workflows.Webjobs.Sdk`                    | 1.2.0   | Provides `[WorkflowActionTrigger]` attribute               |
| `Microsoft.Extensions.Logging.Abstractions`                | 6.0.0   | Provides `ILogger<T>`, `ILoggerFactory`                    |
| `Microsoft.Extensions.Logging`                             | 6.0.0   | Logging infrastructure                                     |

### 4.4 Function Code — .NET 8

```csharp
//------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
//------------------------------------------------------------

namespace <YourNamespace>
{
    using System;
    using System.Collections.Generic;
    using System.Threading.Tasks;
    using Microsoft.Azure.Functions.Extensions.Workflows;  // [WorkflowActionTrigger]
    using Microsoft.Azure.Functions.Worker;                 // [Function] — NOT [FunctionName]!
    using Microsoft.Extensions.Logging;

    /// <summary>
    /// Represents the <FunctionName> flow invoked function.
    /// </summary>
    public class <ClassName>
    {
        private readonly ILogger<<ClassName>> logger;

        public <ClassName>(ILoggerFactory loggerFactory)
        {
            logger = loggerFactory.CreateLogger<<ClassName>>();
        }

        /// <summary>
        /// Executes the logic app workflow action.
        /// </summary>
        [Function("<FunctionName>")]                    // ← [Function], NOT [FunctionName]
        public Task<<ResultType>> Run(
            [WorkflowActionTrigger] <type> param1, <type> param2)
        {
            this.logger.LogInformation("Starting <FunctionName>: " + param1);

            var result = new <ResultType>()
            {
                // Set properties...
            };

            return Task.FromResult(result);
        }

        /// <summary>
        /// Result model — properties become accessible in workflow via @body('ActionName')?['PropertyName']
        /// </summary>
        public class <ResultType>
        {
            public <type> Property1 { get; set; }
            public <type> Property2 { get; set; }
        }
    }
}
```

### 4.5 Key Using Statements — .NET 8

```csharp
using Microsoft.Azure.Functions.Extensions.Workflows;  // [WorkflowActionTrigger] — same for both approaches
using Microsoft.Azure.Functions.Worker;                 // [Function("...")] — .NET 8 ONLY
using Microsoft.Extensions.Logging;                     // ILogger<T>, ILoggerFactory
```

### 4.6 Functions/.vscode/ Files — .NET 8

**Functions/.vscode/extensions.json**

```json
{
    "recommendations": ["ms-azuretools.vscode-azurefunctions", "ms-dotnettools.csharp"]
}
```

**Functions/.vscode/settings.json**

```json
{
    "azureFunctions.deploySubpath": "bin/Release/net8/publish",
    "azureFunctions.projectLanguage": "C#",
    "azureFunctions.projectRuntime": "~4",
    "debug.internalConsoleOptions": "neverOpen",
    "azureFunctions.preDeployTask": "publish (functions)",
    "azureFunctions.templateFilter": "Core",
    "azureFunctions.showTargetFrameworkWarning": false,
    "azureFunctions.projectSubpath": "bin\\Release\\net8\\publish"
}
```

**Functions/.vscode/tasks.json**

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "build",
            "command": "${config:azureLogicAppsStandard.dotnetBinaryPath}",
            "type": "process",
            "args": ["build", "${workspaceFolder}"],
            "group": {
                "kind": "build",
                "isDefault": true
            }
        }
    ]
}
```

---

## 5. Approach B — .NET Framework 4.7.2 (Legacy)

### 5.1 Project File (`Functions/Functions.csproj`)

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <TargetFramework>net472</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Library</OutputType>
    <PlatformTarget>x64</PlatformTarget>
    <LogicAppFolder>my-logicapp</LogicAppFolder>
    <CopyToOutputDirectory>Always</CopyToOutputDirectory>
 </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.WebJobs.Core" Version="3.0.39" />
    <PackageReference Include="Microsoft.Azure.Workflows.WebJobs.Sdk" Version="1.1.0" />
    <PackageReference Include="Microsoft.NET.Sdk.Functions" Version="4.2.0" />
    <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="2.1.1" />
    <PackageReference Include="Microsoft.Extensions.Logging" Version="2.1.1" />
  </ItemGroup>

  <Target Name="Task" AfterTargets="Compile">
    <ItemGroup>
        <DirsToClean2 Include="..\$(LogicAppFolder)\lib\custom" />
      </ItemGroup>
      <RemoveDir Directories="@(DirsToClean2)" />
  </Target>

  <Target Name="CopyExtensionFiles" AfterTargets="ParameterizedFunctionJsonGenerator">
    <ItemGroup>
        <CopyFiles Include="$(MSBuildProjectDirectory)\bin\$(Configuration)\net472\**\*.*" CopyToOutputDirectory="PreserveNewest" Exclude="$(MSBuildProjectDirectory)\bin\$(Configuration)\net472\*.*" />
        <CopyFiles2 Include="$(MSBuildProjectDirectory)\bin\$(Configuration)\net472\*.*" />
    </ItemGroup>
    <Copy SourceFiles="@(CopyFiles)" DestinationFolder="..\$(LogicAppFolder)\lib\custom\%(RecursiveDir)" SkipUnchangedFiles="true" />
    <Copy SourceFiles="@(CopyFiles2)" DestinationFolder="..\$(LogicAppFolder)\lib\custom\net472\" SkipUnchangedFiles="true" />
    <ItemGroup>
        <MoveFiles Include="..\$(LogicAppFolder)\lib\custom\bin\*.*" />
    </ItemGroup>
    <Move SourceFiles="@(MoveFiles)" DestinationFolder="..\$(LogicAppFolder)\lib\custom\net472" />
    <ItemGroup>
       <DirsToClean Include="..\$(LogicAppFolder)\lib\custom\bin" />
     </ItemGroup>
       <RemoveDir Directories="@(DirsToClean)" />
  </Target>

  <ItemGroup>
      <Reference Include="Microsoft.CSharp" />
  </ItemGroup>
  <ItemGroup>
    <Folder Include="bin\$(Configuration)\net472\" />
  </ItemGroup>
</Project>
```

### 5.2 Critical csproj Details — .NET 4.7.2

| Property/Element                                                                | Value                | Why It Matters                                                                                                   |
| ------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `<TargetFramework>`                                                             | `net472`             | .NET Framework 4.7.2                                                                                             |
| `<PlatformTarget>`                                                              | `x64`                | Must be `x64` for net472 (NOT AnyCPU)                                                                            |
| `<LogicAppFolder>`                                                              | `my-logicapp`        | **Relative folder name** of the sibling Logic App project. Replace with your Logic App folder name.              |
| `Task` target (AfterTargets `Compile`)                                          | Cleans `lib/custom/` | Ensures fresh outputs on every build                                                                             |
| `CopyExtensionFiles` target (AfterTargets `ParameterizedFunctionJsonGenerator`) | Copies build outputs | Note: `ParameterizedFunctionJsonGenerator` (NOT `ParameterizedFunctionJsonGeneratorNetCore` — that's for .NET 8) |
| `<Reference Include="Microsoft.CSharp" />`                                      | Assembly reference   | Required for dynamic features                                                                                    |

> **IMPORTANT**: The .NET 4.7.2 approach uses explicit MSBuild targets to clean, copy, and reorganize build outputs. The `CopyExtensionFiles` target runs after `ParameterizedFunctionJsonGenerator` which is provided by the `Microsoft.NET.Sdk.Functions` package to auto-generate `function.json` files.

### 5.3 How the MSBuild Targets Work (net472)

The targets perform these steps in order:

1. **`Task` target** (after Compile): Deletes `../my-logicapp/lib/custom/` to start fresh
2. **`CopyExtensionFiles` target** (after ParameterizedFunctionJsonGenerator):
    - Copies **subdirectories** (e.g., `Functions/function.json`) from `bin/$(Configuration)/net472/` to `../my-logicapp/lib/custom/`
    - Copies **root files** (DLLs, PDBs) from `bin/$(Configuration)/net472/` to `../my-logicapp/lib/custom/net472/`
    - Moves any stray files from `../my-logicapp/lib/custom/bin/` to `../my-logicapp/lib/custom/net472/`
    - Removes the empty `bin/` folder

### 5.4 Required Packages — .NET 4.7.2

| Package                                     | Version | Why It's Needed                                                                                       |
| ------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `Microsoft.Azure.WebJobs.Core`              | 3.0.39  | Provides `[FunctionName]` attribute                                                                   |
| `Microsoft.Azure.Workflows.WebJobs.Sdk`     | 1.1.0   | Provides `[WorkflowActionTrigger]` attribute                                                          |
| `Microsoft.NET.Sdk.Functions`               | 4.2.0   | Azure Functions SDK — generates `function.json`, provides `ParameterizedFunctionJsonGenerator` target |
| `Microsoft.Extensions.Logging.Abstractions` | 2.1.1   | Provides `ILogger<T>`, `ILoggerFactory`                                                               |
| `Microsoft.Extensions.Logging`              | 2.1.1   | Logging infrastructure                                                                                |

> **⚠️ IMPORTANT**: Use `Microsoft.Azure.WebJobs.Core` (not `Microsoft.Azure.WebJobs`). The `.Core` package provides just the attributes without pulling in the full WebJobs host.

### 5.5 Function Code — .NET 4.7.2

```csharp
//------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
//------------------------------------------------------------

namespace <YourNamespace>
{
    using System;
    using System.Collections.Generic;
    using System.Threading.Tasks;
    using Microsoft.Azure.Functions.Extensions.Workflows;  // [WorkflowActionTrigger]
    using Microsoft.Azure.WebJobs;                          // [FunctionName] — NOT [Function]!
    using Microsoft.Extensions.Logging;

    /// <summary>
    /// Represents the <FunctionName> flow invoked function.
    /// </summary>
    public class <ClassName>
    {
        private readonly ILogger<<ClassName>> logger;

        public <ClassName>(ILoggerFactory loggerFactory)
        {
            logger = loggerFactory.CreateLogger<<ClassName>>();
        }

        /// <summary>
        /// Executes the logic app workflow action.
        /// </summary>
        [FunctionName("<FunctionName>")]                // ← [FunctionName], NOT [Function]
        public Task<<ResultType>> Run(
            [WorkflowActionTrigger] <type> param1, <type> param2)
        {
            this.logger.LogInformation("Starting <FunctionName>: " + param1);

            var result = new <ResultType>()
            {
                // Set properties...
            };

            return Task.FromResult(result);
        }

        /// <summary>
        /// Result model — properties become accessible in workflow via @body('ActionName')?['PropertyName']
        /// </summary>
        public class <ResultType>
        {
            public <type> Property1 { get; set; }
            public <type> Property2 { get; set; }
        }
    }
}
```

### 5.6 Key Using Statements — .NET 4.7.2

```csharp
using Microsoft.Azure.Functions.Extensions.Workflows;  // [WorkflowActionTrigger] — same for both approaches
using Microsoft.Azure.WebJobs;                          // [FunctionName("...")] — net472 ONLY
using Microsoft.Extensions.Logging;                     // ILogger<T>, ILoggerFactory
```

### 5.7 Functions/.vscode/ Files — .NET 4.7.2

**Functions/.vscode/extensions.json**

```json
{
    "recommendations": ["ms-azuretools.vscode-azurefunctions", "ms-dotnettools.csharp"]
}
```

**Functions/.vscode/settings.json**

```json
{
    "azureFunctions.deploySubpath": "bin/Release/net472/publish",
    "azureFunctions.projectLanguage": "C#",
    "azureFunctions.projectRuntime": "~4",
    "debug.internalConsoleOptions": "neverOpen",
    "azureFunctions.preDeployTask": "publish (functions)",
    "azureFunctions.templateFilter": "Core",
    "azureFunctions.showTargetFrameworkWarning": false,
    "azureFunctions.projectSubpath": "bin\\Release\\net472\\publish"
}
```

**Functions/.vscode/tasks.json**

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "build",
            "command": "${config:azureLogicAppsStandard.dotnetBinaryPath}",
            "type": "process",
            "args": ["build", "${workspaceFolder}"],
            "group": {
                "kind": "build",
                "isDefault": true
            }
        }
    ]
}
```

---

## 6. Shared Logic App Project Files (Both Approaches)

The following files are **identical** (or nearly so) for both .NET 8 and .NET 4.7.2. The only difference is noted in `launch.json`.

### 6.1 Workspace File (`<workspace-name>.code-workspace`)

```json
{
    "folders": [
        {
            "name": "my-logicapp",
            "path": "./my-logicapp"
        },
        {
            "name": "Functions",
            "path": "./Functions"
        }
    ],
    "settings": {}
}
```

> **Note**: The Logic App folder MUST be listed **first** in the `folders` array. The `settings` block can optionally include `terminal.integrated.env.windows` with a PATH to the Logic Apps DotNetSDK if needed for local development.

### 6.2 host.json

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

### 6.3 local.settings.json (CRITICAL)

```json
{
    "IsEncrypted": false,
    "Values": {
        "AzureWebJobsStorage": "UseDevelopmentStorage=true",
        "FUNCTIONS_INPROC_NET8_ENABLED": "1",
        "FUNCTIONS_WORKER_RUNTIME": "dotnet",
        "APP_KIND": "workflowapp",
        "AzureWebJobsFeatureFlags": "EnableMultiLanguageWorker",
        "ProjectDirectoryPath": "<absolute-path-to-logicapp-folder>",
        "WORKFLOWS_SUBSCRIPTION_ID": ""
    }
}
```

| Setting                         | Value                            | Why                                                                                                   |
| ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `FUNCTIONS_WORKER_RUNTIME`      | `"dotnet"`                       | **NEVER** use `"dotnet-isolated"` even for .NET 8 local functions                                     |
| `FUNCTIONS_INPROC_NET8_ENABLED` | `"1"`                            | Enables the .NET 8 host that loads both net472 and net8 assemblies. **Required for BOTH approaches.** |
| `APP_KIND`                      | `"workflowapp"`                  | Identifies this as a Logic App Standard project (note: lowercase 'a' in 'app')                        |
| `AzureWebJobsFeatureFlags`      | `"EnableMultiLanguageWorker"`    | Required to enable custom code execution alongside the workflow engine                                |
| `AzureWebJobsStorage`           | `"UseDevelopmentStorage=true"`   | Uses Azurite for local development                                                                    |
| `ProjectDirectoryPath`          | Absolute path to logicapp folder | Tells the runtime where to find workflow definitions                                                  |
| `WORKFLOWS_SUBSCRIPTION_ID`     | `""`                             | Azure subscription ID (empty for local development)                                                   |

### 6.4 launch.json (⚠️ DIFFERS BETWEEN APPROACHES)

**For .NET 8:**

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run/Debug logic app with local function my-logicapp",
            "type": "logicapp",
            "request": "launch",
            "funcRuntime": "coreclr",
            "customCodeRuntime": "coreclr",
            "isCodeless": true
        }
    ]
}
```

**For .NET 4.7.2:**

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run/Debug logic app with local function my-logicapp",
            "type": "logicapp",
            "request": "launch",
            "funcRuntime": "coreclr",
            "customCodeRuntime": "clr",
            "isCodeless": true
        }
    ]
}
```

> **⚠️ CRITICAL DIFFERENCE**: `customCodeRuntime` must be `"coreclr"` for .NET 8 and `"clr"` for .NET 4.7.2. Getting this wrong will cause the custom code to fail at runtime. Both use `"funcRuntime": "coreclr"`.

### 6.5 .vscode/extensions.json

```json
{
    "recommendations": ["ms-azuretools.vscode-azurelogicapps"]
}
```

### 6.6 .vscode/settings.json

```json
{
    "azureLogicAppsStandard.projectLanguage": "JavaScript",
    "azureLogicAppsStandard.projectRuntime": "~4",
    "debug.internalConsoleOptions": "neverOpen",
    "azureFunctions.suppressProject": true
}
```

> **Note**: `azureLogicAppsStandard.projectLanguage` is `"JavaScript"` even though the custom code is C#. This refers to the Logic Apps workflow engine language, not the custom code language. `azureFunctions.suppressProject` must be `true` to prevent the Azure Functions extension from interfering.

### 6.7 .vscode/tasks.json

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

### 6.8 workflow-designtime/host.json

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

> **Purpose**: This enables the Logic Apps designer to discover available custom functions and connectors at design time. Without this, the designer won't show the "Call a local function" action.

### 6.9 workflow-designtime/local.settings.json

```json
{
    "IsEncrypted": false,
    "Values": {
        "APP_KIND": "workflowapp",
        "ProjectDirectoryPath": "<absolute-path-to-logicapp-folder>",
        "FUNCTIONS_WORKER_RUNTIME": "node",
        "AzureWebJobsSecretStorageType": "Files"
    }
}
```

> **Note**: This file uses `"FUNCTIONS_WORKER_RUNTIME": "node"` — this is correct for design-time only. The runtime `local.settings.json` uses `"dotnet"`.

### 6.10 .funcignore

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

### 6.11 .gitignore

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

### 6.12 Artifacts/ Folder

Do **NOT** create `Artifacts/` by default as part of the local-functions setup.

Only create `Artifacts/Maps/`, `Artifacts/Rules/`, or `Artifacts/Schemas/` later if the migrated solution actually needs maps, schemas, HIDX files, or rules.

### 6.13 lib/builtinOperationSdks/ Folder

Do **NOT** create `lib/builtinOperationSdks/` by default as part of the local-functions setup.

Only create that folder later if runtime/tooling explicitly requires it. If it ever exists, keep it completely empty.

> **⚠️ CRITICAL — Never put `.gitkeep` or any file inside `lib/builtinOperationSdks/JAR/` or `lib/builtinOperationSdks/net472/` if those folders are ever created.** The Azure Functions runtime detects non-empty folders there and attempts to load Java and .NET Framework workers. If those workers fail (for example, because `JAVA_HOME` is not set), the .NET 8 worker can also fail to initialize — causing `InvokeFunction` calls to error with "function does not exist".

---

## 7. Calling Custom Code from workflow.json

The workflow.json is **identical** regardless of which .NET approach you use.

### 7.1 InvokeFunction Action

```json
{
    "definition": {
        "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
        "actions": {
            "Call_a_local_function_in_this_logic_app": {
                "type": "InvokeFunction",
                "inputs": {
                    "functionName": "<FunctionName>",
                    "parameters": {
                        "param1": "<value_or_expression>",
                        "param2": "<value_or_expression>"
                    }
                },
                "runAfter": {}
            }
        },
        "triggers": {
            "When_a_HTTP_request_is_received": {
                "type": "Request",
                "kind": "Http",
                "inputs": {}
            }
        },
        "contentVersion": "1.0.0.0",
        "outputs": {}
    },
    "kind": "Stateful"
}
```

### 7.2 Accessing Function Results in Subsequent Actions

```json
"@body('Call_a_local_function_in_this_logic_app')"
```

To access a specific property of the result:

```json
"@body('Call_a_local_function_in_this_logic_app')?['PropertyName']"
```

### 7.3 Key Rules

- `functionName` must **exactly match** the name in `[Function("...")]` or `[FunctionName("...")]` (case-sensitive)
- `parameters` is a flat JSON object — each key maps to a C# method parameter by name
- Parameter names are **case-sensitive** and must match the C# parameter names exactly
- The `type` must be `"InvokeFunction"` (not `"Function"` or `"AzureFunction"`)
- `runAfter` controls execution order — use `{}` for the first action after a trigger

### 7.4 Example with Previous Action Output as Parameters

```json
{
    "Call_a_local_function_in_this_logic_app": {
        "type": "InvokeFunction",
        "inputs": {
            "functionName": "Functions",
            "parameters": {
                "zipCode": "@triggerBody()?['zipCode']",
                "temperatureScale": "@triggerBody()?['scale']"
            }
        },
        "runAfter": {}
    },
    "Response": {
        "type": "Response",
        "kind": "http",
        "inputs": {
            "statusCode": 200,
            "body": "@body('Call_a_local_function_in_this_logic_app')"
        },
        "runAfter": {
            "Call_a_local_function_in_this_logic_app": ["Succeeded"]
        }
    }
}
```

---

## 8. function.json Reference

The `function.json` file is **auto-generated by the build process** and placed in `lib/custom/<FunctionName>/function.json`. You should NOT create this file manually — the MSBuild targets handle it.

### 8.1 .NET 8 function.json (auto-generated)

```json
{
    "Name": "<FunctionName>",
    "ScriptFile": "<ProjectName>.dll",
    "FunctionDirectory": null,
    "EntryPoint": "<Namespace>.<ClassName>.Run",
    "Language": "net8",
    "Properties": {},
    "Bindings": [
        {
            "Name": "<firstParamName>",
            "Connection": null,
            "Type": "workflowActionTrigger",
            "Properties": {},
            "Direction": "In",
            "DataType": null,
            "Cardinality": null,
            "IsTrigger": true,
            "IsReturn": false,
            "Raw": null
        }
    ],
    "InputBindings": [
        {
            "Name": "<firstParamName>",
            "Connection": null,
            "Type": "workflowActionTrigger",
            "Properties": {},
            "Direction": "In",
            "DataType": null,
            "Cardinality": null,
            "IsTrigger": true,
            "IsReturn": false,
            "Raw": null
        }
    ],
    "OutputBindings": [],
    "Trigger": {
        "Name": "<firstParamName>",
        "Connection": null,
        "Type": "workflowActionTrigger",
        "Properties": {},
        "Direction": "In",
        "DataType": null,
        "Cardinality": null,
        "IsTrigger": true,
        "IsReturn": false,
        "Raw": null
    },
    "InputSchema": {
        "type": "object",
        "properties": {
            "<param1>": { "type": "<jsonType>" },
            "<param2>": { "type": "<jsonType>" }
        },
        "required": ["<param1>", "<param2>"]
    },
    "OutputSchema": {
        "type": "object",
        "properties": {
            "<Property1>": { "type": "<jsonType>" },
            "<Property2>": { "type": "<jsonType>" }
        },
        "required": ["<Property1>", "<Property2>"]
    }
}
```

**Key fields for .NET 8:**

- `"Name"`: Set to the function name (not null)
- `"ScriptFile"`: Just the DLL filename (e.g., `"Functions.dll"`) — no path prefix
- `"Language"`: `"net8"`
- `"InputSchema"` / `"OutputSchema"`: Auto-generated from parameter and return types

### 8.2 .NET 4.7.2 function.json (auto-generated)

```json
{
  "Name": null,
  "ScriptFile": "../bin/<ProjectName>.dll",
  "FunctionDirectory": null,
  "EntryPoint": "<Namespace>.<ClassName>.Run",
  "Language": "net472",
  "Properties": {},
  "Bindings": [ "..." ],
  "InputBindings": [ "..." ],
  "OutputBindings": [],
  "Trigger": { "..." },
  "InputSchema": { "..." },
  "OutputSchema": { "..." }
}
```

**Key fields for .NET 4.7.2:**

- `"Name"`: `null`
- `"ScriptFile"`: `"../bin/<ProjectName>.dll"` — this is the auto-generated path from the build. The MSBuild targets move the DLLs to `net472/` but do NOT update this path. The Logic Apps runtime resolves the DLL location using the `"Language": "net472"` field to look in the `net472/` subfolder.
- `"Language"`: `"net472"`

### 8.3 net472 extensions.json

For .NET 4.7.2, an `extensions.json` file is also generated in the `lib/custom/net472/` folder:

```json
{
    "extensions": []
}
```

---

## 9. Building and Running Locally

### 9.1 Build — .NET 8

```powershell
cd Functions
dotnet build

# The TriggerPublishOnBuild target automatically:
# 1. Builds the project
# 2. Calls Publish
# 3. Copies DLLs to ../my-logicapp/lib/custom/net8/
# 4. Copies function.json to ../my-logicapp/lib/custom/<FunctionName>/
```

### 9.2 Build — .NET 4.7.2

```powershell
cd Functions
dotnet build

# The MSBuild targets automatically:
# 1. Compile → Cleans ../my-logicapp/lib/custom/
# 2. ParameterizedFunctionJsonGenerator → Generates function.json
# 3. CopyExtensionFiles → Copies DLLs to ../my-logicapp/lib/custom/net472/
#                        → Copies function.json to ../my-logicapp/lib/custom/<FunctionName>/
```

### 9.3 Verify Build Outputs

After building, verify these paths exist:

**For .NET 8:**

```
my-logicapp/lib/custom/net8/Functions.dll          ← DLL
my-logicapp/lib/custom/<FunctionName>/function.json ← Metadata
```

**For .NET 4.7.2:**

```
my-logicapp/lib/custom/net472/Functions.dll          ← DLL + all dependency DLLs
my-logicapp/lib/custom/net472/extensions.json        ← Empty extensions file
my-logicapp/lib/custom/<FunctionName>/function.json  ← Metadata
```

### 9.4 Run Locally

1. **Ensure Azurite is running** (required for `AzureWebJobsStorage=UseDevelopmentStorage=true`)
2. Open the workspace file in VS Code
3. Build the Functions project first: `cd Functions && dotnet build`
4. Press F5 or use the launch configuration to start debugging
5. The Logic App runtime will start and discover the custom functions

### 9.5 Prerequisites

- **VS Code** with the Azure Logic Apps (Standard) extension installed
- **Azure Functions Core Tools** v4
- **.NET SDK** (8.0 for net8, or .NET SDK that can target net472)
- **Azurite** (Azure Storage Emulator) running locally
- **Node.js** (required by the Logic Apps runtime)

---

## 10. Supported Parameter & Return Types

| C# Type      | JSON Type in function.json | Workflow Expression Example             |
| ------------ | -------------------------- | --------------------------------------- |
| `string`     | `"string"`                 | `"@body('Parse')?['name']"`             |
| `int`        | `"integer"`                | `85396` or `"@body('Parse')?['count']"` |
| `bool`       | `"boolean"`                | `"@true"`                               |
| `double`     | `"number"`                 | `"@body('Parse')?['amount']"`           |
| `DateTime`   | `"string"` (ISO 8601)      | `"@utcNow()"`                           |
| Custom class | `"object"`                 | `"@body('PreviousAction')"`             |

### Function Signature Rules (Both Approaches)

1. **Constructor** takes `ILoggerFactory` — dependency injection provides it automatically
2. **`[WorkflowActionTrigger]`** goes on the **first parameter only**, but ALL parameters are passed via the `parameters` object in workflow.json
3. **Return type** must be `Task<T>` where `T` is a class with public get/set properties
4. **Result class properties** become accessible in the workflow via `@body('ActionName')?['PropertyName']`
5. **The class does NOT need to be static** — DI creates the instance
6. **One public function per class** is the recommended pattern (the function name in the attribute must be unique across all functions in the project)

### Multiple Functions in One Project

You can define multiple function classes in a single project. Each must have a unique function name:

```csharp
// File: Function1.cs
public class Function1
{
    [Function("Function1")]  // or [FunctionName("Function1")] for net472
    public Task<Result1> Run([WorkflowActionTrigger] string input) { ... }
}

// File: Function2.cs
public class Function2
{
    [Function("Function2")]  // or [FunctionName("Function2")] for net472
    public Task<Result2> Run([WorkflowActionTrigger] int value) { ... }
}
```

Each function gets its own `function.json` in `lib/custom/<FunctionName>/function.json`.

---

## 11. Verification Checklists

### .NET 8 Checklist

- [ ] **Workspace file** exists at root with Logic App folder listed first, Functions folder listed second
- [ ] **Functions project** is a **sibling folder** to the Logic App project
- [ ] **csproj `<TargetFramework>`** is `net8` (NOT `net8.0`)
- [ ] **csproj `<PlatformTarget>`** is `AnyCPU`
- [ ] **csproj `<LogicAppFolderToPublish>`** points to the Logic App folder using `$(MSBuildProjectDirectory)\..` prefix
- [ ] **csproj has `TriggerPublishOnBuild` target** that calls Publish
- [ ] **Packages**: `Microsoft.Azure.Functions.Worker.Sdk` 1.15.1, `Microsoft.Azure.Functions.Worker.Extensions.Abstractions` 1.3.0, `Microsoft.Azure.Workflows.Webjobs.Sdk` 1.2.0, `Microsoft.Extensions.Logging` 6.0.0, `Microsoft.Extensions.Logging.Abstractions` 6.0.0
- [ ] **Using**: `using Microsoft.Azure.Functions.Worker;` (for `[Function]`), `using Microsoft.Azure.Functions.Extensions.Workflows;` (for `[WorkflowActionTrigger]`)
- [ ] **Attribute**: `[Function("...")]` NOT `[FunctionName("...")]`
- [ ] **launch.json**: `"customCodeRuntime": "coreclr"`
- [ ] **local.settings.json**: Has ALL required settings including `FUNCTIONS_INPROC_NET8_ENABLED`, `AzureWebJobsFeatureFlags`, `APP_KIND`
- [ ] **workflow-designtime/** folder exists with host.json and local.settings.json
- [ ] **Build succeeds**: `dotnet build` in Functions/ exits with code 0
- [ ] **Auto-deploy**: `lib/custom/net8/` has DLLs after build
- [ ] **Auto-deploy**: `lib/custom/<FunctionName>/function.json` exists after build

### .NET Framework 4.7.2 Checklist

- [ ] **Workspace file** exists at root with Logic App folder listed first, Functions folder listed second
- [ ] **Functions project** is a **sibling folder** to the Logic App project
- [ ] **csproj `<TargetFramework>`** is `net472`
- [ ] **csproj `<PlatformTarget>`** is `x64`
- [ ] **csproj `<LogicAppFolder>`** is set to the Logic App folder name (e.g., `my-logicapp`)
- [ ] **csproj has `Task` and `CopyExtensionFiles` targets** for clean + copy
- [ ] **Packages**: `Microsoft.Azure.WebJobs.Core` 3.0.39, `Microsoft.Azure.Workflows.WebJobs.Sdk` 1.1.0, `Microsoft.NET.Sdk.Functions` 4.2.0, `Microsoft.Extensions.Logging` 2.1.1, `Microsoft.Extensions.Logging.Abstractions` 2.1.1
- [ ] **Using**: `using Microsoft.Azure.WebJobs;` (for `[FunctionName]`), `using Microsoft.Azure.Functions.Extensions.Workflows;` (for `[WorkflowActionTrigger]`)
- [ ] **Attribute**: `[FunctionName("...")]` NOT `[Function("...")]`
- [ ] **launch.json**: `"customCodeRuntime": "clr"`
- [ ] **local.settings.json**: Has ALL required settings including `FUNCTIONS_INPROC_NET8_ENABLED`, `AzureWebJobsFeatureFlags`, `APP_KIND`
- [ ] **workflow-designtime/** folder exists with host.json and local.settings.json
- [ ] **Build succeeds**: `dotnet build` in Functions/ exits with code 0
- [ ] **Auto-deploy**: `lib/custom/net472/` has DLLs after build
- [ ] **Auto-deploy**: `lib/custom/<FunctionName>/function.json` exists after build

### Common Checklist (Both)

- [ ] **Azurite running**: `AzureWebJobsStorage=UseDevelopmentStorage=true` requires Azurite
- [ ] **Workflow `functionName`**: Matches `[FunctionName("...")]` or `[Function("...")]` exactly (case-sensitive)
- [ ] **Workflow action type**: Is `"InvokeFunction"` (not `"Function"`)
- [ ] **Parameter names in workflow.json**: Match C# parameter names exactly (case-sensitive)
- [ ] **Result access**: Workflow uses `@body('ActionName')` or `@body('ActionName')?['PropertyName']`
- [ ] **host.json extensionBundle**: Uses `Microsoft.Azure.Functions.ExtensionBundle.Workflows` with version `[1.*, 2.0.0)`

---

## 12. Troubleshooting Guide

### Build Errors

| Error                                                                   | Cause                                             | Fix                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| `Unable to find package Microsoft.Azure.Functions.Extensions.Workflows` | Wrong package name                                | Use `Microsoft.Azure.Workflows.WebJobs.Sdk`                 |
| `CS0234: 'Workflows' does not exist in 'Microsoft.Azure'`               | Using statement matches package ID, not namespace | Use `using Microsoft.Azure.Functions.Extensions.Workflows;` |
| `CS0246: 'ILogger<>' could not be found`                                | Missing logging package                           | Add `Microsoft.Extensions.Logging.Abstractions`             |
| `CS0246: 'FunctionName' could not be found` (net472)                    | Missing WebJobs package                           | Add `Microsoft.Azure.WebJobs.Core`                          |
| `CS0246: 'Function' could not be found` (net8)                          | Missing Worker SDK package                        | Add `Microsoft.Azure.Functions.Worker.Sdk`                  |
| `CS0246: 'WorkflowActionTrigger' could not be found`                    | Missing Workflows SDK                             | Add `Microsoft.Azure.Workflows.WebJobs.Sdk`                 |

### Runtime Errors

| Error                                    | Cause                             | Fix                                                                                                    |
| ---------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `0 functions found`                      | function.json missing or no DLLs  | Verify `lib/custom/<FuncName>/function.json` and `lib/custom/net8/` or `lib/custom/net472/` have DLLs  |
| `InvokeFunction — function not found`    | functionName mismatch             | Ensure exact case-sensitive match between workflow.json `functionName` and the C# attribute            |
| `function doesn't have a valid trigger`  | Missing `[WorkflowActionTrigger]` | Add attribute to the first parameter of the Run method                                                 |
| `Could not load type from assembly`      | DLLs not in correct folder        | Verify DLLs are in `lib/custom/net472/` or `lib/custom/net8/`                                          |
| Custom functions not showing in designer | Missing workflow-designtime/      | Create `workflow-designtime/` with `host.json` containing `Runtime.WorkflowOperationDiscoveryHostMode` |
| `customCodeRuntime` errors on debug      | Wrong runtime in launch.json      | Use `"coreclr"` for net8, `"clr"` for net472                                                           |
| Storage connection errors                | Azurite not running               | Start Azurite before debugging                                                                         |

### Common Mistakes

1. **Wrong `customCodeRuntime` in launch.json** — net8 uses `"coreclr"`, net472 uses `"clr"`
2. **Missing `FUNCTIONS_INPROC_NET8_ENABLED`** in local.settings.json — required for BOTH approaches
3. **Missing `AzureWebJobsFeatureFlags: EnableMultiLanguageWorker`** — required for custom code discovery
4. **Using `net8.0` instead of `net8` in TargetFramework** — Logic Apps convention uses `net8`
5. **Nesting Functions project inside LogicApp** — they must be sibling folders
6. **Missing workflow-designtime/ folder** — designer won't discover custom functions without it
7. **Wrong package name**: `Microsoft.Azure.Functions.Extensions.Workflows` doesn't exist on NuGet
8. **Using `Microsoft.Azure.WebJobs` instead of `Microsoft.Azure.WebJobs.Core`** for net472 — use the `.Core` package
9. **Using `AnyCPU` PlatformTarget for net472** — must be `x64`
10. **Missing `<Reference Include="Microsoft.CSharp" />`** in net472 csproj

---

## 13. Complete Working Examples

### Example A: .NET 8 — Weather Function (Complete Project)

**Directory structure:**

```
weather-net8-workspace/
├── weather-net8-workspace.code-workspace
├── Functions/
│   ├── Functions.csproj
│   ├── Functions.cs
│   └── .vscode/
│       ├── extensions.json
│       ├── settings.json
│       └── tasks.json
└── my-logicapp/
    ├── host.json
    ├── local.settings.json
    ├── .funcignore
    ├── .gitignore
    ├── .vscode/
    │   ├── extensions.json
    │   ├── launch.json
    │   ├── settings.json
    │   └── tasks.json
    ├── lib/
    │   └── custom/          ← populated by build
    ├── my-workflow/
    │   └── workflow.json
    └── workflow-designtime/
        ├── host.json
        └── local.settings.json
```

**Functions/Functions.csproj:**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <TargetFramework>net8</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Library</OutputType>
    <PlatformTarget>AnyCPU</PlatformTarget>
    <LogicAppFolderToPublish>$(MSBuildProjectDirectory)\..\my-logicapp</LogicAppFolderToPublish>
    <CopyToOutputDirectory>Always</CopyToOutputDirectory>
    <SelfContained>false</SelfContained>
 </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.Abstractions" Version="1.3.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Sdk" Version="1.15.1" />
    <PackageReference Include="Microsoft.Azure.Workflows.Webjobs.Sdk" Version="1.2.0" />
    <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="6.0.0" />
    <PackageReference Include="Microsoft.Extensions.Logging" Version="6.0.0" />
  </ItemGroup>

  <Target Name="TriggerPublishOnBuild" AfterTargets="Build">
      <CallTarget Targets="Publish" />
  </Target>
</Project>
```

**Functions/Functions.cs:**

```csharp
//------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
//------------------------------------------------------------

namespace test
{
    using System;
    using System.Collections.Generic;
    using System.Threading.Tasks;
    using Microsoft.Azure.Functions.Extensions.Workflows;
    using Microsoft.Azure.Functions.Worker;
    using Microsoft.Extensions.Logging;

    /// <summary>
    /// Represents the Functions flow invoked function.
    /// </summary>
    public class Functions
    {
        private readonly ILogger<Functions> logger;

        public Functions(ILoggerFactory loggerFactory)
        {
            logger = loggerFactory.CreateLogger<Functions>();
        }

        /// <summary>
        /// Executes the logic app workflow.
        /// </summary>
        /// <param name="zipCode">The zip code.</param>
        /// <param name="temperatureScale">The temperature scale (e.g., Celsius or Fahrenheit).</param>
        [Function("Functions")]
        public Task<Weather> Run([WorkflowActionTrigger] int zipCode, string temperatureScale)
        {
            this.logger.LogInformation("Starting Functions with Zip Code: " + zipCode + " and Scale: " + temperatureScale);

            // Generate random temperature within a range based on the temperature scale
            Random rnd = new Random();
            var currentTemp = temperatureScale == "Celsius" ? rnd.Next(1, 30) : rnd.Next(40, 90);
            var lowTemp = currentTemp - 10;
            var highTemp = currentTemp + 10;

            // Create a Weather object with the temperature information
            var weather = new Weather()
            {
                ZipCode = zipCode,
                CurrentWeather = $"The current weather is {currentTemp} {temperatureScale}",
                DayLow = $"The low for the day is {lowTemp} {temperatureScale}",
                DayHigh = $"The high for the day is {highTemp} {temperatureScale}"
            };

            return Task.FromResult(weather);
        }

        /// <summary>
        /// Represents the weather information for Functions.
        /// </summary>
        public class Weather
        {
            public int ZipCode { get; set; }
            public string CurrentWeather { get; set; }
            public string DayLow { get; set; }
            public string DayHigh { get; set; }
        }
    }
}
```

**my-logicapp/my-workflow/workflow.json:**

```json
{
    "definition": {
        "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
        "actions": {
            "Call_a_local_function_in_this_logic_app": {
                "type": "InvokeFunction",
                "inputs": {
                    "functionName": "Functions",
                    "parameters": {
                        "zipCode": 85396,
                        "temperatureScale": "Celsius"
                    }
                },
                "runAfter": {}
            },
            "Response": {
                "type": "Response",
                "kind": "http",
                "inputs": {
                    "statusCode": 200,
                    "body": "@body('Call_a_local_function_in_this_logic_app')"
                },
                "runAfter": {
                    "Call_a_local_function_in_this_logic_app": ["Succeeded"]
                }
            }
        },
        "triggers": {
            "When_a_HTTP_request_is_received": {
                "type": "Request",
                "kind": "Http",
                "inputs": {}
            }
        },
        "contentVersion": "1.0.0.0",
        "outputs": {}
    },
    "kind": "Stateful"
}
```

### Example B: .NET 4.7.2 — Weather Function (Complete Project)

**Same directory structure as net8** (sibling Functions/ and my-logicapp/ folders).

**Functions/Functions.csproj:**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <TargetFramework>net472</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Library</OutputType>
    <PlatformTarget>x64</PlatformTarget>
    <LogicAppFolder>my-logicapp</LogicAppFolder>
    <CopyToOutputDirectory>Always</CopyToOutputDirectory>
 </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.WebJobs.Core" Version="3.0.39" />
    <PackageReference Include="Microsoft.Azure.Workflows.WebJobs.Sdk" Version="1.1.0" />
    <PackageReference Include="Microsoft.NET.Sdk.Functions" Version="4.2.0" />
    <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="2.1.1" />
    <PackageReference Include="Microsoft.Extensions.Logging" Version="2.1.1" />
  </ItemGroup>

  <Target Name="Task" AfterTargets="Compile">
    <ItemGroup>
        <DirsToClean2 Include="..\$(LogicAppFolder)\lib\custom" />
      </ItemGroup>
      <RemoveDir Directories="@(DirsToClean2)" />
  </Target>

  <Target Name="CopyExtensionFiles" AfterTargets="ParameterizedFunctionJsonGenerator">
    <ItemGroup>
        <CopyFiles Include="$(MSBuildProjectDirectory)\bin\$(Configuration)\net472\**\*.*" CopyToOutputDirectory="PreserveNewest" Exclude="$(MSBuildProjectDirectory)\bin\$(Configuration)\net472\*.*" />
        <CopyFiles2 Include="$(MSBuildProjectDirectory)\bin\$(Configuration)\net472\*.*" />
    </ItemGroup>
    <Copy SourceFiles="@(CopyFiles)" DestinationFolder="..\$(LogicAppFolder)\lib\custom\%(RecursiveDir)" SkipUnchangedFiles="true" />
    <Copy SourceFiles="@(CopyFiles2)" DestinationFolder="..\$(LogicAppFolder)\lib\custom\net472\" SkipUnchangedFiles="true" />
    <ItemGroup>
        <MoveFiles Include="..\$(LogicAppFolder)\lib\custom\bin\*.*" />
    </ItemGroup>
    <Move SourceFiles="@(MoveFiles)" DestinationFolder="..\$(LogicAppFolder)\lib\custom\net472" />
    <ItemGroup>
       <DirsToClean Include="..\$(LogicAppFolder)\lib\custom\bin" />
     </ItemGroup>
       <RemoveDir Directories="@(DirsToClean)" />
  </Target>

  <ItemGroup>
      <Reference Include="Microsoft.CSharp" />
  </ItemGroup>
  <ItemGroup>
    <Folder Include="bin\$(Configuration)\net472\" />
  </ItemGroup>
</Project>
```

**Functions/Functions.cs:**

```csharp
//------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
//------------------------------------------------------------

namespace test
{
    using System;
    using System.Collections.Generic;
    using System.Threading.Tasks;
    using Microsoft.Azure.Functions.Extensions.Workflows;
    using Microsoft.Azure.WebJobs;
    using Microsoft.Extensions.Logging;

    /// <summary>
    /// Represents the Functions flow invoked function.
    /// </summary>
    public class Functions
    {
        private readonly ILogger<Functions> logger;

        public Functions(ILoggerFactory loggerFactory)
        {
            logger = loggerFactory.CreateLogger<Functions>();
        }

        /// <summary>
        /// Executes the logic app workflow.
        /// </summary>
        /// <param name="zipCode">The zip code.</param>
        /// <param name="temperatureScale">The temperature scale (e.g., Celsius or Fahrenheit).</param>
        [FunctionName("Functions")]
        public Task<Weather> Run([WorkflowActionTrigger] int zipCode, string temperatureScale)
        {
            this.logger.LogInformation("Starting Functions with Zip Code: " + zipCode + " and Scale: " + temperatureScale);

            // Generate random temperature within a range based on the temperature scale
            Random rnd = new Random();
            var currentTemp = temperatureScale == "Celsius" ? rnd.Next(1, 30) : rnd.Next(40, 90);
            var lowTemp = currentTemp - 10;
            var highTemp = currentTemp + 10;

            // Create a Weather object with the temperature information
            var weather = new Weather()
            {
                ZipCode = zipCode,
                CurrentWeather = $"The current weather is {currentTemp} {temperatureScale}",
                DayLow = $"The low for the day is {lowTemp} {temperatureScale}",
                DayHigh = $"The high for the day is {highTemp} {temperatureScale}"
            };

            return Task.FromResult(weather);
        }

        /// <summary>
        /// Represents the weather information for Functions.
        /// </summary>
        public class Weather
        {
            public int ZipCode { get; set; }
            public string CurrentWeather { get; set; }
            public string DayLow { get; set; }
            public string DayHigh { get; set; }
        }
    }
}
```

**my-logicapp/.vscode/launch.json (net472 — note `clr`):**

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run/Debug logic app with local function my-logicapp",
            "type": "logicapp",
            "request": "launch",
            "funcRuntime": "coreclr",
            "customCodeRuntime": "clr",
            "isCodeless": true
        }
    ]
}
```

**my-logicapp/my-workflow/workflow.json:**
(Identical to the .NET 8 example — same workflow.json works for both approaches)

---

## 14. Quick Reference Card

```
┌──────────────────────────────────────────────────────────────────────────┐
│           .NET Local Functions for Logic Apps Standard                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WORKSPACE LAYOUT (BOTH approaches):                                     │
│    <root>/                                                               │
│    ├── <name>.code-workspace    (logicapp folder FIRST)                  │
│    ├── Functions/               (sibling, NOT nested)                    │
│    │   ├── Functions.csproj                                              │
│    │   ├── <Name>.cs                                                     │
│    │   └── .vscode/{extensions,settings,tasks}.json                      │
│    └── my-logicapp/                                                      │
│        ├── host.json, local.settings.json                                │
│        ├── .vscode/{extensions,launch,settings,tasks}.json               │
│        ├── lib/custom/{<FuncName>/function.json, net8|net472/*.dll}      │
│        ├── <workflow-name>/workflow.json                                  │
│        └── workflow-designtime/{host.json, local.settings.json}          │
│                                                                          │
│  COMMON (both approaches):                                               │
│    NuGet Package:    Microsoft.Azure.Workflows.WebJobs.Sdk               │
│    C# Namespace:     Microsoft.Azure.Functions.Extensions.Workflows      │
│    Trigger Attr:     [WorkflowActionTrigger] on first param              │
│    Runtime Setting:  FUNCTIONS_WORKER_RUNTIME = "dotnet"                 │
│    Feature Flags:    AzureWebJobsFeatureFlags = EnableMultiLanguageWorker│
│    InProc NET8:      FUNCTIONS_INPROC_NET8_ENABLED = "1" (BOTH!)         │
│    Workflow action:  type: "InvokeFunction"                              │
│    Body access:      @body('ActionName')?['Property']                    │
│                                                                          │
│  .NET 8 (RECOMMENDED):                                                   │
│    Function Attr:    [Function("Name")]                                  │
│    Using:            Microsoft.Azure.Functions.Worker                     │
│    Packages:         Worker.Sdk 1.15.1                                   │
│                      Worker.Extensions.Abstractions 1.3.0                │
│                      Workflows.Webjobs.Sdk 1.2.0                         │
│                      Logging + Logging.Abstractions 6.0.0                │
│    Target:           net8 (NOT net8.0!)                                   │
│    Platform:         AnyCPU                                              │
│    DLLs path:        lib/custom/net8/                                    │
│    Build deploy:     TriggerPublishOnBuild → calls Publish               │
│    LogicApp prop:    <LogicAppFolderToPublish> (absolute path)           │
│    customCodeRuntime: "coreclr"                                          │
│                                                                          │
│  .NET Framework 4.7.2 (legacy):                                          │
│    Function Attr:    [FunctionName("Name")]                              │
│    Using:            Microsoft.Azure.WebJobs                             │
│    Packages:         WebJobs.Core 3.0.39                                 │
│                      Workflows.WebJobs.Sdk 1.1.0                         │
│                      NET.Sdk.Functions 4.2.0                             │
│                      Logging + Logging.Abstractions 2.1.1                │
│    Target:           net472                                              │
│    Platform:         x64                                                 │
│    DLLs path:        lib/custom/net472/                                  │
│    Build deploy:     Task (clean) + CopyExtensionFiles (copy)            │
│    LogicApp prop:    <LogicAppFolder> (relative folder name)             │
│    customCodeRuntime: "clr"                                              │
│                                                                          │
│  NEVER use:                                                              │
│    ✗ Package: Microsoft.Azure.Functions.Extensions.Workflows             │
│    ✗ Using:   Microsoft.Azure.Workflows.WebJobs.Sdk                      │
│    ✗ Runtime: dotnet-isolated                                            │
│    ✗ net8.0 (use net8)                                                   │
│    ✗ AnyCPU for net472 (use x64)                                         │
│    ✗ Nested Functions inside LogicApp folder                             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Step-by-Step Creation Guide for Agents

When creating a custom code project from scratch, follow these steps in order:

### Step 1: Create the workspace root and workspace file

```
<workspace-root>/<name>.code-workspace
```

### Step 2: Create the Functions project

```
<workspace-root>/Functions/Functions.csproj
<workspace-root>/Functions/<FunctionName>.cs
<workspace-root>/Functions/.vscode/extensions.json
<workspace-root>/Functions/.vscode/settings.json
<workspace-root>/Functions/.vscode/tasks.json
```

### Step 3: Create the Logic App project structure

```
<workspace-root>/my-logicapp/host.json
<workspace-root>/my-logicapp/local.settings.json
<workspace-root>/my-logicapp/.funcignore
<workspace-root>/my-logicapp/.gitignore
<workspace-root>/my-logicapp/.vscode/extensions.json
<workspace-root>/my-logicapp/.vscode/launch.json          ← APPROACH-SPECIFIC (customCodeRuntime)
<workspace-root>/my-logicapp/.vscode/settings.json
<workspace-root>/my-logicapp/.vscode/tasks.json
<workspace-root>/my-logicapp/workflow-designtime/host.json
<workspace-root>/my-logicapp/workflow-designtime/local.settings.json
```

### Step 4: Create workflow(s)

```
<workspace-root>/my-logicapp/<workflow-name>/workflow.json
```

### Step 5: Build the Functions project

```powershell
cd <workspace-root>/Functions
dotnet build
```

### Step 7: Verify build outputs

```
<workspace-root>/my-logicapp/lib/custom/net8/Functions.dll     (or net472/)
<workspace-root>/my-logicapp/lib/custom/<FuncName>/function.json
```

### Summary of ALL Files to Create

| #   | File                                                  | Approach-Specific?            | Reference Section           |
| --- | ----------------------------------------------------- | ----------------------------- | --------------------------- |
| 1   | `<name>.code-workspace`                               | No                            | §6.1                        |
| 2   | `Functions/Functions.csproj`                          | **YES**                       | §4.1 (net8) / §5.1 (net472) |
| 3   | `Functions/<Name>.cs`                                 | **YES** (attribute differs)   | §4.4 (net8) / §5.5 (net472) |
| 4   | `Functions/.vscode/extensions.json`                   | No                            | §4.6 / §5.7                 |
| 5   | `Functions/.vscode/settings.json`                     | **YES** (deploy path differs) | §4.6 / §5.7                 |
| 6   | `Functions/.vscode/tasks.json`                        | No                            | §4.6 / §5.7                 |
| 7   | `my-logicapp/host.json`                               | No                            | §6.2                        |
| 8   | `my-logicapp/local.settings.json`                     | No                            | §6.3                        |
| 9   | `my-logicapp/.funcignore`                             | No                            | §6.10                       |
| 10  | `my-logicapp/.gitignore`                              | No                            | §6.11                       |
| 11  | `my-logicapp/.vscode/extensions.json`                 | No                            | §6.5                        |
| 12  | `my-logicapp/.vscode/launch.json`                     | **YES** (customCodeRuntime)   | §6.4                        |
| 13  | `my-logicapp/.vscode/settings.json`                   | No                            | §6.6                        |
| 14  | `my-logicapp/.vscode/tasks.json`                      | No                            | §6.7                        |
| 15  | `my-logicapp/workflow-designtime/host.json`           | No                            | §6.8                        |
| 16  | `my-logicapp/workflow-designtime/local.settings.json` | No                            | §6.9                        |
| 17  | `my-logicapp/<workflow>/workflow.json`                | No                            | §7.1                        |

**Total: 17 files + 5 empty directories**

---

## Document Metadata

| Field                | Value                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Created**          | 2026-03-11                                                                                                                                                                                |
| **Updated**          | 2026-03-12 — Complete rewrite based on verified working projects                                                                                                                          |
| **Source**           | Verified working projects: Q:\LAWorkspace\net8-customcode-workspace and Q:\LAWorkspace\net472-customcode-workspace                                                                        |
| **Verified Against** | Azure Functions Core Tools v4, Extension Bundle Workflows [1.\*, 2.0.0), Microsoft.Azure.Workflows.WebJobs.Sdk 1.2.0 (net8) / 1.1.0 (net472), Microsoft.Azure.Functions.Worker.Sdk 1.15.1 |
| **Applicable To**    | Logic Apps Standard (single-tenant), VS Code development, local + cloud deployment                                                                                                        |
