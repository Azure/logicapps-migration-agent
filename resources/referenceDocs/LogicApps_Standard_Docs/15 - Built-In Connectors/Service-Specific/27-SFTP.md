# SFTP

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/

Connect to an SFTP server to receive file updates.

This article describes the operations for the SFTP built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the SFTP-SSH managed connector operations instead, see [SFTP managed connector reference](https://learn.microsoft.com/en-us/connectors/sftpwithssh/).

The SFTP built-in connector runs on the Secure Shell (SSH) protocol to encrypt file data and uses the [SSH.NET library](https://github.com/sshnet/SSH.NET), which is an open-source Secure Shell (SSH) library that supports .NET.

---

## Connector how-to guide

For more information about connecting to an SFTP file server from your workflow in Azure Logic Apps, see [Connect to an SFTP file server using SSH from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-sftp-ssh?tabs=standard).

---

## Differences from the SFTP-SSH managed connector

The SFTP built-in connector differs in the following ways:

- Operations use streaming rather than chunking.
- Triggers compare file versions not only based on the last modified timestamp, but also other file attributes such as size, permissions, and name.

---

## Connection creation, authentication, and permissions

- The SFTP built-in connector currently doesn't support the following SFTP servers:

  - FileMage Gateway
  - IBM DataPower
  - MessageWay
  - OpenText Secure MFT
  - OpenText GXS
  - VShell Secure File Transfer Server

- When you create a connection to your SFTP server, you have to provide a name for your connection, your SFTP server address, and your user name.

- You can optionally provide a root directory to specify relative paths in trigger and action inputs. This directory is prefixed in all input paths to create a full path to the resource, such as the input directory or file.

> **Note**
>
> If you don't specify a root directory, you must provide full absolute paths where applicable in trigger and action inputs.

- The SFTP built-in connector supports both password authentication and private key authentication. You can use either method, but if you provide values for both methods, the client tries to authenticate using both. If either method succeeds, the client successfully creates the connection.

- You can omit the user password, but only if you don't provide an SSH private key. If you provide a private key, the client doesn't attempt password authentication.

- The SFTP built-in connector supports only the following private key formats, key exchange algorithms, encryption algorithms, and fingerprints:

  - **Private key formats:** RSA (Rivest Shamir Adleman) and DSA (Digital Signature Algorithm) keys in both OpenSSH and ssh.com formats. If your private key is in PuTTY (.ppk) file format, first convert the key to the OpenSSH (.pem) file format. For more information, see the [private keys supported by SSH.NET](https://github.com/sshnet/SSH.NET/#public-key-authentication).
  - **Key exchange algorithms:** See [Key Exchange Method - SSH.NET](https://github.com/sshnet/SSH.NET#key-exchange-method).
  - **Encryption algorithms:** See [Encryption Method - SSH.NET](https://github.com/sshnet/SSH.NET#encryption-method).
  - **Fingerprint:** MD5. For more information, see Find the MD5 fingerprint.

### SSH private key authentication

- If you use an SSH private key, make sure to meet the following requirements:

  - The private key uses a multi-line format with a header and footer.
  - When you provide the private key for your connection, don't manually enter or edit the key, which might cause the connection to fail. Instead, make sure that you copy the key from your SSH private key file, and paste that key into the connection information box.

To correctly copy and paste your SSH private key, follow these steps:

  1. Open your SSH private key file in any text editor. These steps continue using Notepad as an example.
  2. In Notepad, from the **Edit** menu, select **Select all**. (Press Ctrl + A)
  3. From the **Edit** menu, select **Copy**.
  4. In the SFTP-SSH connection information box, paste the complete copied key into the **SSH private key** property, which supports multiple lines. Don't manually enter or edit the key.
  5. After you finish entering the connection details, select **Create**.

### Convert PuTTY-based key to OpenSSH

If you have a PuTTY-based key, this key's format and the OpenSSH format use different file name extensions. The PuTTY format uses the .ppk, or PuTTY Private Key, file name extension. The OpenSSH format uses the .pem, or Privacy Enhanced Mail, file name extension. If your private key is in PuTTY format, and you have to use OpenSSH format, first convert the key to the OpenSSH format by following these steps:

- **Unix-based OS**

  1. If you don't have the PuTTY tools installed on your system, do that now, for example: `sudo apt-get install -y putty`
  2. Run the following command, which creates a file that you can use with the SFTP-SSH connector:

     `puttygen <path-to-private-key-file-in-PuTTY-format> -O private-openssh -o <path-to-private-key-file-in-OpenSSH-format>`

     For example:

     `puttygen /tmp/sftp/my-private-key-putty.ppk -O private-openssh -o /tmp/sftp/my-private-key-openssh.pem`

- **Windows OS**

  1. If you haven't done so already, [download the latest PuTTY Generator (puttygen.exe) tool](https://www.puttygen.com/), and then open the tool.
  2. In the PuTTY Key Generator tool (puttygen.exe), under **Actions**, select **Load**.
  3. Browse to your private key file in PuTTY format, and select **Open**.
  4. From the **Conversions** menu, select **Export OpenSSH key**.
  5. Save the private key file with the **.pem** file name extension.

### Provide an MD5 fingerprint to verify the SFTP host server

You can optionally provide the MD5 fingerprint for the host server's public key. If both the host server's fingerprint and expected fingerprint don't match, the connector rejects the connection.

#### You have the public key

If you have the host server's public key, which is a 47-character string that's delimited by colons, you can get the MD5 fingerprint, which is a sequence with 16 pairs of hex digits delimited by colons, by using tools such as ssh-keygen.

For example, from a Bash prompt, enter the following command: `ssh-keygen -l -f id_rsa.pub -E md5`

#### You don't have the public key

If you don't have the host server's public key, you can use the latest [Server and Protocol Information Dialog tool by WinSCP](https://winscp.net/eng/docs/ui_fsinfo), or you can use the PuTTY Configuration tool instead:

1. In the PuTTY Configuration tool (putty.exe), in the **Category** window, expand **Connection** > **SSH** > **Host keys**.
2. Under **Host key algorithm preference**, open the **Algorithm selection policy** list, and check that **RSA** appears at the top.
3. If **RSA** doesn't appear at the top, select **RSA**, and then select **Up** until RSA moves to the top.
4. Connect to your SFTP server with PuTTY. After the connection is created, when the PUTTY security alert appears, select **More info**.

> **Note**
>
> If the security alert doesn't appear, try clearing the SshHostKeys entry. Open the Windows registry editor, and browse to the following entry:
>
> `Computer\HKEY_CURRENT_USER\Software\SimonTatham\PuTTY\SshHostKeys`

5. After the **PuTTY: information about the server's host key** box appears, find the **MD5 fingerprint** property, and copy the 47-character string value, which looks like the following example:

   `**:**:**:**:**:**:**:**:**:**:**:**:**:**:**:**`

---

## Built-in connector settings

In a Standard logic app resource, the SFTP built-in connector includes settings that control various thresholds for performance, timeout, execution time, and so on. For more information, review the following documentation:

- [Reference for app settings - local.settings.json](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings#reference-local-settings-json)
- [Reference for host settings - host.json - Built-in SFTP operations](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings#built-in-sftp)

---

## Known issues and limitations with triggers

| Trigger | Known issues and limitations |
|---------|------------------------------|
| When a file is added or updated | This trigger returns only one file per poll, even if multiple files are added or updated. Any other added or updated files are returned one at a time with each subsequent poll. - After the trigger returns a file, the trigger won't fetch the file again unless a change occurs. To return multiple added or updated files, use the **When files are added or updated** trigger instead. - If you enable the setting named **Include file content**, the trigger returns file content along with file metadata, but only for files up to 200 MB. If you're working with larger files, use the **Get file content (V2)** action instead. - If you use the input parameter named **Exclude file extensions**, the trigger ignores any files with the specified file extensions. However, make sure to omit the period (.) prefix for the file extension. |
| When files are added or updated | This trigger returns an array of multiple file objects per poll. - By default, triggers that return an array have a **Split On** setting that's enabled by default. With this setting enabled, the trigger automatically debatches or splits the array into individual items and runs a separate workflow instance to process each array item. All the workflow instances run in parallel so that the array items are processed at the same time. When the **Split On** setting is enabled, the trigger returns the outputs for all the array items as lists. Any subsequent actions that reference these outputs have to first handle these outputs as lists. To handle each array item individually, you can add extra actions. For example, to iterate through these array items, you can use a **For each** loop. For triggers that return only metadata or properties, use an action that gets the array item's metadata first, and then use an action to get the items contents. If you want to perform batch or array operations and consider disabling the **Split On** setting, review the potential problem. |

- SFTP triggers work only on files in the specified folder, not subfolders. To also check a folder's subfolders, set up a separate flow for each subfolder.

- The first poll initializes the trigger state, so SFTP triggers won't detect any file changes at this time because no previous state exists for comparison. File changes or additions are detected only after the first poll.

- SFTP triggers might experience missing, incomplete, or delayed results.

  - **Missing results**

    - On your SFTP server, use separate folders for triggers to monitor and for storage. This practice helps your monitoring folder stay small and keep triggers performing well because they check and compare the names and timestamps for all files in the folder.

      If you use the same folder for monitoring and storage, triggers might start to behave unexpectedly if too many files accumulate, for example, more than 500 files. Triggers might not fire at all or fail to return random files.

      If this problem happens to you, try moving the files that triggers no longer need to work on to a separate storage folder. This recommendation also means you'll need to find a way that automates moving these files to storage.

    - Disable last modified timestamp preservation in any external tool or client that you use with your SFTP server.

      If you use any external tool or client that adds or updates files on your SFTP server, disable any feature that preserves a file's last modified timestamp. SFTP triggers work by polling, or checking, the SFTP file system and looking for any files that changed since the last poll. SFTP built-in connector triggers compare file versions using file attributes such as the last modified timestamp, size, permissions, and name. If you add or update a file with a timestamp that's earlier than the currently tracked last modified timestamp, the SFTP trigger won't detect this file.

      The following table lists some commonly used tools that preserve this timestamp and the steps to disable this feature:

      | Tool | Steps to disable |
      |------|------------------|
      | WinSCP | Go to **Options** > **Preferences** > **Transfer** > **Edit** > **Preserve timestamp** > **Disable**. |
      | FileZilla | Go to **Transfer** > **Preserve timestamps of transferred files** > **Disable**. |

  - **Incomplete or delayed results**

    When an SFTP trigger checks for a newly created, added, or updated file, the trigger also checks whether the file is complete. For example, a file might have changes in progress when the trigger checks the SFTP server. To avoid returning an incomplete file, the trigger notes the file's last modified timestamp, but doesn't immediately return the file. Instead, the trigger returns the file only when the trigger checks the server again.

    Sometimes, this behavior might cause a delay that lasts as long as almost twice the trigger's polling interval. Due to this behavior, if you disable the SFTP trigger's **Split On** setting, the SFTP trigger might not return all files at the same time.

---

## Known issues and limitations with actions

| Action | Known issues and limitations |
|--------|------------------------------|
| Copy file | Performs the file copy entirely on the SFTP server, so no data flows into your workflow, and the action's output body contains no data. Performance depends entirely on your file server's performance, for example, CPU, storage type, and so on. Make sure the destination path is a file path that includes the file name, not a folder path. |
| Get file content | Returns file content up to 200 MB per file. The output contains the file content along with file name and file size. This action handles different file types in different ways, based on the file extension. For example, binary file types are read as a stream of bytes, which is written to a memory buffer and encoded as a base64 string. If a file doesn't have an extension, the action handles the file as binary data. The action returns the file content, file name, and file size as output. |
| Get file content (V2) | Returns file content of any size. The action handles files smaller than 100 MB in the same way as the V1 action. For files larger than 100 MB, the action handles the content as a stream of bytes, no matter the file type. The action saves the data directly to storage, skipping the memory buffer and resulting in better performance for larger files. The action returns only the file content as output. |
| Rename file | Renames a file in the same folder. - Make sure that the input parameters named **File path** and **New name** specify the file path for the file to rename and the new file name to use, respectively. The new file name must be only the name without the path. - This action doesn't permit moving files across different folders, so instead, use the **Copy file** action and **Delete file** action in this order in your workflow. |
| Upload file content | Uploads the specified content to the specified file path on the SFTP server. The action currently supports uploading content up to 2 GB. - If you don't specify the optional input parameter named **The file content**, the action creates an empty file. - If you set the required input parameter named **Overwrite existing files** to **No**, and you try to overwrite the existing file, the action fails with the error message **Bad Request (HTTP 400)**. |

---

## Troubleshoot errors

### Connection errors

The following errors might happen when you try to create the SSH connection before any trigger or actions starts to run. All these errors use `400` as the HTTP status code and are not retryable, which means that Azure Logic Apps doesn't retry the operation even if you set a custom retry policy. Only those operations that fail with the status codes 408, 429, and 5xx are retried, based on the retry interval specified by the retry policy. You can always manually resubmit the workflow run to try again.

| Error message | Cause and resolution |
|---------------|----------------------|
| The provided input for port is invalid. Please provide a valid integer in range [1,65535] without any leading and trailing whitespaces. | The Port input parameter in the connection setup must be an integer within the range from 1 to 65,535 and can't have any trailing or leading whitespaces. |
| The SFTP host can't be trusted because the host key MD5 fingerprint '\<fingerprint-value-from-host-server\>' doesn't match the specified fingerprint '\<fingerprint-value-from-input\>'. | Make sure that the provided MD5 fingerprint matches the fingerprint expected by the SFTP host server. |
| The specified host key fingerprint doesn't use a valid format. The fingerprint must be an MD5 hash of the host's public key where octets are separated by a colon (':'). Received error: \<format-error\> | Make sure that provided MD5 fingerprint uses MD5 hash format, not other hashes such as SHA-256. The following example shows a valid MD5 hash format: `f6:fc:1c:03:17:5f:67:4f:1f:0b:50:5a:9f:f9:30:e5` |
| The root directory parameter isn't valid. The value must start either with a path separator such as slashes ('/' and '\\'), or with an alphabetic character followed by a colon (':'). | - Unix-based file systems use a path separator at the start of absolute paths. - Windows-based file paths can start with C: or other alphabets. No other combinations are permitted. If your file system is exceptionally different, ignore the root directory parameter and provide full paths in all applicable SFTP trigger and action inputs. |
| Invalid private key file. | You must provide a valid private key in the connection parameters. For more information, see private keys supported by SSH.NET. |
| Key exchange negotiation failed. | See key exchange methods supported by SSH.NET. |
| - Invalid public key. - Invalid private key. - Encryption error. | Any of these errors might result from encryption failure while exchanging data. If all the actions in the workflow fail to run, make sure that your SFTP server uses one of the encryption methods supported by SSH.NET. |

### Operation errors

| Scope | Status Code | Error message | Cause and resolution |
|-------|-------------|---------------|----------------------|
| All triggers | 400 | The specified file extension name '\<file-extension-name\>' for the input parameter named '\<input-parameter\>' is prefixed with a period ('.') as a separator. File extension names must omit this separator. | In trigger inputs, omit the period (.) prefix from file extension names, for example, use "xlsx", not ".xslx". |
| Any action | 401 | \<error message from server\> | Make sure that you have permissions to perform this action on the specified resource. |
| Any action | 404 | The file or directory path '\<file-path\>' isn't valid. | The file with the provided path doesn't exist. To skip deletion when you're not sure whether the file exists, use the input parameter named **Skip deletion if file doesn't exist**. |
| Copy file | 400 | The file with path '\<file-path\>' already exists. To overwrite existing files, set the input parameter named **Overwrite existing files**. | Set the **Overwrite existing files** input parameter to **True** when you want to overwrite existing files using this action. |
| Copy file | 400 | The source and destination paths must be file paths that end with a file name, not a folder name. | Make sure the specified source and destination paths end with file names, not folder names. |
| Delete file | 400 | The specified path '\<path\>' is a folder path, which this action can't delete. Provide a file path instead. | Make sure the path is a file path, not a folder path. |
| Get file content | 400 | Can't read the file content because the target path '\<file-path\>' is a folder path. | Make sure to provide a path to a file, not a folder. |
| Get file content | 400 | The file size of the file with path '\<file-path\>' is a negative value '\<file-size\>' as returned by the server. | Some servers don't handle file metadata well and can erroneously return a negative file size. |
| Get file content | 400 | Read operations aren't allowed on the '\<file-name\>' file. Make sure that you have read permissions for this file. | If you don't have read permissions for the file, you need to first set up permissions. |
| Get file content | 413 | Can't get the file that's named '\<file-path\>'. The file size '\<file-size\>' exceeds the limit of '\<file-size-limit\>' bytes for this action. For larger files, use the **Get file content (V2)** action. | To get files that aren't referenceable in memory, use the **Get file content (V2)** action. |
| Rename file | 409 | Can't rename the file to the new file path '\<new-file-path\>'. A file already exists with this path. This action doesn't allow overwriting files. | Make sure that no file already exists with the specified name that you want to use. |
| Upload file content | 400 | The specified file path '\<file-path\>' doesn't have a valid file name. Include a valid file name. | Make sure to provide a path that ends with a file name, not a directory name. |
| Upload file content | 409 | The file with path '\<file-path\>' already exists. To overwrite existing files, set the input parameter named **Overwrite existing files**. | Set the **Overwrite existing files** input parameter to **True** when you want to overwrite existing files using this action. |

---

## Authentication

### SSH host address

The IP or host name for the SSH server host.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SSH host address | The IP or host name for the SSH server host. | string | True | |

### Username

The username for SFTP server sign-in and authentication.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Username | The username for SFTP server sign-in and authentication. | string | True | |

### Password

The password for SFTP server sign-in and authentication.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | The password for SFTP server sign-in and authentication. | securestring | False | |

### Port number

The port number for the SFTP server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Port number | The port number for the SFTP server. | int | False | |

### Root directory

The root directory on the SFTP server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Root directory | The root directory on the SFTP server. | string | False | |

### SSH private key

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SSH private key | | string | False | |

### SSH private key passphrase

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| SSH private key passphrase | | securestring | False | |

### Host key fingerprint

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Host key fingerprint | | string | False | |

### Disable Connection Cache

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Disable Connection Cache | | bool | False | |

---

## Actions

| Action | Description |
|--------|-------------|
| Copy file | Copy a file from the source file path to the destination file path. |
| Create folder | Create a folder using the specified folder path. |
| Delete file | Delete the file using the specified file path. |
| Delete folder (Preview) | Delete the folder using the specified path. Use optional input 'Recursive delete' to delete a non-empty folder along with all its contents. |
| Extract archive | Extract an archive file inside the specified folder. Only ZIP archives are supported. |
| Get file content | Get the full file content, provided that the file size doesn't exceed the limit of '209715200' bytes. For larger files, use the 'Get file content (V2)' action. |
| Get file content (V2) | Get the content from the specified file. By default, the file size limit is '2147483648' bytes. |
| Get file or directory metadata | Get the metadata for a file or a directory in the specified path. |
| List folder | List the files and folders present in the given folder with their metadata. To exclude subfolders in the action output, use the optional input parameter 'List files only'. |
| Rename file | Change the name of the specified file. The renamed file stays in the same directory. |
| Upload file content | Upload the specified content to a file in the specified file path. To create an empty file, ignore the optional input parameter named 'File content'. |

### Copy file

- **Operation ID:** copyFile

Copy a file from the source file path to the destination file path.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Source file path | sourceFilePath | True | string | The file path for the file to copy, relative to the root directory. |
| Destination file path | destinationFilePath | True | string | The destination file path, relative to the root directory. |
| Overwrite destination file | overWriteFileIfExists | | string | If the destination file exists, overwrite that file. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Name of file or directory | name | string | The name for the file or directory. |
| Absolute file path | absolutePath | string | The absolute path for the file. |
| Path relative to root directory | pathRelativeToRootDirectory | string | The path relative to the root directory for the SFTP server. |
| File size in bytes | fileSize | string | The uploaded file size in bytes. |
| Media Type | mediaType | string | Type of media. |
| Last access time | lastAccessTime | string | The time when the file was last accessed. |
| Last updated time | lastModifiedTime | string | The time when the file was last updated. |
| Is the item a directory | isDirectory | string | When this value is 'True', the item is a directory. |
| Read permission | readPermission | string | A value that indicates whether you have read permissions on this file or folder. |
| Write permission | writePermission | string | A value that indicates whether you have write permissions on this file or folder. |
| Execute permission | executePermission | string | A value that indicates whether you have execute permissions on this file or folder. |

### Create folder

- **Operation ID:** createFolder

Create a folder using the specified folder path.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The path for the folder to create. This path must be relative to the root directory. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Name of file or directory | name | string | The name for the file or directory. |
| Absolute file path | absolutePath | string | The absolute path for the file. |
| Path relative to root directory | pathRelativeToRootDirectory | string | The path relative to the root directory for the SFTP server. |
| File size in bytes | fileSize | string | The uploaded file size in bytes. |
| Media Type | mediaType | string | Type of media. |
| Last access time | lastAccessTime | string | The time when the file was last accessed. |
| Last updated time | lastModifiedTime | string | The time when the file was last updated. |
| Is the item a directory | isDirectory | string | When this value is 'True', the item is a directory. |
| Read permission | readPermission | string | A value that indicates whether you have read permissions on this file or folder. |
| Write permission | writePermission | string | A value that indicates whether you have write permissions on this file or folder. |
| Execute permission | executePermission | string | A value that indicates whether you have execute permissions on this file or folder. |

### Delete file

- **Operation ID:** deleteFile

Delete the file using the specified file path.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path with the file extension if any, relative to the root directory. |
| Skip deletion if file doesn't exist | skipDelete | | string | If file doesn't exist, deletion is skipped, and this action won't fail. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| File deleted or not | fileDeleted | string | When this value is 'True', the file was deleted. |

### Delete folder (Preview)

- **Operation ID:** deleteFolder

Delete the folder using the specified path. Use optional input 'Recursive delete' to delete a non-empty folder along with all its contents.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The folder path relative to the root directory. |
| Recursively delete contents | recursiveDelete | | string | This action will delete all files and subfolders in the given folder when this input is set to 'True'. Otherwise if the folder is non-empty, the action will fail. |

### Extract archive

- **Operation ID:** extractArchive

Extract an archive file inside the specified folder. Only ZIP archives are supported.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | | string | The relative path to the archive file. The file name must have a .zip extension. |
| Folder path | folderPath | True | string | The folder path where to extract the files, relative to the root directory. |
| Overwrite existing files behaviour | overwriteExistingFilesBehaviour | | string | The input determines the behaviour when dealing with files having same path as the archive already exist on the file server. |
| File content | content | | string | The relative path to the archive file. The file name must have a .zip extension. |

#### Returns

The list containing the metadata for all the extracted files.

- **Extract archive output body** array

### Get file content

- **Operation ID:** getFileContent

Get the full file content, provided that the file size doesn't exceed the limit of '209715200' bytes. For larger files, use the 'Get file content (V2)' action.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path with the file extension if any, relative to the root directory. |
| Infer Content Type | inferContentType | | string | Infer content-type based on extension |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| File name | fileName | string | The file name. |
| Content of the specified file | content | string | The file content. |

### Get file content (V2)

- **Operation ID:** getFileContentV2

Get the content from the specified file. By default, the file size limit is '2147483648' bytes.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path with the file extension if any, relative to the root directory. |
| Infer Content Type | inferContentType | | string | Infer content-type based on extension |

#### Returns

The content from the file provided as input.

- **Output body from the 'Get file content (V2)' action** string

### Get file or directory metadata

- **Operation ID:** getMetadata

Get the metadata for a file or a directory in the specified path.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File or folder path | fileOrFolderPath | True | string | The file or folder path, relative to the root directory. |

### List folder

- **Operation ID:** listFolder

List the files and folders present in the given folder with their metadata. To exclude subfolders in the action output, use the optional input parameter 'List files only'.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The path to the folder that's to be listed relative to the root directory. |
| List only the files | filesOnly | | string | When this parameter is set to 'True', only the files in the specified folder are listed. Subfolders are excluded. |

#### Returns

The body of the 'List folder' action.

- **List folder output body** array

### Rename file

- **Operation ID:** renameFile

Change the name of the specified file. The renamed file stays in the same directory.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path with the file extension if any, relative to the root directory. |
| New name | newFileName | True | string | The new name for the file. This value must be only the name, not the path. |
| Get metadata for renamed file | fetchMetadata | | string | When this value is 'True', return the metadata of the renamed file in this action's output. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Name of file or directory | name | string | The name for the file or directory. |
| Absolute file path | absolutePath | string | The absolute path for the file. |
| Path relative to root directory | pathRelativeToRootDirectory | string | The path relative to the root directory for the SFTP server. |
| File size in bytes | fileSize | string | The uploaded file size in bytes. |
| Media Type | mediaType | string | Type of media. |
| Last access time | lastAccessTime | string | The time when the file was last accessed. |
| Last updated time | lastModifiedTime | string | The time when the file was last updated. |
| Is the item a directory | isDirectory | string | When this value is 'True', the item is a directory. |
| Read permission | readPermission | string | A value that indicates whether you have read permissions on this file or folder. |
| Write permission | writePermission | string | A value that indicates whether you have write permissions on this file or folder. |
| Execute permission | executePermission | string | A value that indicates whether you have execute permissions on this file or folder. |

### Upload file content

- **Operation ID:** uploadFileContent

Upload the specified content to a file in the specified file path. To create an empty file, ignore the optional input parameter named 'File content'.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| File path | filePath | True | string | The file path with the file extension if any, relative to the root directory. |
| File content | content | | string | The file content to upload. |
| Overwrite existing files | overWriteFileIfExists | True | string | When this value is 'True', overwrite the file, if already existing. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Absolute file path | filePath | string | The absolute path for the uploaded file. |
| File size in bytes | size | string | The uploaded file size in bytes. |
| File name | filename | string | The file name. |
| Path relative to root directory | pathRelativeToRootDirectory | string | The path relative to the root directory for the SFTP server. |

---

## Triggers

| Trigger | Description |
|---------|-------------|
| When a file is added or updated | This trigger fires when a new file is added or an existing file is updated in the monitored folder. The trigger gets only one file per run. If multiple files exist, the trigger gets these files using multiple runs. |
| When files are added or updated | This trigger fires when one or multiple new files are added or updated in the monitored folder. If multiple files exist, the trigger gets all the files in a single run. To process files one at a time, enable the trigger's 'splitOn' property. |

### When a file is added or updated

- **Operation ID:** whenFileIsAddedOrModified

This trigger fires when a new file is added or an existing file is updated in the monitored folder. The trigger gets only one file per run. If multiple files exist, the trigger gets these files using multiple runs.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The folder path relative to the root directory. |
| Include file content | includeFileContent | | string | If this value is 'True', get the file content along with the file name and properties. |
| Old files cutoff timestamp | oldFilesCutoffTimestamp | | string | Ignore files that are older than the specified cutoff timestamp. Use the format 'YYYY-MM-DDTHH:MM:SS'. To disable this option, ignore this parameter. |
| File name extensions to ignore | ignoreFileExtensions | | string | Ignore files that have any of the specified file name extensions. Don't prefix extensions with the period ('.') separator. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| File content | content | string | The file content. |
| fileMetadata | fileMetadata | string | |

### When files are added or updated

- **Operation ID:** whenFilesAreAddedOrModified

This trigger fires when one or multiple new files are added or updated in the monitored folder. If multiple files exist, the trigger gets all the files in a single run. To process files one at a time, enable the trigger's 'splitOn' property.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Folder path | folderPath | True | string | The folder path relative to the root directory. |
| Include file content | includeFileContent | | string | If this value is 'True', get the file content along with the file name and properties. |
| Maximum file count | maxFileCount | | string | The maximum number of files to include in a single trigger run. If you don't want this limit, ignore this parameter. |
| Old files cutoff timestamp | oldFilesCutoffTimestamp | | string | Ignore files that are older than the specified cutoff timestamp. Use the format 'YYYY-MM-DDTHH:MM:SS'. To disable this option, ignore this parameter. |
| File name extensions to ignore | ignoreFileExtensions | | string | Ignore files that have any of the specified file name extensions. Don't prefix extensions with the period ('.') separator. |

#### Returns

The files that were added or updated.

- **Files added or updated** array

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#connector-how-to-guide)
- [Differences from the SFTP-SSH managed connector](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#differences-from-the-sftp-ssh-managed-connector)
- [Connection creation, authentication, and permissions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#connection-creation-authentication-and-permissions)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#built-in-connector-settings)
- [Known issues and limitations with triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#known-issues-and-limitations-with-triggers)
- [Known issues and limitations with actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#known-issues-and-limitations-with-actions)
- [Troubleshoot errors](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#troubleshoot-errors)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/sftp/#triggers)
