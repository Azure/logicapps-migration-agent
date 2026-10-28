---
name: planning-decision-guidance
description: Resolve only consequential migration choices before generating one plan; carry hosting, broker, modernization scope, and tradeoffs through conversion.
---

# Decision-first migration planning

## 1. Short preflight, not multiple generated plans

Before designing diagrams, workflow JSON, or conversion tasks:

1. Reuse discovery analysis and read `migration_planning_preflight` with `action="read"`.
2. Resolve hosting first with `action="resolve", questions=[]`. The tool reuses a saved answer or an explicit deploymentModel setting; otherwise it asks one short question. An extension default is not customer consent. Standard includes both Azure-hosted and hybrid hosting.
3. Inspect the relevant source behavior and verify connector/operation, authentication, and network support for the selected host. Reuse reference lookups; do not reanalyse the entire project.
4. Ask only **consequential, unresolved** choices using `action="resolve"` and up to two questions per call. Aim for 1-3 questions total, including hosting. Additional questions are justified only by a real blocker; never guess a critical answer to meet a question budget.
5. After all answers are resolved (`ready=true`), generate **one** plan. Compare options using concise descriptions, risks, and effort implications, not multiple full architectures or workflow definitions. On cancellation or error, stop without selecting defaults. Answered choices and pending questions remain saved for resumption. If `ready=false` with `pendingQuestions`, continue preflight only: validate those options for the selected host and resubmit the unresolved questions. A hosting-only call never clears them.

Use stable question IDs, a short question, one sentence explaining material impact, and 2-4 supported choices with short tradeoffs. Reuse answered questions when their source/target assumptions still hold. Use `reconsider=true` only for an explicit request to change choices. Do not ask for secrets.

Reconsideration is scoped: with supplied questions, only those questions reopen; with `questions=[]`, only hosting reopens. A changed host invalidates host-dependent answers and returns before asking their old options. Recheck capabilities and resubmit the affected questions for the new host. Changes to an explicit deployment setting refresh configuration-sourced hosting decisions; intentional per-flow user choices remain overrides.

If the user has already explicitly chosen a host in their request, pass `deploymentTarget` instead of asking again. For another explicit answer, supply that question's `answerFromUser` option ID. These fields are **only** for direct user statements, never agent-inferred defaults or recommendations.

### Ask versus decide

Ask when the choice changes hosting/data residency, broker ownership, external contracts, delivery/transaction guarantees, authentication policy, significant cost, or the scope of custom-code refactoring and the source/customer requirements do not settle it.

Choose automatically when the mapping is deterministic and behavior-preserving: action names, workflow layout, supported built-in versus managed equivalent, retry wiring that preserves semantics, or the exact XML/SQL operation **within an approved modernization scope**. Do not ask about each action.

Examples (only when relevant):

- `messaging`: "Which broker should handle these messages?" Offer Azure Service Bus, RabbitMQ, or retaining the existing broker only where a verified connector or explicitly costed bridge works for this host. Never invent a native RabbitMQ/MSMQ connector, assume an automatic MSMQ replacement, or treat AMQP products as interchangeable. Capture delivery guarantees, ordering, acknowledgements, transactions, dead-lettering, and infrastructure ownership.
- `modernization`: "Preserve custom code or use native actions where equivalent?" Use options `preserve-code` (baseline/local functions with runtime compatibility checks) and `native-first` (refactor verified equivalents, retain complex business logic). Ask once per flow, only if actual opportunities exist. Baseline remains the safe behavior when no refactoring choice has been approved.
- A user-requested host, broker, or strategy already recorded in preferences must not be repeatedly questioned. If a later finding invalidates it, explain the blocker and ask only the affected decision.

## 2. Hosting-aware capability checks

Verify capabilities against current Microsoft documentation and reference workflows. A cloud Standard example does not prove hybrid support.

- Azure-hosted Workflow Service Plan, ASE v3, and Standard hybrid are distinct hosting choices. Do not translate them into Consumption.
- Hybrid runs the runtime on supported Azure Arc-enabled infrastructure. Include target infrastructure, SQL run-state storage, SMB artifact storage, network reachability, and identity constraints in the plan. Managed connectors run in Azure and require connectivity; hybrid is not a promise of fully air-gapped operation.
- Validate each connector operation, local-function/runtime dependency, OS assumption, credentials/identity mechanism, and telemetry destination for the selected host. Do not indiscriminately remove managed connectors, force managed identity, or assume all built-ins are equivalent across hosts.
- Verify RabbitMQ/MSMQ/Service Bus options independently. Unsupported combinations must have an explicit gap, prerequisites, and a supported alternative or bridge agreed before generation.
- Relevant official starting points:
  - https://learn.microsoft.com/azure/logic-apps/set-up-standard-workflows-hybrid-deployment-requirements
  - https://learn.microsoft.com/azure/logic-apps/create-standard-workflows-hybrid-deployment
  - https://learn.microsoft.com/azure/connectors/introduction

## 3. Evidence-based modernization

Discovery's source-to-local-function mapping describes the baseline, not a prohibition on approved modernization. For `native-first`, replace custom code only when source reads/decompilation and supported operations demonstrate semantic equivalence. Preserve orchestration/workflow boundaries and source coverage.

Explicitly assess these opportunities when source evidence supports them:

| Source behavior | Candidate | Required checks |
| --- | --- | --- |
| HTTP wrapper around queue processing | Selected broker's trigger | Real ingress, producer contract, request/reply, ordering, retries and settlement. Never replace an HTTP trigger just because queue processing follows it; get approval for contract changes. |
| Custom XML parsing/validation | Parse XML with Schema / XmlParse / XmlValidation | Exact schema, namespaces, validation and error behavior. Retain any unrepresented business rules. |
| Code invoking stored procedures | Built-in SQL action | Operation support, parameters, result sets, transactions, credentials and connectivity. |
| Hardcoded keys or connection strings | Parameterization and an approved secret store such as Key Vault | No secret values in plans; verify target-specific identity/network support. Ask only if vault ownership or compliance policy is unknown and consequential. |
| Windows Event Log writes | Application Insights or approved telemetry | Preserve operational/audit intent, correlation, retention and data boundaries; verify hybrid connectivity. |

The modernization choice permits equivalent implementations, not business redesign. Retain complex or unproven logic, document the reason, and specify parity tests. Do not approximate logic to claim reduced code.

## 4. Record once and hand off

`migration_planning_storeMeta` snapshots resolved preferences automatically. Include a brief with:

- `scenarioName`, `estimatedTimeline` (indicative range with capacity assumptions, or "Not estimated"), `assumptions`, and `tradeoffs`. Do not invent precise dates, savings, or delivery commitments.
- `opportunities`: component, current/proposed approach, `applied`/`retained`/`deferred`, rationale, and source/capability evidence. Include declined opportunities so customers can compare tradeoffs without another generation.

Align applied opportunities with actual workflows, mappings, artifact dispositions, Azure components, and tests. A removed custom library must not also be scheduled for conversion to a local function. Record any deferred or unsupported behavior as a gap.

For full generation use `startNew=true` on storeMeta; it clears draft artifacts only. For incremental changes update metadata and affected artifacts without startNew. Finalize creates an immutable history version; never delete the old plan or manually write history. Browsing/exporting history is read-only; conversion consumes the current finalized plan.

### Conversion handoff (mandatory)

Read `preferences` and `brief` from `migration_conversion_getPlanningResults` before task derivation and isolated execution. Carry hosting, broker, accepted modernization, authentication constraints, and parity tests into the relevant task's `executionPrompt`. Do not reopen resolved questions or reintroduce rejected baseline mappings.

For hybrid/ASE, existing Workflow Service Plan cloud deployment examples are **not** applicable defaults. Validate current target-specific prerequisites and deployment procedures before using them. Include prerequisites and gaps explicitly; do not claim deployment support or silently deploy to Azure-hosted Standard. Unresolved blocking platform constraints must be surfaced before creation/deployment, not hidden by a fallback.
