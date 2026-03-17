# JDBC

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/jdbc/

Connect to a relational database using JDBC drivers.

This article describes the operations for the [Java Database Connectivity (JDBC)](https://docs.oracle.com/javase/8/docs/technotes/guides/jdbc/) built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. JDBC provides an API for the Java programming language, which defines how a client can access a database. You can use the JDBC API to connect to most relational databases, including SQL Server, AWS Aurora, My SQL, and so on. As with any other built-in connector, you don't need to use the on-premises data gateway with the JDBC built-in connector to connect to your database.

With this connector, your Standard workflow can connect to a relational database for various tasks, for example:

- Replicate data from your source database to any warehouse database for analytical purposes.
- Dump event data into your database for Internet of Things (IoT) scenarios.

You can bring and use JDBC drivers (JAR libraries) for any JDBC-supported relational database without requiring native DB support in Azure Logic Apps.

---

## Prerequisites

- An Azure account and subscription. If you don't have an Azure subscription, [sign up for a free Azure account](https://azure.microsoft.com/free/?WT.mc_id=A261C142F).

- The Standard logic app workflow from where you want connect to your relational database. To use a JDBC built-in action in your workflow, make sure that your workflow already starts with a trigger.

- Upload all the JDBC JAR libraries your logic app resource:

  1. On the logic app resource menu, under **Development Tools**, select **Advanced Tools**.
  2. On the **Advanced Tools** page, select **Go**, which opens the Kudu tool.
  3. On the console toolbar, from the **Debug Console** menu, select **CMD**.
  4. Browse to the **site/wwwroot** folder. Next to the **/wwwroot** label, open the **+** menu, and create the following folder path: **lib/builtinOperationSdks/JAR/**
  5. In the **JAR** folder, upload all your JDBC JAR libraries, for example:

![Screenshot showing Azure portal, Standard logic app resource, Kudu tool, and uploaded JDBC JAR library file.](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/jdbc/media/jdbc-jar-library.png)

---

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

---

## Authentication

### URL

URL of the database to connect

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| URL | URL of the database to connect | string | True | |

### User identifier

User identifier to be used for connection

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| User identifier | User identifier to be used for connection | string | True | |

### Password

Password to be used for connection

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | Password to be used for connection | securestring | True | |

---

## Actions

| Action | Description |
|--------|-------------|
| Execute query | Execute raw query on the connected database. |
| Get schema | Get schema for the table. |
| Get tables | Get list of tables from the connected database. |

### Execute query

- **Operation ID:** rawQuery

Execute raw query on the connected database.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Query | query | True | string | Raw query to run on connected database. |
| Query parameter | queryParameters | | object | Query parameter to inject in query. |

#### Returns

Output of executed query.

- **Query's output** array

### Get schema

- **Operation ID:** getSchema

Get schema for the table.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table name | tableName | True | string | Table name of connected database. |

#### Returns

Output schema of given table.

- **Schema output** array

### Get tables

- **Operation ID:** getTables

Get list of tables from the connected database.

#### Returns

List of tables fetched from database.

- **Table's list** array

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Prerequisites](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/jdbc/#prerequisites)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/jdbc/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/jdbc/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/jdbc/#actions)
