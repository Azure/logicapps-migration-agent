# Azure File Storage

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurefile/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurefile/)

Connect to Azure Files to perform file operations.

This article describes the operations for the Azure File Storage built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure File Storage managed connector operations instead, see [Azure File Storage managed connector reference](https://learn.microsoft.com/en-us/connectors/azurefile/).

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

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
| Storage Account URI | Storage account URI | string | True |  |
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
| Storage Account URI | Storage account URI | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Copy file | Copies a file from your Azure file share in your Azure storage account. |
| Create file | Creates a file in your Azure file share. |
| Delete file | Deletes a file from your Azure file share. |
| Extract archive | Extract an archive file inside the specified folder. Only ZIP archives are supported. |
| Get file content | Gets a file's content by specifing only the file path, not an ID. |
| Get file content (V2) | Gets the content of the given file. The default limit on file size is '2147483648' bytes. |
| Get file content using path | Gets a file's content by specifying a path. |
| Get file metadata | Gets a file's metadata by specifying only the file path, not an ID. |
| Get file metadata using path | Gets a file's metadata by specifying a path. |
| List files | Lists the files in a folder. |
| Update file | Updates a file in your Azure file share. |

### Copy file

- **Operation ID:** copyFile

Copies a file from your Azure file share in your Azure storage account.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Source file path | SourceFilePath | True | string | The path to the source file. |
| Destination file path | destinationFilePath | True | string | The destination file path. |
| Overwrite destination file? | overwrite |  | string | Specifies whether to overwrite the destination file (true/false). |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| ETag | etag | string | The ETag for the file. |
| Content type | contentType | string | The file's content type. |
| Is folder | isFolder | string | Whether or not the file is a folder. |
| Last modified | lastModifiedDateTime | string | The file's last modified date and time. |
| File identifier | id | string | The file identifier. |
| File size | fileSize | string | The file size. |

### Create file

- **Operation ID:** createFile

Creates a file in your Azure file share.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Folder path | folderPath | True | string | The folder path where to upload the file. |
| File name | fileName | True | string | The name for the file to create. |
| File content | fileContent | True | string | The file content to upload. |
| Overwrite destination file? | overwrite |  | string | Specifies whether to overwrite the destination file (true/false). |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| ETag | etag | string | The ETag for the file. |
| Content type | contentType | string | The file's content type. |
| Is folder | isFolder | string | Whether or not the file is a folder. |
| Last modified | lastModifiedDateTime | string | The file's last modified date and time. |
| File identifier | id | string | The file identifier. |
| File size | fileSize | string | The file size. |

### Delete file

- **Operation ID:** deleteFile

Deletes a file from your Azure file share.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| File ID | fileId | True | string | The ID for the file to delete. |

### Extract archive

- **Operation ID:** extractArchive

Extract an archive file inside the specified folder. Only ZIP archives are supported.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| File path | filePath |  | string | A unique path to the file. |
| Folder path | destinationFolderPath | True | string | The folder path where to upload the file. |
| Overwrite existing files behaviour | overwriteExistingFilesBehaviour |  | string | The input determines the behaviour when dealing with files having same path as the archive already exist on the file share. |
| File content | fileContent |  | string | The file content to upload. |

#### Returns

The list containing the metadata for all the extracted files.

- **Extract archive output body** array

### Get file content

- **Operation ID:** getFileContent

Gets a file's content by specifing only the file path, not an ID.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| File ID | fileId | True | string | A unique path to the file. |
| Infer content type | inferContentType |  | string | Infers the content type, based on the file extension. |

#### Returns

The file content.

- **File content** string

### Get file content (V2)

- **Operation ID:** getFileContentV2

Gets the content of the given file. The default limit on file size is '2147483648' bytes.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| File ID | fileId | True | string | A unique path to the file. |
| Infer content type | inferContentType |  | string | Infers the content type, based on the file extension. |

#### Returns

The file content.

- **File content** string

### Get file content using path

- **Operation ID:** getFileContentByPath

Gets a file's content by specifying a path.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| File path | fileId | True | string | A unique path to the file. |
| Infer content type | inferContentType |  | string | Infers the content type, based on the file extension. |

#### Returns

The file content.

- **File content** string

### Get file metadata

- **Operation ID:** getFileMetadata

Gets a file's metadata by specifying only the file path, not an ID.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| File ID | fileId | True | string | A unique path to the file. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| ETag | etag | string | The ETag for the file. |
| Content type | contentType | string | The file's content type. |
| Is folder | isFolder | string | Whether or not the file is a folder. |
| Last modified | lastModifiedDateTime | string | The file's last modified date and time. |
| File identifier | id | string | The file identifier. |
| File size | fileSize | string | The file size. |

### Get file metadata using path

- **Operation ID:** getFileMetadataByPath

Gets a file's metadata by specifying a path.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| File path | filePath | True | string | A unique path to the file. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| ETag | etag | string | The ETag for the file. |
| Content type | contentType | string | The file's content type. |
| Is folder | isFolder | string | Whether or not the file is a folder. |
| Last modified | lastModifiedDateTime | string | The file's last modified date and time. |
| File identifier | id | string | The file identifier. |
| File size | fileSize | string | The file size. |

### List files

- **Operation ID:** listFolder

Lists the files in a folder.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Folder ID | folderId | True | string | The ID for the folder. |

#### Returns

- **Output** array

### Update file

- **Operation ID:** updateFile

Updates a file in your Azure file share.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| File ID | fileId | True | string | The file to update. |
| File content | fileContent | True | string | The file content to upload. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| ETag | etag | string | The ETag for the file. |
| Content type | contentType | string | The file's content type. |
| Is folder | isFolder | string | Whether or not the file is a folder. |
| Last modified | lastModifiedDateTime | string | The file's last modified date and time. |
| File identifier | id | string | The file identifier. |
| File size | fileSize | string | The file size. |

## Triggers

| Trigger | Description |
| --- | --- |
| When a file is added (Preview) | This trigger fires when a new file is created in the monitored folder. |
| When a file is added or updated (Preview) | This trigger fires when a new file is created or when an existing file is updated in the monitored folder. |

### When a file is added (Preview)

- **Operation ID:** whenFilesAreAdded

This trigger fires when a new file is created in the monitored folder.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Folder path | folderPath | True | string | The folder path where to upload the file. |
| Number of files to return | maxFileCount |  | string | The maximum number of files (1-100) to return from a single run. |
| Cutoff timestamp to ignore older files | oldFilesCutOffTimestamp |  | string | The cutoff timestamp to use for ignoring older files. Use the timestamp format 'YYYY-MM-DDTHH:MM:SS'. To disable this feature, leave this property empty. |

#### Returns

The files that were added.

- **Files added** array

### When a file is added or updated (Preview)

- **Operation ID:** whenFilesAreAddedOrModified

This trigger fires when a new file is created or when an existing file is updated in the monitored folder.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Folder path | folderPath | True | string | The folder path where to upload the file. |
| Number of files to return | maxFileCount |  | string | The maximum number of files (1-100) to return from a single run. |
| Cutoff timestamp to ignore older files | oldFilesCutOffTimestamp |  | string | The cutoff timestamp to use for ignoring older files. Use the timestamp format 'YYYY-MM-DDTHH:MM:SS'. To disable this feature, leave this property empty. |

#### Returns

The files that were added or updated.

- **Files added or updated** array

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurefile/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurefile/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurefile/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurefile/#triggers)
