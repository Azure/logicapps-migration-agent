<!-- Source: https://learn.microsoft.com/en-us/connectors/azurequeues/ -->

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
					
				
			
			
			
		
	 
					# Azure Queues

		![](https://conn-afd-prod-endpoint-bmc9bqahasf3grgk.b01.azurefd.net/releases/v1.0.1793/1.0.1793.4565/azurequeues/icon.png)
	
		
Azure Queue storage provides cloud messaging between application components. Queue storage also supports managing asynchronous tasks and building process work flows.

	

This connector is available in the following products and regions:

Service
Class
Regions

**Copilot Studio**
Premium
All [Power Automate regions](https://learn.microsoft.com/en-us/flow/regions-overview)

**Logic Apps**
Standard
All [Logic Apps regions](https://azure.microsoft.com/global-infrastructure/services/?products=logic-apps&regions=all)

**Power Apps**
Premium
All [Power Apps regions](https://learn.microsoft.com/en-us/powerapps/administrator/regions-overview#what-regions-are-available)

**Power Automate**
Premium
All [Power Automate regions](https://learn.microsoft.com/en-us/flow/regions-overview)

Connector Metadata

Publisher
Microsoft

Website
[https://azure.microsoft.com/services/storage/queues/](https://azure.microsoft.com/services/storage/queues/)

To use this integration, you will need access to an Azure storage account. More information can be found [here](https://azure.microsoft.com/en-us/services/storage/queues/).
When trying to make a connection, you will be prompted to provide your storage account name and your storage key. The name of your storage account can be found in the URL, for example if your URL is `https://myaccount.queue.core.windows.net` then the account name would be "myaccount". If you have multiple accounts, provide the one you would like to use and select **Create**. If you see an error during creation, check the account name and the key and try again.
You're now ready to start using this integration.

## Known issues and limitations

- Logic apps can't directly access storage accounts that are behind firewalls if they're both in the same region. As a workaround, you can have your logic apps and storage account in different regions. For more information about enabling access from Azure Logic Apps to storage accounts behind firewalls, see the [Access storage accounts behind firewalls](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-azureblobstorage#access-storage-accounts-behind-firewalls)

## Microsoft Entra ID authentication and Azure Queues connector

In order to use Microsoft Entra ID authentication, the account that is being used needs to be assigned an specific role assignment, for more information, visit [Assign an Azure role for access to blob data - Azure Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/assign-azure-role-data-access?tabs=portal):

> Only roles explicitly defined for data access permit a security principal to access blob or queue data. Built-in roles such as Owner, Contributor, and Storage Account Contributor permit a security principal to manage a storage account, but do not provide access to the blob or queue data within that account via Microsoft Entra ID.

Here is a quick test to verify if an account has the required role to perform operations in a container:
1. Sign-in with that account in the Azure Portal.
2. Navigate to the queue in the storage account and that will be used and click on `Switch to Microsoft Entra ID User Account` in the Authentication method. This option appears just on top of the search box.

If an un-authorized message pops-up, the user needs to be assigned Storage Account specific permissions. To do this, the storage account manager should:
1. Navigate to the queue's `Access Control (IAM)` tab.
2. Click on `Add`
3. Click on `Add role assignment`
4. Assign a specific `Storage Queue` role to the user (for example, `Storage Queue Data Contributor`)

### Known limitations with Microsoft Entra ID authentication

Due to current authentication pipeline limitations, Microsoft Entra ID guest users aren't supported for Microsoft Entra ID connections to Azure Queues. When using Microsoft Entra ID authentication **only V2 actions are supported**. Deprecated actions will continue to work with `Access Key` authentication, but **will fail if used with an Microsoft Entra ID connection**.

## Connect to Azure Queues connector using queue endpoint

Enter the full Azure Storage queue endpoint when creating an "Access Key" connection or using V2 operations.

For "Access Key" authentications, enter the full Azure Storage queue endpoint on `Azure Storage account name or queue endpoint` parameter.

- When using "V2" operations with "Access Key" authentication, the queue endpoint must be provided in the `storageAccountName` parameter as well.

For "V2" operations, enter the full Azure Storage queue endpoint on `storageAccountName` parameter.

You must provide the full endpoint, including the schema, for example:

- `https://account.queue.core.windows.net/`
- `https://account-secondary.queue.core.windows.net/` (if connecting to the secondary endpoint)
- Relative paths (for example, `account.queue.core.windows.net`) will be rejected.

### Get the Azure Storage queue endpoint for a given storage account

There are multiple ways to get this queue endpoint:

Using Azure portal

- On [Microsoft Azure](https://portal.azure.com), navigate to the Azure Storage account you wish to connect
- Under `Settings` section (left blade), click on `Endpoints`
- The queue endpoint will be under **Queue service**, on the `queue service` text box.

Using [Storage Accounts - Get Properties](https://learn.microsoft.com/en-us/rest/api/storagerp/storage-accounts/get-properties?tabs=HTTP) REST API call

- Get the Azure Storage account `subscription Id` and `resource group name`.
- Navigate to [Storage Accounts - Get Properties](https://learn.microsoft.com/en-us/rest/api/storagerp/storage-accounts/get-properties?tabs=HTTP)
- Click on the `Try it` button on the top right corner of the HTTP call
- Sign in (the user should have access to the storage account)
- Choose the Azure tenant the Azure Storage account is located on
- Enter the Azure Storage's account name, resource group name, and select the subscription the storage account is located on.
- Click `Run`
- The queue endpoint will be on `queue` property under `primaryEndpoints` object on the response

## Creating a connection

The connector supports the following authentication types:

[Access Key](#access-key)
Provide Azure Storage account name (or queue endpoint)and Access Key to access your Azure Queue storage.
All regions except Azure Government and Department of Defense (DoD) in Azure Government and US Government (GCC) and US Government (GCC-High)
Shareable

[Access Key (Azure Government)](#access-key-azure-government)
Provide Azure Storage account name (or queue endpoint)and Access Key to access your Azure Queue storage.
Azure Government and Department of Defense (DoD) in Azure Government and US Government (GCC-High) only
Shareable

[Access Key (Azure Government)](#access-key-azure-government)
Provide Azure Storage account name (or queue endpoint)and Access Key to access your Azure Queue storage in Azure Government.
US Government (GCC) only
Shareable

[Client Certificate Auth](#client-certificate-auth)
Provide Microsoft Entra ID credentials using PFX certificate and password
All regions
Shareable

[Logic Apps Managed Identity](#logic-apps-managed-identity)
Create a connection using a LogicApps Managed Identity
LOGICAPPS only
Shareable

[Microsoft Entra ID Integrated](#microsoft-entra-id-integrated)
Use Microsoft Entra ID to access your Azure Queue storage.
All regions except Azure Government and Department of Defense (DoD) in Azure Government and US Government (GCC) and US Government (GCC-High)
Not shareable

[Microsoft Entra ID Integrated (Azure Government)](#microsoft-entra-id-integrated-azure-government)
Use Microsoft Entra ID to access your Azure Queue storage.
Azure Government and Department of Defense (DoD) in Azure Government and US Government (GCC-High) only
Not shareable

[Microsoft Entra ID Integrated (Azure Government)](#microsoft-entra-id-integrated-azure-government)
Use Microsoft Entra ID to access your Azure Queue storage in Azure Government.
US Government (GCC) only
Not shareable

[Default [DEPRECATED]](#default-connection)
This option is only for older connections without an explicit authentication type, and is only provided for backward compatibility.
All regions
Not shareable

### Access Key

Auth ID: keyBasedAuth

Applicable: All regions except Azure Government and Department of Defense (DoD) in Azure Government and US Government (GCC) and US Government (GCC-High)

Provide Azure Storage account name (or queue endpoint)and Access Key to access your Azure Queue storage.

This is shareable connection. If the power app is shared with another user, connection is shared as well. For more information, please see the [Connectors overview for canvas apps - Power Apps | Microsoft Docs](https://learn.microsoft.com/en-us/powerapps/maker/canvas-apps/connections-list#security-and-types-of-authentication)

Name
Type
Description
Required

Azure Storage account name or queue endpoint
string
Name or queue endpoint of the Azure Storage account the connector should use.
True

Azure Storage Account Access Key
securestring
Specify a valid primary/secondary storage account access key.

### Access Key (Azure Government)

Auth ID: keyBasedAuth

Applicable: Azure Government and Department of Defense (DoD) in Azure Government and US Government (GCC-High) only

Provide Azure Storage account name (or queue endpoint)and Access Key to access your Azure Queue storage.

This is shareable connection. If the power app is shared with another user, connection is shared as well. For more information, please see the [Connectors overview for canvas apps - Power Apps | Microsoft Docs](https://learn.microsoft.com/en-us/powerapps/maker/canvas-apps/connections-list#security-and-types-of-authentication)

Name
Type
Description
Required

Azure Storage account name or queue endpoint
string
Name or queue endpoint of the Azure Storage account the connector should use.
True

Azure Storage Account Access Key
securestring
Specify a valid primary/secondary storage account access key.

### Access Key (Azure Government)

Auth ID: keyBasedAuth

Applicable: US Government (GCC) only

Provide Azure Storage account name (or queue endpoint)and Access Key to access your Azure Queue storage in Azure Government.

This is shareable connection. If the power app is shared with another user, connection is shared as well. For more information, please see the [Connectors overview for canvas apps - Power Apps | Microsoft Docs](https://learn.microsoft.com/en-us/powerapps/maker/canvas-apps/connections-list#security-and-types-of-authentication)

Name
Type
Description
Required

Azure Storage account name or queue endpoint
string
Name or queue endpoint of the Azure Storage account the connector should use.
True

Azure Storage Account Access Key
securestring
Specify a valid primary/secondary storage account access key.

### Client Certificate Auth

Auth ID: certOauth

Applicable: All regions

Provide Microsoft Entra ID credentials using PFX certificate and password

This is shareable connection. If the power app is shared with another user, connection is shared as well. For more information, please see the [Connectors overview for canvas apps - Power Apps | Microsoft Docs](https://learn.microsoft.com/en-us/powerapps/maker/canvas-apps/connections-list#security-and-types-of-authentication)

Name
Type
Description
Required

Tenant
string

True

Client ID
string
The client ID of for the Microsoft Entra ID application
True

Client certificate secret
clientCertificate
The client certificate secret allowed by this application
True

Azure Storage account name or queue endpoint
string
The name or queue endpoint of your Azure Storage account
True

### Logic Apps Managed Identity

Auth ID: managedIdentityAuth

Applicable: LOGICAPPS only

Create a connection using a LogicApps Managed Identity

This is shareable connection. If the power app is shared with another user, connection is shared as well. For more information, please see the [Connectors overview for canvas apps - Power Apps | Microsoft Docs](https://learn.microsoft.com/en-us/powerapps/maker/canvas-apps/connections-list#security-and-types-of-authentication)

Name
Type
Description
Required

LogicApps Managed Identity
managedIdentity
Sign in with a Logic Apps Managed Identity
True

### Microsoft Entra ID Integrated

Auth ID: tokenBasedAuth

Applicable: All regions except Azure Government and Department of Defense (DoD) in Azure Government and US Government (GCC) and US Government (GCC-High)

Use Microsoft Entra ID to access your Azure Queue storage.

This is not shareable connection. If the power app is shared with another user, another user will be prompted to create new connection explicitly.

### Microsoft Entra ID Integrated (Azure Government)

Auth ID: tokenBasedAuth

Applicable: Azure Government and Department of Defense (DoD) in Azure Government and US Government (GCC-High) only

Use Microsoft Entra ID to access your Azure Queue storage.

This is not shareable connection. If the power app is shared with another user, another user will be prompted to create new connection explicitly.

### Microsoft Entra ID Integrated (Azure Government)

Auth ID: tokenBasedAuth

Applicable: US Government (GCC) only

Use Microsoft Entra ID to access your Azure Queue storage in Azure Government.

This is not shareable connection. If the power app is shared with another user, another user will be prompted to create new connection explicitly.

### Default [DEPRECATED]

Applicable: All regions

This option is only for older connections without an explicit authentication type, and is only provided for backward compatibility.

This is not shareable connection. If the power app is shared with another user, another user will be prompted to create new connection explicitly.

Name
Type
Description
Required

Azure Storage account name or queue endpoint
string
The name or queue endpoint of your Azure Storage account
True

Shared Storage Key
securestring
The shared storage key of your storage account
True

	## Throttling Limits
	
		
			Name
			Calls
			Renewal Period
		
			
				API calls per connection
				1200
				60 seconds
			
			
				Frequency of trigger polls
				1
				60 seconds
			
	

	## Actions
		
				
					
						[Create a new queue (V2)](#create-a-new-queue-(v2))
					
					
						
Adds a queue to your account.

					
				
				
					
						[Create a new queue [DEPRECATED]](#create-a-new-queue-[deprecated])
					
					
						
This action has been deprecated. Please use [Create a new queue (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#create-a-new-queue-(v2)) instead.

Adds a queue to your account.

					
				
				
					
						[Delete message (V2)](#delete-message-(v2))
					
					
						
Delete a specific message from the queue.

					
				
				
					
						[Delete message [DEPRECATED]](#delete-message-[deprecated])
					
					
						
This action has been deprecated. Please use [Delete message (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#delete-message-(v2)) instead.

Delete a specific message from the queue.

					
				
				
					
						[Get messages (V2)](#get-messages-(v2))
					
					
						
Get a specific set of messages from the queue. The messages will be hidden but remain on the queue until the delete action is used.

					
				
				
					
						[Get messages [DEPRECATED]](#get-messages-[deprecated])
					
					
						
This action has been deprecated. Please use [Get messages (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#get-messages-(v2)) instead.

Get a specific set of messages from the queue. The messages will be hidden but remain on the queue until the delete action is used.

					
				
				
					
						[List queues (V2)](#list-queues-(v2))
					
					
						
List all the queues for your storage account.

					
				
				
					
						[List queues [DEPRECATED]](#list-queues-[deprecated])
					
					
						
This action has been deprecated. Please use [List queues (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#list-queues-(v2)) instead.

List all the queues for your storage account.

					
				
				
					
						[Put a message on a queue (V2)](#put-a-message-on-a-queue-(v2))
					
					
						
Adds a message to the given queue.

					
				
				
					
						[Put a message on a queue [DEPRECATED]](#put-a-message-on-a-queue-[deprecated])
					
					
						
This action has been deprecated. Please use [Put a message on a queue (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#put-a-message-on-a-queue-(v2)) instead.

Adds a message to the given queue.

					
				
		
### Create a new queue (V2)
	
		
			Operation ID:
				PutQueue_V2
			
		
	

	
Adds a queue to your account.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Storage account name or queue endpoint
			
			storageAccountName
			
					True
			
			
				string
			
			
				
Azure Storage account name or queue endpoint.

			
		
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The name of the queue to create.

			
		
		#### Returns
			
			
				
					response
					
						[string](#string)
					
								
			
### Create a new queue [DEPRECATED]
	
		
			Operation ID:
				PutQueue
			
		
	

	
This action has been deprecated. Please use [Create a new queue (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#create-a-new-queue-(v2)) instead.

Adds a queue to your account.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The name of the queue to create.

			
		
		#### Returns
			
			
				
					response
					
						[string](#string)
					
								
			
### Delete message (V2)
	
		
			Operation ID:
				DeleteMessage_V2
			
		
	

	
Delete a specific message from the queue.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Storage account name or queue endpoint
			
			storageAccountName
			
					True
			
			
				string
			
			
				
Azure Storage account name or queue endpoint.

			
		
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to delete a message from.

			
		
		
			
				Message ID
			
			messageId
			
					True
			
			
				string
			
			
				
The ID of the message to delete.

			
		
		
			
				Pop Receipt
			
			popreceipt
			
					True
			
			
				string
			
			
				
A valid pop receipt value returned from an earlier call to the Get Messages.

			
		
### Delete message [DEPRECATED]
	
		
			Operation ID:
				DeleteMessage
			
		
	

	
This action has been deprecated. Please use [Delete message (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#delete-message-(v2)) instead.

Delete a specific message from the queue.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to delete a message from.

			
		
		
			
				Message ID
			
			messageId
			
					True
			
			
				string
			
			
				
The ID of the message to delete.

			
		
		
			
				Pop Receipt
			
			popreceipt
			
					True
			
			
				string
			
			
				
A valid pop receipt value returned from an earlier call to the Get Messages.

			
		
### Get messages (V2)
	
		
			Operation ID:
				GetMessages_V2
			
		
	

	
Get a specific set of messages from the queue. The messages will be hidden but remain on the queue until the delete action is used.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Storage account name or queue endpoint
			
			storageAccountName
			
					True
			
			
				string
			
			
				
Azure Storage account name or queue endpoint.

			
		
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to get Messages from.

			
		
		
			
				Number of Messages
			
			numofmessages
			
			
			
				string
			
			
				
The number of messages to grab from the queue (default 1).

			
		
		
			
				Visibility Timeout
			
			visibilitytimeout
			
			
			
				string
			
			
				
The time in seconds that messages will be invisible to other consumers (default 30).

			
		
		#### Returns
			
			
				
					Body
					
						[Messages](#messages)
					
								
			
### Get messages [DEPRECATED]
	
		
			Operation ID:
				GetMessages
			
		
	

	
This action has been deprecated. Please use [Get messages (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#get-messages-(v2)) instead.

Get a specific set of messages from the queue. The messages will be hidden but remain on the queue until the delete action is used.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to get Messages from.

			
		
		
			
				Number of Messages
			
			numofmessages
			
			
			
				string
			
			
				
The number of messages to grab from the queue (default 1).

			
		
		
			
				Visibility Timeout
			
			visibilitytimeout
			
			
			
				string
			
			
				
The time in seconds that messages will be invisible to other consumers (default 30).

			
		
		#### Returns
			
			
				
					Body
					
						[Messages](#messages)
					
								
			
### List queues (V2)
	
		
			Operation ID:
				ListQueues_V2
			
		
	

	
List all the queues for your storage account.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Storage account name or queue endpoint
			
			storageAccountName
			
					True
			
			
				string
			
			
				
Azure Storage account name or queue endpoint.

			
		
		#### Returns
			
			
				
					Items
					
						[QueueArray](#queuearray)
					
								
			
### List queues [DEPRECATED]
	
		
			Operation ID:
				ListQueues
			
		
	

	
This action has been deprecated. Please use [List queues (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#list-queues-(v2)) instead.

List all the queues for your storage account.

		#### Returns
			
			
				
					Items
					
						[QueueArray](#queuearray)
					
								
			
### Put a message on a queue (V2)
	
		
			Operation ID:
				PutMessage_V2
			
		
	

	
Adds a message to the given queue.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Storage account name or queue endpoint
			
			storageAccountName
			
					True
			
			
				string
			
			
				
Azure Storage account name or queue endpoint.

			
		
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to put a message to.

			
		
		
			
				Message
			
			message
			
					True
			
			
				string
			
			
				
The message content to post to the queue.

			
		
### Put a message on a queue [DEPRECATED]
	
		
			Operation ID:
				PutMessage
			
		
	

	
This action has been deprecated. Please use [Put a message on a queue (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#put-a-message-on-a-queue-(v2)) instead.

Adds a message to the given queue.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to put a message to.

			
		
		
			
				Message
			
			message
			
					True
			
			
				string
			
			
				
The message content to post to the queue.

			
		

	## Triggers
		
				
					
						[When a specified number of messages are in a given queue (V2)](#when-a-specified-number-of-messages-are-in-a-given-queue-(v2))
					
					
						
Triggers when a specified number of messages are in the given queue.

					
				
				
					
						[When a specified number of messages are in a given queue [DEPRECATED]](#when-a-specified-number-of-messages-are-in-a-given-queue-[deprecated])
					
					
						
This action has been deprecated. Please use [When a specified number of messages are in a given queue (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#when-a-specified-number-of-messages-are-in-a-given-queue-(v2)) instead.

Triggers when a specified number of messages are in the given queue.

					
				
				
					
						[When there are messages in a queue (V2)](#when-there-are-messages-in-a-queue-(v2))
					
					
						
Triggers any time there are messages in the queue, returning up to 32 messages. The messages will be hidden but remain on the queue until the delete action is used.

					
				
				
					
						[When there are messages in a queue [DEPRECATED]](#when-there-are-messages-in-a-queue-[deprecated])
					
					
						
This action has been deprecated. Please use [When there are messages in a queue (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#when-there-are-messages-in-a-queue-(v2)) instead.

Triggers any time there are messages in the queue, returning up to 32 messages. The messages will be hidden but remain on the queue until the delete action is used.

					
				
		
### When a specified number of messages are in a given queue (V2)
	
		
			Operation ID:
				OnMessageThresholdReached_V2
			
		
	

	
Triggers when a specified number of messages are in the given queue.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Storage account name or queue endpoint
			
			storageAccountName
			
					True
			
			
				string
			
			
				
Azure Storage account name or queue endpoint.

			
		
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to check for messages.

			
		
		
			
				Threshold
			
			threshold
			
					True
			
			
				integer
			
			
				
The number of messages to wait for to fire the trigger.

			
		
		#### Returns
			
			
				
					response
					
						[string](#string)
					
								
			
### When a specified number of messages are in a given queue [DEPRECATED]
	
		
			Operation ID:
				OnMessageThresholdReached
			
		
	

	
This action has been deprecated. Please use [When a specified number of messages are in a given queue (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#when-a-specified-number-of-messages-are-in-a-given-queue-(v2)) instead.

Triggers when a specified number of messages are in the given queue.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to check for messages.

			
		
		
			
				Threshold
			
			threshold
			
					True
			
			
				integer
			
			
				
The number of messages to wait for to fire the trigger.

			
		
		#### Returns
			
			
				
					response
					
						[string](#string)
					
								
			
### When there are messages in a queue (V2)
	
		
			Operation ID:
				OnMessages_V2
			
		
	

	
Triggers any time there are messages in the queue, returning up to 32 messages. The messages will be hidden but remain on the queue until the delete action is used.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Storage account name or queue endpoint
			
			storageAccountName
			
					True
			
			
				string
			
			
				
Azure Storage account name or queue endpoint.

			
		
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to check for messages

			
		
		
			
				Visibility Timeout
			
			visibilitytimeout
			
			
			
				string
			
			
				
The time in seconds that messages will be invisible to other consumers (default 30)

			
		
		#### Returns
			
			
				
					Body
					
						[Messages](#messages)
					
								
			
### When there are messages in a queue [DEPRECATED]
	
		
			Operation ID:
				OnMessages
			
		
	

	
This action has been deprecated. Please use [When there are messages in a queue (V2)](https://learn.microsoft.com/en-us/connectors/azurequeues/#when-there-are-messages-in-a-queue-(v2)) instead.

Triggers any time there are messages in the queue, returning up to 32 messages. The messages will be hidden but remain on the queue until the delete action is used.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Queue Name
			
			queueName
			
					True
			
			
				string
			
			
				
The queue to check for messages

			
		
		
			
				Visibility Timeout
			
			visibilitytimeout
			
			
			
				string
			
			
				
The time in seconds that messages will be invisible to other consumers (default 30)

			
		
		#### Returns
			
			
				
					Body
					
						[Messages](#messages)
					
								
			

	## Definitions
### Queue

	

	
		Name
		Path
		Type
		Description
	
		
			
				Name
			
			
				Name
			
			
				string
			
			
				
The name of the queue.

			
		

### QueueArray

	

	
		Name
		Path
		Type
		Description
	
		
			
				Items
			
			
				
			
			
				Queue
			
			
				
			
		

### Messages

	

	
		Name
		Path
		Type
		Description
	
		
			
				QueueMessage
			
			
				QueueMessagesList.QueueMessage
			
			
				array of object
			
			
				
			
		
		
			
				Message ID
			
			
				QueueMessagesList.QueueMessage.MessageId
			
			
				string
			
			
				
The unique identifier of the message.

			
		
		
			
				Insertion Time
			
			
				QueueMessagesList.QueueMessage.InsertionTime
			
			
				string
			
			
				
The time the message was inserted into the queue.

			
		
		
			
				Expiration Time
			
			
				QueueMessagesList.QueueMessage.ExpirationTime
			
			
				string
			
			
				
The time the message will expire from the queue.

			
		
		
			
				Pop Receipt
			
			
				QueueMessagesList.QueueMessage.PopReceipt
			
			
				string
			
			
				
Used to delete the message after popping it off the queue.

			
		
		
			
				Next Visible Time
			
			
				QueueMessagesList.QueueMessage.TimeNextVisible
			
			
				string
			
			
				
The time the message will be visible to other consumers.

			
		
		
			
				Message Text
			
			
				QueueMessagesList.QueueMessage.MessageText
			
			
				string
			
			
				
The text of the message.

			
		

### string

	
This is the basic data type 'string'.