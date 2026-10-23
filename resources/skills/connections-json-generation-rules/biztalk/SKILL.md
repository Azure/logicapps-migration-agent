---
name: connections-json-generation-rules
description: Rules for generating connections.json files for Logic Apps Standard. Covers connection formats, reference lookup, dynamic connections when required by source routing, FileSystem mountPath, and connector constraints.
---

# Skill: Connections JSON Generation Rules

> **Purpose**: Authoritative rules for generating `connections.json` files. Follow exactly.

---

## 1. Mandatory Reference Lookup

BEFORE writing ANY `connections.json`:

1. Call `migration_searchReferenceWorkflows` with `category="connection"` to find the exact `connections.json` format for each connector.
2. Call `migration_readReferenceWorkflow` to read the full JSON.
3. If no results, retry with different wordings.
4. Copy the connector's format and required parameters; do not invent connection structures or add unused sample connections.

---

## 2. Connection Structure

Built-in connections use the `serviceProviderConnections` format. Managed connectors use their separate `managedApiConnections` format and do not support the dynamic selection pattern below.

Follow the normal connection rules below. Use dynamic connections only when the source flow needs runtime connection switching, as described in section 2.1.

```json
{
  "serviceProviderConnections": {
    "<connectionName>": {
      "parameterValues": {
        "<param1>": "<value1>",
        ...
      },
      "serviceProvider": {
        "id": "/serviceProviders/<providerId>"
      },
      "displayName": "<Display Name>"
    }
  }
}
```

---

## 2.1. Dynamic Connections

Use dynamic connections only when one source operation needs to choose between different connection configurations at runtime. Otherwise, keep the normal connection approach without adding selectors, extra connections, or routing steps.

- A single destination, deployment-time settings, or changes to supported action inputs such as a folder, queue, table, or HTTP URI do not by themselves require dynamic connections. Keep independent fixed ports and branches as they are.
- A BizTalk dynamic send port is a reason to inspect the actual address/configuration assignments, not automatically use dynamic connections. Follow the Runtime Destination Selection and AS2/MDN guidance in `source-to-logic-apps-mapping`.

When dynamic connections are needed, use the bundled examples as the primary reference:

1. Call `migration_searchReferenceWorkflows` with `query="DynamicConnections"`.
2. Call `migration_readReferenceWorkflow` for both catalog entries:
   - `connections/DynamicConnections` - predefined connection entries and settings.
   - `workflows/DynamicConnections` - selecting a connection at runtime.
3. Read connector-specific references for the actual provider, operation, parameters, and authentication. The generic examples contain placeholders; adapt them to the source flow rather than copying them unchanged.

Apply the examples as follows:

- Use this pattern only for supported built-in `ServiceProvider` actions, not managed `ApiConnection` actions or triggers. Verify the connector's references; [not every built-in is a service provider](https://learn.microsoft.com/en-us/azure/connectors/built-in). Native HTTP/Request and Standard AS2 (v2) do not need connection entries.
- Define every required connection as a literal, case-sensitive key under `serviceProviderConnections`. All candidates must support the same provider and operation. This feature selects existing connections; it does not create endpoints or credentials at runtime.
- Put the source routing expression in `inputs.serviceProviderConfiguration.connectionName`. Keep `serviceProviderId` and `operationId` fixed, using exact values from connector references. Author in **Code View** and document the designer limitation.
- Preserve the source selector, access requirements, and explicit authorized default. Otherwise reject missing, unknown, or unauthorized selectors before connector execution; never invent a catch-all destination. Reuse existing validation, and add a resolver only if needed. If the expression depends on a preceding action, include its successful completion in `runAfter`.
- Generate only the required connection entries and settings. Preserve unrelated connections, triggers, branches, action ordering, and workflow boundaries.
- Parameterize each required connection's settings using `@appsetting(...)`, with distinct names per destination. Keep credentials out of source control and logs; use Key Vault references for secrets.
- If routing details are missing, inspect the source and planning results first. For unsupported switching, such as arbitrary runtime credentials or different providers, use a documented equivalent or report the gap. Do not silently choose one destination or change unrelated normal connections.
- Replace all placeholders and preserve the source routing rather than copying sample selectors, fallback routes, unused connections, or trigger shapes.

Optional background: [Dynamic Connection Properties in Azure Logic Apps Standard](https://techcommunity.microsoft.com/blog/integrationsonazureblog/dynamic-connection-properties-in-azure-logic-apps-standard/4527525).

---

## 3. FileSystem Connection Rules

If the flow uses File System connector:

- The `connections.json` MUST include `mountPath` in `parameterValues` (the ONLY required parameter for runtime).
- Do NOT add `connectionString` or `rootFolder` to the FileSystem connection — they are NOT valid parameters.
- Use `@appsetting("FileSystem_mountPath")` for the value.
- Add `FileSystem_mountPath` to `local.settings.json`.
- For Azure/cloud execution, `FileSystem_mountPath` must NOT be `/home`, `/home/site`, or `/home/site/wwwroot`; use a dedicated non-overlapping path.

---

## 4. Connector Resource Provisioning

For EVERY connector used by the flow:

### Local-capable (NO Azure provisioning needed)

- **File System** — uses local folder path as `mountPath`
- **AzureWebJobsStorage** — uses Azurite (`UseDevelopmentStorage=true`)
- **HTTP / Timer triggers** — work locally
- **SQL Server, Cosmos DB, SFTP, PostgreSQL, MySQL** — use Docker containers for local testing

### Cloud-only (Azure provisioning required)

- **Service Bus** — provision namespace + queue/topic
- **Event Hubs** — provision namespace + hub
- **Integration Account** — provision with trading partners/agreements if X12/EDIFACT/AS2 is used

After provisioning cloud resources, retrieve the connection string and UPDATE `local.settings.json` with the real value.

---

## 5. Integration Account Rules

If ANY workflow uses X12/EDIFACT/AS2 encode/decode actions:

- Provision and deploy the Integration Account with trading partners and agreements in Azure before any Integration Account artifact upload task.
- Add to `local.settings.json`:
    - `WORKFLOWS_SUBSCRIPTION_ID`
    - `WORKFLOWS_TENANT_ID`
    - `WORKFLOWS_RESOURCE_GROUP_NAME`
    - `WORKFLOWS_LOCATION_NAME`
    - `WORKFLOWS_MANAGEMENT_BASE_URI`
- Retrieve the deployed Integration Account resource ID and add `WORKFLOWS_INTEGRATION_ACCOUNT_ID` with that value.
- Retrieve the deployed Integration Account callback URL and add `WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL` with that value.
- The provisioning task itself must update `local.settings.json` with those real deployed values.
- In the NEXT Integration Account artifact task, upload the required schemas/maps/certificates/partners/agreements into the Integration Account.
- **CRITICAL — Agreement Schema References**: After uploading schemas AND creating agreements, the agreement's `schemaReferences` array in BOTH `receiveAgreement.protocolSettings` and `sendAgreement.protocolSettings` MUST be populated with references to the uploaded message schemas. An agreement with empty `schemaReferences: []` will cause EdifactDecode/X12Decode actions to fail at runtime with "UnexpectedSegment" errors. For each message type the flow processes, add an entry like `{"messageId": "<messageType>", "schemaVersion": "<version>", "schemaName": "<schemaNameInIA>"}`. Use a PATCH or re-PUT of the agreement after schema upload to add these references.
- If this flow chooses the Integration Account model, schemas/maps/certificates/partner artifacts for that flow must be uploaded and managed through the Integration Account path consistently.
- Do NOT split the same flow between Integration Account artifacts and local `Artifacts/Schemas/` / `Artifacts/Maps/` folders.
- Use local `Artifacts/Schemas/` and `Artifacts/Maps/` folders only when the flow does NOT choose the Integration Account model.
