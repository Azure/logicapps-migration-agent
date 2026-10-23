---
name: scaffold-logic-apps-project
description: Rules for scaffolding the complete Logic Apps Standard project structure for SAP PI/PO migrations.
---

# SAP PI/PO to Logic Apps — Project Scaffolding Rules

> **Rules for scaffolding and initializing Logic Apps Standard project structure.**

## Project Structure

Create standard Logic Apps project layout:

```
logicapps-sappi-migration/
├── .github/
│   └── workflows/
│       ├── ci-build.yml
│       ├── cd-deploy.yml
│       └── security-scan.yml
├── .vscode/
│   ├── extensions.json
│   ├── launch.json
│   └── settings.json
├── infra/
│   ├── main.bicep
│   ├── parameters/
│   │   ├── dev.json
│   │   ├── staging.json
│   │   └── prod.json
│   └── modules/
│       ├── storage.bicep
│       ├── servicebus.bicep
│       └── connections.bicep
├── src/
│   ├── workflows/
│   │   ├── OrderProcessing/
│   │   │   ├── workflow.json
│   │   │   ├── parameters.json
│   │   │   └── connections.json
│   │   ├── InvoiceProcessing/
│   │   └── ...
│   ├── functions/
│   │   ├── order-validator/
│   │   │   ├── index.js
│   │   │   └── function.json
│   │   └── ...
│   ├── templates/
│   │   ├── mappings/
│   │   │   ├── order-to-internal.liquid
│   │   │   └── ...
│   │   └── schemas/
│   │       ├── order-schema.json
│   │       └── ...
│   └── connections/
│       ├── sap-connection.json
│       ├── sql-connection.json
│       └── ...
├── tests/
│   ├── unit/
│   │   ├── order-mapping.test.js
│   │   └── ...
│   ├── integration/
│   │   ├── order-workflow.test.js
│   │   └── ...
│   └── data/
│       ├── order-sample.json
│       └── ...
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── MIGRATION-GUIDE.md
│   └── API-REFERENCE.md
├── azure.yaml
├── package.json
├── README.md
└── .gitignore
```

## Initialization Rules

### Step 1: Create Project Directory

```bash
mkdir logicapps-sappi-migration
cd logicapps-sappi-migration
git init
```

### Step 2: Initialize Azure Dev CLI (azd)

```yaml
# azure.yaml
name: logicapps-sappi-migration
metadata:
  template: sappi-migration-template@0.1.0
services:
  api:
    project: ./infra
    language: bicep
    host: logicapps
```

### Step 3: Create Directory Structure

```bash
mkdir -p .github/workflows .vscode infra infra/modules infra/parameters
mkdir -p src/workflows src/functions src/templates src/connections
mkdir -p tests/unit tests/integration tests/data
mkdir -p docs
```

### Step 4: Create Configuration Files

#### .gitignore

```
node_modules/
.DS_Store
*.log
.env
.env.local
.vscode-test
out/
dist/
.funcpack/
*.zip
/bin
/obj
.vs/
.vscode/
```

#### .vscode/extensions.json

```json
{
  "recommendations": [
    "ms-azuretools.vscode-azurelogicapps",
    "ms-azuretools.vscode-azurefunctions",
    "ms-azuretools.vscode-azuretools",
    "ms-vscode.azure-account",
    "ms-vscode.extension-biome"
  ]
}
```

#### package.json

```json
{
  "name": "logicapps-sappi-migration",
  "version": "1.0.0",
  "description": "SAP PI/PO to Azure Logic Apps Standard migration",
  "scripts": {
    "build": "npm run build:workflows && npm run build:functions",
    "build:workflows": "bicep build ./infra/main.bicep",
    "build:functions": "cd src/functions && npm install",
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "lint": "eslint src/",
    "deploy": "azd deploy",
    "up": "azd up"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```

## Workflow Creation

For each Integration Process, create workflow structure:

### workflow.json Template

```json
{
  "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "logicAppName": {
      "type": "string"
    },
    "connections": {
      "type": "object"
    }
  },
  "triggers": {
    "http_trigger": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "method": "POST",
        "schema": {}
      }
    }
  },
  "actions": {
    "parse_input": {
      "type": "ParseJson",
      "inputs": {
        "content": "@triggerBody()",
        "schema": {}
      }
    }
  },
  "outputs": {}
}
```

### parameters.json Template

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "logicAppName": {
      "value": "order-processing-workflow"
    },
    "environment": {
      "value": "dev"
    }
  }
}
```

## Function Creation

For custom mappings or validation, create Azure Functions:

### Local Function Template

```javascript
// src/functions/order-validator/index.js
module.exports = async function (context, req) {
    try {
        const order = req.body;
        
        // Validation logic
        if (!order.orderId) {
            return {
                status: 400,
                body: { error: "orderId is required" }
            };
        }
        
        context.res = {
            status: 200,
            body: { valid: true, order: order }
        };
    } catch (error) {
        context.res = {
            status: 500,
            body: { error: error.message }
        };
    }
};
```

## Bicep Infrastructure Template

### infra/main.bicep

```bicep
param environment string
param location string = resourceGroup().location

// Create storage account
resource storageAccount 'Microsoft.Storage/storageAccounts@2021-06-01' = {
  name: 'sa${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
  }
}

// Create Service Bus
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2021-11-01' = {
  name: 'sb-${environment}-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard'
  }
}

// Create Logic App
resource logicApp 'Microsoft.Web/workflows@2019-05-01' = {
  name: 'logicapp-${environment}-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    state: 'Enabled'
    definition: loadJsonContent('./workflows/OrderProcessing/workflow.json')
  }
}

output storageAccountId string = storageAccount.id
output serviceBusNamespaceId string = serviceBusNamespace.id
output logicAppId string = logicApp.id
```

## Documentation Files

### docs/ARCHITECTURE.md

```markdown
# Architecture Overview

## Migrated Processes
1. Order Processing
2. Invoice Processing
3. Payment Settlement

## System Integration
- SAP ERP backend connectivity
- SQL Server database access
- SFTP file transfers

## Security Model
- Managed identities for Azure resource access
- Connection string encryption with Key Vault
- RBAC for workflow access control
```

### docs/DEPLOYMENT.md

```markdown
# Deployment Guide

## Prerequisites
- Azure subscription
- Azure CLI or AZD installed
- Logic Apps extension in VS Code

## Deployment Steps
1. `azd init` to initialize
2. `azd provision` to create infrastructure
3. `azd deploy` to deploy workflows
4. Verify in Azure Portal

## Configuration
- Set environment variables in `.env`
- Update parameters in `infra/parameters/{environment}.json`
- Configure connections in Azure Portal
```

## Scaffolding Script

Generate scaffolding automatically:

```bash
#!/bin/bash
# scaffold-project.sh

PROJECT_NAME=$1
ENVIRONMENT=${2:-dev}

# Create directories
mkdir -p $PROJECT_NAME/{.github/workflows,.vscode,infra/parameters,infra/modules,src/{workflows,functions,templates,connections},tests/{unit,integration,data},docs}

# Create configuration files
cat > $PROJECT_NAME/.gitignore << EOF
node_modules/
.env
.env.local
dist/
EOF

cat > $PROJECT_NAME/package.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0"
}
EOF

echo "Project scaffolding complete!"
```

This structured scaffolding ensures consistent project layout and best practices across all migrations.
