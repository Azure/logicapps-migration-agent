# IR Example: MuleSoft

> This document provides a complete IR (Intermediate Representation) example for migrating MuleSoft Anypoint integrations to Azure Logic Apps Standard.

## Source Overview

| Property | Value |
|----------|-------|
| **Platform** | MuleSoft Anypoint |
| **Version** | Mule 4.4 |
| **Artifact Type** | Mule Flow (XML) |
| **Complexity** | Medium (Score: 55) |
| **Estimated Effort** | 16 hours |

## Key Characteristics

- **Mule Flows** with processors (http:listener, ee:transform, choice, scatter-gather)
- **DataWeave Transformations** (.dwl files)
- **API-led Connectivity** with RAML/OAS specifications
- **CloudHub Deployment** configurations
- **Error Handlers** (on-error-propagate, on-error-continue)

## Main Conversion Gaps

| Gap | Severity | Resolution |
|-----|----------|------------|
| DataWeave Scripts | Medium | Convert to Liquid Templates |
| API Manager Policies | Medium | Azure API Management |
| Object Store V2 | Low | Azure Cache/Storage |

---

## Complete IR Example

**Source**: MuleSoft Mule 4 Flow with DataWeave transformations and API-led connectivity.

```json
{
  "$schema": "integration-migration-agent/ir/v3",
  "$version": "3.0.0",

  "metadata": {
    "id": "mulesoft-order-001",
    "name": "order-process-api",
    "description": "Order processing API from MuleSoft Anypoint",
    "source": {
      "platform": "mulesoft",
      "platformVersion": "4.4",
      "application": "order-process-api",
      "artifact": {
        "name": "order-process-api",
        "type": "flow",
        "filePath": "/src/main/mule/order-process.xml",
        "fileType": "xml"
      },
      "environment": {
        "name": "CloudHub",
        "region": "us-east-1"
      }
    },
    "target": {
      "platform": "logic-apps-standard",
      "workflowType": "stateful"
    },
    "migration": {
      "complexity": "medium",
      "complexityScore": 55
    }
  },

  "triggers": [
    {
      "id": "trigger-http-listener",
      "name": "HTTP_Listener",
      "type": "http",
      "category": "request-response",
      "config": {
        "method": "POST",
        "relativePath": "/api/v1/orders"
      },
      "outputs": {
        "body": { "type": "json", "schemaRef": "#/schemas/OrderRequest" }
      },
      "sourceMapping": {
        "mulesoft": {
          "processor": "http:listener",
          "configRef": "HTTP_Listener_config",
          "path": "/api/v1/orders",
          "allowedMethods": "POST",
          "responseStreaming": "AUTO"
        }
      },
      "targetMapping": {
        "logicAppsAction": "When_a_HTTP_request_is_received",
        "gap": false
      }
    }
  ],

  "actions": [
    {
      "id": "action-validate",
      "name": "Validate_Payload",
      "type": "validate",
      "category": "data",
      "runAfter": { "trigger-http-listener": ["Succeeded"] },
      "config": {
        "schemaRef": "#/schemas/OrderRequest",
        "validationType": "json-schema"
      },
      "sourceMapping": {
        "mulesoft": {
          "processor": "validation:is-true",
          "expression": "#[payload.orderId != null]",
          "message": "Order ID is required"
        }
      }
    },
    {
      "id": "action-transform-dataweave",
      "name": "Transform_to_Canonical",
      "type": "transform",
      "category": "data",
      "runAfter": { "action-validate": ["Succeeded"] },
      "config": {
        "transformType": "dataweave",
        "mapRef": "#/maps/order-to-canonical"
      },
      "sourceMapping": {
        "mulesoft": {
          "processor": "ee:transform",
          "dataweaveScript": "order-to-canonical.dwl",
          "mimeType": "application/json"
        }
      },
      "targetMapping": {
        "logicAppsAction": "Compose",
        "gap": true,
        "gapReason": "DataWeave requires conversion to Liquid",
        "resolution": "liquid-template"
      }
    },
    {
      "id": "action-choice-router",
      "name": "Route_by_Order_Type",
      "type": "switch",
      "category": "control-flow",
      "runAfter": { "action-transform-dataweave": ["Succeeded"] },
      "config": {
        "expression": "@body('Transform')?['orderType']"
      },
      "cases": {
        "STANDARD": { "actions": ["action-process-standard"] },
        "EXPRESS": { "actions": ["action-process-express"] },
        "BULK": { "actions": ["action-process-bulk"] }
      },
      "default": { "actions": ["action-process-default"] },
      "sourceMapping": {
        "mulesoft": {
          "processor": "choice",
          "when": [
            { "expression": "#[payload.orderType == 'STANDARD']", "route": "standard-route" },
            { "expression": "#[payload.orderType == 'EXPRESS']", "route": "express-route" },
            { "expression": "#[payload.orderType == 'BULK']", "route": "bulk-route" }
          ],
          "otherwise": "default-route"
        }
      },
      "targetMapping": {
        "logicAppsAction": "Switch",
        "gap": false
      }
    },
    {
      "id": "action-scatter-gather",
      "name": "Parallel_Enrichment",
      "type": "parallel",
      "category": "control-flow",
      "runAfter": { "action-choice-router": ["Succeeded"] },
      "branches": {
        "customer-lookup": { "actions": ["action-get-customer"] },
        "inventory-check": { "actions": ["action-check-inventory"] },
        "pricing-calc": { "actions": ["action-calculate-price"] }
      },
      "sourceMapping": {
        "mulesoft": {
          "processor": "scatter-gather",
          "routes": ["customer-route", "inventory-route", "pricing-route"],
          "timeout": 30000
        }
      },
      "targetMapping": {
        "logicAppsAction": "Parallel_branches",
        "gap": false
      }
    },
    {
      "id": "action-foreach-items",
      "name": "Process_Line_Items",
      "type": "foreach",
      "category": "control-flow",
      "runAfter": { "action-scatter-gather": ["Succeeded"] },
      "config": {
        "items": "@body('GetOrder')?['lineItems']",
        "concurrency": { "degree": 5 }
      },
      "actions": ["action-validate-item", "action-reserve-inventory"],
      "sourceMapping": {
        "mulesoft": {
          "processor": "foreach",
          "collection": "#[payload.lineItems]",
          "batchSize": 10,
          "rootMessageVariableName": "rootMessage"
        }
      }
    },
    {
      "id": "action-http-request",
      "name": "Call_ERP_System",
      "type": "http-call",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/erp-api",
        "method": "POST",
        "path": "/orders"
      },
      "sourceMapping": {
        "mulesoft": {
          "processor": "http:request",
          "configRef": "HTTP_Request_config_ERP",
          "method": "POST",
          "path": "/api/orders",
          "responseTimeout": 30000
        }
      }
    },
    {
      "id": "action-db-insert",
      "name": "Store_Order",
      "type": "database-execute",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/order-db",
        "operation": "insert",
        "table": "orders"
      },
      "sourceMapping": {
        "mulesoft": {
          "processor": "db:insert",
          "configRef": "Database_Config",
          "sql": "INSERT INTO orders (id, customer_id, total) VALUES (:orderId, :customerId, :total)",
          "inputParameters": "#[{ orderId: payload.id, customerId: payload.customerId, total: payload.total }]"
        }
      },
      "targetMapping": {
        "logicAppsAction": "Execute_a_SQL_query_(V2)",
        "connector": "sql",
        "gap": false
      }
    }
  ],

  "variables": [
    {
      "id": "var-correlation-id",
      "name": "correlationId",
      "type": "string",
      "sourceMapping": {
        "mulesoft": {
          "type": "variable",
          "name": "correlationId",
          "expression": "#[correlationId]"
        }
      }
    },
    {
      "id": "var-order-total",
      "name": "orderTotal",
      "type": "float",
      "sourceMapping": {
        "mulesoft": {
          "type": "variable",
          "name": "orderTotal",
          "mimeType": "application/java"
        }
      }
    }
  ],

  "connections": [
    {
      "id": "erp-api",
      "name": "ERP_System_API",
      "type": "http",
      "category": "api",
      "config": {
        "baseUrl": "https://erp.contoso.com/api",
        "authentication": {
          "type": "oauth2",
          "tokenUrl": "https://auth.contoso.com/oauth/token"
        }
      },
      "sourceMapping": {
        "mulesoft": {
          "connector": "http:request-config",
          "name": "HTTP_Request_config_ERP",
          "host": "erp.contoso.com",
          "port": 443,
          "protocol": "HTTPS",
          "authentication": {
            "type": "oauth:client-credentials-grant-type",
            "clientId": "${erp.client.id}",
            "clientSecret": "${erp.client.secret}"
          }
        }
      }
    },
    {
      "id": "order-db",
      "name": "Order_Database",
      "type": "mysql",
      "category": "database",
      "config": {
        "host": "mysql.contoso.com",
        "database": "orders"
      },
      "sourceMapping": {
        "mulesoft": {
          "connector": "db:config",
          "name": "Database_Config",
          "connectionType": "MySQL",
          "host": "${db.host}",
          "port": 3306,
          "database": "${db.name}",
          "poolingProfile": {
            "maxPoolSize": 10
          }
        }
      }
    }
  ],

  "schemas": [
    {
      "id": "schema-order-request",
      "name": "OrderRequest",
      "type": "json-schema",
      "sourceMapping": {
        "mulesoft": {
          "type": "json-schema",
          "ramlType": "OrderRequest",
          "ramlFile": "api.raml"
        }
      }
    }
  ],

  "maps": [
    {
      "id": "map-order-canonical",
      "name": "order-to-canonical",
      "type": "dataweave",
      "version": "2.0",
      "file": { "sourceFile": "order-to-canonical.dwl" },
      "sourceMapping": {
        "mulesoft": {
          "script": "order-to-canonical.dwl",
          "language": "dataweave",
          "version": "2.4",
          "mimeType": "application/json"
        }
      },
      "targetMapping": {
        "type": "liquid",
        "conversionNeeded": true,
        "gap": true,
        "notes": "DataWeave must be converted to Liquid template"
      }
    }
  ],

  "errorHandling": {
    "handlers": [
      {
        "id": "handler-global",
        "name": "Global_Error_Handler",
        "type": "catch",
        "trigger": {
          "exceptionTypes": ["ANY"]
        },
        "actions": [
          { "id": "log-error", "type": "compose" },
          { "id": "respond-error", "type": "http-response", "config": { "statusCode": 500 } }
        ],
        "sourceMapping": {
          "mulesoft": {
            "handler": "on-error-propagate",
            "type": "ANY",
            "logException": true,
            "enableNotifications": true
          }
        }
      },
      {
        "id": "handler-connectivity",
        "name": "Connectivity_Error_Handler",
        "type": "catch",
        "trigger": {
          "exceptionTypes": ["CONNECTIVITY", "TIMEOUT"]
        },
        "sourceMapping": {
          "mulesoft": {
            "handler": "on-error-continue",
            "type": "HTTP:CONNECTIVITY",
            "when": "#[error.errorType.namespace == 'HTTP']"
          }
        }
      }
    ]
  },

  "gaps": [
    {
      "id": "gap-dataweave",
      "category": "transform",
      "severity": "medium",
      "title": "DataWeave Transformation",
      "description": "DataWeave scripts need conversion to Liquid templates",
      "affectedElements": ["#/maps/map-order-canonical"],
      "resolution": {
        "strategy": "alternative",
        "pattern": "liquid-template",
        "description": "Convert DataWeave to Liquid template syntax",
        "effort": { "hours": 4 }
      }
    }
  ],

  "extensions": {
    "mulesoft": {
      "projectType": "mule-application",
      "muleVersion": "4.4.0",
      "cloudHubDeployment": {
        "workers": 2,
        "workerSize": "0.1",
        "region": "us-east-1",
        "objectStoreV2": true
      },
      "apiManager": {
        "apiId": "12345",
        "autodiscovery": true,
        "policies": ["rate-limiting", "client-id-enforcement"]
      },
      "anypoint": {
        "orgId": "org-123",
        "environment": "Production"
      }
    }
  }
}
```

---

## MuleSoft-Specific Mapping Reference

### Processors → Logic Apps Actions

| MuleSoft Processor | Logic Apps Action | Notes |
|--------------------|-------------------|-------|
| http:listener | HTTP Trigger | Direct mapping |
| http:request | HTTP Action | Direct mapping |
| ee:transform | Compose | DataWeave → Liquid conversion needed |
| choice | Switch/Condition | Direct mapping |
| scatter-gather | Parallel Branches | Direct mapping |
| foreach | For Each | Direct mapping |
| db:insert/select | SQL Connector | Direct mapping |
| validation:* | Condition + Terminate | Pattern change |

### DataWeave → Liquid Conversion

| DataWeave | Liquid Equivalent |
|-----------|-------------------|
| `payload.field` | `{{ body.field }}` |
| `payload map (item) -> item.name` | `{% for item in body %}{{ item.name }}{% endfor %}` |
| `now()` | `{{ "now" \| date: "%Y-%m-%d" }}` |
| `upper(payload.name)` | `{{ body.name \| upcase }}` |
| `payload.amount as Number` | `{{ body.amount \| plus: 0 }}` |

### Error Handlers → Run After

| MuleSoft Handler | Logic Apps Pattern |
|------------------|-------------------|
| on-error-propagate | Scope + Run After (Failed) + Terminate |
| on-error-continue | Scope + Run After (Failed) + Continue |
| try scope | Scope with error handling |

---

[← Back to IR Examples Index](../README.md#appendix-ir-examples-by-platform)
