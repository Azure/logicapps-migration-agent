# Azure Blob Storage

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureblob/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureblob/)

Connect to Azure Blob Storage.

This article describes the operations for the Azure Blob Storage built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Blob Storage managed connector operations instead, see [Azure Blob Storage managed connector reference](https://learn.microsoft.com/en-us/connectors/azureblob/).

## Built-in connector settings

In a Standard logic app resource, the Azure Blob Storage built-in connector includes settings that control various thresholds for performance, timeout, execution time, and so on. For example, you can change the timeout value for blob storage requests from the Azure Logic Apps runtime. For more information, review [Reference for host settings - host.json - Blob storage](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings#built-in-storage).

## Connector how-to guide

For more information about connecting to Azure Blob Storage from your workflow in Azure Logic Apps, see [Connect to Azure Blob Storage from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-azureblobstorage?tabs=standard).

## Authentication

### Storage account connection string

The connection string for your Azure storage account.

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Storage account connection string | The connection string for your Azure storage account. | securestring | True |  |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Storage account endpoint string | The endpoint string for an Azure Blob storage account, for example, https://[storage-account-name].blob.core.windows.net | string | True |  |
| Active Directory OAuth | Active Directory OAuth | string | True |  |
| Authority | Active Directory authority | string | False |  |
| Tenant | Active Directory tenant | string | True |  |
| Credential type | Active Directory credential type | string | False | Certificate, Secret |
| Client ID | Active Directory client ID | string | True |  |
| Client secret | Active Directory client secret | securestring | True |  |
| Pfx | Active Directory pfx | securestring | True |  |
| Password | Active Directory password | securestring | True |  |

### Managed identity

Managed identity

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Storage account endpoint string | The endpoint string for an Azure Blob storage account, for example, https://[storage-account-name].blob.core.windows.net | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Check whether blob exists | Check whether a blob exists in an Azure storage container. |
| Copy blob from source location to destination | Copy blob from source location to destination. |
| Copy blob from source location to destination reference by URI | Copy a blob in an Azure storage container based on a URI. |
| Delete a blob | Delete a blob from an Azure storage container. |
| Delete a blob based on a URI | Delete a blob in an Azure storage container based on a URI. |
| Extract an archive from a blob path to a folder | Extract an archive from a blob path to a folder. |
| Extract an archive from a blob path to a folder based on a URI | Extract an archive from a blob path to a folder in an Azure storage container based on a URI. |
| Extract archive from content to a folder | Extract archive from content to a folder. |
| Get blob access policies | Get blob access policies. |
| Get blob metadata based on a URI | Get blob metadata from an Azure storage container based on a URI. |
| Get blob metadata using path | Get blob metadata using a path to an Azure storage container. |
| Get blob SAS URI using path | Get the SAS URI for a blob using a path to an Azure storage container. |
| Get container metadata using path | Get container metadata using a path to an Azure storage container. |
| Get the SAS URI for a blob based on a URI | Get the SAS URI for a blob in an Azure storage container based on a URI. |
| List all containers | List all containers in Azure storage account. |
| List all the blob directories using path | List all the blob directories in the given path of Azure blob storage. |
| List all the blobs based on a URI | List all the blobs in an Azure storage container based on a URI. |
| List all the blobs using path | List all the blobs using a path to an Azure storage container. |
| Read blob content | Read content from a blob in an Azure storage container. |
| Read blob content based on URI | Read the content from a blob in an Azure storage container based on a URI. |
| Set the tier for a blob | Set the tier for a blob. |
| Set the tier for a blob based on a URI | Set the tier for a blob in an Azure storage container based on a URI. |
| Upload blob to storage container | Upload a blob to an Azure storage container. |
| Upload blob to storage container based on a URI | Upload a blob to an Azure storage container based on URI. |

### Check whether blob exists

- **Operation ID:** blobExists

Check whether a blob exists in an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob name | blobName | True | string | The name for the blob and optional folder. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Is Blob Exists | isBlobExists | string | Determine whether a blob exists in an Azure storage container. |
| Properties | properties | string | The blob properties. |
| Blob Metadata | metadata | string | The blob metadata. |

### Copy blob from source location to destination

- **Operation ID:** copyBlob

Copy blob from source location to destination.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Source Container name | sourceContainerName | True | string | The container name of source blob for copy operation. |
| Source Blob name | sourceBlobName | True | string | The blob name of source blob for copy operation. |
| Destination Container name | destinationContainerName | True | string | The container name of destination blob for copy operation. |
| Destination Blob name | destinationBlobName | True | string | The blob name of destination blob for copy operation. |
| Override If Exists | overrideIfExists |  | string | Specifies if the copy operation would overwrite an existing blob with same name. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Name | name | string | The entity name. |
| Creation Time | creationTime | string | The creation time for the blob. |
| Blob Type | blobType | string | The blob type. |
| Blob Full Path | blobFullPathWithContainer | string | Blob full path with container name. |
| Content Disposition | contentDisposition | string | The content disposition. |
| Content MD5 Hash | contentMD5 | string | The content MD5 hash. |
| Content Type | contentType | string | The type of content. |
| Content Language | contentLanguage | string | The language of the content. |
| Blob ETag | eTag | string | The ETag for the blob. |

### Copy blob from source location to destination reference by URI

- **Operation ID:** copyBlobFromUri

Copy a blob in an Azure storage container based on a URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Source URI | sourceBlobUri | True | string | The source blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Destination URI | destinationBlobUri | True | string | The destination blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Override If Exists | overrideIfExists |  | string | Specifies if the copy operation would overwrite an existing blob with same name. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Name | name | string | The entity name. |
| Creation Time | creationTime | string | The creation time for the blob. |
| Blob Type | blobType | string | The blob type. |
| Blob Full Path | blobFullPathWithContainer | string | Blob full path with container name. |
| Content Disposition | contentDisposition | string | The content disposition. |
| Content MD5 Hash | contentMD5 | string | The content MD5 hash. |
| Content Type | contentType | string | The type of content. |
| Content Language | contentLanguage | string | The language of the content. |
| Blob ETag | eTag | string | The ETag for the blob. |

### Delete a blob

- **Operation ID:** deleteBlob

Delete a blob from an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob name | blobName | True | string | The name for the blob and optional folder. |

### Delete a blob based on a URI

- **Operation ID:** deleteBlobFromUri

Delete a blob in an Azure storage container based on a URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Blob URI | blobUri | True | string | The blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |

### Extract an archive from a blob path to a folder

- **Operation ID:** extractArchiveFromBlobPath

Extract an archive from a blob path to a folder.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Source Container name | sourceContainerName | True | string | The container name of source blob for extract archive operation. |
| Source Blob name | sourceBlobName | True | string | The blob name of source blob for extract archive operation. |
| Destination Container name | destinationContainerName | True | string | The container name of destination blob for extract an archive from a blob path operation. |
| Destination Folder path | destinationFolderPath | True | string | The destination folder path for extract archive operation. |
| Overwrite behaviour | overwriteExistingFilesBehaviour |  | string | The input determines the behaviour when dealing with blobs having same path as the archive already exist on the blob storage. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Extract Archive Entities List | extractedBlobs | string | The list of extract archive response entities. |

### Extract an archive from a blob path to a folder based on a URI

- **Operation ID:** extractArchiveFromUri

Extract an archive from a blob path to a folder in an Azure storage container based on a URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Source URI | sourceBlobUri | True | string | The source blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Destination URI | destinationBlobUri | True | string | The destination blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Overwrite behaviour | overwriteExistingFilesBehaviour |  | string | The input determines the behaviour when dealing with blobs having same path as the archive already exist on the blob storage. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Extract Archive Entities List | extractedBlobs | string | The list of extract archive response entities. |

### Extract archive from content to a folder

- **Operation ID:** extractArchiveFromContent

Extract archive from content to a folder.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Content | content |  | string | The archived content input for extract archive operation. |
| Destination Container name | destinationContainerName | True | string | The container name of destination blob for extract an archive from a blob path operation. |
| Destination Folder path | destinationFolderPath |  | string | The destination folder path for extract archive operation. |
| Overwrite behaviour | overwriteExistingFilesBehaviour |  | string | The input determines the behaviour when dealing with blobs having same path as the archive already exist on the blob storage. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Extract Archive Entities List | extractedBlobs | string | The list of extract archive response entities. |

### Get blob access policies

- **Operation ID:** getAccessPolicies

Get blob access policies.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |

#### Returns

The list of access policies.

- **Access Policy List** array

### Get blob metadata based on a URI

- **Operation ID:** getBlobMetadataFromUri

Get blob metadata from an Azure storage container based on a URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Blob URI | blobUri | True | string | The blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Name | name | string | The entity name. |
| Creation Time | creationTime | string | The creation time for the blob. |
| Blob Type | blobType | string | The blob type. |
| Blob Full Path | blobFullPathWithContainer | string | Blob full path with container name. |
| Content Disposition | contentDisposition | string | The content disposition. |
| Content MD5 Hash | contentMD5 | string | The content MD5 hash. |
| Content Type | contentType | string | The type of content. |
| Content Language | contentLanguage | string | The language of the content. |
| Blob ETag | eTag | string | The ETag for the blob. |

### Get blob metadata using path

- **Operation ID:** getBlobMetadata

Get blob metadata using a path to an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob name | blobName | True | string | The name for the blob and optional folder. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Name | name | string | The entity name. |
| Creation Time | creationTime | string | The creation time for the blob. |
| Blob Type | blobType | string | The blob type. |
| Blob Full Path | blobFullPathWithContainer | string | Blob full path with container name. |
| Content Disposition | contentDisposition | string | The content disposition. |
| Content MD5 Hash | contentMD5 | string | The content MD5 hash. |
| Content Type | contentType | string | The type of content. |
| Content Language | contentLanguage | string | The language of the content. |
| Blob ETag | eTag | string | The ETag for the blob. |

### Get blob SAS URI using path

- **Operation ID:** getBlobSASUri

Get the SAS URI for a blob using a path to an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob name | blobName | True | string | The name for the blob and optional folder. |
| Group policy identifier | groupPolicyIdentifier |  | string | The string that identifies a stored access policy. Group policy parameters, such as start time and expiry time, have precedence over input parameters in actions. |
| Permissions | permissions |  | string | The access permissions for the SAS URI. |
| Start time | startTime |  | string | The date and time when the SAS becomes valid, for example, '2017-11-01T15:30:00+00.00'.Default=now(). |
| Expiry time | expiryTime |  | string | The date and time when the SAS is no longer valid, for example, '2017-11-01T15:30:00+00.00'.Default=now() + 24h. |
| Shared access protocol | sharedAccessProtocol |  | string | The allowed protocols, either HTTPS only or HTTP and HTTPS. Leave empty if you don't want to restrict traffic based on protocol. |
| IP address or address range | ipAddressRange |  | string | The allowed IP address or address range. Leave empty if you don't to restrict traffic based on IP address. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| SAS URI | blobUri | string | The SAS URI based on a given blob path. |

### Get container metadata using path

- **Operation ID:** getContainerMetadata

Get container metadata using a path to an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Container name | name | string | The name for the Azure storage container. |
| ETag | eTag | string | The ETag for the Azure storage container. |
| Last updated time | lastModifiedTime | string | The last updated time. |

### Get the SAS URI for a blob based on a URI

- **Operation ID:** getBlobSASUriFromUri

Get the SAS URI for a blob in an Azure storage container based on a URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Blob URI | blobUri | True | string | The blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Group policy identifier | groupPolicyIdentifier |  | string | The string that identifies a stored access policy. Group policy parameters, such as start time and expiry time, have precedence over input parameters in actions. |
| Permissions | permissions |  | string | The access permissions for the SAS URI. |
| Start time | startTime |  | string | The date and time when the SAS becomes valid, for example, '2017-11-01T15:30:00+00.00'.Default=now(). |
| Expiry time | expiryTime |  | string | The date and time when the SAS is no longer valid, for example, '2017-11-01T15:30:00+00.00'.Default=now() + 24h. |
| Shared access protocol | sharedAccessProtocol |  | string | The allowed protocols, either HTTPS only or HTTP and HTTPS. Leave empty if you don't want to restrict traffic based on protocol. |
| IP address or address range | ipAddressRange |  | string | The allowed IP address or address range. Leave empty if you don't to restrict traffic based on IP address. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| SAS URI | blobUri | string | The SAS URI based on a given blob path. |

### List all containers

- **Operation ID:** listContainers

List all containers in Azure storage account.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Page Marker | pageMarker |  | string | A page marker that identifies the part of the list to return with the list action. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Container List | containers | string | The list of all containers. |
| Page Marker | pageMarker | string | A page marker that identifies the part of the list to return with the list action. |

### List all the blob directories using path

- **Operation ID:** listBlobDirectories

List all the blob directories in the given path of Azure blob storage.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob prefix path | blobNamePrefix |  | string | The prefix path for the blob like 'directory1/blob1' or 'directory1/subdirectory2/'. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Blob Directories List | blobDirectories | string | The list of all blob directories. |

### List all the blobs based on a URI

- **Operation ID:** listBlobsFromUri

List all the blobs in an Azure storage container based on a URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Blob URI | blobUri | True | string | The blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Page Marker | pageMarker |  | string | A page marker that identifies the part of the list to return with the list action. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Blob List | blobs | string | The list of all the blobs. |
| Page Marker | pageMarker | string | A page marker that identifies the part of the list to return with the list action. |

### List all the blobs using path

- **Operation ID:** listBlobs

List all the blobs using a path to an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob prefix path | blobNamePrefix |  | string | The prefix path for the blob like 'directory1/blob1' or 'directory1/subdirectory2/'. |
| Page Marker | pageMarker |  | string | A page marker that identifies the part of the list to return with the list action. |
| Exclude sub folder blobs | excludeSubFolderBlobs |  | string | A boolean value indicating if the sub folder blobs should be listed in response. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Blob List | blobs | string | The list of all the blobs. |
| Page Marker | pageMarker | string | A page marker that identifies the part of the list to return with the list action. |

### Read blob content

- **Operation ID:** readBlob

Read content from a blob in an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob name | blobName | True | string | The name for the blob and optional folder. |
| Infer Content Type | inferContentType |  | string | Infer content-type based on extension. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Content | content | string | The blob content. |
| Properties | properties | string | The blob properties. |
| Blob Metadata | metadata | string | The blob metadata. |

### Read blob content based on URI

- **Operation ID:** readBlobFromUri

Read the content from a blob in an Azure storage container based on a URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Blob URI | blobUri | True | string | The blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Infer Content Type | inferContentType |  | string | Infer content-type based on extension. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Content | content | string | The blob content. |
| Properties | properties | string | The blob properties. |
| Blob Metadata | metadata | string | The blob metadata. |

### Set the tier for a blob

- **Operation ID:** setBlobTier

Set the tier for a blob.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob name | blobName | True | string | The name for the blob and optional folder. |
| Blob Access Tier | blobAccessTier | True | string | The access tier for the blob to be set. |

### Set the tier for a blob based on a URI

- **Operation ID:** setBlobTierFromUri

Set the tier for a blob in an Azure storage container based on a URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Blob URI | blobUri | True | string | The blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Blob Access Tier | blobAccessTier | True | string | The access tier for the blob to be set. |

### Upload blob to storage container

- **Operation ID:** uploadBlob

Upload a blob to an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Container name | containerName | True | string | The name for the storage container and optional folder. |
| Blob name | blobName | True | string | The name for the blob and optional folder. |
| Content | content | True | string | The blob content. |
| Override If Exists | overrideIfExists |  | string | Override if blob already exists |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Properties | properties | string | The blob properties. |
| Blob Metadata | metadata | string | The blob metadata. |

### Upload blob to storage container based on a URI

- **Operation ID:** uploadBlobFromUri

Upload a blob to an Azure storage container based on URI.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Blob URI | blobUri | True | string | The blob's full path in one of the following formats: 'container1/directory1/blob1' or 'container2/directory1/subdirectory2/' |
| Content | content | True | string | The blob content. |
| Override If Exists | overrideIfExists |  | string | Override if blob already exists |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Properties | properties | string | The blob properties. |
| Blob Metadata | metadata | string | The blob metadata. |

## Triggers

| Trigger | Description |
| --- | --- |
| When a blob is added or updated | When a blob is added or updated in an Azure storage container. |

### When a blob is added or updated

- **Operation ID:** whenABlobIsAddedOrModified

When a blob is added or updated in an Azure storage container.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Blob path | path | True | string | The format for the blob path. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Blob Name | name | string | The name for the blob. |
| Container Info | containerInfo | string | The container information. |
| Properties | properties | string | The blob properties. |
| Blob Metadata | metadata | string | The blob metadata. |

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureblob/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureblob/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureblob/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureblob/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azureblob/#triggers)
