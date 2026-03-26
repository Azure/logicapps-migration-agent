---
name: cloud-deployment-and-testing
description: Rules for optional cloud deployment and testing of Logic Apps Standard projects. Covers ARM/Bicep generation, deployment method, app settings management, cloud test execution, and reporting.
---

# Skill: Cloud Deployment and Testing

> **Purpose**: Authoritative rules for the optional cloud deployment and testing task. Follow exactly.

---

## 1. Task Nature

This task is OPTIONAL. The user decides whether to execute or skip it via the UI. It is excluded from "Execute All" and handled separately.

---

## 2. Deployment Steps

1. **Generate ARM/Bicep template** that deploys the Logic App Standard resource with VNet integration and all required dependencies.
2. **Deploy using `az deployment group create`** — do NOT use zip deploy.
3. **Configure app settings** on the deployed Logic App using `az webapp config appsettings set`. Read values from `local.settings.json` but do NOT modify `local.settings.json`. It must stay unchanged for local testing.

### 2.4 Deployment script safety

- App settings with SAS URLs are applied from a JSON file, not inline shell arguments.
- Publish target is `site/wwwroot`.
- Runtime mount path in app settings matches `connections.json`.
- The deployment path does not depend on portal-only manual steps.

---

## 3. Cloud Testing

1. Read `TEST-REPORT.md` and run EVERY test scenario from it against the deployed Azure Logic App — happy path, error path, cross-workflow chain, timeout, resubmission — all of them, not a subset.
2. Fix any cloud-specific issues via `az webapp config appsettings set` — NEVER edit `local.settings.json`.
3. After all tests pass, UPDATE the ARM/Bicep template to include ALL changes made during testing so the template alone can reproduce the working deployment from scratch.

---

## 4. Cloud Test Report

Generate `CLOUD-TEST-REPORT.md` with:

- This report is MANDATORY. Do NOT consider the cloud deployment/testing task complete until `CLOUD-TEST-REPORT.md` has been created and populated.

- Deployment details (resource names, regions, SKUs).
- Cloud test results per scenario.
- Final Bicep template summary.
- Full step-by-step cloud deployment guide (reproducible from scratch).
