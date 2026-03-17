# IR Schema Reference (v3 - Extensible)

> This document contains the complete Intermediate Representation (IR) schema used by the Logic Apps Migration Assistant. For an overview and quick reference, see the [README](../README.md#ir-schema).

## Table of Contents

- [Design Principles](#design-principles)
- [Layered Architecture](#layered-architecture)
- [Cross-Platform Concept Mapping](#cross-platform-concept-mapping)
- [Complete Schema Definition](#complete-schema-definition)
- [Adding Support for New Platforms](#adding-support-for-new-platforms)
- [Schema Summary Tables](#schema-summary-tables)

---

## Design Principles

| Principle                    | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| **Platform Agnostic Core**   | Core concepts (triggers, actions, connections) work for any platform |
| **Source Mapping Isolation** | Platform-specific details are isolated in `sourceMapping` fields     |
| **Normalized Vocabulary**    | Uses generic terms that map to all platforms                         |
| **Extension Points**         | Clear mechanisms to add new platforms without schema changes         |
| **Target Independence**      | IR can generate Logic Apps, Azure Functions, or other targets        |

---

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           IR LAYERED ARCHITECTURE                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: CORE (Platform-Agnostic)                                                      │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│   │  metadata   │ │  triggers   │ │  actions    │ │ connections │ │  variables  │      │
│   │             │ │             │ │             │ │             │ │             │      │
│   │ • id        │ │ • http      │ │ • transform │ │ • database  │ │ • string    │      │
│   │ • name      │ │ • queue     │ │ • condition │ │ • messaging │ │ • number    │      │
│   │ • version   │ │ • timer     │ │ • loop      │ │ • http      │ │ • boolean   │      │
│   │ • complexity│ │ • file      │ │ • parallel  │ │ • file      │ │ • array     │      │
│   └─────────────┘ │ • event     │ │ • scope     │ │ • erp       │ │ • object    │      │
│                   └─────────────┘ │ • call      │ └─────────────┘ └─────────────┘      │
│   ┌─────────────┐                 │ • terminate │                                      │
│   │   schemas   │                 └─────────────┘ ┌─────────────┐ ┌─────────────┐      │
│   │             │ ┌─────────────┐                 │    error    │ │    gaps     │      │
│   │ • xml       │ │   maps      │                 │   handling  │ │             │      │
│   │ • json      │ │             │                 │             │ │ • category  │      │
│   │ • flatfile  │ │ • xslt      │                 │ • catch     │ │ • severity  │      │
│   │ • avro      │ │ • liquid    │                 │ • finally   │ │ • resolution│      │
│   └─────────────┘ │ • dataweave │                 │ • compensate│ └─────────────┘      │
│                   │ • jolt      │                 │ • retry     │                      │
│                   └─────────────┘                 └─────────────┘                      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: SOURCE EXTENSIONS (Platform-Specific) - Isolated in sourceMapping            │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐      │
│   │    BizTalk      │ │    MuleSoft     │ │     Boomi       │ │     IBM IIB     │      │
│   │                 │ │                 │ │                 │ │                 │      │
│   │ • odx, btm, xsd │ │ • flow xml      │ │ • process xml   │ │ • msgflow       │      │
│   │ • pipelines     │ │ • dataweave     │ │ • profiles      │ │ • esql          │      │
│   │ • ports         │ │ • raml/oas      │ │ • connectors    │ │ • subflows      │      │
│   │ • functoids     │ │ • mule configs  │ │ • extensions    │ │ • compute nodes │      │
│   │ • correlation   │ │ • api policies  │ │ • operations    │ │ • message models│      │
│   │ • bam/tracking  │ │ • cloudhub      │ │ • atomsphere    │ │ • policies      │      │
│   └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘      │
│                                                                                         │
│   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐      │
│   │     Tibco       │ │    Workato      │ │  Informatica    │ │   Apache Camel  │      │
│   │                 │ │                 │ │                 │ │                 │      │
│   │ • bw processes  │ │ • recipes       │ │ • mappings      │ │ • routes        │      │
│   │ • activities    │ │ • actions       │ │ • transformers  │ │ • components    │      │
│   │ • shared vars   │ │ • formulas      │ │ • sources/tgts  │ │ • beans         │      │
│   │ • substitions   │ │ • connections   │ │ • sessions      │ │ • endpoints     │      │
│   └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: TARGET MAPPING (Logic Apps Specific)                                          │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│   targetMapping: {                                                                      │
│     action: "HTTP",           // Logic Apps action type                                 │
│     connector: "sql",         // Connector to use                                       │
│     pattern: "scope-retry",   // Recommended pattern                                    │
│     gap: false,               // Has direct mapping?                                    │
│     alternative: "...",       // If gap, suggested approach                            │
│   }                                                                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-Platform Concept Mapping

The IR normalizes concepts across all supported platforms:

| IR Concept       | BizTalk          | MuleSoft       | Boomi      | IBM IIB       | Tibco       | Workato    | Informatica    |
| ---------------- | ---------------- | -------------- | ---------- | ------------- | ----------- | ---------- | -------------- |
| **flow**         | Orchestration    | Mule Flow      | Process    | Message Flow  | Process     | Recipe     | Mapping        |
| **trigger**      | Receive Shape    | Source         | Start      | Input Node    | Starter     | Trigger    | Source         |
| **action**       | Shape            | Processor      | Shape      | Node          | Activity    | Action     | Transformation |
| **transform**    | Map (.btm)       | DataWeave      | Map        | Compute       | XSLT/Mapper | Formula    | Expression     |
| **condition**    | Decide           | Choice         | Decision   | Route         | Condition   | IF         | Router         |
| **loop**         | Loop             | For Each       | Loop       | For Each      | Loop        | Repeat     | Loop           |
| **parallel**     | Parallel         | Scatter-Gather | Branch     | Fan-out       | Parallel    | Parallel   | Parallel       |
| **connection**   | Adapter/Port     | Connector      | Connection | Node          | Connection  | Connection | Connection     |
| **schema**       | XSD              | JSON/RAML      | Profile    | Message Model | XSD         | Schema     | Object         |
| **errorHandler** | Catch/Scope      | Error Handler  | Try/Catch  | Catch         | Catch       | Error      | Exception      |
| **variable**     | Message/Variable | Variable       | Property   | Variable      | Variable    | Variable   | Variable       |

---

## Complete Schema Definition

```json
{
    "$schema": "logicapps-migration-assistant/ir/v3",
    "$version": "3.0.0",

    "metadata": {
        "id": "flow-001",
        "name": "ProcessOrder",
        "description": "Order processing integration flow",

        "source": {
            "platform": "biztalk|mulesoft|boomi|ibm-iib|tibco|workato|informatica|camel",
            "platformVersion": "2020",
            "application": "OrderProcessing",
            "artifact": {
                "name": "ProcessOrder",
                "type": "orchestration|flow|process|message-flow|recipe|mapping",
                "filePath": "/path/to/artifact",
                "fileType": "odx|xml|json|bwp",
                "lastModified": "2024-06-15T10:30:00Z"
            },
            "environment": {
                "name": "production",
                "region": "us-east"
            }
        },

        "target": {
            "platform": "logic-apps-standard",
            "workflowType": "stateful|stateless",
            "resourceGroup": "rg-integration",
            "logicAppName": "la-order-processing"
        },

        "migration": {
            "status": "discovered|assessed|planned|designed|converted|validated|deployed|verified",
            "complexity": "low|medium|high|very-high",
            "complexityScore": 65,
            "complexityFactors": [
                { "factor": "custom-code", "weight": 20 },
                { "factor": "correlation", "weight": 15 },
                { "factor": "transactions", "weight": 30 }
            ],
            "estimatedEffort": {
                "hours": 24,
                "confidence": "medium"
            },
            "assignedTo": null,
            "notes": []
        },

        "overrides": [
            {
                "id": "override-001",
                "field": "migration.complexity",
                "originalValue": "medium",
                "newValue": "high",
                "reason": "Contains Sequential Convoy pattern which requires Durable Functions",
                "source": "chat|ui|api",
                "timestamp": "2026-02-04T14:30:00Z",
                "user": "architect@company.com"
            }
        ],

        "excluded": false,
        "excludedReason": null
    },

    "workflow": {
        "type": "stateful|stateless",
        "concurrency": {
            "maximumRuns": 25,
            "maximumWaitingRuns": 100
        },
        "operationOptions": {
            "timeout": "PT1H",
            "retryPolicy": {
                "type": "none|fixed|exponential",
                "count": 4,
                "interval": "PT30S"
            }
        },
        "correlation": {
            "enabled": true,
            "strategy": "callback-url|durable-functions|custom",
            "properties": ["orderId", "customerId"]
        }
    },

    "triggers": [
        {
            "id": "trigger-001",
            "name": "ReceiveOrder",
            "description": "Entry point for order processing",

            "type": "http|service-bus|storage-queue|storage-blob|timer|file|ftp|sftp|event-grid|event-hub|kafka|database|custom",

            "category": "request-response|event|polling|webhook",

            "config": {
                "method": "POST",
                "relativePath": "/api/orders",
                "authentication": {
                    "type": "none|api-key|oauth2|managed-identity|basic",
                    "config": {}
                }
            },

            "outputs": {
                "body": {
                    "type": "xml|json|text|binary",
                    "schemaRef": "#/schemas/OrderRequest"
                },
                "headers": {},
                "metadata": {}
            },

            "sourceMapping": {
                "_comment": "Platform-specific details go here",

                "biztalk": {
                    "shape": "Receive",
                    "portName": "ReceiveOrder_Port",
                    "portType": "one-way|request-response",
                    "receiveLocation": "HTTP_ReceiveLocation",
                    "pipeline": "XMLReceive",
                    "adapter": "HTTP"
                },

                "mulesoft": {
                    "processor": "http:listener",
                    "configRef": "HTTP_Listener_config",
                    "path": "/api/orders",
                    "allowedMethods": "POST"
                },

                "boomi": {
                    "shape": "Start",
                    "connector": "HTTP Client",
                    "operation": "Listen"
                },

                "ibm-iib": {
                    "node": "HTTPInput",
                    "terminal": "out"
                }
            },

            "targetMapping": {
                "logicAppsAction": "When_a_HTTP_request_is_received",
                "connector": "request",
                "gap": false
            }
        }
    ],

    "actions": [
        {
            "id": "action-001",
            "name": "TransformToCanonical",
            "description": "Transform incoming order to canonical format",

            "type": "transform|http-call|database-query|database-execute|condition|switch|foreach|until|parallel|scope|set-variable|append-variable|compose|parse|validate|call-workflow|terminate|delay|wait",

            "category": "data|control-flow|integration|utility",

            "runAfter": {
                "trigger-001": ["Succeeded"]
            },

            "config": {
                "_comment": "Type-specific configuration",
                "transformType": "xslt|liquid|dataweave|jolt|custom",
                "mapRef": "#/maps/OrderToCanonical"
            },

            "inputs": {
                "content": "@triggerBody()",
                "parameters": {}
            },

            "outputs": {
                "body": {
                    "type": "xml",
                    "schemaRef": "#/schemas/CanonicalOrder"
                }
            },

            "retryPolicy": {
                "type": "exponential",
                "count": 3
            },

            "errorHandling": {
                "strategy": "propagate|catch|ignore",
                "catchRef": "#/errorHandling/handlers/validation-error"
            },

            "sourceMapping": {
                "biztalk": {
                    "shape": "Transform",
                    "mapName": "OrderToCanonical.btm",
                    "sourceSchema": "OrderRequest",
                    "targetSchema": "CanonicalOrder"
                },
                "mulesoft": {
                    "processor": "ee:transform",
                    "dataweaveScript": "OrderToCanonical.dwl"
                },
                "boomi": {
                    "shape": "Map",
                    "mapId": "map-001",
                    "profile": "OrderProfile"
                },
                "ibm-iib": {
                    "node": "Compute",
                    "esqlModule": "OrderTransform"
                }
            },

            "targetMapping": {
                "logicAppsAction": "Transform_XML",
                "connector": "xml",
                "requiresIntegrationAccount": true,
                "gap": false
            }
        },

        {
            "id": "action-condition",
            "name": "IsOrderValid",
            "type": "condition",
            "category": "control-flow",

            "runAfter": {
                "action-001": ["Succeeded"]
            },

            "config": {
                "expression": {
                    "type": "compound",
                    "operator": "and",
                    "conditions": [
                        {
                            "left": "@body('TransformToCanonical')?['totalAmount']",
                            "operator": "greater",
                            "right": 0
                        }
                    ]
                }
            },

            "branches": {
                "true": {
                    "actions": ["action-check-inventory"]
                },
                "false": {
                    "actions": ["action-reject-order"]
                }
            },

            "sourceMapping": {
                "biztalk": { "shape": "Decide", "rule": "OrderValidationRule" },
                "mulesoft": { "processor": "choice", "when": "orderValidCondition" },
                "boomi": {
                    "shape": "Decision",
                    "firstValue": "totalAmount",
                    "operator": "greater-than"
                }
            },

            "targetMapping": {
                "logicAppsAction": "Condition",
                "gap": false
            }
        },

        {
            "id": "action-switch",
            "name": "RouteByRegion",
            "type": "switch",
            "category": "control-flow",

            "config": {
                "expression": "@body('GetOrderDetails')?['region']"
            },

            "cases": {
                "US": { "actions": ["action-process-us"] },
                "EU": { "actions": ["action-process-eu"] },
                "APAC": { "actions": ["action-process-apac"] }
            },
            "default": {
                "actions": ["action-process-default"]
            }
        },

        {
            "id": "action-foreach",
            "name": "ProcessLineItems",
            "type": "foreach",
            "category": "control-flow",

            "config": {
                "items": "@body('GetOrder')?['lineItems']",
                "concurrency": {
                    "degree": 10,
                    "sequential": false
                }
            },

            "actions": ["action-validate-item", "action-calculate-tax"]
        },

        {
            "id": "action-parallel",
            "name": "SendNotifications",
            "type": "parallel",
            "category": "control-flow",

            "branches": {
                "email": { "actions": ["action-send-email"] },
                "sms": { "actions": ["action-send-sms"] },
                "webhook": { "actions": ["action-call-webhook"] }
            }
        },

        {
            "id": "action-scope",
            "name": "SAPTransactionScope",
            "type": "scope",
            "category": "control-flow",

            "config": {
                "transactional": true,
                "isolation": "serializable"
            },

            "actions": ["action-create-sap-order", "action-update-inventory"],

            "errorHandling": {
                "catch": {
                    "actions": ["action-log-error", "action-compensate"]
                },
                "finally": {
                    "actions": ["action-cleanup"]
                }
            },

            "sourceMapping": {
                "biztalk": {
                    "shape": "Scope",
                    "type": "atomic",
                    "compensation": "CancelSAPOrder",
                    "exceptionHandler": "SAPErrorHandler"
                }
            },

            "targetMapping": {
                "logicAppsAction": "Scope",
                "pattern": "scope-with-run-after",
                "gap": true,
                "gapReason": "Atomic transactions not fully supported",
                "resolution": "saga-pattern"
            }
        }
    ],

    "variables": [
        {
            "id": "var-001",
            "name": "orderId",
            "type": "string|integer|float|boolean|array|object",
            "defaultValue": "",
            "description": "Current order identifier",

            "sourceMapping": {
                "biztalk": { "type": "distinguished-field", "xpath": "//OrderId" },
                "mulesoft": { "type": "variable", "name": "orderId" },
                "boomi": { "type": "process-property", "name": "orderId" }
            }
        }
    ],

    "connections": [
        {
            "id": "conn-sql",
            "name": "InventoryDatabase",
            "description": "SQL Server for inventory data",

            "type": "sql-server|oracle|mysql|postgresql|cosmos-db|mongodb|sap|salesforce|dynamics365|sharepoint|service-bus|event-hub|storage-blob|storage-queue|ftp|sftp|smtp|http|custom",

            "category": "database|erp|crm|messaging|storage|file|email|api|custom",

            "config": {
                "server": "{parameters:sqlServer}",
                "database": "InventoryDB",
                "authentication": {
                    "type": "sql|windows|managed-identity|connection-string",
                    "config": {}
                },
                "encryption": true
            },

            "gateway": {
                "required": true,
                "type": "on-premises-data-gateway",
                "name": "gateway-prod-01"
            },

            "credentials": {
                "type": "key-vault|inline|managed-identity",
                "keyVaultRef": "kv-integration/sql-credentials"
            },

            "sourceMapping": {
                "biztalk": {
                    "adapter": "WCF-SQL",
                    "portName": "SQL_Inventory_SP",
                    "uri": "mssql://server/InventoryDB"
                },
                "mulesoft": {
                    "connector": "database",
                    "configRef": "Database_Config"
                },
                "boomi": {
                    "connector": "Database",
                    "connectionId": "conn-db-001"
                }
            },

            "targetMapping": {
                "connector": "sql",
                "connectionType": "gateway",
                "gap": false
            }
        }
    ],

    "schemas": [
        {
            "id": "schema-001",
            "name": "OrderRequest",
            "description": "Incoming order request structure",

            "type": "xml-schema|json-schema|flat-file|avro|protobuf|custom",

            "format": {
                "encoding": "utf-8",
                "rootElement": "Order",
                "namespace": "http://contoso.com/schemas/order"
            },

            "file": {
                "name": "OrderRequest.xsd",
                "path": "/schemas/OrderRequest.xsd"
            },

            "flatFileConfig": {
                "structure": "delimited|positional|mixed",
                "recordDelimiter": "\\r\\n",
                "fieldDelimiter": "|",
                "textQualifier": "\""
            },

            "sourceMapping": {
                "biztalk": {
                    "schema": "OrderProcessing.Schemas.OrderRequest",
                    "targetNamespace": "http://contoso.com/schemas/order",
                    "isFlatFile": false
                },
                "mulesoft": {
                    "type": "json-schema",
                    "ramlType": "OrderRequest"
                },
                "boomi": {
                    "profile": "OrderProfile",
                    "profileId": "prof-001"
                }
            },

            "target": {
                "destination": "integration-account|inline|artifact-folder",
                "uploadRequired": true
            }
        }
    ],

    "maps": [
        {
            "id": "map-001",
            "name": "OrderToCanonical",
            "description": "Transform order to canonical format",

            "type": "xslt|liquid|dataweave|jolt|xquery|custom-code",
            "version": "1.0|2.0|3.0",

            "source": {
                "schemaRef": "#/schemas/OrderRequest",
                "format": "xml"
            },
            "target": {
                "schemaRef": "#/schemas/CanonicalOrder",
                "format": "xml"
            },

            "file": {
                "sourceFile": "OrderToCanonical.btm",
                "generatedFile": "OrderToCanonical.xslt",
                "path": "/maps/"
            },

            "functions": [
                {
                    "id": "func-001",
                    "name": "ConcatAddress",
                    "type": "string-concat|string-extract|math|date|logical|lookup|cumulative|conversion|scientific|custom",
                    "category": "built-in|custom|database",
                    "complexity": "low|medium|high",
                    "convertible": true,
                    "liquidEquivalent": "{{ address.line1 | append: ', ' | append: address.city }}",
                    "notes": null
                },
                {
                    "id": "func-002",
                    "name": "LookupCustomerTier",
                    "type": "database-lookup",
                    "category": "database",
                    "complexity": "high",
                    "convertible": false,
                    "resolution": {
                        "strategy": "azure-function",
                        "description": "Create Azure Function for database lookup",
                        "effort": "medium"
                    }
                }
            ],

            "parameters": [
                { "name": "currentDate", "type": "string", "required": true },
                { "name": "environment", "type": "string", "defaultValue": "prod" }
            ],

            "sourceMapping": {
                "biztalk": {
                    "map": "OrderProcessing.Maps.OrderToCanonical",
                    "functoidCount": 12,
                    "customFunctoidCount": 2
                },
                "mulesoft": {
                    "script": "OrderToCanonical.dwl",
                    "language": "dataweave",
                    "version": "2.0"
                },
                "boomi": {
                    "mapId": "map-001",
                    "functionCount": 8
                }
            },

            "targetMapping": {
                "destination": "integration-account",
                "type": "xslt",
                "conversionNeeded": true,
                "gap": false
            }
        }
    ],

    "messageProcessing": {
        "_comment": "Normalized representation of pipelines/message processors across platforms",

        "inbound": [
            {
                "id": "proc-in-001",
                "name": "InboundXMLProcessing",
                "description": "Processes incoming XML messages",

                "stages": [
                    {
                        "order": 1,
                        "name": "decode",
                        "type": "mime-decode|base64-decode|encryption-decode|compression-decode|none",
                        "enabled": false,
                        "config": {},
                        "targetMapping": {
                            "action": null,
                            "gap": true,
                            "resolution": "azure-function"
                        }
                    },
                    {
                        "order": 2,
                        "name": "disassemble",
                        "type": "xml-disassemble|json-parse|flat-file-parse|edi-parse|none",
                        "enabled": true,
                        "config": {
                            "validateStructure": true,
                            "preserveEnvelope": false
                        },
                        "targetMapping": {
                            "action": "Parse_XML",
                            "gap": false
                        }
                    },
                    {
                        "order": 3,
                        "name": "validate",
                        "type": "xml-validate|json-validate|schema-validate|custom",
                        "enabled": true,
                        "config": {
                            "schemaRef": "#/schemas/OrderRequest"
                        },
                        "targetMapping": {
                            "action": "XML_Validation",
                            "requiresIntegrationAccount": true,
                            "gap": false
                        }
                    }
                ],

                "sourceMapping": {
                    "biztalk": {
                        "pipeline": "OrderProcessing.Pipelines.XMLReceive",
                        "type": "receive"
                    },
                    "mulesoft": {
                        "processors": ["xml-module:validate-schema"]
                    },
                    "ibm-iib": {
                        "nodes": ["XMLParserNode", "ValidationNode"]
                    }
                }
            }
        ],

        "outbound": [
            {
                "id": "proc-out-001",
                "name": "OutboundXMLProcessing",
                "stages": [
                    {
                        "order": 1,
                        "name": "assemble",
                        "type": "xml-assemble|json-serialize|flat-file-assemble|edi-assemble",
                        "enabled": true,
                        "targetMapping": {
                            "action": "Compose",
                            "gap": false
                        }
                    }
                ]
            }
        ]
    },

    "endpoints": {
        "_comment": "Normalized representation of ports/endpoints across platforms",

        "receive": [
            {
                "id": "ep-recv-001",
                "name": "OrderReceiveEndpoint",
                "description": "HTTP endpoint for receiving orders",

                "transport": "http|ftp|sftp|file|mq|jms|kafka|service-bus|custom",
                "direction": "receive",
                "pattern": "one-way|request-response|polling|subscription",

                "config": {
                    "uri": "/api/orders",
                    "messageProcessingRef": "#/messageProcessing/inbound/proc-in-001"
                },

                "filters": [
                    {
                        "property": "ContentType",
                        "operator": "equals",
                        "value": "application/xml"
                    }
                ],

                "sourceMapping": {
                    "biztalk": {
                        "receivePort": "ReceiveOrder_RP",
                        "receiveLocation": "HTTP_ReceiveLocation",
                        "pipeline": "XMLReceive",
                        "handler": "BizTalkServerIsolatedHost"
                    },
                    "mulesoft": {
                        "flow": "order-api-flow",
                        "source": "http:listener"
                    },
                    "boomi": {
                        "startShape": "HTTP_Listen",
                        "process": "OrderProcess"
                    }
                },

                "targetMapping": {
                    "triggerRef": "#/triggers/trigger-001"
                }
            }
        ],

        "send": [
            {
                "id": "ep-send-001",
                "name": "SAPSendEndpoint",
                "description": "SAP RFC endpoint for order creation",

                "transport": "sap-rfc|http|soap|jms|file|ftp|custom",
                "direction": "send",
                "pattern": "one-way|solicit-response",

                "binding": "static|dynamic",

                "config": {
                    "connectionRef": "#/connections/conn-sap",
                    "operation": "BAPI_SALESORDER_CREATEFROMDAT2"
                },

                "sourceMapping": {
                    "biztalk": {
                        "sendPort": "SAP_CreateOrder_SP",
                        "adapter": "WCF-SAP",
                        "pipeline": "XMLTransmit",
                        "binding": "specify-later"
                    },
                    "mulesoft": {
                        "processor": "sap:execute-bapi",
                        "configRef": "SAP_Config"
                    }
                }
            },
            {
                "id": "ep-send-group",
                "name": "NotificationEndpointGroup",
                "description": "Send port group for parallel delivery",
                "type": "group",
                "members": ["ep-send-email", "ep-send-webhook"],

                "sourceMapping": {
                    "biztalk": {
                        "sendPortGroup": "Notification_SPG"
                    }
                },

                "targetMapping": {
                    "pattern": "parallel-actions",
                    "actionRef": "#/actions/action-parallel"
                }
            }
        ]
    },

    "correlation": {
        "_comment": "Normalized correlation across platforms",

        "sets": [
            {
                "id": "corr-001",
                "name": "OrderCorrelation",
                "description": "Correlates order request with confirmation",

                "properties": [
                    {
                        "name": "OrderId",
                        "type": "string",
                        "expression": "//Order/OrderId",
                        "expressionType": "xpath|jsonpath|expression"
                    }
                ],

                "initializingActions": ["trigger-001"],
                "followingActions": ["action-receive-confirmation"],

                "pattern": "request-response|publish-subscribe|sequential-convoy|parallel-convoy",

                "sourceMapping": {
                    "biztalk": {
                        "correlationSet": "OrderCorrelation",
                        "correlationType": "OrderCorrelationType"
                    },
                    "mulesoft": {
                        "correlationId": "#[correlationId]"
                    }
                },

                "targetMapping": {
                    "strategy": "callback-url|durable-functions|polling|event-subscription",
                    "gap": true,
                    "resolution": {
                        "pattern": "durable-functions",
                        "effort": "high"
                    }
                }
            }
        ]
    },

    "errorHandling": {
        "global": {
            "enabled": true,
            "defaultStrategy": "propagate|catch|ignore",
            "actions": ["action-log-global-error"]
        },

        "handlers": [
            {
                "id": "handler-001",
                "name": "ValidationErrorHandler",
                "type": "catch|finally|compensation",

                "trigger": {
                    "exceptionTypes": ["ValidationException", "XmlException"],
                    "runAfterStates": ["Failed", "TimedOut"]
                },

                "actions": [
                    {
                        "id": "log-error",
                        "type": "compose",
                        "config": { "message": "Validation failed" }
                    },
                    {
                        "id": "respond-400",
                        "type": "http-response",
                        "config": { "statusCode": 400 }
                    }
                ],

                "sourceMapping": {
                    "biztalk": {
                        "shape": "Catch",
                        "exceptionType": "System.Xml.XmlException",
                        "scope": "ValidationScope"
                    },
                    "mulesoft": {
                        "handler": "on-error-propagate",
                        "type": "VALIDATION:INVALID_CONTENT"
                    }
                }
            },
            {
                "id": "handler-002",
                "name": "SAPCompensationHandler",
                "type": "compensation",

                "compensatingActions": [
                    {
                        "id": "cancel-sap-order",
                        "type": "sap-call",
                        "config": { "rfc": "BAPI_SALESORDER_DELETE" }
                    }
                ],

                "sourceMapping": {
                    "biztalk": {
                        "shape": "Compensate",
                        "compensationBlock": "CancelSAPOrder"
                    }
                },

                "targetMapping": {
                    "pattern": "scope-run-after-failed",
                    "gap": true,
                    "resolution": "saga-pattern"
                }
            }
        ],

        "retryPolicies": [
            {
                "id": "retry-transient",
                "name": "TransientRetry",
                "type": "fixed|exponential|none",
                "count": 3,
                "interval": "PT30S",
                "maximumInterval": "PT15M",
                "appliesTo": ["action-check-inventory", "action-sap-call"]
            }
        ]
    },

    "rules": {
        "_comment": "Business rules from various rule engines",

        "policies": [
            {
                "id": "rule-001",
                "name": "OrderValidationPolicy",
                "description": "Validates order against business rules",
                "version": "1.0",

                "rules": [
                    {
                        "name": "MinimumOrderAmount",
                        "priority": 1,
                        "condition": {
                            "type": "simple|compound",
                            "expression": "Order.TotalAmount >= 100"
                        },
                        "thenActions": ["SetValid(true)"],
                        "elseActions": ["SetValid(false)", "AddError('MinAmount')"]
                    }
                ],

                "sourceMapping": {
                    "biztalk": {
                        "policy": "OrderProcessing.Rules.OrderValidation",
                        "vocabulary": "OrderVocabulary"
                    },
                    "mulesoft": {
                        "component": "validation:all"
                    }
                },

                "targetMapping": {
                    "pattern": "condition-actions|azure-function",
                    "complexity": "medium",
                    "gap": false,
                    "notes": "Simple rules convert to Condition actions; complex rules need Azure Function with NRules"
                }
            }
        ]
    },

    "b2b": {
        "_comment": "B2B/EDI trading partner configurations",

        "enabled": true,

        "partners": [
            {
                "id": "partner-001",
                "name": "Fabrikam",
                "identifier": {
                    "qualifier": "ZZ",
                    "value": "FABRIKAM"
                },
                "contacts": [{ "name": "EDI Support", "email": "edi@fabrikam.com" }]
            }
        ],

        "agreements": [
            {
                "id": "agreement-001",
                "name": "Fabrikam-X12-850",
                "protocol": "x12|edifact|as2|rosettanet",
                "hostPartner": "Contoso",
                "guestPartner": "Fabrikam",

                "protocolSettings": {
                    "transactionSet": "850",
                    "version": "00401",
                    "acknowledgement": "997"
                },

                "security": {
                    "encryption": { "enabled": true, "algorithm": "AES256" },
                    "signing": {
                        "enabled": true,
                        "certificateRef": "#/dependencies/certificates/cert-001"
                    }
                }
            }
        ],

        "targetMapping": {
            "destination": "integration-account",
            "gap": false
        }
    },

    "observability": {
        "_comment": "Tracking, monitoring, BAM configurations",

        "tracking": {
            "enabled": true,

            "activities": [
                {
                    "name": "OrderProcessingActivity",
                    "milestones": [
                        { "name": "OrderReceived", "actionRef": "trigger-001" },
                        { "name": "ValidationComplete", "actionRef": "action-001" },
                        { "name": "SAPOrderCreated", "actionRef": "action-sap-call" },
                        { "name": "OrderComplete", "actionRef": "action-respond" }
                    ],
                    "data": [
                        { "name": "OrderId", "type": "string", "expression": "//OrderId" },
                        { "name": "TotalAmount", "type": "decimal", "expression": "//TotalAmount" }
                    ]
                }
            ],

            "sourceMapping": {
                "biztalk": {
                    "bamActivity": "OrderProcessingActivity",
                    "hasRealTimeAggregation": true
                }
            },

            "targetMapping": {
                "pattern": "tracked-properties-log-analytics",
                "trackedProperties": ["orderId", "totalAmount", "status"],
                "logAnalyticsWorkspace": "la-integration-logs",
                "gap": true,
                "gapReason": "Real-time aggregation requires Stream Analytics"
            }
        }
    },

    "dependencies": {
        "customCode": [
            {
                "id": "code-001",
                "name": "OrderProcessing.Helpers.dll",
                "type": "assembly|script|module",
                "language": "csharp|java|javascript|python",
                "version": "1.2.0",

                "components": [
                    {
                        "class": "DiscountCalculator",
                        "methods": [
                            {
                                "name": "Calculate",
                                "signature": "decimal Calculate(decimal amount, string tier)"
                            }
                        ]
                    }
                ],

                "usedBy": ["#/maps/map-001"],

                "targetMapping": {
                    "destination": "azure-function",
                    "functionName": "OrderHelpers",
                    "runtime": "dotnet6",
                    "scaffoldGenerated": false
                }
            }
        ],

        "certificates": [
            {
                "id": "cert-001",
                "name": "FabrikamSigningCert",
                "type": "x509",
                "usage": "signing|encryption|tls",
                "thumbprint": "ABC123...",
                "expiryDate": "2026-12-31",

                "targetMapping": {
                    "destination": "integration-account|key-vault"
                }
            }
        ],

        "infrastructure": [
            {
                "type": "integration-account",
                "tier": "basic|standard|premium",
                "required": true,
                "reason": "XSLT maps, schemas, EDI agreements"
            },
            {
                "type": "azure-function-app",
                "runtime": "dotnet6|node18|python39",
                "required": true,
                "reason": "Custom code, database lookups in maps"
            },
            {
                "type": "on-premises-data-gateway",
                "required": true,
                "reason": "SQL Server, SAP connectivity"
            },
            {
                "type": "key-vault",
                "required": true,
                "reason": "Secrets, certificates, connection strings"
            }
        ]
    },

    "gaps": [
        {
            "id": "gap-001",
            "category": "correlation|custom-code|transaction|pipeline|tracking|b2b|rules|other",
            "severity": "low|medium|high|critical",

            "title": "Sequential Convoy Pattern",
            "description": "BizTalk uses correlation for sequential message processing",

            "sourceFeature": {
                "platform": "biztalk",
                "feature": "Sequential Convoy with Correlation",
                "artifacts": ["ProcessOrder.odx"]
            },

            "affectedElements": ["#/correlation/sets/corr-001"],

            "resolution": {
                "strategy": "auto-generate|alternative|azure-function|manual|skip",
                "pattern": "durable-functions-orchestration",
                "description": "Implement using Durable Functions for stateful convoy",
                "effort": {
                    "hours": 16,
                    "complexity": "high"
                },
                "codeTemplate": "templates/durable-convoy.cs"
            },

            "status": "pending|in-progress|resolved|deferred"
        }
    ],

    "extensions": {
        "_comment": "Platform-specific sections that don't fit normalized model",

        "biztalk": {
            "hosts": ["BizTalkServerApplication", "BizTalkServerIsolatedHost"],
            "messagebox": "BizTalkMsgBoxDb",
            "trackingDatabase": "BizTalkDTADb",
            "ssoApplications": ["SAP_SSO", "SQL_SSO"]
        },

        "mulesoft": {
            "cloudHubDeployment": {
                "workers": 2,
                "workerSize": "0.1",
                "region": "us-east-1"
            },
            "apiManager": {
                "apiId": "12345",
                "policies": ["rate-limit", "oauth2"]
            }
        },

        "boomi": {
            "atomId": "atom-prod-001",
            "environment": "Production",
            "processProperties": {}
        }
    }
}
```

---

## Adding Support for New Platforms

To add support for a new platform (e.g., SnapLogic, WSO2), follow these steps:

### Step 1: Create a Platform Parser

```typescript
// src/parsers/snaplogic-parser.ts
export class SnapLogicParser implements IPlatformParser {
    platform = 'snaplogic';

    parseFlow(file: string): IRFlow {
        // Parse SnapLogic pipeline JSON
        const pipeline = JSON.parse(file);

        return {
            metadata: {
                source: {
                    platform: 'snaplogic',
                    artifact: { type: 'pipeline', name: pipeline.name },
                },
            },
            triggers: this.parseTriggers(pipeline),
            actions: this.parseSnaps(pipeline.snaps),
            connections: this.parseAccounts(pipeline),
        };
    }

    private parseSnaps(snaps: any[]): IRAction[] {
        return snaps.map((snap) => ({
            id: snap.instance_id,
            name: snap.snap_name,
            type: this.mapSnapToActionType(snap.class_fqid),
            sourceMapping: {
                snaplogic: {
                    snapType: snap.class_fqid,
                    snapVersion: snap.class_version,
                    properties: snap.property_map,
                },
            },
        }));
    }
}
```

### Step 2: Add Platform Mapping Table

```typescript
// src/mappings/snaplogic-mappings.ts
export const SnapLogicToLogicAppsMappings = {
    triggers: {
        'com.snaplogic.snaps.rest.read': { action: 'http-trigger', gap: false },
        'com.snaplogic.snaps.file.read': { action: 'file-trigger', gap: false },
    },
    actions: {
        'com.snaplogic.snaps.transform.mapper': { action: 'compose', gap: false },
        'com.snaplogic.snaps.transform.script': { action: 'azure-function', gap: true },
        'com.snaplogic.snaps.flow.router': { action: 'switch', gap: false },
    },
};
```

### Step 3: Register the Parser

```typescript
// src/extension.ts
ParserRegistry.register('snaplogic', new SnapLogicParser());
ParserRegistry.register('wso2', new WSO2Parser());
```

---

## Schema Summary Tables

### Extensibility Summary

| Aspect                | How It's Extensible                                      |
| --------------------- | -------------------------------------------------------- |
| **New Platforms**     | Add `sourceMapping.{platform}` — no schema change needed |
| **New Action Types**  | Add to `type` enum, parser maps to it                    |
| **New Connectors**    | Add to `connections.type` enum                           |
| **Platform-Specific** | Use `extensions.{platform}` for unique features          |
| **Custom Gaps**       | `gaps[]` array accepts any category                      |
| **Target Platforms**  | Change `targetMapping` for non-Logic Apps targets        |

### Normalized Sections (Platform-Agnostic)

| Section               | Works For All Platforms | Notes                                   |
| --------------------- | ----------------------- | --------------------------------------- |
| **triggers**          | ✅                      | HTTP, Queue, Timer, File universal      |
| **actions**           | ✅                      | Transform, Condition, Loop universal    |
| **variables**         | ✅                      | All platforms have variables            |
| **connections**       | ✅                      | Database, HTTP, Messaging universal     |
| **schemas**           | ✅                      | XSD, JSON Schema, Flat File             |
| **maps**              | ✅                      | XSLT, Liquid, DataWeave, JOLT           |
| **messageProcessing** | ✅                      | Replaces BizTalk-specific "pipelines"   |
| **endpoints**         | ✅                      | Replaces BizTalk-specific "ports"       |
| **correlation**       | ✅                      | All platforms have correlation patterns |
| **errorHandling**     | ✅                      | Try/Catch, Compensation universal       |
| **rules**             | ✅                      | Business rules from any engine          |
| **b2b**               | ✅                      | EDI/B2B universal concepts              |
| **observability**     | ✅                      | Replaces BizTalk-specific "BAM"         |
| **gaps**              | ✅                      | Platform-agnostic gap tracking          |

### Section Reference

| Section               | Purpose                              | Key Fields                                   |
| --------------------- | ------------------------------------ | -------------------------------------------- |
| **metadata**          | Source/target info, migration status | id, name, source.platform, complexity        |
| **workflow**          | Workflow-level settings              | stateType, retry, concurrency, correlation   |
| **triggers**          | Entry points (HTTP, Queue, Timer)    | type, category, config, sourceMapping        |
| **actions**           | All workflow operations              | type, runAfter, branches, sourceMapping      |
| **variables**         | Workflow state                       | name, type, defaultValue                     |
| **connections**       | External system links                | type, category, gateway, credentials         |
| **schemas**           | Data contracts                       | type (xml/json/flatfile/avro), format        |
| **maps**              | Transformations                      | type (xslt/liquid/dataweave/jolt), functions |
| **messageProcessing** | Inbound/outbound processing          | stages, decode, parse, validate, assemble    |
| **endpoints**         | Receive/send endpoints               | transport, direction, pattern, filters       |
| **correlation**       | Message correlation                  | properties, pattern, strategy                |
| **errorHandling**     | Exception management                 | handlers, catch, compensation, retry         |
| **rules**             | Business rules                       | policies, conditions, actions                |
| **b2b**               | EDI/Trading partners                 | partners, agreements, protocols              |
| **observability**     | Monitoring/tracking                  | activities, milestones, trackedProperties    |
| **dependencies**      | Required resources                   | customCode, certificates, infrastructure     |
| **gaps**              | Conversion gaps                      | category, severity, resolution               |
| **extensions**        | Platform-specific extras             | biztalk{}, mulesoft{}, boomi{}, etc.         |

---

[← Back to README](../README.md#intermediate-representation-ir)
