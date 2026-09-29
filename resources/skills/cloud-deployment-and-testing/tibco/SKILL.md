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

1. **Generate ARM/Bicep template** that deploys the Logic App Standard resource with all required dependencies.
2. **Deploy using `az deployment group create`** — do NOT use zip deploy for infrastructure.
3. **ALL app settings MUST be in the Bicep template** — do NOT use `az webapp config appsettings set` as a separate step. Bicep redeploys REPLACE all settings. Any setting not in the template will be wiped on the next deploy.
4. For File System scenarios, add the cloud-specific app settings and connection values required by Azure. Do NOT assume the local file-system mount setup is enough for cloud testing.
5. For File System connections in Azure using the **built-in service provider** (`/serviceProviders/FileSystem`), use Azure Files mounts — no username/password needed in `connections.json`. The `mountPath` app setting and `azureStorageAccounts` site config handle authentication.
6. For File System mount paths in Azure, do NOT use `/home`, `/home/site`, or `/home/site/wwwroot`. On Windows Logic Apps, mount paths must be under `/mounts/` (e.g., `/mounts/edi-files`).

### 2.1 Critical App Settings Rules

These rules prevent the most common deployment failures:

- **`FUNCTIONS_WORKER_RUNTIME` MUST be `dotnet`** — Logic Apps Standard uses `dotnet` for in-process .NET custom code. Use the same value as `local.settings.json`. Do NOT use `dotnet-isolated` or `node`.
- **`WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`** and **`WEBSITE_CONTENTSHARE`** are REQUIRED for WS1 (WorkflowStandard) plans. Without them, the runtime won't start.
- **`WEBSITE_CONTENTSHARE`** should be set to the Logic App name (e.g., `la-my-app`). Azure auto-creates this file share for runtime content.
- **`FUNCTIONS_EXTENSION_VERSION`** MUST be `~4`.
- **`APP_KIND`** MUST be `workflowapp`.
- **Never set `ProjectDirectoryPath`** in cloud — it's for local `func start` only.
- **`@secure()` parameters with `&` characters** (like Integration Account callback URLs) must be placed in the Bicep parameters file, NOT passed inline via shell arguments. The `&` is interpreted as a shell operator and truncates the value.

### 2.2 Content Deployment (Workflow Files)

After Bicep deploys infrastructure, deploy workflow content to the `WEBSITE_CONTENTSHARE` Azure Files share under `site/wwwroot/`:

- **Use `az storage file upload`** to the content share — NOT `az webapp deploy` or zip deploy. This gives atomic control over each file.
- Upload: `host.json`, `connections.json`, `{workflow-name}/workflow.json`, `lib/custom/**`
- Do NOT upload: `local.settings.json`, `.vscode/`, `workflow-designtime/`, `.azurite/`
- Do NOT create nested `site/wwwroot/site/wwwroot/` paths.
- After upload, restart with `az logicapp restart` (NOT `az webapp restart`).

### 2.3 Deployment Script Safety

- App settings with SAS URLs are applied from a JSON file or Bicep parameters, not inline shell arguments.
- Exclude the `.azurite/` folder from any content upload or publish step.
- Runtime mount path in app settings matches `connections.json`.
- File System mount path must not overlap with `site/wwwroot` or any parent `/home` content path.
- The deployment path does not depend on portal-only manual steps.

---

## 2.5 Reference Bicep Template

Use this as the starting point for every Logic App Standard cloud deployment. Adapt parameters as needed.

```bicep
@description('Name of the Logic App Standard resource')
param logicAppName string

@description('Name of the App Service Plan')
param appServicePlanName string

@description('Name of the Storage Account (3-24 chars, lowercase, no hyphens)')
param storageAccountName string

@description('Location for all resources')
param location string = resourceGroup().location

// ─── OPTIONAL: Integration Account (only if EDI/B2B actions are used) ───
@description('Integration Account resource ID (empty string if not used)')
param integrationAccountId string = ''

@description('Integration Account callback URL (empty string if not used)')
@secure()
param integrationAccountCallbackUrl string = ''

// ─── OPTIONAL: File System mount (only if FileSystem service provider is used) ───
@description('File system mount path — MUST be under /mounts/ for Windows')
param fileSystemMountPath string = '/mounts/filesystem'

@description('Azure Files share name for file system connector')
param fileShareName string = 'app-files'

// ─── Storage Account ───
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

// ─── Azure Files share (for FileSystem connector — omit if not needed) ───
resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileService
  name: fileShareName
  properties: { shareQuota: 5 }
}

// ─── App Service Plan (WS1) ───
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  sku: {
    tier: 'WorkflowStandard'
    name: 'WS1'
  }
  kind: 'elastic'
  properties: { elasticScaleEnabled: false }
}

// ─── Logic App Standard ───
resource logicApp 'Microsoft.Web/sites@2023-01-01' = {
  name: logicAppName
  location: location
  kind: 'functionapp,workflowapp'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      netFrameworkVersion: 'v8.0'
      use32BitWorkerProcess: false
      appSettings: [
        // ── Required runtime settings ──
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'WEBSITE_CONTENTSHARE', value: logicAppName }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'dotnet' }         // Same as local.settings.json
        { name: 'FUNCTIONS_INPROC_NET8_ENABLED', value: '1' }        // Required for .NET 8 custom code
        { name: 'APP_KIND', value: 'workflowapp' }                    // MUST be 'workflowapp'
        { name: 'AzureWebJobsFeatureFlags', value: 'EnableMultiLanguageWorker' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~18' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }         // MUST be '~4'
        // ── Workflow management settings ──
        { name: 'WORKFLOWS_SUBSCRIPTION_ID', value: subscription().subscriptionId }
        { name: 'WORKFLOWS_TENANT_ID', value: subscription().tenantId }
        { name: 'WORKFLOWS_RESOURCE_GROUP_NAME', value: resourceGroup().name }
        { name: 'WORKFLOWS_LOCATION_NAME', value: location }
        { name: 'WORKFLOWS_MANAGEMENT_BASE_URI', value: environment().resourceManager }
        // ── Integration Account (omit both if not used) ──
        { name: 'WORKFLOWS_INTEGRATION_ACCOUNT_ID', value: integrationAccountId }
        { name: 'WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL', value: integrationAccountCallbackUrl }
        // ── FileSystem connector (omit if not used) ──
        { name: 'FileSystem_mountPath', value: fileSystemMountPath }
      ]
      // ── Azure Files mount (omit entire block if FileSystem connector not used) ──
      azureStorageAccounts: {
        appfiles: {
          type: 'AzureFiles'
          accountName: storageAccount.name
          shareName: fileShareName
          mountPath: fileSystemMountPath          // MUST match FileSystem_mountPath
          accessKey: storageAccount.listKeys().keys[0].value
        }
      }
    }
  }
}

output logicAppName string = logicApp.name
output logicAppDefaultHostName string = logicApp.properties.defaultHostName
output storageAccountName string = storageAccount.name
output logicAppResourceId string = logicApp.id
```

### 2.6 Reference Parameters File

Put the callback URL here — NOT in shell arguments — because it contains `&` characters.

```json
{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "logicAppName": { "value": "la-my-app" },
        "appServicePlanName": { "value": "asp-my-app" },
        "storageAccountName": { "value": "stmyapp" },
        "location": { "value": "eastus" },
        "integrationAccountId": {
            "value": "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Logic/integrationAccounts/{name}"
        },
        "integrationAccountCallbackUrl": {
            "value": "https://prod-XX.eastus.logic.azure.com:443/integrationAccounts/...?api-version=2015-08-01-preview&sp=%2F%2F%2A&sv=1.0&sig=..."
        },
        "fileSystemMountPath": { "value": "/mounts/edi-files" },
        "fileShareName": { "value": "edi-files" }
    }
}
```

### 2.7 Reference Content Deployment Script (PowerShell)

Upload workflow content to the WEBSITE_CONTENTSHARE Azure Files share after Bicep deployment.

```powershell
param(
    [string]$ResourceGroup,
    [string]$StorageAccountName,
    [string]$LogicAppName,          # Also the content share name
    [string]$SourceDir              # Path to the logic app project folder
)

# Get storage key
$key = az storage account keys list --account-name $StorageAccountName `
    --resource-group $ResourceGroup --query "[0].value" -o tsv

$share = $LogicAppName  # WEBSITE_CONTENTSHARE = logic app name

# Create directories
$dirs = @(
    "site/wwwroot"
    # Add workflow and lib dirs as needed:
    # "site/wwwroot/my-workflow"
    # "site/wwwroot/lib/custom/net8"
    # "site/wwwroot/lib/custom/MyFunction"
)
foreach ($d in $dirs) {
    az storage directory create --share-name $share --name $d `
        --account-name $StorageAccountName --account-key $key 2>$null
}

# Upload files (recursive helper)
function Upload-File($localPath, $sharePath) {
    az storage file upload --share-name $share --source $localPath `
        --path $sharePath --account-name $StorageAccountName `
        --account-key $key --no-progress 2>$null
}

# Upload core files
Upload-File "$SourceDir\host.json"        "site/wwwroot/host.json"
Upload-File "$SourceDir\connections.json" "site/wwwroot/connections.json"

# Upload workflow(s)
Get-ChildItem "$SourceDir" -Directory | Where-Object {
    Test-Path "$($_.FullName)\workflow.json"
} | ForEach-Object {
    $wfName = $_.Name
    az storage directory create --share-name $share `
        --name "site/wwwroot/$wfName" `
        --account-name $StorageAccountName --account-key $key 2>$null
    Upload-File "$($_.FullName)\workflow.json" "site/wwwroot/$wfName/workflow.json"
}

# Upload lib/custom (function DLLs + function.json)
if (Test-Path "$SourceDir\lib\custom") {
    Get-ChildItem "$SourceDir\lib\custom" -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring("$SourceDir\".Length).Replace('\', '/')
        $parentDir = "site/wwwroot/" + ($rel -replace '/[^/]+$', '')
        az storage directory create --share-name $share --name $parentDir `
            --account-name $StorageAccountName --account-key $key 2>$null
        Upload-File $_.FullName "site/wwwroot/$rel"
    }
}

# Restart
az logicapp restart --name $LogicAppName --resource-group $ResourceGroup
Write-Host "Deployment complete. Wait ~60s for warmup."
```

> **Do NOT upload**: `local.settings.json`, `.vscode/`, `workflow-designtime/`, `.azurite/`, `.gitignore`, `.funcignore`

---

## 3. Cloud Testing

1. Read `TEST-REPORT.md` and run EVERY test scenario from it against the deployed Azure Logic App — happy path, error path, cross-workflow chain, timeout, resubmission — all of them, not a subset.
2. If `BLACKBOX-TEST-REPORT.md` exists in the project root (generated by the local black box testing task), read it and re-execute ALL test cases from that report against the deployed Azure Logic App as well. Include those results in `CLOUD-TEST-REPORT.md`.
3. Fix any cloud-specific issues via `az webapp config appsettings set` — NEVER edit `local.settings.json`.
4. If the workflow uses File System triggers or actions, verify the Azure-side File System connection/authentication works in cloud execution, not just local mounted execution.
5. After all tests pass, UPDATE the ARM/Bicep template to include ALL changes made during testing so the template alone can reproduce the working deployment from scratch.

### 3.1 Querying Workflow Run History

Use API version `2024-11-01` (NOT `2024-02-02` which is unsupported for the hostruntime API):

```
GET https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{app}/hostruntime/runtime/webhooks/workflow/api/management/workflows/{workflow}/runs?api-version=2024-11-01
```

With `az rest`:

```bash
az rest --method GET \
  --url "https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{app}/hostruntime/runtime/webhooks/workflow/api/management/workflows/{workflow}/runs?api-version=2024-11-01" \
  --resource "https://management.azure.com"
```

To get action details for a specific run:

```bash
az rest --method GET \
  --url "https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{app}/hostruntime/runtime/webhooks/workflow/api/management/workflows/{workflow}/runs/{runId}/actions?api-version=2024-11-01" \
  --resource "https://management.azure.com"
```

> **Note**: The `--resource` flag is required when using `az rest` against the hostruntime path.

### 3.2 Uploading Test Files (File System Trigger)

For workflows with File System triggers, upload test files to the **separate Azure Files share** (NOT the content share):

```bash
# Upload to the FileSystem connector share (e.g., 'edi-files'), NOT the content share
az storage file upload --share-name edi-files \
  --source ./test-input.edi --path "In/test-input.edi" \
  --account-name $STORAGE_ACCOUNT --account-key $KEY
```

### 3.3 Cold Start and Warmup

After deployment or restart, Logic Apps Standard on WS1 takes **60–180 seconds** to fully initialize. The hostruntime API returns `ServiceUnavailable` during this period. Wait before querying run history.

---

## 4. Cloud Test Report

Generate `CLOUD-TEST-REPORT.md` with:

- This report is MANDATORY. Do NOT consider the cloud deployment/testing task complete until `CLOUD-TEST-REPORT.md` has been created and populated.

- Deployment details (resource names, regions, SKUs).
- Cloud test results per scenario.
- Final Bicep template summary.
- Full step-by-step cloud deployment guide (reproducible from scratch).

---

## 5. Common Pitfalls (Lessons Learned)

| Pitfall                                                                     | Symptom                                                         | Fix                                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Missing `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` + `WEBSITE_CONTENTSHARE` | Runtime crashes, ServiceUnavailable forever                     | Add both to Bicep appSettings (most common cause of startup failure) |
| Callback URL passed via shell `--parameters "url=$var"`                     | URL truncated at first `&`                                      | Put in parameters JSON file                                          |
| Empty callback URL in parameters file                                       | Next Bicep deploy wipes the setting                             | Always populate before deploy                                        |
| Windows mount path `/mnt/...`                                               | DeploymentFailed: "MountPath must be sub-directory of \\mounts" | Use `/mounts/...`                                                    |
| `az webapp deploy --type zip`                                               | Content share diverges from wwwroot                             | Use `az storage file upload` to content share                        |
| `az webapp restart` for Logic Apps                                          | May not restart workflow runtime                                | Use `az logicapp restart`                                            |
| Query runs with `api-version=2024-02-02`                                    | NoRegisteredProviderFound error                                 | Use `2024-11-01`                                                     |
| `az rest` without `--resource` flag                                         | 401 Unauthorized on hostruntime URLs                            | Add `--resource "https://management.azure.com"`                      |
| Settings set via `az webapp config appsettings set`                         | Wiped on next Bicep redeploy                                    | Put ALL settings in Bicep template                                   |

```

```


