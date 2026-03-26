---
name: connections-json-generation-rules
description: Rules for generating connections.json files for Logic Apps Standard. Covers serviceProviderConnections format, mandatory reference lookup, FileSystem mountPath rule, and connector parameter constraints.
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

All connections use the `serviceProviderConnections` format:

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

## 3. FileSystem Connection Rules

If the flow uses File System connector:

- The `connections.json` MUST include `mountPath` in `parameterValues` (the ONLY required parameter for runtime).
- Do NOT add `connectionString` or `rootFolder` to the FileSystem connection — they are NOT valid parameters.
- Use `@appsetting("FileSystem_mountPath")` for the value.
- Add `FileSystem_mountPath` to `local.settings.json`.

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
- If this flow chooses the Integration Account model, schemas/maps/certificates/partner artifacts for that flow must be uploaded and managed through the Integration Account path consistently.
- Do NOT split the same flow between Integration Account artifacts and local `Artifacts/Schemas/` / `Artifacts/Maps/` folders.
- Use local `Artifacts/Schemas/` and `Artifacts/Maps/` folders only when the flow does NOT choose the Integration Account model.
