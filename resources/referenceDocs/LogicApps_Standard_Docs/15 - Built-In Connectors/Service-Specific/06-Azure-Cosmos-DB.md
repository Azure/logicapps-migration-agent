# Azure Cosmos DB

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurecosmosdb/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurecosmosdb/)

Connect to Azure Cosmos DB to perform document CRUD operations and listen to change feed processor.

This article describes the operations for the Azure Cosmos DB built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Cosmos DB managed connector operations instead, see [Azure Cosmos DB managed connector reference](https://learn.microsoft.com/en-us/connectors/documentdb/).

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Connector how-to guide

For more information about connecting to Azure Cosmos DB from your workflow in Azure Logic Apps, see [Connect to Azure Cosmos DB from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-cosmos-db?tabs=standard).

## Authentication

### connectionString

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Connection string | Azure Cosmos DB connection string | securestring | True |  |

### Managed identity

Managed identity

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Account URI | Azure Cosmos DB account URI | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Create or update item (Preview) | Create or update item. |
| Create or update many items in bulk (Preview) | Create or update many items in bulk. |
| Delete an item (Preview) | Delete an item. |
| Patch an item (Preview) | Patch an item. |
| Query items (Preview) | Query items. |
| Read an item (Preview) | Read an item. |

### Create or update item (Preview)

- **Operation ID:** CreateOrUpdateDocument

Create or update item.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Database Id | databaseId | True | string | The name of the database. |
| Container Id | containerId | True | string | The name of the container. |
| Item | item | True | string | The item to be created or updated. |
| Partition Key | partitionKey |  | string | The partition key for the request. |
| Is Upsert | isUpsert |  | string | If true, the item will be replaced if exists, else it will be created. |
| Session Token | sessionToken |  | string | The session token associated with the read/write operation to maintain session consistency. |
| ETag | etag |  | string | The entity tag associated with the item. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| ETag | eTag | string | The entity tag associated with the item. |
| Timestamp | timestamp | string | The last modified timestamp associated with the item. |
| Activity Id | activityId | string | The activity Id for the item request. |
| Id | id | string | The Id associated with the item. |
| Content | content | string | The content of the item. |
| Request Charge | requestCharge | string | The item request charge measured in request units. |
| Session Token | sessionToken | string | The session token associated with the read/write operation to maintain session consistency. |

### Create or update many items in bulk (Preview)

- **Operation ID:** BulkCreateOrUpdateDocument

Create or update many items in bulk.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Database Id | databaseId | True | string | The name of the database. |
| Container Id | containerId | True | string | The name of the container. |
| Items | items | True | string | The items to be created or updated. |
| Is Upsert | isUpsert |  | string | If true, the item will be replaced if exists, else it will be created. |

#### Returns

The response of the operation.

- **Response** array

### Delete an item (Preview)

- **Operation ID:** DeleteDocument

Delete an item.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Database Id | databaseId | True | string | The name of the database. |
| Container Id | containerId | True | string | The name of the container. |
| Item Id | itemId | True | string | The Id value of the requested item. |
| Partition Key | partitionKey | True | string | The partition key for the request. |
| Session Token | sessionToken |  | string | The session token associated with the read/write operation to maintain session consistency. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Id | id | string | The Id associated with the item. |
| Activity Id | activityId | string | The activity Id for the item request. |
| Request Charge | requestCharge | string | The item request charge measured in request units. |
| Session Token | sessionToken | string | The session token associated with the read/write operation to maintain session consistency. |

### Patch an item (Preview)

- **Operation ID:** PatchItem

Patch an item.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Database Id | databaseId | True | string | The name of the database. |
| Container Id | containerId | True | string | The name of the container. |
| Item Id | itemId | True | string | The Id value of the requested item. |
| Partition Key | partitionKey | True | string | The partition key for the request. |
| Session Token | sessionToken |  | string | The session token associated with the read/write operation to maintain session consistency. |
| Patch | patchOperations | True | string | The name of the database. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Activity Id | activityId | string | The activity Id for the item request. |
| ETag | eTag | string | The entity tag associated with the item. |
| Id | id | string | The Id associated with the item. |
| Content | content | string | The content of the item. |
| Request Charge | requestCharge | string | The item request charge measured in request units. |
| Timestamp | timestamp | string | The last modified timestamp associated with the item. |
| Session Token | sessionToken | string | The session token associated with the read/write operation to maintain session consistency. |

### Query items (Preview)

- **Operation ID:** QueryDocuments

Query items.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Database Id | databaseId | True | string | The name of the database. |
| Container Id | containerId | True | string | The name of the container. |
| SQL Query | queryText | True | string | The Azure Cosmos DB SQL query text. |
| Partition Key | partitionKey |  | string | The partition key for the request. |
| Continuation Token | continuationToken |  | string | The continuation token for this query given by the Azure Cosmos DB service, if any. |
| Max Item Count | maxItemCount |  | string | The maximum number of items to be returned by the query. |
| Session Token | sessionToken |  | string | The session token associated with the read/write operation to maintain session consistency. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Continuation Token | continuationToken | string | The continuation token for this query given by the Azure Cosmos DB service, if any. |
| Request Charge | requestCharge | string | The item request charge measured in request units. |
| Count | count | string | The number of items in the stream. |
| Activity Id | activityId | string | The activity Id for the item request. |
| Items | items | string | The items returned from the query. |
| Session Token | sessionToken | string | The session token associated with the read/write operation to maintain session consistency. |

### Read an item (Preview)

- **Operation ID:** ReadDocument

Read an item.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Database Id | databaseId | True | string | The name of the database. |
| Container Id | containerId | True | string | The name of the container. |
| Item Id | itemId | True | string | The Id value of the requested item. |
| Partition Key | partitionKey | True | string | The partition key for the request. |
| Session Token | sessionToken |  | string | The session token associated with the read/write operation to maintain session consistency. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Activity Id | activityId | string | The activity Id for the item request. |
| ETag | eTag | string | The entity tag associated with the item. |
| Id | id | string | The Id associated with the item. |
| Content | content | string | The content of the item. |
| Request Charge | requestCharge | string | The item request charge measured in request units. |
| Timestamp | timestamp | string | The last modified timestamp associated with the item. |
| Session Token | sessionToken | string | The session token associated with the read/write operation to maintain session consistency. |

## Triggers

| Trigger | Description |
| --- | --- |
| When an item is created or modified (Preview) | When an item is created or modified. |

### When an item is created or modified (Preview)

- **Operation ID:** whenADocumentIsCreatedOrModified

When an item is created or modified.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Database Id | databaseName | True | string | The name of the database with the monitored and lease containers. |
| Monitored Container Id | collectionName | True | string | The name of the container being monitored. |
| Lease Container Id | leaseCollectionName |  | string | The name of the container used to store leases. |
| Create Lease Container | createLeaseCollectionIfNotExists |  | string | If true, the lease container is created when it doesn't already exist. |
| Lease Container Throughput | leasesCollectionThroughput |  | string | The number of Request Units to assign when the lease container is created. |

#### Returns

One or more items received from the Azure Cosmos DB (change feed processor).

- **Response** array

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurecosmosdb/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurecosmosdb/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurecosmosdb/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurecosmosdb/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurecosmosdb/#triggers)
