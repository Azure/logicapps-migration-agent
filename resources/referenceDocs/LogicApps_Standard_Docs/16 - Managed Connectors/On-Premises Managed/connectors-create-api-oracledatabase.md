<!-- Source: https://learn.microsoft.com/en-us/connectors/oracle/ -->
<!-- Title: Oracle Database Managed Connector -->

# Oracle Database managed connector for Azure Logic Apps

Applies to: **Azure Logic Apps (Consumption and Standard)**. Reference checked on **2026-09-16**.

The Microsoft-published **Oracle Database managed connector** connects workflows to an on-premises Oracle database or an Azure virtual machine with Oracle Database installed. It supports table operations, native queries, and stored procedures through an on-premises data gateway. Oracle views are supported as read-only tables.

This resource summarizes the [Oracle Database connector reference](https://learn.microsoft.com/en-us/connectors/oracle/) for Logic Apps. The connector is available in all Logic Apps regions except US Department of Defense (DoD). Its **Standard** connector classification is not a restriction to the Logic Apps Standard hosting plan.

> [!NOTE]
> This document describes the **managed** connector, shown under **Shared** in the designer. Logic Apps Standard also has a separate **built-in Oracle connector (public preview)** for Oracle Database 11 and later, with direct runtime connectivity and no gateway requirement. Its operation IDs, parameters, connection format, and limitations are different. Do not apply the managed connector details below to the built-in connector. See the [Logic Apps Oracle setup and built-in reference](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-oracledatabase).

## Supported versions

* Oracle 9 and later
* Oracle Data Access Client (ODAC) 11.2 and later

## Prerequisites

* [Download and install the on-premises data gateway](https://learn.microsoft.com/en-us/data-integration/gateway/service-gateway-install).

  This gateway acts as a bridge and provides a secure data transfer between on-premises data and your app or client. You can use the same gateway installation with multiple services and data sources, which means you might only need to install the gateway once.

* Install the **64-bit Oracle Data Provider for .NET** on the same computer as the gateway. Use the Windows installer; the `xcopy` version does not work with the gateway. The reference links to [64-bit ODAC for Windows](https://www.oracle.com/technetwork/database/windows/downloads/index-090165.html). If the Oracle client is missing, connection creation or use fails.

  To check provider registration, run `[System.Data.Common.DbProviderFactories]::GetFactoryClasses()` on the gateway computer and check for the Oracle provider.

* Before running connector operations, set the Oracle client environment variable `ORA_NCHAR_LITERAL_REPLACE` to `TRUE`. This enables [NCHAR string literal replacement](https://docs.oracle.com/en/database/oracle/oracle-database/21/nlspg/programming-with-unicode.html#GUID-50BE1BB8-DB5C-43C8-93F2-6FC7E9E3251D) to prevent data loss when literals contain characters beyond the database character set in NCHAR/NVARCHAR/NCLOB columns.

* [Create an Azure gateway resource for your gateway installation](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-gateway-connection).

* The logic app workflow where you want to connect to your Oracle database. This connector provides only actions, not triggers. You can use any trigger that you want to start your workflow. To create the logic app and add a trigger, see the following documentation:

  * [Create an example Consumption workflow in multitenant Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-example-consumption-workflow).
  * [Create an example Standard workflow in single tenant Azure Logic apps](https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-azure-portal)
  * [Add a trigger to your workflow](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow#add-trigger)

* For the **Get row** action used in this example, you need to know the identifier for the table to access.

  If you don't know this information, contact your Oracle Database administrator, or get the output from the following statement: **`select * from <table-name>`**.

## Creating a connection

The reference lists one connection type, **Default**, applicable to all regions where the connector is available.

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| Server | string | Yes | Oracle server. If a port or SID is required, the reference specifies `ServerName:Port/SID`. |
| Authentication Type | string | Not marked required in the reference | Select **Basic**. |
| Username | securestring | Yes | Oracle database username. |
| Password | securestring | Yes | Oracle database password. |
| Gateway | gatewaySetting | Yes | On-premises data gateway associated with the Azure gateway resource. |

These are documented connection field names and types, not a complete deployment JSON schema. Do not infer JSON key casing or copy these fields into a built-in `serviceProviderConnections` entry. Keep credentials out of checked-in files and use protected configuration with a least-privilege database account.

### Bundled built-in Oracle reference

The migration examples in this repository use the supplied [built-in Oracle connection](../../../../referenceWorkflowsAndConnections/connections/Oracle/connections.json) and [Oracle workflows](../../../../referenceWorkflowsAndConnections/workflows/Oracle/), not the managed connector described in this document. Use their `serviceProviderConnections.oracledb` entry and `/serviceProviders/oracledb` configuration together.

The connection reads `oracledb_serverAddress`, `oracledb_username`, and `oracledb_password` from app settings. The workflow files retain their source test placeholders; replace those with scenario-specific values before execution. Do not apply the managed connector's gateway, API-connection, or operation configuration to these built-in examples.

## Known issues and limitations

The following restrictions apply to the **managed connector**:

* Tables with composite keys, nested object types in tables, and database functions with nonscalar values are unsupported. Oracle functions are not supported and are not listed in the UI.
* Stored procedures do **not** support OUT parameters. The reference states that no return value is available because the stored procedure does not return results. A dynamic output schema does not imply support for procedure result sets or output parameters.
* Native queries require gateway version **3000.63.4 or later**. They do not support RefCursor or OUT parameters and can return only **one result set**.
* `DATE`, `TIMESTAMP`, `TIMESTAMP with timezone`, and `TIMESTAMP with local timezone` cannot be used as **query option predicates**. This restriction does not by itself describe every use of these types in native SQL or payloads.
* Insert and update return only the input properties, not the full resulting row.
* Deterministic paging with **Get rows** requires a primary key.
* **Insert row** requires an explicit primary-key value even when the column has a default or autoincrement value.
* Design-time table lists show at most **2,048** elements, the default page size for **Get tables**. A table missing from the picker is not necessarily absent from the database.

### Size, timeout, concurrency, and throttling limits

| Limit | Value |
| --- | --- |
| Request size | 2 MB |
| Response size | 8 MB |
| Query or stored procedure execution | An execution exceeding 110 seconds times out |
| Concurrent requests per connection | 200 |
| Data transferred concurrently per connection | 30 MB |
| API calls per connection | 1,500 per 60 seconds |

For latency problems, the reference recommends the latest 64-bit ODAC on the gateway computer, or on every member of a gateway cluster. For connection-creation timeouts, try a database credential with minimal permissions to reduce metadata loading.

## Connector technical reference

The managed connector provides **eight actions and no triggers**. Operation IDs and parameter keys are case-sensitive and differ from the built-in connector.

| Action | Operation ID | Purpose |
| --- | --- | --- |
| Delete row | `DeleteItem` | Delete a row by its identifier. |
| Execute a Oracle query | `ExecutePassThroughNativeQuery` | Execute a native Oracle query. |
| Execute stored procedure | `ExecuteProcedure` | Run a stored procedure with input parameters. |
| Get row | `GetItem` | Retrieve one row by its identifier. |
| Get rows | `GetItems` | Retrieve rows with optional OData query options. |
| Get tables | `GetTables` | List database tables. |
| Insert row | `PostItem` | Insert a row. |
| Update row | `PatchItem` | Update an existing row. |

The parameter tables below reproduce the documented keys and types. `dynamic` means the reference does not supply a fixed schema; obtain the actual body shape from connector metadata or a verified designer export. Operation IDs identify API operations, but are not a substitute for the method, path, body, and connection reference of an exported Logic Apps `ApiConnection` action.

### Delete row (`DeleteItem`)

| Parameter | Key | Required | Type |
| --- | --- | --- | --- |
| Table name | `table` | Yes | string |
| Row id | `id` | Yes | string |

The reference does not specify a return schema for this operation.

### Execute a Oracle query (`ExecutePassThroughNativeQuery`)

| Parameter | Key | Required | Type |
| --- | --- | --- | --- |
| Query | `query` | Yes | dynamic |

Returns dynamic outputs. The query input is documented as a **dynamic query body**, not a plain SQL string schema. Confirm the actual body structure before generating an action, and apply the native-query restrictions above.

### Execute stored procedure (`ExecuteProcedure`)

| Parameter | Key | Required | Type |
| --- | --- | --- | --- |
| Procedure name | `procedure` | Yes | string |
| Parameters list | `parameters` | Yes | dynamic |

The action reference declares dynamic outputs, but the documented stored-procedure limitations still apply: no OUT parameters and no returned results. Do not generate downstream expressions that assume either is available.

### Get row (`GetItem`)

| Parameter | Key | Required | Type |
| --- | --- | --- | --- |
| Table name | `table` | Yes | string |
| Row id | `id` | Yes | string |

Returns dynamic outputs representing the selected row.

### Get rows (`GetItems`)

| Parameter | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Table name | `table` | Yes | string | Oracle table name. |
| Filter Query | `$filter` | No | string | OData filter, for example `stringColumn eq 'string'` or `numberColumn lt 123`. |
| Order By | `$orderby` | No | string | OData ordering expression. |
| Top Count | `$top` | No | integer | Total entries to retrieve; documented default is all. |
| Skip Count | `$skip` | No | integer | Entries to skip; documented default is 0. |
| Select Query | `$select` | No | string | Fields to retrieve; documented default is all. |

Returns dynamic outputs. Validate pagination and the actual response shape; the default top count does not remove the response-size limit.

### Get tables (`GetTables`)

No parameters are listed. Returns a `TablesList` object with a `value` array of `Table` objects.

| Definition | Property | Type | Description |
| --- | --- | --- | --- |
| TablesList | `value` | array of Table | List of tables. |
| Table | `Name` | string | Table name used at runtime. |
| Table | `DisplayName` | string | Display name of the table. |
| Table | `DynamicProperties` | object | Additional table properties supplied by the connector. |

### Insert row (`PostItem`)

| Parameter | Key | Required | Type |
| --- | --- | --- | --- |
| Table name | `table` | Yes | string |
| Row | `item` | Yes | dynamic |

Returns dynamic outputs containing the input properties, not the full inserted row. Include an explicit primary-key value.

### Update row (`PatchItem`)

| Parameter | Key | Required | Type |
| --- | --- | --- | --- |
| Table name | `table` | Yes | string |
| Row id | `id` | Yes | string |
| Row | `item` | Yes | dynamic |

Returns dynamic outputs containing the input properties, not the full updated row.

## BizTalk migration considerations

The following are migration recommendations based on the managed connector's documented capabilities, not guarantees of parity with the BizTalk adapter:

* Identify **WCF-OracleDB**, **WCF-Custom** using `oracleDBBinding`, and custom ODP.NET calls from the actual binding and operation. Preserve the source SQL/procedure signature and XML request/response contracts when mapping to connector inputs and outputs.
* Treat OUT parameters, REF CURSORs, multiple result sets, Oracle functions, complex types, and executions over 110 seconds as compatibility checks or migration gaps. Do not map them blindly to `ExecuteProcedure` or native query. Evaluate a separately verified built-in connector or custom implementation where the managed connector cannot meet the contract.
* Oracle polling receive locations need another trigger, commonly Recurrence, followed by Oracle actions. Preserve selection, row claiming, acknowledgement, ordering, and retry behavior; a recurring select alone is not equivalent to a BizTalk polling adapter.
* Separate workflow actions do not recreate an atomic BizTalk database or distributed transaction. Validate transaction boundaries and duplicate-write behavior on timeout, retry, and resubmission.
* Validate primary keys, Unicode data, paging, payload sizes, and actual response shapes against a representative database before marking the migration complete. Never mix these managed action IDs with built-in `ServiceProvider` configuration.

## Add an action

1. [Follow these generic steps to add an action](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow). Select **Oracle Database** under **Shared** for the managed connector.

   This example continues with the [**Get row** action](https://learn.microsoft.com/en-us/connectors/oracle/#get-row).

1. In the connection box, provide the required [connection information](https://learn.microsoft.com/en-us/connectors/oracle/#default).

1. For the **Gateway** property, select the Azure subscription and Azure gateway resource to use.

1. After the connection is complete, from the **Table name** list, select a table.

1. For the **Row Id** property, enter the row ID that you want in your table.

   In the following example, job data is returned from a Human Resources database:

   ![Screenshot shows Get row action with table name and row ID.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-oracledatabase/table-rowid.png)

1. Add any other actions to continue building your workflow.

1. When you're done, save your workflow.

## Common errors

#### **Error**: Cannot reach the Gateway

**Cause**: The on-premises data gateway can't connect to the cloud.

**Mitigation**: Make sure your gateway is running on the on-premises computer where you installed the gateway and has internet connectivity. Avoid installing the gateway on a computer that might be turned off or go to sleep. You can also try restarting the on-premises data gateway service (PBIEgwService).

#### **Error**: The provider being used is deprecated: 'System.Data.OracleClient requires Oracle client software version 8.1.7 or greater.'

**Cause**: The Oracle client SDK isn't installed on the computer where the on-premises data gateway is running.

**Resolution**: Download and install the Oracle client SDK on the same computer as the on-premises data gateway. See [Oracle client installation guidance](https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-connect-oracle-database).

#### **Error**: Table '[Tablename]' does not define any key columns

**Cause**: The table doesn't have a primary key.

**Resolution**: The Oracle Database connector requires that you use a table with a primary key column.

## Related content

* [Oracle Database managed connector technical reference](https://learn.microsoft.com/en-us/connectors/oracle/)
* [Logic Apps Oracle setup and built-in connector reference](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-oracledatabase)
* [Connect to on-premises data using a gateway](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-gateway-connection)
* [Managed connectors for Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/managed)
* [Built-in connectors for Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/built-in)
