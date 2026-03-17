# SAP

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sap/

Connect to SAP to send or receive messages and invoke actions.

This article describes the operations for the SAP built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the SAP managed connector operations instead, see [SAP managed connector reference](https://learn.microsoft.com/en-us/connectors/sap/).

By default, SAP built-in connector operations are stateless, but you can [enable stateful mode for these operations](https://learn.microsoft.com/en-us/azure/connectors/enable-stateful-affinity-built-in-connectors).

---

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

---

## Connector how-to guide

For more information about connecting to SAP from your workflow in Azure Logic Apps, see [Connect to SAP from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/sap).

---

## Authentication

### Client

The SAP client ID to connect to the SAP system.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Client | The SAP client ID to connect to the SAP system. | int | True | |

### Authentication Type

Authentication type to connect to the SAP System.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Authentication Type | Authentication type to connect to the SAP System. | string | True | Basic, Snc |

### SAP Username

The username to be used for log in to the SAP System.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SAP Username | The username to be used for log in to the SAP System. | string | True | |

### SAP Password

The password to be used for log in to the SAP System.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SAP Password | The password to be used for log in to the SAP System. | securestring | True | |

### SNC My Name

Identity to be used for this particular destination/server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SNC My Name | Identity to be used for this particular destination/server. | string | False | |

### SNC Partner Name

The backend's SNC Name.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SNC Partner Name | The backend's SNC Name. | string | False | |

### SNC Quality of Protection

Quality of Service to be used for SNC communication of this particular destination/server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SNC Quality of Protection | Quality of Service to be used for SNC communication of this particular destination/server. | string | True | Default, Authentication, Integrity, Privacy, Maximum |

### SNC Type

Type of SNC authentication to use.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SNC Type | Type of SNC authentication to use. | string | True | On, Off |

### Certificate user

Specifies which user to connect when a certificate is assigned to multiple users.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Certificate user | Specifies which user to connect when a certificate is assigned to multiple users. | string | False | |

### SNC Username

Username for SNC authentication.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SNC Username | Username for SNC authentication. | string | False | |

### SNC Password

Password for SNC authentication.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SNC Password | Password for SNC authentication. | securestring | False | |

### SNC Certificate

Base64 encoded X.509 certificate.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SNC Certificate | Base64 encoded X.509 certificate. | string | False | |

### Logon Type

The type of logon to the SAP System.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Logon Type | The type of logon to the SAP System. | string | True | ApplicationServer, MessageServer |

### Server Host (Application Server)

The hostname of the SAP Application Server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Server Host | The hostname of the SAP Application Server. | string | True | |

### Service

The service name or port number of the SAP Application Server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Service | The service name or port number of the SAP Application Server. | string | False | |

### System Number

The SAP System's System Number. It is a number ranging from 00 to 99.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| System Number | The SAP System's System Number. It is a number ranging from 00 to 99. | int | True | |

### Server Host (Message Server)

The hostname of the SAP Message Server aka R3 System Name.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Server Host | The hostname of the SAP Message Server aka R3 System Name. | string | True | |

### Service Name or Port Number

The service name or port number of the Message Server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Service Name or Port Number | The service name or port number of the Message Server. | string | False | |

### System ID

The System ID of the SAP system.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| System ID | The System ID of the SAP system. | string | False | |

### Logon Group

The Logon Group for the SAP System.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Logon Group | The Logon Group for the SAP System. | string | False | |

### Language

The language for the SAP connection.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Language | The language for the SAP connection. | string | False | AA, AF, AK, SQ, AM, AR, HY, AS, AZ, BM, BN, BA, EU, BE, BS, BR, BG, MY, CA, CU, ZH, KW, CO, HR, CS, DA, DV, NL, DZ, EN, EO, ET, EE, FO, FI, FR, FY, FF, GL, LG, KA, DE, EL, KL, GN, GU, HA, HE, HI, HU, IS, IG, ID, IA, IU, GA, IT, JA, KN, KS, KM, KI, RW, SW, KO, KY, LO, LV, LN, LT, LU, LB, MK, MG, MS, ML, MT, GV, MI, MR, MN, NE, ND, NO, NB, NN, OC, OR, OM, OS, PS, FA, PL, PT, PA, QU, RO, RM, RN, RU, SM, SG, SA, SC, GD, SR, SN, SD, SI, SK, SL, SO, ST, ES, SU, SW, SS, SV, TL, TG, TA, TT, TE, TH, BO, TI, TO, TS, TN, TR, TK, TW, UK, UR, UG, UZ, VE, VI, VO, WA, CY, WO, XH, YI, YO, ZA, ZU |

---

## Actions

| Action | Description |
|--------|-------------|
| [BAPI - RFC] Close stateful session | Closes an existing stateful connection session to the SAP system. |
| [BAPI - RFC] Create stateful session | Creates a stateful connection session to the SAP system. |
| [BAPI] Call method in SAP | Calls the BAPI method on the SAP system. |
| [BAPI] Commit transaction | Commits the BAPI transaction for the given session. |
| [BAPI] Roll back transaction | Rolls back the BAPI transaction for the given session. |
| [IDOC - RFC] Confirm transaction Id | Sends transaction Id confirmation to SAP. |
| [IDoc] Get IDoc list for transaction | Gets the list of IDocs for the transaction identified by either session identifier GUID or transaction identifier (TID). |
| [IDoc] Get IDoc status | Gets the processing status of an IDoc by identifying number. |
| [IDoc] Send document to SAP | Sends IDoc message to SAP. |
| [RFC] Add RFC to transaction | Adds an RFC call to a transaction identified by tId and-or queue name, creating a new transaction if none exists. |
| [RFC] Call function in SAP | Calls an RFC on the SAP system. |
| [RFC] Commit transaction | Commits the RFC transaction for the given session and-or queue. |
| [RFC] Create transaction | Creates a new transaction if none exists, using the provided transaction Id and-or queue name. If the transaction exists, gets the details of the existing transaction. The transaction Id can be provided in either GUID or 24-character string format. |
| [RFC] Get transaction | Gets the details of a transaction identified by transaction Id and-or queue name, creating a new transaction if none exists. The transaction Id can be provided in either GUID or 24-character string format. Both the queue name and the transaction Id must be provided to find an existing qRFC transaction. |
| Generate Schema | Generate XML schemas for the provided SAP action or URI. |
| Read Table in SAP | Read table in SAP. |
| Respond to SAP server | Respond to SAP server |
| Run Diagnostics (Preview) | Allows fetching various troubleshooting data on SAP system. |
| Send exception to SAP server (Preview) | Send exception to SAP server |

### [BAPI - RFC] Close stateful session

- **Operation ID:** closeSession

Closes an existing stateful connection session to the SAP system.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Session Id | sessionId | True | string | The stateful session Id as a string. |

### [BAPI - RFC] Create stateful session

- **Operation ID:** createSession

Creates a stateful connection session to the SAP system.

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Session Id | sessionId | string | Id for the stateful session. |

### [BAPI] Call method in SAP

- **Operation ID:** bapiCallMethod

Calls the BAPI method on the SAP system.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Business Object | businessObject | True | string | The Business object type, such as 'BANKDETAIL'. |
| Method | method | True | string | The method to be called, e.g. 'CREATE', followed by the implementing BAPI method, separated by ':' character. |
| Auto commit | autoCommit | True | string | Automatically commits the BAPI transaction if SAP BAPI response has no error and no warning. Automatically rollback the BAPI transaction if SAP BAPI response has an error. No action is taken if the BAPI response has only warnings. |
| Session Id | sessionId | | string | The optional stateful session Id as a string. If none is provided, the call is made on a stateless connection. |
| Input BAPI parameters (XML) | body | True | string | XML formatted input BAPI parameters to call SAP |
| Safe type | safeType | | string | Enable Safetype, which uses string as safe type. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| XML Response | content | string | XML Response to the BAPI call |
| Auto Commit Response | autoCommitResponse | string | Auto Commit Response is populated when the operation commits or rolls back, i.e. in case auto commit is enabled and BAPI method call is either successful or has error(s). |

### [BAPI] Commit transaction

- **Operation ID:** bapiCommit

Commits the BAPI transaction for the given session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Session Id | sessionId | True | string | The stateful session Id as a string. |
| Wait for synchronous update | wait | True | string | Wait for synchronous updating completion. |
| Close the session | closeSession | True | string | Closes the stateful connection session. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Type | type | string | Message type. |
| Id | id | string | Message Class. |
| Number | number | string | Message Number. |
| Message | message | string | Message Text. |
| Log Number | logNumber | string | Application log: log number. |
| Log Message Number | logMessageNumber | string | Application log: Internal message serial number. |
| Message Variable 1 | messageVariable1 | string | Message first variable. |
| Message Variable 2 | messageVariable2 | string | Message second variable. |
| Message Variable 3 | messageVariable3 | string | Message third variable. |
| Message Variable 4 | messageVariable4 | string | Message fourth variable. |
| Parameter | parameter | string | Parameter Name. |
| Row | row | string | Lines in parameter. |
| Field | field | string | Field in parameter. |
| System | system | string | Logical system from which message originates. |

### [BAPI] Roll back transaction

- **Operation ID:** bapiRollback

Rolls back the BAPI transaction for the given session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Session Id | sessionId | True | string | The stateful session Id as a string. |
| Close the session | closeSession | True | string | Closes the stateful connection session. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Type | type | string | Message type. |
| Id | id | string | Message Class. |
| Number | number | string | Message Number. |
| Message | message | string | Message Text. |
| Log Number | logNumber | string | Application log: log number. |
| Log Message Number | logMessageNumber | string | Application log: Internal message serial number. |
| Message Variable 1 | messageVariable1 | string | Message first variable. |
| Message Variable 2 | messageVariable2 | string | Message second variable. |
| Message Variable 3 | messageVariable3 | string | Message third variable. |
| Message Variable 4 | messageVariable4 | string | Message fourth variable. |
| Parameter | parameter | string | Parameter Name. |
| Row | row | string | Lines in parameter. |
| Field | field | string | Field in parameter. |
| System | system | string | Logical system from which message originates. |

### [IDOC - RFC] Confirm transaction Id

- **Operation ID:** confirmTransactionId

Sends transaction Id confirmation to SAP.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Transaction Id | tId | True | string | The transaction Id formatted as either GUID or 24-character string. |

### [IDoc] Get IDoc list for transaction

- **Operation ID:** getIDocList

Gets the list of IDocs for the transaction identified by either session identifier GUID or transaction identifier (TID).

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Direction | direction | True | string | Whether the IDoc to find was sent or received by SAP. |
| Transaction Id | tId | True | string | The transaction Id formatted as either GUID or 24-character string. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| IDoc numbers | iDocNumbers | string | List of IDoc numbers. |

### [IDoc] Get IDoc status

- **Operation ID:** getIDocStatus

Gets the processing status of an IDoc by identifying number.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| IDoc number | iDocNumber | True | string | The number identifying the IDoc. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| IDoc status code | iDocStatus | string | The processing status code for the IDoc. |

### [IDoc] Send document to SAP

- **Operation ID:** sendIDoc

Sends IDoc message to SAP.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| IDoc format | idocFormat | True | string | The format of the IDoc payload: XML, Flat File or Json. |
| Transaction Id GUID | tId | | string | The optional Transaction Id GUID as a string. If none is provided, a new GUID will be generated. |
| Confirm TID | confirmTid | True | string | Confirm the Transaction Id automatically, 'true' or 'false'. |
| Allow Unreleased Segments | allowUnreleasedSegmentV2 | | string | Allow IDoc unreleased segments , 'true' or 'false'. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| RFC Name | rfcNames | string | The names of the RFCs in the transaction. |
| Transaction Identifier (TID) | tId | string | The Transaction Identifier (TID) formatted as 24-character string. |
| Transaction Id GUID | guid | string | Transaction Id GUID |
| Queue Name | queueName | string | The queue name for qRFC. |

### [RFC] Add RFC to transaction

- **Operation ID:** addRfcToTransaction

Adds an RFC call to a transaction identified by tId and-or queue name, creating a new transaction if none exists.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Input RFC parameters | body | True | string | Input RFC parameters to call SAP. |
| Transaction Id | tId | True | string | The transaction Id formatted as either GUID or 24-character string. |
| Queue Name | queueName | | string | The queue name for qRFC. |
| Auto commit | autoCommit | | string | Automatically commits the RFC transaction if adding the RFC to the transaction has no error. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| RFC Name | rfcNames | string | The names of the RFCs in the transaction. |
| Transaction Identifier (TID) | tId | string | The Transaction Identifier (TID) formatted as 24-character string. |
| Transaction Id GUID | guid | string | Transaction Id GUID |
| Queue Name | queueName | string | The queue name for qRFC. |

### [RFC] Call function in SAP

- **Operation ID:** callRfc

Calls an RFC on the SAP system.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Input Type (In Preview - JSON) | inputBodyType | | string | Input Payload Type for SAP Operation (Currently JSON Input Type is in Preview). |
| RFC Name | rfcName | | string | The RFC name. |
| Session Id | sessionId | | string | The optional stateful session Id as a string. If none is provided, the call is made on a stateless connection. |
| Transaction Id | tId | | string | The transaction Id formatted as either GUID or 24-character string. |
| Queue Name | queueName | | string | The queue name for qRFC. |
| Auto commit | autoCommit | | string | Automatically commits the RFC transaction if adding the RFC to the transaction has no error. |
| Safe type | safeType | | string | Enable Safetype, which uses string as safe type. |
| Output Type (In Preview - JSON) | outputBodyType | | string | Output Payload Type for SAP Operation (Currently JSON Output Type is in Preview). |

#### Returns

- **Output** string

### [RFC] Commit transaction

- **Operation ID:** commitRfcTransaction

Commits the RFC transaction for the given session and-or queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Transaction Id | tId | True | string | The transaction Id formatted as either GUID or 24-character string. |
| Queue Name | queueName | | string | The queue name for qRFC. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| RFC Name | rfcNames | string | The names of the RFCs in the transaction. |
| Transaction Identifier (TID) | tId | string | The Transaction Identifier (TID) formatted as 24-character string. |
| Transaction Id GUID | guid | string | Transaction Id GUID |
| Queue Name | queueName | string | The queue name for qRFC. |

### [RFC] Create transaction

- **Operation ID:** createRfcTransaction

Creates a new transaction if none exists, using the provided transaction Id and-or queue name. If the transaction exists, gets the details of the existing transaction. The transaction Id can be provided in either GUID or 24-character string format.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Transaction Id | tId | True | string | The transaction Id formatted as either GUID or 24-character string. |
| Queue Name | queueName | | string | The queue name for qRFC. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| RFC Name | rfcNames | string | The names of the RFCs in the transaction. |
| Transaction Identifier (TID) | tId | string | The Transaction Identifier (TID) formatted as 24-character string. |
| Transaction Id GUID | guid | string | Transaction Id GUID |
| Queue Name | queueName | string | The queue name for qRFC. |

### [RFC] Get transaction

- **Operation ID:** getRfcTransaction

Gets the details of a transaction identified by transaction Id and-or queue name, creating a new transaction if none exists. The transaction Id can be provided in either GUID or 24-character string format. Both the queue name and the transaction Id must be provided to find an existing qRFC transaction.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Transaction Id | tId | True | string | The transaction Id formatted as either GUID or 24-character string. |
| Queue Name | queueName | | string | The queue name for qRFC. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| RFC Name | rfcNames | string | The names of the RFCs in the transaction. |
| Transaction Identifier (TID) | tId | string | The Transaction Identifier (TID) formatted as 24-character string. |
| Transaction Id GUID | guid | string | Transaction Id GUID |
| Queue Name | queueName | string | The queue name for qRFC. |

### Generate Schema

- **Operation ID:** getSchemaV2

Generate XML schemas for the provided SAP action or URI.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Operation Type | operationType | True | string | Operation Type to Generate Schema. |
| File Name Prefix | fileNamePrefix | | string | File Name Prefix for Generate Schema. |

#### Returns

- **Output** string

### Read Table in SAP

- **Operation ID:** readTable

Read table in SAP.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Table Name | tableName | True | string | Name of the table. |
| Field Names | fieldNames | | string | Field names to pick up from the table. |
| Where filter | whereFilters | | string | Filter to query the table. |
| Start Index | startIndex | | string | Index to read from. |
| Number of Rows | numberOfRowsToRead | | string | Number of rows to read from table. |
| Delimiter | delimiter | | string | The delimiter value to separate the fields. |
| Return Format | returnFormat | | string | The format in which the rows will be returned. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Fields Metadata | fieldsMetadata | string | The metadata of the table fields. |
| Table Rows | tableRows | string | The list of rows from table. |

### Respond to SAP server

- **Operation ID:** respondToSapServer

Respond to SAP server

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Respond to SAP server input body | body | True | string | Respond to SAP server input body |
| Safe type | safeType | | string | Enable Safetype, which uses string as safe type. |

### Run Diagnostics (Preview)

- **Operation ID:** runDiagnostics

Allows fetching various troubleshooting data on SAP system.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Operation Type | operationType | True | string | Troubleshooting operation type. |

#### Returns

- **Output** string

### Send exception to SAP server (Preview)

- **Operation ID:** sendExceptionToSapServer

Send exception to SAP server

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Exception Error Message | SendExceptionToSapServerErrorMessage | True | string | Error message contained in exception sent to the SAP server. |
| Exception Name | SendExceptionToSapServerExceptionName | | string | Exception name declared in the ABAP function module definition. |
| Message Type | SendExceptionToSapServerMessageType | | string | S Success, E Error, W Warning, I Info, A Abort. Defaults to 'E'. |
| Message Class | SendExceptionToSapServerMessageClass | | string | Message class from message maintenance (SE91) or custom. |
| Message Number | SendExceptionToSapServerMessageNumber | | string | Message number must be a numeral text of maximum length 3. |
| Is ABAP Message | SendExceptionToSapServerIsAbapMessage | | string | Indicates whether the exception is an ABAP message (table T100). False by default. |

---

## Triggers

| Trigger | Description |
|---------|-------------|
| When a message is received | When a message is received from SAP. |

### When a message is received

- **Operation ID:** SapTrigger

When a message is received from SAP.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| IDoc format | idocFormat | True | string | The format of the IDoc payload: XML, Flat File or Json. |
| Allowed SNC Partners | SncPartnerNames | | string | Specify the SNC partners that can access the server. Separate each name with the '\|' character. All unlisted partners don't have access. If you omit this parameter, or if the value is an empty string, all partners have access, by default. |
| Degree of Parallelism | DegreeOfParallelism | True | string | SAP RFC Server degree of parallelism. |
| Allow Unreleased Segments | ReceiveIDocsWithUnreleasedSegmentsV2 | | string | Allow IDoc unreleased segments , 'true' or 'false'. |
| Gateway Host | GatewayHost | True | string | SAP RFC server registration gateway host. |
| Gateway Service | GatewayService | True | string | SAP RFC server registration gateway service. |
| Program ID | ProgramId | True | string | SAP RFC server registration program id. |
| Default Release | DefaultIDocRelease | | string | Default release for incoming IDocs. Overrides the value of 'DOCREL' field in the received IDoc Control Record for the purpose of parsing the Data Record segments. |
| Releases assigned to specific IDoc types | ReceivedIDocTypeReleaseMapping | | string | Lists releases to use for specific IDoc types when different from received 'DOCREL' field or default release setting. Syntax: DOCTYPE1=DOCREL1;DOCTYPE2=DOCREL2; Overrides DOCREL. |
| GatewayWithoutWorkProcess | GatewayWithoutWorkProcess | | string | Marks a program registration to gateway without work process. |
| Enable empty node | enableEmptyXmlNode | | boolean | Enable empty nodes in trigger XML output. This parameter is available only when 'IDoc Format' parameter value is 'MicrosoftLobNamespaceXml' or 'SapPlainXml'. |
| Generate Namespace from Control Record | enforceControlRecordNamespace | | boolean | Determines whether to generate the IDoc namespace from Control Record or IDoc IDOCTYPE_READ_COMPLETE Metadata. This parameter is available only when 'IDoc Format' parameter value is 'MicrosoftLobNamespaceXml' |
| Safe type | safeType | | boolean | Enable Safetype, which uses string as safe type. This parameter is available only when 'IDoc Format' parameter value is 'MicrosoftLobNamespaceXml' or 'SapPlainXml'. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| SAP trigger XML content. | content | string | SAP trigger XML content. |
| SAP trigger server context. | rfcServerContext | string | SAP trigger server context. |

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sap/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sap/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sap/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sap/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sap/#triggers)
