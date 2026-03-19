---
name: no-stubs-code-generation
description: Rules ensuring all generated code is fully implemented with real business logic. No stubs, no placeholders, no TODOs, no NotImplementedException. Source-code-first conversion policy.
---

# Skill: No-Stubs Code Generation

> **Purpose**: Authoritative rules ensuring generated code is production-ready. Follow exactly.

---

## 1. Core Rule

ALL generated code MUST be FULLY IMPLEMENTED with real business logic.

---

## 2. Prohibited Patterns

NEVER generate any of the following:

- Stubs
- Placeholders
- `NotImplementedException`
- Empty method bodies
- `TODO` comments
- `// Implement later` comments
- `throw new NotSupportedException()`
- Methods that return default/dummy values

---

## 3. Source-Code-First Conversion

For custom code / .NET local function tasks:

1. Read the original source code (`.cs`, `.vb` files) from the workspace.
2. Read decompiled code from `out/__decompiled__/` in the current migration workspace directory if original source is unavailable.
3. Translate the actual business logic — not a simplified approximation.
4. If source code is available in the workspace, use it directly.
5. Preserve the original design intent and business rules.

---

## 4. Applies To

This skill applies to ALL code generation tasks:

- .NET local functions
- Workflow JSON (action expressions)
- XSLT/Liquid maps
- ARM/Bicep templates
- Test scripts
- Any other generated code artifact
