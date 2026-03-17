# SQL Server

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sql/

Connect to SQL Server so that you can manage your SQL database.

This article describes the operations for the SQL Server built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the SQL Server managed connector operations instead, see [SQL Server managed connector reference](https://learn.microsoft.com/en-us/connectors/sql/).

---

## Built-in connector settings

In a Standard logic app resource, the SQL Server built-in connector includes settings that control various thresholds for performance, throughput, capacity, and so on. For example, you can change the query timeout value for SQL operations. For more information, review [Reference for app settings - local.settings.json](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings#reference-local-settings-json).

---

## Enable authentication for SQL Server

With the built-in connector, you can authenticate your connection with either a managed identity, Azure Active Directory (Azure AD), or a connection string. For managed identity authentication or Azure Active Directory authentication, you have to set up your SQL Server to work with these authentication types. For more information, see [Authentication - SQL Server managed connector reference](https://learn.microsoft.com/en-us/connectors/sql/#authentication).

---

## Connector how-to guide

For more information about connecting to SQL Server from your workflow in Azure Logic Apps, see [Connect to SQL databases from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-sqlazure?tabs=standard).

---

## Authentication

### Connection string

The connection string for SQL Server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Connection string | The connection string for SQL Server. | securestring | True | |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Server name | The endpoint for SQL server. | string | True | |
| Database name | The name for the SQL database. | string | True | |
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
| Managed identity | Managed identity | string | True | |
| Managed identity type | The type of managed identity | string | False | SystemAssigned, UserAssigned |
| Identity client id | The client id of user identity | string | True | |
| Server name | The endpoint for SQL server. | string | True | |
| Database name | The name for the SQL database. | string | True | |
| Managed identity | Managed identity | string | False | |

---

## Actions

| Action | Description |
|--------|-------------|
| Delete rows | Delete one or more rows that match the specified condition and return the deleted rows. |
| Execute query | Run a query on a SQL database. |
| Execute stored procedure | Run a stored procedure on a SQL database. |
| Get rows | Get one or more table rows that match the specified condition. |
| Get rows (V2) (Preview) | Get table row(s) matching the specified condition. |
| Get tables | Get a list of all the tables in the SQL database. |
| Insert row | Insert a single row in the specified table. |
| Update rows | Update one or more rows that match the specified condition. |

### Delete rows

- **Operation ID:** deleteRows

Delete one or more rows that match the specified condition and return the deleted rows.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |
| Where condition | columnValuesForWhereCondition | | object | An object that contains the column names and values, as key-value pairs, that select the rows to delete. |
| Primary Key | primaryKey | | string | A comma separated string containing values for each column in the primary key in correct order. 'Primary Key' parameter and 'Where condition' parameter cannot be used at the same time. |

#### Returns

An array object that contains all the deleted rows. Each row contains the column name and deleted value.

- **Result** array

### Execute query

- **Operation ID:** executeQuery

Run a query on a SQL database.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Query | query | True | string | The SQL query body to execute. |
| Query parameters | queryParameters | | object | The parameters for the SQL query. If the query requires input parameters, you must provide these parameters. |

#### Returns

An array object that contains all the query results. Each row contains the column name and value.

- **Result** array

### Execute stored procedure

- **Operation ID:** executeStoredProcedure

Run a stored procedure on a SQL database.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Procedure name | storedProcedureName | True | string | The name for the stored procedure. |
| Parameters | storedProcedureParameters | | object | The parameters for the stored procedure. If the stored procedure requires input parameters, you must provide these parameters. |
| Include Empty Result Sets | includeEmptyResultSets | | string | Flag to include empty result sets. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Result Sets | resultSets | string | An array object that contains all the result sets from the stored procedure, which might return zero, one, or multiple result sets. |
| Stored Procedure Parameters | outputParameters | string | An object that contains the final values for the stored procedure's output and input-output parameters. |
| Return Code | returnCode | string | The integer value that represents the return code from the stored procedure. |

### Get rows

- **Operation ID:** getRows

Get one or more table rows that match the specified condition.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |
| Where condition | columnValuesForWhereCondition | | object | An object that contains the column names and values, as key-value pairs, that select the rows to get. |
| Primary Key | primaryKey | | string | A comma separated string containing values for each column in the primary key in correct order. 'Primary Key' parameter and 'Where condition' parameter cannot be used at the same time. |
| OData Query Options | queries | | object | The OData query options. |

#### Returns

All the retrieved rows.

- **Result** array

### Get rows (V2) (Preview)

- **Operation ID:** getRowsV2

Get table row(s) matching the specified condition.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |
| OData Query Options | queries | | object | The OData query options. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Value | value | string | Item list. |

### Get tables

- **Operation ID:** getTables

Get a list of all the tables in the SQL database.

#### Returns

The returned table list, including full names and display names.

- **Result** array

### Insert row

- **Operation ID:** insertRow

Insert a single row in the specified table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |
| Set columns | setColumns | | object | An object that contains the column names and values, as key-value pairs, to insert. If the table columns have default or autogenerated values, you can leave this field empty. |

#### Returns

The inserted row, including the names and values for any autogenerated, default, and null value columns.

- **Result** object

### Update rows

- **Operation ID:** updateRows

Update one or more rows that match the specified condition.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |
| Where condition | columnValuesForWhereCondition | | object | An object that contains the column names and values, as key-value pairs, that select the rows to update. |
| Set columns | setColumns | True | object | An object that contains the column names and values, as key-value pairs, to use for updating the rows. |
| Primary Key | primaryKey | | string | A comma separated string containing values for each column in the primary key in correct order. 'Primary Key' parameter and 'Where condition' parameter cannot be used at the same time. |

#### Returns

An array object that contains all the columns for the updated rows.

- **Result** array

---

## Triggers

| Trigger | Description |
|---------|-------------|
| When a row is deleted | Trigger a workflow run when a row is deleted from the table. |
| When a row is inserted | Trigger a workflow run when a row is inserted in the table. |
| When a row is modified | Trigger a workflow run when a row is modified, such as inserted or updated, in the table. |
| When a row is updated | Trigger a workflow run when a row is updated in the table. |

### When a row is deleted

- **Operation ID:** whenARowIsDeleted

Trigger a workflow run when a row is deleted from the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |

#### Returns

The row that was deleted.

- **Deleted rows** array

### When a row is inserted

- **Operation ID:** whenARowIsInserted

Trigger a workflow run when a row is inserted in the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |

#### Returns

The row that was inserted.

- **Inserted rows** array

### When a row is modified

- **Operation ID:** whenARowIsModified

Trigger a workflow run when a row is modified, such as inserted or updated, in the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |

#### Returns

The row that was modified.

- **Modified rows** array

### When a row is updated

- **Operation ID:** whenARowIsUpdated

Trigger a workflow run when a row is updated in the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | The name for the table. |

#### Returns

The row that was updated.

- **Updated rows** array

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sql/#built-in-connector-settings)
- [Enable authentication for SQL Server](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sql/#enable-authentication-for-sql-server)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sql/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sql/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sql/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sql/#triggers)
