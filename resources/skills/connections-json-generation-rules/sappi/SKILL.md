---
name: connections-json-generation-rules
description: Rules for generating connections.json definitions for Logic Apps connectors.
---

# SAP PI/PO to Logic Apps — Connections.json Generation

> **Rules for generating connections.json files for Logic Apps connectors and managed identities.**

## Connections Overview

The `connections.json` file defines how Logic Apps workflows connect to external systems and services:

```json
{
  "managedApiConnections": { ... },
  "serviceProviderConnections": { ... },
  "functionConnections": { ... }
}
```

## Managed API Connections

### Rule 1: HTTP Connection

For SAP PI/PO HTTP adapters:

```json
{
  "http_outbound": {
    "type": "inapp",
    "kind": "ServiceProvider",
    "inputs": {
      "runtime": {
        "protocol": "https"
      }
    }
  }
}
```

### Rule 2: SAP ERP Connection

For SAP adapters (iDOC, BAPI):

```json
{
  "sap_erp": {
    "type": "Microsoft.Web/connections",
    "apiVersion": "2016-06-01",
    "location": "[resourceGroup().location]",
    "properties": {
      "displayName": "SAP ERP Connection",
      "api": {
        "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', resourceGroup().location, 'sap')]"
      },
      "parameterValues": {
        "server": "[parameters('sap_server_url')]",
        "username": "[parameters('sap_username')]",
        "password": "[parameters('sap_password')]",
        "gateway": "[parameters('sap_gateway_name')]"
      }
    }
  }
}
```

### Rule 3: SQL Server Connection

For JDBC/Database adapters:

```json
{
  "sql_database": {
    "type": "Microsoft.Web/connections",
    "apiVersion": "2016-06-01",
    "location": "[resourceGroup().location]",
    "properties": {
      "displayName": "SQL Database Connection",
      "api": {
        "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', resourceGroup().location, 'sql')]"
      },
      "parameterValues": {
        "server": "[parameters('sql_server')]",
        "database": "[parameters('sql_database')]",
        "username": "[parameters('sql_username')]",
        "password": "[parameters('sql_password')]"
      },
      "authentication": {
        "type": "ManagedServiceIdentity"
      }
    }
  }
}
```

### Rule 4: Service Bus Connection

For JMS adapters and message queueing:

```json
{
  "service_bus": {
    "type": "Microsoft.Web/connections",
    "apiVersion": "2016-06-01",
    "location": "[resourceGroup().location]",
    "properties": {
      "displayName": "Service Bus Connection",
      "api": {
        "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', resourceGroup().location, 'servicebus')]"
      },
      "parameterValues": {
        "connectionString": "[parameters('service_bus_connection_string')]"
      },
      "authentication": {
        "type": "ManagedServiceIdentity"
      }
    }
  }
}
```

### Rule 5: SFTP Connection

For file transfer adapters:

```json
{
  "sftp": {
    "type": "Microsoft.Web/connections",
    "apiVersion": "2016-06-01",
    "location": "[resourceGroup().location]",
    "properties": {
      "displayName": "SFTP Connection",
      "api": {
        "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', resourceGroup().location, 'sftp')]"
      },
      "parameterValues": {
        "host": "[parameters('sftp_host')]",
        "username": "[parameters('sftp_username')]",
        "password": "[parameters('sftp_password')]",
        "port": "[parameters('sftp_port')]",
        "sshPrivateKey": "[parameters('sftp_private_key')]"
      }
    }
  }
}
```

### Rule 6: Email Connection

For email adapters (Outlook, Gmail):

```json
{
  "outlook_mail": {
    "type": "Microsoft.Web/connections",
    "apiVersion": "2016-06-01",
    "location": "[resourceGroup().location]",
    "properties": {
      "displayName": "Outlook Mail Connection",
      "api": {
        "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', resourceGroup().location, 'outlook')]"
      },
      "authentication": {
        "type": "OAuth",
        "audience": "https://graph.microsoft.com"
      }
    }
  }
}
```

## Service Provider Connections

For built-in connectors and special service types:

### Rule 7: Blob Storage Connection

```json
{
  "blob_storage": {
    "type": "Microsoft.Web/connections",
    "apiVersion": "2016-06-01",
    "location": "[resourceGroup().location]",
    "properties": {
      "displayName": "Blob Storage Connection",
      "api": {
        "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', resourceGroup().location, 'azureblob')]"
      },
      "parameterValues": {
        "storageAccount": "[parameters('storage_account_name')]",
        "accessKey": "[parameters('storage_account_key')]"
      },
      "authentication": {
        "type": "ManagedServiceIdentity"
      }
    }
  }
}
```

### Rule 8: File Share Connection

```json
{
  "file_share": {
    "type": "Microsoft.Web/connections",
    "apiVersion": "2016-06-01",
    "location": "[resourceGroup().location]",
    "properties": {
      "displayName": "File Share Connection",
      "api": {
        "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', resourceGroup().location, 'azurefile')]"
      },
      "parameterValues": {
        "accountName": "[parameters('file_share_account')]",
        "accessKey": "[parameters('file_share_key')]",
        "domain": "[parameters('file_share_domain')]"
      }
    }
  }
}
```

## Adapter-to-Connection Mapping

| SAP PI/PO Adapter | Azure Connection | Configuration |
|---|---|---|
| HTTP Adapter | HTTP (built-in) | No connection needed |
| SOAP Adapter | HTTP Request + Web Service | HTTP connection |
| File Adapter | Blob Storage / File Share | Storage account connection |
| JDBC Adapter | SQL Server / Azure SQL | Database connection string |
| JMS Adapter | Service Bus | Connection string |
| SFTP Adapter | SFTP Connector | Host, credentials, port |
| Email Adapter | Outlook / Gmail | OAuth authentication |
| SAP Adapter (iDOC/BAPI) | SAP Connector | Gateway, credentials |
| FTP Adapter | FTP Connector | Host, credentials, port |
| Database Adapter | SQL / Oracle Connector | Connection string |

## Generation Rules

### Rule 9: Generate from Communication Channels

For each SAP PI/PO Communication Channel, generate a connection:

```
FOR EACH channel IN communicationChannels:
  connection := CREATE_CONNECTION(
    name: channel.name,
    type: ADAPTER_TO_CONNECTION_TYPE(channel.adapter),
    parameters: channel.properties
  )
  connections[channel.id] = connection
END
```

### Rule 10: Extract Connection Credentials

Credentials should come from:

1. **Azure Key Vault** (preferred): `@reference(resourceId(...)).properties.secretValue`
2. **Environment Variables**: `@parameters('credential_name')`
3. **Secure Strings**: Never hardcode in JSON

**Example using Key Vault:**

```json
{
  "sap_password": "[reference(resourceId('Microsoft.KeyVault/vaults/secrets', variables('keyVaultName'), 'sap-password')).value]"
}
```

### Rule 11: Add Managed Identity Authentication

```json
{
  "authentication": {
    "type": "ManagedServiceIdentity",
    "identity": "[reference(resourceId('Microsoft.Web/workflows', parameters('logicAppName')), '2019-05-01', 'full').identity.principalId]"
  }
}
```

## Connections.json Template

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": {
      "type": "string"
    },
    "environment": {
      "type": "string"
    },
    "sap_server_url": {
      "type": "securestring"
    },
    "sql_connection_string": {
      "type": "securestring"
    },
    "service_bus_connection_string": {
      "type": "securestring"
    },
    "storage_account_name": {
      "type": "string"
    },
    "storage_account_key": {
      "type": "securestring"
    }
  },
  "resources": [
    {
      "type": "Microsoft.Web/connections",
      "apiVersion": "2016-06-01",
      "name": "sap-connection",
      "location": "[parameters('location')]",
      "properties": {
        "displayName": "SAP ERP",
        "api": {
          "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), 'sap')]"
        },
        "parameterValues": {
          "server": "[parameters('sap_server_url')]"
        },
        "authentication": {
          "type": "ManagedServiceIdentity"
        }
      }
    },
    {
      "type": "Microsoft.Web/connections",
      "apiVersion": "2016-06-01",
      "name": "sql-connection",
      "location": "[parameters('location')]",
      "properties": {
        "displayName": "SQL Database",
        "api": {
          "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), 'sql')]"
        },
        "parameterValues": {
          "connectionString": "[parameters('sql_connection_string')]"
        },
        "authentication": {
          "type": "ManagedServiceIdentity"
        }
      }
    }
  ],
  "outputs": {
    "sap_connection_id": {
      "type": "string",
      "value": "[resourceId('Microsoft.Web/connections', 'sap-connection')]"
    },
    "sql_connection_id": {
      "type": "string",
      "value": "[resourceId('Microsoft.Web/connections', 'sql-connection')]"
    }
  }
}
```

## Workflow Reference to Connections

In workflow.json, reference connections:

```json
{
  "actions": {
    "Send_to_SAP": {
      "type": "Send_HTTP_Request",
      "inputs": {
        "uri": "@parameters('sap_endpoint')",
        "body": "@body('Transform')",
        "authentication": {
          "type": "ManagedServiceIdentity",
          "audience": "@parameters('sap_audience')"
        }
      }
    }
  }
}
```

## Best Practices

1. **Use Managed Identity** whenever possible
2. **Store secrets in Key Vault**, not in JSON
3. **Use connection objects** for all external integrations
4. **Test connections** before deploying workflows
5. **Document connection requirements** for each workflow
6. **Rotate credentials** periodically
7. **Monitor connection health** in Application Insights

This ensures secure, maintainable connections for all migrated workflows.
