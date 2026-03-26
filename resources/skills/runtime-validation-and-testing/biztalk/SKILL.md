---
name: runtime-validation-and-testing
description: Rules for runtime validation and end-to-end testing of converted Logic Apps Standard projects. Covers func start validation, local E2E test matrix, splitOn verification, retry/timeout adaptation, test reporting, and no-source-platform-infra policy.
---

# Skill: Runtime Validation and Testing

> **Purpose**: Authoritative rules for validating and testing converted Logic Apps Standard projects. Follow exactly.

---

## 1. Runtime Validation

- Run `func start --verbose` in the generated project folder.
- Check for errors in the output.
- Fix any issues found (bad connections, missing settings, schema errors).
- Re-run until the runtime starts cleanly with no errors.

---

## 2. Local E2E Test Matrix

Test ALL workflows end-to-end locally. Run EVERY scenario:

1. **Happy path** — valid input, expected successful output.
2. **Error/failure path** — invalid or malformed input, verify error handling works.
3. **Cross-workflow chain** — if workflow A triggers workflow B, test the ENTIRE chain.
4. **Timeout/retry path** — if any workflow has timeout or retry logic, test it.
5. **Resubmission path** — if the flow supports message resubmission, test it.
6. **SplitOn check** — if any trigger returns an array and uses a `For_each` loop instead of `splitOn`, refactor to use `splitOn` and re-test.

Trigger each workflow based on trigger type:

- HTTP → `curl` / `Invoke-WebRequest`
- File → place file in `mountPath`
- Service Bus → send message
- Timer → check logs

If a workflow fails, fix the issue and re-test until all scenarios pass.

---

## 3. Test Adaptation Rules

- NEVER skip tests due to long delays, timers, retry intervals, or timeouts.
- Instead, temporarily reduce these values to test-friendly durations (seconds instead of hours).
- Run all tests.
- Then REVERT to original production values after testing.
- Document all adaptations and reversions in the test report.

---

## 4. No Source Platform Infrastructure

During testing, NEVER connect to or use original source platform infrastructure (on-premises SQL servers, file shares, message queues, FTP servers, etc.).

- For local-capable connectors (File System, HTTP, Timer) → use LOCAL resources.
- For cloud-only connectors (Service Bus, Event Hubs, etc.) → use ONLY Azure resources provisioned in the configured resource group.
- Ensure Azurite is running before `func start` (`AzureWebJobsStorage` uses `UseDevelopmentStorage=true`).

---

## 5. Local-First Resource Strategy

- Use Azurite (`UseDevelopmentStorage=true`) for `AzureWebJobsStorage`.
- Use local file paths for File System connector `mountPath`.
- Use `localhost` for HTTP triggers.
- For SQL Server, Cosmos DB, SFTP, PostgreSQL, MySQL → use Docker containers.
- Check Docker availability with `docker --version`.
- Only provision Azure resources for connectors with NO local/Docker alternative (Service Bus, Event Hubs, Integration Account).

---

## 6. TEST-REPORT.md

After testing, generate `TEST-REPORT.md` in the project root with:

- This report is MANDATORY. Do NOT consider the local testing task complete until `TEST-REPORT.md` has been created and populated.

- Test results per workflow.
- Azure resources provisioned.
- Adjustments made during testing.
- Design deviations from plan (should be none — see plan adherence).
- Deployment notes.
- Re-test instructions with exact commands.

---

## 7. Completion Gate

Do NOT call `migration_conversion_finalize` until ALL tests pass and `TEST-REPORT.md` exists. The delivered workspace MUST be fully working with zero manual setup.
