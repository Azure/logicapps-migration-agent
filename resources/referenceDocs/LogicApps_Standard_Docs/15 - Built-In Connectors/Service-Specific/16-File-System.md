# File System

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/filesystem/

Connect to a File System on your network machine to get file updates.

This article describes the operations for the File System built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the File System managed connector operations instead, see [File System managed connector reference](https://learn.microsoft.com/en-us/connectors/filesystem/).

---

## Limitations

- For a new connection, the built-in connector expects a fully-qualified domain name, unlike the managed connector, which uses the machine name in the root path.
- The built-in connector supports up to 20 connections maximum for a Standard logic app resource.
- The built-in connector doesn't support duplicate connections, which have the same root folder path, with different credentials. Although connection creation succeeds, the new connection continues to use the credentials from the previous connection.

---

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

---

## Connector how-to guide

For more information about connecting to a file system from your workflow in Azure Logic Apps, see [Connect to file systems from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-using-file-connector?tabs=standard).

---

## Authentication

### Root folder

The root folder of the file share eg:\\Machine-Name\SharedFolderName

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Root folder | The root folder of the file share eg:\\Machine-Name\SharedFolderName | string | True | |

### Username

The username in the format Domain\Username

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Username | The username in the format Domain\Username | string | True | |

### Password

The password for the file share.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | The password for the file share. | securestring | True | |

### Mount path

The directory path where the file share is mounted.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Mount path | The directory path where the file share is mounted. | string | False | |

---

## Actions

| Operation | Description |
|-----------|-------------|
| Append file | Appends data to a file on the file share. |
| Copy file | Copy a file from source file path to destination file path. |
| Create file | Creates a file on the file share. If the file already exists, the file is overwritten. |
| Delete file | Deletes a file on the file share. |
| Extract archive | Extract an archive file inside the specified folder. Only ZIP archives are supported. |
| Get file content | Gets the content of the given file. |
| Get file content (V2) | Gets the content of the given file. The default limit on file size is '2147483648' bytes. |
| Get file metadata | Gets the metadata of the given file. |
| List files and subfolders in a folder | List files and subfolders in the specified folder. |
| Rename file | Renames a file on the file share. |
| Update file | Updates a file on the file share. |

### Append file

- **Operation ID:** appendFile

Appends data to a file on the file share.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root folder. |
| File content | body | True | string | The file content. |
| Create file when it doesn't exist? (True/False) | createFileIfNotPresent | | string | Create file when it doesn't exist |

### Copy file

- **Operation ID:** copyFile

Copy a file from source file path to destination file path.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Source file path | source | True | string | The source file path, including the file name extension, relative to the root folder. |
| Destination file path | destination | True | string | The destination file path, including the file name extension, relative to the root folder. |
| Overwrite destination file | overwrite | | string | The destination file will be overwritten if it exists. |

### Create file

- **Operation ID:** createFile

Creates a file on the file share. If the file already exists, the file is overwritten.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root folder. |
| File content | body | | string | The file content. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| File size | size | string | The file size in bytes. |

### Delete file

- **Operation ID:** deleteFile

Deletes a file on the file share.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root folder. |
| Skip when the file doesn't exist? (True/False) | skipIfFileNotPresent | | string | Skip when the file doesn't exist |

### Extract archive

- **Operation ID:** extractArchive

Extract an archive file inside the specified folder. Only ZIP archives are supported.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | | string | The archive file path, including the file extension, relative to the root folder. |
| Folder path | folderPath | True | string | The folder path where to extract files, relative to the root directory. |
| Overwrite existing files behaviour | overwrite | | string | The input determines the behaviour when dealing with files having same path as the archive already exist on the file share. |
| File content | body | | string | The file content. |

#### Returns

The list containing the metadata for all the extracted files.

- **Extract archive output body** array

### Get file content

- **Operation ID:** getFileContent

Gets the content of the given file.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root folder. |
| Infer Content Type | inferContentType | | string | Infer content-type based on the file extension. |

#### Returns

The file content.

- **File content** string

### Get file content (V2)

- **Operation ID:** getFileContentV2

Gets the content of the given file. The default limit on file size is '2147483648' bytes.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root folder. |
| Infer Content Type | inferContentType | | string | Infer content-type based on the file extension. |

#### Returns

The file content.

- **File content** string

### Get file metadata

- **Operation ID:** getFileMetadata

Gets the metadata of the given file.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root folder. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Created time | createdTime | string | The timestamp for when the file was created. |
| Content type | contentType | string | The file content type. |
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| File size | size | string | The file size in bytes. |
| Last updated time | lastUpdatedTime | string | The timestamp for when the file was last updated. |

### List files and subfolders in a folder

- **Operation ID:** listFolder

List files and subfolders in the specified folder.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The path for the folder. |
| Recursively list files and folders from sub-folders | enableRecursiveListing | | string | Recursively lists files and folders from sub-folders when set to true. |

#### Returns

List files and subfolders in the specified folder.

- **Folder items** array

### Rename file

- **Operation ID:** renameFile

Renames a file on the file share.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root folder. |
| New name | newName | True | string | New name for the file |

### Update file

- **Operation ID:** updateFile

Updates a file on the file share.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path, including the file name extension, relative to the root folder. |
| File content | body | True | string | The file content. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| File name | name | string | The file name. |
| File path | path | string | The file path. |
| File size | size | string | The file size in bytes. |

---

## Triggers

| Operation | Description |
|-----------|-------------|
| When a file is added | This trigger fires when a new file is created in the monitored folder. |
| When a file is added or updated | This trigger fires when a new file is created or when an existing file is updated in the monitored folder. |

### When a file is added

- **Operation ID:** whenFilesAreAdded

This trigger fires when a new file is created in the monitored folder.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The path for the folder. |
| Number of files to return | maxFileCount | | string | The maximum number of files (1-100) to return from a single trigger run. |
| Cutoff timestamp to ignore older files | oldFileCutOffTimestamp | | string | The cutoff timestamp to use for ignoring older files. Use the timestamp format 'YYYY-MM-DDTHH:MM:SS'. To disable this feature, leave this property empty. |

#### Returns

The files that were added.

- **Files added** array

### When a file is added or updated

- **Operation ID:** whenFilesAreAddedOrModified

This trigger fires when a new file is created or when an existing file is updated in the monitored folder.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The path for the folder. |
| Number of files to return | maxFileCount | | string | The maximum number of files (1-100) to return from a single trigger run. |
| Cutoff timestamp to ignore older files | oldFileCutOffTimestamp | | string | The cutoff timestamp to use for ignoring older files. Use the timestamp format 'YYYY-MM-DDTHH:MM:SS'. To disable this feature, leave this property empty. |

#### Returns

The files that were added or updated.

- **Files added or updated** array

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Limitations](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/filesystem/#limitations)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/filesystem/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/filesystem/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/filesystem/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/filesystem/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/filesystem/#triggers)
