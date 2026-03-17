# DB2

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/db2/

The DB2 connector provides an API to work with DB2 databases.

This article describes the operations for the DB2 built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the DB2 managed connector operations instead, see [DB2 managed connector reference](https://learn.microsoft.com/en-us/connectors/db2/).

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Connector how-to guide

For more information about connecting to DB2 from your workflow in Azure Logic Apps, see [Connect to IBM DB2 from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-db2?tabs=standard).

## Authentication

### Server name

The DB2 server name.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Server name | The DB2 server name. | string | False | |

### Port number

The port number for the database on the DB2 server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Port number | The port number for the database on the DB2 server. | int | False | |

### Database

The name of the database on the DB2 server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Database | The name of the database on the DB2 server. | string | False | |

### User name

The user name for accessing the DB2 server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| User name | The user name for accessing the DB2 server. | string | False | |

### Password

Password for the DB2 user name

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | Password for the DB2 user name | securestring | False | |

### Package collection

The package collection.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Package collection | The package collection. | string | False | |

### Default schema

The default schema for schema calls.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Default schema | The default schema for schema calls. | string | False | |

### Host CCSID

The host coded character set identifier (CCSID) of the DB2 database.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Host CCSID | The host coded character set identifier (CCSID) of the DB2 database. | int | False | |

### PC code page

The PC code page for the DB2 connection.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| PC code page | The PC code page for the DB2 connection. | int | False | |

### Additional connection string keywords

Optional keywords. For example, 'Default Qualifier=User2;DBMS Platform=DB2/AS400'. Multiple values should be separated by semi-colons

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Additional connection string keywords | Optional keywords. For example, 'Default Qualifier=User2;DBMS Platform=DB2/AS400'. Multiple values should be separated by semi-colons | int | False | |

### Connection string

DB2 connection string

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Connection string | DB2 connection string | securestring | False | |

## Actions

| Operation | Description |
|-----------|-------------|
| DB2 tables | Return tables in DB2 schema. |
| Delete row | Delete row or rows. |
| Execute a stored procedure | Stored procedure |
| Execute non-query | Execute a SQL command that does not return a result set. |
| Execute query | Execute a SQL query. |
| Insert row | Insert a row. |
| Update rows | Update row or rows. |

### DB2 tables

- **Operation ID:** getTables

Return tables in DB2 schema.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Schema | schema | | string | The name of the schema. |

#### Returns

The DB2 tables.

- **DB2 tables** array

### Delete row

- **Operation ID:** deleteRow

Delete row or rows.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | table | True | string | The name of the table. |
| Columns used in the 'WHERE' clause | searchCondition | True | object | Column names with the values used to determine which rows to delete. |

### Execute a stored procedure

- **Operation ID:** storedProcedure

Stored procedure

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Stored procedure | procedureName | True | string | The name of the stored procedure. |
| Stored procedure parameters | procedureParameters | | string | The parameters for executing the stored procedure. |

#### Returns

The output from executing the stored procedure.

- **Output** array

### Execute non-query

- **Operation ID:** executeNonQuery

Execute a SQL command that does not return a result set.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| SQL statement | statement | True | string | The SQL statement to execute. |
| Statement parameters | sqlParameters | | object | The parameters for the SQL query. |

### Execute query

- **Operation ID:** executeQuery

Execute a SQL query.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Query | query | True | string | The SQL query. |
| Query parameters | queryParameters | | object | Parameters for the SQL query. |

#### Returns

The result of the SQL query.

- **Result** array

### Insert row

- **Operation ID:** insertRow

Insert a row.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | table | True | string | The name of the table. |
| Values to insert | insertParameters | True | object | The column names with the values to insert. |

### Update rows

- **Operation ID:** updateRow

Update row or rows.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | table | True | string | The name of the table. |
| Values to update | updatedColumns | True | object | The names of columns with the updated values. |
| Columns used in the 'WHERE' clause | searchCondition | True | object | The names of columns with the values that determine the rows to update. |

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/db2/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/db2/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/db2/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/db2/#actions)
