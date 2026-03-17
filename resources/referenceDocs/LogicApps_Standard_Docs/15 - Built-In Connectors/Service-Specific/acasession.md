<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/acasession/ -->

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Authentication
### Managed identity

Managed identity

### Parameters

Name
Description
Type
Required
Allowed Values

Pool management endpoint
The Azure Container Apps pool management endpoint.
string
True

Managed identity
Managed identity
string
True

Managed identity
Managed identity
string
False

	## Actions
		
				
					
						[Delete file (Preview)](#delete-file-(preview))
					
					
						
Deletes a file from a python code interpreter session

					
				
				
					
						[Download file (Preview)](#download-file-(preview))
					
					
						
Downloads a file from a python code interpreter session

					
				
				
					
						[Execute Python code (Preview)](#execute-python-code-(preview))
					
					
						
Executes code in a Python code interpreter session.

					
				
				
					
						[Upload file (Preview)](#upload-file-(preview))
					
					
						
Uploads a file to a python code interpreter session

					
				
		
### Delete file (Preview)
	
		
			Operation ID:
				fileDelete
			
		
	

	
Deletes a file from a python code interpreter session

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Input file name
			
			fileName
			
					True
			
			
				string
			
			
				
The input file name.

			
		
		
			
				Session ID
			
			sessionId
			
					True
			
			
				string
			
			
				
The session where the file is stored.

			
		
		#### Returns
			
			
				
					Output
					
						[object](#object)
					
								
			
### Download file (Preview)
	
		
			Operation ID:
				fileDownload
			
		
	

	
Downloads a file from a python code interpreter session

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Input file name
			
			fileName
			
					True
			
			
				string
			
			
				
The input file name.

			
		
		
			
				Session ID
			
			sessionId
			
					True
			
			
				string
			
			
				
The session where the file is stored.

			
		
		#### Returns
			
			
				
					Output
					
						[object](#object)
					
								
			
### Execute Python code (Preview)
	
		
			Operation ID:
				executeCode
			
		
	

	
Executes code in a Python code interpreter session.

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Python code
			
			pythonCode
			
					True
			
			
				string
			
			
				
The python code to be executed.

			
		
		
			
				Session ID
			
			sessionId
			
			
			
				string
			
			
				
The session where the code will be executed.

			
		
		#### Returns

	
		Name
		Path
		Type
		Description
	
		
			
				Execution status
			
			
				status
			
			
				string
			
			
				
The status of the executed code.

			
		
		
			
				Result
			
			
				result
			
			
				string
			
			
				
The result from the executed code.

			
		
		
			
				Standard output
			
			
				stdout
			
			
				string
			
			
				
The standard output from the code execution.

			
		
		
			
				Standard error
			
			
				stderr
			
			
				string
			
			
				
The standard output from the code execution.

			
		
		
			
				Session ID
			
			
				sessionId
			
			
				string
			
			
				
The session identifier.

			
		

### Upload file (Preview)
	
		
			Operation ID:
				fileUpload
			
		
	

	
Uploads a file to a python code interpreter session

		#### Parameters

	
		Name
		Key
		Required
		Type
		Description
	
		
			
				Input files to upload
			
			files
			
					True
			
			
				string
			
			
				
The input files to upload.

			
		
		
			
				Session ID
			
			sessionId
			
			
			
				string
			
			
				
The session where the file will be uploaded.

			
		
		#### Returns

	
		Name
		Path
		Type
		Description
	
		
			
				Input file name
			
			
				filename
			
			
				string
			
			
				
The input file name.

			
		
		
			
				File size
			
			
				size
			
			
				string
			
			
				
The session identifier.

			
		
		
			
				Last modified time
			
			
				lastModifiedTime
			
			
				string
			
			
				
The file size after saving to the session.

			
		
		
			
				Session ID
			
			
				sessionId
			
			
				string
			
			
				
The session identifier.