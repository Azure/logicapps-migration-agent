# FTP

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/

Connect to an FTP server to get file updates.

This article describes the operations for the FTP built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the FTP managed connector operations instead, see [FTP managed connector reference](https://learn.microsoft.com/en-us/connectors/filesystem/).

---

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

---

## Connector how-to guide

For more information about connecting to an FTP server from your workflow in Azure Logic Apps, see [Connect to FTP servers from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-ftp?tabs=standard).

---

## Authentication

### Server address

The address for the FTP server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Server address | The address for the FTP server. | string | True | |

### Username

The username for the FTP server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Username | The username for the FTP server. | string | True | |

### Password

The password for the FTP server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | The password for the FTP server. | securestring | True | |

### Port number

The port number for the FTP server, such as 21.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Port number | The port number for the FTP server, such as 21. | int | False | |

### Enable TLS/SSL

Enable TLS/SSL protocol? (True/False)

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Enable TLS/SSL | Enable TLS/SSL protocol? (True/False) | bool | False | |

### Disable certificate validation

Disable certificate validation? (True/False)

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Disable certificate validation | Disable certificate validation? (True/False) | bool | False | |

### Enable binary transport

Enable binary transport? (True/False)

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Enable binary transport | Enable binary transport? (True/False) | bool | False | |

### Close connection after request completion

Close FTP connection everytime after request completes? (True/False)

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Close connection after request completion | Close FTP connection everytime after request completes? (True/False) | bool | False | |

---

## Actions

| Operation | Description |
|-----------|-------------|
| Create file | Creates a file on the FTP server. If the file already exists, the file is overwritten. |
| Delete file | Deletes a file on the FTP server. |
| Extract archive | Extract an archive file inside the specified folder. Only ZIP archives are supported. |
| Get file content | This action fetches full file content given that the file size does not exceed maximum permissible limit of '{0}' bytes. Consider using 'Get File Content V(2)' action if you expect larger files. |
| Get file content (V2) | Gets the content of the given file. The default limit on file size is '2147483648' bytes. |
| Get file metadata | The file metadata. |
| List files and subfolders in a folder | Lists the files and subfolders in the specified folder. |
| Update file | Updates a file on the FTP server. |

### Create file

- **Operation ID:** createFile

Creates a file on the FTP server. If the file already exists, the file is overwritten.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root directory. |
| File content | fileContent | True | string | The file content. |
| Get all file metadata | getAllFileMetadata | | string | Get all file metadata from the FTP server after the file upload is complete. If this is false some metadata properties may not be returned such as last updated time, etc. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| File size | size | string | The file size in bytes. |
| Last updated time | lastUpdatedTime | string | The timestamp for when the file was last updated. |
| Media type | mediaType | string | The media type of the file or folder. |
| Is folder | isFolder | string | The Boolean value that indicates whether the item is a folder. |

### Delete file

- **Operation ID:** deleteFtpFile

Deletes a file on the FTP server.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root directory. |
| Skip when the file doesn't exist | skipIfFileNotPresent | | string | Skip when the file doesn't exist? (True/False) |

### Extract archive

- **Operation ID:** extractArchive

Extract an archive file inside the specified folder. Only ZIP archives are supported.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | | string | The relative path to the archive file. The file name must have a .zip extension. |
| Folder path | folderPath | True | string | The folder path where to extract the files, relative to the root directory. |
| Overwrite existing files behaviour | overwriteExistingFilesBehaviour | | string | The input determines the behaviour when dealing with files having same path as the archive already exist on the FTP server. |
| File content | fileContent | | string | The file content. |

#### Returns

The list containing the metadata for all the extracted files.

- **Extract archive output body** array

### Get file content

- **Operation ID:** getFtpFileContent

This action fetches full file content given that the file size does not exceed maximum permissible limit of '{0}' bytes. Consider using 'Get File Content V(2)' action if you expect larger files.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root directory. |

#### Returns

The file content.

- **File content** string

### Get file content (V2)

- **Operation ID:** getFtpFileContentV2

Gets the content of the given file. The default limit on file size is '2147483648' bytes.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root directory. |

#### Returns

The file content.

- **File content** string

### Get file metadata

- **Operation ID:** getFileMetadata

The file metadata.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root directory. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| File size | size | string | The file size in bytes. |
| Last updated time | lastUpdatedTime | string | The timestamp for when the file was last updated. |
| Media type | mediaType | string | The media type of the file or folder. |
| Is folder | isFolder | string | The Boolean value that indicates whether the item is a folder. |

### List files and subfolders in a folder

- **Operation ID:** listFilesInFolder

Lists the files and subfolders in the specified folder.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The path for the folder. |

#### Returns

Lists the files and subfolders in the specified folder.

- **Folder items** array

### Update file

- **Operation ID:** updateFile

Updates a file on the FTP server.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root directory. |
| File content | fileContent | True | string | The file content. |
| Get all file metadata | getAllFileMetadata | | string | Get all file metadata from the FTP server after the file upload is complete. If this is false some metadata properties may not be returned such as last updated time, etc. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| File size | size | string | The file size in bytes. |
| Last updated time | lastUpdatedTime | string | The timestamp for when the file was last updated. |
| Media type | mediaType | string | The media type of the file or folder. |
| Is folder | isFolder | string | The Boolean value that indicates whether the item is a folder. |

---

## Triggers

| Operation | Description |
|-----------|-------------|
| When a file is added or updated | This trigger fires when a new file is created or when an existing file is updated in the monitored folder. |

### When a file is added or updated

- **Operation ID:** whenFtpFilesAreAddedOrModified

This trigger fires when a new file is created or when an existing file is updated in the monitored folder.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The path for the folder. |
| Number of files to return | maxFileCount | | string | The maximum number of files (1-100) to return from a single trigger run. |
| Cutoff timestamp to ignore older files | oldFileCutOffTimestamp | | string | The cutoff timestamp to use for ignoring older files. Use the timestamp format 'YYYY-MM-DDTHH:MM:SS'. To disable this feature, leave this property empty. |
| Ignore subfolders | ignoreSubFolders | | string | Ignore subfolders? (True or False) |

#### Returns

The files that were added or updated.

- **Files added or updated** array

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/#triggers)
