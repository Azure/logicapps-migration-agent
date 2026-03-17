<!-- Source: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-salesforce -->

Table of contents 
			
			
				
				Exit editor mode
			
		
	
			
				
					
		
			
				
		
			
				
					
				
			
			
		

		
	 
		
			
		
			
				
			
		
		
			
				
			
			Ask Learn
		
		
			
				
			
			Ask Learn
		
	 
		
			
				
			
			Focus mode
		
	 

			
				
					
						
					
				
				
					
		
			
				
			
			Table of contents
		
	 
		
			
				
			
			Read in English
		
	 
		
			
				
			
			Add
		
	
					
		
			
				
			
			Add to plan
		
	  
		
			
				
			
			Edit
		
	
					
		
		#### Share via
		
					
						
							
						
						Facebook
					

					
						
							
						
						x.com
					

					
						
							
						
						LinkedIn
					
					
						
							
						
						Email
					
			  
	 
		
		
				
					
						
						
						
					
					Copy Markdown
				
		   
				
					
						
					
					Print
				
		  
	
				
			
		
	
			
		
	  
		
		
			
			
				
					

						
							
						
						Note
					

					

						Access to this page requires authorization. You can try [signing in](#) or changing directories.
					

					

						Access to this page requires authorization. You can try changing directories.
					

				
			
		
	
					
					 
		
			
				
					
				
				
					
						Summarize this article for me
					
				
			
			
			
		
	 
					# Salesforce

		![](https://conn-afd-prod-endpoint-bmc9bqahasf3grgk.b01.azurefd.net/releases/v1.0.1795/1.0.1795.4845/salesforce/icon.png)
	
		
The Salesforce Connector provides an API to work with Salesforce objects.

	

This connector is available in the following products and regions:

Service
Class
Regions

**Copilot Studio**
Premium
All [Power Automate regions](https://learn.microsoft.com/en-us/flow/regions-overview) except the following: 
      -   US Government (GCC High) 
      -   China Cloud operated by 21Vianet

**Logic Apps**
Standard
All [Logic Apps regions](https://azure.microsoft.com/global-infrastructure/services/?products=logic-apps&regions=all)

**Power Apps**
Premium
All [Power Apps regions](https://learn.microsoft.com/en-us/powerapps/administrator/regions-overview#what-regions-are-available) except the following: 
      -   US Government (GCC High) 
      -   China Cloud operated by 21Vianet

**Power Automate**
Premium
All [Power Automate regions](https://learn.microsoft.com/en-us/flow/regions-overview) except the following: 
      -   US Government (GCC High) 
      -   China Cloud operated by 21Vianet

Connector Metadata

Publisher
Microsoft

To use this integration, you will need access to a Salesforce account with API access enabled. To see what Salesforce editions have API access, please check [Salesforce article](https://help.salesforce.com/s/articleView?id=000326486&type=1). To make a connection, select **Sign In**. You will be prompted to provide your Salesforce login, follow the remainder of the screens to create a connection. The default API version currently utilized by the connector is v58.0.

You're now ready to start using this integration.

Note

The Salesforce connector is now available in [Microsoft CoPilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/fundamentals-what-is-copilot-studio).

## Known Issues and Limitations

- There is a limit on the number of fields a query to Salesforce can contain. The limit varies depending on the type of the columns, the number of computed columns, etc. When you receive an error "Query is either selecting too many fields or the filter conditions are too complicated" it means that your query exceeds the limit. To avoid this, use "Select Query" advanced option and specify fields that you really need.
- Salesforce session settings can block this integration. Please ensure that setting *"Lock sessions to the IP address from which they originated"* is disabled.
- Salesforce API access should be enabled. To verify access settings, go to profile settings for the current user and search for "API Enabled" checkbox.
- Salesforce trial accounts do not have API access and thus cannot be used.
- Custom fields of type "Picklist (Multi-Select)" are not supported by [Create record](#create-record) and [Update record (V3)](#update-record-(v3)) actions (including their respective deprecated versions).
- Creating a new connection using Salesforce "Custom Domain" sign in is not supported.
- Using nullable fields in `Order By` parameter should be avoided as this may cause runtime error in following operations: [Get records](#get-records), [When a record is created](#when-a-record-is-created), [When a record is created or modified](#when-a-record-is-modified).
- [When a record is modified](#when-a-record-is-modified) trigger can only detect the standard object’s record change, but cannot detect the standard object’s attachment change.
- Following triggers and actions could not function properly on a custom tables without "Id" column: [When a record is created](#when-a-record-is-created), [When a record is created or modified](#when-a-record-is-modified), [Get record](#get-record), [Create record](#create-record), [Update record (V3)](#update-record-(v3)), [Delete record](#delete-record).
- [When a record is created or modified](#when-a-record-is-modified) trigger will return both new and modified items. To check whether a returned item is new or modified, compare its "CreatedDate" and "LastModifiedDate" field values. On new items, these values are expected to be equal. In this regard, both fields are mandatory for the items for which this trigger is applied.
- Complex objects (objects with nested objects, see example below) are not supported by [Create record](#create-record) and [Update record (V3)](#update-record-(v3)) (including their respective deprecated versions). To workaround this limitation, flat object structures should be used.
- [Execute a SOQL query](#execute-a-soql-query) and [Get records](#get-records) actions are based on 'Query' API. Therefore, not all records may be returned due to API limitations (e.g. deleted items).
- If facing any issue with data getting set to default value using [Update record (V3)](#update-record-(v3)), this is due to header "sforce-auto-assign" set to true. To workaround this, it is suggested to use [Send an HTTP request](#send-an-http-request) action and set custom header value as "sforce-auto-assign: false"
The Salesforce connector has special handling for authentication however due to a limitation on the Salesforce backend, tokens will expire if not used for a long amount of time and users might face a "Bad_OAuth_Token/Session expired or invalid" error. Please re-login with your credentials.

- This limitation is now addressed however a new connection must be created for use. The pre-existing connection will still work but the above issue may be faced.

Example of a complex object that is not supported because it has a nested object with MerchandiseExtID__c field:

{
    "Name" : "LineItemCreatedViaExtID",
    "Merchandise__r" :
    {
        "MerchandiseExtID__c" : 123
    }
}

Example of the above complex object rewritten as a flat object that IS supported:

{
    "Name" : "LineItemCreatedViaExtID",
    "MerchandiseExtID__c" : 123
}

## Uploading attachments

Salesforce API supports uploading attachments for the following objects: 'Account', 'Asset', 'Campaign', 'Case', 'Contact', 'Contract', 'Custom objects', 'EmailMessage', 'EmailTemplate', 'Event', 'Lead', 'Opportunity', 'Product2', 'Solution', 'Task'. In order to upload attachment file, please use [Create record](#create-record) action and refer to the [Salesforce documentation page](https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_attachment.htm) about required fields and parameters meaning.

## Power Apps delegable functions and operations for Salesforce

These Power Apps operations, for a given data type, may be delegated to Salesforce for processing (rather than processing locally within Power Apps).

### Top-level functions

 
Delegable

Average
No

Filter
Yes

LookUp
Yes

Max
No

Min
No

Search
Yes

Sort
Yes

SortByColumns
Yes

Sum
No

### Filter and LookUp predicates

 
Salesforce

Not
Yes

IsBlank
No

TrimEnds
No

Len
No

+, -
No

<, <=, =, <>, >, >=
Yes

And (&&), Or (||), Not (!)
Yes

in
Yes

StartsWith
No

## Connector in-depth

For more information about the connector, see the [in-depth section](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-salesforce).

### General Limits

Name
Value

Maximum number of requests being processed by the connector concurrently
50

## Creating a connection

The connector supports the following authentication types:

[Login with Custom Salesforce Login URI](#login-with-custom-salesforce-login-uri)
Login with Custom Salesforce Login URI
US Government (GCC) only
Shareable

[Login with Salesforce Account](#login-with-salesforce-account)
Provide Salesforce Credentials to Login.
All regions
Shareable

[Default [DEPRECATED]](#default-connection)
This option is only for older connections without an explicit authentication type, and is only provided for backward compatibility.
All regions
Not shareable

### Login with Custom Salesforce Login URI

Auth ID: CustomLoginURIAuth

Applicable: US Government (GCC) only

Login with Custom Salesforce Login URI

This is shareable connection. If the power app is shared with another user, connection is shared as well. For more information, please see the [Connectors overview for canvas apps - Power Apps | Microsoft Docs](https://learn.microsoft.com/en-us/powerapps/maker/canvas-apps/connections-list#security-and-types-of-authentication)

Name
Type
Description
Required

Salesforce Login URI
string
[https://custom-domain-or-instance.my.salesforce.com](https://custom-domain-or-instance.my.salesforce.com)
True

Salesforce API Version
string
The Salesforce API Version. For default, leave blank or use v58.0

### Login with Salesforce Account

Auth ID: BasicAuthentication

Applicable: All regions

Provide Salesforce Credentials to Login.

This is shareable connection. If the power app is shared with another user, connection is shared as well. For more information, please see the [Connectors overview for canvas apps - Power Apps | Microsoft Docs](https://learn.microsoft.com/en-us/powerapps/maker/canvas-apps/connections-list#security-and-types-of-authentication)

Name
Type
Description
Required

Login URI (Environment)
string
The Salesforce Login URI. For Production, leave blank or use [https://login.salesforce.com](https://login.salesforce.com)

Salesforce API Version
string
The Salesforce API Version. For default, leave blank or use v58.0

### Default [DEPRECATED]

Applicable: All regions

This option is only for older connections without an explicit authentication type, and is only provided for backward compatibility.

This is not shareable connection. If the power app is shared with another user, another user will be prompted to create new connection explicitly.

Name
Type
Description
Required

Login URI (Environment)
string
The Salesforce Login URI. For Production, leave blank or use [https://login.salesforce.com](https://login.salesforce.com)

Salesforce API Version
string
The Salesforce API Version. For default, leave blank or use v58.0

	## Throttling Limits
	
		
			Name
			Calls
			Renewal Period
		
			
				API calls per connection
				900
				60 seconds
			
	

	## Actions
		
				
					
						[Close or abort a job](#close-or-abort-a-job)
					
					
						
Closes or aborts a job. Use UploadComplete to close a job, or Aborted to abort a job. If you close a job, Salesforce queues the job and uploaded data for processing, and you can’t add any additional job data. If you abort a job, the job does not get queued or processed.

					
				
				
					
						[Create a job (V2)](#create-a-job-(v2))
					
					
						
Creates a job, which represents a bulk operation (and associated data) that is sent to Salesforce for asynchronous processing. Provide job data via an Upload Job Data request.

					
				
				
					
						[Create a job [DEPRECATED]](#create-a-job-[deprecated])
					
					
						
This action has been deprecated. Please use [Create a job (V2)](https://learn.microsoft.com/en-us/connectors/salesforce/#create-a-job-(v2)) instead.

Creates a job, which represents a bulk operation (and associated data) that is sent to Salesforce for asynchronous processing. Provide job data via an Upload Job Data request.

					
				
				
					
						[Create record](#create-record)
					
					
						
This operation creates a record and allows null values.

					
				
				
					
						[Create record [DEPRECATED]](#create-record-[deprecated])
					
					
						
This operation creates a record.

					
				
				
					
						[Delete a job](#delete-a-job)
					
					
						
Deletes a job. To be deleted, a job must have a state of UploadComplete, JobComplete, Aborted, or Failed.

					
				
				
					
						[Delete record](#delete-record)
					
					
						
This operation deletes a record.

					
				
				
					
						[Execute a SOQL query](#execute-a-soql-query)
					
					
						
Execute a SOQL query.

					
				
				
					
						[Execute SOSL search query](#execute-sosl-search-query)
					
					
						
Execute the specified SOSL search qyery

					
				
				
					
						[Get a Record by External ID](#get-a-record-by-external-id)
					
					
						
This operation retrieves a record using an external ID.

					
				
				
					
						[Get Account records from Salesforce](#get-account-records-from-salesforce)
					
					
						
This operation gets Account records from Salesforce.

					
				
				
					
						[Get all jobs](#get-all-jobs)
					
					
						
Get a list of all jobs

					
				
				
					
						[Get Case records from Salesforce](#get-case-records-from-salesforce)
					
					
						
This operation gets Case records from Salesforce.

					
				
				
					
						[Get Contact records from Salesforce](#get-contact-records-from-salesforce)
					
					
						
This operation gets Contact records from Salesforce.

					
				
				
					
						[Get job info](#get-job-info)
					
					
						
Retrieves detailed information about a job.

					
				
				
					
						[Get job results](#get-job-results)
					
					
						
Retrieves a list of records based on the result type for a completed job.

					
				
				
					
						[Get object types](#get-object-types)
					
					
						
This operation lists the available Salesforce object types.

					
				
				
					
						[Get Opportunity records from Salesforce](#get-opportunity-records-from-salesforce)
					
					
						
This operation gets Opportunity records from Salesforce.

					
				
				
					
						[Get Product records from Salesforce](#get-product-records-from-salesforce)
					
					
						
This operation gets Product records from Salesforce.

					
				
				
					
						[Get record](#get-record)
					
					
						
This operation gets a record.

					
				
				
					
						[Get record [DEPRECATED]](#get-record-[deprecated])
					
					
						
This action has been deprecated. Please use [Get record](https://learn.microsoft.com/en-us/connectors/salesforce/#get-record) instead.

This operation gets a record.

					
				
				
					
						[Get records](#get-records)
					
					
						
This operation gets records of a certain Salesforce object type like 'Leads'.

					
				
				
					
						[Get User records from Salesforce](#get-user-records-from-salesforce)
					
					
						
This operation gets User records from Salesforce.

					
				
				
					
						[Insert or Update (Upsert) a Record by External ID (V2)](#insert-or-update-(upsert)-a-record-by-external-id-(v2))
					
					
						
This operation inserts or updates (upserts) a record using an external ID.

					
				
				
					
						[Insert or Update (Upsert) a Record by External ID [DEPRECATED]](#insert-or-update-(upsert)-a-record-by-external-id-[deprecated])
					
					
						
This action has been deprecated. Please use [Insert or Update (Upsert) a Record by External ID (V2)](https://learn.microsoft.com/en-us/connectors/salesforce/#insert-or-update-(upsert)-a-record-by-external-id-(v2)) instead.

This operation inserts or updates (upserts) a record using an external ID.

					
				
				
					
						[MCP server for Salesforce](#mcp-server-for-salesforce)
					
					
						
MCP server for Salesforce

					
				
				
					
						[Send an HTTP request](#send-an-http-request)
					
					
						
Construct a Salesforce REST API request to invoke

					
				
				
					
						[Update record (V3)](#update-record-(v3))
					
					
						
This operation updates a record and allows null values.

					
				
				
					
						[Update record [DEPRECATED]](#update-record-[deprecated])
					
					
						
This action has been deprecated. Please use [Update record (V3)](https://learn.microsoft.com/en-us/connectors/salesforce/#update-record-(v3)) instead.

This operation updates a record and allows null values.

					
				
				
					
						[Update record [DEPRECATED]](#update-record-[deprecated])
					
					
						
This operation updates a record.

					
				
				
					
						[Upload job data](#upload-job-data)
					
					
						
Uploads data for a job using CSV data.

					
				
		
### Close or abort a job
	
		
			Operation ID:
				CloseJob
			
		
	

	
Closes or aborts a job. Use UploadComplete to close a job, or Aborted to abort a job. If you close a job, Salesforce queues the job and uploaded data for processing, and you can’t add any additional job data. If you abort a job, the job does not get queued or processed.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Job ID
			
			jobId
			
					True
			
			
				string
			
			
				
Job ID

			
		
		
			
				state
			
			state
			
					True
			
			
				string
			
			
				
state

			
		
		#### Returns
			
			
				
					Body
					
						[JobInfo](#jobinfo)
					
								
			
### Create a job (V2)
	
		
			Operation ID:
				CreateJobV2
			
		
	

	
Creates a job, which represents a bulk operation (and associated data) that is sent to Salesforce for asynchronous processing. Provide job data via an Upload Job Data request.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Object
			
			object
			
					True
			
			
				string
			
			
				
The object type for the data being processed.

			
		
		
			
				Operation
			
			operation
			
					True
			
			
				string
			
			
				
The processing operation for the job.

			
		
		
			
				Column Delimiter
			
			columnDelimiter
			
			
			
				string
			
			
				
The column delimiter used for CSV job data.

			
		
		
			
				External ID Field Name
			
			externalIdFieldName
			
			
			
				string
			
			
				
The external ID field in the object being updated. Only needed for upsert operations. Field values must also exist in CSV job data.

			
		
		
			
				Line Ending
			
			lineEnding
			
			
			
				string
			
			
				
The line ending used for CSV job data, marking the end of a data row.

			
		
		
			
				Content Type
			
			contentType
			
			
			
				string
			
			
				
The content type for the job.

			
		
		#### Returns
			
Output for 'CreateJobV2' operation

			
				
					Body
					
						[CreateJobResponse](#createjobresponse)
					
								
			
### Create a job [DEPRECATED]
	
		
			Operation ID:
				CreateJob
			
		
	

	
This action has been deprecated. Please use [Create a job (V2)](https://learn.microsoft.com/en-us/connectors/salesforce/#create-a-job-(v2)) instead.

Creates a job, which represents a bulk operation (and associated data) that is sent to Salesforce for asynchronous processing. Provide job data via an Upload Job Data request.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Column Delimiter
			
			columnDelimiter
			
			
			
				string
			
			
				
Column Delimiter

			
		
		
			
				External ID Field Name
			
			externalIdFieldName
			
			
			
				string
			
			
				
External ID Field Name

			
		
		
			
				Line Ending
			
			lineEnding
			
			
			
				string
			
			
				
Line Ending

			
		
		
			
				Object
			
			object
			
					True
			
			
				string
			
			
				
Object

			
		
		
			
				Operation
			
			operation
			
					True
			
			
				string
			
			
				
Operation

			
		
		#### Returns
			
			
				
					Body
					
						[JobInfo](#jobinfo)
					
								
			
### Create record
	
		
			Operation ID:
				PostItem_V2
			
		
	

	
This operation creates a record and allows null values.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
table name

			
		
		
			
				Record
			
			item
			
					True
			
			
				dynamic
			
			
				
Record

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Create record [DEPRECATED]
	
		
			Operation ID:
				PostItem
			
		
	

	
This operation creates a record.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				Record
			
			item
			
					True
			
			
				dynamic
			
			
				
The record to create.

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Delete a job
	
		
			Operation ID:
				DeleteJob
			
		
	

	
Deletes a job. To be deleted, a job must have a state of UploadComplete, JobComplete, Aborted, or Failed.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Job ID
			
			jobId
			
					True
			
			
				string
			
			
				
Job ID

			
		
### Delete record
	
		
			Operation ID:
				DeleteItem
			
		
	

	
This operation deletes a record.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				Record Id
			
			id
			
					True
			
			
				string
			
			
				
The unique identifier of record to delete.

			
		
### Execute a SOQL query
	
		
			Operation ID:
				ExecuteSoqlQuery
			
		
	

	
Execute a SOQL query.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				SOQL Query
			
			query
			
					True
			
			
				string
			
			
				
SOQL Query text. Dynamic parameters can be specified using '@paramName' syntax.

			
		
		
			
				Query parameters
			
			parameters
			
			
			
				object
			
			
				
SOQL Query dynamic parameters. Key is parameter name (without '@' at sign), value is parameter value.

			
		
		#### Returns
			
			
				
					response
					
						[object](#object)
					
								
			
### Execute SOSL search query
	
		
			Operation ID:
				ExecuteSOSLQuery
			
		
	

	
Execute the specified SOSL search qyery

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				SOSL search string
			
			q
			
					True
			
			
				string
			
			
				
SOSL search string

			
		
		#### Returns
			
SOSL search query response

			
				
					Body
					
						[SOSLSearchQueryResponse](#soslsearchqueryresponse)
					
								
			
### Get a Record by External ID
	
		
			Operation ID:
				GetItemByExternalId
			
		
	

	
This operation retrieves a record using an external ID.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				External ID Field
			
			externalIdField
			
					True
			
			
				string
			
			
				
Field marked as external ID field on Salesforce object.

			
		
		
			
				External ID
			
			externalId
			
					True
			
			
				string
			
			
				
External ID of the record to retrieve.

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get Account records from Salesforce
	
		
			Operation ID:
				GetItems_table_account
			
		
	

	
This operation gets Account records from Salesforce.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Top Count
			
			$top
			
			
			
				integer
			
			
				
Total number of entries to retrieve (default = all).

			
		
		
			
				Skip Count
			
			$skip
			
			
			
				integer
			
			
				
The number of entries to skip (default = 0).

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get all jobs
	
		
			Operation ID:
				GetAllJobs
			
		
	

	
Get a list of all jobs

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Concurrency Mode
			
			concurrenyMode
			
			
			
				string
			
			
				
Concurrency Mode

			
		
		
			
				Is PK Chunking Enabled
			
			isPkChunkingEnabled
			
			
			
				boolean
			
			
				
Is PK Chunking Enabled

			
		
		
			
				Job Type
			
			jobType
			
			
			
				string
			
			
				
Job Type

			
		
		
			
				Query Locator
			
			queryLocator
			
			
			
				string
			
			
				
Query Locator

			
		
		#### Returns
			
			
				
					Body
					
						[GetAllJobsResponse](#getalljobsresponse)
					
								
			
### Get Case records from Salesforce
	
		
			Operation ID:
				GetItems_table_case
			
		
	

	
This operation gets Case records from Salesforce.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Top Count
			
			$top
			
			
			
				integer
			
			
				
Total number of entries to retrieve (default = all).

			
		
		
			
				Skip Count
			
			$skip
			
			
			
				integer
			
			
				
The number of entries to skip (default = 0).

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get Contact records from Salesforce
	
		
			Operation ID:
				GetItems_table_contact
			
		
	

	
This operation gets Contact records from Salesforce.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Top Count
			
			$top
			
			
			
				integer
			
			
				
Total number of entries to retrieve (default = all).

			
		
		
			
				Skip Count
			
			$skip
			
			
			
				integer
			
			
				
The number of entries to skip (default = 0).

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get job info
	
		
			Operation ID:
				GetJobInfo
			
		
	

	
Retrieves detailed information about a job.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Job ID
			
			jobId
			
					True
			
			
				string
			
			
				
Job ID

			
		
		#### Returns
			
			
				
					Body
					
						[CheckJobResponse](#checkjobresponse)
					
								
			
### Get job results
	
		
			Operation ID:
				GetJobRecordResults
			
		
	

	
Retrieves a list of records based on the result type for a completed job.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Job ID
			
			jobId
			
					True
			
			
				string
			
			
				
Job ID

			
		
		
			
				Result Type
			
			resultType
			
					True
			
			
				string
			
			
				
Result Type

			
		
		#### Returns
			
			
				
					response
					
						[string](#string)
					
								
			
### Get object types
	
		
			Operation ID:
				GetTables
			
		
	

	
This operation lists the available Salesforce object types.

		#### Returns
			
Represents a list of tables.

			
				
					Body
					
						[TablesList](#tableslist)
					
								
			
### Get Opportunity records from Salesforce
	
		
			Operation ID:
				GetItems_table_opportunity
			
		
	

	
This operation gets Opportunity records from Salesforce.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Top Count
			
			$top
			
			
			
				integer
			
			
				
Total number of entries to retrieve (default = all).

			
		
		
			
				Skip Count
			
			$skip
			
			
			
				integer
			
			
				
The number of entries to skip (default = 0).

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get Product records from Salesforce
	
		
			Operation ID:
				GetItems_table_product2
			
		
	

	
This operation gets Product records from Salesforce.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Top Count
			
			$top
			
			
			
				integer
			
			
				
Total number of entries to retrieve (default = all).

			
		
		
			
				Skip Count
			
			$skip
			
			
			
				integer
			
			
				
The number of entries to skip (default = 0).

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get record
	
		
			Operation ID:
				GetItem_V2
			
		
	

	
This operation gets a record.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
table name

			
		
		
			
				Record Id
			
			id
			
					True
			
			
				string
			
			
				
item key

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get record [DEPRECATED]
	
		
			Operation ID:
				GetItem
			
		
	

	
This action has been deprecated. Please use [Get record](https://learn.microsoft.com/en-us/connectors/salesforce/#get-record) instead.

This operation gets a record.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				table
			
			table
			
					True
			
			
				string
			
			
				
			
		
		
			
				id
			
			id
			
					True
			
			
				string
			
			
				
			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get records
	
		
			Operation ID:
				GetItems
			
		
	

	
This operation gets records of a certain Salesforce object type like 'Leads'.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Top Count
			
			$top
			
			
			
				integer
			
			
				
Total number of entries to retrieve (default = all).

			
		
		
			
				Skip Count
			
			$skip
			
			
			
				integer
			
			
				
The number of entries to skip (default = 0).

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Get User records from Salesforce
	
		
			Operation ID:
				GetItems_table_user
			
		
	

	
This operation gets User records from Salesforce.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Top Count
			
			$top
			
			
			
				integer
			
			
				
Total number of entries to retrieve (default = all).

			
		
		
			
				Skip Count
			
			$skip
			
			
			
				integer
			
			
				
The number of entries to skip (default = 0).

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Insert or Update (Upsert) a Record by External ID (V2)
	
		
			Operation ID:
				PatchItemByExternalIdV2
			
		
	

	
This operation inserts or updates (upserts) a record using an external ID.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				External ID Field
			
			externalIdField
			
					True
			
			
				string
			
			
				
Field marked as external ID field on Salesforce object.

			
		
		
			
				External ID
			
			externalId
			
					True
			
			
				string
			
			
				
External ID of the record to upsert.

			
		
		
			
				Record
			
			item
			
					True
			
			
				dynamic
			
			
				
The record with changed properties.

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Insert or Update (Upsert) a Record by External ID [DEPRECATED]
	
		
			Operation ID:
				PatchItemByExternalId
			
		
	

	
This action has been deprecated. Please use [Insert or Update (Upsert) a Record by External ID (V2)](https://learn.microsoft.com/en-us/connectors/salesforce/#insert-or-update-(upsert)-a-record-by-external-id-(v2)) instead.

This operation inserts or updates (upserts) a record using an external ID.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				External ID Field
			
			externalIdField
			
					True
			
			
				string
			
			
				
Field marked as external ID field on Salesforce object.

			
		
		
			
				External ID
			
			externalId
			
					True
			
			
				string
			
			
				
External ID of the record to upsert.

			
		
		
			
				Record
			
			item
			
					True
			
			
				dynamic
			
			
				
The record with changed properties.

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### MCP server for Salesforce
	
		
			Operation ID:
				mcp_SalesforceManagement
			
		
	

	
MCP server for Salesforce

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				jsonrpc
			
			jsonrpc
			
			
			
				string
			
			
				
			
		
		
			
				id
			
			id
			
			
			
				string
			
			
				
			
		
		
			
				method
			
			method
			
			
			
				string
			
			
				
			
		
		
			
				params
			
			params
			
			
			
				object
			
			
				
			
		
		
			
				result
			
			result
			
			
			
				object
			
			
				
			
		
		
			
				error
			
			error
			
			
			
				object
			
			
				
			
		
		
			
				sessionId
			
			sessionId
			
			
			
				string
			
			
				
			
		
		#### Returns
			
			
				
					Body
					
						[MCPQueryResponse](#mcpqueryresponse)
					
								
			
### Send an HTTP request
	
		
			Operation ID:
				HttpRequest
			
		
	

	
Construct a Salesforce REST API request to invoke

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				URI
			
			Uri
			
					True
			
			
				string
			
			
				
The full or relative URI. Example of relative URI: /services/data/v41.0/sobjects/account

			
		
		
			
				Method
			
			Method
			
					True
			
			
				string
			
			
				
The HTTP method (default is GET).

			
		
		
			
				Body
			
			Body
			
			
			
				binary
			
			
				
The request body content.

			
		
		
			
				Content-Type
			
			ContentType
			
			
			
				string
			
			
				
The content-type header for the body (default is application/json).

			
		
		
			
				CustomHeader1
			
			CustomHeader1
			
			
			
				string
			
			
				
Custom header 1. Specify in format: header-name: header-value

			
		
		
			
				CustomHeader2
			
			CustomHeader2
			
			
			
				string
			
			
				
Custom header 2. Specify in format: header-name: header-value

			
		
		
			
				CustomHeader3
			
			CustomHeader3
			
			
			
				string
			
			
				
Custom header 3. Specify in format: header-name: header-value

			
		
		
			
				CustomHeader4
			
			CustomHeader4
			
			
			
				string
			
			
				
Custom header 4. Specify in format: header-name: header-value

			
		
		
			
				CustomHeader5
			
			CustomHeader5
			
			
			
				string
			
			
				
Custom header 5. Specify in format: header-name: header-value

			
		
		#### Returns
			
			
				
					response
					
						[ObjectWithoutType](#objectwithouttype)
					
								
			
### Update record (V3)
	
		
			Operation ID:
				PatchItem_V3
			
		
	

	
This operation updates a record and allows null values.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
table name

			
		
		
			
				Record Id
			
			id
			
					True
			
			
				string
			
			
				
item key

			
		
		
			
				item to be updated
			
			item
			
					True
			
			
				dynamic
			
			
				
item to be updated

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Update record [DEPRECATED]
	
		
			Operation ID:
				PatchItem_V2
			
		
	

	
This action has been deprecated. Please use [Update record (V3)](https://learn.microsoft.com/en-us/connectors/salesforce/#update-record-(v3)) instead.

This operation updates a record and allows null values.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
table name

			
		
		
			
				Record Id
			
			id
			
					True
			
			
				string
			
			
				
item key

			
		
		
			
				item to be updated
			
			item
			
					True
			
			
				dynamic
			
			
				
item to be updated

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Update record [DEPRECATED]
	
		
			Operation ID:
				PatchItem
			
		
	

	
This operation updates a record.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				Record Id
			
			id
			
					True
			
			
				string
			
			
				
The unique identifier of record to update.

			
		
		
			
				Record
			
			item
			
					True
			
			
				dynamic
			
			
				
The record with changed properties.

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### Upload job data
	
		
			Operation ID:
				UploadJobData
			
		
	

	
Uploads data for a job using CSV data.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Job ID
			
			jobId
			
					True
			
			
				string
			
			
				
Job ID

			
		
		
			
				CSV File Content
			
			body
			
					True
			
			
				binary
			
			
				
CSV Data to upload

			
		

	## Triggers
		
				
					
						[When a record is created](#when-a-record-is-created)
					
					
						
This operation triggers when there are newly created records.

					
				
				
					
						[When a record is modified](#when-a-record-is-modified)
					
					
						
This operation triggers when there are newly modified records.

					
				
		
### When a record is created
	
		
			Operation ID:
				GetOnNewItems
			
		
	

	
This operation triggers when there are newly created records.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			
### When a record is modified
	
		
			Operation ID:
				GetOnUpdatedItems
			
		
	

	
This operation triggers when there are newly modified records.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Salesforce Object Type
			
			table
			
					True
			
			
				string
			
			
				
The Salesforce object type like 'Leads'.

			
		
		
			
				Filter Query
			
			$filter
			
			
			
				string
			
			
				
An ODATA filter query to restrict the entries returned (e.g. stringColumn eq 'string' OR numberColumn lt 123).

			
		
		
			
				Order By
			
			$orderby
			
			
			
				string
			
			
				
An ODATA orderBy query for specifying the order of entries.

			
		
		
			
				Select Query
			
			$select
			
			
			
				string
			
			
				
Specific fields to retrieve from entries (default = all).

			
		
		#### Returns
			
				The outputs of this operation are dynamic.
			

	## Definitions
### CreateJobResponse

	
Output for 'CreateJobV2' operation

	
		Name
		Path
		Type
		Description
	
		
			
				Object
			
			
				object
			
			
				string
			
			
				
The object type for the data being processed.

			
		
		
			
				Operation
			
			
				operation
			
			
				string
			
			
				
The processing operation for the job.

			
		
		
			
				Column Delimiter
			
			
				columnDelimiter
			
			
				string
			
			
				
The column delimiter used for CSV job data.

			
		
		
			
				External ID Field Name
			
			
				externalIdFieldName
			
			
				string
			
			
				
The external ID field in the object being updated. Only needed for upsert operations. Field values must also exist in CSV job data.

			
		
		
			
				Line Ending
			
			
				lineEnding
			
			
				string
			
			
				
The line ending used for CSV job data, marking the end of a data row.

			
		
		
			
				Content Type
			
			
				contentType
			
			
				string
			
			
				
The content type for the job.

			
		
		
			
				API Version
			
			
				apiVersion
			
			
				float
			
			
				
The API version that the job was created in.

			
		
		
			
				Concurrency Mode
			
			
				concurrencyMode
			
			
				string
			
			
				
The concurrency mode for the job.

			
		
		
			
				Content Url
			
			
				contentUrl
			
			
				string
			
			
				
The URL to use for Upload Job Data requests for this job. Only valid if the job is in 'Open' state.

			
		
		
			
				Created By Id
			
			
				createdById
			
			
				string
			
			
				
The ID of the user who created the job.

			
		
		
			
				Created Date
			
			
				createdDate
			
			
				date-time
			
			
				
The date and time in the UTC time zone when the job was created.

			
		
		
			
				Id
			
			
				id
			
			
				string
			
			
				
Unique ID for this job.

			
		
		
			
				Job Type
			
			
				jobType
			
			
				string
			
			
				
The job’s type.

			
		
		
			
				State
			
			
				state
			
			
				string
			
			
				
The current state of processing for the job.

			
		
		
			
				System Modstamp
			
			
				systemModstamp
			
			
				date-time
			
			
				
Date and time in the UTC time zone when the job finished.

			
		

### Table

	
Represents a table.

	
		Name
		Path
		Type
		Description
	
		
			
				Name
			
			
				Name
			
			
				string
			
			
				
The name of the table. The name is used at runtime.

			
		
		
			
				DisplayName
			
			
				DisplayName
			
			
				string
			
			
				
The display name of the table.

			
		
		
			
				DynamicProperties
			
			
				DynamicProperties
			
			
				object
			
			
				
Additional table properties provided by the connector to the clients.

			
		

### TablesList

	
Represents a list of tables.

	
		Name
		Path
		Type
		Description
	
		
			
				value
			
			
				value
			
			
				array of Table
			
			
				
List of Tables

			
		

### GetAllJobsResponse

	

	
		Name
		Path
		Type
		Description
	
		
			
				Done
			
			
				done
			
			
				boolean
			
			
				
Done

			
		
		
			
				records
			
			
				records
			
			
				array of JobInfo
			
			
				
			
		
		
			
				Next Recored URL
			
			
				nextRecordUrl
			
			
				string
			
			
				
Next Record URL

			
		

### JobInfo

	

	
		Name
		Path
		Type
		Description
	
		
			
				API Version
			
			
				apiVersion
			
			
				float
			
			
				
API Version

			
		
		
			
				Column Delimiter
			
			
				columnDelimiter
			
			
				string
			
			
				
Column Delimiter

			
		
		
			
				Concurrency Mode
			
			
				concurrencyMode
			
			
				string
			
			
				
Concurrency Mode

			
		
		
			
				Content Type
			
			
				contentType
			
			
				string
			
			
				
Content Type

			
		
		
			
				Content URL
			
			
				contentUrl
			
			
				string
			
			
				
Content URL

			
		
		
			
				Created By ID
			
			
				createdById
			
			
				string
			
			
				
Created By ID

			
		
		
			
				Created Date
			
			
				createdDate
			
			
				date-time
			
			
				
Created Date

			
		
		
			
				External ID Field Name
			
			
				externalIdFieldName
			
			
				string
			
			
				
External ID Field Name

			
		
		
			
				ID
			
			
				id
			
			
				string
			
			
				
ID

			
		
		
			
				Job Type
			
			
				jobType
			
			
				string
			
			
				
Job Type

			
		
		
			
				Line Ending
			
			
				lineEnding
			
			
				string
			
			
				
Line Ending

			
		
		
			
				Object
			
			
				object
			
			
				string
			
			
				
Object

			
		
		
			
				Operation
			
			
				operation
			
			
				string
			
			
				
Operation

			
		
		
			
				State
			
			
				state
			
			
				string
			
			
				
State

			
		
		
			
				System Mod Stamp
			
			
				systemModstamp
			
			
				date-time
			
			
				
System Mod Stamp

			
		

### CheckJobResponse

	

	
		Name
		Path
		Type
		Description
	
		
			
				APEX Processing Time
			
			
				apexProcessingTime
			
			
				number
			
			
				
APEX Processing Time

			
		
		
			
				API Active Processing Time
			
			
				apiActiveProcessingTime
			
			
				number
			
			
				
API Active Processing Time

			
		
		
			
				API Version
			
			
				apiVersion
			
			
				float
			
			
				
API Version

			
		
		
			
				Column Delimiter
			
			
				columnDelimiter
			
			
				string
			
			
				
Column Delimiter

			
		
		
			
				Concurrency Mode
			
			
				concurrencyMode
			
			
				string
			
			
				
Concurrency Mode

			
		
		
			
				Content Type
			
			
				contentType
			
			
				string
			
			
				
Content Type

			
		
		
			
				Content URL
			
			
				contentUrl
			
			
				string
			
			
				
Content URL

			
		
		
			
				Created By ID
			
			
				createdById
			
			
				string
			
			
				
Created By ID

			
		
		
			
				Created Date
			
			
				createdDate
			
			
				date-time
			
			
				
Created Date

			
		
		
			
				External Field Name
			
			
				externalFieldName
			
			
				string
			
			
				
External Field Name

			
		
		
			
				ID
			
			
				id
			
			
				string
			
			
				
ID

			
		
		
			
				Job Type
			
			
				jobType
			
			
				string
			
			
				
Job Type

			
		
		
			
				Line Ending
			
			
				lineEnding
			
			
				string
			
			
				
Line Ending

			
		
		
			
				Object
			
			
				object
			
			
				string
			
			
				
Object

			
		
		
			
				Operation
			
			
				operation
			
			
				string
			
			
				
Operation

			
		
		
			
				Retries
			
			
				retries
			
			
				number
			
			
				
Retries

			
		
		
			
				State
			
			
				state
			
			
				string
			
			
				
State

			
		
		
			
				systemModStamp
			
			
				systemModStamp
			
			
				date-time
			
			
				
			
		
		
			
				Total Processing Time
			
			
				totalProcessingTime
			
			
				number
			
			
				
Total Processing Time

			
		

### SOSLSearchQueryResponse

	
SOSL search query response

	
		Name
		Path
		Type
		Description
	
		
			
				searchRecords
			
			
				searchRecords
			
			
				array of SearchRecordObject
			
			
				
A list of search records returned by an SOSL search query

			
		

### SearchRecordObject

	
Individual record returned by SOSL query

	
		Name
		Path
		Type
		Description
	
		
			
				type
			
			
				attributes.type
			
			
				string
			
			
				
Type of the record

			
		
		
			
				url
			
			
				attributes.url
			
			
				string
			
			
				
API path that can be used to the retrieve the object

			
		
		
			
				Id
			
			
				Id
			
			
				string
			
			
				
Unique identifier of the record

			
		

### ObjectWithoutType

	
		
		
			
				 
				
					[](#)
				
				
		
### MCPQueryResponse

	

	
		Name
		Path
		Type
		Description
	
		
			
				jsonrpc
			
			
				jsonrpc
			
			
				string
			
			
				
			
		
		
			
				id
			
			
				id
			
			
				string
			
			
				
			
		
		
			
				method
			
			
				method
			
			
				string
			
			
				
			
		
		
			
				params
			
			
				params
			
			
				object
			
			
				
			
		
		
			
				result
			
			
				result
			
			
				object
			
			
				
			
		
		
			
				error
			
			
				error
			
			
				object
			
			
				
			
		

### string

	
This is the basic data type 'string'.

### object

	
This is the type 'object'.