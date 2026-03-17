<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/db2/ -->

# IBM DB2

Connect to IBM DB2 in the cloud or on-premises to read and manage data.

This article describes the operations for the **IBM DB2** built-in connector, which is available only for **Standard workflows** in single-tenant Azure Logic Apps.

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Authentication

### DB2 Connection

#### Parameters

| Name | Description | Type | Required |
|------|-------------|------|----------|
| Server name | The name or IP address of the DB2 server | string | True |
| Port number | The port number for the DB2 server | integer | True |
| Database | The name of the database | string | True |
| User name | The user name for authentication | string | True |
| Password | The password for authentication | securestring | True |
| Package collection | The package collection name | string | True |
| Default schema | The default schema name | string | False |
| Host CCSID | The host coded character set identifier | integer | False |
| PC code page | The PC code page | integer | False |
| Additional keywords | Additional connection string keywords | string | False |
| Connection string | The full connection string (overrides individual settings) | string | False |

## Actions

| Action | Description |
|--------|-------------|
| [DB2 tables](#db2-tables) | Get a list of DB2 tables |
| [Delete row](#delete-row) | Delete a row from a DB2 table |
| [Execute stored procedure](#execute-stored-procedure) | Execute a stored procedure on DB2 |
| [Execute non-query](#execute-non-query) | Execute a non-query SQL statement (INSERT, UPDATE, DELETE) |
| [Execute query](#execute-query) | Execute a SQL query against DB2 |
| [Insert row](#insert-row) | Insert a row into a DB2 table |
| [Update rows](#update-rows) | Update rows in a DB2 table |

### DB2 tables

- **Operation ID:** getTables

Get a list of DB2 tables.

#### Parameters

This action has no parameters.

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Tables | value | array | The list of DB2 tables |

### Delete row

- **Operation ID:** deleteRow

Delete a row from a DB2 table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table |
| Row ID | rowId | True | string | The unique identifier of the row to delete |

#### Returns

This action does not return any values.

### Execute stored procedure

- **Operation ID:** executeStoredProcedure

Execute a stored procedure on DB2.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Procedure Name | procedureName | True | string | The name of the stored procedure |
| Parameters | parameters | False | object | The input parameters for the stored procedure |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Result Sets | resultSets | array | The result sets from the stored procedure |
| Output Parameters | outputParameters | object | The output parameters |
| Return Code | returnCode | integer | The return code |

### Execute non-query

- **Operation ID:** executeNonQuery

Execute a non-query SQL statement such as INSERT, UPDATE, or DELETE.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| SQL Statement | sqlStatement | True | string | The SQL statement to execute |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Rows Affected | rowsAffected | integer | The number of rows affected |

### Execute query

- **Operation ID:** executeQuery

Execute a SQL query against DB2.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| SQL Query | sqlQuery | True | string | The SQL query to execute |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Rows | rows | array | The result set rows |

### Insert row

- **Operation ID:** insertRow

Insert a row into a DB2 table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table |
| Row | row | True | object | The row data to insert |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Row | row | object | The inserted row |

### Update rows

- **Operation ID:** updateRows

Update rows in a DB2 table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | The name of the table |
| Row | row | True | object | The row data with updated values |
| Row ID | rowId | True | string | The unique identifier of the row to update |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Row | row | object | The updated row |

## Triggers

This connector has no triggers.
