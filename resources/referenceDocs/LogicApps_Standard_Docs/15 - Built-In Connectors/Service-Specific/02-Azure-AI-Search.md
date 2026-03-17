# Azure AI Search

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureaisearch/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureaisearch/)

Connects to Azure AI Search for data search and indexing operations.

This article describes the operations for the Azure AI Search built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps.

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Connector how-to guide

For more information about integrating Azure AI Search with your workflow in Azure Logic Apps, see [Integrate Azure AI services with Standard workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/azure-ai).

## Authentication

### Azure AI Search key-based authentication

The Azure AI Search key-based authentication to use.

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Azure AI Search endpoint URL | The URL for the Azure AI Search endpoint. | string | True |  |
| Azure AI Search admin key | The admin key for Azure AI Search. | securestring | True |  |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Azure AI Search endpoint URL | The URL for the Azure AI Search endpoint. | string | True |  |
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
| Azure AI Search endpoint URL | The URL for the Azure AI Search endpoint. | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Delete a document | Delete a specified document. |
| Delete multiple documents | Delete the specified documents. |
| Get agentic retrieval output (Preview) | Get the agentic retrieval output. |
| Index a document | Index a single document. |
| Index multiple documents | Index the specified documents. |
| Merge document | Merge the specified document. |
| Search vectors | A single vector search with filter. |
| Search vectors with natural language | A single vector search with filter. |

### Delete a document

- **Operation ID:** deleteDocument

Delete a specified document.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Index name | indexName | True | string | The index name. |
| Document to delete | document | True | string | The document to delete. |

### Delete multiple documents

- **Operation ID:** deleteDocuments

Delete the specified documents.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Index name | indexName | True | string | The index name. |
| Documents to delete | documents | True | string | The list of documents to delete. |

### Get agentic retrieval output (Preview)

- **Operation ID:** knowledgeAgentRetrieval

Get the agentic retrieval output.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Index name | indexName | True | string | The index name. |
| Agent name | agentName | True | string | The agent name. |
| agentMessageContent | agentMessageContent | True | string | The index name. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| value | value | string |  |
| The agent output has value. | hasValue | string | Agent output has value |

### Index a document

- **Operation ID:** indexDocument

Index a single document.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Index name | indexName | True | string | The index name. |
| document | document | True | string | The document to index. |

### Index multiple documents

- **Operation ID:** indexDocuments

Index the specified documents.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Index name | indexName | True | string | The index name. |
| Documents to index | documents | True | string | The list of documents to index. |

### Merge document

- **Operation ID:** mergeDocument

Merge the specified document.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Index name | indexName | True | string | The index name. |
| Document to merge | document | True | string | The document to merge. |

### Search vectors

- **Operation ID:** vectorSearch

A single vector search with filter.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Index name | indexName | True | string | The index name. |
| Vector fields and values | searchVector | True | string | The vector fields and values to search. |
| Number of nearest neighbors to return | kNearestNeighbors | True | string | The number of nearest neighbors to return. |
| Search | search |  | string | The search condition to apply before finding the nearest neighbors. |
| Search Mode | searchMode |  | string | The search mode condition to apply before finding the nearest neighbors. |
| Filter condition | filter |  | string | The filtering condition to apply before finding the nearest neighbors. |

#### Returns

An array of objects that contain the vector search results.

- **Vector search results** object

### Search vectors with natural language

- **Operation ID:** integratedVectorSearch

A single vector search with filter.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Index name | indexName | True | string | The index name. |
| Search Text | searchText | True | string | The text to search. |
| Number of nearest neighbors to return | kNearestNeighbors | True | string | The number of nearest neighbors to return. |
| Search | search |  | string | The search condition to apply before finding the nearest neighbors. |
| Filter condition | filter |  | string | The filtering condition to apply before finding the nearest neighbors. |
| The Vector Fields to Search | vectorizedSearchFields |  | string | The Vector Fields to Search. |
| Fields to select | selectFields |  | string | The fields to Select. |

#### Returns

An array of objects that contain the vector search results.

- **Integrated Vector search results** object

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureaisearch/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureaisearch/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureaisearch/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureaisearch/#actions)
