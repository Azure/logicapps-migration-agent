# Integration Migration Agent - User Flow Guide

> **Complete end-to-end UI mockups and user flow documentation for the Integration Migration Agent VS Code Extension**

## Table of Contents

- [Section 1: Installation & Initial Setup](#section-1-installation--initial-setup)
- [Section 2: Starting a Migration Project](#section-2-starting-a-migration-project)
- [Section 3: Discovery & Assessment Flow](#section-3-discovery--assessment-flow)
- [Section 4: Planning & Design Flow](#section-4-planning--design-flow)
- [Section 5: Conversion & Validation Flow](#section-5-conversion--validation-flow)
- [Section 6: Deployment & Verification Flow](#section-6-deployment--verification-flow)

---

## Section 1: Installation & Initial Setup

### 1.1 Extension Installation

#### Option A: VS Code Marketplace Installation

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VS CODE - EXTENSIONS MARKETPLACE                                           ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Integration Migration Agent                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │   🔄 Integration Migration Agent                                                │   │
│  │   ─────────────────────────────────────────────────────────────────────────────│   │
│  │                                                                                 │   │
│  │   Microsoft • ⭐⭐⭐⭐⭐ (4.8) • 15.2K installs                                  │   │
│  │                                                                                 │   │
│  │   Migrate BizTalk, MuleSoft, Boomi, and other integration platforms            │   │
│  │   to Azure Logic Apps Standard with AI-powered assistance.                      │   │
│  │                                                                                 │   │
│  │   ┌─────────────┐  ┌─────────────┐                                             │   │
│  │   │  Install    │  │  ★ Star     │                                             │   │
│  │   └─────────────┘  └─────────────┘                                             │   │
│  │                                                                                 │   │
│  │   ─────────────────────────────────────────────────────────────────────────────│   │
│  │                                                                                 │   │
│  │   📋 DETAILS                                                                    │   │
│  │                                                                                 │   │
│  │   Version:        1.2.0                                                         │   │
│  │   Last Updated:   January 15, 2026                                              │   │
│  │   Publisher:      Microsoft                                                     │   │
│  │   License:        MIT                                                           │   │
│  │                                                                                 │   │
│  │   📦 DEPENDENCIES                                                               │   │
│  │   • Azure Logic Apps (Standard) Extension                                       │   │
│  │   • GitHub Copilot (recommended)                                                │   │
│  │                                                                                 │   │
│  │   🏷️ TAGS                                                                       │   │
│  │   biztalk • mulesoft • azure • logic-apps • migration • integration            │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**User Action**: Click **Install** button

#### Installation Progress

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VS CODE - EXTENSIONS                                                       ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │   🔄 Integration Migration Agent                                                │   │
│  │                                                                                 │   │
│  │   Installing... ████████████░░░░░░░░░░░░░░░░░░░░ 45%                           │   │
│  │                                                                                 │   │
│  │   ✓ Downloading extension package                                               │   │
│  │   ✓ Verifying package signature                                                 │   │
│  │   ⏳ Installing dependencies...                                                 │   │
│  │   ○ Activating extension                                                        │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Installation Complete

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VS CODE - EXTENSIONS                                                       ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │   🔄 Integration Migration Agent                     v1.2.0          ✓ Enabled  │   │
│  │   ─────────────────────────────────────────────────────────────────────────────│   │
│  │                                                                                 │   │
│  │   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐          │   │
│  │   │    Disable        │  │    Uninstall      │  │  ⚙️ Settings      │          │   │
│  │   └───────────────────┘  └───────────────────┘  └───────────────────┘          │   │
│  │                                                                                 │   │
│  │   ─────────────────────────────────────────────────────────────────────────────│   │
│  │                                                                                 │   │
│  │   ✅ Installation successful!                                                   │   │
│  │                                                                                 │   │
│  │   🎉 Get Started:                                                               │   │
│  │   • Click the 🔄 icon in the Activity Bar (left sidebar)                       │   │
│  │   • Or press Ctrl+Shift+P and type "Integration Migration"                     │   │
│  │                                                                                 │   │
│  │   📖 View Documentation    🎬 Watch Tutorial Video                             │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  ℹ️ INFO: Reload VS Code to complete activation                    [Reload Now]        │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Option B: VSIX File Installation

**Step 1: Download VSIX File**

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  BROWSER - GitHub Releases                                                  ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  integration-migration-agent / Releases                                                 │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │   v1.2.0 - Latest Release                                     January 15, 2026 │   │
│  │   ═══════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │   🆕 What's New:                                                                │   │
│  │   • Added IBM IIB/ACE support                                                   │   │
│  │   • Improved DataWeave to Liquid conversion                                     │   │
│  │   • Enhanced gap detection accuracy                                             │   │
│  │                                                                                 │   │
│  │   📦 Assets:                                                                    │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────┐  │   │
│  │   │  📄 integration-migration-agent-1.2.0.vsix          12.4 MB   [Download]│  │   │
│  │   │  📄 Source code (zip)                                         [Download]│  │   │
│  │   │  📄 Source code (tar.gz)                                      [Download]│  │   │
│  │   └─────────────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Step 2: Install from VSIX in VS Code**

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VS CODE - COMMAND PALETTE                                                  ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  > Extensions: Install from VSIX...                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│    Extensions: Install from VSIX...                                                     │
│    Extensions: Disable All Installed Extensions                                         │
│    Extensions: Enable All Extensions                                                    │
│    Extensions: Show Recommended Extensions                                              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Step 3: Select VSIX File**

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  SELECT VSIX FILE                                                           ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  📁 Downloads                                                                           │
│  ├── 📄 integration-migration-agent-1.2.0.vsix     ← [Selected]                        │
│  ├── 📄 document.pdf                                                                    │
│  └── 📁 Projects                                                                        │
│                                                                                         │
│  File name: integration-migration-agent-1.2.0.vsix                                      │
│                                                                                         │
│                                           [Cancel]  [Install]                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Post-Installation: First Launch Experience

After installation and VS Code reload, the extension activates and shows:

#### Activity Bar Icon Appears

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │                                                                                  │
│  📁  │  VS CODE WORKSPACE                                                              │
│      │                                                                                  │
│  🔍  │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│  🔀  │                                                                                  │
│      │           Welcome to VS Code                                                     │
│  🐛  │                                                                                  │
│      │           Open a folder or workspace to get started                             │
│  📦  │                                                                                  │
│      │           [Open Folder]  [Clone Repository]                                     │
│ ───  │                                                                                  │
│      │                                                                                  │
│  🔄  │  ← NEW: Integration Migration Agent icon                                        │
│      │                                                                                  │
│ ───  │                                                                                  │
│      │                                                                                  │
│  ⚙️  │                                                                                  │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

#### Welcome Panel (First Launch)

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  INTEGRATION MIGRATION AGENT - WELCOME                               ─ □ ✕      │
│  📁  ├──────────────────────────────────────────────────────────────────────────────────┤
│      │                                                                                  │
│  🔍  │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │                                                                            │ │
│  🔀  │  │   🔄 Integration Migration Agent                                           │ │
│      │  │   ══════════════════════════════════════════════════════════════════════  │ │
│  🐛  │  │                                                                            │ │
│      │  │   Welcome! This extension helps you migrate enterprise integrations        │ │
│  📦  │  │   from legacy platforms to Azure Logic Apps Standard.                      │ │
│      │  │                                                                            │ │
│ ───  │  │   ─────────────────────────────────────────────────────────────────────── │ │
│      │  │                                                                            │ │
│  🔄  │  │   ✅ SUPPORTED SOURCE PLATFORMS                                            │ │
│  ●   │  │                                                                            │ │
│ ───  │  │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │ │
│      │  │   │   BizTalk    │ │   MuleSoft   │ │    Boomi     │ │   IBM IIB    │     │ │
│  ⚙️  │  │   │   Server     │ │   Anypoint   │ │  AtomSphere  │ │    / ACE     │     │ │
│      │  │   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘     │ │
│      │  │                                                                            │ │
│      │  │   ┌──────────────┐ ┌──────────────┐                                       │ │
│      │  │   │    TIBCO     │ │   Workato    │                                       │ │
│      │  │   │ BusinessWorks│ │              │                                       │ │
│      │  │   └──────────────┘ └──────────────┘                                       │ │
│      │  │                                                                            │ │
│      │  │   ─────────────────────────────────────────────────────────────────────── │ │
│      │  │                                                                            │ │
│      │  │   🚀 GET STARTED                                                           │ │
│      │  │                                                                            │ │
│      │  │   1. Open a folder containing your integration project                     │ │
│      │  │   2. Click "Start New Migration" below                                     │ │
│      │  │   3. Follow the 8-stage guided workflow                                    │ │
│      │  │                                                                            │ │
│      │  │   ┌─────────────────────────────────────────────────────────────────────┐ │ │
│      │  │   │                   🚀 Start New Migration                            │ │ │
│      │  │   └─────────────────────────────────────────────────────────────────────┘ │ │
│      │  │                                                                            │ │
│      │  │   ─────────────────────────────────────────────────────────────────────── │ │
│      │  │                                                                            │ │
│      │  │   📋 PREREQUISITES                                                         │ │
│      │  │                                                                            │ │
│      │  │   ☑️ VS Code 1.85.0+              ✓ Installed                              │ │
│      │  │   ☑️ Azure Logic Apps Extension    ✓ Installed                             │ │
│      │  │   ☑️ GitHub Copilot               ⚠️ Recommended (for AI features)         │ │
│      │  │   ☑️ Azure CLI                    ○ Optional (for deployment)              │ │
│      │  │                                                                            │ │
│      │  │   ─────────────────────────────────────────────────────────────────────── │ │
│      │  │                                                                            │ │
│      │  │   📖 Documentation    🎬 Tutorial    💬 Community                          │ │
│      │  │                                                                            │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Extension Settings Configuration

#### Accessing Settings

**Via Command Palette:**
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  COMMAND PALETTE                                                            ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  > Integration Migration: Open Settings                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│    Integration Migration: Open Settings                                                 │
│    Integration Migration: Start New Migration                                           │
│    Integration Migration: View Documentation                                            │
│    Integration Migration: Check for Updates                                             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Settings Panel

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  SETTINGS - Integration Migration Agent                                     ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  🔍 Search settings...                                              [@ext:integration] │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  📁 INTEGRATION MIGRATION AGENT                                                         │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  Source Platform                                                                │   │
│  │  Select the source integration platform to migrate from                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  biztalk                                                      ▼ │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │    Options: biztalk | mulesoft | boomi | ibm-iib | tibco | workato             │   │
│  │                                                                                 │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │                                                                                 │   │
│  │  Target Platform                                                                │   │
│  │  Target Azure platform for migration                                            │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  logic-apps-standard                                          ▼ │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │    Options: logic-apps-standard | logic-apps-consumption                       │   │
│  │                                                                                 │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │                                                                                 │   │
│  │  Output Folder                                                                  │   │
│  │  Folder name for generated migration artifacts (relative to workspace)          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  .migration                                                     │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │                                                                                 │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │                                                                                 │   │
│  │  ☑️ Enable Copilot Integration                                                  │   │
│  │     Use GitHub Copilot for AI-powered analysis and recommendations              │   │
│  │                                                                                 │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │                                                                                 │   │
│  │  ☑️ Generate Bicep Templates                                                    │   │
│  │     Auto-generate Infrastructure as Code during conversion                      │   │
│  │                                                                                 │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │                                                                                 │   │
│  │  ☑️ Include Test Scaffolds                                                      │   │
│  │     Generate test files for validation stage                                    │   │
│  │                                                                                 │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │                                                                                 │   │
│  │  📁 AZURE CONFIGURATION                                                         │   │
│  │                                                                                 │   │
│  │  Azure Subscription ID                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  (leave empty to select during deployment)                      │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │                                                                                 │   │
│  │  Default Resource Group                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  rg-integration-migration                                       │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │                                                                                 │   │
│  │  Default Azure Region                                                           │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  eastus                                                       ▼ │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.4 GitHub Copilot Setup (Recommended)

If GitHub Copilot is not installed, a prompt appears:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ⚠️ GitHub Copilot Recommended                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  Integration Migration Agent works best with GitHub Copilot for:               │   │
│  │                                                                                 │   │
│  │  • 🧠 Intelligent pattern detection                                             │   │
│  │  • 📊 Complexity analysis and scoring                                           │   │
│  │  • 🔍 Gap identification and recommendations                                    │   │
│  │  • 💡 Code conversion suggestions                                               │   │
│  │  • 📝 Documentation generation                                                  │   │
│  │                                                                                 │   │
│  │  The extension will still work without Copilot, but AI features                │   │
│  │  will be limited.                                                               │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │   │
│  │  │  Install Copilot    │  │  Continue Without   │  │  Don't Ask Again    │     │   │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘     │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.5 Azure Account Sign-In (For Deployment)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VS CODE - ACCOUNTS                                                         ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🔐 Sign in to Azure                                                            │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  To deploy Logic Apps to Azure, sign in with your Azure account.               │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                                                                         │   │   │
│  │  │   🌐 Sign in with Browser                                               │   │   │
│  │  │      Opens browser for Microsoft account authentication                 │   │   │
│  │  │                                                                         │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                                                                         │   │   │
│  │  │   🔑 Sign in with Device Code                                           │   │   │
│  │  │      For environments without browser access                            │   │   │
│  │  │                                                                         │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ℹ️ You can skip this step and sign in later during deployment.                │   │
│  │                                                                                 │   │
│  │                                                    [Skip for Now]              │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### After Sign-In Success

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  ✅ Azure: Signed in as user@company.com                                               │
│     Subscriptions: 3 available                                        [Switch Account] │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.6 Initial State - Ready to Start

After all setup is complete, the sidebar shows the ready state:

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │                                                                                  │
│  📁  │  MIGRATION AGENT                                                                │
│      │  ════════════════════════════════════════════════════════════════════════════   │
│  🔍  │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  🔀  │  │                                                                            │ │
│      │  │   🔄 No Active Migration                                                   │ │
│  🐛  │  │                                                                            │ │
│      │  │   ─────────────────────────────────────────────────────────────────────── │ │
│  📦  │  │                                                                            │ │
│      │  │   To begin a migration:                                                    │ │
│ ───  │  │                                                                            │ │
│      │  │   1. Open a folder containing your source                                  │ │
│  🔄  │  │      integration project (BizTalk, MuleSoft, etc.)                        │ │
│  ●   │  │                                                                            │ │
│ ───  │  │   2. Click the button below to start                                       │ │
│      │  │                                                                            │ │
│  ⚙️  │  │   ┌────────────────────────────────────────────────────────────────────┐  │ │
│      │  │   │              🚀 Start New Migration                                │  │ │
│      │  │   └────────────────────────────────────────────────────────────────────┘  │ │
│      │  │                                                                            │ │
│      │  │   ─────────────────────────────────────────────────────────────────────── │ │
│      │  │                                                                            │ │
│      │  │   📋 QUICK LINKS                                                           │ │
│      │  │                                                                            │ │
│      │  │   📖 Documentation                                                         │ │
│      │  │   🎬 Video Tutorials                                                       │ │
│      │  │   💬 Community Forum                                                       │ │
│      │  │   🐛 Report Issue                                                          │ │
│      │  │                                                                            │ │
│      │  │   ─────────────────────────────────────────────────────────────────────── │ │
│      │  │                                                                            │ │
│      │  │   ⚙️ CONFIGURATION                                                         │ │
│      │  │                                                                            │ │
│      │  │   Source Platform:  biztalk                                                │ │
│      │  │   Target Platform:  logic-apps-standard                                    │ │
│      │  │   Copilot:          ✅ Enabled                                             │ │
│      │  │   Azure:            ✅ Signed in                                           │ │
│      │  │                                                                            │ │
│      │  │                                              [⚙️ Settings]                 │ │
│      │  │                                                                            │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.7 Summary: Installation Checklist

| Step | Action | Status |
|------|--------|--------|
| 1 | Install extension from Marketplace or VSIX | ✅ |
| 2 | Reload VS Code | ✅ |
| 3 | Configure extension settings | ✅ |
| 4 | Install GitHub Copilot (recommended) | ⚠️ Optional |
| 5 | Sign in to Azure (for deployment) | ⚠️ Optional |
| 6 | Open source integration project folder | ⏳ Next Step |

---

## Section 2: Starting a Migration Project

### 2.1 Opening a Source Integration Project

#### Step 1: Open Folder in VS Code

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VS CODE - FILE MENU                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  File  Edit  Selection  View  Go  Run  Terminal  Help                                   │
│  ┌──────────────────────┐                                                               │
│  │  New File       Ctrl+N│                                                              │
│  │  New Window   Ctrl+Sh+N│                                                             │
│  │  ──────────────────── │                                                              │
│  │  Open File...  Ctrl+O │                                                              │
│  │  Open Folder...       │  ← Click this                                               │
│  │  Open Workspace...    │                                                              │
│  │  Open Recent        ▶ │                                                              │
│  │  ──────────────────── │                                                              │
│  │  Add Folder to...     │                                                              │
│  └──────────────────────┘                                                               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Step 2: Select Source Project Folder

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  SELECT FOLDER                                                              ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  📁 C:\Projects\BizTalk                                                                 │
│  ├── 📁 OrderProcessing                    ← Select this folder                        │
│  │   ├── 📁 Orchestrations                                                              │
│  │   │   ├── 📄 ProcessOrder.odx                                                        │
│  │   │   ├── 📄 HandleReturns.odx                                                       │
│  │   │   └── 📄 BatchProcessor.odx                                                      │
│  │   ├── 📁 Maps                                                                        │
│  │   │   ├── 📄 OrderToCanonical.btm                                                    │
│  │   │   └── 📄 CanonicalToSAP.btm                                                      │
│  │   ├── 📁 Schemas                                                                     │
│  │   │   ├── 📄 OrderRequest.xsd                                                        │
│  │   │   └── 📄 CanonicalOrder.xsd                                                      │
│  │   ├── 📁 Pipelines                                                                   │
│  │   │   └── 📄 ReceivePipeline.btp                                                     │
│  │   └── 📄 OrderProcessing.btproj                                                      │
│  └── 📁 InventoryManagement                                                             │
│                                                                                         │
│  Folder: OrderProcessing                                                                │
│                                                                                         │
│                                              [Cancel]  [Select Folder]                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Step 3: Project Opens in VS Code

```
┌──────┬────────────────────────────────┬─────────────────────────────────────────────────┐
│      │  EXPLORER                      │                                                 │
│  📁  │  ════════════════════════════  │  Welcome to OrderProcessing                     │
│      │                                │                                                 │
│  🔍  │  ▼ 📁 ORDERPROCESSING          │  This workspace contains a BizTalk Server       │
│      │    ▼ 📁 Orchestrations         │  project with integration artifacts.            │
│  🔀  │      📄 ProcessOrder.odx       │                                                 │
│      │      📄 HandleReturns.odx      │  ─────────────────────────────────────────────  │
│  🐛  │      📄 BatchProcessor.odx     │                                                 │
│      │    ▼ 📁 Maps                   │  Detected:                                      │
│  📦  │      📄 OrderToCanonical.btm   │  • 3 Orchestrations                             │
│      │      📄 CanonicalToSAP.btm     │  • 2 Maps                                       │
│ ───  │    ▼ 📁 Schemas                │  • 2 Schemas                                    │
│      │      📄 OrderRequest.xsd       │  • 1 Pipeline                                   │
│  🔄  │      📄 CanonicalOrder.xsd     │                                                 │
│  ●   │    ▼ 📁 Pipelines              │                                                 │
│ ───  │      📄 ReceivePipeline.btp    │                                                 │
│      │    📄 OrderProcessing.btproj   │                                                 │
│  ⚙️  │                                │                                                 │
│      │                                │                                                 │
└──────┴────────────────────────────────┴─────────────────────────────────────────────────┘
```

---

### 2.2 Project Detection Notification

When the extension detects a supported integration project:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  🔄 Integration Migration Agent                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  ✅ BizTalk Server project detected!                                                    │
│                                                                                         │
│  Found in: C:\Projects\BizTalk\OrderProcessing                                          │
│                                                                                         │
│  Would you like to start a migration to Azure Logic Apps?                               │
│                                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                         │
│  │  Start Migration│  │  View Details   │  │  Not Now        │                         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                         │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Alternative: Different Platform Detection**

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  🔄 Integration Migration Agent                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  ✅ MuleSoft Anypoint project detected!                                                 │
│                                                                                         │
│  Found: 4 Mule flows, 2 DataWeave transformations                                       │
│  Project: order-api (Mule 4.4)                                                          │
│                                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                         │
│  │  Start Migration│  │  View Details   │  │  Not Now        │                         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                         │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Starting Migration - Platform Selection

If user clicks **Start Migration** or uses the sidebar button:

#### Platform Selection Dialog

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  NEW MIGRATION - Select Source Platform                                     ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Select source platform...                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✨ DETECTED                                                                    │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ● BizTalk Server                                           ← Auto-detected    │   │
│  │    Found: .btproj, .odx, .btm, .xsd files                                      │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  ALL PLATFORMS                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ○ BizTalk Server 2016/2020                                                     │   │
│  │    Orchestrations, Maps, Schemas, Pipelines, Ports                             │   │
│  │                                                                                 │   │
│  │  ○ MuleSoft Anypoint (Mule 3/4)                                                 │   │
│  │    Mule Flows, DataWeave, Connectors, API Specs                                │   │
│  │                                                                                 │   │
│  │  ○ Dell Boomi AtomSphere                                                        │   │
│  │    Processes, Maps, Connectors, Profiles                                       │   │
│  │                                                                                 │   │
│  │  ○ IBM Integration Bus / App Connect Enterprise                                 │   │
│  │    Message Flows, ESQL, Subflows, Compute Nodes                                │   │
│  │                                                                                 │   │
│  │  ○ TIBCO BusinessWorks (5.x / 6.x)                                              │   │
│  │    Processes, Activities, XSLT, Shared Resources                               │   │
│  │                                                                                 │   │
│  │  ○ Workato                                                                      │   │
│  │    Recipes, Connections, Formulas                                              │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### After Selection - Confirmation

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  NEW MIGRATION - Confirm Configuration                                      ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  📋 MIGRATION CONFIGURATION                                                     │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  SOURCE                                                                         │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  Platform:       BizTalk Server                                                 │   │
│  │  Version:        2020 (auto-detected)                                           │   │
│  │  Project:        OrderProcessing                                                │   │
│  │  Location:       C:\Projects\BizTalk\OrderProcessing                            │   │
│  │                                                                                 │   │
│  │  TARGET                                                                         │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  Platform:       Azure Logic Apps Standard                                      │   │
│  │  Output Folder:  .migration                                                     │   │
│  │                                                                                 │   │
│  │  DETECTED ARTIFACTS                                                             │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  📄 Orchestrations:   3                                                         │   │
│  │  🗺️ Maps:             2                                                         │   │
│  │  📋 Schemas:          2                                                         │   │
│  │  🔧 Pipelines:        1                                                         │   │
│  │  🔌 Ports:            4 (from bindings)                                         │   │
│  │                                                                                 │   │
│  │  OPTIONS                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  ☑️ Enable Copilot AI assistance                                                │   │
│  │  ☑️ Generate Infrastructure as Code (Bicep)                                     │   │
│  │  ☑️ Include test scaffolds                                                      │   │
│  │  ☐ Include CI/CD pipeline templates                                             │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │                          [Cancel]         [🚀 Start Migration]                  │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.4 Migration Initialized - Sidebar Updates

After clicking **Start Migration**, the sidebar transforms to show the active migration:

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  🏷️ Source: BizTalk Server 2020                                                 │
│  🔀  │  🎯 Target: Logic Apps Standard                                                  │
│      │                                                                                  │
│  🐛  │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│  📦  │  📊 MIGRATION PROGRESS                                                           │
│      │                                                                                  │
│ ───  │  ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%                      │
│      │                                                                                  │
│  🔄  │  ─────────────────────────────────────────────────────────────────────────────  │
│  ●   │                                                                                  │
│ ───  │  📋 STAGES                                                                       │
│      │                                                                                  │
│  ⚙️  │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │                                                                            │ │
│      │  │  🔵 1. Discovery                                    [READY TO START]       │ │
│      │  │     Scan and parse source artifacts                                        │ │
│      │  │                                                                            │ │
│      │  │  🔒 2. Assessment                                   [LOCKED]               │ │
│      │  │     Analyze complexity and identify gaps                                   │ │
│      │  │                                                                            │ │
│      │  │  🔒 3. Planning                                     [LOCKED]               │ │
│      │  │     Create migration roadmap                                               │ │
│      │  │                                                                            │ │
│      │  │  🔒 4. Design                                       [LOCKED]               │ │
│      │  │     Map patterns and confirm approach                                      │ │
│      │  │                                                                            │ │
│      │  │  🔒 5. Conversion                                   [LOCKED]               │ │
│      │  │     Generate Logic Apps artifacts                                          │ │
│      │  │                                                                            │ │
│      │  │  🔒 6. Validation                                   [LOCKED]               │ │
│      │  │     Test and verify outputs                                                │ │
│      │  │                                                                            │ │
│      │  │  🔒 7. Deployment                                   [LOCKED]               │ │
│      │  │     Deploy to Azure                                                        │ │
│      │  │                                                                            │ │
│      │  │  🔒 8. Verification                                 [LOCKED]               │ │
│      │  │     UAT and sign-off                                                       │ │
│      │  │                                                                            │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │                    ▶️ Begin Discovery Stage                                │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  🔗 QUICK ACTIONS                                                               │
│      │                                                                                  │
│      │  📖 View Documentation                                                          │
│      │  ⚙️ Migration Settings                                                          │
│      │  🗑️ Cancel Migration                                                            │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.5 Chat Participant Introduction

The extension also registers a Copilot Chat participant. When the user opens Copilot Chat:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🤖 Welcome to GitHub Copilot Chat!                                             │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📦 AVAILABLE CHAT PARTICIPANTS                                                 │   │
│  │                                                                                 │   │
│  │  @workspace    - Ask about your workspace code                                  │   │
│  │  @vscode       - Ask about VS Code features                                     │   │
│  │  @terminal     - Ask about terminal commands                                    │   │
│  │  @migration    - Integration Migration Agent ← NEW                             │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  💡 TIP: Type @migration to get help with your BizTalk to Logic Apps           │   │
│  │      migration. Ask questions like:                                             │   │
│  │                                                                                 │   │
│  │      @migration what gaps exist in ProcessOrder.odx?                           │   │
│  │      @migration how do I convert this map to XSLT?                             │   │
│  │      @migration explain this orchestration's logic                             │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  💬 Ask Copilot or type / for commands...                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Example Chat Conversation - Project Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration give me an overview of this BizTalk project                        │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ## OrderProcessing Project Overview                                            │   │
│  │                                                                                 │   │
│  │  This is a **BizTalk Server 2020** integration project for order               │   │
│  │  processing. Here's what I found:                                               │   │
│  │                                                                                 │   │
│  │  ### Orchestrations (3)                                                         │   │
│  │                                                                                 │   │
│  │  | Name | Shapes | Complexity | Key Features |                                  │   │
│  │  |------|--------|------------|--------------|                                  │   │
│  │  | ProcessOrder.odx | 14 | Medium | Correlation, XSLT transform |              │   │
│  │  | HandleReturns.odx | 8 | Low | Simple request-response |                     │   │
│  │  | BatchProcessor.odx | 28 | High | Sequential convoy, atomic scope |          │   │
│  │                                                                                 │   │
│  │  ### Maps (2)                                                                   │   │
│  │  - `OrderToCanonical.btm` - 15 links, 3 functoids                              │   │
│  │  - `CanonicalToSAP.btm` - 22 links, 1 custom functoid ⚠️                       │   │
│  │                                                                                 │   │
│  │  ### External Connections                                                       │   │
│  │  - SQL Server (inventory database)                                              │   │
│  │  - SAP ERP (order creation)                                                     │   │
│  │  - SMTP (notifications)                                                         │   │
│  │                                                                                 │   │
│  │  ### Potential Migration Concerns                                               │   │
│  │  ⚠️ **Sequential Convoy** in BatchProcessor - requires Durable Functions       │   │
│  │  ⚠️ **Custom Functoid** in CanonicalToSAP - needs Azure Function               │   │
│  │  ⚠️ **Atomic Scope** - compensation logic redesign needed                       │   │
│  │                                                                                 │   │
│  │  Would you like me to start the Discovery stage to get detailed analysis?      │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  💬 Ask Copilot or type / for commands...                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.6 Starting Discovery Stage

When user clicks **Begin Discovery Stage**:

#### Confirmation Dialog

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  BEGIN DISCOVERY STAGE                                                      ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🔍 Stage 1: Discovery                                                          │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  This stage will:                                                               │   │
│  │                                                                                 │   │
│  │  ✓ Scan all BizTalk artifacts in the workspace                                  │   │
│  │  ✓ Parse orchestrations (.odx) to extract workflow logic                       │   │
│  │  ✓ Parse maps (.btm) to extract transformation rules                           │   │
│  │  ✓ Parse schemas (.xsd) for data contracts                                      │   │
│  │  ✓ Analyze pipelines and port bindings                                          │   │
│  │  ✓ Create Intermediate Representation (IR)                                      │   │
│  │  ✓ Generate artifact inventory                                                  │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📁 Artifacts to process:                                                       │   │
│  │                                                                                 │   │
│  │     3 Orchestrations                                                            │   │
│  │     2 Maps                                                                      │   │
│  │     2 Schemas                                                                   │   │
│  │     1 Pipeline                                                                  │   │
│  │     1 Binding file                                                              │   │
│  │                                                                                 │   │
│  │  ⏱️ Estimated time: 30-60 seconds                                               │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │                              [Cancel]         [▶️ Start Discovery]              │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Discovery In Progress

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  📍 Stage: Discovery (1/8)                                                       │
│  🔀  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🐛  │                                                                                  │
│      │  🔍 DISCOVERY IN PROGRESS                                                        │
│  📦  │                                                                                  │
│      │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  45%                      │
│ ───  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🔄  │                                                                                  │
│  ●   │  ✅ Scanning workspace...                               Complete                │
│ ───  │  ✅ Parsing ProcessOrder.odx...                         Complete                │
│      │  ⏳ Parsing HandleReturns.odx...                        In Progress             │
│  ⚙️  │  ○ Parsing BatchProcessor.odx...                        Pending                 │
│      │  ○ Parsing OrderToCanonical.btm...                      Pending                 │
│      │  ○ Parsing CanonicalToSAP.btm...                        Pending                 │
│      │  ○ Parsing Schemas...                                   Pending                 │
│      │  ○ Parsing Pipelines...                                 Pending                 │
│      │  ○ Analyzing Bindings...                                Pending                 │
│      │  ○ Creating Inventory...                                Pending                 │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  📊 Artifacts Processed: 2 / 9                                                   │
│      │  ⏱️ Elapsed: 12s                                                                 │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │                                              [Cancel Discovery]                  │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.7 Output Panel - Discovery Logs

The Output panel shows detailed logs during discovery:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  OUTPUT - Integration Migration Agent                                       ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  [2026-02-04 10:15:32] Starting Discovery Stage...                                      │
│  [2026-02-04 10:15:32] Workspace: C:\Projects\BizTalk\OrderProcessing                   │
│  [2026-02-04 10:15:32] Source Platform: BizTalk Server 2020                             │
│  [2026-02-04 10:15:33] ────────────────────────────────────────────────────────────     │
│  [2026-02-04 10:15:33] Scanning for BizTalk artifacts...                                │
│  [2026-02-04 10:15:33]   Found: 3 orchestrations (.odx)                                 │
│  [2026-02-04 10:15:33]   Found: 2 maps (.btm)                                           │
│  [2026-02-04 10:15:33]   Found: 2 schemas (.xsd)                                        │
│  [2026-02-04 10:15:33]   Found: 1 pipeline (.btp)                                       │
│  [2026-02-04 10:15:33]   Found: 1 binding file (.xml)                                   │
│  [2026-02-04 10:15:33] ────────────────────────────────────────────────────────────     │
│  [2026-02-04 10:15:34] Parsing orchestration: ProcessOrder.odx                          │
│  [2026-02-04 10:15:35]   ✓ Extracted 14 shapes                                          │
│  [2026-02-04 10:15:35]   ✓ Identified trigger: HTTP Receive                             │
│  [2026-02-04 10:15:35]   ✓ Found correlation set: OrderIdCorrelation                    │
│  [2026-02-04 10:15:35]   ✓ Found 2 map references                                       │
│  [2026-02-04 10:15:36] ────────────────────────────────────────────────────────────     │
│  [2026-02-04 10:15:36] Parsing orchestration: HandleReturns.odx                         │
│  [2026-02-04 10:15:37]   ✓ Extracted 8 shapes                                           │
│  [2026-02-04 10:15:37]   ✓ Identified trigger: Service Bus Queue                        │
│  [2026-02-04 10:15:37]   ✓ Found 1 map reference                                        │
│  [2026-02-04 10:15:38] ────────────────────────────────────────────────────────────     │
│  [2026-02-04 10:15:38] Parsing orchestration: BatchProcessor.odx                        │
│  [2026-02-04 10:15:39]   ✓ Extracted 28 shapes                                          │
│  [2026-02-04 10:15:39]   ⚠️ Found Sequential Convoy pattern                             │
│  [2026-02-04 10:15:39]   ⚠️ Found Atomic Scope with compensation                        │
│  [2026-02-04 10:15:40] ────────────────────────────────────────────────────────────     │
│  [2026-02-04 10:15:40] Parsing map: OrderToCanonical.btm                                 │
│  [2026-02-04 10:15:41]   ✓ Source schema: OrderRequest.xsd                              │
│  [2026-02-04 10:15:41]   ✓ Target schema: CanonicalOrder.xsd                            │
│  [2026-02-04 10:15:41]   ✓ Found 15 links, 3 standard functoids                         │
│  ...                                                                                    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.8 Workspace Files Created

After starting migration, the extension creates workspace files:

```
📁 OrderProcessing/
├── 📁 .vscode/
│   ├── 📁 migration/
│   │   ├── 📄 migration-state.json          ← State machine state
│   │   ├── 📄 migration-config.json         ← Migration configuration
│   │   └── 📄 (ir.json created after discovery)
│   └── 📄 settings.json
├── 📁 Orchestrations/
│   └── ...
├── 📁 Maps/
│   └── ...
└── 📄 OrderProcessing.btproj
```

#### migration-state.json (Initial)

```json
{
  "migrationId": "mig-20260204-101530",
  "projectName": "OrderProcessing",
  "sourcePlatform": "biztalk",
  "sourceVersion": "2020",
  "targetPlatform": "logic-apps-standard",
  "currentStage": "discovery",
  "stageStatus": "in-progress",
  "startedAt": "2026-02-04T10:15:30.000Z",
  "stages": {
    "discovery": { "status": "in-progress", "startedAt": "2026-02-04T10:15:32.000Z" },
    "assessment": { "status": "locked" },
    "planning": { "status": "locked" },
    "design": { "status": "locked" },
    "conversion": { "status": "locked" },
    "validation": { "status": "locked" },
    "deployment": { "status": "locked" },
    "verification": { "status": "locked" }
  }
}
```

---

### 2.9 Summary: Starting a Migration

| Step | User Action | System Response |
|------|-------------|-----------------|
| 1 | Open source project folder | Extension detects platform |
| 2 | Click "Start Migration" | Platform selection dialog |
| 3 | Confirm configuration | Migration initialized |
| 4 | Click "Begin Discovery" | Discovery stage starts |
| 5 | Wait for parsing | Progress shown in sidebar |
| 6 | Review inventory | Ready for Assessment |

---

## Section 3: Discovery & Assessment Flow

### 3.1 Discovery Complete - Results Panel

After discovery completes, a webview panel opens with results:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DISCOVERY RESULTS - OrderProcessing                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ DISCOVERY COMPLETE                                                          │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  All artifacts have been parsed and cataloged.                                  │   │
│  │                                                                                 │   │
│  │  📊 SUMMARY                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │      3      │  │      2      │  │      2      │  │      1      │            │   │
│  │  │ Orchestrat. │  │    Maps     │  │   Schemas   │  │  Pipelines  │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐                                              │   │
│  │  │      4      │  │      5      │                                              │   │
│  │  │    Ports    │  │ Connections │                                              │   │
│  │  └─────────────┘  └─────────────┘                                              │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📄 ARTIFACT INVENTORY                                                          │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Type          │ Name                    │ Status    │ Details           │   │   │
│  │  ├───────────────┼─────────────────────────┼───────────┼───────────────────┤   │   │
│  │  │ Orchestration │ ProcessOrder.odx        │ ✅ Parsed │ 14 shapes         │   │   │
│  │  │ Orchestration │ HandleReturns.odx       │ ✅ Parsed │ 8 shapes          │   │   │
│  │  │ Orchestration │ BatchProcessor.odx      │ ✅ Parsed │ 28 shapes ⚠️      │   │   │
│  │  │ Map           │ OrderToCanonical.btm    │ ✅ Parsed │ 15 links          │   │   │
│  │  │ Map           │ CanonicalToSAP.btm      │ ✅ Parsed │ 22 links, 1 custom│   │   │
│  │  │ Schema        │ OrderRequest.xsd        │ ✅ Parsed │ 12 elements       │   │   │
│  │  │ Schema        │ CanonicalOrder.xsd      │ ✅ Parsed │ 18 elements       │   │   │
│  │  │ Pipeline      │ ReceivePipeline.btp     │ ✅ Parsed │ XMLValidator      │   │   │
│  │  │ Binding       │ PortBindings.xml        │ ✅ Parsed │ 4 ports           │   │   │
│  │  └───────────────┴─────────────────────────┴───────────┴───────────────────┘   │   │
│  │                                                                                 │   │
│  │  ⚠️ 1 artifact has potential migration concerns (BatchProcessor.odx)           │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📁 IR FILE GENERATED                                                           │   │
│  │                                                                                 │   │
│  │  .vscode/migration/ir.json                              [View IR] [Open File]  │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ EXIT CRITERIA                                                               │   │
│  │                                                                                 │   │
│  │  ☑️ All artifacts parsed without errors                                         │   │
│  │  ☑️ Inventory created and reviewed                                              │   │
│  │  ☑️ Dependencies identified                                                     │   │
│  │  ☑️ IR file generated                                                           │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [📥 Export Inventory]    [� View Flow]    [🔍 View Details]    [▶️ Proceed to Assessment]   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Source Flow Visualizer

When user clicks **View Flow** on an artifact or right-clicks → "Visualize Flow", an interactive diagram opens:

#### Orchestration Flow View

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📊 SOURCE FLOW VISUALIZER                                              [🔍] [📤] [⚙]  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  Flow: ProcessOrder.odx                        Type: Orchestration                      │
│  Application: OrderProcessing                  Shapes: 14                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│                       ╔═══════════════════════╗                                         │
│                       ║   🟢 Receive_Order    ║                                         │
│                       ║   [HTTP: OrderPort]   ║                                         │
│                       ╚═══════════╤═══════════╝                                         │
│                                   │                                                     │
│                                   ▼                                                     │
│                       ┌───────────────────────┐                                         │
│                       │  📐 Transform_Order   │                                         │
│                       │  [OrderToCanonical]   │                                         │
│                       └───────────┬───────────┘                                         │
│                                   │                                                     │
│                                   ▼                                                     │
│                       ◇═══════════════════════◇                                         │
│                      ╱   🔶 Check_Inventory   ╲                                         │
│                     ◇═══════════════════════════◇                                       │
│                    ╱                              ╲                                      │
│          ┌────────┘ YES                      NO └────────┐                              │
│          │                                               │                              │
│          ▼                                               ▼                              │
│  ╔═══════════════════╗                       ┌───────────────────────┐                  │
│  ║  🔵 Send_Confirm  ║                       │  📐 Transform_Back    │                  │
│  ║ [HTTP: ConfirmSvc]║                       │  [BackOrderMap]       │                  │
│  ╚═══════════════════╝                       └───────────┬───────────┘                  │
│                                                          │                              │
│                                                          ▼                              │
│                                              ╔═══════════════════════╗                  │
│                                              ║  🔵 Send_Backorder   ║                  │
│                                              ║ [MSMQ: BackOrderQ]   ║                  │
│                                              ╚═══════════════════════╝                  │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  📋 Selected: Check_Inventory (Decide Shape)                          [View Source]     │
│  ├─ Condition: InventoryCount > OrderQuantity                                           │
│  └─ Branches: Send_Confirm (true), Transform_BackOrder (false)                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**User Actions:**
- 🔍 **Zoom** - Pan and zoom the diagram
- 📤 **Export** - Export as PNG, SVG, or Mermaid
- ⚙ **Settings** - Toggle labels, show/hide ports
- **Click shape** - View shape details in bottom panel
- **Double-click** - Open source file at shape definition

---

#### Messaging-Only (CBR) Flow View

For content-based routing without orchestrations:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📊 SOURCE FLOW VISUALIZER                                              [🔍] [📤] [⚙]  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  Flow: Order Routing                           Type: Messaging-Only (CBR)               │
│  Application: OrderProcessing                  Routes: 3                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│    ┌─────────────────────┐                                                              │
│    │  📥 FILE Receive    │                                                              │
│    │  Location: Orders/* │                                                              │
│    └─────────┬───────────┘                                                              │
│              │                                                                          │
│              ▼                                                                          │
│    ┌─────────────────────┐                                                              │
│    │  🔧 XMLReceive      │                                                              │
│    │  Pipeline           │                                                              │
│    └─────────┬───────────┘                                                              │
│              │                                                                          │
│              ▼                                                                          │
│    ╭─────────────────────╮                                                              │
│    │    📦 MessageBox    │                                                              │
│    │    (Pub/Sub Hub)    │                                                              │
│    ╰─────────┬───────────╯                                                              │
│              │                                                                          │
│     ┌────────┼────────┐                                                                 │
│     │        │        │                                                                 │
│     ▼        ▼        ▼                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐                                                            │
│  │ 🔵   │ │ 🔵   │ │ 🔵   │                                                            │
│  │ US   │ │ EU   │ │ APAC │   ← Filter Subscriptions                                   │
│  │Orders│ │Orders│ │Orders│                                                             │
│  └──┬───┘ └──┬───┘ └──┬───┘                                                            │
│     │        │        │                                                                 │
│     ▼        ▼        ▼                                                                 │
│  [HTTP]   [SFTP]   [MQ]                                                                │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  📋 Subscription Filters:                                                               │
│  ├─ US Orders:   Region = 'US' AND Priority > 5                                         │
│  ├─ EU Orders:   Region IN ('UK','DE','FR')                                             │
│  └─ APAC Orders: Region = 'APAC'                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

#### Pipeline Processing Flow View

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📊 SOURCE FLOW VISUALIZER                                              [🔍] [📤] [⚙]  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  Flow: ReceivePipeline.btp                     Type: Pipeline                           │
│  Direction: Receive                            Stages: 4                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│   │   DECODE     │───▶│ DISASSEMBLE  │───▶│   VALIDATE   │───▶│RESOLVE PARTY │         │
│   │              │    │              │    │              │    │              │         │
│   │ MIME/SMIME   │    │  XML         │    │ XMLValidator │    │  (none)      │         │
│   │ Decoder      │    │ Disassembler │    │              │    │              │         │
│   └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘         │
│                                                                                         │
│   Legend:  [Standard Component]  [Custom Component]                                    │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  📋 Selected: VALIDATE Stage                                           [View Source]    │
│  ├─ Component: XMLValidator                                                             │
│  ├─ Schema: OrderRequest.xsd                                                            │
│  └─ Recoverable Interchange: Enabled                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

#### Flow Type Selection (Application Overview)

When viewing the entire application:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📊 APPLICATION FLOW OVERVIEW - OrderProcessing                         [🔍] [📤] [⚙]  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Select a flow to visualize:                                                            │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │ Type          │ Name                    │ Complexity │ Action                   │   │
│  ├───────────────┼─────────────────────────┼────────────┼──────────────────────────┤   │
│  │ 🔄 Orchestrat.│ ProcessOrder.odx        │ Medium     │ [📊 View Flow]           │   │
│  │ 🔄 Orchestrat.│ HandleReturns.odx       │ Low        │ [📊 View Flow]           │   │
│  │ 🔄 Orchestrat.│ BatchProcessor.odx      │ High ⚠️    │ [📊 View Flow]           │   │
│  │ 📨 Messaging  │ Order CBR Routing       │ Medium     │ [📊 View Flow]           │   │
│  │ 🔧 Pipeline   │ ReceivePipeline.btp     │ Low        │ [📊 View Flow]           │   │
│  │ 🔧 Pipeline   │ SendPipeline.btp        │ Low        │ [📊 View Flow]           │   │
│  └───────────────┴─────────────────────────┴────────────┴──────────────────────────┘   │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  💡 Tip: Understanding source flows helps identify migration patterns and complexity.   │
│         Use flow diagrams to discuss migration approach with stakeholders.              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

> **📄 Detailed Visual Specifications**: See [SourceFlowVisualization.md](SourceFlowVisualization.md) for complete mockups.

---

### 3.3 Sidebar Updates - Discovery Complete

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  📍 Stage: Discovery (1/8) - Complete                                            │
│  🔀  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🐛  │                                                                                  │
│      │  📊 MIGRATION PROGRESS                                                           │
│  📦  │                                                                                  │
│      │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12.5%                   │
│ ───  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🔄  │                                                                                  │
│  ●   │  📋 STAGES                                                                       │
│ ───  │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  ⚙️  │  │                                                                            │ │
│      │  │  ✅ 1. Discovery                                    [COMPLETE]             │ │
│      │  │     9 artifacts parsed • IR generated                                      │ │
│      │  │                                                                            │ │
│      │  │  🔵 2. Assessment                                   [READY]                │ │
│      │  │     Analyze complexity and identify gaps                                   │ │
│      │  │                                                                            │ │
│      │  │  🔒 3. Planning                                     [LOCKED]               │ │
│      │  │  🔒 4. Design                                       [LOCKED]               │ │
│      │  │  🔒 5. Conversion                                   [LOCKED]               │ │
│      │  │  🔒 6. Validation                                   [LOCKED]               │ │
│      │  │  🔒 7. Deployment                                   [LOCKED]               │ │
│      │  │  🔒 8. Verification                                 [LOCKED]               │ │
│      │  │                                                                            │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  🔍 DISCOVERY SUMMARY                                                            │
│      │                                                                                  │
│      │  ▼ Orchestrations (3)                                              [📊 Flows]   │
│      │    📄 ProcessOrder.odx           14 shapes        [View Flow]                    │
│      │    📄 HandleReturns.odx          8 shapes         [View Flow]                    │
│      │    📄 BatchProcessor.odx         28 shapes ⚠️     [View Flow]                    │
│      │                                                                                  │
│      │  ▼ Messaging Routes (1)                                            [📊 Flows]   │
│      │    📨 Order CBR Routing          3 routes         [View Flow]                    │
│      │                                                                                  │
│      │  ▼ Maps (2)                                                                      │
│      │    🗺️ OrderToCanonical.btm       15 links                                        │
│      │    🗺️ CanonicalToSAP.btm         22 links                                        │
│      │                                                                                  │
│      │  ▼ Pipelines (1)                                                   [📊 Flows]   │
│      │    🔧 ReceivePipeline.btp        4 stages         [View Flow]                    │
│      │                                                                                  │
│      │  ▶ Schemas (2)                                                                   │
│      │  ▶ Ports (4)                                                                     │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │                    ▶️ Begin Assessment Stage                               │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 Stage Transition Dialog - Discovery to Assessment

When user clicks "Proceed to Assessment" or "Begin Assessment Stage":

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STAGE TRANSITION                                                           ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ Discovery Stage Complete                                                    │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  All exit criteria have been met:                                               │   │
│  │                                                                                 │   │
│  │  ☑️ All 9 artifacts parsed successfully                                         │   │
│  │  ☑️ Artifact inventory created                                                  │   │
│  │  ☑️ Dependencies mapped                                                         │   │
│  │  ☑️ IR file generated (.vscode/migration/ir.json)                               │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📋 NEXT: Assessment Stage                                                      │   │
│  │                                                                                 │   │
│  │  The Assessment stage will:                                                     │   │
│  │  • Calculate complexity scores for each artifact                                │   │
│  │  • Identify Enterprise Integration Patterns (EIP)                               │   │
│  │  • Detect migration gaps and unsupported features                               │   │
│  │  • Estimate effort for each artifact                                            │   │
│  │  • Use Copilot AI for intelligent analysis                                      │   │
│  │                                                                                 │   │
│  │  ⏱️ Estimated time: 1-2 minutes                                                 │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  ▶ Proceed to Assessment                                      ← Recommended    │   │
│  │  ◀ Review Discovery Results                                                     │   │
│  │  ✖ Stay in Discovery                                                            │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.5 Assessment Stage - In Progress

#### Assessment Progress Panel

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  📍 Stage: Assessment (2/8) - In Progress                                        │
│  🔀  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🐛  │                                                                                  │
│      │  🧠 ASSESSMENT IN PROGRESS                                                       │
│  📦  │                                                                                  │
│      │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░  55%                      │
│ ───  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🔄  │                                                                                  │
│  ●   │  ✅ Loading IR from discovery...                        Complete                │
│ ───  │  ✅ Analyzing ProcessOrder.odx...                       Complete                │
│      │  ✅ Analyzing HandleReturns.odx...                      Complete                │
│  ⚙️  │  ⏳ Analyzing BatchProcessor.odx...                     In Progress             │
│      │     🤖 Copilot: Detecting convoy pattern...                                     │
│      │  ○ Analyzing maps for functoid complexity...            Pending                 │
│      │  ○ Detecting Enterprise Integration Patterns...         Pending                 │
│      │  ○ Identifying migration gaps...                        Pending                 │
│      │  ○ Calculating effort estimates...                      Pending                 │
│      │  ○ Generating assessment report...                      Pending                 │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  🤖 COPILOT ANALYSIS                                                             │
│      │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │  Analyzing BatchProcessor.odx for patterns...                              │ │
│      │  │                                                                            │ │
│      │  │  Found: Sequential Convoy pattern                                          │ │
│      │  │  Found: Atomic Scope with compensation handler                             │ │
│      │  │  Checking Logic Apps compatibility...                                      │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  📊 Progress: 3 / 6 analysis tasks                                               │
│      │  ⏱️ Elapsed: 45s                                                                 │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Assessment Complete - Results Webview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ASSESSMENT RESULTS - OrderProcessing                                       ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  📊 ASSESSMENT COMPLETE                                                         │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Overall Project Complexity: 🟡 MEDIUM (Score: 58/100)                          │   │
│  │  Estimated Total Effort: 80-120 hours                                           │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📈 COMPLEXITY BREAKDOWN                                                        │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  ProcessOrder.odx                                                         │ │   │
│  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░  58/100  🟡 Medium        │ │   │
│  │  │  14 shapes • Correlation • 2 maps • Est: 24-40 hrs                        │ │   │
│  │  │                                                                           │ │   │
│  │  │  HandleReturns.odx                                                        │ │   │
│  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  32/100  🟢 Low          │ │   │
│  │  │  8 shapes • Simple flow • 1 map • Est: 8-16 hrs                           │ │   │
│  │  │                                                                           │ │   │
│  │  │  BatchProcessor.odx                                                       │ │   │
│  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  85/100  🔴 High         │ │   │
│  │  │  28 shapes • Convoy • Atomic scope • Est: 48-64 hrs                       │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🎯 PATTERNS DETECTED                                                           │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Pattern                  │ Artifact            │ Logic Apps Mapping       │ │   │
│  │  ├──────────────────────────┼─────────────────────┼──────────────────────────┤ │   │
│  │  │ Request-Reply            │ ProcessOrder        │ ✅ HTTP Trigger + Response│ │   │
│  │  │ Content-Based Router     │ ProcessOrder        │ ✅ Switch action          │ │   │
│  │  │ Message Translator       │ ProcessOrder        │ ✅ Transform action       │ │   │
│  │  │ Publish-Subscribe        │ HandleReturns       │ ✅ Service Bus trigger    │ │   │
│  │  │ Sequential Convoy        │ BatchProcessor      │ ⚠️ Durable Functions     │ │   │
│  │  │ Scatter-Gather           │ BatchProcessor      │ ✅ Parallel branches      │ │   │
│  │  │ Compensation             │ BatchProcessor      │ ⚠️ Saga pattern needed   │ │   │
│  │  └──────────────────────────┴─────────────────────┴──────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ⚠️ MIGRATION GAPS IDENTIFIED (4)                                               │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  🔴 HIGH SEVERITY (2)                                                     │ │   │
│  │  │  ───────────────────────────────────────────────────────────────────────  │ │   │
│  │  │                                                                           │ │   │
│  │  │  1. Sequential Convoy Pattern                      BatchProcessor.odx     │ │   │
│  │  │     BizTalk convoys collect correlated messages over time.                │ │   │
│  │  │     ⮕ Workaround: Use Durable Functions with external orchestration      │ │   │
│  │  │     ⮕ Effort: +16-24 hours                                               │ │   │
│  │  │                                                                           │ │   │
│  │  │  2. Atomic Scope with Compensation                 BatchProcessor.odx     │ │   │
│  │  │     BizTalk atomic scopes provide transaction-like behavior.              │ │   │
│  │  │     ⮕ Workaround: Implement Saga pattern with compensating actions       │ │   │
│  │  │     ⮕ Effort: +8-16 hours                                                │ │   │
│  │  │                                                                           │ │   │
│  │  │  🟡 MEDIUM SEVERITY (1)                                                   │ │   │
│  │  │  ───────────────────────────────────────────────────────────────────────  │ │   │
│  │  │                                                                           │ │   │
│  │  │  3. Custom Functoid                                CanonicalToSAP.btm     │ │   │
│  │  │     PriceCalculator functoid uses custom C# assembly.                     │ │   │
│  │  │     ⮕ Workaround: Convert to Azure Function, call from workflow          │ │   │
│  │  │     ⮕ Effort: +4-8 hours                                                 │ │   │
│  │  │                                                                           │ │   │
│  │  │  🟢 LOW SEVERITY (1)                                                      │ │   │
│  │  │  ───────────────────────────────────────────────────────────────────────  │ │   │
│  │  │                                                                           │ │   │
│  │  │  4. Custom Pipeline Component                      ReceivePipeline.btp    │ │   │
│  │  │     XMLValidator component for advanced validation.                       │ │   │
│  │  │     ⮕ Workaround: Use XML Validation action or Azure Function            │ │   │
│  │  │     ⮕ Effort: +2-4 hours                                                 │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  💡 COPILOT RECOMMENDATIONS                                                     │   │
│  │                                                                                 │   │
│  │  Based on analysis, I recommend:                                                │   │
│  │                                                                                 │   │
│  │  1. Start with HandleReturns.odx (low complexity, quick win)                   │   │
│  │  2. Convert ProcessOrder.odx next (medium complexity, high value)              │   │
│  │  3. Leave BatchProcessor.odx for last (requires architecture decisions)        │   │
│  │                                                                                 │   │
│  │  Consider breaking BatchProcessor into multiple smaller workflows              │   │
│  │  to reduce complexity and improve maintainability.                              │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ EXIT CRITERIA                                                               │   │
│  │                                                                                 │   │
│  │  ☑️ Complexity scores calculated for all artifacts                              │   │
│  │  ☑️ Patterns identified and mapped                                              │   │
│  │  ☑️ Gaps documented with workarounds                                            │   │
│  │  ☑️ Effort estimates provided                                                   │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [📥 Export Report]   [🔍 View Full IR]   [▶️ Proceed to Planning]              │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.7 Chat Conversation - Assessment Queries

Users can ask the `@migration` chat participant about assessment results:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration explain the convoy pattern gap in BatchProcessor                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ## Sequential Convoy Pattern in BatchProcessor.odx                            │   │
│  │                                                                                 │   │
│  │  ### What BizTalk Does                                                          │   │
│  │                                                                                 │   │
│  │  The `BatchProcessor.odx` uses a **Sequential Convoy** pattern to:             │   │
│  │  - Receive multiple related messages over time                                  │   │
│  │  - Correlate them using `BatchId` correlation set                              │   │
│  │  - Accumulate until a "batch complete" signal arrives                          │   │
│  │  - Process all messages together                                                │   │
│  │                                                                                 │   │
│  │  ```                                                                            │   │
│  │  [Receive BatchItem] ──┬── correlate on BatchId                                │   │
│  │         ↓              │                                                        │   │
│  │  [Loop: Receive more]──┘                                                        │   │
│  │         ↓                                                                       │   │
│  │  [Receive BatchComplete] ── same BatchId                                        │   │
│  │         ↓                                                                       │   │
│  │  [Process All Items]                                                            │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  ### Why It's a Gap                                                             │   │
│  │                                                                                 │   │
│  │  Logic Apps Standard doesn't have built-in convoy support because:             │   │
│  │  - Workflows are stateless by default (each trigger = new instance)            │   │
│  │  - No native "wait for correlated messages" mechanism                           │   │
│  │  - Can't pause workflow waiting for future messages                             │   │
│  │                                                                                 │   │
│  │  ### Recommended Solution: Durable Functions                                    │   │
│  │                                                                                 │   │
│  │  Use **Azure Durable Functions** with the "Eternal Orchestration" pattern:     │   │
│  │                                                                                 │   │
│  │  ```csharp                                                                      │   │
│  │  [FunctionName("BatchOrchestrator")]                                           │   │
│  │  public static async Task Run(                                                  │   │
│  │      [OrchestrationTrigger] IDurableOrchestrationContext context)              │   │
│  │  {                                                                              │   │
│  │      var batchId = context.GetInput<string>();                                 │   │
│  │      var items = new List<BatchItem>();                                        │   │
│  │                                                                                 │   │
│  │      while (true)                                                               │   │
│  │      {                                                                          │   │
│  │          var message = await context.WaitForExternalEvent<Message>("NewItem"); │   │
│  │                                                                                 │   │
│  │          if (message.Type == "BatchComplete")                                  │   │
│  │              break;                                                             │   │
│  │                                                                                 │   │
│  │          items.Add(message.Item);                                              │   │
│  │      }                                                                          │   │
│  │                                                                                 │   │
│  │      await context.CallActivityAsync("ProcessBatch", items);                   │   │
│  │  }                                                                              │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  ### Alternative: Service Bus Sessions                                          │   │
│  │                                                                                 │   │
│  │  If messages arrive quickly, you could also use Service Bus Sessions           │   │
│  │  with a Logic App that processes session messages in order.                    │   │
│  │                                                                                 │   │
│  │  Would you like me to generate the Durable Functions scaffold for this?        │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration what's the total effort if I skip BatchProcessor for now?          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ## Effort Estimate Without BatchProcessor                                      │   │
│  │                                                                                 │   │
│  │  If you defer `BatchProcessor.odx` to a later phase:                           │   │
│  │                                                                                 │   │
│  │  | Artifact | Complexity | Effort | Gaps |                                      │   │
│  │  |----------|------------|--------|------|                                      │   │
│  │  | ProcessOrder.odx | Medium | 24-40 hrs | None critical |                     │   │
│  │  | HandleReturns.odx | Low | 8-16 hrs | None |                                 │   │
│  │  | Maps (2) | Low | 4-8 hrs | 1 custom functoid |                              │   │
│  │  | Schemas | Trivial | 1-2 hrs | None |                                        │   │
│  │  | **Total** | | **37-66 hrs** | |                                             │   │
│  │                                                                                 │   │
│  │  ### Comparison                                                                 │   │
│  │                                                                                 │   │
│  │  - **With BatchProcessor**: 80-120 hours                                       │   │
│  │  - **Without BatchProcessor**: 37-66 hours                                     │   │
│  │  - **Savings**: ~50% reduction in initial effort                               │   │
│  │                                                                                 │   │
│  │  This is a good strategy for a phased migration! 👍                            │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.8 Chat-Based Corrections (Override System)

Users can **correct any Discovery or Assessment finding** directly via chat. The agent updates the IR and all UI components refresh automatically.

#### Correction Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CHAT → IR → UI UPDATE FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  User types correction in Chat:
  "Change BatchProcessor complexity to HIGH - it has convoy pattern"
                                        │
                                        ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │  CHAT PARTICIPANT parses intent → calls overrideAssessment tool                     │
  └─────────────────────────────────────┬───────────────────────────────────────────────┘
                                        │
                                        ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │  IR SERVICE updates ir.json → emits "ir:updated" event                              │
  └───────────┬─────────────────────────┬───────────────────────────────────────────────┘
              │                         │
              ▼                         ▼
  ┌───────────────────────┐   ┌───────────────────────┐
  │  SIDEBAR refreshes    │   │  WEBVIEW re-renders   │
  │  tree items           │   │  with new values      │
  └───────────────────────┘   └───────────────────────┘
```

#### Example: Correcting Complexity Score

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration The BatchProcessor complexity should be HIGH, not medium.          │   │
│  │  It has a Sequential Convoy pattern which is very complex to migrate.          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ **Updated BatchProcessor.odx complexity**                                   │   │
│  │                                                                                 │   │
│  │  | Field | Previous | New | Reason |                                            │   │
│  │  |-------|----------|-----|--------|                                            │   │
│  │  | Complexity | Medium | **HIGH** | Sequential Convoy pattern |                 │   │
│  │                                                                                 │   │
│  │  The assessment results and sidebar have been updated. The effort estimate     │   │
│  │  has been recalculated:                                                         │   │
│  │                                                                                 │   │
│  │  - **Previous effort**: 32-48 hours                                            │   │
│  │  - **New effort**: 48-72 hours (+50%)                                          │   │
│  │                                                                                 │   │
│  │  This change is tracked in the IR for audit purposes.                          │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Sidebar automatically updates:**

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│  🔄  │  ▼ Orchestrations (3)                                                            │
│      │    📄 ProcessOrder.odx           🟡 Medium                                       │
│      │    📄 HandleReturns.odx          🟢 Low                                          │
│      │    📄 BatchProcessor.odx         🔴 HIGH 🔧    ← Updated! Override indicator    │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

#### Example: Adding a Missing Dependency

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration Add CustomLogger.dll as a dependency to ProcessOrder.              │   │
│  │  The orchestration calls it for audit logging.                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ **Added dependency to ProcessOrder.odx**                                    │   │
│  │                                                                                 │   │
│  │  ```                                                                            │   │
│  │  + CustomLogger.dll (External .NET Assembly)                                   │   │
│  │    Type: custom-code                                                            │   │
│  │    Migration: Requires Azure Function or inline code                           │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  ⚠️ This adds a new gap: Custom .NET code requires manual migration.           │   │
│  │                                                                                 │   │
│  │  Would you like me to scaffold an Azure Function for the logging logic?        │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Example: Removing a False Positive Gap

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration Remove the SMTP adapter gap - we're not using that send port       │   │
│  │  anymore, it was disabled in production.                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ **Removed gap: SMTP Adapter migration**                                     │   │
│  │                                                                                 │   │
│  │  Gap removed from ProcessOrder.odx assessment.                                  │   │
│  │  Reason: "Port disabled in production - not in migration scope"                │   │
│  │                                                                                 │   │
│  │  **Updated gap count**: 3 → 2 gaps remaining                                   │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Example: Excluding an Artifact

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration Exclude TestOrchestration.odx from the migration - it's only       │   │
│  │  used for testing and won't be deployed to production.                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ⚠️ **Confirm exclusion**                                                       │   │
│  │                                                                                 │   │
│  │  You're about to exclude **TestOrchestration.odx** from migration scope.        │   │
│  │                                                                                 │   │
│  │  - File: /Orchestrations/TestOrchestration.odx                                  │   │
│  │  - Shapes: 5                                                                    │   │
│  │  - Dependencies: 1 map, 2 schemas                                              │   │
│  │                                                                                 │   │
│  │  Dependencies will remain available if other artifacts need them.              │   │
│  │                                                                                 │   │
│  │  Type **"confirm"** to proceed or **"cancel"** to abort.                        │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  confirm                                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ **TestOrchestration.odx excluded from migration**                           │   │
│  │                                                                                 │   │
│  │  The artifact will appear grayed out in the sidebar and won't be included      │   │
│  │  in conversion or deployment.                                                   │   │
│  │                                                                                 │   │
│  │  To re-include later, say: "@migration include TestOrchestration"              │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Supported Correction Commands

| What to Correct | Example Chat Command |
|-----------------|---------------------|
| **Complexity** | "Change X complexity to HIGH" |
| **Effort estimate** | "X effort should be 40 hours, not 20" |
| **Pattern** | "X isn't scatter-gather, it's content-based router" |
| **Add dependency** | "Add CustomLogger.dll as dependency to X" |
| **Remove dependency** | "Remove unused.dll from X dependencies" |
| **Add gap** | "Add a gap for the custom encoder in X" |
| **Remove gap** | "Remove the SMTP gap from X" |
| **Exclude artifact** | "Exclude X from migration" |
| **Include artifact** | "Include X back in migration" |
| **Change mapping** | "Map SAP adapter to Premium connector instead" |

#### Override Tracking in IR

All corrections are tracked for audit:

```json
{
  "overrides": [
    {
      "id": "override-001",
      "field": "migration.complexity",
      "originalValue": "medium",
      "newValue": "high",
      "reason": "Contains Sequential Convoy pattern",
      "source": "chat",
      "timestamp": "2026-02-04T14:30:00Z",
      "user": "architect@company.com"
    }
  ]
}
```

#### UI Override Indicators

Values that have been manually overridden show a 🔧 indicator:

```
┌─────────────────────────────────────────────────────────────────┐
│  BatchProcessor.odx                                             │
│  ├─ Complexity: HIGH 🔧         ← Override indicator            │
│  │              (was: Medium)   ← Original value shown          │
│  ├─ Effort: 48-72 hours 🔧                                      │
│  └─ Gaps: 2                                                     │
│                                                                 │
│  [View Override History]        ← See all changes               │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.9 Viewing Individual Artifact Details

Clicking on an artifact in the sidebar or results panel opens detailed view:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ARTIFACT DETAILS - ProcessOrder.odx                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  📄 ProcessOrder.odx                                                            │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Type: Orchestration            Complexity: 🟡 Medium (58/100)                  │   │
│  │  Shapes: 14                     Estimated Effort: 24-40 hours                   │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🔄 WORKFLOW STRUCTURE                                                          │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                                                                         │   │   │
│  │  │  [HTTP Receive] ─── Trigger                                             │   │   │
│  │  │       │                                                                 │   │   │
│  │  │       ▼                                                                 │   │   │
│  │  │  [Initialize Variables]                                                 │   │   │
│  │  │       │                                                                 │   │   │
│  │  │       ▼                                                                 │   │   │
│  │  │  [Transform: OrderToCanonical] ─── XSLT Map                             │   │   │
│  │  │       │                                                                 │   │   │
│  │  │       ▼                                                                 │   │   │
│  │  │  [Decide: CheckInventory] ─── Content-Based Router                      │   │   │
│  │  │       │                                                                 │   │   │
│  │  │   ┌───┴───┐                                                             │   │   │
│  │  │   │       │                                                             │   │   │
│  │  │   ▼       ▼                                                             │   │   │
│  │  │  [Yes]   [No]                                                           │   │   │
│  │  │   │       │                                                             │   │   │
│  │  │   ▼       ▼                                                             │   │   │
│  │  │ [SQL:   [Queue:                                                         │   │   │
│  │  │  Check]  Backorder]                                                     │   │   │
│  │  │   │       │                                                             │   │   │
│  │  │   └───┬───┘                                                             │   │   │
│  │  │       │                                                                 │   │   │
│  │  │       ▼                                                                 │   │   │
│  │  │  [Transform: CanonicalToSAP]                                            │   │   │
│  │  │       │                                                                 │   │   │
│  │  │       ▼                                                                 │   │   │
│  │  │  [SAP: CreateOrder]                                                     │   │   │
│  │  │       │                                                                 │   │   │
│  │  │       ▼                                                                 │   │   │
│  │  │  [Send Response]                                                        │   │   │
│  │  │                                                                         │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📋 SHAPES BREAKDOWN                                                            │   │
│  │                                                                                 │   │
│  │  │ Shape Type    │ Count │ Logic Apps Mapping │                                │   │
│  │  ├───────────────┼───────┼────────────────────┤                                │   │
│  │  │ Receive       │ 1     │ HTTP Trigger       │                                │   │
│  │  │ Send          │ 2     │ Response + HTTP    │                                │   │
│  │  │ Transform     │ 2     │ Transform XML      │                                │   │
│  │  │ Decide        │ 1     │ Switch/Condition   │                                │   │
│  │  │ Expression    │ 3     │ Compose/Variables  │                                │   │
│  │  │ Scope         │ 2     │ Scope action       │                                │   │
│  │  │ Construct Msg │ 3     │ Compose            │                                │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🔗 DEPENDENCIES                                                                │   │
│  │                                                                                 │   │
│  │  Maps:     OrderToCanonical.btm, CanonicalToSAP.btm                            │   │
│  │  Schemas:  OrderRequest.xsd, CanonicalOrder.xsd, SAPOrder.xsd                  │   │
│  │  Ports:    OrderReceivePort (HTTP), SAPSendPort (SAP Adapter)                  │   │
│  │            InventoryPort (SQL), BackorderQueue (Service Bus)                   │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  [View Source]  [View IR]  [Open in Editor]                                    │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.10 IR File Updated After Assessment

The IR file is enriched with assessment data:

```json
{
  "$schema": "integration-migration-agent/ir/v3",
  "$version": "3.0.0",
  
  "metadata": {
    "id": "order-processing-001",
    "name": "OrderProcessing",
    "source": {
      "platform": "biztalk",
      "version": "2020"
    },
    "migration": {
      "complexity": "medium",
      "complexityScore": 58,
      "estimatedEffort": {
        "min": 80,
        "max": 120,
        "unit": "hours"
      },
      "assessedAt": "2026-02-04T10:25:00.000Z",
      "assessedBy": "copilot-gpt4"
    }
  },
  
  "gaps": [
    {
      "id": "gap-001",
      "category": "pattern",
      "severity": "high",
      "title": "Sequential Convoy Pattern",
      "description": "BizTalk convoy pattern not directly supported in Logic Apps",
      "affectedArtifact": "BatchProcessor.odx",
      "resolution": {
        "strategy": "durable-functions",
        "description": "Use Durable Functions orchestration",
        "effortHours": { "min": 16, "max": 24 }
      }
    }
  ],
  
  "patterns": [
    {
      "id": "pattern-001",
      "type": "request-reply",
      "artifact": "ProcessOrder.odx",
      "confidence": 0.95,
      "targetMapping": {
        "logicAppsPattern": "http-trigger-response",
        "supported": true
      }
    }
  ]
}
```

---

### 3.11 Summary: Discovery & Assessment Flow

| Step | Stage | User Action | System Response |
|------|-------|-------------|-----------------|
| 1 | Discovery | Click "Begin Discovery" | Parsers scan artifacts |
| 2 | Discovery | Wait for completion | IR file generated |
| 3 | Discovery | Review inventory | Validate artifacts parsed |
| 4 | Discovery | Click "Proceed to Assessment" | Stage transition |
| 5 | Assessment | Wait for AI analysis | Copilot analyzes patterns |
| 6 | Assessment | Review complexity scores | Understand effort |
| 7 | Assessment | Review gaps | Plan workarounds |
| 8 | Assessment | Ask questions via @migration | Get detailed explanations |
| 9 | Assessment | Click "Proceed to Planning" | Ready for next stage |

---

## Section 4: Planning & Design Flow

### 4.1 Starting Planning Stage

When user clicks "Proceed to Planning":

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  BEGIN PLANNING STAGE                                                       ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  📋 Stage 3: Planning                                                           │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  This stage will help you:                                                      │   │
│  │                                                                                 │   │
│  │  ✓ Define migration waves (which artifacts to migrate first)                    │   │
│  │  ✓ Set priority order based on complexity and dependencies                      │   │
│  │  ✓ Create timeline and milestones                                               │   │
│  │  ✓ Review resource requirements                                                 │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 From Assessment:                                                            │   │
│  │                                                                                 │   │
│  │     3 Orchestrations to migrate                                                 │   │
│  │     4 Gaps requiring resolution                                                 │   │
│  │     Estimated total effort: 80-120 hours                                        │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │                              [Cancel]         [▶️ Start Planning]               │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Migration Wave Planning Panel

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  MIGRATION PLANNING - OrderProcessing                                       ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  📋 MIGRATION WAVE PLANNING                                                     │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Organize your migration into waves. Copilot suggests starting with            │   │
│  │  low-complexity items to build confidence and validate patterns.                │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🌊 WAVE 1 - Quick Wins                          Estimated: 8-16 hours         │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  ☑️ HandleReturns.odx                                    🟢 Low         │   │   │
│  │  │     Simple request-response • No gaps • Quick validation                │   │   │
│  │  │                                                      [↑] [↓] [Remove]   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  💡 Copilot: "Start here to validate your development workflow and             │   │
│  │     connection configurations before tackling complex migrations."              │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🌊 WAVE 2 - Core Business Logic                 Estimated: 28-48 hours        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  ☑️ ProcessOrder.odx                                     🟡 Medium      │   │   │
│  │  │     Core order processing • 1 custom functoid gap                       │   │   │
│  │  │     Dependencies: OrderToCanonical.btm, CanonicalToSAP.btm             │   │   │
│  │  │                                                      [↑] [↓] [Remove]   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  ☑️ OrderToCanonical.btm                                 🟢 Low         │   │   │
│  │  │     Standard functoids only • Direct XSLT conversion                    │   │   │
│  │  │                                                      [↑] [↓] [Remove]   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  ☑️ CanonicalToSAP.btm                                   🟡 Medium      │   │   │
│  │  │     Contains custom PriceCalculator functoid → Azure Function           │   │   │
│  │  │                                                      [↑] [↓] [Remove]   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🌊 WAVE 3 - Complex Patterns                    Estimated: 48-64 hours        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  ☑️ BatchProcessor.odx                                   🔴 High        │   │   │
│  │  │     Sequential Convoy • Atomic Scope • Compensation                     │   │   │
│  │  │     ⚠️ Requires Durable Functions + Saga pattern design                │   │   │
│  │  │                                                      [↑] [↓] [Remove]   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  💡 Copilot: "Consider breaking this into 2 separate workflows:               │   │
│  │     BatchCollector and BatchProcessor for better maintainability."             │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ➕ UNASSIGNED ARTIFACTS                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  (All artifacts have been assigned to waves)                            │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │                                        [+ Add Wave]  [🤖 Copilot Suggest]       │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Timeline Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  MIGRATION PLANNING - Timeline                                              ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  📅 MIGRATION TIMELINE                                                          │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Based on effort estimates and wave assignments:                                │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  Feb 2026                                                                       │   │
│  │  ├─────────────────────────────────────────────────────────────────────────┤   │   │
│  │  │  Week 1          │  Week 2          │  Week 3          │  Week 4        │   │   │
│  │  │  ░░░░░░░░░░░░░░  │                  │                  │                │   │   │
│  │  │  🌊 Wave 1       │                  │                  │                │   │   │
│  │  │  HandleReturns   │                  │                  │                │   │   │
│  │  │                  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │                │   │   │
│  │  │                  │  🌊 Wave 2                          │                │   │   │
│  │  │                  │  ProcessOrder + Maps                │                │   │   │
│  │  │                  │                  │                  │  ░░░░░░░░░░░░  │   │   │
│  │  │                  │                  │                  │  🌊 Wave 3     │   │   │
│  │  ├─────────────────────────────────────────────────────────────────────────┤   │   │
│  │                                                                                 │   │
│  │  March 2026                                                                     │   │
│  │  ├─────────────────────────────────────────────────────────────────────────┤   │   │
│  │  │  Week 1          │  Week 2          │                                   │   │   │
│  │  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                  │   │   │
│  │  │  🌊 Wave 3 (continued)                                                  │   │   │
│  │  │  BatchProcessor + Durable Functions                                     │   │   │
│  │  │                  │  ░░░░░░░░░░░░░░  │                                   │   │   │
│  │  │                  │  ✅ UAT & Deploy │                                   │   │   │
│  │  ├─────────────────────────────────────────────────────────────────────────┤   │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 TIMELINE SUMMARY                                                            │   │
│  │                                                                                 │   │
│  │  │ Wave │ Start Date │ End Date   │ Duration │ Dependencies        │           │   │
│  │  ├──────┼────────────┼────────────┼──────────┼─────────────────────┤           │   │
│  │  │ 1    │ Feb 4      │ Feb 7      │ 4 days   │ None                │           │   │
│  │  │ 2    │ Feb 10     │ Feb 21     │ 10 days  │ Wave 1 complete     │           │   │
│  │  │ 3    │ Feb 24     │ Mar 7      │ 10 days  │ Wave 2 complete     │           │   │
│  │  │ UAT  │ Mar 10     │ Mar 14     │ 5 days   │ All waves complete  │           │   │
│  │                                                                                 │   │
│  │  Total Duration: ~6 weeks                                                       │   │
│  │  Target Completion: March 14, 2026                                              │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  [Adjust Dates]  [Add Milestones]  [Export to Project Plan]                    │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Planning Complete - Confirm Plan

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  PLANNING COMPLETE                                                          ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ MIGRATION PLAN READY                                                        │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Your migration plan has been created. Please review and approve:               │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📋 PLAN SUMMARY                                                                │   │
│  │                                                                                 │   │
│  │  Waves:              3                                                          │   │
│  │  Total Artifacts:    6 (3 orchestrations, 2 maps, 1 pipeline)                  │   │
│  │  Estimated Effort:   80-120 hours                                               │   │
│  │  Target Completion:  March 14, 2026                                             │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ EXIT CRITERIA                                                               │   │
│  │                                                                                 │   │
│  │  ☑️ Migration waves defined                                                     │   │
│  │  ☑️ Priority order established                                                  │   │
│  │  ☑️ Timeline approved                                                           │   │
│  │  ☑️ Dependencies identified                                                     │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [📥 Export Plan]   [← Edit Plan]   [▶️ Proceed to Design]                      │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.5 Design Stage - Connector Mapping

The Design stage focuses on confirming how source components map to Logic Apps:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DESIGN - Connector Mapping                                                 ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🔌 CONNECTOR MAPPING                                                           │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Review and confirm how BizTalk adapters map to Logic Apps connectors:          │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ BizTalk Adapter   │ Logic Apps Connector │ Connection Type │ Status      │ │   │
│  │  ├───────────────────┼──────────────────────┼─────────────────┼─────────────┤ │   │
│  │  │ HTTP Adapter      │ HTTP Trigger         │ Built-in        │ ✅ Mapped   │ │   │
│  │  │ (Receive)         │                      │                 │             │ │   │
│  │  ├───────────────────┼──────────────────────┼─────────────────┼─────────────┤ │   │
│  │  │ SQL Adapter       │ SQL Server           │ On-prem Gateway │ ✅ Mapped   │ │   │
│  │  │                   │ (Managed)            │                 │             │ │   │
│  │  ├───────────────────┼──────────────────────┼─────────────────┼─────────────┤ │   │
│  │  │ SAP Adapter       │ SAP                  │ On-prem Gateway │ ✅ Mapped   │ │   │
│  │  │                   │ (Managed)            │                 │             │ │   │
│  │  ├───────────────────┼──────────────────────┼─────────────────┼─────────────┤ │   │
│  │  │ SMTP Adapter      │ Office 365 Outlook   │ OAuth           │ ✅ Mapped   │ │   │
│  │  │                   │ (Managed)            │                 │             │ │   │
│  │  ├───────────────────┼──────────────────────┼─────────────────┼─────────────┤ │   │
│  │  │ WCF-NetMsmq       │ Service Bus Queue    │ Connection Str  │ ⚠️ Review   │ │   │
│  │  │                   │ (Built-in)           │                 │             │ │   │
│  │  └───────────────────┴──────────────────────┴─────────────────┴─────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ⚠️ MAPPING REQUIRING REVIEW                                                    │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  WCF-NetMsmq → Service Bus Queue                                          │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  BizTalk uses MSMQ for internal queuing. Options:                        │ │   │
│  │  │                                                                           │ │   │
│  │  │  ● Azure Service Bus Queue (Recommended)                                  │ │   │
│  │  │    Cloud-native, highly available, supports sessions                     │ │   │
│  │  │                                                                           │ │   │
│  │  │  ○ Azure Storage Queue                                                    │ │   │
│  │  │    Simpler, lower cost, basic queuing only                               │ │   │
│  │  │                                                                           │ │   │
│  │  │  ○ Keep On-Premises MSMQ (via Gateway)                                   │ │   │
│  │  │    Requires custom connector, not recommended                            │ │   │
│  │  │                                                                           │ │   │
│  │  │                                                    [Confirm Selection]    │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  [← Back]                                               [Next: Pattern Mapping] │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.6 Design Stage - Pattern Mapping

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DESIGN - Pattern Mapping                                                   ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🎯 PATTERN MAPPING                                                             │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Confirm how BizTalk patterns will be implemented in Logic Apps:                │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ DIRECT MAPPINGS (No changes needed)                                         │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ BizTalk Pattern      │ Logic Apps Implementation │ Artifact              │ │   │
│  │  ├──────────────────────┼───────────────────────────┼───────────────────────┤ │   │
│  │  │ Request-Reply        │ HTTP Trigger + Response   │ ProcessOrder          │ │   │
│  │  │ Content-Based Router │ Switch action             │ ProcessOrder          │ │   │
│  │  │ Message Translator   │ Transform XML action      │ ProcessOrder          │ │   │
│  │  │ Publish-Subscribe    │ Service Bus Trigger       │ HandleReturns         │ │   │
│  │  │ Scatter-Gather       │ Parallel branches         │ BatchProcessor        │ │   │
│  │  └──────────────────────┴───────────────────────────┴───────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ⚠️ PATTERNS REQUIRING DESIGN DECISIONS                                         │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  PATTERN: Sequential Convoy                        BatchProcessor.odx     │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  Select implementation approach:                                          │ │   │
│  │  │                                                                           │ │   │
│  │  │  ● Durable Functions Orchestration (Recommended)                          │ │   │
│  │  │    ├─ Uses WaitForExternalEvent for message correlation                   │ │   │
│  │  │    ├─ Maintains state across messages                                     │ │   │
│  │  │    ├─ Effort: +16-24 hours                                               │ │   │
│  │  │    └─ Best for: Complex correlation, long-running                        │ │   │
│  │  │                                                                           │ │   │
│  │  │  ○ Service Bus Sessions                                                   │ │   │
│  │  │    ├─ Uses session ID for message grouping                               │ │   │
│  │  │    ├─ Logic App processes session messages in order                       │ │   │
│  │  │    ├─ Effort: +8-12 hours                                                │ │   │
│  │  │    └─ Best for: Simple ordering, quick delivery                          │ │   │
│  │  │                                                                           │ │   │
│  │  │  ○ Split into Multiple Workflows                                          │ │   │
│  │  │    ├─ BatchCollector: Stores items in table/blob                         │ │   │
│  │  │    ├─ BatchProcessor: Triggered by timer or signal                        │ │   │
│  │  │    ├─ Effort: +12-16 hours                                               │ │   │
│  │  │    └─ Best for: Batch processing, scheduled release                      │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  PATTERN: Atomic Scope + Compensation                 BatchProcessor.odx  │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  Select implementation approach:                                          │ │   │
│  │  │                                                                           │ │   │
│  │  │  ● Saga Pattern with Compensating Actions (Recommended)                   │ │   │
│  │  │    ├─ Each action has a compensating "undo" action                       │ │   │
│  │  │    ├─ On failure, run compensations in reverse order                     │ │   │
│  │  │    ├─ Effort: +8-16 hours                                                │ │   │
│  │  │    └─ Best for: Distributed transactions, API calls                      │ │   │
│  │  │                                                                           │ │   │
│  │  │  ○ Scope with Run After (Failed)                                          │ │   │
│  │  │    ├─ Use Scope action with error handling branch                        │ │   │
│  │  │    ├─ Cleanup in "Run After = Failed" path                               │ │   │
│  │  │    ├─ Effort: +4-8 hours                                                 │ │   │
│  │  │    └─ Best for: Simple rollback, single resource                         │ │   │
│  │  │                                                                           │ │   │
│  │  │  ○ Flag for Manual Implementation                                         │ │   │
│  │  │    ├─ Generate TODO placeholder in workflow                              │ │   │
│  │  │    ├─ Implement during development phase                                 │ │   │
│  │  │    └─ Best for: Complex cases needing architect review                   │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  [← Back: Connector Mapping]                         [Next: Gap Resolution →]   │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.7 Design Stage - Gap Resolution Selection

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DESIGN - Gap Resolution                                                    ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🔧 GAP RESOLUTION STRATEGY                                                     │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  For each gap, select how to handle it during conversion:                       │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  GAP #1: Custom Functoid (PriceCalculator)            CanonicalToSAP.btm       │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  The PriceCalculator functoid contains custom C# code that calculates          │   │
│  │  discounts and applies tax rules.                                               │   │
│  │                                                                                 │   │
│  │  Resolution Strategy:                                                           │   │
│  │                                                                                 │   │
│  │  ● 🔧 Auto-generate Azure Function scaffold                                     │   │
│  │    Extension will create a Function project with the method signature          │   │
│  │    extracted from the functoid. You port the C# logic.                         │   │
│  │                                                                                 │   │
│  │  ○ 🔄 Convert to inline JavaScript expression                                   │   │
│  │    If logic is simple, convert to workflow expression                          │   │
│  │                                                                                 │   │
│  │  ○ 🖐️ Manual implementation later                                               │   │
│  │    Add TODO comment, implement during development                               │   │
│  │                                                                                 │   │
│  │  ○ ⏭️ Skip (exclude from conversion)                                            │   │
│  │    Remove this functoid's logic from the workflow                              │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  GAP #2: Custom Pipeline Component (XMLValidator)     ReceivePipeline.btp      │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  The XMLValidator component performs advanced XPath-based validation.           │   │
│  │                                                                                 │   │
│  │  Resolution Strategy:                                                           │   │
│  │                                                                                 │   │
│  │  ● 🔧 Auto-generate Azure Function scaffold                                     │   │
│  │    Create Function with XML input, returns validation result                   │   │
│  │                                                                                 │   │
│  │  ○ 🔄 Use XML Validation action + Schema                                        │   │
│  │    Logic Apps has built-in XML validation against XSD                          │   │
│  │                                                                                 │   │
│  │  ○ 🖐️ Manual implementation later                                               │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 RESOLUTION SUMMARY                                                          │   │
│  │                                                                                 │   │
│  │  🔧 Auto-generate:  2 gaps (Azure Functions scaffolds)                          │   │
│  │  🔄 Alternative:    2 gaps (Logic Apps native patterns)                         │   │
│  │  🖐️ Manual:         0 gaps                                                      │   │
│  │  ⏭️ Skipped:        0 gaps                                                      │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  [← Back: Pattern Mapping]                          [Next: Flow Comparison →]   │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.8 Flow Comparison - Source vs Target

Before proceeding to Conversion, review the side-by-side comparison of source flows and their target Logic Apps designs:

#### Comparison Selection Panel

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DESIGN - Flow Comparison                                                   ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🔄 SOURCE vs TARGET COMPARISON                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Review how each source flow maps to its target Logic Apps workflow:            │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Source Flow              │ Target Workflow        │ Status    │ Action    │ │   │
│  │  ├──────────────────────────┼────────────────────────┼───────────┼───────────┤ │   │
│  │  │ ProcessOrder.odx         │ ProcessOrder/workflow  │ ✅ Ready  │[Compare]  │ │   │
│  │  │  (Orchestration)         │  14→14 actions         │           │           │ │   │
│  │  ├──────────────────────────┼────────────────────────┼───────────┼───────────┤ │   │
│  │  │ HandleReturns.odx        │ HandleReturns/workflow │ ✅ Ready  │[Compare]  │ │   │
│  │  │  (Orchestration)         │  8→9 actions           │           │           │ │   │
│  │  ├──────────────────────────┼────────────────────────┼───────────┼───────────┤ │   │
│  │  │ BatchProcessor.odx       │ BatchProcessor/        │ ⚠️ Review │[Compare]  │ │   │
│  │  │  (Orchestration)         │  workflow + Durable Fn │           │           │ │   │
│  │  ├──────────────────────────┼────────────────────────┼───────────┼───────────┤ │   │
│  │  │ Order CBR Routing        │ OrderRouter/workflow   │ ✅ Ready  │[Compare]  │ │   │
│  │  │  (Messaging-Only)        │  3→3 conditions        │           │           │ │   │
│  │  └──────────────────────────┴────────────────────────┴───────────┴───────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 COMPARISON STATS                                                            │   │
│  │                                                                                 │   │
│  │  Total Flows: 4          All Compared: ☐ (0/4)                                  │   │
│  │  Direct Mappings: 38     Adapted: 8     Gaps: 2                                 │   │
│  │                                                                                 │   │
│  │  💡 Review each comparison to validate design decisions before conversion.      │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Side-by-Side Flow Comparison View

When user clicks **[Compare]** on a flow:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📊 FLOW COMPARISON: ProcessOrder                                   [🔍] [📤] [←→] [⚙] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  SOURCE: ProcessOrder.odx (BizTalk)         │    TARGET: ProcessOrder/workflow.json    │
│  Type: Orchestration • Shapes: 14           │    Type: Logic App • Actions: 14         │
├─────────────────────────────────────────────┼───────────────────────────────────────────┤
│                                             │                                           │
│  ╔═══════════════════════╗                  │            ╔═══════════════════════╗      │
│  ║   🟢 Receive_Order    ║════════════════════════════════║   When HTTP request   ║      │
│  ║   [HTTP Receive]      ║    ─── 🟢 ───   │            ║   is received         ║      │
│  ╚═══════════╤═══════════╝                  │            ╚═══════════╤═══════════╝      │
│              │                              │                        │                  │
│              ▼                              │                        ▼                  │
│  ┌───────────────────────┐                  │            ┌───────────────────────┐      │
│  │  📐 Transform_Order   │════════════════════════════════│   Transform XML       │      │
│  │  [OrderToCanonical]   │    ─── 🟢 ───   │            │   using XSLT          │      │
│  └───────────┬───────────┘                  │            └───────────┬───────────┘      │
│              │                              │                        │                  │
│              ▼                              │                        ▼                  │
│  ◇═══════════════════════◇                  │            ┌───────────────────────┐      │
│ ╱   🔶 Check_Inventory   ╲═══════════════════════════════│    Condition          │      │
│◇═════════════════════════════◇  ─ 🟢 ─     │            │ @equals(inventory,...)│      │
│           ╱     ╲                           │            └─────┬───────────┬─────┘      │
│      YES ╱       ╲ NO                       │              Yes │           │ No         │
│         ▼         ▼                         │                  ▼           ▼            │
│  ╔══════════╗  ┌──────────┐                 │            ╔═══════════╗  ┌───────────┐   │
│  ║  Send    ║  │ Transform│════════════════════════════════║  HTTP     ║  │ Transform │   │
│  ║ Confirm  ║  │ BackOrder│   ─── 🟢 ───   │            ║  (Confirm)║  │  XML      │   │
│  ╚══════════╝  └────┬─────┘                 │            ╚═══════════╝  └─────┬─────┘   │
│                     │                       │                                 │         │
│                     ▼                       │                                 ▼         │
│              ╔════════════╗                 │                        ╔══════════════╗   │
│              ║  Send      ║═══════════════════════════════════════════║  Service Bus ║   │
│              ║ BackOrderQ ║   ─── 🟡 ───   │                        ║  Send        ║   │
│              ╚════════════╝  (MSMQ→SB)     │                        ╚══════════════╝   │
│                                             │                                           │
├─────────────────────────────────────────────┴───────────────────────────────────────────┤
│  📊 MAPPING SUMMARY                                                                     │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  Total: 14 elements    🟢 Direct: 12 (86%)    🟡 Adapted: 1 (7%)    🔴 Gaps: 1 (7%)    │
│                                                                                         │
│  ████████████████████████████████████████████████████░░░░░░░░░░░ 86% Direct Mapping    │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  📋 SELECTED: Transform_Order → Transform XML                        [View Details]     │
│  ├─ Mapping Type: 🟢 Direct (Confidence: 95%)                                           │
│  ├─ Source Map: OrderToCanonical.btm → OrderToCanonical.xslt                            │
│  └─ Notes: XSLT generated from BizTalk map, all functoids converted                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  [✓ Approve All]  [✗ Reject Selected]  [📝 Add Note]  [← Prev Flow]  [Next Flow →]     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Mapping Legend:**
| Symbol | Color | Meaning |
|--------|-------|---------|
| 🟢 ─── | Green solid | Direct 1:1 mapping, fully supported |
| 🟡 ─ ─ | Yellow dashed | Adapted mapping (e.g., MSMQ → Service Bus) |
| 🟠 · · | Orange dotted | Manual implementation required |
| 🔴 ✕ | Red X | Gap - needs workaround |

**User Actions:**
- **←→** - Toggle synchronized scrolling
- **🔍** - Zoom both panes together
- **📤** - Export comparison as image/PDF
- **Click mapping line** - See transformation details
- **Approve/Reject** - Track review status

---

#### Messaging-Only (CBR) Comparison

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📊 FLOW COMPARISON: Order CBR Routing                              [🔍] [📤] [←→] [⚙] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  SOURCE: Messaging-Only CBR (BizTalk)       │    TARGET: OrderRouter/workflow.json     │
│  Type: Content-Based Routing • Routes: 3    │    Type: Logic App • Switch: 3 cases     │
├─────────────────────────────────────────────┼───────────────────────────────────────────┤
│                                             │                                           │
│    ┌─────────────────────┐                  │            ╔═══════════════════════╗      │
│    │  📥 FILE Receive    │═══════════════════════════════║   When file created   ║      │
│    │  Location: Orders/* │  ─── 🟢 ───     │            ║   (Azure Blob)        ║      │
│    └─────────┬───────────┘                  │            ╚═══════════╤═══════════╝      │
│              │                              │                        │                  │
│              ▼                              │                        ▼                  │
│    ╭─────────────────────╮                  │            ┌───────────────────────┐      │
│    │    📦 MessageBox    │═══════════════════════════════│    Switch             │      │
│    │  (Filter: Region)   │  ─── 🟢 ───     │            │ @body('Parse_JSON')   │      │
│    ╰─────────┬───────────╯                  │            │    ['region']         │      │
│              │                              │            └─────┬───┬───┬─────────┘      │
│     ┌────────┼────────┐                     │              US  │   │EU │  APAC         │
│     │        │        │                     │                  │   │   │               │
│     ▼        ▼        ▼                     │                  ▼   ▼   ▼               │
│  ┌──────┐ ┌──────┐ ┌──────┐                │            ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ US   │ │ EU   │ │ APAC │═══════════════════════════════│ HTTP│ │SFTP │ │ MQ  │       │
│  │Send  │ │Send  │ │Send  │  ─── 🟢 ───     │            │Send │ │Send │ │Send │       │
│  └──────┘ └──────┘ └──────┘                │            └─────┘ └─────┘ └─────┘       │
│                                             │                                           │
├─────────────────────────────────────────────┴───────────────────────────────────────────┤
│  📊 MAPPING: 🟢 Direct: 5/5 (100%)   │   🟡 Adapted: 0   │   🔴 Gaps: 0               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  💡 MessageBox pub/sub pattern converted to Logic Apps Switch action with conditions.   │
│     Subscription filters preserved as case conditions.                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

#### All Comparisons Reviewed

After reviewing all flows:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  FLOW COMPARISONS COMPLETE                                                  ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ ALL FLOW COMPARISONS REVIEWED                                               │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Source Flow              │ Status    │ Direct │ Adapted │ Gaps │ Approved │ │   │
│  │  ├──────────────────────────┼───────────┼────────┼─────────┼──────┼──────────┤ │   │
│  │  │ ProcessOrder.odx         │ ✅ Done   │ 12     │ 1       │ 1    │ ☑️       │ │   │
│  │  │ HandleReturns.odx        │ ✅ Done   │ 8      │ 1       │ 0    │ ☑️       │ │   │
│  │  │ BatchProcessor.odx       │ ✅ Done   │ 18     │ 6       │ 4    │ ☑️       │ │   │
│  │  │ Order CBR Routing        │ ✅ Done   │ 5      │ 0       │ 0    │ ☑️       │ │   │
│  │  └──────────────────────────┴───────────┴────────┴─────────┴──────┴──────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 OVERALL COMPARISON SUMMARY                                                  │   │
│  │                                                                                 │   │
│  │  Total Elements: 48        Mappings Approved: 48/48 (100%)                      │   │
│  │                                                                                 │   │
│  │  🟢 Direct:    43 (90%)   ██████████████████████████████████████████████░░░░   │   │
│  │  🟡 Adapted:    8 (17%)   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │   │
│  │  🔴 Gaps:       5 (10%)   █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ☑️ All flows compared and approved                                             │   │
│  │  ☑️ Gap workarounds confirmed                                                   │   │
│  │  ☑️ Ready to proceed to Conversion                                              │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [📤 Export All Comparisons]   [← Back to Gaps]   [▶️ Proceed to Conversion]    │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

> **📄 Detailed Specifications**: See [SourceFlowVisualization.md](SourceFlowVisualization.md) and task [DE7-FlowComparisonVisualizer](../tasks/task_details/Phase-9-Design/DE7-FlowComparisonVisualizer.md) for implementation details.

---

### 4.9 Design Complete - Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DESIGN COMPLETE                                                            ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ DESIGN STAGE COMPLETE                                                       │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  All mappings and design decisions have been confirmed.                         │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📋 DESIGN SUMMARY                                                              │   │
│  │                                                                                 │   │
│  │  CONNECTORS                                                                     │   │
│  │  ├─ 5 adapters mapped to Logic Apps connectors                                 │   │
│  │  ├─ 2 require On-Premises Data Gateway                                         │   │
│  │  └─ 1 mapping reviewed and confirmed (MSMQ → Service Bus)                      │   │
│  │                                                                                 │   │
│  │  PATTERNS                                                                       │   │
│  │  ├─ 5 patterns with direct Logic Apps mapping                                  │   │
│  │  ├─ 1 pattern → Durable Functions (Sequential Convoy)                          │   │
│  │  └─ 1 pattern → Saga Pattern (Atomic Scope)                                    │   │
│  │                                                                                 │   │
│  │  GAP RESOLUTIONS                                                                │   │
│  │  ├─ 2 gaps → Azure Function scaffolds                                          │   │
│  │  └─ 2 gaps → Logic Apps native alternatives                                    │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ EXIT CRITERIA                                                               │   │
│  │                                                                                 │   │
│  │  ☑️ All connector mappings confirmed                                            │   │
│  │  ☑️ All pattern mappings defined                                                │   │
│  │  ☑️ Gap resolution strategies selected                                          │   │
│  │  ☑️ Design decisions documented in IR                                           │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🚀 READY FOR CONVERSION                                                        │   │
│  │                                                                                 │   │
│  │  The next stage will generate:                                                  │   │
│  │  • workflow.json files for each orchestration                                   │   │
│  │  • connections.json for connector configurations                                │   │
│  │  • XSLT files from BizTalk maps                                                 │   │
│  │  • Azure Function scaffolds for gaps                                            │   │
│  │  • Bicep templates for infrastructure                                           │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [📥 Export Design Doc]   [← Edit Design]   [▶️ Proceed to Conversion]          │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.10 Sidebar - Design Stage Active

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  📍 Stage: Design (4/8)                                                          │
│  🔀  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🐛  │                                                                                  │
│      │  📊 MIGRATION PROGRESS                                                           │
│  📦  │                                                                                  │
│      │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  50%                      │
│ ───  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🔄  │                                                                                  │
│  ●   │  📋 STAGES                                                                       │
│ ───  │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  ⚙️  │  │  ✅ 1. Discovery                                    [COMPLETE]             │ │
│      │  │  ✅ 2. Assessment                                   [COMPLETE]             │ │
│      │  │  ✅ 3. Planning                                     [COMPLETE]             │ │
│      │  │  🔵 4. Design                                       [ACTIVE]               │ │
│      │  │  🔒 5. Conversion                                   [LOCKED]               │ │
│      │  │  🔒 6. Validation                                   [LOCKED]               │ │
│      │  │  🔒 7. Deployment                                   [LOCKED]               │ │
│      │  │  🔒 8. Verification                                 [LOCKED]               │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  🎯 DESIGN PROGRESS                                                              │
│      │                                                                                  │
│      │  ☑️ Connector mappings                                Complete                   │
│      │  ☑️ Pattern mappings                                  Complete                   │
│      │  ☑️ Gap resolutions                                   Complete                   │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  🌊 CURRENT WAVE: Wave 1                                                         │
│      │                                                                                  │
│      │  Next to convert:                                                                │
│      │  📄 HandleReturns.odx                      🟢 Low complexity                     │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │                    ▶️ Begin Conversion Stage                               │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.11 Chat Conversation - Design Questions

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration show me what the Saga pattern would look like for the atomic scope │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ## Saga Pattern for BatchProcessor Atomic Scope                               │   │
│  │                                                                                 │   │
│  │  Here's how the BizTalk atomic scope with compensation translates to a Saga:   │   │
│  │                                                                                 │   │
│  │  ### BizTalk (Current)                                                          │   │
│  │  ```                                                                            │   │
│  │  Atomic Scope                                                                   │   │
│  │  ├── [Create SAP Order]                                                        │   │
│  │  ├── [Update Inventory]                                                        │   │
│  │  └── Compensation: [Cancel SAP Order], [Restore Inventory]                     │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  ### Logic Apps Saga Pattern                                                    │   │
│  │  ```json                                                                        │   │
│  │  {                                                                              │   │
│  │    "Saga_Scope": {                                                             │   │
│  │      "type": "Scope",                                                          │   │
│  │      "actions": {                                                               │   │
│  │        "Step1_Create_SAP_Order": {                                             │   │
│  │          "type": "ApiConnection",                                              │   │
│  │          "inputs": { "method": "post", "path": "/orders" }                     │   │
│  │        },                                                                       │   │
│  │        "Step2_Update_Inventory": {                                             │   │
│  │          "type": "ApiConnection",                                              │   │
│  │          "runAfter": { "Step1_Create_SAP_Order": ["Succeeded"] }               │   │
│  │        }                                                                        │   │
│  │      }                                                                          │   │
│  │    },                                                                           │   │
│  │    "Compensate_On_Failure": {                                                  │   │
│  │      "type": "Scope",                                                          │   │
│  │      "runAfter": { "Saga_Scope": ["Failed", "TimedOut"] },                     │   │
│  │      "actions": {                                                               │   │
│  │        "Comp1_Cancel_SAP_Order": {                                             │   │
│  │          "type": "ApiConnection",                                              │   │
│  │          "inputs": { "method": "delete", "path": "/orders/@{orderId}" }        │   │
│  │        },                                                                       │   │
│  │        "Comp2_Restore_Inventory": {                                            │   │
│  │          "type": "ApiConnection",                                              │   │
│  │          "runAfter": { "Comp1_Cancel_SAP_Order": ["Succeeded","Failed"] }      │   │
│  │        }                                                                        │   │
│  │      }                                                                          │   │
│  │    }                                                                            │   │
│  │  }                                                                              │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  ### Key Differences                                                            │   │
│  │                                                                                 │   │
│  │  | Aspect | BizTalk | Logic Apps Saga |                                        │   │
│  │  |--------|---------|-----------------|                                        │   │
│  │  | Trigger | Automatic on exception | `runAfter: Failed` |                     │   │
│  │  | Order | Implicit reverse | Explicit ordering |                              │   │
│  │  | Idempotency | Handled by runtime | You must implement |                     │   │
│  │                                                                                 │   │
│  │  The conversion will generate this pattern with your specific actions.         │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.12 Summary: Planning & Design Flow

| Step | Stage | User Action | System Response |
|------|-------|-------------|-----------------|
| 1 | Planning | Review wave suggestions | Copilot recommends groupings |
| 2 | Planning | Adjust wave assignments | Drag/drop or buttons |
| 3 | Planning | Set timeline | Configure dates and milestones |
| 4 | Planning | Approve plan | Plan saved to IR |
| 5 | Design | Review connector mappings | Confirm or change connectors |
| 6 | Design | Review pattern mappings | Select implementation approach |
| 7 | Design | Select gap resolutions | Choose auto-generate/manual/skip |
| 8 | Design | Confirm design | Design decisions saved |
| 9 | Design | Ask @migration questions | Get code examples and guidance |
| 10 | Design | Proceed to Conversion | Ready to generate artifacts |

---

## Section 5: Conversion & Validation Flow

### 5.1 Starting Conversion Stage

When user clicks "Proceed to Conversion":

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  BEGIN CONVERSION STAGE                                                     ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🔄 Stage 5: Conversion                                                         │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  This stage will generate Azure Logic Apps artifacts based on your design:      │   │
│  │                                                                                 │   │
│  │  ✓ Generate workflow.json for each orchestration                                │   │
│  │  ✓ Generate connections.json for connector configurations                       │   │
│  │  ✓ Convert BizTalk maps (.btm) to XSLT                                          │   │
│  │  ✓ Create Azure Function scaffolds for gaps                                     │   │
│  │  ✓ Generate Bicep/ARM templates for infrastructure                              │   │
│  │  ✓ Create parameters.json for environment configuration                        │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📋 CONVERSION SCOPE (Wave 1)                                                   │   │
│  │                                                                                 │   │
│  │     ☑️ HandleReturns.odx → HandleReturns/workflow.json                          │   │
│  │     ☑️ ReturnToRefund.btm → Artifacts/Maps/ReturnToRefund.xslt                  │   │
│  │                                                                                 │   │
│  │  ⏱️ Estimated time: 30-60 seconds                                               │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [Select Different Wave]    [Cancel]    [🚀 Start Conversion]                   │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Workflow Selection Panel (Full Wave)

For larger conversions, a detailed selection panel appears:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  CONVERSION - Select Workflows                                              ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  📋 SELECT WORKFLOWS TO CONVERT                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Current Wave: Wave 2 - Core Business Logic                                     │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  ☑️ ProcessOrder.odx                                        🟡 Medium     │ │   │
│  │  │     ├─ Shapes: 14  │  Actions: 12  │  Connections: 4                      │ │   │
│  │  │     ├─ Maps: OrderToCanonical.btm, CanonicalToSAP.btm                    │ │   │
│  │  │     ├─ Gaps: 1 (Custom functoid → Azure Function)                        │ │   │
│  │  │     └─ Output: ProcessOrder/workflow.json                                 │ │   │
│  │  │                                                                           │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  ☑️ OrderToCanonical.btm                                    🟢 Low        │ │   │
│  │  │     ├─ Links: 15  │  Functoids: 3 (standard)                              │ │   │
│  │  │     ├─ Source: OrderRequest.xsd → Target: CanonicalOrder.xsd             │ │   │
│  │  │     └─ Output: Artifacts/Maps/OrderToCanonical.xslt                       │ │   │
│  │  │                                                                           │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  ☑️ CanonicalToSAP.btm                                      🟡 Medium     │ │   │
│  │  │     ├─ Links: 22  │  Functoids: 5 (1 custom: PriceCalculator)            │ │   │
│  │  │     ├─ ⚠️ Custom functoid will generate Azure Function scaffold          │ │   │
│  │  │     └─ Output: Artifacts/Maps/CanonicalToSAP.xslt + PriceCalculator/     │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📦 DEPENDENCIES TO INCLUDE                                                     │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  ☑️ Schemas (3)                                                           │ │   │
│  │  │     OrderRequest.xsd, CanonicalOrder.xsd, SAPSalesOrder.xsd              │ │   │
│  │  │                                                                           │ │   │
│  │  │  ☑️ Infrastructure (Bicep)                                                │ │   │
│  │  │     Logic App, Integration Account, Function App                         │ │   │
│  │  │                                                                           │ │   │
│  │  │  ☑️ Connections (4)                                                       │ │   │
│  │  │     SQL, SAP, Service Bus, Office 365                                    │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  Selected: 3 items  │  Est. Time: 45-90 seconds                                │   │
│  │                                                                                 │   │
│  │  [Select All]  [Select None]                    [🚀 Convert Selected]          │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.3 Conversion In Progress

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  📍 Stage: Conversion (5/8) - In Progress                                        │
│  🔀  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🐛  │                                                                                  │
│      │  🔄 CONVERSION IN PROGRESS                                                       │
│  📦  │                                                                                  │
│      │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░  65%                      │
│ ───  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🔄  │                                                                                  │
│  ●   │  ✅ Loading IR and design decisions...                  Complete                │
│ ───  │  ✅ Generating ProcessOrder/workflow.json...            Complete                │
│      │  ✅ Generating ProcessOrder/connections.json...         Complete                │
│  ⚙️  │  ⏳ Converting OrderToCanonical.btm to XSLT...          In Progress             │
│      │     🤖 Extracting transformation rules...                                        │
│      │  ○ Converting CanonicalToSAP.btm to XSLT...             Pending                 │
│      │  ○ Generating PriceCalculator Azure Function...         Pending                 │
│      │  ○ Generating Bicep templates...                        Pending                 │
│      │  ○ Generating parameters.json...                        Pending                 │
│      │  ○ Creating output folder structure...                  Pending                 │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  📄 GENERATING: OrderToCanonical.xslt                                            │
│      │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │  Processing functoids:                                                     │ │
│      │  │  ✅ String Concatenate (3)                                                 │ │
│      │  │  ⏳ Value Mapping (2)                                                      │ │
│      │  │  ○ Date/Time (1)                                                           │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  📊 Progress: 3 / 8 tasks                                                        │
│      │  ⏱️ Elapsed: 28s                                                                 │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.4 Conversion Complete - Results Panel

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  CONVERSION RESULTS                                                         ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ CONVERSION COMPLETE                                                         │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  All selected artifacts have been converted successfully.                       │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 CONVERSION SUMMARY                                                          │   │
│  │                                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │      1      │  │      2      │  │      3      │  │      1      │            │   │
│  │  │  Workflow   │  │   Maps      │  │  Schemas    │  │  Function   │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📁 GENERATED FILES                                                             │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  📁 .migration/                                                           │ │   │
│  │  │  ├── 📁 LogicApps/                                                        │ │   │
│  │  │  │   ├── 📁 ProcessOrder/                                                 │ │   │
│  │  │  │   │   ├── 📄 workflow.json            [View] [Open in Designer]       │ │   │
│  │  │  │   │   └── 📄 connections.json         [View]                          │ │   │
│  │  │  │   ├── 📄 host.json                                                     │ │   │
│  │  │  │   └── 📄 local.settings.json                                           │ │   │
│  │  │  │                                                                        │ │   │
│  │  │  ├── 📁 Artifacts/                                                        │ │   │
│  │  │  │   ├── 📁 Maps/                                                         │ │   │
│  │  │  │   │   ├── 📄 OrderToCanonical.xslt    [View]                          │ │   │
│  │  │  │   │   └── 📄 CanonicalToSAP.xslt      [View]                          │ │   │
│  │  │  │   └── 📁 Schemas/                                                      │ │   │
│  │  │  │       ├── 📄 OrderRequest.xsd         [View]                          │ │   │
│  │  │  │       ├── 📄 CanonicalOrder.xsd       [View]                          │ │   │
│  │  │  │       └── 📄 SAPSalesOrder.xsd        [View]                          │ │   │
│  │  │  │                                                                        │ │   │
│  │  │  ├── 📁 Functions/                                                        │ │   │
│  │  │  │   └── 📁 PriceCalculator/                                              │ │   │
│  │  │  │       ├── 📄 function.json            [View]                          │ │   │
│  │  │  │       ├── 📄 run.csx                  [View] ⚠️ Scaffold only         │ │   │
│  │  │  │       └── 📄 README.md                Migration notes                  │ │   │
│  │  │  │                                                                        │ │   │
│  │  │  └── 📁 Infrastructure/                                                   │ │   │
│  │  │      ├── 📄 main.bicep                   [View]                          │ │   │
│  │  │      ├── 📄 parameters.json              [View]                          │ │   │
│  │  │      └── 📁 modules/                                                      │ │   │
│  │  │          ├── 📄 logicapp.bicep                                            │ │   │
│  │  │          ├── 📄 integration-account.bicep                                 │ │   │
│  │  │          └── 📄 function-app.bicep                                        │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ⚠️ POST-CONVERSION TASKS                                                       │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  1. 🔧 Complete Azure Function: PriceCalculator                           │ │   │
│  │  │     The scaffold has been generated. Port your C# logic from the          │ │   │
│  │  │     original functoid assembly.                                           │ │   │
│  │  │     File: Functions/PriceCalculator/run.csx                               │ │   │
│  │  │                                                      [Open File]          │ │   │
│  │  │                                                                           │ │   │
│  │  │  2. 📝 Review workflow.json for TODOs                                     │ │   │
│  │  │     Some actions may have TODO comments for manual review.                │ │   │
│  │  │                                                      [Search TODOs]       │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  [📥 Export Report]  [🔍 View Workflow]  [▶️ Proceed to Validation]             │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.5 Viewing Generated Workflow in Designer

Clicking "Open in Designer" opens the Logic Apps Designer extension:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LOGIC APPS DESIGNER - ProcessOrder                                         ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │     ┌─────────────────────────────────────┐                                     │   │
│  │     │  ⚡ When a HTTP request is received │                                     │   │
│  │     │     Method: POST                    │                                     │   │
│  │     │     Schema: OrderRequest            │                                     │   │
│  │     └─────────────────────────────────────┘                                     │   │
│  │                      │                                                          │   │
│  │                      ▼                                                          │   │
│  │     ┌─────────────────────────────────────┐                                     │   │
│  │     │  📝 Initialize variable             │                                     │   │
│  │     │     Name: orderStatus               │                                     │   │
│  │     │     Type: String                    │                                     │   │
│  │     └─────────────────────────────────────┘                                     │   │
│  │                      │                                                          │   │
│  │                      ▼                                                          │   │
│  │     ┌─────────────────────────────────────┐                                     │   │
│  │     │  🔄 Transform XML                   │                                     │   │
│  │     │     Map: OrderToCanonical.xslt      │                                     │   │
│  │     │     Content: @triggerBody()         │                                     │   │
│  │     └─────────────────────────────────────┘                                     │   │
│  │                      │                                                          │   │
│  │                      ▼                                                          │   │
│  │     ┌─────────────────────────────────────┐                                     │   │
│  │     │  🔀 Switch: CheckInventory          │                                     │   │
│  │     │     On: @variables('orderType')     │                                     │   │
│  │     └─────────────────────────────────────┘                                     │   │
│  │           │                    │                                                │   │
│  │      ┌────┘                    └────┐                                           │   │
│  │      ▼                              ▼                                           │   │
│  │  ┌─────────┐                   ┌─────────┐                                      │   │
│  │  │  CASE:  │                   │ DEFAULT │                                      │   │
│  │  │  "NEW"  │                   │         │                                      │   │
│  │  └─────────┘                   └─────────┘                                      │   │
│  │      │                              │                                           │   │
│  │      ▼                              ▼                                           │   │
│  │  ┌─────────────────┐           ┌─────────────────┐                              │   │
│  │  │ 🗄️ SQL: Check  │           │ 📨 Send to      │                              │   │
│  │  │    Inventory    │           │    Backorder Q  │                              │   │
│  │  └─────────────────┘           └─────────────────┘                              │   │
│  │           │                                                                     │   │
│  │           ▼                                                                     │   │
│  │  ┌─────────────────────────────────────┐                                        │   │
│  │  │  🔄 Transform XML                   │                                        │   │
│  │  │     Map: CanonicalToSAP.xslt        │                                        │   │
│  │  └─────────────────────────────────────┘                                        │   │
│  │           │                                                                     │   │
│  │           ▼                                                                     │   │
│  │  ┌─────────────────────────────────────┐                                        │   │
│  │  │  🏢 SAP: Create Sales Order         │                                        │   │
│  │  │     Connection: sap-erp-conn        │                                        │   │
│  │  └─────────────────────────────────────┘                                        │   │
│  │           │                                                                     │   │
│  │           ▼                                                                     │   │
│  │  ┌─────────────────────────────────────┐                                        │   │
│  │  │  📤 Response                        │                                        │   │
│  │  │     Status: 200                     │                                        │   │
│  │  │     Body: @body('SAP_Create')       │                                        │   │
│  │  └─────────────────────────────────────┘                                        │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  [Save]  [Run]  [View Code]  [Parameters]  [Connections]                               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.6 Starting Validation Stage

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  BEGIN VALIDATION STAGE                                                     ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ Stage 6: Validation                                                         │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  This stage will validate all generated artifacts:                              │   │
│  │                                                                                 │   │
│  │  ✓ Validate workflow.json schema and syntax                                     │   │
│  │  ✓ Validate connections.json configuration                                      │   │
│  │  ✓ Validate XSLT maps against schemas                                           │   │
│  │  ✓ Check expression syntax                                                      │   │
│  │  ✓ Verify connector references                                                  │   │
│  │  ✓ Run transformation tests (optional)                                          │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📋 VALIDATION SCOPE                                                            │   │
│  │                                                                                 │   │
│  │     1 workflow.json file                                                        │   │
│  │     1 connections.json file                                                     │   │
│  │     2 XSLT maps                                                                 │   │
│  │     3 XSD schemas                                                               │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │                              [Cancel]         [▶️ Start Validation]             │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.7 Validation In Progress

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  📍 Stage: Validation (6/8) - In Progress                                        │
│  🔀  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🐛  │                                                                                  │
│      │  ✅ VALIDATION IN PROGRESS                                                       │
│  📦  │                                                                                  │
│      │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  75%                      │
│ ───  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🔄  │                                                                                  │
│  ●   │  ✅ Validating workflow schema...                       ✓ Valid                 │
│ ───  │  ✅ Validating action definitions...                    ✓ 12 actions OK         │
│      │  ✅ Validating expressions...                           ✓ 8 expressions OK      │
│  ⚙️  │  ✅ Validating connections.json...                      ✓ 4 connections OK      │
│      │  ⏳ Validating XSLT maps...                             In Progress             │
│      │     Testing: OrderToCanonical.xslt                                              │
│      │  ○ Running transformation tests...                      Pending                 │
│      │  ○ Generating validation report...                      Pending                 │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  📊 Progress: 5 / 7 checks                                                       │
│      │  ⏱️ Elapsed: 15s                                                                 │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.8 Validation Results

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VALIDATION RESULTS                                                         ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ VALIDATION COMPLETE                                                         │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  All validations passed. Artifacts are ready for deployment.                    │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 VALIDATION SUMMARY                                                          │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Check                        │ Status │ Details                          │ │   │
│  │  ├──────────────────────────────┼────────┼──────────────────────────────────┤ │   │
│  │  │ Workflow Schema              │ ✅ Pass │ Valid Logic Apps schema          │ │   │
│  │  │ Action Definitions           │ ✅ Pass │ 12 actions validated             │ │   │
│  │  │ Expression Syntax            │ ✅ Pass │ 8 expressions valid              │ │   │
│  │  │ Connections Configuration    │ ✅ Pass │ 4 connections configured         │ │   │
│  │  │ XSLT Map: OrderToCanonical   │ ✅ Pass │ Transforms correctly             │ │   │
│  │  │ XSLT Map: CanonicalToSAP     │ ✅ Pass │ Transforms correctly             │ │   │
│  │  │ Schema References            │ ✅ Pass │ 3 schemas resolved               │ │   │
│  │  └──────────────────────────────┴────────┴──────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🧪 TRANSFORMATION TEST RESULTS                                                 │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  OrderToCanonical.xslt                                                    │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │  Input:  Sample OrderRequest.xml (from BizTalk test files)                │ │   │
│  │  │  Output: CanonicalOrder.xml ✅                                            │ │   │
│  │  │                                                                           │ │   │
│  │  │  Comparison: Output matches expected BizTalk map output                   │ │   │
│  │  │                                                      [View Diff]          │ │   │
│  │  │                                                                           │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  CanonicalToSAP.xslt                                                      │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │  Input:  CanonicalOrder.xml                                               │ │   │
│  │  │  Output: SAPSalesOrder.xml ✅                                             │ │   │
│  │  │                                                                           │ │   │
│  │  │  ⚠️ Note: PriceCalculator function calls return placeholder values.       │ │   │
│  │  │     Complete the Azure Function to get accurate pricing.                  │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ⚠️ WARNINGS (Non-blocking)                                                     │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  1. Azure Function scaffold incomplete                                    │ │   │
│  │  │     PriceCalculator/run.csx contains placeholder code                     │ │   │
│  │  │     ⮕ Complete before production deployment                              │ │   │
│  │  │                                                                           │ │   │
│  │  │  2. Connection credentials not configured                                 │ │   │
│  │  │     SQL, SAP connections need credentials in Azure                        │ │   │
│  │  │     ⮕ Configure after deployment via Azure Portal                        │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ EXIT CRITERIA                                                               │   │
│  │                                                                                 │   │
│  │  ☑️ All schema validations passed                                               │   │
│  │  ☑️ All expression validations passed                                           │   │
│  │  ☑️ Transformation tests completed                                              │   │
│  │  ☑️ No blocking errors found                                                    │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [📥 Export Report]  [🔄 Re-run Validation]  [▶️ Proceed to Deployment]         │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.9 Validation Failure Scenario

If validation fails:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VALIDATION RESULTS - ERRORS FOUND                                          ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ❌ VALIDATION FAILED                                                           │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  2 errors must be fixed before deployment.                                      │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ❌ ERRORS                                                                       │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  ERROR 1: Invalid Expression                                              │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │  File: ProcessOrder/workflow.json                                         │ │   │
│  │  │  Action: Transform_CanonicalToSAP                                         │ │   │
│  │  │  Line: 145                                                                │ │   │
│  │  │                                                                           │ │   │
│  │  │  Expression: @body('Transform_OrderToCanonical)                          │ │   │
│  │  │              ─────────────────────────────────────^                       │ │   │
│  │  │  Error: Missing closing quote in function reference                       │ │   │
│  │  │                                                                           │ │   │
│  │  │  Fix: @body('Transform_OrderToCanonical')                                │ │   │
│  │  │                                                                           │ │   │
│  │  │                                    [Go to Line]  [Auto-Fix]               │ │   │
│  │  │                                                                           │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  ERROR 2: Missing Connection Reference                                    │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │  File: ProcessOrder/workflow.json                                         │ │   │
│  │  │  Action: SAP_CreateSalesOrder                                             │ │   │
│  │  │                                                                           │ │   │
│  │  │  Connection "sap-erp-connection" referenced but not defined in            │ │   │
│  │  │  connections.json                                                         │ │   │
│  │  │                                                                           │ │   │
│  │  │  Available connections: sap-erp-conn, sql-conn, servicebus-conn          │ │   │
│  │  │                                                                           │ │   │
│  │  │  Fix: Update reference to "sap-erp-conn"                                 │ │   │
│  │  │                                                                           │ │   │
│  │  │                                    [Go to Line]  [Auto-Fix]               │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  [Auto-Fix All]  [← Back to Conversion]  [Fix Manually & Re-validate]          │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.10 Chat Conversation - Conversion Help

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration help me complete the PriceCalculator Azure Function                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ## Completing PriceCalculator Azure Function                                   │   │
│  │                                                                                 │   │
│  │  The scaffold was generated from your BizTalk custom functoid. Here's how      │   │
│  │  to complete it:                                                                │   │
│  │                                                                                 │   │
│  │  ### Current Scaffold (run.csx)                                                 │   │
│  │                                                                                 │   │
│  │  ```csharp                                                                      │   │
│  │  #r "Newtonsoft.Json"                                                          │   │
│  │  using System.Net;                                                              │   │
│  │  using Newtonsoft.Json;                                                         │   │
│  │                                                                                 │   │
│  │  public static async Task<IActionResult> Run(                                  │   │
│  │      HttpRequest req, ILogger log)                                             │   │
│  │  {                                                                              │   │
│  │      // TODO: Port logic from PriceCalculator functoid                         │   │
│  │      // Original assembly: OrderProcessing.Functoids.dll                       │   │
│  │      // Method signature: CalculatePrice(decimal basePrice,                    │   │
│  │      //                                  string customerTier,                  │   │
│  │      //                                  int quantity)                         │   │
│  │                                                                                 │   │
│  │      string requestBody = await new StreamReader(req.Body).ReadToEndAsync();   │   │
│  │      dynamic data = JsonConvert.DeserializeObject(requestBody);                │   │
│  │                                                                                 │   │
│  │      decimal result = 0; // TODO: Implement calculation                        │   │
│  │                                                                                 │   │
│  │      return new OkObjectResult(result);                                        │   │
│  │  }                                                                              │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  ### Completed Implementation                                                   │   │
│  │                                                                                 │   │
│  │  Based on common pricing functoid patterns, here's a complete version:         │   │
│  │                                                                                 │   │
│  │  ```csharp                                                                      │   │
│  │  #r "Newtonsoft.Json"                                                          │   │
│  │  using System.Net;                                                              │   │
│  │  using Newtonsoft.Json;                                                         │   │
│  │                                                                                 │   │
│  │  public static async Task<IActionResult> Run(                                  │   │
│  │      HttpRequest req, ILogger log)                                             │   │
│  │  {                                                                              │   │
│  │      string requestBody = await new StreamReader(req.Body).ReadToEndAsync();   │   │
│  │      var data = JsonConvert.DeserializeAnonymousType(requestBody, new {        │   │
│  │          basePrice = 0m,                                                        │   │
│  │          customerTier = "",                                                     │   │
│  │          quantity = 0                                                           │   │
│  │      });                                                                        │   │
│  │                                                                                 │   │
│  │      decimal discount = data.customerTier switch                               │   │
│  │      {                                                                          │   │
│  │          "Gold" => 0.15m,                                                      │   │
│  │          "Silver" => 0.10m,                                                    │   │
│  │          "Bronze" => 0.05m,                                                    │   │
│  │          _ => 0m                                                               │   │
│  │      };                                                                         │   │
│  │                                                                                 │   │
│  │      // Volume discount                                                         │   │
│  │      if (data.quantity > 100) discount += 0.05m;                               │   │
│  │      if (data.quantity > 500) discount += 0.05m;                               │   │
│  │                                                                                 │   │
│  │      decimal finalPrice = data.basePrice * data.quantity * (1 - discount);     │   │
│  │                                                                                 │   │
│  │      log.LogInformation($"Calculated price: {finalPrice}");                    │   │
│  │      return new OkObjectResult(finalPrice);                                    │   │
│  │  }                                                                              │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  ⚠️ **Important**: Review your original functoid's C# code to ensure the       │   │
│  │  discount tiers and calculation logic match your business rules.               │   │
│  │                                                                                 │   │
│  │  [Apply to File]                                                                │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.11 Summary: Conversion & Validation Flow

| Step | Stage | User Action | System Response |
|------|-------|-------------|-----------------|
| 1 | Conversion | Select wave/workflows | View selection panel |
| 2 | Conversion | Click "Start Conversion" | Generation begins |
| 3 | Conversion | Wait for generation | Progress shown in sidebar |
| 4 | Conversion | Review generated files | View in explorer/designer |
| 5 | Conversion | Note post-conversion tasks | Function scaffolds, TODOs |
| 6 | Validation | Click "Proceed to Validation" | Stage transition |
| 7 | Validation | Wait for checks | Schema, expression, map validation |
| 8 | Validation | Review results | Pass/fail for each check |
| 9 | Validation | Fix errors (if any) | Auto-fix or manual edit |
| 10 | Validation | Re-validate | Confirm all checks pass |
| 11 | Validation | Proceed to Deployment | Ready for Azure deployment |

---

## Section 6: Deployment & Verification Flow

### 6.1 Starting Deployment Stage

When user clicks "Proceed to Deployment":

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  BEGIN DEPLOYMENT STAGE                                                     ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🚀 Stage 7: Deployment                                                         │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  This stage will deploy your Logic Apps to Azure:                               │   │
│  │                                                                                 │   │
│  │  ✓ Create Azure resources using Bicep templates                                 │   │
│  │  ✓ Deploy Logic App Standard workflows                                          │   │
│  │  ✓ Upload maps and schemas to Integration Account                               │   │
│  │  ✓ Deploy Azure Functions (if any)                                              │   │
│  │  ✓ Configure API connections                                                    │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ⚠️ PREREQUISITES                                                               │   │
│  │                                                                                 │   │
│  │  ☑️ Azure CLI installed and authenticated                                       │   │
│  │  ☑️ Signed in to Azure account                                                  │   │
│  │  ☐ Subscription selected                                                        │   │
│  │  ☐ Resource group confirmed                                                     │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │                              [Cancel]         [▶️ Configure Deployment]         │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.2 Azure Deployment Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT CONFIGURATION                                                   ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ☁️ AZURE DEPLOYMENT SETTINGS                                                   │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  📋 SUBSCRIPTION & RESOURCE GROUP                                               │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  Azure Subscription                                                             │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  Contoso Production (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)    ▼ │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │                                                                                 │   │
│  │  Resource Group                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  rg-integration-prod                                          ▼ │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │  ○ Create new resource group                                                    │   │
│  │                                                                                 │   │
│  │  Region                                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  East US                                                      ▼ │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📦 RESOURCES TO DEPLOY                                                         │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Resource                    │ Name                      │ SKU/Tier       │ │   │
│  │  ├─────────────────────────────┼───────────────────────────┼────────────────┤ │   │
│  │  │ ☑️ Logic App Standard       │ la-orderprocessing-prod   │ WS1            │ │   │
│  │  │ ☑️ App Service Plan         │ asp-integration-prod      │ WS1            │ │   │
│  │  │ ☑️ Storage Account          │ storderproc001            │ Standard_LRS   │ │   │
│  │  │ ☑️ Integration Account      │ ia-orderprocessing-prod   │ Standard       │ │   │
│  │  │ ☑️ Function App             │ func-pricing-prod         │ Consumption    │ │   │
│  │  │ ☑️ Key Vault                │ kv-orderproc-prod         │ Standard       │ │   │
│  │  │ ☐ On-Premises Data Gateway  │ (use existing)            │ -              │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  💰 Estimated Monthly Cost: ~$150-200 (varies by usage)                         │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🔌 CONNECTION CONFIGURATION                                                    │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Connection           │ Type              │ Configuration                  │ │   │
│  │  ├──────────────────────┼───────────────────┼────────────────────────────────┤ │   │
│  │  │ sql-inventory-conn   │ SQL Server        │ Gateway: gw-onprem-001         │ │   │
│  │  │                      │                   │ Server: sql-prod.contoso.com   │ │   │
│  │  │                      │                   │ [Configure Credentials]        │ │   │
│  │  ├──────────────────────┼───────────────────┼────────────────────────────────┤ │   │
│  │  │ sap-erp-conn         │ SAP              │ Gateway: gw-onprem-001          │ │   │
│  │  │                      │                   │ [Configure Credentials]        │ │   │
│  │  ├──────────────────────┼───────────────────┼────────────────────────────────┤ │   │
│  │  │ servicebus-conn      │ Service Bus       │ Namespace: sb-integration      │ │   │
│  │  │                      │                   │ Auth: Connection String        │ │   │
│  │  │                      │                   │ [Configure Credentials]        │ │   │
│  │  ├──────────────────────┼───────────────────┼────────────────────────────────┤ │   │
│  │  │ office365-conn       │ Office 365        │ Auth: Managed Identity         │ │   │
│  │  │                      │                   │ ✅ No credentials needed       │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  [← Back]    [Preview Bicep]    [💰 Cost Estimate]    [🚀 Deploy to Azure]      │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.3 Deployment In Progress

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  📍 Stage: Deployment (7/8) - In Progress                                        │
│  🔀  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🐛  │                                                                                  │
│      │  🚀 DEPLOYMENT IN PROGRESS                                                       │
│  📦  │                                                                                  │
│      │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░  60%                      │
│ ───  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🔄  │                                                                                  │
│  ●   │  ✅ Validating Bicep templates...                       Complete                │
│ ───  │  ✅ Creating resource group...                          Complete                │
│      │  ✅ Deploying Storage Account...                        Complete                │
│  ⚙️  │  ✅ Deploying App Service Plan...                       Complete                │
│      │  ⏳ Deploying Logic App Standard...                     In Progress             │
│      │     Creating Logic App: la-orderprocessing-prod                                 │
│      │  ○ Deploying Integration Account...                     Pending                 │
│      │  ○ Deploying Function App...                            Pending                 │
│      │  ○ Uploading workflows...                               Pending                 │
│      │  ○ Uploading maps and schemas...                        Pending                 │
│      │  ○ Configuring connections...                           Pending                 │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  📋 AZURE ACTIVITY LOG                                                           │
│      │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │  10:45:32  Creating storage account storderproc001...                      │ │
│      │  │  10:45:45  Storage account created successfully                            │ │
│      │  │  10:45:46  Creating App Service Plan asp-integration-prod...               │ │
│      │  │  10:46:02  App Service Plan created successfully                           │ │
│      │  │  10:46:03  Creating Logic App la-orderprocessing-prod...                   │ │
│      │  │  10:46:15  Waiting for Logic App provisioning...                           │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  📊 Progress: 4 / 10 resources                                                   │
│      │  ⏱️ Elapsed: 2m 15s                                                              │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │                                              [View in Azure Portal]              │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.4 Deployment Complete - Results

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT RESULTS                                                         ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ DEPLOYMENT SUCCESSFUL                                                       │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  All resources have been deployed to Azure successfully.                        │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📦 DEPLOYED RESOURCES                                                          │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Resource                    │ Name                      │ Status          │ │   │
│  │  ├─────────────────────────────┼───────────────────────────┼─────────────────┤ │   │
│  │  │ Logic App Standard          │ la-orderprocessing-prod   │ ✅ Running      │ │   │
│  │  │ App Service Plan            │ asp-integration-prod      │ ✅ Active       │ │   │
│  │  │ Storage Account             │ storderproc001            │ ✅ Available    │ │   │
│  │  │ Integration Account         │ ia-orderprocessing-prod   │ ✅ Active       │ │   │
│  │  │ Function App                │ func-pricing-prod         │ ✅ Running      │ │   │
│  │  │ Key Vault                   │ kv-orderproc-prod         │ ✅ Available    │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🔄 DEPLOYED WORKFLOWS                                                          │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  ProcessOrder                                           ✅ Enabled        │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │  Trigger URL:                                                             │ │   │
│  │  │  https://la-orderprocessing-prod.azurewebsites.net/api/                  │ │   │
│  │  │         ProcessOrder/triggers/manual/invoke?api-version=2022-05-01       │ │   │
│  │  │                                                                           │ │   │
│  │  │                          [Copy URL]  [Test Workflow]  [View in Portal]    │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📄 UPLOADED ARTIFACTS                                                          │   │
│  │                                                                                 │   │
│  │  Integration Account: ia-orderprocessing-prod                                   │   │
│  │  ├─ Maps: 2 (OrderToCanonical.xslt, CanonicalToSAP.xslt)                       │   │
│  │  └─ Schemas: 3 (OrderRequest.xsd, CanonicalOrder.xsd, SAPSalesOrder.xsd)       │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🔌 CONNECTION STATUS                                                           │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Connection           │ Status           │ Action Required                  │ │   │
│  │  ├──────────────────────┼──────────────────┼──────────────────────────────────┤ │   │
│  │  │ sql-inventory-conn   │ ⚠️ Auth Required │ [Authorize in Portal]           │ │   │
│  │  │ sap-erp-conn         │ ⚠️ Auth Required │ [Authorize in Portal]           │ │   │
│  │  │ servicebus-conn      │ ✅ Connected     │ -                                │ │   │
│  │  │ office365-conn       │ ⚠️ Auth Required │ [Authorize in Portal]           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ⚠️ Some connections require authorization. Click the links above to           │   │
│  │     authorize in Azure Portal before testing workflows.                         │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✅ EXIT CRITERIA                                                               │   │
│  │                                                                                 │   │
│  │  ☑️ All resources deployed successfully                                         │   │
│  │  ☑️ Workflows uploaded and enabled                                              │   │
│  │  ☑️ Maps and schemas uploaded to Integration Account                            │   │
│  │  ☐ Connections authorized (manual step)                                         │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [📥 Export Deployment Report]  [☁️ Open Azure Portal]  [▶️ Proceed to Verify]  │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.5 Connection Authorization in Azure Portal

When user clicks "Authorize in Portal":

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  AZURE PORTAL - API Connections                                             ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  sql-inventory-conn                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  Resource group: rg-integration-prod                                                    │
│  Location: East US                                                                      │
│  Status: ⚠️ Error - Authorization required                                             │
│                                                                                         │
│  ───────────────────────────────────────────────────────────────────────────────────   │
│                                                                                         │
│  General    Settings    Access control (IAM)    Tags                                    │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ⚠️ This connection is not authenticated                                        │   │
│  │                                                                                 │   │
│  │  To use this connection in your Logic App, you need to authorize it.            │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                         Authorize                                       │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ───────────────────────────────────────────────────────────────────────────   │   │
│  │                                                                                 │   │
│  │  Connection Parameters:                                                         │   │
│  │                                                                                 │   │
│  │  Server:            sql-prod.contoso.com                                        │   │
│  │  Database:          InventoryDB                                                 │   │
│  │  Authentication:    SQL Server Authentication                                   │   │
│  │  Gateway:           gw-onprem-001                                               │   │
│  │                                                                                 │   │
│  │  Username:          [____________________]                                      │   │
│  │  Password:          [____________________]                                      │   │
│  │                                                                                 │   │
│  │                                              [Test Connection]  [Save]          │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.6 Starting Verification Stage

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  BEGIN VERIFICATION STAGE                                                   ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ Stage 8: Verification                                                       │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  This is the final stage! Verify the deployed workflows work correctly:         │   │
│  │                                                                                 │   │
│  │  ✓ Test deployed workflows with sample data                                     │   │
│  │  ✓ Compare behavior with original BizTalk integration                           │   │
│  │  ✓ Verify performance meets requirements                                        │   │
│  │  ✓ Complete UAT checklist                                                       │   │
│  │  ✓ Sign off on migration                                                        │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📋 VERIFICATION CHECKLIST                                                      │   │
│  │                                                                                 │   │
│  │  ☐ All connections authorized and tested                                        │   │
│  │  ☐ Workflow triggered successfully                                              │   │
│  │  ☐ Transformations produce correct output                                       │   │
│  │  ☐ Error handling works as expected                                             │   │
│  │  ☐ Performance is acceptable                                                    │   │
│  │  ☐ Business stakeholder sign-off obtained                                       │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │                              [Cancel]         [▶️ Start Verification]           │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.7 Verification Panel - Testing Workflows

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VERIFICATION - Test Workflows                                              ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  🧪 WORKFLOW TESTING                                                            │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Test your deployed workflows with sample requests:                             │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📄 ProcessOrder Workflow                                                       │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  Trigger URL:                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  https://la-orderprocessing-prod.azurewebsites.net/api/ProcessOrder/...│   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  Sample Request Body:                                                           │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  <?xml version="1.0" encoding="UTF-8"?>                                 │   │   │
│  │  │  <OrderRequest xmlns="http://schemas.contoso.com/order">                │   │   │
│  │  │    <OrderId>ORD-2026-001</OrderId>                                      │   │   │
│  │  │    <CustomerId>CUST-100</CustomerId>                                    │   │   │
│  │  │    <CustomerTier>Gold</CustomerTier>                                    │   │   │
│  │  │    <Items>                                                              │   │   │
│  │  │      <Item>                                                             │   │   │
│  │  │        <ProductId>PROD-500</ProductId>                                  │   │   │
│  │  │        <Quantity>50</Quantity>                                          │   │   │
│  │  │        <UnitPrice>25.00</UnitPrice>                                     │   │   │
│  │  │      </Item>                                                            │   │   │
│  │  │    </Items>                                                             │   │   │
│  │  │  </OrderRequest>                                                        │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                [Load Sample]  [Edit]            │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                         🚀 Send Test Request                            │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 LAST TEST RESULT                                                            │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  ✅ Test Passed                                          Duration: 2.3s   │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  Status: 200 OK                                                           │ │   │
│  │  │  Run ID: 08585932-xxxx-xxxx-xxxx-xxxxxxxxxxxx                            │ │   │
│  │  │                                                                           │ │   │
│  │  │  Response:                                                                │ │   │
│  │  │  ┌───────────────────────────────────────────────────────────────────┐   │ │   │
│  │  │  │  {                                                                │   │ │   │
│  │  │  │    "SAPOrderNumber": "SAP-4500012345",                            │   │ │   │
│  │  │  │    "Status": "Created",                                           │   │ │   │
│  │  │  │    "TotalAmount": 1062.50,                                        │   │ │   │
│  │  │  │    "ProcessedAt": "2026-02-04T10:52:15Z"                          │   │ │   │
│  │  │  │  }                                                                │   │ │   │
│  │  │  └───────────────────────────────────────────────────────────────────┘   │ │   │
│  │  │                                                                           │ │   │
│  │  │                    [View Full Response]  [View Run History in Portal]     │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.8 Verification Checklist - UAT Sign-off

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  VERIFICATION - UAT CHECKLIST                                               ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ✅ USER ACCEPTANCE TESTING                                                     │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  Complete the checklist below to sign off on the migration:                     │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📋 FUNCTIONAL VERIFICATION                                                     │   │
│  │                                                                                 │   │
│  │  ☑️ Workflow triggers correctly on HTTP request                                 │   │
│  │  ☑️ Order data transforms correctly (XML → Canonical → SAP)                     │   │
│  │  ☑️ Inventory check returns correct stock levels                                │   │
│  │  ☑️ SAP order creation succeeds with valid data                                 │   │
│  │  ☑️ Error responses are properly formatted                                      │   │
│  │  ☑️ Backorder queue receives messages when inventory low                        │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 PERFORMANCE VERIFICATION                                                    │   │
│  │                                                                                 │   │
│  │  ☑️ Response time < 5 seconds (measured: 2.3s avg)                              │   │
│  │  ☑️ Can handle expected load (tested: 100 req/min)                              │   │
│  │  ☐ Retry logic works correctly                                                  │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🔒 SECURITY VERIFICATION                                                       │   │
│  │                                                                                 │   │
│  │  ☑️ Connections use secure credentials (Key Vault)                              │   │
│  │  ☑️ HTTPS enforced on all endpoints                                             │   │
│  │  ☑️ Managed Identity configured where possible                                  │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📝 DOCUMENTATION                                                               │   │
│  │                                                                                 │   │
│  │  ☑️ Runbook generated                                                           │   │
│  │  ☑️ Architecture diagram updated                                                │   │
│  │  ☐ Handover to operations team                                                  │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ✍️ SIGN-OFF                                                                    │   │
│  │                                                                                 │   │
│  │  Verified by:  [John Smith________________]                                     │   │
│  │  Role:         [Integration Architect_____]                                     │   │
│  │  Date:         [February 4, 2026__________]                                     │   │
│  │                                                                                 │   │
│  │  Comments:                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  Migration successful. All functional tests passed. Ready for          │   │   │
│  │  │  production traffic. Recommend monitoring for first 2 weeks.           │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [Save Progress]  [📥 Export UAT Report]  [✅ Complete Migration]               │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.9 Migration Complete - Final Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  🎉 MIGRATION COMPLETE                                                      ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │                           🎉 CONGRATULATIONS! 🎉                               │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │             Migration of OrderProcessing has been completed!                   │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📊 MIGRATION SUMMARY                                                           │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                           │ │   │
│  │  │  Source:         BizTalk Server 2020                                      │ │   │
│  │  │  Target:         Azure Logic Apps Standard                                │ │   │
│  │  │                                                                           │ │   │
│  │  │  Started:        February 4, 2026 10:15 AM                                │ │   │
│  │  │  Completed:      February 4, 2026 11:05 AM                                │ │   │
│  │  │  Duration:       50 minutes                                               │ │   │
│  │  │                                                                           │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  ARTIFACTS MIGRATED                                                       │ │   │
│  │  │                                                                           │ │   │
│  │  │  ✅ Orchestrations:     1 of 3 (Wave 1-2)                                 │ │   │
│  │  │  ✅ Maps:               2 converted to XSLT                               │ │   │
│  │  │  ✅ Schemas:            3 uploaded to Integration Account                 │ │   │
│  │  │  ✅ Azure Functions:    1 created (PriceCalculator)                       │ │   │
│  │  │                                                                           │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  AZURE RESOURCES                                                          │ │   │
│  │  │                                                                           │ │   │
│  │  │  Resource Group:        rg-integration-prod                               │ │   │
│  │  │  Logic App:             la-orderprocessing-prod                           │ │   │
│  │  │  Integration Account:   ia-orderprocessing-prod                           │ │   │
│  │  │  Function App:          func-pricing-prod                                 │ │   │
│  │  │                                                                           │ │   │
│  │  │  ─────────────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                           │ │   │
│  │  │  STAGES COMPLETED                                                         │ │   │
│  │  │                                                                           │ │   │
│  │  │  ✅ 1. Discovery        ✅ 5. Conversion                                  │ │   │
│  │  │  ✅ 2. Assessment       ✅ 6. Validation                                  │ │   │
│  │  │  ✅ 3. Planning         ✅ 7. Deployment                                  │ │   │
│  │  │  ✅ 4. Design           ✅ 8. Verification                                │ │   │
│  │  │                                                                           │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  📁 GENERATED DOCUMENTATION                                                     │   │
│  │                                                                                 │   │
│  │  📄 MIGRATION-REPORT.md          Complete migration report                     │   │
│  │  📄 RUNBOOK.md                   Operations runbook                            │   │
│  │  📄 ARCHITECTURE.md              Solution architecture                         │   │
│  │  📄 UAT-SIGNOFF.pdf              Signed UAT checklist                          │   │
│  │                                                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  🚀 NEXT STEPS                                                                  │   │
│  │                                                                                 │   │
│  │  1. Continue with Wave 3 (BatchProcessor.odx) - Complex patterns               │   │
│  │  2. Set up monitoring and alerting in Azure                                    │   │
│  │  3. Configure CI/CD pipeline for future updates                                │   │
│  │  4. Plan decommissioning of BizTalk Server instance                            │   │
│  │                                                                                 │   │
│  │  ═════════════════════════════════════════════════════════════════════════════  │   │
│  │                                                                                 │   │
│  │  [📥 Download All Reports]  [🌊 Start Next Wave]  [🏠 Return to Home]           │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.10 Sidebar - Migration Complete State

```
┌──────┬──────────────────────────────────────────────────────────────────────────────────┐
│      │  MIGRATION AGENT                                                                │
│  📁  │  ════════════════════════════════════════════════════════════════════════════   │
│      │                                                                                  │
│  🔍  │  📁 Project: OrderProcessing                                                     │
│      │  📍 Status: ✅ MIGRATION COMPLETE                                                │
│  🔀  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🐛  │                                                                                  │
│      │  📊 MIGRATION PROGRESS                                                           │
│  📦  │                                                                                  │
│      │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  100%                     │
│ ───  │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│  🔄  │                                                                                  │
│  ●   │  📋 STAGES                                                                       │
│ ───  │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  ⚙️  │  │  ✅ 1. Discovery                                    [COMPLETE]             │ │
│      │  │  ✅ 2. Assessment                                   [COMPLETE]             │ │
│      │  │  ✅ 3. Planning                                     [COMPLETE]             │ │
│      │  │  ✅ 4. Design                                       [COMPLETE]             │ │
│      │  │  ✅ 5. Conversion                                   [COMPLETE]             │ │
│      │  │  ✅ 6. Validation                                   [COMPLETE]             │ │
│      │  │  ✅ 7. Deployment                                   [COMPLETE]             │ │
│      │  │  ✅ 8. Verification                                 [COMPLETE]             │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  🎉 COMPLETED WAVES                                                              │
│      │                                                                                  │
│      │  ✅ Wave 1: HandleReturns                                                        │
│      │  ✅ Wave 2: ProcessOrder + Maps                                                  │
│      │  ⏳ Wave 3: BatchProcessor (pending)                                             │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  🔗 QUICK LINKS                                                                  │
│      │                                                                                  │
│      │  ☁️ Open in Azure Portal                                                         │
│      │  📊 View Run History                                                             │
│      │  📄 Migration Report                                                             │
│      │  📖 Runbook                                                                      │
│      │                                                                                  │
│      │  ─────────────────────────────────────────────────────────────────────────────  │
│      │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │                    🌊 Start Next Wave (Wave 3)                             │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
│      │  ┌────────────────────────────────────────────────────────────────────────────┐ │
│      │  │                    🆕 Start New Migration                                  │ │
│      │  └────────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                                  │
└──────┴──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.11 Chat Conversation - Post-Migration Help

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  GITHUB COPILOT CHAT                                                        ─ □ ✕      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  👤 User                                                                        │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  @migration how do I set up monitoring for my deployed Logic App?              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  🤖 @migration                                                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │                                                                                 │   │
│  │  ## Monitoring Your Logic App Standard                                          │   │
│  │                                                                                 │   │
│  │  Your deployed Logic App `la-orderprocessing-prod` can be monitored using:     │   │
│  │                                                                                 │   │
│  │  ### 1. Application Insights (Recommended)                                      │   │
│  │                                                                                 │   │
│  │  Enable Application Insights for detailed telemetry:                            │   │
│  │                                                                                 │   │
│  │  ```bash                                                                        │   │
│  │  az logicapp config appsettings set \                                          │   │
│  │    --name la-orderprocessing-prod \                                            │   │
│  │    --resource-group rg-integration-prod \                                      │   │
│  │    --settings APPINSIGHTS_INSTRUMENTATIONKEY=<your-key>                        │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  ### 2. Azure Monitor Alerts                                                    │   │
│  │                                                                                 │   │
│  │  Set up alerts for:                                                             │   │
│  │  - **Failed runs**: Trigger > 5 failures in 5 minutes                          │   │
│  │  - **Long duration**: Runs > 30 seconds                                        │   │
│  │  - **Throttling**: 429 status codes                                            │   │
│  │                                                                                 │   │
│  │  ### 3. Log Analytics Queries                                                   │   │
│  │                                                                                 │   │
│  │  ```kusto                                                                       │   │
│  │  // Failed workflow runs in last 24 hours                                      │   │
│  │  AzureDiagnostics                                                              │   │
│  │  | where ResourceType == "WORKFLOWS"                                           │   │
│  │  | where status_s == "Failed"                                                  │   │
│  │  | where TimeGenerated > ago(24h)                                              │   │
│  │  | summarize count() by workflowName_s, bin(TimeGenerated, 1h)                 │   │
│  │  ```                                                                            │   │
│  │                                                                                 │   │
│  │  Would you like me to generate a complete monitoring setup Bicep template?     │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.12 Summary: Deployment & Verification Flow

| Step | Stage | User Action | System Response |
|------|-------|-------------|-----------------|
| 1 | Deployment | Configure Azure settings | Select subscription, RG, region |
| 2 | Deployment | Review resources to deploy | Cost estimate shown |
| 3 | Deployment | Click "Deploy to Azure" | Bicep deployment starts |
| 4 | Deployment | Wait for deployment | Progress in sidebar |
| 5 | Deployment | Authorize connections | Open Azure Portal |
| 6 | Deployment | View deployed resources | Links to portal |
| 7 | Verification | Start verification | Checklist appears |
| 8 | Verification | Send test requests | Test workflow triggers |
| 9 | Verification | Complete UAT checklist | Mark items complete |
| 10 | Verification | Sign off | Enter name, role, comments |
| 11 | Complete | Complete migration | Summary and reports |
| 12 | Complete | Start next wave | Continue with more artifacts |

---

## End-to-End Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE MIGRATION FLOW                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  SETUP                          ANALYSIS                        EXECUTION
  ═════                          ════════                        ═════════

  ┌─────────────┐               ┌─────────────┐                ┌─────────────┐
  │ 1. Install  │               │ 3. Discovery│                │ 5. Convert  │
  │    VSIX     │──────────────▶│    Parse    │───────────────▶│   Generate  │
  │             │               │    Artifacts│                │   Artifacts │
  └─────────────┘               └─────────────┘                └─────────────┘
        │                             │                              │
        │                             │                              │
        ▼                             ▼                              ▼
  ┌─────────────┐               ┌─────────────┐                ┌─────────────┐
  │ 2. Start    │               │ 4. Assess & │                │ 6. Validate │
  │   Migration │──────────────▶│    Plan     │───────────────▶│   & Test    │
  │             │               │             │                │             │
  └─────────────┘               └─────────────┘                └─────────────┘
                                      │                              │
                                      │                              │
                                      ▼                              ▼
                                ┌─────────────┐                ┌─────────────┐
                                │  Design     │                │ 7. Deploy   │
                                │  Mappings   │───────────────▶│   to Azure  │
                                │             │                │             │
                                └─────────────┘                └─────────────┘
                                                                     │
                                                                     │
                                                                     ▼
                                                               ┌─────────────┐
                                                               │ 8. Verify   │
                                                               │   & Sign-off│
                                                               │             │
                                                               └─────────────┘
                                                                     │
                                                                     │
                                                                     ▼
                                                               ┌─────────────┐
                                                               │     🎉      │
                                                               │  COMPLETE!  │
                                                               │             │
                                                               └─────────────┘
```

---

## Appendix: Quick Reference

### Command Palette Commands

| Command | Description |
|---------|-------------|
| `Integration Migration: Start New Migration` | Begin a new migration project |
| `Integration Migration: Open Settings` | Configure extension settings |
| `Integration Migration: View Documentation` | Open documentation |
| `Integration Migration: Export Report` | Export current stage report |
| `Integration Migration: Cancel Migration` | Cancel active migration |

### Chat Participant Commands

| Command | Description |
|---------|-------------|
| `@migration overview` | Get project overview |
| `@migration explain <artifact>` | Explain an artifact |
| `@migration gaps` | List all migration gaps |
| `@migration help` | Get help with current stage |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Open Migration Agent sidebar |
| `Ctrl+Shift+P` → "Migration" | Access migration commands |

---

**End of User Flow Documentation**

