# Logic Apps Migration Assistant

> **VS Code Extension for migrating BizTalk, MuleSoft, and other integration platforms to Azure Logic Apps Standard**

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visual-studio-code)](https://code.visualstudio.com)
[![Azure](https://img.shields.io/badge/Azure-Logic%20Apps-0078D4?logo=microsoft-azure)](https://azure.microsoft.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Watch the Demo

See the extension in action before you install it.

<video src="docs/media/logic-apps-migration-assistant-demo.mp4" controls muted playsinline width="100%">
    Your browser does not support embedded video. <a href="docs/media/logic-apps-migration-assistant-demo.mp4">Download the demo video</a>.
</video>

## Overview

The **Logic Apps Migration Assistant** is a VS Code extension that automates the migration of enterprise integration solutions to Azure Logic Apps Standard. It uses AI-powered analysis via GitHub Copilot to guide you through a structured migration workflow — all running locally within VS Code.

### Supported Source Platforms

| Platform                               | Status            | Parser          |
| -------------------------------------- | ----------------- | --------------- |
| **BizTalk Server** (2016, 2020)        | Fully implemented | Built-in        |
| **MuleSoft Anypoint** (Mule 3, Mule 4) | In progress       | Built-in (stub) |

This is an open-source project — contributions are welcome! To add support for a new platform, see [Contributing a New Platform](#contributing-a-new-platform).

### Target Platform

- **Azure Logic Apps Standard** (Workflow Service Plan)

## Features

| Feature                       | Description                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| 🔄 **Multi-Platform Support** | BizTalk (built-in), MuleSoft (stub), plus extensible parsers for partner platforms                    |
| 🎯 **5-Stage Workflow**       | Structured migration from Discovery through Deployment                                                |
| 🧠 **Copilot Integration**    | AI-powered analysis, planning, and conversion via VS Code Language Model API                          |
| 🏗️ **Built-in Parsers**       | TypeScript-based parsers for BizTalk orchestrations, maps, schemas, pipelines, and bindings           |
| 🔌 **Parser Plugin System**   | Partner teams can contribute parsers via VS Code extensions                                           |
| 📊 **Flow Visualization**     | Interactive architecture diagrams, message flows, gap analysis, and dependency tracking               |
| 🤖 **AI Agents**              | Three specialized Copilot agents: `@migration-analyser`, `@migration-planner`, `@migration-converter` |
| ☁️ **Azure Deployment**       | Direct deployment configuration via Azure settings                                                    |

## Migration Stages

The extension guides you through a **5-stage migration workflow**:

```
Discovery → Planning → Conversion → Validation → Deployment
```

| #   | Stage          | Description                                                                                                                                                                                  |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Discovery**  | Find and catalog all integration artifacts from the source platform. Auto-detects platform, scans files, builds artifact inventory and dependency graph.                                     |
| 2   | **Planning**   | Analyze complexity, plan the migration roadmap, and map source patterns to Logic Apps patterns. Generates per-flow migration plans with action mappings, gap analysis, and effort estimates. |
| 3   | **Conversion** | Transform source artifacts into Logic Apps Standard workflows, connections, and supporting files. Executes task plans generated during planning.                                             |
| 4   | **Validation** | Test generated workflows and validate behavior against source specifications.                                                                                                                |
| 5   | **Deployment** | Deploy generated Logic Apps artifacts to Azure.                                                                                                                                              |

## Quick Start

1. Install the extension from VS Code Marketplace
2. Open your BizTalk or MuleSoft project folder in VS Code
3. Click the **Logic Apps Migration Assistant** icon in the Activity Bar
4. Select your source folder when prompted (or use the command palette: `Logic Apps Migration Assistant: Select Source Folder`)
5. Follow the guided 5-stage workflow

## Requirements

| Requirement                                                                                                                      | Purpose                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| VS Code 1.85.0 or later                                                                                                          | Runtime                                               |
| [Azure Logic Apps (Standard)](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurelogicapps) extension | Required extension dependency                         |
| [Azure Functions](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions) extension             | Local functions runtime and development tasks         |
| GitHub Copilot subscription                                                                                                      | AI-powered analysis, planning, and conversion         |
| [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)                                                 | Local connector resource deployment for local testing |
| Azure CLI                                                                                                                        | Azure resource provisioning and deployment            |
| Azure subscription                                                                                                               | Deployment to Azure (Stage 5)                         |

## Extension Settings

Configure via `Settings > Extensions > Logic Apps Migration Assistant`:

| Setting                                            | Description                                       | Default                              |
| -------------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| `logicAppsMigrationAssistant.deploymentModel`      | Target deployment model for Logic Apps Standard   | `workflow-service-plan`              |
| `logicAppsMigrationAssistant.azure.subscriptionId` | Azure subscription ID for deployment              | (empty)                              |
| `logicAppsMigrationAssistant.azure.resourceGroup`  | Azure resource group for provisioning and testing | `integration-migration-tool-test-rg` |
| `logicAppsMigrationAssistant.azure.location`       | Azure region for provisioning resources           | `eastus`                             |

## Command Palette

| Command                                                | Description                                          |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `Logic Apps Migration Assistant: Select Source Folder` | Start migration by selecting a source project folder |
| `Logic Apps Migration Assistant: Reset Migration`      | Reset all migration state and start over             |
| `Logic Apps Migration Assistant: Show Extension Logs`  | Open the extension output channel for debugging      |

## Architecture

### Parser System

Parsers are **TypeScript modules** that transform source platform artifacts into a common Intermediate Representation (IR). The extension uses a registry-based architecture supporting both built-in and external parsers.

```
┌─────────────────────────────────────────────────────────────┐
│                    Parser Registry                          │
├─────────────────────────────────────────────────────────────┤
│  Built-in Parsers          │  External Parser Plugins       │
│  ─────────────────         │  ──────────────────────        │
│  • BizTalk (.btproj, .odx) │  • Partner Platform Parsers    │
│  • BizTalk (.btm, .xsd)   │  • Community Parsers           │
│  • BizTalk (.btp, bindings)│                                │
│  • MuleSoft (stub)         │                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  IR Document    │
                    │  (JSON Schema)  │
                    └─────────────────┘
```

### AI Agents

The extension provisions three GitHub Copilot agents into your workspace:

| Agent                  | Purpose                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `@migration-analyser`  | Analyzes discovered artifacts, detects flow groups, generates architecture visualizations |
| `@migration-planner`   | Creates per-flow migration plans with action mappings and gap analysis                    |
| `@migration-converter` | Executes conversion tasks to generate Logic Apps workflows and connections                |

### LM Tools

The extension registers **25 Language Model tools** with VS Code that the AI agents use to read artifacts, store results, and manage the migration workflow.

## Source Flow Visualization

The Flow Visualizer provides an interactive webview for exploring your integration architecture. It displays data from parsed IR documents, bindings, dependency graphs, and AI-generated analysis.

### Visualization Tabs

| Tab                      | Content                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| **Architecture Diagram** | System architecture diagram with all artifacts and connections (Mermaid)       |
| **Message Flow**         | Per-artifact message flow from trigger to completion                           |
| **Components**           | Component inventory with details (adapters, endpoints, pipelines)              |
| **Missing Dependencies** | Dependencies that couldn't be resolved during discovery                        |
| **Gap Analysis**         | Features that have no direct Logic Apps equivalent, with suggested resolutions |
| **Patterns**             | Detected integration patterns (pub/sub, request-reply, batch, etc.)            |
| **Learn BizTalk**        | Educational content about the source BizTalk artifacts                         |

### Diagram Features

- Interactive Mermaid diagrams with zoom/pan
- Dark/light theme support
- Copilot chat integration — discuss or correct any flow group
- Badge indicators for gaps, dependencies, and patterns

## Contributing a New Platform

This project is open-source and designed for extensibility. There are **two ways** to add support for a new integration platform:

| Approach                              | Recommended? | Description                                                                         |
| ------------------------------------- | :----------: | ----------------------------------------------------------------------------------- |
| **Built-in parser** (PR to this repo) |  ✅ **Yes**  | Add a parser and skills directly to this project. Full integration with all stages. |
| **External parser extension**         |              | Create a separate VS Code extension that registers parsers via the plugin API.      |

**Built-in parsers are the recommended approach** — they ship with the extension, get the same CI/CD, and have access to all internal APIs.

### What You Need to Add

To fully support a new platform (e.g., TIBCO, IBM IIB, Workato), you need:

1. **A built-in parser** — parses source artifacts into IR documents
2. **Platform-specific skills** — AI instructions for each migration stage
3. **Platform detection** — auto-detect the platform from file patterns

### Step 1: Add a Built-in Parser

Create a new parser under `src/parsers/<platform>/`:

```
src/parsers/
├── biztalk/           # Reference implementation
│   ├── index.ts
│   ├── types.ts
│   ├── BizTalkProjectParser.ts
│   ├── BizTalkOrchestrationParser.ts
│   └── ...
├── <your-platform>/   # Your new parser
│   ├── index.ts
│   ├── types.ts
│   └── YourPlatformParser.ts
```

Each parser must implement the `IParser` interface:

```typescript
import { IParser, ParserCapabilities, ParseResult, ParseOptions } from '../types';
import { IRDocument, createEmptyIRDocument } from '../../ir/types';

export class YourPlatformParser implements IParser {
    get capabilities(): ParserCapabilities {
        return {
            platform: 'your-platform',
            fileExtensions: ['.yourext'],
            fileTypes: ['flow'],
            supportsFolder: false,
            description: 'Parses YourPlatform integration flows',
        };
    }

    canParse(filePath: string): boolean {
        return filePath.endsWith('.yourext');
    }

    async parse(filePath: string, options?: ParseOptions): Promise<ParseResult> {
        const ir = createEmptyIRDocument();
        // Parse the source file and populate the IR document
        // See docs/IRSchema.md for the complete schema
        // See docs/IRExamples_*.md for platform-specific examples
        return { ir, stats: { ... } };
    }
}
```

Then register it in `src/parsers/index.ts`:

```typescript
import { YourPlatformParser } from './your-platform';

export function initializeParsers(): void {
    // ... existing parsers ...
    defaultParserRegistry.register(new YourPlatformParser());
}
```

**Reference**: See the BizTalk parser implementation in `src/parsers/biztalk/` for a fully working example.

### Step 2: Add Platform-Specific Skills

Skills are Markdown files that provide **AI instructions** for each stage of the migration. They tell the Copilot agents how to analyze, plan, and convert artifacts for your specific platform.

Skills are organized under `resources/skills/`, with platform-specific variants:

```
resources/skills/
├── detect-logical-groups/
│   ├── biztalk/SKILL.md          # BizTalk-specific rules
│   ├── mulesoft/SKILL.md         # MuleSoft-specific rules
│   └── <your-platform>/SKILL.md  # Your platform rules
├── source-to-logic-apps-mapping/
│   ├── biztalk/SKILL.md
│   ├── mulesoft/SKILL.md
│   └── <your-platform>/SKILL.md
└── ... (13 skills total)
```

#### Skill Format

Each `SKILL.md` uses YAML frontmatter followed by Markdown content:

```markdown
---
name: source-to-logic-apps-mapping
description: One-to-one mapping of every YourPlatform component to its Azure Logic Apps Standard equivalent.
---

# YourPlatform to Azure Logic Apps Standard — Component Migration Reference

> Mapping of YourPlatform components to Logic Apps equivalents.

## Adapter Mappings

| YourPlatform Component | Logic Apps Equivalent | Native? | Notes           |
| ---------------------- | --------------------- | ------- | --------------- |
| HTTP Listener          | HTTP Trigger          | Yes     | Native built-in |
| Database Connector     | SQL Server connector  | Yes     | Native built-in |

...
```

#### Required Skills (13 total)

You should create a `<your-platform>/SKILL.md` variant for each of these skills:

| Skill                                   | Purpose                                                               | Agent                  |
| --------------------------------------- | --------------------------------------------------------------------- | ---------------------- |
| `detect-logical-groups`                 | Rules for grouping artifacts into logical flow groups                 | `@migration-analyser`  |
| `analyse-source-design`                 | Rules for analyzing source architecture and generating visualizations | `@migration-analyser`  |
| `dependency-and-decompilation-analysis` | Rules for identifying missing dependencies                            | `@migration-analyser`  |
| `source-to-logic-apps-mapping`          | Component-by-component mapping from source to Logic Apps              | All agents             |
| `logic-apps-planning-rules`             | Rules for generating migration plans                                  | `@migration-planner`   |
| `conversion-task-plan-rules`            | Rules for creating conversion task plans                              | `@migration-converter` |
| `scaffold-logic-apps-project`           | Rules for scaffolding the Logic Apps project structure                | `@migration-converter` |
| `workflow-json-generation-rules`        | Rules for generating workflow.json files                              | `@migration-converter` |
| `connections-json-generation-rules`     | Rules for generating connections.json                                 | `@migration-converter` |
| `dotnet-local-functions-logic-apps`     | Rules for generating .NET local functions                             | `@migration-converter` |
| `no-stubs-code-generation`              | Rules ensuring generated code is complete (no stubs/placeholders)     | `@migration-converter` |
| `runtime-validation-and-testing`        | Rules for runtime validation and testing                              | `@migration-converter` |
| `cloud-deployment-and-testing`          | Rules for cloud deployment and testing                                | `@migration-converter` |

**Tip**: Copy an existing platform's skills as a starting point (e.g., `biztalk/SKILL.md`) and adapt the content for your platform.

### Step 3: Register the Platform

Add your platform to the supported platforms list in `src/types/platforms.ts`:

```typescript
export type SourcePlatform = 'biztalk' | 'mulesoft' | 'your-platform';

export const SUPPORTED_PLATFORMS: PlatformInfo[] = [
    // ... existing platforms ...
    {
        id: 'your-platform',
        label: 'YourPlatform',
        description: 'YourPlatform version X',
        icon: '$(server)',
        filePatterns: ['.yourext', '.yourconfig'],
    },
];
```

Also add detection logic in `src/stages/discovery/PlatformDetector.ts` and file patterns in `src/stages/discovery/SourceFolderService.ts`.

### Step 4: Add IR Examples (Optional but Recommended)

Add a `docs/IRExamples_YourPlatform.md` documenting how your platform's artifacts map to the IR schema. The existing examples serve as templates:

- [docs/IRExamples_BizTalk.md](docs/IRExamples_BizTalk.md) — BizTalk reference
- [docs/IRExamples_MuleSoft.md](docs/IRExamples_MuleSoft.md) — MuleSoft reference
- [docs/IRExamples_Boomi.md](docs/IRExamples_Boomi.md) — Dell Boomi example
- [docs/IRExamples_IBMIIB.md](docs/IRExamples_IBMIIB.md) — IBM IIB/ACE example
- [docs/IRExamples_TIBCO.md](docs/IRExamples_TIBCO.md) — TIBCO BusinessWorks example
- [docs/IRExamples_Workato.md](docs/IRExamples_Workato.md) — Workato example

### Alternative: External Parser Extension

If you prefer not to contribute directly to this repo, you can create a separate VS Code extension that registers parsers via the plugin API:

```typescript
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
    const assistant = vscode.extensions.getExtension('microsoft.logicapps-migration-assistant');

    if (assistant) {
        const api = await assistant.activate();
        api.registerParser(new MyPlatformParser(), { priority: 10 });
    }
}
```

**Note**: External parser extensions only cover the **Discovery** stage (parsing source files). Skills, platform detection, and AI-powered planning/conversion require contributing to this repo directly.

#### Parser Plugin API

| Method / Property                  | Description                                       |
| ---------------------------------- | ------------------------------------------------- |
| `version`                          | Extension version (readonly)                      |
| `registerParser(parser, options?)` | Register a parser with the registry               |
| `unregisterParser(id)`             | Remove a registered parser                        |
| `getParserRegistry()`              | Access the parser registry directly               |
| `hasParser(id)`                    | Check if a parser is registered                   |
| `getExternalParsers()`             | Get information about registered external parsers |

### IR Schema

All parsers must output documents conforming to the IR (Intermediate Representation) schema. See [docs/IRSchema.md](docs/IRSchema.md) for the complete specification.

## Project Structure

```
src/
├── extension.ts              # Extension entry point
├── commands/                  # Command palette commands
├── constants/                 # Prompts and user messages
├── copilot/                   # Copilot integration (LM tools, context builder)
├── errors/                    # Error types and handler
├── ir/                        # Intermediate Representation (types, validation, serialization)
├── parsers/                   # Parser system (BizTalk, MuleSoft stubs, plugin loader)
├── services/                  # Core services (state, config, logging, telemetry)
├── stages/                    # Stage implementations (discovery, planning, conversion)
├── types/                     # Shared type definitions
├── ui/                        # Sidebar tree providers
└── views/                     # Webview panels (discovery, planning, conversion)

resources/
├── agents/                    # Copilot agent prompt files (migration-analyser, planner, converter)
├── icons/                     # Extension and activity bar icons
├── referenceDocs/             # BizTalk and Logic Apps reference documentation
├── referenceWorkflowsAndConnections/  # Reference Logic Apps workflow templates
└── skills/                    # Platform-specific AI skills (13 skills × N platforms)

docs/
├── IRSchema.md                # IR schema specification (complete v3 reference)
├── IRExamples_BizTalk.md      # BizTalk IR examples
├── IRExamples_MuleSoft.md     # MuleSoft IR examples
├── IRExamples_Boomi.md        # Dell Boomi IR examples (reference for contributors)
├── IRExamples_IBMIIB.md       # IBM IIB/ACE IR examples (reference for contributors)
├── IRExamples_TIBCO.md        # TIBCO BW IR examples (reference for contributors)
├── IRExamples_Workato.md      # Workato IR examples (reference for contributors)
├── SourceFlowVisualization.md # Source flow visualization documentation
└── UserFlow.md                # User flow documentation
```

## License

MIT License — see [LICENSE](LICENSE) for details.
