---
name: source-to-logic-apps-mapping
description: One-to-one mapping of every TIBCO BusinessWorks component (connectors, processors, flow constructs, Mapper/XSLT, error handlers, platform features) to its Azure Logic Apps Standard equivalent. Covers 150+ mappings with service provider IDs, operation names, connection parameters, and deployment scopes.
---

# TIBCO BusinessWorks to Azure Logic Apps Standard — Component Migration Reference

> **One-to-one mapping of every TIBCO component to its Azure Logic Apps Standard equivalent.**

---

## Table of Contents

- <a href="#overview">Overview</a>
- <a href="#connector-mappings">Connector Mappings</a>
    - <a href="#file--storage">File &amp; Storage</a>
    - <a href="#messaging--eventing">Messaging &amp; Eventing</a>
    - <a href="#database">Database</a>
    - <a href="#http--web-services">HTTP &amp; Web Services</a>
    - <a href="#email">Email</a>
    - <a href="#b2b--edi">B2B / EDI</a>
    - <a href="#erp-sap">ERP (SAP)</a>
- <a href="#connectors-not-mapped-gaps">Connectors Not Mapped (Gaps)</a>
- <a href="#processor-mappings">Processor Mappings</a>
    - <a href="#core-processors">Core Processors</a>
    - <a href="#control-flow-processors">Control Flow Processors</a>
    - <a href="#data-transformation">Data Transformation</a>
    - <a href="#validation-processors">Validation Processors</a>
    - <a href="#error-handling">Error Handling</a>
- <a href="#flow-construct-mappings">Flow Construct Mappings</a>
- <a href="#Mapper/XSLT-to-logic-apps-expressions">Mapper/XSLT → Logic Apps Expressions</a>
    - <a href="#expression-language-comparison">Expression Language Comparison</a>
    - <a href="#common-expression-conversions">Common Expression Conversions</a>
    - <a href="#TIBCO-variables--logic-apps-variables">TIBCO Variables → Logic Apps Variables</a>
- <a href="#custom-code-migration">Custom Code Migration</a>
    - <a href="#custom-code-options-in-logic-apps-standard">Custom Code Options in Logic Apps Standard</a>
    - <a href="#custom-code-migration-matrix">Custom Code Migration Matrix</a>
- <a href="#platform-feature-mappings">Platform Feature Mappings</a>
- <a href="#deployment-scope-reference">Deployment Scope Reference</a>
- <a href="#connection-type-reference">Connection Type Reference</a>
- <a href="#quick-lookup-TIBCO-connector--logic-apps-connector">Quick Lookup: TIBCO Connector → Logic Apps Connector</a>
- <a href="#coverage-summary">Coverage Summary</a>

---

## Overview

Azure Logic Apps Standard provides built-in **service provider connectors** that run in-process within the runtime, replacing TIBCO BusinessWorks connectors, processors, and platform features. This document maps every TIBCO component to its Logic Apps Standard equivalent, including available triggers and actions.

### Key Concepts

| Concept            | TIBCO BusinessWorks                      | Logic Apps Standard                               |
| ------------------ | -------------------------------------- | ------------------------------------------------- |
| Transport          | Connector (Source / Operation)         | Service Provider Connector                        |
| Message Processing | Processor (mapper activity, assign activity)  | Built-in Action (Compose, Transform, etc.)        |
| Routing            | Choice / Scatter-Gather / Round-Robin  | Condition / Switch / Parallel branches            |
| Flow               | TIBCO Flow (XML)                        | Workflow definition (JSON)                        |
| sub-process           | sub-process (via process-call)                | Child workflow (via InvokeWorkflow)               |
| Data Transform     | Mapper/XSLT 2.0                          | Liquid templates / Compose / .NET local functions |
| Error Handling     | Catch / Fault handlers | Scope + Run After (Failed) / Terminate            |
| API Management     | TIBCO API Manager                   | Azure API Management                              |
| Object Store       | Object Store V2                        | Azure Table Storage / Azure Cache for Redis       |
| Scheduler          | Scheduler source (cron/fixed-freq)     | Recurrence trigger                                |

### When to Use Integration Account

Use an Integration Account only when the target design requires Integration Account-specific capabilities, such as:

- B2B/EDI processing with X12, EDIFACT, or AS2 actions
- Trading partners, agreements, and partner-specific B2B configuration
- Shared enterprise artifact management where schemas/maps/partner artifacts are centrally managed outside the workflow project

Do NOT choose Integration Account for ordinary XML, JSON, or Mapper/XSLT replacement scenarios if Logic Apps Standard artifact folders and built-in actions are sufficient.

If Integration Account is chosen:

- use it consistently for the flow's deployable artifacts; do not split artifacts between Integration Account and Logic App artifact folders
- plan for the required app setting `WORKFLOWS_INTEGRATION_ACCOUNT_ID`
- plan for the required app setting `WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL`
- deploy the Integration Account first, then set `WORKFLOWS_INTEGRATION_ACCOUNT_ID` to the deployed Integration Account resource ID, for example `/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.Logic/integrationAccounts/{name}`
- retrieve the deployed callback URL and set `WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL` to that real value
- plan a separate follow-on task to upload the required Integration Account artifacts after provisioning

---

## Connector Mappings

### File & Storage

#### File System

|                      | TIBCO                   | Logic Apps Standard            |
| -------------------- | -------------------------- | ------------------------------ |
| **Connector**        | file:connector (TIBCO File) | **File System**                |
| **Service Provider** | —                          | `/serviceProviders/fileSystem` |
| **Deployment Scope** | —                          | Any (on-premises + cloud)      |
| **Category**         | —                          | Storage                        |

> **Migration Note:** TIBCO `file:listener` (source) maps to File System trigger. `file:read` / `file:write` operations map to actions.

| Type    | Operation                       | Description                    |
| ------- | ------------------------------- | ------------------------------ |
| Trigger | `whenFilesAreAdded` _(default)_ | Poll for new files in a folder |
| Trigger | `whenFilesAreAddedOrModified`   | Poll for new or modified files |
| Action  | `createFile` _(default)_        | Create a new file              |
| Action  | `getFileContent`                | Read file content              |
| Action  | `getFileContentV2`              | Read file content (v2)         |
| Action  | `getFileMetadata`               | Get file metadata              |
| Action  | `updateFile`                    | Update an existing file        |
| Action  | `deleteFile`                    | Delete a file                  |
| Action  | `listFolder`                    | List files in a folder         |
| Action  | `copyFile`                      | Copy a file                    |
| Action  | `renameFile`                    | Rename a file                  |
| Action  | `appendFile`                    | Append content to a file       |
| Action  | `extractArchive`                | Extract archive contents       |

**Connection Parameters:** `RootFolder` (required), `Username` (required), `Password` (required), `MountPath` (optional)

---

#### FTP

|                      | TIBCO                 | Logic Apps Standard     |
| -------------------- | ------------------------ | ----------------------- |
| **Connector**        | ftp:connector (TIBCO FTP) | **FTP**                 |
| **Service Provider** | —                        | `/serviceProviders/ftp` |
| **Deployment Scope** | —                        | Any                     |
| **Category**         | —                        | Storage                 |

> **Migration Note:** TIBCO `ftp:listener` maps to FTP trigger. `ftp:read` / `ftp:write` operations map to actions.

| Type    | Operation                                    | Description                     |
| ------- | -------------------------------------------- | ------------------------------- |
| Trigger | `whenFtpFilesAreAddedOrModified` _(default)_ | Poll for new/modified FTP files |
| Action  | `createFile` _(default)_                     | Upload a file to FTP            |
| Action  | `getFileContent`                             | Read FTP file content           |
| Action  | `getFtpFileContentV2`                        | Read FTP file content (v2)      |
| Action  | `getFileMetadata`                            | Get FTP file metadata           |
| Action  | `updateFile`                                 | Update an FTP file              |
| Action  | `deleteFtpFile`                              | Delete an FTP file              |
| Action  | `listFilesInFolder`                          | List files in FTP folder        |
| Action  | `extractArchive`                             | Extract archive on FTP          |

**Connection Parameters:** `ServerAddress` (required), `UserName` (required), `Password` (required), `ServerPort` (optional), `IsSSL` (optional)

---

#### SFTP

|                      | TIBCO                   | Logic Apps Standard      |
| -------------------- | -------------------------- | ------------------------ |
| **Connector**        | sftp:connector (TIBCO SFTP) | **SFTP**                 |
| **Service Provider** | —                          | `/serviceProviders/sftp` |
| **Deployment Scope** | —                          | Any                      |
| **Category**         | —                          | Storage                  |

> **Migration Note:** TIBCO `sftp:listener` maps to SFTP trigger. `sftp:read` / `sftp:write` operations map to actions.

| Type    | Operation                     | Description                 |
| ------- | ----------------------------- | --------------------------- |
| Trigger | `whenFileIsAdded` _(default)_ | Poll for new files on SFTP  |
| Trigger | `whenFileIsAddedOrModified`   | Poll for new/modified files |
| Action  | `createFile` _(default)_      | Create a file on SFTP       |
| Action  | `getFileContent`              | Read SFTP file content      |
| Action  | `getFileContentV2`            | Read SFTP file content (v2) |
| Action  | `getMetadata`                 | Get file or folder metadata |
| Action  | `uploadFileContent`           | Upload file content         |
| Action  | `updateFile`                  | Update an SFTP file         |
| Action  | `deleteFile`                  | Delete an SFTP file         |
| Action  | `copyFile`                    | Copy a file on SFTP         |
| Action  | `renameFile`                  | Rename a file on SFTP       |
| Action  | `listFolder`                  | List folder contents        |
| Action  | `createFolder`                | Create a folder             |
| Action  | `deleteFolder`                | Delete a folder             |
| Action  | `extractArchive`              | Extract archive on SFTP     |

**Connection Parameters:** `HostName` (required), `UserName` (required), `Password` (optional), `SshPrivateKey` (optional), `SshPrivateKeyPassphrase` (optional), `PortNumber` (optional)

---

### Messaging & Eventing

#### Azure Service Bus

|                      | TIBCO                                 | Logic Apps Standard            |
| -------------------- | ---------------------------------------- | ------------------------------ |
| **Connector**        | jms:connector, JMS/EMS connector, TIBCO-mq | **Azure Service Bus**          |
| **Service Provider** | —                                        | `/serviceProviders/serviceBus` |
| **Deployment Scope** | —                                        | Cloud Only                     |
| **Category**         | —                                        | Messaging                      |

> **Migration Note:** TIBCO JMS connector, VM connector, and TIBCO MQ all map to Azure Service Bus for cloud-native queuing and topic patterns. JMS queues → Service Bus queues. JMS topics → Service Bus topics. VM queues (intra-app messaging) → Service Bus queues or child workflow calls.

| Type    | Operation                         | Description                     |
| ------- | --------------------------------- | ------------------------------- |
| Trigger | `receiveQueueMessage` _(default)_ | Receive single queue message    |
| Trigger | `receiveQueueMessages`            | Receive batch of queue messages |
| Trigger | `receiveTopicMessage`             | Receive single topic message    |
| Trigger | `receiveTopicMessages`            | Receive batch of topic messages |
| Action  | `sendMessage` _(default)_         | Send a message                  |
| Action  | `sendMessages`                    | Send batch of messages          |
| Action  | `completeMessage`                 | Complete a message              |
| Action  | `abandonMessage`                  | Abandon a message               |
| Action  | `deadLetterMessage`               | Dead-letter a message           |

**Connection Parameters:** `ConnectionString` (required)

---

#### RabbitMQ

|                      | TIBCO                   | Logic Apps Standard          |
| -------------------- | -------------------------- | ---------------------------- |
| **Connector**        | amqp:connector (TIBCO AMQP) | **RabbitMQ**                 |
| **Service Provider** | —                          | `/serviceProviders/rabbitmq` |
| **Deployment Scope** | —                          | Any                          |
| **Category**         | —                          | Messaging                    |

> **Migration Note:** TIBCO AMQP connector maps to RabbitMQ connector in Logic Apps.

| Type    | Operation                             | Description                      |
| ------- | ------------------------------------- | -------------------------------- |
| Trigger | `receiveRabbitMQMessages` _(default)_ | Receive messages (Push)          |
| Action  | `sendRabbitMQMessage` _(default)_     | Send a message                   |
| Action  | `createQueue`                         | Create a queue                   |
| Action  | `completeMessage`                     | Complete (acknowledge) a message |

**Connection Parameters:** `HostName` (required), `UserName` (required), `Password` (required), `Port` (optional), `VirtualHost` (optional)

---

#### Confluent Kafka

|                      | TIBCO                     | Logic Apps Standard                |
| -------------------- | ---------------------------- | ---------------------------------- |
| **Connector**        | kafka:connector (TIBCO Kafka) | **Confluent Kafka**                |
| **Service Provider** | —                            | `/serviceProviders/confluentKafka` |
| **Deployment Scope** | —                            | Any                                |
| **Category**         | —                            | Messaging                          |

> **Migration Note:** TIBCO Kafka connector maps directly to Confluent Kafka connector in Logic Apps.

| Type    | Operation                    | Description             |
| ------- | ---------------------------- | ----------------------- |
| Trigger | `ReceiveMessage` _(default)_ | Receive messages (Push) |
| Action  | `SendMessage` _(default)_    | Send a message to topic |

**Connection Parameters:** `BootstrapServers` (required), `AuthenticationMode` (required), `Protocol` (required), `UserName` (optional), `Password` (optional)

---

### Database

#### SQL Server

|                      | TIBCO                     | Logic Apps Standard     |
| -------------------- | ---------------------------- | ----------------------- |
| **Connector**        | db:connector (TIBCO Database) | **SQL Server**          |
| **Service Provider** | —                            | `/serviceProviders/sql` |
| **Deployment Scope** | —                            | Any                     |
| **Category**         | —                            | Database                |

> **Migration Note:** TIBCO `JDBC SQL activities` → `executeQuery`. `JDBC SQL activities` / `JDBC SQL activities` / `JDBC SQL activities` → `executeQuery` or specific row actions. `JDBC stored procedure activities` → `executeStoredProcedure`. The TIBCO Database connector supports multiple DB engines (MySQL, PostgreSQL, Oracle, MSSQL) via JDBC — map each to the specific Logic Apps database connector.

| Type    | Operation                        | Description                |
| ------- | -------------------------------- | -------------------------- |
| Trigger | `whenARowIsModified` _(default)_ | Poll for modified rows     |
| Trigger | `whenARowIsInserted`             | Poll for inserted rows     |
| Action  | `executeQuery` _(default)_       | Execute a SQL query        |
| Action  | `executeStoredProcedure`         | Execute a stored procedure |
| Action  | `getRows`                        | Get rows from a table      |
| Action  | `insertRow`                      | Insert a row               |
| Action  | `updateRows`                     | Update rows                |
| Action  | `deleteRows`                     | Delete rows                |

**Connection Parameters:** `ConnectionString` (required)

---

### HTTP & Web Services

#### HTTP

|                      | TIBCO                                  | Logic Apps Standard      |
| -------------------- | ----------------------------------------- | ------------------------ |
| **Connector**        | http:listener, http:request, wsc:consumer | **HTTP**                 |
| **Service Provider** | —                                         | `/serviceProviders/http` |
| **Deployment Scope** | —                                         | Any                      |
| **Category**         | —                                         | Integration              |

> **Migration Note:** TIBCO `http:listener` (source) → HTTP Request trigger. `http:request` (operation) → HTTP action (`invokeHttp`). `wsc:consumer` (SOAP web service client) → HTTP action with XML body and SOAPAction header.

| Type    | Operation                | Description                             |
| ------- | ------------------------ | --------------------------------------- |
| Trigger | `manual` _(default)_     | HTTP Request trigger (webhook/callback) |
| Action  | `invokeHttp` _(default)_ | Make an HTTP request                    |

**Connection Parameters:** None required (inline configuration)

---

### Email

#### SMTP

|                      | TIBCO                | Logic Apps Standard      |
| -------------------- | ----------------------- | ------------------------ |
| **Connector**        | email:send (TIBCO Email) | **SMTP**                 |
| **Service Provider** | —                       | `/serviceProviders/Smtp` |
| **Deployment Scope** | —                       | Any                      |
| **Category**         | —                       | Email                    |

> **Migration Note:** TIBCO `email:send` maps to SMTP sendEmail action. TIBCO `email:listener-imap` / `email:listener-pop3` have no direct SMTP trigger — use Outlook 365 connector or a polling pattern.

| Type   | Operation               | Description   |
| ------ | ----------------------- | ------------- |
| Action | `sendEmail` _(default)_ | Send an email |

**Connection Parameters:** `Server` (required), `Port` (required), `UserName` (required), `Password` (required), `EnableSSL` (optional)

---

### ERP (SAP)

#### SAP

|                      | TIBCO                     | Logic Apps Standard     |
| -------------------- | ---------------------------- | ----------------------- |
| **Connector**        | sap:connector (TIBCO SAP) | **SAP**                 |
| **Service Provider** | —                            | `/serviceProviders/sap` |
| **Deployment Scope** | —                            | Any (via data gateway)  |
| **Category**         | —                            | ERP                     |

> **Migration Note:** TIBCO `sap:sync-rfc` / `sap:async-rfc` → SAP `callRfc` action. `sap:send-idoc` → SAP `sendIdoc` action. Requires on-premises data gateway for connectivity.

| Type    | Operation       | Description             |
| ------- | --------------- | ----------------------- |
| Trigger | `receiveTrfc`   | Receive tRFC from SAP   |
| Trigger | `receiveIdoc`   | Receive IDoc from SAP   |
| Action  | `callRfc`       | Call SAP RFC function   |
| Action  | `sendIdoc`      | Send IDoc to SAP        |
| Action  | `readTable`     | Read SAP table          |
| Action  | `createSession` | Create stateful session |
| Action  | `closeSession`  | Close stateful session  |

**Connection Parameters:** `Server` (required), `SystemNumber` (required), `Client` (required), `UserName` (required), `Password` (required), `GatewayName` (optional)

---

## Connectors Not Mapped (Gaps)

| TIBCO Connector      | Gap Reason                                 | Recommended Alternative                               |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------- |
| TIBCO MQ             | CloudHub-native messaging service          | Azure Service Bus                                     |
| Object Store V2         | CloudHub-native key-value store            | Azure Table Storage or Azure Cache for Redis          |
| Salesforce Connector    | No built-in Logic Apps equivalent          | Salesforce managed API connector or HTTP + REST API   |
| Workday Connector       | No built-in Logic Apps equivalent          | HTTP + REST API                                       |
| NetSuite Connector      | No built-in Logic Apps equivalent          | HTTP + REST API                                       |
| MongoDB Connector       | No built-in Logic Apps equivalent          | HTTP + REST API or Azure Cosmos DB (MongoDB API)      |
| Redis Connector         | No built-in Logic Apps equivalent          | Azure Cache for Redis via HTTP or .NET local function |
| Elasticsearch Connector | No built-in Logic Apps equivalent          | HTTP + REST API                                       |
| API Manager Policies    | TIBCO-specific API governance           | Azure API Management policies                         |
| CloudHub Properties     | CloudHub deployment-specific configuration | Logic Apps app settings (`local.settings.json`)       |

---

## Processor Mappings

### Core Processors

| TIBCO Processor | Logic Apps Equivalent                     | Notes                                        |
| ------------------ | ----------------------------------------- | -------------------------------------------- |
| `logger`           | Compose + tracked properties              | Use tracked properties for run-level logging |
| `assign activity`      | Compose action                            | Sets the message body                        |
| `set-variable`     | Set Variable action / Initialize Variable | Creates or updates a workflow variable       |
| `remove-variable`  | Set Variable (to null)                    | Logic Apps does not have a remove action     |
| `process-call`         | InvokeWorkflow (child workflow)           | Calls another workflow                       |
| `raise-error`      | Terminate action (Failed)                 | Ends the workflow with an error              |
| `parse-template`   | Compose action                            | Template rendering via expressions           |

### Control Flow Processors

| TIBCO Processor | Logic Apps Equivalent           | Notes                                              |
| ------------------ | ------------------------------- | -------------------------------------------------- |
| `choice`           | Condition / Switch action       | `when` → Condition branches, `otherwise` → default |
| `scatter-gather`   | Parallel branches               | Direct mapping to parallel branch execution        |
| `foreach`          | For Each action                 | `collection` → items expression                    |
| `until-successful` | Until action (with retry)       | Maps to retry loop pattern                         |
| `first-successful` | Custom pattern (try sequential) | No direct equivalent — use Scope + Run After       |
| `round-robin`      | Custom pattern                  | No direct equivalent — use expressions             |
| `try`              | Scope action                    | Scope + error handling via Run After               |

### Data Transformation

| TIBCO Processor   | Logic Apps Equivalent                  | Notes                                                |
| -------------------- | -------------------------------------- | ---------------------------------------------------- |
| `mapper activity`       | Compose / Liquid / .NET local function | Mapper/XSLT → Liquid for simple maps; .NET for complex |
| Mapper/XSLT 2.0 (.dwl) | Liquid template / XSLT / .NET function | Assess complexity before choosing target             |
| `assign activity` (DW)   | Compose action with expressions        | Inline Mapper/XSLT → workflow expressions              |

### Validation Processors

| TIBCO Processor               | Logic Apps Equivalent                  | Notes                                   |
| -------------------------------- | -------------------------------------- | --------------------------------------- |
| `validation:is-true`             | Condition action                       | Boolean condition check                 |
| `validation:is-false`            | Condition action                       | Boolean condition check (negated)       |
| `validation:is-not-null`         | Condition action                       | Null check with expression              |
| `validation:is-null`             | Condition action                       | Null check with expression              |
| `validation:validates-size`      | Condition action + `length()` expr     | Size validation via expression          |
| `validation:is-not-blank-string` | Condition action + `empty()` expr      | Blank check via expression              |
| `validation:matches-regex`       | Condition action with inline code      | Regex via .NET local function if needed |
| `validation:is-email`            | Condition action with regex/expression | Email pattern validation                |

### Error Handling

| TIBCO Pattern                         | Logic Apps Equivalent                                       | Notes                                              |
| ---------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `on-error-propagate`                     | Scope + Run After (Failed) + Terminate                      | Error is re-thrown to caller                       |
| `on-error-continue`                      | Scope + Run After (Failed) + Continue                       | Error is caught but flow continues                 |
| `try` scope                              | Scope action                                                | Wraps processors in a protected boundary           |
| Error type filtering (HTTP:CONNECTIVITY) | Condition inside Run After (Failed) block                   | Check error details in the failed action output    |
| Global error handler                     | Add error handling to each workflow + shared error workflow | Centralize via a dedicated error-handling workflow |

---

## Flow Construct Mappings

| TIBCO Construct    | Logic Apps Equivalent                   | Notes                                         |
| --------------------- | --------------------------------------- | --------------------------------------------- |
| Flow (with source)    | Workflow (with trigger)                 | 1:1 mapping — each flow becomes a workflow    |
| sub-process              | Child workflow (InvokeWorkflow)         | Called from parent via workflow action        |
| Private flow          | Child workflow (InvokeWorkflow)         | Same as sub-process for migration purposes       |
| Global config         | Connection in connections.json          | Shared connector configurations               |
| TIBCO application      | Logic Apps Standard project             | One app → one Logic App                       |
| TIBCO domain           | Shared connections.json                 | Domain-level shared resources                 |
| Scheduler source      | Recurrence trigger                      | cron/fixed-frequency → recurrence config      |
| http:listener source  | HTTP Request trigger (manual)           | Direct mapping                                |
| jms:listener source   | Service Bus trigger                     | JMS queue/topic → Service Bus queue/topic     |
| JMS/EMS listener source    | Service Bus trigger / child workflow    | VM queue → Service Bus or child workflow call |
| file:listener source  | File System trigger                     | Direct mapping                                |
| ftp:listener source   | FTP trigger                             | Direct mapping                                |
| sftp:listener source  | SFTP trigger                            | Direct mapping                                |
| email:listener source | Outlook 365 trigger / polling pattern   | No built-in SMTP trigger                      |
| db:listener source    | SQL Server trigger (whenARowIsModified) | Database polling pattern                      |

---

## Mapper/XSLT → Logic Apps Expressions

### Expression Language Comparison

| Feature             | TIBCO Mapper/XSLT 2.0                   | Logic Apps Workflow Expressions                             |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Syntax              | Functional, pattern-matching             | `@{expression}` C-like syntax                               |
| String concat       | `payload.first ++ " " ++ payload.last`   | `@concat(body('action'),'first',' ',body('action'),'last')` |
| Conditional         | `if (cond) val1 else val2`               | `@if(condition, val1, val2)`                                |
| Null coalescing     | `payload.name default "N/A"`             | `@coalesce(body('action')?['name'],'N/A')`                  |
| Array iteration     | `payload map (item) -> item.name`        | `For Each` action + `@items('For_each')`                    |
| Array filter        | `payload filter (item) -> item.active`   | `Filter Array` action or `@body('Filter_array')`            |
| Type coercion       | `payload.amount as Number`               | `@float(body('action')?['amount'])`                         |
| Date formatting     | `now() as String {format: "yyyy-MM-dd"}` | `@formatDateTime(utcNow(),'yyyy-MM-dd')`                    |
| Upper/lower         | `upper(payload.name)`                    | `@toUpper(body('action')?['name'])`                         |
| String length       | `sizeOf(payload.name)`                   | `@length(body('action')?['name'])`                          |
| Object construction | `{ key: value }`                         | Compose action with JSON body                               |
| Reduce              | `payload reduce (item, acc) -> ...`      | .NET local function (no direct equivalent)                  |
| GroupBy             | `payload groupBy $.category`             | .NET local function (no direct equivalent)                  |
| Pattern matching    | `payload match { ... }`                  | Switch action + conditions                                  |

### Common Expression Conversions

| TIBCO Mapper/XSLT                    | Logic Apps Expression                                   |
| ------------------------------------- | ------------------------------------------------------- |
| `payload`                             | `@body('Previous_Action')` or `@triggerBody()`          |
| `payload.orderId`                     | `@body('Previous_Action')?['orderId']`                  |
| `attributes.headers.'Content-Type'`   | `@triggerOutputs()?['headers']?['Content-Type']`        |
| `vars.myVariable`                     | `@variables('myVariable')`                              |
| `flowVars.correlationId`              | `@variables('correlationId')`                           |
| `payload.items map (item) -> item.id` | For Each + Compose + `@items('For_each')?['id']`        |
| `sizeOf(payload)`                     | `@length(body('Previous_Action'))`                      |
| `now()`                               | `@utcNow()`                                             |
| `uuid()`                              | `@guid()`                                               |
| `payload.amount as Number`            | `@float(body('Previous_Action')?['amount'])`            |
| `upper(payload.name)`                 | `@toUpper(body('Previous_Action')?['name'])`            |
| `payload.name default "Unknown"`      | `@coalesce(body('Previous_Action')?['name'],'Unknown')` |
| `isEmpty(payload)`                    | `@empty(body('Previous_Action'))`                       |

### TIBCO Variables → Logic Apps Variables

| TIBCO Variable Type       | Logic Apps Equivalent              | Notes                             |
| ---------------------------- | ---------------------------------- | --------------------------------- |
| Flow variable (set-variable) | Initialize Variable + Set Variable | Must declare type at init         |
| Session variable             | Not applicable                     | Use correlation or pass as params |
| TIBCO message `payload`       | Action/trigger body                | `@body()` / `@triggerBody()`      |
| TIBCO message `attributes`    | Trigger/action headers/outputs     | `@triggerOutputs()?['headers']`   |
| Target variable              | Compose action output              | Store intermediate results        |

---

## Custom Code Migration

### Custom Code Options in Logic Apps Standard

| Option                   | When to Use                                           | Deployment                  |
| ------------------------ | ----------------------------------------------------- | --------------------------- |
| .NET Local Function      | Complex Mapper/XSLT, Java logic port, custom transforms | In-process with Logic Apps  |
| Azure Function           | External HTTP services, long-running operations       | Separate Azure Function app |
| Inline Code (JavaScript) | Simple string/JSON manipulation                       | Inline in workflow.json     |

### Custom Code Migration Matrix

| TIBCO Source               | Logic Apps Target                     | Notes                             |
| ----------------------------- | ------------------------------------- | --------------------------------- |
| Custom Java class             | .NET local function                   | Port Java business logic to C#    |
| Custom TIBCO module            | .NET local function or Azure Function | Depends on complexity             |
| Mapper/XSLT script (simple)     | Liquid template                       | Field mapping, simple transforms  |
| Mapper/XSLT script (complex)    | .NET local function                   | reduce, groupBy, custom functions |
| XPath expression (simple)       | Workflow expression                   | Direct expression conversion      |
| XPath expression (Java interop) | .NET local function                   | Java → C# translation needed      |
| Custom transformer            | .NET local function                   | Port transformation logic to C#   |
| Custom message processor      | .NET local function                   | Port processor logic to C#        |
| Custom policy                 | Azure API Management policy           | API-level concerns move to APIM   |

---

## Platform Feature Mappings

| TIBCO Feature               | Logic Apps Standard Equivalent              | Notes                                       |
| ------------------------------ | ------------------------------------------- | ------------------------------------------- |
| TIBCO Platform (Management) | Azure Portal + Logic Apps blade             | Monitoring, deployment, configuration       |
| TIBCO API Manager           | Azure API Management                        | API policies, rate limiting, analytics      |
| TIBCO Exchange              | Azure API Center / custom catalog           | API/connector catalog                       |
| TIBCO MQ                    | Azure Service Bus                           | Cloud messaging                             |
| Object Store V2                | Azure Table Storage / Azure Cache for Redis | Key-value persistence                       |
| CloudHub (runtime)             | Logic Apps Standard (App Service plan)      | Hosting and scaling                         |
| CloudHub Auto-scaling          | App Service plan auto-scale rules           | Scale based on metrics                      |
| CloudHub VPC                   | Azure VNet integration                      | Network isolation                           |
| CloudHub DLB                   | Azure Application Gateway / Front Door      | Load balancing                              |
| TIBCO Agents (monitoring)       | Application Insights                        | Telemetry, logging, alerting                |
| MUnit (testing)                | Logic Apps local testing + curl/PowerShell  | Test via HTTP triggers locally              |
| Maven build (pom.xml)          | Not applicable (JSON-based project)         | Logic Apps uses folder structure, not Maven |
| TIBCO-artifact.json             | host.json + local.settings.json             | Runtime and project configuration           |
| application.properties         | local.settings.json (app settings)          | Configuration values                        |
| Secure properties              | Azure Key Vault references                  | `@Microsoft.KeyVault(...)` references       |

---

## Deployment Scope Reference

| Scope      | Description                                      | Examples                                |
| ---------- | ------------------------------------------------ | --------------------------------------- |
| Any        | Runs anywhere — on-premises via hybrid, or cloud | File System, SFTP, FTP, SQL, HTTP, SAP  |
| Cloud Only | Requires Azure cloud resources                   | Service Bus, Event Hub, Cosmos DB, Blob |

---

## Connection Type Reference

| Connection Type  | Format in connections.json          | Notes                           |
| ---------------- | ----------------------------------- | ------------------------------- |
| Service Provider | `serviceProviderConnections.{name}` | Built-in, runs in-process       |
| Managed API      | `managedApiConnections.{name}`      | Azure-hosted connector instance |

---

## Quick Lookup: TIBCO Connector → Logic Apps Connector

| TIBCO Connector / Processor | Logic Apps Connector     | Service Provider ID                |
| ------------------------------ | ------------------------ | ---------------------------------- |
| http:listener                  | HTTP (Request trigger)   | `/serviceProviders/http`           |
| http:request                   | HTTP (invokeHttp action) | `/serviceProviders/http`           |
| file:connector                 | File System              | `/serviceProviders/fileSystem`     |
| ftp:connector                  | FTP                      | `/serviceProviders/ftp`            |
| sftp:connector                 | SFTP                     | `/serviceProviders/sftp`           |
| db:connector (SQL Server)      | SQL Server               | `/serviceProviders/sql`            |
| db:connector (MySQL)           | SQL Server (via JDBC)    | `/serviceProviders/sql`            |
| db:connector (Oracle)          | Oracle Database          | `/serviceProviders/oracledb`       |
| db:connector (PostgreSQL)      | PostgreSQL               | `/serviceProviders/postgresql`     |
| jms:connector                  | Azure Service Bus        | `/serviceProviders/serviceBus`     |
| JMS/EMS connector                   | Azure Service Bus        | `/serviceProviders/serviceBus`     |
| amqp:connector                 | RabbitMQ                 | `/serviceProviders/rabbitmq`       |
| kafka:connector                | Confluent Kafka          | `/serviceProviders/confluentKafka` |
| email:send                     | SMTP                     | `/serviceProviders/Smtp`           |
| wsc:consumer                   | HTTP (SOAP over HTTP)    | `/serviceProviders/http`           |
| sap:connector                  | SAP                      | `/serviceProviders/sap`            |
| mapper activity (Mapper/XSLT)       | Compose / Liquid / .NET  | (built-in action)                  |
| choice                         | Condition / Switch       | (built-in action)                  |
| scatter-gather                 | Parallel branches        | (built-in action)                  |
| foreach                        | For Each                 | (built-in action)                  |
| until-successful               | Until                    | (built-in action)                  |
| try                            | Scope                    | (built-in action)                  |
| process-call                       | InvokeWorkflow           | (built-in action)                  |
| set-variable                   | Set Variable             | (built-in action)                  |
| assign activity                    | Compose                  | (built-in action)                  |
| logger                         | Compose (tracked props)  | (built-in action)                  |
| raise-error                    | Terminate                | (built-in action)                  |
| scheduler                      | Recurrence trigger       | (built-in trigger)                 |
| os:store / os:retrieve         | Azure Table Storage      | `/serviceProviders/azureTables`    |
| validation:\*                  | Condition action         | (built-in action)                  |

---

## Coverage Summary

| Category                  | TIBCO Components Covered | Logic Apps Equivalents  | Gaps  |
| ------------------------- | --------------------------- | ----------------------- | ----- |
| File & Storage Connectors | 3 (file, ftp, sftp)         | 3                       | 0     |
| Messaging Connectors      | 4 (jms, vm, amqp, kafka)    | 4                       | 0     |
| Database Connectors       | 1 (db:connector, multi-DB)  | 4+ (SQL, Oracle, etc.)  | 0     |
| HTTP / Web Services       | 3 (listener, request, wsc)  | 1 (HTTP)                | 0     |
| Email                     | 1 (email:send)              | 1 (SMTP)                | 0     |
| ERP                       | 1 (SAP)                     | 1 (SAP)                 | 0     |
| Core Processors           | 7                           | 7                       | 0     |
| Control Flow              | 7                           | 5 + patterns            | 2     |
| Data Transformation       | 3 (Mapper/XSLT variants)      | 3 (Compose/Liquid/.NET) | 0     |
| Validation                | 8                           | 8 (Condition)           | 0     |
| Error Handling            | 3 patterns                  | 3 patterns              | 0     |
| Platform Features         | 15                          | 15                      | 0     |
| **Total**                 | **~56 components**          | **~55 equivalents**     | **2** |


