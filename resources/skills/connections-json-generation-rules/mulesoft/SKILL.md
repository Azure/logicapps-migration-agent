---
name: connections-json-generation-rules
description: Rules for generating connections.json files for Logic Apps Standard. Covers serviceProviderConnections, dynamic connectionName expressions for runtime routing, mandatory reference lookup, FileSystem mountPath rule, and connector parameter constraints.
---

# Skill: Connections JSON Generation Rules

> **Purpose**: Authoritative rules for generating `connections.json` files. Follow exactly.

---

## 1. Mandatory Reference Lookup

BEFORE writing ANY `connections.json`:

1. Call `migration_searchReferenceWorkflows` with `category="connection"` to find the exact `connections.json` format for each connector.
2. Call `migration_readReferenceWorkflow` to read the full JSON.
3. If no results, retry with different wordings.
4. Copy the format verbatim — do NOT invent connection structures.

---

## 2. Connection Structure

Built-in connections use the `serviceProviderConnections` format. Managed connectors use their separate `managedApiConnections` format and do not support the dynamic selection pattern below.

**Compatibility rule:** Assess dynamic selection per action and automatically use it wherever the migration scenario supports runtime connection routing. Unaffected static built-in and managed connections continue using the existing generation rules. Preserve their type, keys, parameters, authentication, and app-setting references; do not rewrite unrelated connections.

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

## 2.1. Dynamic Built-in Connection Selection

Source: [Dynamic Connection Properties in Azure Logic Apps Standard](https://techcommunity.microsoft.com/blog/integrationsonazureblog/dynamic-connection-properties-in-azure-logic-apps-standard/4527525).

- Automatically include every supported dynamic connection scenario in the migration plan and generate it during conversion; do not leave it as an optional suggestion or wait for separate enablement. Static and dynamic actions may coexist and reuse existing built-in connection entries. Merge only necessary additions; do not replace the existing connection file with the reference template or add unused sample connections.
- Use this pattern when source evidence shows supported runtime endpoint selection (dynamic send ports, tenant/partner/team/region routing, or a lookup selecting among several databases, SFTP servers, or messaging namespaces). Generate the expression, all required predefined connection entries, and their app-setting references, not just a recommendation.
- Keep a static connection for a single destination. Deployment-time dev/test/prod differences alone need app settings or parameters, not runtime routing. Changing only a folder, table, queue, or URL within the same connection may need only a dynamic action parameter.
- This pattern applies to built-in `ServiceProvider` actions only, NOT managed `ApiConnection` actions. Author in **Code View**; the designer cannot render or edit dynamic connection names visually. Do not infer trigger support from the action examples.
- Define EVERY possible target as a literal, case-sensitive key in `connections.json.serviceProviderConnections`. Runtime expressions select an existing key; they cannot create connections, construct arbitrary endpoints, or replace connection credentials at runtime.
- All candidates for an action must use the same `serviceProvider.id` as its fixed `serviceProviderId`, with the same supported operation. Keep `operationId` and `serviceProviderId` static; retrieve their exact values and parameters from connector reference examples.
- Resolve an authenticated/authorized business selector through an explicit allowlist of connection keys. Reject missing, unknown, or unauthorized selectors BEFORE any connector action. Never trust a caller-supplied connection name or silently route an unknown tenant to another tenant's connection.
- Choose the connector from source behavior, not from the connector used in an example. Dynamic connection selection applies to any built-in `ServiceProvider` connector.
- Put the expression in `inputs.serviceProviderConfiguration.connectionName`, never in the keys of `connections.json`. Expressions can use validated trigger data, parameters, conditional logic, or a previous action output. When using a resolver action, include a `runAfter` dependency on its success.

Connector-neutral format template only: replace the placeholders with the actual routing expression and exact operation/provider IDs from the selected connector's reference. Do not emit placeholder values in generated workflows.

```json
{
  "serviceProviderConfiguration": {
    "connectionName": "@<expression-returning-an-existing-connection-key>",
    "operationId": "<operation-id-from-selected-connector-reference>",
    "serviceProviderId": "<service-provider-id-from-selected-connector-reference>"
  }
}
```

- Parameterize each candidate's settings using `@appsetting(...)`, with distinct setting names per destination. Keep credentials out of source control and logs; use Key Vault references through Azure app settings for secrets. Enumerate all required local/cloud settings and access/network requirements, not just the first candidate.
- If the destination set is unbounded, the required connector is managed-only, or authorization/routing evidence is missing, record the gap and request the missing decision. Do not claim this feature can express arbitrary runtime credentials or cross-provider switching.
- Search `DynamicConnections` for the generic workflow/connection templates, then search the selected connector for its exact provider/operation IDs, parameters, and authentication. Replace all placeholders before generating real workflows. The managed connection entry illustrates configuration format only, not dynamic selection.

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
