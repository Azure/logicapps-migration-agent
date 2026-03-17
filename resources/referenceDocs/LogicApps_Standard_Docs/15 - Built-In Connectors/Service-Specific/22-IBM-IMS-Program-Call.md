# IMS Program Call

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/imsprogramcall/

Connect to Information Management System (IMS) resources.

This article describes the operations for the IBM IMS built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps.

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Connector how-to guide

For more information about integrating IMS programs on IBM mainframes with your workflow in Azure Logic Apps, see [Integrate IMS programs on IBM mainframes with Standard workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/integrate-ims-apps-ibm-mainframe).

## Authentication

### The IMS system ID

The name for the IMS system where IMS Connect directs incoming requests.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| The IMS system ID | The name for the IMS system where IMS Connect directs incoming requests. | string | True | |

### ITOC exit name

The name for the exit routine that IMS uses to handle incoming requests.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| ITOC exit name | The name for the exit routine that IMS uses to handle incoming requests. | string | False | |

### MFS mod name

The name associated with the outbound IMS message output descriptor.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| MFS mod name | The name associated with the outbound IMS message output descriptor. | string | False | |

### Use the HWSO1 security exit

The server will use the HWSO1 security exit.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Use the HWSO1 security exit | The server will use the HWSO1 security exit. | bool | False | |

### Server certificate common name

The name of the Transport Layer Security (TLS) certificate to use.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Server certificate common name | The name of the Transport Layer Security (TLS) certificate to use. | string | False | |

### Client Certificate Thumbprint

The client certificate thumbprint for use with Mutual TLS authentication

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Client Certificate Thumbprint | The client certificate thumbprint for use with Mutual TLS authentication | securestring | False | |

### Code page

The code page number to use for converting text.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Code page | The code page number to use for converting text. | int | False | |

### Password

The optional user password for connection authentication.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | The optional user password for connection authentication. | securestring | False | |

### Port number

The port number to use for connecting to the server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Port number | The port number to use for connecting to the server. | int | True | |

### Server name

The server name.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Server name | The server name. | string | True | |

### Timeout

The timeout period in seconds while waiting for responses from the server.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Timeout | The timeout period in seconds while waiting for responses from the server. | int | False | |

### User name

The optional username for connection authentication.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| User name | The optional username for connection authentication. | securestring | False | |

### Use TLS

Secure the connection with Transport Layer Security (TLS).

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Use TLS | Secure the connection with Transport Layer Security (TLS). | bool | False | |

### Validate server certificate

Validate the server's certificate.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Validate server certificate | Validate the server's certificate. | bool | False | |

## Actions

| Operation | Description |
|-----------|-------------|
| Call an IMS program | Execute an Information Management System (IMS) program. |

### Call an IMS program

- **Operation ID:** executeMethod

Execute an Information Management System (IMS) program.

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
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/imsprogramcall/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/imsprogramcall/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/imsprogramcall/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/imsprogramcall/#actions)
