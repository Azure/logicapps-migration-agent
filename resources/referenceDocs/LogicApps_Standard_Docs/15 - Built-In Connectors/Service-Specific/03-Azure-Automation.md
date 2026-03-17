# Azure Automation

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureautomation/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureautomation/)

The Azure Automation connector provides an API to work with Azure Automation Accounts.

This article describes the operations for the Azure Automation built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Automation managed connector operations instead, see [Azure Automation managed connector reference](https://learn.microsoft.com/en-us/connectors/azureautomation/).

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Authentication

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Cloud Endpoint | Base URI Endpoint for the cloud | string | False |  |
| Active Directory OAuth | Active Directory OAuth | string | True |  |
| Authority | Active Directory authority | string | False |  |
| Tenant | Active Directory tenant | string | True |  |
| Credential type | Active Directory credential type | string | False | Certificate, Secret |
| Client ID | Active Directory client ID | string | True |  |
| Client secret | Active Directory client secret | securestring | True |  |
| Pfx | Active Directory pfx | securestring | True |  |
| Password | Active Directory password | securestring | True |  |

### Managed identity

Managed identity

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Cloud Endpoint | Base URI Endpoint for the cloud | string | False |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Create Job | Create Job to run on Hybrid Worker. |
| Get Job Output | Get Outputs of an Azure Automation Job. |
| Get Status of Job | Get Status of a Job |

### Create Job

- **Operation ID:** createJob

Create Job to run on Hybrid Worker.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Subscription Id | subscriptionId | True | string | The unique identifier for the Microsoft Azure Subscription. The Subscription Id forms a part of the ID for every Azure Resource |
| Resource Group | resourceGroup | True | string | The name of the Azure Resource Group |
| Automation Account | automationAccount | True | string | The name of the Azure Automation Account |
| Wait For Job | waitForJob |  | string | Wait for the job to finish before completing the action. |
| Hybrid Automation Worker Group | hybridAutomationWorkerGroup |  | string | Worker Group to Run on. |
| Runbook Name | runbookName | True | string | Name of the runbook to run. |
| Runbook Parameters | runbookParameters |  | object | Runbook Parameters as key/value pair {..} |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Job Id | jobId | string | GUID for the automation job. |
| End Time | endTime | string | Time the job completed. |
| Start Time | startTime | string | Time the job started. |
| Status | status | string | Status of the job. |
| Creation Time | creationTime | string | Creation Time for the Job. |
| Status Details | statusDetails | string | Details on the status of the job. |

### Get Job Output

- **Operation ID:** getJobOutput

Get Outputs of an Azure Automation Job.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Subscription Id | subscriptionId | True | string | The unique identifier for the Microsoft Azure Subscription. The Subscription Id forms a part of the ID for every Azure Resource |
| Resource Group | resourceGroup | True | string | The name of the Azure Resource Group |
| Automation Account | automationAccount | True | string | The name of the Azure Automation Account |
| Job Id | jobId | True | string | GUID for the automation job. |

#### Returns

Runbook content from the job.

- **Content** string

### Get Status of Job

- **Operation ID:** getJobStatus

Get Status of a Job

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Subscription Id | subscriptionId | True | string | The unique identifier for the Microsoft Azure Subscription. The Subscription Id forms a part of the ID for every Azure Resource |
| Resource Group | resourceGroup | True | string | The name of the Azure Resource Group |
| Automation Account | automationAccount | True | string | The name of the Azure Automation Account |
| Job Id | jobId | True | string | GUID for the automation job. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Job Id | jobId | string | GUID for the automation job. |
| End Time | endTime | string | Time the job completed. |
| Start Time | startTime | string | Time the job started. |
| Status | status | string | Status of the job. |
| Creation Time | creationTime | string | Creation Time for the Job. |
| Status Details | statusDetails | string | Details on the status of the job. |

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureautomation/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureautomation/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureautomation/#actions)
