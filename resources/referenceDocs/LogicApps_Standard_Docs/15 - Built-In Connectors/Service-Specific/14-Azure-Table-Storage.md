# Azure Table Storage

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azuretables/

Connect to your Azure Table Storage to create, query and update, table entries and tables.

This article describes the operations for the Azure Table Storage built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Table Storage managed connector operations instead, see [Azure Table Storage managed connector reference](https://learn.microsoft.com/en-us/connectors/azuretables/).

---

## Built-in connector settings

In a Standard logic app resource, the Azure Table Storage built-in connector includes settings that control various thresholds for performance, timeout, execution time, and so on. For example, you can change the timeout value for table storage requests from the Azure Logic Apps runtime. For more information, review [Reference for host settings - host.json - Table and queue storage](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings#built-in-storage).

---

## Authentication

### Connection String

The connection string for Azure Storage.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Connection String | The connection string for Azure Storage. | securestring | True | |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Table Storage endpoint | Table Storage endpoint eg: https://[tablename].table.core.windows.net/ | string | True | |
| Active Directory OAuth | Active Directory OAuth | string | True | |
| Authority | Active Directory authority | string | False | |
| Tenant | Active Directory tenant | string | True | |
| Credential type | Active Directory credential type | string | False | Certificate, Secret |
| Client ID | Active Directory client ID | string | True | |
| Client secret | Active Directory client secret | securestring | True | |
| Pfx | Active Directory pfx | securestring | True | |
| Password | Active Directory password | securestring | True | |

### Managed identity

Managed identity

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Table Storage endpoint | Table Storage endpoint eg: https://[tablename].table.core.windows.net/ | string | True | |
| Managed identity | Managed identity | string | True | |
| Managed identity | Managed identity | string | False | |

---

## Actions

| Operation | Description |
|-----------|-------------|
| Create table | Creates a table in Azure Table Storage. |
| Delete Entity | Deletes the entity in the table. |
| Delete table | Deletes a table in Azure Table Storage. |
| Get Entity | Gets an entity in the table. |
| Insert or Update Entity | Inserts or updates an entity in the table. |
| List tables | Lists tables from Azure Table Storage. |
| Query Entities | Queries the table for entities. |
| Update Entity | Updates an entity in the table. |

### Create table

- **Operation ID:** createTable

Creates a table in Azure Table Storage.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table. |
| Fail if table exists | failIfTableExists | | string | The flag to fail the operation if table already exists. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Table Name | tableName | string | The name of the table. |

### Delete Entity

- **Operation ID:** deleteEntity

Deletes the entity in the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table. |
| Partition Key | partitionKey | True | string | The partition key for the entity in the table. |
| Row Key | rowKey | True | string | The row key for the entity in the table. |
| If Match | ifMatch | | string | The ETag value to be used for conditionally performing the operation. |

### Delete table

- **Operation ID:** deleteTable

Deletes a table in Azure Table Storage.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table. |

### Get Entity

- **Operation ID:** getEntity

Gets an entity in the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table. |
| Partition Key | partitionKey | True | string | The partition key for the entity in the table. |
| Row Key | rowKey | True | string | The row key for the entity in the table. |
| Selected Properties | select | | string | Specify the list of properties to be included in result. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Partition Key | PartitionKey | string | |
| Row Key | RowKey | string | |
| Timestamp | Timestamp | string | |
| ETag | odata.etag | string | |

### Insert or Update Entity

- **Operation ID:** upsertEntity

Inserts or updates an entity in the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table. |
| Entity | entity | True | string | The table entity in JSON format. The properties 'PartitionKey' and 'RowKey' must be specified. |
| Fail if entity exists | failIfEntityExists | | string | The flag to fail the operation if the entity already exists. |
| Update Mode | updateMode | | string | The option to either merge with or replace the existing entity while updating it. |

### List tables

- **Operation ID:** listTables

Lists tables from Azure Table Storage.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Continuation Token | continuationToken | | string | The continuation token from a previous call. |
| Filter | filter | | string | The operation only returns the values that satisfy the specified filter contitions. |
| Top | top | | string | Top |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Tables | tables | string | The list of tables from Azure Table Storage. |
| continuationToken | continuationToken | string | |

### Query Entities

- **Operation ID:** queryEntities

Queries the table for entities.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table. |
| Continuation Token | continuationToken | | string | The continuation token from a previous call. |
| Filter | filter | | string | The operation only returns the values that satisfy the specified filter contitions. |
| Selected Properties | select | | string | Specify the list of properties to be included in result. |
| Top | top | | string | Top |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Entities | entities | string | |
| continuationToken | continuationToken | string | |

### Update Entity

- **Operation ID:** updateEntity

Updates an entity in the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table. |
| Entity | entity | True | string | The table entity in JSON format. The properties 'PartitionKey' and 'RowKey' must be specified. |
| Update Mode | updateMode | | string | The option to either merge with or replace the existing entity while updating it. |
| If Match | ifMatch | | string | The ETag value to be used for conditionally performing the operation. |

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azuretables/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azuretables/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azuretables/#actions)
