# CICS Program Call

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/cicsprogramcall/

Connect to Customer Information Control System (CICS) resources.

This article describes the operations for the IBM CICS built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps.

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Connector how-to guide

For more information about integrating CICS programs on IBM mainframes with your workflow in Azure Logic Apps, see [Integrate Azure AI services with Standard workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/integrate-cics-apps-ibm-mainframe).

## Authentication

### ELM - Link

Enhanced Listener Message - Link.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Code page | The code page number to use for converting text. | int | False | |
| Password | The optional user password for connection authentication. | securestring | False | |
| Port number | The port number to use for connecting to the server. | int | True | |
| Server name | The server name. | string | True | |
| Timeout | The timeout period in seconds while waiting for responses from the server. | int | False | |
| User name | The optional username for connection authentication. | securestring | False | |
| Use TLS | Secure the connection with Transport Layer Security (TLS). | bool | False | |
| Validate server certificate | Validate the server's certificate. | bool | False | |
| Server certificate common name | The name of the Transport Layer Security (TLS) certificate to use. | string | False | |
| Client Certificate Thumbprint | The client certificate thumbprint for use with Mutual TLS authentication | securestring | False | |
| Use IBM request header format | The server expects ELM or TRM headers in the IBM format. | bool | False | |

### ELM - User Data

Enhanced Listener Message - User Data.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Code page | The code page number to use for converting text. | int | False | |
| Password | The optional user password for connection authentication. | securestring | False | |
| Port number | The port number to use for connecting to the server. | int | True | |
| Server name | The server name. | string | True | |
| Timeout | The timeout period in seconds while waiting for responses from the server. | int | False | |
| User name | The optional username for connection authentication. | securestring | False | |
| Use TLS | Secure the connection with Transport Layer Security (TLS). | bool | False | |
| Validate server certificate | Validate the server's certificate. | bool | False | |
| Server certificate common name | The name of the Transport Layer Security (TLS) certificate to use. | string | False | |
| Client Certificate Thumbprint | The client certificate thumbprint for use with Mutual TLS authentication | securestring | False | |
| Use IBM request header format | The server expects ELM or TRM headers in the IBM format. | bool | False | |

### HTTP - Link

HTTP - Link.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Code page | The code page number to use for converting text. | int | False | |
| Password | The optional user password for connection authentication. | securestring | False | |
| Port number | The port number to use for connecting to the server. | int | True | |
| Server name | The server name. | string | True | |
| Timeout | The timeout period in seconds while waiting for responses from the server. | int | False | |
| User name | The optional username for connection authentication. | securestring | False | |
| Use TLS | Secure the connection with Transport Layer Security (TLS). | bool | False | |
| Validate server certificate | Validate the server's certificate. | bool | False | |
| Alias transaction Id | The Customer Information Control System (CICS) transaction ID to use as the context for running the HTTP program. | string | False | |
| Allow HTTP redirects | Allow HTTP redirects. | bool | False | |
| User agent | The user agent that identifies the application to the server. | string | False | |
| The mirror program | The name for the Web Aware program that provides support for running CICS Link programs. | string | False | |

### HTTP - User Data

HTTP - User Data.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Code page | The code page number to use for converting text. | int | False | |
| Password | The optional user password for connection authentication. | securestring | False | |
| Port number | The port number to use for connecting to the server. | int | True | |
| Server name | The server name. | string | True | |
| Timeout | The timeout period in seconds while waiting for responses from the server. | int | False | |
| User name | The optional username for connection authentication. | securestring | False | |
| Use TLS | Secure the connection with Transport Layer Security (TLS). | bool | False | |
| Validate server certificate | Validate the server's certificate. | bool | False | |
| Alias transaction Id | The Customer Information Control System (CICS) transaction ID to use as the context for running the HTTP program. | string | False | |
| Allow HTTP redirects | Allow HTTP redirects. | bool | False | |
| User agent | The user agent that identifies the application to the server. | string | False | |

### TRM - Link

Transaction Request Message - Link.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Code page | The code page number to use for converting text. | int | False | |
| Password | The optional user password for connection authentication. | securestring | False | |
| Port number | The port number to use for connecting to the server. | int | True | |
| Server name | The server name. | string | True | |
| Timeout | The timeout period in seconds while waiting for responses from the server. | int | False | |
| User name | The optional username for connection authentication. | securestring | False | |
| Use TLS | Secure the connection with Transport Layer Security (TLS). | bool | False | |
| Validate server certificate | Validate the server's certificate. | bool | False | |
| Server certificate common name | The name of the Transport Layer Security (TLS) certificate to use. | string | False | |
| Client Certificate Thumbprint | The client certificate thumbprint for use with Mutual TLS authentication | securestring | False | |
| Use IBM request header format | The server expects ELM or TRM headers in the IBM format. | bool | False | |

### TRM - User Data

Transaction Request Message - User Data.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Code page | The code page number to use for converting text. | int | False | |
| Password | The optional user password for connection authentication. | securestring | False | |
| Port number | The port number to use for connecting to the server. | int | True | |
| Server name | The server name. | string | True | |
| Timeout | The timeout period in seconds while waiting for responses from the server. | int | False | |
| User name | The optional username for connection authentication. | securestring | False | |
| Use TLS | Secure the connection with Transport Layer Security (TLS). | bool | False | |
| Validate server certificate | Validate the server's certificate. | bool | False | |
| Server certificate common name | The name of the Transport Layer Security (TLS) certificate to use. | string | False | |
| Client Certificate Thumbprint | The client certificate thumbprint for use with Mutual TLS authentication | securestring | False | |
| Use IBM request header format | The server expects ELM or TRM headers in the IBM format. | bool | False | |

## Actions

| Operation | Description |
|-----------|-------------|
| Call a CICS program | Execute a Customer Information Control System (CICS) program. |

### Call a CICS program

- **Operation ID:** executeMethod

Execute a Customer Information Control System (CICS) program.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| HIDX name | hidx | True | string | The name for the HIDX file that has the actions' metadata. |
| Method name | method | True | string | The name of a method in the HIDX file. |
| Input parameters | inputParameters | True | string | A single object that has all the input parameters to the method. |

#### Returns

A single object that has all the output parameters from the method.

- **Output parameters** object

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/cicsprogramcall/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/cicsprogramcall/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/cicsprogramcall/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/cicsprogramcall/#actions)
