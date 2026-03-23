---
name: source-to-logic-apps-mapping
description: One-to-one mapping of every BizTalk Server component (adapters, pipeline components, orchestration shapes, expressions, custom code, engine features) to its Azure Logic Apps Standard equivalent. Covers 170+ mappings with service provider IDs, operation names, connection parameters, and deployment scopes.
---

# BizTalk Server to Azure Logic Apps Standard — Component Migration Reference

> **One-to-one mapping of every BizTalk Server component to its Azure Logic Apps Standard equivalent.**

---

## Table of Contents

<!-- TOC - using HTML anchors to avoid markdown link validation issues -->

- <a href="#overview">Overview</a>
- <a href="#adapter-mappings">Adapter Mappings</a>
    - <a href="#file--storage">File &amp; Storage</a>
    - <a href="#messaging--eventing">Messaging &amp; Eventing</a>
    - <a href="#database">Database</a>
    - <a href="#http--web-services">HTTP &amp; Web Services</a>
    - <a href="#email">Email</a>
    - <a href="#b2b--edi">B2B / EDI</a>
    - <a href="#healthcare">Healthcare</a>
    - <a href="#financial">Financial</a>
    - <a href="#erp-sap">ERP (SAP)</a>
    - <a href="#mainframe-ibm">Mainframe (IBM)</a>
    - <a href="#security">Security</a>
- <a href="#adapters-not-in-registry-gaps">Adapters Not in Registry (Gaps)</a>
- <a href="#non-adapter-mappings">Non-Adapter Mappings</a>
    - <a href="#pipeline-components-from-registry">Pipeline Components (from Registry)</a>
    - <a href="#pipeline-components-not-in-registry">Pipeline Components (Not in Registry)</a>
    - <a href="#accelerators">Accelerators</a>
    - <a href="#engine-features-from-registry">Engine Features (from Registry)</a>
    - <a href="#new-in-logic-apps-no-biztalk-equivalent">New in Logic Apps (No BizTalk Equivalent)</a>
- <a href="#orchestration-shape-mappings">Orchestration Shape Mappings</a>
- <a href="#biztalk-expressions--logic-apps-expressions">BizTalk Expressions → Logic Apps Expressions</a>
    - <a href="#expression-language-comparison">Expression Language Comparison</a>
    - <a href="#common-expression-conversions">Common Expression Conversions</a>
    - <a href="#context-properties--promoted-properties">Context Properties &amp; Promoted Properties</a>
- <a href="#biztalk-custom-code--logic-apps-custom-code">BizTalk Custom Code → Logic Apps Custom Code</a>
    - <a href="#custom-code-options-in-logic-apps-standard">Custom Code Options in Logic Apps Standard</a>
    - <a href="#custom-code-migration-matrix">Custom Code Migration Matrix</a>
    - <a href="#local-function-custom-code-action-details">Local Function (Custom Code Action) Details</a>
- <a href="#engine--platform-feature-mappings">Engine &amp; Platform Feature Mappings</a>
- <a href="#deployment-scope-reference">Deployment Scope Reference</a>
- <a href="#connection-type-reference">Connection Type Reference</a>
- <a href="#quick-lookup-biztalk-adapter--logic-apps-connector">Quick Lookup: BizTalk Adapter → Logic Apps Connector</a>
- <a href="#coverage-summary">Coverage Summary</a>

---

## Overview

Azure Logic Apps Standard provides built-in **service provider connectors** that run in-process within the runtime, replacing BizTalk Server adapters, pipeline components, accelerators, and engine features. This document maps every BizTalk component to its Logic Apps Standard equivalent, including available triggers and actions.

### Key Concepts

| Concept            | BizTalk Server                 | Logic Apps Standard                               |
| ------------------ | ------------------------------ | ------------------------------------------------- |
| Transport          | Adapter (Send/Receive)         | Service Provider Connector                        |
| Message Processing | Pipeline Component             | Built-in Action (XML Operations, Flat File, etc.) |
| Routing            | Publish/Subscribe (MessageBox) | Workflow triggers + conditions                    |
| Orchestration      | XLANG/s Orchestration          | Workflow definition (JSON)                        |
| Trading Partners   | Party / Agreement              | Integration Account                               |
| Business Rules     | Business Rules Engine (BRE)    | Rules Engine action                               |
| Maps / Transforms  | XSLT Map                       | XML Operations → Xslt action                      |
| Schema Validation  | XML Validator pipeline         | XML Operations → XmlValidation action             |

---

## Adapter Mappings

### File & Storage

#### File System

|                         | BizTalk          | Logic Apps Standard            |
| ----------------------- | ---------------- | ------------------------------ |
| **Adapter / Connector** | FILE, FileSystem | **File System**                |
| **Service Provider**    | —                | `/serviceProviders/fileSystem` |
| **Deployment Scope**    | —                | Any (on-premises + cloud)      |
| **Category**            | —                | Storage                        |

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

|                         | BizTalk  | Logic Apps Standard     |
| ----------------------- | -------- | ----------------------- |
| **Adapter / Connector** | FTP, Ftp | **FTP**                 |
| **Service Provider**    | —        | `/serviceProviders/ftp` |
| **Deployment Scope**    | —        | Any                     |
| **Category**            | —        | Storage                 |

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

|                         | BizTalk    | Logic Apps Standard      |
| ----------------------- | ---------- | ------------------------ |
| **Adapter / Connector** | SFTP, Sftp | **SFTP**                 |
| **Service Provider**    | —          | `/serviceProviders/sftp` |
| **Deployment Scope**    | —          | Any                      |
| **Category**            | —          | Storage                  |

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

#### Azure Blob Storage

|                         | BizTalk                     | Logic Apps Standard           |
| ----------------------- | --------------------------- | ----------------------------- |
| **Adapter / Connector** | AzureBlob, AzureBlobStorage | **Azure Blob Storage**        |
| **Service Provider**    | —                           | `/serviceProviders/AzureBlob` |
| **Deployment Scope**    | —                           | Cloud Only                    |
| **Category**            | —                           | Storage                       |

| Type    | Operation                                | Description                   |
| ------- | ---------------------------------------- | ----------------------------- |
| Trigger | `whenABlobIsAddedOrModified` _(default)_ | Poll for new/modified blobs   |
| Action  | `uploadBlob` _(default)_                 | Upload a blob                 |
| Action  | `readBlob`                               | Read blob content             |
| Action  | `deleteBlob`                             | Delete a blob                 |
| Action  | `blobExists`                             | Check if blob exists          |
| Action  | `listBlobs`                              | List blobs in a container     |
| Action  | `readBlobFromUri`                        | Read blob from URI            |
| Action  | `getAccessPolicies`                      | Get container access policies |
| Action  | `listContainers`                         | List blob containers          |
| Action  | `uploadBlobFromUri`                      | Upload blob from URI          |

**Connection Parameters:** `ConnectionString` (required)

---

#### Azure Table Storage

|                         | BizTalk                       | Logic Apps Standard             |
| ----------------------- | ----------------------------- | ------------------------------- |
| **Adapter / Connector** | AzureTable, AzureTableStorage | **Azure Table Storage**         |
| **Service Provider**    | —                             | `/serviceProviders/azureTables` |
| **Deployment Scope**    | —                             | Cloud Only                      |
| **Category**            | —                             | Storage                         |

| Type   | Operation                  | Description                |
| ------ | -------------------------- | -------------------------- |
| Action | `insertEntity` _(default)_ | Insert or upsert an entity |
| Action | `getEntity`                | Get an entity by key       |
| Action | `updateEntity`             | Update an entity           |
| Action | `deleteEntity`             | Delete an entity           |
| Action | `queryEntities`            | Query entities with filter |

> **Note:** No triggers available. Use a workflow with recurrence to poll.

**Connection Parameters:** `ConnectionString` (required)

---

### Messaging & Eventing

#### Azure Service Bus

|                         | BizTalk                       | Logic Apps Standard            |
| ----------------------- | ----------------------------- | ------------------------------ |
| **Adapter / Connector** | ServiceBus, MSMQ, NetMsmq, SB | **Azure Service Bus**          |
| **Service Provider**    | —                             | `/serviceProviders/serviceBus` |
| **Deployment Scope**    | —                             | Cloud Only                     |
| **Category**            | —                             | Messaging                      |

> **Migration Note:** BizTalk MSMQ and NetMsmq adapters have no direct cloud equivalent. Azure Service Bus is the recommended replacement for all on-premises queuing patterns.

| Type    | Operation                            | Description                        |
| ------- | ------------------------------------ | ---------------------------------- |
| Trigger | `receiveQueueMessage` _(default)_    | Receive single queue message       |
| Trigger | `receiveQueueMessages`               | Receive batch of queue messages    |
| Trigger | `receiveTopicMessage`                | Receive single topic message       |
| Trigger | `receiveTopicMessages`               | Receive batch of topic messages    |
| Trigger | `peekLockQueueMessagesV2`            | Peek-lock queue messages           |
| Trigger | `peekLockTopicMessagesV2`            | Peek-lock topic messages           |
| Trigger | `onSingleNewMessageFromQueueSession` | Receive from session-enabled queue |
| Action  | `sendMessage` _(default)_            | Send a message                     |
| Action  | `sendMessages`                       | Send batch of messages             |
| Action  | `getMessagesFromQueueV2`             | Get messages from queue            |
| Action  | `getMessagesFromTopicV2`             | Get messages from topic            |
| Action  | `getMessagesFromQueueSession`        | Get messages from queue session    |
| Action  | `getMessagesFromTopicSession`        | Get messages from topic session    |
| Action  | `completeMessage`                    | Complete a message                 |
| Action  | `abandonMessage`                     | Abandon a message                  |
| Action  | `deadLetterMessage`                  | Dead-letter a message              |
| Action  | `deferMessage`                       | Defer a message                    |
| Action  | `renewLockMessage`                   | Renew message lock                 |
| Action  | `completeMessageInSession`           | Complete message in session        |
| Action  | `abandonMessageInSession`            | Abandon message in session         |
| Action  | `deadLetterMessageInSession`         | Dead-letter message in session     |
| Action  | `deferMessageInSession`              | Defer message in session           |
| Action  | `renewQueueSession`                  | Renew queue session                |
| Action  | `renewTopicSession`                  | Renew topic session                |
| Action  | `closeQueueSession`                  | Close queue session                |
| Action  | `closeTopicSession`                  | Close topic session                |
| Action  | `completeTopicMessageV2`             | Complete topic message             |
| Action  | `abandonTopicMessageV2`              | Abandon topic message              |
| Action  | `renewLockTopicMessageV2`            | Renew topic message lock           |

**Connection Parameters:** `ConnectionString` (required)

---

#### Azure Event Hub

|                         | BizTalk                 | Logic Apps Standard          |
| ----------------------- | ----------------------- | ---------------------------- |
| **Adapter / Connector** | EventHub, AzureEventHub | **Azure Event Hub**          |
| **Service Provider**    | —                       | `/serviceProviders/eventHub` |
| **Deployment Scope**    | —                       | Cloud Only                   |
| **Category**            | —                       | Messaging                    |

| Type    | Operation                   | Description           |
| ------- | --------------------------- | --------------------- |
| Trigger | `receiveEvents` _(default)_ | Receive events (Push) |
| Action  | `sendEvent` _(default)_     | Send a single event   |
| Action  | `sendEvents`                | Send batch of events  |

**Connection Parameters:** `ConnectionString` (required)

---

#### IBM MQ

|                         | BizTalk             | Logic Apps Standard    |
| ----------------------- | ------------------- | ---------------------- |
| **Adapter / Connector** | MQ, IbmMq, MQSeries | **IBM MQ**             |
| **Service Provider**    | —                   | `/serviceProviders/mq` |
| **Deployment Scope**    | —                   | Any                    |
| **Category**            | —                   | Messaging              |

| Type    | Operation                      | Description                       |
| ------- | ------------------------------ | --------------------------------- |
| Trigger | `receiveMessage` _(default)_   | Receive a message from queue      |
| Trigger | `pollMessages`                 | Poll messages from queue          |
| Trigger | `pollBrowseMessages`           | Poll and browse messages          |
| Action  | `sendMessage` _(default)_      | Send a message to queue           |
| Action  | `browseMessage`                | Browse a message without removing |
| Action  | `receiveMessage`               | Receive (destructive read)        |
| Action  | `completeMessage`              | Complete a received message       |
| Action  | `receiveBatch`                 | Receive batch of messages         |
| Action  | `browseBatch`                  | Browse batch of messages          |
| Action  | `moveMessageToDeadLetterQueue` | Move message to DLQ               |

**Connection Parameters:** `QueueManager` (required), `HostName` (required), `Port` (required), `Channel` (required), `UserName` (optional), `Password` (optional)

---

#### RabbitMQ

|                         | BizTalk  | Logic Apps Standard          |
| ----------------------- | -------- | ---------------------------- |
| **Adapter / Connector** | RabbitMQ | **RabbitMQ**                 |
| **Service Provider**    | —        | `/serviceProviders/rabbitmq` |
| **Deployment Scope**    | —        | Any                          |
| **Category**            | —        | Messaging                    |

| Type    | Operation                             | Description                      |
| ------- | ------------------------------------- | -------------------------------- |
| Trigger | `receiveRabbitMQMessages` _(default)_ | Receive messages (Push)          |
| Action  | `sendRabbitMQMessage` _(default)_     | Send a message                   |
| Action  | `createQueue`                         | Create a queue                   |
| Action  | `completeMessage`                     | Complete (acknowledge) a message |

**Connection Parameters:** `HostName` (required), `UserName` (required), `Password` (required), `Port` (optional), `VirtualHost` (optional)

---

#### Confluent Kafka

|                         | BizTalk               | Logic Apps Standard                |
| ----------------------- | --------------------- | ---------------------------------- |
| **Adapter / Connector** | Kafka, ConfluentKafka | **Confluent Kafka**                |
| **Service Provider**    | —                     | `/serviceProviders/confluentKafka` |
| **Deployment Scope**    | —                     | Any                                |
| **Category**            | —                     | Messaging                          |

| Type    | Operation                    | Description             |
| ------- | ---------------------------- | ----------------------- |
| Trigger | `ReceiveMessage` _(default)_ | Receive messages (Push) |
| Action  | `SendMessage` _(default)_    | Send a message to topic |

**Connection Parameters:** `BootstrapServers` (required), `AuthenticationMode` (required), `Protocol` (required), `UserName` (optional), `Password` (optional), `SchemaRegistryUrl` (optional), `SchemaRegistryApiKey` (optional), `SchemaRegistryApiSecret` (optional)

---

### Database

#### SQL Server

|                         | BizTalk           | Logic Apps Standard     |
| ----------------------- | ----------------- | ----------------------- |
| **Adapter / Connector** | SQL, Sql, WCF-SQL | **SQL Server**          |
| **Service Provider**    | —                 | `/serviceProviders/sql` |
| **Deployment Scope**    | —                 | Any                     |
| **Category**            | —                 | Database                |

| Type    | Operation                        | Description                |
| ------- | -------------------------------- | -------------------------- |
| Trigger | `whenARowIsModified` _(default)_ | Poll for modified rows     |
| Trigger | `whenARowIsUpdated`              | Poll for updated rows      |
| Trigger | `whenARowIsInserted`             | Poll for inserted rows     |
| Trigger | `whenARowIsDeleted`              | Poll for deleted rows      |
| Action  | `executeQuery` _(default)_       | Execute a SQL query        |
| Action  | `executeStoredProcedure`         | Execute a stored procedure |
| Action  | `getRows`                        | Get rows from a table      |
| Action  | `getRowsV2`                      | Get rows (v2 with queries) |
| Action  | `insertRow`                      | Insert a row               |
| Action  | `updateRows`                     | Update rows                |
| Action  | `deleteRows`                     | Delete rows                |

**Connection Parameters:** `ConnectionString` (required)

---

#### Azure Cosmos DB

|                         | BizTalk                           | Logic Apps Standard               |
| ----------------------- | --------------------------------- | --------------------------------- |
| **Adapter / Connector** | CosmosDb, CosmosDB, AzureCosmosDB | **Azure Cosmos DB**               |
| **Service Provider**    | —                                 | `/serviceProviders/AzureCosmosDB` |
| **Deployment Scope**    | —                                 | Cloud Only                        |
| **Category**            | —                                 | Database                          |

| Type    | Operation                                      | Description                 |
| ------- | ---------------------------------------------- | --------------------------- |
| Trigger | `whenADocumentIsCreatedOrModified` _(default)_ | Change feed trigger (Push)  |
| Action  | `CreateOrUpdateDocument` _(default)_           | Create or upsert a document |
| Action  | `ReadDocument`                                 | Read a document by ID       |
| Action  | `PatchItem`                                    | Patch a document            |
| Action  | `QueryDocuments`                               | Query documents with SQL    |
| Action  | `DeleteDocument`                               | Delete a document           |

**Connection Parameters:** `ConnectionString` (required)

---

#### IBM Db2

|                         | BizTalk  | Logic Apps Standard     |
| ----------------------- | -------- | ----------------------- |
| **Adapter / Connector** | DB2, Db2 | **IBM Db2**             |
| **Service Provider**    | —        | `/serviceProviders/db2` |
| **Deployment Scope**    | —        | Any                     |
| **Category**            | —        | Database                |

| Type   | Operation                  | Description                |
| ------ | -------------------------- | -------------------------- |
| Action | `executeQuery` _(default)_ | Execute a SQL query        |
| Action | `executeStoredProcedure`   | Execute a stored procedure |
| Action | `getRow`                   | Get a single row           |
| Action | `insertRow`                | Insert a row               |
| Action | `updateRow`                | Update a row               |
| Action | `deleteRow`                | Delete a row               |

> **Note:** No triggers available.

**Connection Parameters:** `Server` (required), `Database` (required), `UserName` (required), `Password` (required), `Port` (optional)

---

#### IBM Informix

|                         | BizTalk                           | Logic Apps Standard |
| ----------------------- | --------------------------------- | ------------------- |
| **Adapter / Connector** | Informix                          | **IBM Informix**    |
| **Service Provider**    | `null` (none)                     |                     |
| **API Connection**      | **Yes** (`IsApiConnection: true`) |                     |
| **Deployment Scope**    | —                                 | Any                 |
| **Category**            | —                                 | Database            |

> **Note:** This is the only connector that uses the managed API Connection model exclusively (no built-in service provider).

| Type    | Operation                       | Description            |
| ------- | ------------------------------- | ---------------------- |
| Trigger | `GetOnUpdatedItems` _(default)_ | Poll for updated items |
| Action  | `InsertRow` _(default)_         | Insert a row           |
| Action  | `GetRow`                        | Get a single row       |
| Action  | `GetRows`                       | Get multiple rows      |
| Action  | `UpdateRow`                     | Update a row           |
| Action  | `DeleteRow`                     | Delete a row           |

**Connection Parameters:** `Server` (required), `Database` (required), `AuthenticationType` (required), `Username` (optional), `Password` (optional)

---

#### Oracle Database

|                         | BizTalk                           | Logic Apps Standard          |
| ----------------------- | --------------------------------- | ---------------------------- |
| **Adapter / Connector** | OracleDb, OracleDatabase, ODP.NET | **Oracle Database**          |
| **Service Provider**    | —                                 | `/serviceProviders/oracledb` |
| **Deployment Scope**    | —                                 | Any                          |
| **Category**            | —                                 | Database                     |

| Type   | Operation                  | Description                |
| ------ | -------------------------- | -------------------------- |
| Action | `executeQuery` _(default)_ | Execute a SQL query        |
| Action | `getTables`                | List available tables      |
| Action | `getRows`                  | Get rows from a table      |
| Action | `executeStoredProcedure`   | Execute a stored procedure |
| Action | `insertRow`                | Insert a row               |

> **Note:** No triggers available.

**Connection Parameters:** `Server` (required), `ServiceName` (required), `UserName` (required), `Password` (required), `Port` (optional)

---

### HTTP & Web Services

#### HTTP

|                         | BizTalk                                                                                 | Logic Apps Standard      |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| **Adapter / Connector** | HTTP, Http, WCF-BasicHttp, WCF-WSHttp, WCF-NetTcp, WCF-Custom, WCF-CustomIsolated, SOAP | **HTTP**                 |
| **Service Provider**    | —                                                                                       | `/serviceProviders/http` |
| **Deployment Scope**    | —                                                                                       | Any                      |
| **Category**            | —                                                                                       | Integration              |

> **Migration Note:** All WCF-based adapters and the SOAP adapter are consolidated into the single HTTP connector. WCF-specific bindings (NetTcp, etc.) are not natively supported — migrate to HTTP/HTTPS REST or SOAP-over-HTTP patterns.

| Type    | Operation                | Description                             |
| ------- | ------------------------ | --------------------------------------- |
| Trigger | `manual` _(default)_     | HTTP Request trigger (webhook/callback) |
| Action  | `invokeHttp` _(default)_ | Make an HTTP request                    |

**Connection Parameters:** None required (inline configuration)

---

### Email

#### SMTP

|                         | BizTalk                                                   | Logic Apps Standard      |
| ----------------------- | --------------------------------------------------------- | ------------------------ |
| **Adapter / Connector** | SMTP, Smtp, OutlookEmail, GmailEmail, ExchangeOnlineEmail | **SMTP**                 |
| **Service Provider**    | —                                                         | `/serviceProviders/Smtp` |
| **Deployment Scope**    | —                                                         | Any                      |
| **Category**            | —                                                         | Email                    |

> **Migration Note:** BizTalk's SMTP adapter is mapped here. For richer Outlook/Gmail/Exchange scenarios, consider the corresponding managed API connectors in Logic Apps.

| Type   | Operation               | Description   |
| ------ | ----------------------- | ------------- |
| Action | `sendEmail` _(default)_ | Send an email |

> **Note:** No triggers available for SMTP. Use a Request trigger or another trigger to initiate email sending.

**Connection Parameters:** `Server` (required), `Port` (required), `UserName` (required), `Password` (required), `EnableSSL` (optional)

---

### B2B / EDI

#### AS2

|                         | BizTalk                  | Logic Apps Standard |
| ----------------------- | ------------------------ | ------------------- |
| **Adapter / Connector** | AS2                      | **AS2**             |
| **Service Provider**    | — (no ServiceProviderId) |                     |
| **Deployment Scope**    | —                        | Any                 |
| **Category**            | —                        | B2B                 |

| Type   | Operation               | Description           |
| ------ | ----------------------- | --------------------- |
| Action | `AS2Encode` _(default)_ | Encode an AS2 message |
| Action | `AS2Decode`             | Decode an AS2 message |

**Connection Parameters:** None

---

#### X12

|                         | BizTalk | Logic Apps Standard     |
| ----------------------- | ------- | ----------------------- |
| **Adapter / Connector** | X12     | **X12**                 |
| **Service Provider**    | —       | `/serviceProviders/x12` |
| **Deployment Scope**    | —       | Any                     |
| **Category**            | —       | B2B                     |

| Type   | Operation               | Description               |
| ------ | ----------------------- | ------------------------- |
| Action | `X12Decode` _(default)_ | Decode an X12 message     |
| Action | `X12Encode`             | Encode an X12 message     |
| Action | `X12BatchEncode`        | Batch-encode X12 messages |

**Connection Parameters:** None listed (uses Integration Account)

---

#### EDIFACT

|                         | BizTalk | Logic Apps Standard         |
| ----------------------- | ------- | --------------------------- |
| **Adapter / Connector** | EDIFACT | **EDIFACT**                 |
| **Service Provider**    | —       | `/serviceProviders/edifact` |
| **Deployment Scope**    | —       | Any                         |
| **Category**            | —       | B2B                         |

| Type   | Operation                   | Description                   |
| ------ | --------------------------- | ----------------------------- |
| Action | `EdifactDecode` _(default)_ | Decode an EDIFACT message     |
| Action | `EdifactEncode`             | Encode an EDIFACT message     |
| Action | `EdifactBatchEncode`        | Batch-encode EDIFACT messages |

**Connection Parameters:** `IntegrationAccountName` (required)

---

### Healthcare

#### MLLP (HL7)

|                         | BizTalk         | Logic Apps Standard      |
| ----------------------- | --------------- | ------------------------ |
| **Adapter / Connector** | MLLP, Mllp, HL7 | **MLLP (HL7)**           |
| **Service Provider**    | —               | `/serviceProviders/mllp` |
| **Deployment Scope**    | —               | Any                      |
| **Category**            | —               | Healthcare               |

| Type    | Operation                    | Description                          |
| ------- | ---------------------------- | ------------------------------------ |
| Trigger | `receiveMessage` _(default)_ | Receive HL7 message over MLLP (Push) |
| Action  | `sendMessage` _(default)_    | Send HL7 message over MLLP           |

**Connection Parameters:** `Endpoint` (required)

---

### Financial

#### SWIFT

|                         | BizTalk                  | Logic Apps Standard |
| ----------------------- | ------------------------ | ------------------- |
| **Adapter / Connector** | SWIFT                    | **SWIFT**           |
| **Service Provider**    | — (no ServiceProviderId) |                     |
| **Deployment Scope**    | —                        | Any                 |
| **Category**            | —                        | Financial           |

| Type   | Operation                   | Description               |
| ------ | --------------------------- | ------------------------- |
| Action | `SwiftMTDecode` _(default)_ | Decode a SWIFT MT message |
| Action | `SwiftMTEncode`             | Encode a SWIFT MT message |

**Connection Parameters:** None

---

### ERP (SAP)

#### SAP

|                         | BizTalk      | Logic Apps Standard     |
| ----------------------- | ------------ | ----------------------- |
| **Adapter / Connector** | SAP, WCF-SAP | **SAP**                 |
| **Service Provider**    | —            | `/serviceProviders/sap` |
| **Deployment Scope**    | —            | Any                     |
| **Category**            | —            | ERP                     |

| Type    | Operation                | Description                         |
| ------- | ------------------------ | ----------------------------------- |
| Trigger | `SapTrigger` _(default)_ | Receive IDoc / tRFC from SAP (Push) |
| Action  | `callRfc` _(default)_    | Call an RFC function module         |
| Action  | `bapiCallMethod`         | Call a BAPI method                  |
| Action  | `respondToSapServer`     | Send response to SAP server         |
| Action  | `bapiRollback`           | Rollback a BAPI transaction         |
| Action  | `commitRfcTransaction`   | Commit an RFC transaction           |
| Action  | `addRfcToTransaction`    | Add RFC to a transaction            |
| Action  | `getRfcTransaction`      | Get RFC transaction details         |
| Action  | `getIDocStatus`          | Get IDoc processing status          |
| Action  | `createRfcTransaction`   | Create an RFC transaction           |
| Action  | `getSchemaV2`            | Get SAP schema metadata             |
| Action  | `readTable`              | Read data from SAP table            |
| Action  | `sendIDoc`               | Send an IDoc to SAP                 |

**Connection Parameters:** `ApplicationServerHost` (required), `SystemNumber` (required), `ClientId` (required), `UserName` (required), `Password` (required)

---

#### SAP ERP

|                         | BizTalk              | Logic Apps Standard     |
| ----------------------- | -------------------- | ----------------------- |
| **Adapter / Connector** | SAPERP, SapErp, BAPI | **SAP ERP**             |
| **Service Provider**    | —                    | `/serviceProviders/sap` |
| **Deployment Scope**    | —                    | Any                     |
| **Category**            | —                    | ERP                     |

> **Note:** Shares the same service provider ID as SAP but exposes a simplified session-based operation set.

| Type   | Operation             | Description                 |
| ------ | --------------------- | --------------------------- |
| Action | `callRfc` _(default)_ | Call an RFC function module |
| Action | `createSession`       | Create a session            |
| Action | `bapiCommit`          | Commit a BAPI transaction   |
| Action | `bapiRollback`        | Rollback a BAPI transaction |

**Connection Parameters:** `ApplicationServerHost` (required), `SystemNumber` (required), `ClientId` (required), `UserName` (required), `Password` (required)

---

### Mainframe (IBM)

#### IBM CICS (TRM Link, TRM User Data, ELM Link, ELM User Data, HTTP Link, HTTP User Data, SNA Link, SNA User Data)

|                         | BizTalk    | Logic Apps Standard                 |
| ----------------------- | ---------- | ----------------------------------- |
| **Adapter / Connector** | HostApps   | **IBM CICS**                        |
| **Service Provider**    | —          | `/serviceProviders/cicsProgramCall` |
| **Deployment Scope**    | —          | Any                                 |
| **Category**            | —          | Mainframe                           |

| Type   | Operation                   | Description           |
| ------ | --------------------------- | --------------------- |
| Action | `invokeProgram` _(default)_ | Invoke a CICS program |

**Connection Parameters:** `HostName` (required), `Port` (required), `UserName` (required), `Password` (required), `Region` (required)

---

#### IBM IMS (IMS Connect, IMS LU62)

|                         | BizTalk  | Logic Apps Standard                |
| ----------------------- | -------- | ---------------------------------- |
| **Adapter / Connector** | HostApps | **IBM IMS**                        |
| **Service Provider**    | —        | `/serviceProviders/imsProgramCall` |
| **Deployment Scope**    | —        | Any                                |
| **Category**            | —        | Mainframe                          |

> **Note:** The JSON `DisplayName` is "IBM CICS" which appears to be a registry error. This is IMS based on `Name: "IMS"` and the service provider ID.

| Type   | Operation                   | Description           |
| ------ | --------------------------- | --------------------- |
| Action | `invokeProgram` _(default)_ | Invoke an IMS program |

**Connection Parameters:** `HostName` (required), `Port` (required), `UserName` (required), `Password` (required), `DataStore` (required)

---

#### IBM Host File (VSAM)

|                         | BizTalk    | Logic Apps Standard          |
| ----------------------- | ---------- | ---------------------------- |
| **Adapter / Connector** | HostFiles  | **IBM Host File**            |
| **Service Provider**    | —          | `/serviceProviders/hostFile` |
| **Deployment Scope**    | —          | Any                          |
| **Category**            | —          | Mainframe                    |

| Type   | Operation               | Description                 |
| ------ | ----------------------- | --------------------------- |
| Action | `writeFile` _(default)_ | Generate host file contents |
| Action | `readFile`              | Parse host file contents    |

**Connection Parameters:** `HostName` (required), `Port` (required), `UserName` (required), `Password` (required)

---

### Security

#### Azure Key Vault

|                         | BizTalk                 | Logic Apps Standard          |
| ----------------------- | ----------------------- | ---------------------------- |
| **Adapter / Connector** | KeyVault, AzureKeyVault | **Azure Key Vault**          |
| **Service Provider**    | —                       | `/serviceProviders/keyVault` |
| **Deployment Scope**    | —                       | Cloud Only                   |
| **Category**            | —                       | Security                     |

| Type   | Operation                   | Description                   |
| ------ | --------------------------- | ----------------------------- |
| Action | `getSecret` _(default)_     | Get a secret value            |
| Action | `getSecretMetadata`         | Get secret metadata           |
| Action | `listSecretMetadata`        | List all secrets metadata     |
| Action | `listSecretVersionMetadata` | List secret version metadata  |
| Action | `listKeyMetadata`           | List all keys metadata        |
| Action | `listKeyVersionMetadata`    | List key version metadata     |
| Action | `getKeyMetadata`            | Get key metadata              |
| Action | `getKeyVersionMetadata`     | Get key version metadata      |
| Action | `encryptDataWithKey`        | Encrypt data with key         |
| Action | `encryptDataWithKeyVersion` | Encrypt data with key version |
| Action | `decryptDataWithKey`        | Decrypt data with key         |
| Action | `decryptDataWithKeyVersion` | Decrypt data with key version |

> **Note:** No triggers available.

**Connection Parameters:** `VaultName` (required), `AuthenticationType` (required)

---

## Adapters Not in Registry (Gaps)

The following BizTalk adapters are **not covered** by the connector registry. This table provides recommended migration paths.

| #   | BizTalk Adapter                 | Recommended Logic Apps Equivalent                  | Migration Notes                                                                                                                                |
| --- | ------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **POP3**                        | Office 365 Outlook / Gmail connector (managed API) | BizTalk POP3 receive adapter → use managed API connector for email receive. No built-in service provider.                                      |
| 2   | **Windows SharePoint Services** | SharePoint connector (managed API)                 | Use the SharePoint Online managed API connector. On-premises SharePoint requires on-premises data gateway.                                     |
| 3   | **WCF-NetNamedPipe**            | — (no equivalent)                                  | Inter-process communication only. Migrate to HTTP/HTTPS for service-to-service calls.                                                          |
| 4   | **TIBCO Rendezvous**            | — (no equivalent)                                  | No Logic Apps connector. Consider Azure Service Bus as messaging middleware, or use Custom Code (local function) with TIBCO SDK.               |
| 5   | **TIBCO EMS**                   | Azure Service Bus / RabbitMQ                       | No direct connector. Migrate messaging patterns to Service Bus or RabbitMQ.                                                                    |
| 6   | **JD Edwards OneWorld**         | HTTP connector + JDE REST APIs                     | No direct connector. Use HTTP action to call JD Edwards REST/JSON APIs.                                                                        |
| 7   | **JD Edwards EnterpriseOne**    | HTTP connector + JDE REST APIs                     | No direct connector. Use HTTP action to call JD Edwards REST/JSON APIs.                                                                        |
| 8   | **PeopleSoft Enterprise**       | HTTP connector + PeopleSoft REST APIs              | No direct connector. Use HTTP action to call PeopleSoft Integration Broker REST services.                                                      |
| 9   | **Siebel**                      | HTTP connector + Siebel REST APIs                  | No direct connector. Use HTTP action to call Siebel REST/SOAP APIs.                                                                            |
| 10  | **Oracle E-Business Suite**     | Oracle Database connector (partial)                | Only database operations available via `/serviceProviders/oracledb`. EBS-specific APIs (Concurrent Programs, etc.) require HTTP + Oracle REST. |

---

## Non-Adapter Mappings

These Logic Apps connectors have no BizTalk adapter equivalent (`BizTalkAdapters: []`). They replace functionality that was embedded in BizTalk pipeline components, accelerators, or engine features.

### Pipeline Components (from Registry)

#### XML Operations

| BizTalk Equivalent          | Logic Apps Connector   |
| --------------------------- | ---------------------- |
| XML Assembler (pipeline)    | `XmlCompose` action    |
| XML Disassembler (pipeline) | `XmlParse` action      |
| XML Validator (pipeline)    | `XmlValidation` action |
| XSLT Transform (map)        | `Xslt` action          |

| Type   | Operation              | Description                      |
| ------ | ---------------------- | -------------------------------- |
| Action | `XmlParse` _(default)_ | Parse XML using a schema         |
| Action | `XmlCompose`           | Compose XML from structured data |
| Action | `XmlValidation`        | Validate XML against a schema    |
| Action | `Xslt`                 | Transform XML using XSLT map     |

---

#### Flat File Operations

| BizTalk Equivalent                | Logic Apps Connector      |
| --------------------------------- | ------------------------- |
| Flat File Assembler (pipeline)    | `FlatFileEncoding` action |
| Flat File Disassembler (pipeline) | `FlatFileDecoding` action |

| Type   | Operation                      | Description                          |
| ------ | ------------------------------ | ------------------------------------ |
| Action | `FlatFileDecoding` _(default)_ | Decode flat file to XML using schema |
| Action | `FlatFileEncoding`             | Encode XML to flat file using schema |

---

### Pipeline Components (Not in Registry)

The following BizTalk pipeline components are **not in the connector registry** but have Logic Apps equivalents or workarounds.

| #   | BizTalk Pipeline Component         | Logic Apps Equivalent                                            | Migration Notes                                                                                                                                                     |
| --- | ---------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **MIME/SMIME Encoder**             | Custom Code — local function                                     | No built-in action. Use a Logic Apps native local function (custom code action) to perform S/MIME encryption/signing. Runs in-process within the workflow app.      |
| 2   | **MIME/SMIME Decoder**             | Custom Code — local function                                     | No built-in action. Use a Logic Apps native local function (custom code action) to perform S/MIME decryption/verification. Runs in-process within the workflow app. |
| 3   | **Party Resolution**               | Integration Account partners + agreements                        | Trading partner resolution is handled through Integration Account configuration, not a pipeline component.                                                          |
| 4   | **JSON Encoder**                   | Built-in (native JSON)                                           | Logic Apps is JSON-native. Use the `json()` expression to convert strings to JSON. No special component needed.                                                     |
| 5   | **JSON Decoder**                   | Built-in (native JSON)                                           | Logic Apps is JSON-native. Use `@json(triggerBody())` or similar expressions. No special component needed.                                                          |
| 6   | **Property Promotion / Demotion**  | Expressions / Variables / Tracked Properties                     | Use `triggerOutputs()`, `body()`, `Compose`, `Initialize Variable` actions. Use tracked properties for visibility.                                                  |
| 7   | **Message Compression (zip/gzip)** | `extractArchive` action (partial) / Custom Code — local function | File System, FTP, and SFTP connectors have `extractArchive`. For custom compression/decompression, use a Logic Apps native local function (custom code action).     |

---

### Accelerators

#### HL7

| BizTalk Equivalent                  | Logic Apps Connector              |
| ----------------------------------- | --------------------------------- |
| HL7 Accelerator pipeline components | `HL7Decode` / `HL7Encode` actions |

| Type   | Operation               | Description           |
| ------ | ----------------------- | --------------------- |
| Action | `HL7Decode` _(default)_ | Decode an HL7 message |
| Action | `HL7Encode`             | Encode an HL7 message |

> **Note:** For transport (MLLP), see <a href="#mllp-hl7">MLLP (HL7)</a> above. HL7 connector handles message parsing only.

---

### Engine Features (from Registry)

#### Rules Engine

| BizTalk Equivalent          | Logic Apps Connector |
| --------------------------- | -------------------- |
| Business Rules Engine (BRE) | `RuleExecute` action |

| Type   | Operation                 | Description        |
| ------ | ------------------------- | ------------------ |
| Action | `RuleExecute` _(default)_ | Execute a rule set |

---

### New in Logic Apps (No BizTalk Equivalent)

#### SAP OData

|                      | Details                         |
| -------------------- | ------------------------------- |
| **Connector**        | **SAP OData**                   |
| **Service Provider** | `/connectionProviders/sapodata` |
| **Deployment Scope** | Any                             |
| **Category**         | ERP                             |

| Type   | Operation                   | Description                            |
| ------ | --------------------------- | -------------------------------------- |
| Action | `getEntityData` _(default)_ | Get entity data from SAP OData service |

**Connection Parameters:** `ApiKey` (required), `BaseUrl` (required)

---

## Orchestration Shape Mappings

BizTalk XLANG/s orchestration shapes map to Logic Apps workflow actions and constructs.

### Message Flow

| #   | BizTalk Orchestration Shape | Logic Apps Equivalent                          | Notes                                                                 |
| --- | --------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Receive** (activate)      | Trigger (Request, Service Bus, File, etc.)     | The first Receive shape becomes the workflow trigger.                 |
| 2   | **Receive** (non-activate)  | Action (e.g., receive from queue mid-workflow) | Use a connector action to receive messages within a running workflow. |
| 3   | **Send**                    | Action (HTTP, Send Message, Create File, etc.) | Maps directly to any connector action.                                |
| 4   | **Request-Response** (port) | Request trigger + Response action              | Built-in pattern in Logic Apps.                                       |
| 5   | **Solicit-Response** (port) | HTTP action (request/response)                 | HTTP actions natively return the response.                            |

### Transforms & Messages

| #   | BizTalk Orchestration Shape | Logic Apps Equivalent                              | Notes                                                        |
| --- | --------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| 6   | **Transform**               | XML Operations → `Xslt` action                     | For XSLT maps. Also: Liquid templates, Data Mapper (visual). |
| 7   | **Construct Message**       | `Compose` action                                   | Build a new message payload.                                 |
| 8   | **Message Assignment**      | `Compose` / `Initialize Variable` / `Set Variable` | Assign or modify message content.                            |
| 9   | **Expression**              | Inline expressions / `Compose`                     | Use Logic Apps expression language: `@{...}`.                |

### Control Flow

| #   | BizTalk Orchestration Shape | Logic Apps Equivalent                             | Notes                                                                |
| --- | --------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| 10  | **Decide**                  | `Condition` action / `Switch` action              | `Condition` for if/else, `Switch` for multi-branch.                  |
| 11  | **Loop**                    | `Until` action                                    | Repeat until a condition is met.                                     |
| 12  | **For Each (iteration)**    | `For Each` action                                 | Iterate over an array.                                               |
| 13  | **Parallel Actions**        | `Parallel Branch`                                 | Run multiple branches concurrently.                                  |
| 14  | **Listen**                  | Multiple triggers / `Condition` on trigger output | Use race-condition patterns or separate workflows with shared state. |
| 15  | **Delay**                   | `Delay` action                                    | Wait for a fixed duration.                                           |
| 16  | **Delay (until)**           | `Delay Until` action                              | Wait until a specific time.                                          |

### Error Handling & Lifecycle

| #   | BizTalk Orchestration Shape | Logic Apps Equivalent                           | Notes                                                                  |
| --- | --------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| 17  | **Scope**                   | `Scope` action                                  | Group actions for shared error handling.                               |
| 18  | **Throw Exception**         | `Terminate` action (Failed status)              | End workflow with failure and error details.                           |
| 19  | **Suspend**                 | `Terminate` action (Suspended/Cancelled status) | End workflow; can be resubmitted from portal.                          |
| 20  | **Compensation**            | `Scope` → `runAfter` (Failed / TimedOut)        | Not 1:1. Use scope-level error handling with `runAfter` configuration. |
| 21  | **Terminate**               | `Terminate` action                              | End the workflow immediately.                                          |

### Inter-Orchestration Communication

| #   | BizTalk Orchestration Shape | Logic Apps Equivalent                                      | Notes                                                                               |
| --- | --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 22  | **Call Orchestration**      | Invoke nested workflow (synchronous)                       | Use the built-in "Invoke Workflow" action.                                          |
| 23  | **Start Orchestration**     | HTTP POST to another workflow's trigger URL                | Fire and forget; async invocation.                                                  |
| 24  | **Direct Binding**          | — (no equivalent)                                          | No MessageBox pub/sub. Use explicit triggers/actions or Service Bus for decoupling. |
| 25  | **Correlation Set**         | Stateful workflow + `correlationId` / Service Bus sessions | Use tracked properties or Service Bus session IDs for correlation.                  |
| 26  | **Role Link**               | — (no equivalent)                                          | No equivalent. Use configuration/parameters for dynamic endpoint resolution.        |

### Transactions

| #   | BizTalk Orchestration Shape          | Logic Apps Equivalent                            | Notes                                                                                  |
| --- | ------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 27  | **Atomic Transaction** (scope)       | — (no distributed transactions)                  | Logic Apps does not support distributed transactions. Use compensation/retry patterns. |
| 28  | **Long-Running Transaction** (scope) | `Scope` with error handling + compensation logic | Model with scopes and `runAfter` for compensating actions.                             |

---

## Engine & Platform Feature Mappings

BizTalk Server engine and platform features mapped to Logic Apps Standard equivalents.

### Messaging Engine

| #   | BizTalk Feature           | Logic Apps Equivalent                          | Notes                                                                                   |
| --- | ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | **MessageBox (Pub/Sub)**  | Trigger → Condition / Switch routing           | No centralized message bus. Use Service Bus topics for decoupling multiple subscribers. |
| 2   | **Content-Based Routing** | `Condition` / `Switch` actions in workflow     | Route based on message content using expressions.                                       |
| 3   | **Debatching (envelope)** | `SplitOn` on trigger                           | Set `splitOn` property on trigger to split an array into individual workflow runs.      |
| 4   | **Message Enrichment**    | Inline actions (HTTP, DB query) + `Compose`    | Call external services mid-workflow to enrich the message.                              |
| 5   | **Ordered Delivery**      | Service Bus sessions / `concurrency: 1`        | Set workflow concurrency to 1, or use Service Bus sessions for FIFO.                    |
| 6   | **Retry / Resubmit**      | Built-in retry policies + resubmit from portal | Configure retry on each action. Resubmit failed runs from Azure Portal or API.          |

### Integration Patterns

| #   | BizTalk Feature       | Logic Apps Equivalent                             | Notes                                                             |
| --- | --------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| 7   | **Sequential Convoy** | Stateful workflow + Service Bus sessions          | Correlate related messages in order using session-enabled queues. |
| 8   | **Parallel Convoy**   | Stateful workflow + multiple triggers/correlation | Use separate workflows or parallel branches with correlation.     |
| 9   | **Scatter-Gather**    | `Parallel Branch` with join                       | Fan-out to multiple endpoints in parallel, collect all results.   |
| 10  | **Aggregation**       | `For Each` + `Append to Array` + `Compose`        | Iterate and build up an aggregated result.                        |
| 11  | **Dynamic Send Port** | HTTP action with dynamic URI                      | Use expressions for dynamic endpoint: `@{variables('endpoint')}`. |

### Monitoring & Operations

| #   | BizTalk Feature                        | Logic Apps Equivalent                | Notes                                                                     |
| --- | -------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| 12  | **Tracking / HAT**                     | Run History + Tracked Properties     | Built into Azure Portal. View input/output of every action.               |
| 13  | **BAM (Business Activity Monitoring)** | Application Insights / Azure Monitor | Use Application Insights integration for custom telemetry and dashboards. |
| 14  | **Health Monitoring**                  | Azure Monitor Alerts + Diagnostics   | Configure alerts on workflow failures, latency, etc.                      |

### Security & Configuration

| #   | BizTalk Feature                     | Logic Apps Equivalent                  | Notes                                                                         |
| --- | ----------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| 15  | **SSO (Enterprise Single Sign-On)** | Azure Key Vault + Managed Identity     | Store secrets in Key Vault. Use managed identity for passwordless auth.       |
| 16  | **BizTalk Admin Console**           | Azure Portal / VS Code                 | Manage, monitor, and deploy workflows from Azure Portal or VS Code extension. |
| 17  | **Binding Files**                   | `connections.json` + `parameters.json` | Environment-specific configuration stored in JSON files.                      |
| 18  | **Host / Host Instances**           | App Service Plan / Workflow App        | Scale unit is the Logic App (Standard) resource on an App Service Plan.       |

### Mapper & Transforms

| #   | BizTalk Feature                      | Logic Apps Equivalent                                                   | Notes                                                                                                           |
| --- | ------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 19  | **BizTalk Mapper (Visual)**          | Data Mapper (preview) / XSLT                                            | Data Mapper is the visual equivalent in VS Code. XSLT for complex transforms.                                   |
| 20  | **Functoids (String)**               | Expression functions: `concat()`, `substring()`, `replace()`, etc.      |                                                                                                                 |
| 21  | **Functoids (Mathematical)**         | Expression functions: `add()`, `sub()`, `mul()`, `div()`, etc.          |                                                                                                                 |
| 22  | **Functoids (Logical)**              | Expression functions: `if()`, `equals()`, `and()`, `or()`, `not()`      |                                                                                                                 |
| 23  | **Functoids (Date/Time)**            | Expression functions: `utcNow()`, `addDays()`, `formatDateTime()`, etc. |                                                                                                                 |
| 24  | **Functoids (Conversion)**           | Expression functions: `int()`, `float()`, `string()`, `base64()`, etc.  |                                                                                                                 |
| 25  | **Functoids (Cumulative)**           | XSLT `sum()`, `count()` / `For Each` + `Append to Array`                | No direct visual equivalent; use XSLT or workflow loops.                                                        |
| 26  | **Functoids (Database)**             | SQL Server action inside Data Mapper / workflow                         | Call database mid-transform using workflow actions.                                                             |
| 27  | **Functoids (Advanced — Scripting)** | XSLT inline scripts / Custom Code — local function                      | Use `<msxsl:script>` in XSLT or call a Logic Apps native local function (custom code action) for complex logic. |
| 28  | **Functoids (Cross Referencing)**    | Integration Account maps / lookup actions                               | Use Integration Account for partner-specific value mapping.                                                     |
| 29  | **Liquid Templates**                 | Liquid template action (built-in)                                       | JSON-to-JSON, JSON-to-text transforms. Upload templates to Integration Account.                                 |

---

## BizTalk Expressions → Logic Apps Expressions

BizTalk orchestrations use **XLANG/s** expressions (a C#-like syntax) for string manipulation, message construction, property access, and logic. Logic Apps Standard uses the **Workflow Definition Language (WDL)** expression syntax.

### Expression Language Comparison

| Aspect            | BizTalk (XLANG/s)                                  | Logic Apps (WDL)                                                 |
| ----------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| **Syntax**        | C#-like: `myVar = "hello" + " world";`             | Template: `@{concat('hello', ' world')}`                         |
| **Type system**   | Strong-typed .NET (string, int, XmlDocument, etc.) | Dynamic (string, integer, float, boolean, array, object, null)   |
| **Evaluation**    | Compile-time                                       | Runtime                                                          |
| **Access style**  | Dot notation: `msg.Property`                       | Function calls: `triggerBody()?['Property']`                     |
| **Null handling** | Standard C# null checks                            | Safe navigation: `?['key']` (returns null, no error)             |
| **String format** | `String.Format("Hello {0}", name)`                 | `@{concat('Hello ', variables('name'))}` or string interpolation |
| **Where defined** | Expression shapes, message assignments             | Inline in any action input field, `Compose` action               |

### Common Expression Conversions

#### String Operations

| BizTalk XLANG/s                  | Logic Apps WDL                                                        | Notes                                                                                   |
| -------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `str1 + str2`                    | `@{concat(str1, str2)}`                                               |                                                                                         |
| `str.Length`                     | `@{length(variables('str'))}`                                         |                                                                                         |
| `str.Substring(start, len)`      | `@{substring(variables('str'), start, len)}`                          |                                                                                         |
| `str.ToUpper()`                  | `@{toUpper(variables('str'))}`                                        |                                                                                         |
| `str.ToLower()`                  | `@{toLower(variables('str'))}`                                        |                                                                                         |
| `str.Trim()`                     | `@{trim(variables('str'))}`                                           |                                                                                         |
| `str.Replace("old", "new")`      | `@{replace(variables('str'), 'old', 'new')}`                          |                                                                                         |
| `str.Contains("text")`           | `@{contains(variables('str'), 'text')}`                               | Returns boolean                                                                         |
| `str.StartsWith("prefix")`       | `@{startsWith(variables('str'), 'prefix')}`                           |                                                                                         |
| `str.EndsWith("suffix")`         | `@{endsWith(variables('str'), 'suffix')}`                             |                                                                                         |
| `str.IndexOf("find")`            | `@{indexOf(variables('str'), 'find')}`                                |                                                                                         |
| `str.Split(',')`                 | `@{split(variables('str'), ',')}`                                     | Returns an array                                                                        |
| `String.Format("{0}-{1}", a, b)` | `@{concat(variables('a'), '-', variables('b'))}`                      |                                                                                         |
| `String.IsNullOrEmpty(str)`      | `@{or(equals(variables('str'), null), equals(variables('str'), ''))}` | Or use `empty()`                                                                        |
| `Regex.IsMatch(str, pattern)`    | C# Inline Code action                                                 | No built-in WDL regex. Use `System.Text.RegularExpressions` in a C# inline code action. |

#### Numeric & Math Operations

| BizTalk XLANG/s          | Logic Apps WDL                           | Notes |
| ------------------------ | ---------------------------------------- | ----- |
| `a + b` (int)            | `@{add(variables('a'), variables('b'))}` |       |
| `a - b`                  | `@{sub(variables('a'), variables('b'))}` |       |
| `a * b`                  | `@{mul(variables('a'), variables('b'))}` |       |
| `a / b`                  | `@{div(variables('a'), variables('b'))}` |       |
| `a % b`                  | `@{mod(variables('a'), variables('b'))}` |       |
| `Math.Min(a, b)`         | `@{min(variables('a'), variables('b'))}` |       |
| `Math.Max(a, b)`         | `@{max(variables('a'), variables('b'))}` |       |
| `int.Parse(str)`         | `@{int(variables('str'))}`               |       |
| `Convert.ToDecimal(str)` | `@{float(variables('str'))}`             |       |

#### Date/Time Operations

| BizTalk XLANG/s             | Logic Apps WDL                                                         | Notes                     |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------- |
| `DateTime.UtcNow`           | `@{utcNow()}`                                                          |                           |
| `DateTime.Now`              | `@{convertFromUtc(utcNow(), 'timezone')}`                              | Specify timezone          |
| `dt.AddDays(n)`             | `@{addDays(variables('dt'), n)}`                                       |                           |
| `dt.AddHours(n)`            | `@{addHours(variables('dt'), n)}`                                      |                           |
| `dt.AddMinutes(n)`          | `@{addMinutes(variables('dt'), n)}`                                    |                           |
| `dt.AddSeconds(n)`          | `@{addSeconds(variables('dt'), n)}`                                    |                           |
| `dt.ToString("yyyy-MM-dd")` | `@{formatDateTime(variables('dt'), 'yyyy-MM-dd')}`                     |                           |
| `(dt2 - dt1).TotalDays`     | `@{div(ticks(sub(variables('dt2'), variables('dt1'))), 864000000000)}` | Or use `dateDifference()` |
| `DateTime.Parse(str)`       | `@{parseDateTime(variables('str'))}`                                   |                           |

#### Logical / Comparison Operations

| BizTalk XLANG/s                  | Logic Apps WDL                        | Notes |
| -------------------------------- | ------------------------------------- | ----- |
| `a == b`                         | `@{equals(a, b)}`                     |       |
| `a != b`                         | `@{not(equals(a, b))}`                |       |
| `a > b`                          | `@{greater(a, b)}`                    |       |
| `a >= b`                         | `@{greaterOrEquals(a, b)}`            |       |
| `a < b`                          | `@{less(a, b)}`                       |       |
| `a <= b`                         | `@{lessOrEquals(a, b)}`               |       |
| `a && b`                         | `@{and(a, b)}`                        |       |
| `a \|\| b`                       | `@{or(a, b)}`                         |       |
| `!a`                             | `@{not(a)}`                           |       |
| `condition ? trueVal : falseVal` | `@{if(condition, trueVal, falseVal)}` |       |

#### Type Conversion

| BizTalk XLANG/s                 | Logic Apps WDL                                          | Notes                         |
| ------------------------------- | ------------------------------------------------------- | ----------------------------- |
| `(string)value`                 | `@{string(value)}`                                      |                               |
| `(int)value`                    | `@{int(value)}`                                         |                               |
| `Convert.ToBase64String(bytes)` | `@{base64(value)}`                                      |                               |
| `Convert.FromBase64String(str)` | `@{base64ToBinary(value)}` / `@{base64ToString(value)}` |                               |
| `Encoding.UTF8.GetBytes(str)`   | `@{base64(value)}`                                      | Encode string to base64 bytes |
| `XmlDocument.LoadXml(str)`      | `@{xml(value)}`                                         | Parse string to XML           |
| `JsonConvert.Serialize(obj)`    | `@{json(value)}` / already JSON                         |                               |
| `Guid.NewGuid()`                | `@{guid()}`                                             |                               |

#### Collection / Array Operations

| BizTalk XLANG/s         | Logic Apps WDL                                       | Notes                          |
| ----------------------- | ---------------------------------------------------- | ------------------------------ |
| `list.Count`            | `@{length(variables('list'))}`                       |                                |
| `list[0]`               | `@{first(variables('list'))}`                        | Or `variables('list')[0]`      |
| `list[list.Count - 1]`  | `@{last(variables('list'))}`                         |                                |
| `list.Contains(item)`   | `@{contains(variables('list'), item)}`               |                                |
| `Array.Sort(list)`      | `@{sort(variables('list'))}`                         |                                |
| `list.Distinct()`       | `@{union(variables('list'), variables('list'))}`     | Union with itself deduplicates |
| `array1.Concat(array2)` | `@{union(variables('array1'), variables('array2'))}` |                                |
| `new [] { a, b, c }`    | `@{createArray(a, b, c)}`                            |                                |

### Context Properties & Promoted Properties

BizTalk uses **message context properties** (promoted and written) extensively for content-based routing, correlation, and tracking.

| BizTalk Concept                                        | Logic Apps Equivalent                                  | Notes                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Promoted properties** (routing)                      | Trigger outputs / headers / tracked properties         | Use `triggerOutputs()?['headers']` or tracked properties for visibility. |
| **Distinguished fields** (orchestration access)        | Direct body path access: `triggerBody()?['field']`     | JSON path navigation replaces distinguished fields.                      |
| **Context property read** (`msg(BTS.ReceivePortName)`) | `triggerOutputs()?['headers']['x-ms-workflow-name']`   | Some system properties available in trigger metadata.                    |
| **Context property write** (promote)                   | `Set Variable` + Tracked Properties / response headers | No direct equivalent. Use variables or tracked properties.               |
| **Message type** (`BTS.MessageType`)                   | Content-Type header / schema name in XML actions       | Not directly equivalent.                                                 |
| **Correlation tokens**                                 | `correlationId` / Service Bus `SessionId`              | Use tracked `clientTrackingId` or SB sessions.                           |
| **Retry count** (`BTS.RetryCount`)                     | `actions('actionName')?['retryHistory']`               | Retry history available on each action.                                  |
| **Receive location** (`BTS.InboundTransportLocation`)  | `triggerOutputs()?['headers']` / workflow name         | Metadata available from trigger outputs.                                 |

---

## BizTalk Custom Code → Logic Apps Custom Code

BizTalk heavily relies on custom .NET code: helper classes called from orchestrations, custom pipeline components, custom adapters, custom functoids, and .NET expressions. Logic Apps Standard provides **native custom code support** through local functions.

### Custom Code Options in Logic Apps Standard

| Option                                  | Description                                                                                                                             | Runs                               | Best For                                                                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C# Inline Code Action**               | Execute C# script code directly within the workflow using the "Execute CSharp Script Code" action. No separate function project needed. | In-process (same App Service Plan) | Complex BizTalk expressions that can't be done in WDL: multi-line logic, regex, loops, try/catch, string parsing, type conversions. **Primary replacement for complex XLANG/s expressions.** |
| **Custom Code Action (Local Function)** | Write C#/.NET code as a local function within the Logic App project. Invoked as a workflow action.                                      | In-process (same App Service Plan) | Replacing BizTalk helper classes, custom pipeline components, heavy-duty transforms, encryption, external SDK calls.                                                                         |
| **Inline Code Action (JavaScript)**     | Execute inline JavaScript snippets directly in the workflow.                                                                            | In-process                         | Simple transformations, string manipulation, quick calculations.                                                                                                                             |
| **Powershell Inline Code Action**               | Execute Powershell script code directly within the workflow using the "Execute Powershell Code" action. No separate function project needed. | In-process (same App Service Plan) | **Primary replacement for third party Powershell adapters.** |
| **Workflow Expression Functions**       | Built-in WDL function library (300+ functions).                                                                                         | Inline (no action needed)          | String ops, math, date/time, collection ops, type conversion.                                                                                                                                |
| **XSLT with Inline Scripts**            | XSLT maps with embedded `<msxsl:script>` blocks (C# or VB).                                                                             | In-process                         | Complex map logic that needs procedural code within a transform.                                                                                                                             |
| **NuGet Package References**            | Reference NuGet packages in the Logic App project for use in local functions.                                                           | In-process                         | Reusing existing .NET libraries (encryption, parsing, SDKs).                                                                                                                                 |

### Custom Code Migration Matrix

| #   | BizTalk Custom Code Type                        | Logic Apps Equivalent                     | Migration Approach                                                                                                                                                      |
| --- | ----------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Helper class called from orchestration**      | Custom Code action (local function)       | Move the .NET helper class into the Logic App project as a local function. Call it via the "Call a local function" action.                                              |
| 2   | **Custom pipeline component**                   | Custom Code action (local function)       | Extract the `Execute()` logic into a local function. Wire it as an action in the workflow where the pipeline ran.                                                       |
| 3   | **Custom adapter**                              | Custom Code action + HTTP trigger         | For receive: use HTTP Request trigger + local function for protocol handling. For send: use local function + HTTP action. Complex protocols may need a sidecar service. |
| 4   | **Custom functoid**                             | Custom Code action / XSLT inline script   | Move functoid logic to a local function or embed in XSLT `<msxsl:script>`.                                                                                              |
| 5   | **XLANG/s expression (simple)**                 | WDL expression                            | Convert C# expressions to `@{...}` WDL syntax (see conversion table above).                                                                                             |
| 6   | **XLANG/s expression (complex / multi-line)**   | C# Inline Code action                     | Multi-line C# logic, loops, try/catch, regex — use the "Execute CSharp Script Code" action. Runs C# directly in the workflow without needing a separate local function. |
| 7   | **.NET class library (shared)**                 | NuGet package or project reference        | Package existing class library as NuGet or add as project reference in the Logic App project.                                                                           |
| 8   | **Custom BAM activity**                         | Application Insights + tracked properties | Use `trackedProperties` on actions + Application Insights custom events via local function.                                                                             |
| 9   | **Custom exception handler**                    | Scope + `runAfter` + local function       | Use scope-level error handling. Complex error processing goes in a local function.                                                                                      |
| 10  | **Regex / complex string parsing**              | C# Inline Code action                     | WDL has no native regex. Use `System.Text.RegularExpressions` in a C# inline code action. For simple cases, this is lighter than a full local function.                 |
| 11  | **Cryptography (encrypt/decrypt/sign)**         | Custom Code action (local function)       | Use `System.Security.Cryptography` in a local function. For Key Vault operations, use the Key Vault connector.                                                          |
| 12  | **XML DOM manipulation**                        | Custom Code action (local function)       | Use `System.Xml.Linq` in a local function for complex XML operations beyond what XSLT handles.                                                                          |
| 13  | **External SDK calls** (e.g., third-party APIs) | Custom Code action + NuGet reference      | Reference the SDK NuGet package in the project, call it from a local function.                                                                                          |

### Local Function (Custom Code Action) Details

The **Custom Code action** ("Call a local function in this logic app") is the primary mechanism for running .NET code natively inside Logic Apps Standard.

#### Structure

```
LogicApp/
├── workflow.json              ← Workflow definitions
├── host.json                  ← Host configuration
├── local.settings.json        ← Local dev settings
└── <FunctionName>/
    └── function.json          ← Function binding
    └── run.csx                ← C# script (or .cs compiled)
```

Or in a compiled (.NET) project:

```
LogicApp/
├── WorkflowProject.csproj     ← Project file with NuGet refs
├── Workflows/
│   └── myworkflow/
│       └── workflow.json
└── Functions/
    └── MyHelper.cs            ← Custom code class
```

#### Capabilities

| Capability                                             | Supported                                          |
| ------------------------------------------------------ | -------------------------------------------------- |
| Full .NET runtime                                      | Yes (same runtime as the Logic App)                |
| NuGet packages                                         | Yes (via `.csproj` references)                     |
| Access to `HttpRequestMessage` / `HttpResponseMessage` | Yes                                                |
| Async/await                                            | Yes                                                |
| Dependency injection                                   | Yes (via `Startup.cs`)                             |
| Logging (ILogger)                                      | Yes (logs appear in Application Insights)          |
| Access environment variables                           | Yes (`Environment.GetEnvironmentVariable()`)       |
| Access Key Vault secrets                               | Yes (via managed identity + SDK or connector)      |
| Maximum execution time                                 | 5 minutes (configurable)                           |
| Runs in-process                                        | Yes (same App Service Plan, no cold start penalty) |

#### Example: BizTalk Helper Class → Local Function

**BizTalk (helper called from orchestration):**

```csharp
// BizTalk helper class
public class MessageHelper
{
    public static string ExtractOrderId(XmlDocument doc)
    {
        var node = doc.SelectSingleNode("//OrderId");
        return node?.InnerText ?? "UNKNOWN";
    }
}

// Called from XLANG/s expression:
orderId = MessageHelper.ExtractOrderId(orderMsg);
```

**Logic Apps Standard (local function):**

```csharp
// Functions/MessageHelper.cs
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Xml.Linq;

public class MessageHelper
{
    [Function("ExtractOrderId")]
    public IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequest req)
    {
        var doc = XDocument.Load(req.Body);
        var orderId = doc.Descendants("OrderId").FirstOrDefault()?.Value ?? "UNKNOWN";
        return new OkObjectResult(new { orderId });
    }
}
```

**Workflow action (calling the local function):**

```json
{
    "ExtractOrderId": {
        "type": "InvokeFunction",
        "inputs": {
            "functionName": "ExtractOrderId",
            "parameters": {
                "body": "@triggerBody()"
            }
        }
    }
}
```

---

## Engine & Platform Feature Mappings

| Scope          | Meaning                        | Connectors                                                                                                                                                                                                                                                                    |
| -------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Any**        | Works on-premises and in Azure | File System, FTP, SFTP, SQL Server, HTTP, SMTP, AS2, X12, EDIFACT, MLLP, SAP, SAP ERP, SAP OData, IBM MQ, IBM Db2, IBM CICS, IBM IMS, IBM Host File, IBM Informix, Oracle Database, RabbitMQ, Confluent Kafka, SWIFT, HL7, Rules Engine, XML Operations, Flat File Operations |
| **Cloud Only** | Requires Azure connectivity    | Azure Service Bus, Azure Blob Storage, Azure Table Storage, Azure Event Hub, Azure Cosmos DB, Azure Key Vault                                                                                                                                                                 |

---

## Connection Type Reference

| Type                                                 | Description                                                                      | Count                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Service Provider** (`/serviceProviders/...`)       | Built-in, runs in-process. Lower latency, no gateway needed for cloud resources. | 25                                                        |
| **Connection Provider** (`/connectionProviders/...`) | Referenced by ServiceProviderId but uses a different hosting model.              | 1 (SAP OData)                                             |
| **API Connection** (`IsApiConnection: true`)         | Managed connector hosted by Azure. Requires API connection resource.             | 1 (IBM Informix)                                          |
| **None** (no ServiceProviderId, not API connection)  | Inline operations, no connection infrastructure.                                 | 5 (AS2, SWIFT, HL7, Rules Engine, XML Ops, Flat File Ops) |

---

## Quick Lookup: BizTalk Adapter → Logic Apps Connector

Alphabetical index for fast reference:

| BizTalk Adapter                     | Logic Apps Connector |
| ----------------------------------- | -------------------- |
| AS2                                 | AS2                  |
| AzureBlob / AzureBlobStorage        | Azure Blob Storage   |
| AzureEventHub / EventHub            | Azure Event Hub      |
| AzureTable / AzureTableStorage      | Azure Table Storage  |
| BAPI / SAPERP / SapErp              | SAP ERP              |
| HostApps (CICS)                     | IBM CICS             |
| CosmosDb / CosmosDB / AzureCosmosDB | Azure Cosmos DB      |
| DB2 / Db2                           | IBM Db2              |
| EDIFACT                             | EDIFACT              |
| ExchangeOnlineEmail                 | SMTP                 |
| FILE / FileSystem                   | File System          |
| FTP / Ftp                           | FTP                  |
| GmailEmail                          | SMTP                 |
| HL7 (transport)                     | MLLP (HL7)           |
| HostFiles                           | IBM Host File        |
| HTTP / Http                         | HTTP                 |
| HostApps (IMS)                      | IBM IMS              |
| Informix                            | IBM Informix         |
| Kafka / ConfluentKafka              | Confluent Kafka      |
| KeyVault / AzureKeyVault            | Azure Key Vault      |
| MLLP / Mllp                         | MLLP (HL7)           |
| MQ / IbmMq / MQSeries               | IBM MQ               |
| MSMQ / NetMsmq                      | Azure Service Bus/RabbitMQ    |
| ODP.NET / OracleDb / OracleDatabase | Oracle Database      |
| OutlookEmail                        | SMTP                 |
| SAP / WCF-SAP                       | SAP                  |
| SB / ServiceBus                     | Azure Service Bus    |
| SFTP / Sftp                         | SFTP                 |
| SMTP / Smtp                         | SMTP                 |
| SOAP                                | HTTP                 |
| SQL / Sql                           | SQL Server           |
| SWIFT                               | SWIFT                |
| VSAM / Vsam                         | IBM Host File        |
| WCF-BasicHttp                       | HTTP                 |
| WCF-Custom                          | HTTP                 |
| WCF-CustomIsolated                  | HTTP                 |
| WCF-NetTcp                          | HTTP                 |
| WCF-SQL                             | SQL Server           |
| WCF-WSHttp                          | HTTP                 |
| X12                                 | X12                  |

### Additional Adapters (Not in Registry)

| BizTalk Adapter             | Logic Apps Equivalent                    |
| --------------------------- | ---------------------------------------- |
| JD Edwards EnterpriseOne    | HTTP + JDE REST APIs                     |
| JD Edwards OneWorld         | HTTP + JDE REST APIs                     |
| Oracle E-Business Suite     | Oracle Database (partial) + HTTP         |
| PeopleSoft Enterprise       | HTTP + PeopleSoft REST APIs              |
| POP3                        | Office 365 Outlook / Gmail (managed API) |
| Siebel                      | HTTP + Siebel REST APIs                  |
| TIBCO EMS                   | Azure Service Bus / RabbitMQ             |
| TIBCO Rendezvous            | — (no equivalent)                        |
| WCF-NetNamedPipe            | — (no equivalent)                        |
| Windows SharePoint Services | SharePoint (managed API)                 |

### Pipeline Components

| BizTalk Pipeline Component     | Logic Apps Equivalent                           |
| ------------------------------ | ----------------------------------------------- |
| Flat File Assembler            | Flat File Operations → `FlatFileEncoding`       |
| Flat File Disassembler         | Flat File Operations → `FlatFileDecoding`       |
| JSON Decoder                   | Built-in (`json()` expression)                  |
| JSON Encoder                   | Built-in (native JSON)                          |
| MIME/SMIME Decoder             | Custom Code — local function                    |
| MIME/SMIME Encoder             | Custom Code — local function                    |
| Party Resolution               | Integration Account partners                    |
| Property Promotion/Demotion    | Expressions / Variables / Tracked Properties    |
| XML Assembler                  | XML Operations → `XmlCompose`                   |
| XML Disassembler               | XML Operations → `XmlParse`                     |
| XML Validator                  | XML Operations → `XmlValidation`                |
| XSLT Transform (Map)           | XML Operations → `Xslt`                         |
| Message Compression (zip/gzip) | `extractArchive` / Custom Code — local function |

### Orchestration Shapes

| BizTalk Shape            | Logic Apps Equivalent                  |
| ------------------------ | -------------------------------------- |
| Atomic Transaction       | Compensation/retry patterns            |
| Call Orchestration       | Invoke nested workflow                 |
| Compensation             | `Scope` + `runAfter` (Failed)          |
| Construct Message        | `Compose` action                       |
| Correlation Set          | `correlationId` / Service Bus sessions |
| Decide                   | `Condition` / `Switch`                 |
| Delay                    | `Delay` / `Delay Until`                |
| Expression               | Inline expressions                     |
| For Each                 | `For Each` action                      |
| Listen                   | Multiple triggers / Condition          |
| Long-Running Transaction | `Scope` + error handling               |
| Loop                     | `Until` action                         |
| Message Assignment       | `Compose` / `Set Variable`             |
| Parallel Actions         | `Parallel Branch`                      |
| Receive                  | Trigger                                |
| Role Link                | — (no equivalent)                      |
| Scope                    | `Scope` action                         |
| Send                     | Connector action                       |
| Start Orchestration      | HTTP POST to workflow trigger          |
| Suspend                  | `Terminate` (Cancelled)                |
| Terminate                | `Terminate` action                     |
| Throw Exception          | `Terminate` (Failed)                   |
| Transform                | XML Operations → `Xslt`                |

### Engine & Platform Features

| BizTalk Feature            | Logic Apps Equivalent                     |
| -------------------------- | ----------------------------------------- |
| Aggregation                | `For Each` + `Append to Array`            |
| BAM                        | Application Insights / Azure Monitor      |
| BizTalk Admin Console      | Azure Portal / VS Code                    |
| BizTalk Mapper (Functoids) | Data Mapper / XSLT / expressions          |
| Binding Files              | `connections.json` + `parameters.json`    |
| Content-Based Routing      | `Condition` / `Switch`                    |
| Debatching                 | `SplitOn` on trigger                      |
| Dynamic Send Port          | HTTP action with dynamic URI              |
| Host / Host Instances      | App Service Plan / Workflow App           |
| Liquid Templates           | Liquid template action                    |
| Message Enrichment         | Inline actions + `Compose`                |
| MessageBox (Pub/Sub)       | Trigger + Condition / Service Bus topics  |
| Ordered Delivery           | Service Bus sessions / `concurrency: 1`   |
| Parallel Convoy            | Stateful workflow + correlation           |
| Retry / Resubmit           | Built-in retry policies + portal resubmit |
| Scatter-Gather             | `Parallel Branch` + join                  |
| Sequential Convoy          | Stateful workflow + Service Bus sessions  |
| SSO                        | Azure Key Vault + Managed Identity        |
| Tracking / HAT             | Run History + Tracked Properties          |

---

## Coverage Summary

| Category                 | In Registry            | Additional (Not in Registry)              | Total Mapped      |
| ------------------------ | ---------------------- | ----------------------------------------- | ----------------- |
| **Adapters**             | 29 connector mappings  | 10 additional adapters                    | 39                |
| **Pipeline Components**  | 4 (XML Ops, Flat File) | 7 (MIME, JSON, Party, Props, Compression) | 11                |
| **Accelerators**         | 2 (HL7, SWIFT)         | —                                         | 2                 |
| **Orchestration Shapes** | —                      | 22 shapes                                 | 22                |
| **Engine Features**      | 1 (Rules Engine)       | 18 features                               | 19                |
| **Mapper / Transforms**  | 1 (Xslt action)        | 11 (Functoids, Data Mapper, Liquid)       | 12                |
| **Expressions**          | —                      | 50+ expression conversions                | 50+               |
| **Custom Code**          | —                      | 13 custom code migration paths            | 13                |
|                          |                        | **Grand Total**                           | **170+ mappings** |

---

_Last updated: March 2026_
_Source: [connector-registry.json](https://github.com/haroldcampos/BizTalkMigrationStarter/blob/main/ODXtoWFMigrator/Schemas/Connectors/connector-registry.json)_
