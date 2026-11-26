---
name: source-to-logic-apps-mapping
description: Authoritative reference mapping every Dell Boomi AtomSphere component — connectors, shapes, process constructs, Maps and functions, Trading Partner / X12 / EDIFACT / AS2 B2B features, scripts, and platform features — to its Azure Logic Apps Standard equivalent, including service provider IDs and operation names.
---

# Dell Boomi AtomSphere to Azure Logic Apps Standard — Component Migration Reference

> **Purpose**: Look up the exact Logic Apps Standard equivalent for every Dell Boomi component before planning or generating workflows. Copy `serviceProviderConfiguration` and `operationId` values from reference workflows; use this document to choose the right connector and operation.

## Table of Contents

- Overview
- Connector Mappings
- B2B / EDI (Trading Partners, X12, EDIFACT, AS2)
- Connectors Not Mapped (Gaps)
- Shape Mappings
- Process Construct Mappings
- Boomi Maps → Logic Apps Transformations
- Process & Document Properties
- Custom Code Migration
- Platform Feature Mappings
- Quick Lookup
- Coverage Summary

---

## Overview

Azure Logic Apps Standard provides built-in **service provider connectors** that run in-process within the runtime, replacing Boomi connectors, shapes and Atom features. Boomi processes are **document-oriented**: each shape runs once per document in the current document set. Logic Apps workflows are **message-oriented**: one trigger payload per run, with explicit loops. Every mapping below must preserve the per-document behaviour.

### Key Concepts

| Concept              | Dell Boomi AtomSphere                                          | Logic Apps Standard                                                         |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Unit of deployment   | Process (+ referenced components) deployed to an Atom/Molecule | Workflow (`workflow.json`) in a Logic App Standard app                      |
| Transport            | Connector shape = Connection + Operation                       | Service provider connection + action/trigger                                |
| Data in flight       | Document set (0..n documents)                                  | Trigger body; arrays via `splitOn` / `For_each`                             |
| Routing              | Decision / Route / Branch / Business Rules                     | Condition / Switch / sequential Scopes                                      |
| Sub-process          | Process Call / Process Route                                   | Child workflow via `Workflow` (InvokeWorkflow) action                       |
| Data transform       | Map component (+ functions, scripting)                         | Transform XML (XSLT) / Liquid / Data Mapper / .NET local function           |
| Structure definition | Profile (XML, JSON, Flat File, Database, EDI)                  | XSD / JSON schema / Flat file schema / X12 schema                           |
| Error handling       | Try/Catch, Exception, Stop, error sub-processes                | Scope + Run After (Failed/TimedOut), Terminate                              |
| B2B                  | Trading Partner components, EDI profiles, AS2                  | Integration Account partners, agreements, schemas + X12/EDIFACT/AS2 actions |
| Lookups              | Cross Reference Tables, Document Cache                         | Integration Account / app settings JSON / Table Storage / SQL               |
| Configuration        | Environment extensions, process properties                     | `parameters.json`, app settings, Key Vault references                       |
| Scheduling           | Process schedules on the Atom                                  | Recurrence trigger                                                          |

### When to Use Integration Account

Use an Integration Account when the Boomi project uses **Trading Partner** components, **X12/EDIFACT** profiles, **AS2** communication, control-number management, functional acknowledgments (997/999/CONTRL), or duplicate interchange detection.

Do NOT choose Integration Account for ordinary XML/JSON mapping if Logic App artifact folders (`Artifacts/Maps`, `Artifacts/Schemas`) and built-in actions are sufficient.

If Integration Account is chosen:

- use it consistently for the flow's deployable artifacts (schemas, maps, partners, agreements, certificates); do not split artifacts between Integration Account and Logic App artifact folders
- plan the app settings `WORKFLOWS_INTEGRATION_ACCOUNT_ID` and `WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL`
- deploy the Integration Account first, then set those settings to the deployed resource ID (`/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.Logic/integrationAccounts/{name}`) and the real callback URL
- plan a separate follow-on task to upload partners, agreements, schemas and maps

---

## Connector Mappings

### File & Storage

#### File System

|                      | Dell Boomi | Logic Apps Standard            |
| -------------------- | -------------------------- | ------------------------------ |
| **Connector**        | Disk connector (Get / Send) | **File System** |
| **Service Provider** | —                          | `/serviceProviders/fileSystem` |
| **Deployment Scope** | —                          | Any (on-premises + cloud)      |
| **Category**         | —                          | Storage                        |

> **Migration Note:** Boomi Disk connector Get (polling start shape) → File System trigger. Disk Send → `createFile`. Disk Get inside a process (not start) → `getFileContent` / `listFolder`. Preserve file filter, sort and delete-after-read options.

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

|                      | Dell Boomi | Logic Apps Standard     |
| -------------------- | ------------------------ | ----------------------- |
| **Connector**        | FTP connector | **FTP** |
| **Service Provider** | —                        | `/serviceProviders/ftp` |
| **Deployment Scope** | —                        | Any                     |
| **Category**         | —                        | Storage                 |

> **Migration Note:** Boomi FTP Get (start shape) → FTP trigger; FTP Send → `createFile`. Map "Delete after read" only when the source sets it.

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

|                      | Dell Boomi | Logic Apps Standard      |
| -------------------- | -------------------------- | ------------------------ |
| **Connector**        | SFTP connector | **SFTP** |
| **Service Provider** | —                          | `/serviceProviders/sftp` |
| **Deployment Scope** | —                          | Any                      |
| **Category**         | —                          | Storage                  |

> **Migration Note:** Boomi SFTP Get (start shape) → SFTP trigger; SFTP Send → `createFile`/`uploadFileContent`. Trading partner SFTP communication channels also map here.

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

|                      | Dell Boomi | Logic Apps Standard            |
| -------------------- | ---------------------------------------- | ------------------------------ |
| **Connector**        | JMS / AMQP / Atom Queue / Event Streams connector | **Azure Service Bus** |
| **Service Provider** | —                                        | `/serviceProviders/serviceBus` |
| **Deployment Scope** | —                                        | Cloud Only                     |
| **Category**         | —                                        | Messaging                      |

> **Migration Note:** Boomi JMS, Atom Queue (`queue`/`topic`) and event-driven start shapes (e.g. "ReceiveInvoiceEvent") map to Service Bus. Listen → trigger; Send → `sendMessage`. Atom Queue dead-letter handling → Service Bus dead-letter queue.

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

|                      | Dell Boomi | Logic Apps Standard          |
| -------------------- | -------------------------- | ---------------------------- |
| **Connector**        | AMQP connector (RabbitMQ) | **RabbitMQ** |
| **Service Provider** | —                          | `/serviceProviders/rabbitmq` |
| **Deployment Scope** | —                          | Any                          |
| **Category**         | —                          | Messaging                    |

> **Migration Note:** Boomi AMQP connector targeting RabbitMQ maps to the RabbitMQ connector.

| Type    | Operation                             | Description                      |
| ------- | ------------------------------------- | -------------------------------- |
| Trigger | `receiveRabbitMQMessages` _(default)_ | Receive messages (Push)          |
| Action  | `sendRabbitMQMessage` _(default)_     | Send a message                   |
| Action  | `createQueue`                         | Create a queue                   |
| Action  | `completeMessage`                     | Complete (acknowledge) a message |

**Connection Parameters:** `HostName` (required), `UserName` (required), `Password` (required), `Port` (optional), `VirtualHost` (optional)

---

#### Confluent Kafka

|                      | Dell Boomi | Logic Apps Standard                |
| -------------------- | ---------------------------- | ---------------------------------- |
| **Connector**        | Kafka connector | **Confluent Kafka** |
| **Service Provider** | —                            | `/serviceProviders/confluentKafka` |
| **Deployment Scope** | —                            | Any                                |
| **Category**         | —                            | Messaging                          |

> **Migration Note:** Boomi Kafka connector maps directly to the Confluent Kafka connector.

| Type    | Operation                    | Description             |
| ------- | ---------------------------- | ----------------------- |
| Trigger | `ReceiveMessage` _(default)_ | Receive messages (Push) |
| Action  | `SendMessage` _(default)_    | Send a message to topic |

**Connection Parameters:** `BootstrapServers` (required), `AuthenticationMode` (required), `Protocol` (required), `UserName` (optional), `Password` (optional)

---

### Database

#### SQL Server

|                      | Dell Boomi | Logic Apps Standard     |
| -------------------- | ---------------------------- | ----------------------- |
| **Connector**        | Database connector / Database V2 connector | **SQL Server** |
| **Service Provider** | —                            | `/serviceProviders/sql` |
| **Deployment Scope** | —                            | Any                     |
| **Category**         | —                            | Database                |

> **Migration Note:** Boomi Database Get (Database profile with SELECT) → `executeQuery`. Database Send with INSERT/UPDATE/UPSERT/stored procedure statements → `executeQuery`, `insertRow`, `updateRows` or `executeStoredProcedure`. Map the Database profile's SQL and parameters exactly. Choose Oracle/PostgreSQL/DB2 connectors when the JDBC driver indicates them.

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

|                      | Dell Boomi | Logic Apps Standard      |
| -------------------- | ----------------------------------------- | ------------------------ |
| **Connector**        | HTTP Client, Web Services Server, Web Services SOAP Client, REST Client | **HTTP** |
| **Service Provider** | —                                         | `/serviceProviders/http` |
| **Deployment Scope** | —                                         | Any                      |
| **Category**         | —                                         | Integration              |

> **Migration Note:** Web Services Server / HTTP listener start shape → HTTP Request trigger (with `Response` action when the process returns documents). HTTP Client / REST Client operation → HTTP action (`invokeHttp`). SOAP Client → HTTP action with XML body and SOAPAction header.

| Type    | Operation                | Description                             |
| ------- | ------------------------ | --------------------------------------- |
| Trigger | `manual` _(default)_     | HTTP Request trigger (webhook/callback) |
| Action  | `invokeHttp` _(default)_ | Make an HTTP request                    |

**Connection Parameters:** None required (inline configuration)

---

### Email

#### SMTP

|                      | Dell Boomi | Logic Apps Standard      |
| -------------------- | ----------------------- | ------------------------ |
| **Connector**        | Mail connector (Send) | **SMTP** |
| **Service Provider** | —                       | `/serviceProviders/Smtp` |
| **Deployment Scope** | —                       | Any                      |
| **Category**         | —                       | Email                    |

> **Migration Note:** Boomi Mail Send → SMTP `sendEmail`. Mail Get (IMAP/POP3) has no SMTP trigger — use the Office 365 Outlook connector or a polling pattern.

| Type   | Operation               | Description   |
| ------ | ----------------------- | ------------- |
| Action | `sendEmail` _(default)_ | Send an email |

**Connection Parameters:** `Server` (required), `Port` (required), `UserName` (required), `Password` (required), `EnableSSL` (optional)

---

### ERP (SAP)

#### SAP

|                      | Dell Boomi | Logic Apps Standard     |
| -------------------- | ---------------------------- | ----------------------- |
| **Connector**        | SAP connector / SAP JCo connector | **SAP** |
| **Service Provider** | —                            | `/serviceProviders/sap` |
| **Deployment Scope** | —                            | Any (via data gateway)  |
| **Category**         | —                            | ERP                     |

> **Migration Note:** Boomi SAP BAPI/RFC operations → SAP `callRfc`; IDoc send → `sendIdoc`; IDoc listener → `receiveIdoc`. Requires the on-premises data gateway.

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


---

#### Azure Blob Storage

|                      | Dell Boomi                                                              | Logic Apps Standard           |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| **Connector**        | Amazon S3 / Azure Blob / object storage connector, archive targets      | **Azure Blob Storage**        |
| **Service Provider** | —                                                                       | `/serviceProviders/AzureBlob` |
| **Deployment Scope** | —                                                                       | Cloud Only                    |
| **Category**         | —                                                                       | Storage                       |

> **Migration Note:** Archive shapes, dead-letter persistence and object-storage connections (e.g. `DeadLetterStorage`) map to Blob `uploadBlob`. Preserve the container/path naming pattern from the source (often built from document properties such as ISA13 or the order number). Verify operation names with `migration_searchReferenceWorkflows` before use.

| Type    | Operation                    | Description                |
| ------- | ---------------------------- | -------------------------- |
| Trigger | `whenABlobIsAddedOrModified` | Poll for new/updated blobs |
| Action  | `uploadBlob` _(default)_     | Upload blob content        |
| Action  | `readBlob`                   | Read blob content          |
| Action  | `deleteBlob`                 | Delete a blob              |
| Action  | `listBlobs`                  | List blobs in a container  |

**Connection Parameters:** `connectionString` (required) or managed identity

---

## B2B / EDI (Trading Partners, X12, EDIFACT, AS2)

Boomi B2B processes combine Trading Partner components (identifiers, standards, communication channels), EDI profiles, and the Trading Partner shape (TP Receive / TP Send). In Logic Apps Standard these become **Integration Account** artifacts plus built-in B2B actions.

| Boomi B2B element                                 | Logic Apps Standard equivalent                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Trading Partner component (My Company / partner)  | Integration Account **Partner** (business identities: ISA qualifier + ID, GS ID)                        |
| Trading Partner document standards + settings     | Integration Account **Agreement** (X12/EDIFACT receive & send settings)                                 |
| X12 / EDIFACT profile                             | Integration Account **Schema** (XSD for the transaction set and version, e.g. 004010 850)               |
| TP Receive / Start shape (Trading Partner)        | HTTP Request trigger (AS2) or SFTP/FTP trigger → `AS2Decode` (if AS2) → `X12Decode`                     |
| TP Send shape                                     | `X12Encode` (or `EDIFACTEncode`) → `AS2Encode` + HTTP POST, or SFTP `createFile`                        |
| Envelope validation / control-number checks       | Agreement validation settings + `X12Decode` outputs (good/bad messages)                                 |
| Interchange / group / transaction control numbers | Agreement control-number settings (Integration Account maintains counters)                              |
| Duplicate interchange check                       | Agreement "check for duplicate ISA13" setting, or an explicit idempotency store (Table Storage / SQL)   |
| 997 / 999 functional acknowledgment generation    | Agreement "generate functional acknowledgment" + decode-generated acks → `X12Encode`/send               |
| 855 / 856 / 810 outbound documents                | Transform (Integration Account map) → `X12Encode` → partner channel                                     |
| AS2 communication (MDN, signing, encryption)      | `AS2Decode`/`AS2Encode` + Integration Account certificates and AS2 agreement                            |
| SFTP/FTP partner communication                    | SFTP/FTP connector actions with partner-specific folders                                                |
| Combined documents for TP Send                    | `X12BatchEncode` or a batch workflow                                                                    |

#### AS2

|                      | Dell Boomi                                      | Logic Apps Standard                        |
| -------------------- | ----------------------------------------------- | ------------------------------------------ |
| **Connector**        | AS2 Client / AS2 Shared Server, TP AS2 channel  | **AS2 (v2)**                               |
| **Service Provider** | —                                               | — (built-in; requires Integration Account) |
| **Category**         | —                                               | B2B                                        |

| Type   | Operation               | Description           |
| ------ | ----------------------- | --------------------- |
| Action | `AS2Encode` _(default)_ | Encode an AS2 message |
| Action | `AS2Decode`             | Decode an AS2 message |

> **MDNs:** a synchronous MDN uses the same HTTP response (`Response` action returning the decode output MDN); an asynchronous MDN uses a separate HTTP POST to the partner's receipt URL. Preserve the partner's MDN mode from the source.

#### X12

|                      | Dell Boomi             | Logic Apps Standard     |
| -------------------- | ---------------------- | ----------------------- |
| **Connector**        | X12 profile + TP shape | **X12**                 |
| **Service Provider** | —                      | `/serviceProviders/x12` |
| **Category**         | —                      | B2B                     |

| Type   | Operation               | Description               |
| ------ | ----------------------- | ------------------------- |
| Action | `X12Decode` _(default)_ | Decode an X12 message     |
| Action | `X12Encode`             | Encode an X12 message     |
| Action | `X12BatchEncode`        | Batch-encode X12 messages |

> **⚠️ OUTPUT FORMAT**: `X12Decode` returns **JSON** (not XML). If downstream processing expects XML, add an `XmlCompose` action (Source: IntegrationAccount, Schema: transaction-set schema) after decode.

#### EDIFACT

|                      | Dell Boomi                 | Logic Apps Standard         |
| -------------------- | -------------------------- | --------------------------- |
| **Connector**        | EDIFACT profile + TP shape | **EDIFACT**                 |
| **Service Provider** | —                          | `/serviceProviders/edifact` |
| **Category**         | —                          | B2B                         |

Use the EDIFACT decode/encode/batch-encode actions with the same rules as X12. CONTRL acknowledgments are generated by agreement settings.

---

## Connectors Not Mapped (Gaps)

| Dell Boomi Connector / Feature  | Gap Reason                          | Recommended Alternative                                           |
| ------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| Salesforce connector            | No built-in service provider        | Salesforce managed API connector or HTTP + REST API               |
| NetSuite / Workday connectors   | No built-in service provider        | HTTP + REST/SOAP API (or managed connector where available)       |
| Atom Queue                      | Boomi runtime-hosted queue          | Azure Service Bus                                                 |
| Document Cache (Add/Retrieve)   | In-process per-execution cache      | Variables / Compose (small), Table Storage or Redis (large)       |
| Persisted process properties    | Atom-stored state across executions | Azure Table Storage / Blob / SQL                                  |
| Boomi Master Data Hub           | Boomi platform service              | Azure SQL / Cosmos DB + custom APIs                               |
| Boomi API Management            | Boomi API governance                | Azure API Management                                              |
| Connector SDK custom connectors | Custom Java connector               | .NET local function or custom built-in connector                  |
| HL7 / RosettaNet profiles       | No built-in Logic Apps decoder      | Integration Account flat-file / XML schemas + .NET local function |

---

## Shape Mappings

### Core Shapes

| Boomi Shape                                         | Logic Apps Equivalent                                                  | Notes                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Start (connector listener)                          | Connector trigger (HTTP Request, SFTP, Service Bus, …)                  | Use `splitOn` when the trigger returns an array          |
| Start (No Data)                                     | Recurrence trigger (scheduled) or `manual` HTTP trigger (sub-process)  | Sub-processes are invoked by the `Workflow` action       |
| Start (Data Passthrough)                            | HTTP Request trigger of a child workflow                               | Receives the caller's documents                          |
| Start (Trading Partner)                             | HTTP (AS2) / SFTP trigger + `AS2Decode` + `X12Decode`                  | See the B2B section                                      |
| Connector (Get / Query)                             | Connector action (`executeQuery`, `getFileContent`, `invokeHttp` GET)  | Loop over returned documents when needed                 |
| Connector (Send / Upsert)                           | Connector action (`insertRow`, `createFile`, `invokeHttp`, `sendMessage`) | Runs once per document → `For_each` when multiple     |
| Map                                                 | Transform XML (Xslt) / Liquid / Data Mapper / .NET                     | See the Maps section                                     |
| Set Properties                                      | Initialize / Set Variable / Compose                                    | Document properties → per-item Compose inside a loop     |
| Message                                             | Compose (string interpolation)                                         | Preserve the exact template text                         |
| Notify                                              | Compose with tracked properties / Application Insights                 | Preserve level and message; NOT an email                 |
| Data Process (Custom Scripting)                     | .NET local function                                                    | Port Groovy/JavaScript logic; never stub                 |
| Data Process (Split / Combine / Search-Replace / Base64 / Zip) | `For_each` / `join()` / `replace()` / `base64()` / built-ins | Choose the matching expression or action                 |
| Program Command                                     | .NET local function or SQL stored procedure                            | Preserve command semantics                               |
| Add to Cache / Retrieve from Cache                  | Variables (small) or Table Storage                                     | Keyed lookups                                            |
| Cleanse                                             | Parse JSON / XML Validation + Condition                                | Reject invalid documents to the error path               |

### Control Flow Shapes

| Boomi Shape                    | Logic Apps Equivalent                                         | Notes                                                                  |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Decision                       | Condition (`If`)                                              | true/false paths; compare the same element or property                 |
| Route                          | Switch                                                        | One case per route key; default case for the "Default" route           |
| Branch                         | Sequential Scopes (`runAfter` chained)                        | Boomi branches run in order 1..n — NOT parallel                        |
| Business Rules                 | Condition / Switch, or .NET local function                    | Preserve each rule and its accept/reject outcome                       |
| Process Call                   | `Workflow` action (InvokeWorkflow)                            | `wait=false` → fire-and-forget                                         |
| Process Route                  | Switch + `Workflow` actions                                   | One child workflow per route                                           |
| Flow Control                   | `For_each` with concurrency / `splitOn`                       | "Run each document individually" → `For_each` (sequential if required) |
| Try/Catch                      | Scope (try) + Scope with `runAfter` Failed/TimedOut (catch)   | Retry count → action retry policy                                      |
| Exception                      | Terminate (Failed) with the same message                      | Error codes become `runError.code`                                     |
| Stop                           | Terminate (Succeeded) or end of branch                        | "Continue = false" stops the whole run                                 |
| Return Documents               | `Response` action                                             | Child workflows and Web Services Server processes                      |
| Error sub-process (dead letter) | Catch scope → `Workflow` action                              | Dead letter → Service Bus DLQ or Blob                                  |

---

## Process Construct Mappings

| Boomi Construct                                        | Logic Apps Equivalent                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Process (listener / scheduled)                         | Stateful workflow with the corresponding trigger                                |
| Sub-process (No Data / Passthrough start)              | Stateful child workflow with a `manual` HTTP Request trigger                    |
| Process option: low latency                            | Stateless workflow (only when no run history is needed)                         |
| Process option: allow simultaneous executions = false  | Trigger concurrency `runtimeConfiguration.concurrency.runs = 1`                 |
| Process schedule                                       | Recurrence trigger (same frequency and time zone)                               |
| Environment extensions                                 | `parameters.json` + app settings + Key Vault references                         |
| Atom logs / process reporting                          | Run history + Application Insights                                              |

---

## Boomi Maps → Logic Apps Transformations

| Boomi Map feature                          | Logic Apps target                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Direct element links (XML → XML)           | XSLT map (Transform XML) or Data Mapper                                                            |
| JSON ↔ JSON / XML ↔ JSON                   | Liquid template (`JsonToJson`, `XmlToJson`) or Data Mapper                                         |
| EDI profile source/target                  | `X12Decode` → XSLT/Liquid on the decoded schema; for EDI targets, XSLT then `X12Encode`            |
| Standard functions (string, date, numeric) | XSLT/Liquid filters or workflow expressions                                                        |
| Default values                             | XSLT/Liquid defaults                                                                               |
| Cross Reference Lookup function            | Lookup table passed as a transform parameter, app settings JSON, Table Storage or a SQL lookup     |
| Document Cache lookup                      | Pre-fetch into a variable and pass to the transform                                                |
| SQL lookup / connector call in a map       | Separate connector action before the transform                                                     |
| Sequential Value / Get Document Property   | Workflow expression passed as a transform parameter                                                |
| Scripting function (Groovy/JavaScript)     | .NET local function                                                                                |
| User-defined function with branching       | .NET local function or XSLT template                                                               |
| Map validations (required fields)          | XML Validation / Parse JSON schema + Condition                                                     |

Store converted maps under `Artifacts/Maps` (or in the Integration Account when it is used) and flag every map conversion for review.

---

## Process & Document Properties

| Boomi Property Type                                      | Logic Apps Equivalent                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| Process Property component                               | Workflow parameter (`parameters.json`)                           |
| Dynamic Process Property                                 | Variable (`Initialize Variable` / `Set Variable`)                |
| Dynamic Document Property                                | Per-item Compose inside `For_each`, or a property of the item    |
| Persisted process property                               | Table Storage / Blob / SQL read + write                          |
| Execution properties (execution ID, process name)        | `workflow().run.name`, `workflow().name`                         |
| Connector document properties (file name, HTTP headers)  | Trigger outputs (`triggerOutputs()?['headers']`, file metadata)  |
| `${SECRET}` placeholders in connections                  | App settings with Key Vault references                           |

---

## Custom Code Migration

### Custom Code Options in Logic Apps Standard

| Option                   | When to Use                                             | Deployment                  |
| ------------------------ | ------------------------------------------------------- | --------------------------- |
| .NET Local Function      | Groovy/JavaScript scripts, Map scripting, complex rules | In-process with Logic Apps  |
| Azure Function           | External HTTP services, long-running operations         | Separate Azure Function app |
| Inline Code (JavaScript) | Simple string/JSON manipulation that is NOT source code | Inline in workflow.json     |

### Custom Code Migration Matrix

| Dell Boomi Source                       | Logic Apps Target                                | Notes                                       |
| --------------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| Groovy Data Process script              | .NET local function                              | Port to C#; read/write the same properties  |
| JavaScript Data Process script          | .NET local function                              | Port to C#                                  |
| Map scripting function                  | .NET local function                              | Call before/after the transform             |
| Custom Library JAR                      | .NET local function                              | Port the used classes (decompile if needed) |
| Connector SDK custom connector          | .NET local function or custom built-in connector | Depends on protocol                         |
| Business Rules with scripted conditions | .NET local function                              | Preserve rule order and outcomes            |

`dataContext.getStream(i)` / `dataContext.storeStream(...)` loops become a function that accepts the document (or an array of documents) and returns the transformed result. `ExecutionUtil.getDynamicProcessProperty` / `setDynamicProcessProperty` become function inputs/outputs bound to workflow variables.

---

## Platform Feature Mappings

| Dell Boomi Feature                 | Logic Apps Standard Equivalent                   | Notes                                    |
| ---------------------------------- | ------------------------------------------------ | ---------------------------------------- |
| AtomSphere platform (build/manage) | Azure Portal + VS Code Logic Apps extension      | Design, deployment, monitoring           |
| Atom / Molecule / Atom Cloud       | Logic Apps Standard (App Service / ASE / hybrid) | Hosting and scaling                      |
| Environments + Extensions          | Per-environment app settings / parameters        | `parameters.json` + deployment pipeline  |
| Packaged components / deployments  | Zip deploy / CI/CD pipeline                      | Version via source control               |
| Process Reporting / execution logs | Run history + Application Insights               | Tracked properties for business IDs      |
| Atom Queues                        | Azure Service Bus                                | Queues/topics, DLQ                       |
| Shared Web Server                  | HTTP Request trigger + API Management            | Authentication via APIM / Easy Auth      |
| Boomi API Management               | Azure API Management                             | Policies, rate limiting                  |
| Certificates (Settings)            | Key Vault / Integration Account certificates     | AS2 signing/encryption certificates      |
| Boomi Flow / Hub / Event Streams   | Power Apps / SQL / Event Hubs or Service Bus     | Case by case                             |

---

## Deployment Scope Reference

| Scope      | Description                                      | Examples                                    |
| ---------- | ------------------------------------------------ | ------------------------------------------- |
| Any        | Runs anywhere — on-premises via hybrid, or cloud | File System, SFTP, FTP, SQL, HTTP, SAP, X12 |
| Cloud Only | Requires Azure cloud resources                   | Service Bus, Event Hub, Cosmos DB, Blob     |

## Connection Type Reference

| Connection Type  | Format in connections.json          | Notes                           |
| ---------------- | ----------------------------------- | ------------------------------- |
| Service Provider | `serviceProviderConnections.{name}` | Built-in, runs in-process       |
| Managed API      | `managedApiConnections.{name}`      | Azure-hosted connector instance |

---

## Quick Lookup

| Dell Boomi Component / Shape        | Logic Apps Connector / Action        | Service Provider ID                |
| ----------------------------------- | ------------------------------------ | ---------------------------------- |
| Web Services Server / HTTP listener | HTTP Request trigger + Response      | (built-in trigger)                 |
| HTTP Client / REST Client           | HTTP (`invokeHttp`)                  | `/serviceProviders/http`           |
| Web Services SOAP Client            | HTTP (SOAP over HTTP)                | `/serviceProviders/http`           |
| Disk                                | File System                          | `/serviceProviders/fileSystem`     |
| FTP                                 | FTP                                  | `/serviceProviders/ftp`            |
| SFTP                                | SFTP                                 | `/serviceProviders/sftp`           |
| Database (SQL Server)               | SQL Server                           | `/serviceProviders/sql`            |
| Database (Oracle)                   | Oracle Database                      | `/serviceProviders/oracledb`       |
| Database (PostgreSQL)               | PostgreSQL                           | `/serviceProviders/postgresql`     |
| JMS / Atom Queue / event start      | Azure Service Bus                    | `/serviceProviders/serviceBus`     |
| AMQP (RabbitMQ)                     | RabbitMQ                             | `/serviceProviders/rabbitmq`       |
| Kafka                               | Confluent Kafka                      | `/serviceProviders/confluentKafka` |
| Object storage / archive            | Azure Blob Storage                   | `/serviceProviders/AzureBlob`      |
| Mail (Send)                         | SMTP                                 | `/serviceProviders/Smtp`           |
| SAP                                 | SAP                                  | `/serviceProviders/sap`            |
| AS2                                 | AS2 (v2) `AS2Decode` / `AS2Encode`   | (built-in, Integration Account)    |
| X12 profile / TP shape              | X12 `X12Decode` / `X12Encode`        | `/serviceProviders/x12`            |
| EDIFACT profile / TP shape          | EDIFACT                              | `/serviceProviders/edifact`        |
| Map                                 | Transform XML / Liquid / Data Mapper | (built-in action)                  |
| Decision                            | Condition                            | (built-in action)                  |
| Route / Process Route               | Switch                               | (built-in action)                  |
| Branch                              | Sequential Scopes                    | (built-in action)                  |
| Flow Control                        | For Each / splitOn                   | (built-in action)                  |
| Try/Catch                           | Scope + Run After                    | (built-in action)                  |
| Process Call                        | Workflow (InvokeWorkflow)            | (built-in action)                  |
| Set Properties                      | Set Variable                         | (built-in action)                  |
| Message                             | Compose                              | (built-in action)                  |
| Notify                              | Compose (tracked properties)         | (built-in action)                  |
| Exception                           | Terminate (Failed)                   | (built-in action)                  |
| Stop                                | Terminate (Succeeded)                | (built-in action)                  |
| Return Documents                    | Response                             | (built-in action)                  |
| Data Process (scripting)            | .NET local function                  | (local function)                   |
| Cross Reference Table               | Lookup (app settings / Table / SQL / IA) | depends on target              |
| Process schedule                    | Recurrence trigger                   | (built-in trigger)                 |

---

## Coverage Summary

| Category                  | Boomi Components Covered                | Logic Apps Equivalents        | Gaps                     |
| ------------------------- | --------------------------------------- | ----------------------------- | ------------------------ |
| File & Storage Connectors | Disk, FTP, SFTP, object storage         | File System, FTP, SFTP, Blob  | 0                        |
| Messaging                 | JMS, Atom Queue, AMQP, Kafka, events    | Service Bus, RabbitMQ, Kafka  | 0                        |
| Database                  | Database / Database V2 (multi-engine)   | SQL, Oracle, PostgreSQL, …    | 0                        |
| HTTP / Web Services       | WSS, HTTP Client, REST, SOAP            | HTTP trigger/action           | 0                        |
| B2B                       | Trading Partners, X12, EDIFACT, AS2     | Integration Account + actions | HL7/RosettaNet           |
| Shapes                    | ~25 shapes                              | Built-in actions + patterns   | Document Cache (pattern) |
| Maps                      | Links, functions, lookups, scripting    | XSLT/Liquid/Data Mapper/.NET  | review required          |
| Custom code               | Groovy, JavaScript, Custom Library, SDK | .NET local functions          | 0                        |
