# Azure AI Document Intelligence

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)

Connects to Azure AI Document Intelligence and performs operations on supported documents.

This article describes the operations for the Azure AI Document Intelligence built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure AI Document Intelligence managed connector operations instead, see [Azure AI Document Intelligence (form recognizer)](https://learn.microsoft.com/en-us/connectors/formrecognizer/).

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Authentication

### Endpoint URL and key-based authentication

Authentication type

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Endpoint URL | Endpoint URL for Document Intelligence | string | True |  |
| Access key | Access key for Document Intelligence | securestring | True |  |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Endpoint URL | Endpoint URL for Document Intelligence | string | True |  |
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
| Endpoint URL | Endpoint URL for Document Intelligence | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Analyze document | Analyzes a document using the specified document analysis model. |

### Analyze document

- **Operation ID:** analyzeDocument

Analyzes a document using the specified document analysis model.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Model ID | modelId |  | string | The ID for the document analysis model to use. |
| modelIdInputs | modelIdInputs |  | string | The model ID inputs object, based on model ID. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Content output details | content | string | The details about the text or Markdown content output. |

## Additional Links

- [Learn](https://learn.microsoft.com/en-us/)
- [Azure](https://learn.microsoft.com/en-us/azure/)
- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/#actions)
