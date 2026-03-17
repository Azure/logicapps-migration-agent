# IR Example: BizTalk Server

> This document provides a complete IR (Intermediate Representation) example for migrating BizTalk Server integrations to Azure Logic Apps Standard.

## Source Overview

| Property | Value |
|----------|-------|
| **Platform** | BizTalk Server |
| **Version** | 2020 |
| **Artifact Type** | Orchestration (.odx) |
| **Complexity** | Medium (Score: 65) |
| **Estimated Effort** | 24 hours |

## Key Characteristics

- **Orchestrations** with shapes (Receive, Send, Transform, Decide, Scope)
- **Maps (.btm)** with Functoids (including custom functoids)
- **Pipelines** for message processing (XMLReceive, XMLTransmit)
- **Ports** (Receive/Send) with adapters (HTTP, WCF-SAP)
- **Correlation Sets** for message matching
- **Atomic Scopes** with compensation handlers

## Main Conversion Gaps

| Gap | Severity | Resolution |
|-----|----------|------------|
| Custom Functoids | Medium | Azure Function |
| Atomic Scope Transactions | High | Saga Pattern |
| Complex Correlation | Medium | Durable Functions |

---

## Complete IR Example

**Source**: BizTalk Orchestration (`ProcessOrder.odx`) with maps, pipelines, and SAP integration.

```json
{
  "$schema": "integration-migration-agent/ir/v3",
  "$version": "3.0.0",

  "metadata": {
    "id": "biztalk-order-001",
    "name": "ProcessOrder",
    "description": "Order processing orchestration from BizTalk Server",
    "source": {
      "platform": "biztalk",
      "platformVersion": "2020",
      "application": "OrderProcessing",
      "artifact": {
        "name": "ProcessOrder",
        "type": "orchestration",
        "filePath": "/BizTalk/OrderProcessing/Orchestrations/ProcessOrder.odx",
        "fileType": "odx"
      }
    },
    "target": {
      "platform": "logic-apps-standard",
      "workflowType": "stateful"
    },
    "migration": {
      "complexity": "medium",
      "complexityScore": 65,
      "estimatedEffort": { "hours": 24 }
    }
  },

  "triggers": [
    {
      "id": "trigger-receive-order",
      "name": "ReceiveOrder",
      "type": "http",
      "category": "request-response",
      "config": {
        "method": "POST",
        "relativePath": "/api/orders"
      },
      "outputs": {
        "body": { "type": "xml", "schemaRef": "#/schemas/OrderRequest" }
      },
      "sourceMapping": {
        "biztalk": {
          "shape": "Receive",
          "portName": "ReceiveOrder_Port",
          "portType": "request-response",
          "receiveLocation": "HTTP_ReceiveLocation",
          "pipeline": "XMLReceive",
          "adapter": "HTTP"
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
      "id": "action-transform",
      "name": "TransformToCanonical",
      "type": "transform",
      "category": "data",
      "runAfter": { "trigger-receive-order": ["Succeeded"] },
      "config": {
        "transformType": "xslt",
        "mapRef": "#/maps/OrderToCanonical"
      },
      "sourceMapping": {
        "biztalk": {
          "shape": "Transform",
          "mapName": "OrderToCanonical.btm",
          "sourceSchema": "OrderRequest",
          "targetSchema": "CanonicalOrder"
        }
      },
      "targetMapping": {
        "logicAppsAction": "Transform_XML",
        "requiresIntegrationAccount": true,
        "gap": false
      }
    },
    {
      "id": "action-decide",
      "name": "IsOrderValid",
      "type": "condition",
      "category": "control-flow",
      "runAfter": { "action-transform": ["Succeeded"] },
      "config": {
        "expression": {
          "operator": "and",
          "conditions": [
            { "left": "@body('Transform')?['totalAmount']", "operator": "greater", "right": 0 }
          ]
        }
      },
      "branches": {
        "true": { "actions": ["action-call-sap"] },
        "false": { "actions": ["action-reject"] }
      },
      "sourceMapping": {
        "biztalk": {
          "shape": "Decide",
          "rule": "OrderValidation"
        }
      }
    },
    {
      "id": "action-call-sap",
      "name": "CreateSAPOrder",
      "type": "http-call",
      "category": "integration",
      "runAfter": { "action-decide": ["Succeeded"] },
      "config": {
        "connectionRef": "#/connections/sap-erp",
        "operation": "BAPI_SALESORDER_CREATEFROMDAT2"
      },
      "sourceMapping": {
        "biztalk": {
          "shape": "Send",
          "portName": "SAP_SendPort",
          "adapter": "WCF-SAP",
          "operation": "BAPI_SALESORDER_CREATEFROMDAT2"
        }
      },
      "targetMapping": {
        "logicAppsAction": "Call_SAP_function",
        "connector": "sap",
        "gap": false
      }
    },
    {
      "id": "action-scope-atomic",
      "name": "TransactionScope",
      "type": "scope",
      "category": "control-flow",
      "config": { "transactional": true },
      "actions": ["action-call-sap", "action-update-inventory"],
      "errorHandling": {
        "catch": { "actions": ["action-compensate"] }
      },
      "sourceMapping": {
        "biztalk": {
          "shape": "Scope",
          "type": "atomic",
          "compensation": "RollbackOrder"
        }
      },
      "targetMapping": {
        "logicAppsAction": "Scope",
        "gap": true,
        "gapReason": "Atomic transactions not supported",
        "resolution": "saga-pattern"
      }
    }
  ],

  "connections": [
    {
      "id": "sap-erp",
      "name": "SAP_ERP_Connection",
      "type": "sap",
      "category": "erp",
      "config": {
        "applicationServer": "sap.contoso.com",
        "systemNumber": "00",
        "client": "100"
      },
      "gateway": { "required": true, "name": "on-prem-gateway" },
      "sourceMapping": {
        "biztalk": {
          "adapter": "WCF-SAP",
          "portName": "SAP_SendPort",
          "uri": "sap://CLIENT=100;LANG=EN;@A/sapserver/00"
        }
      }
    }
  ],

  "schemas": [
    {
      "id": "schema-order",
      "name": "OrderRequest",
      "type": "xml-schema",
      "file": { "name": "OrderRequest.xsd" },
      "sourceMapping": {
        "biztalk": {
          "schema": "OrderProcessing.Schemas.OrderRequest",
          "targetNamespace": "http://contoso.com/schemas/order"
        }
      }
    }
  ],

  "maps": [
    {
      "id": "map-order",
      "name": "OrderToCanonical",
      "type": "xslt",
      "version": "1.0",
      "file": { "sourceFile": "OrderToCanonical.btm", "generatedFile": "OrderToCanonical.xslt" },
      "functions": [
        { "name": "ConcatAddress", "type": "string-concat", "convertible": true },
        { "name": "CalculateDiscount", "type": "custom", "assembly": "Helpers.dll", "convertible": false }
      ],
      "sourceMapping": {
        "biztalk": {
          "map": "OrderProcessing.Maps.OrderToCanonical",
          "functoidCount": 8,
          "customFunctoidCount": 1
        }
      }
    }
  ],

  "messageProcessing": {
    "inbound": [
      {
        "id": "proc-receive",
        "name": "XMLReceivePipeline",
        "stages": [
          { "order": 1, "name": "disassemble", "type": "xml-disassemble", "enabled": true },
          { "order": 2, "name": "validate", "type": "xml-validate", "enabled": true }
        ],
        "sourceMapping": {
          "biztalk": {
            "pipeline": "XMLReceive",
            "type": "receive"
          }
        }
      }
    ]
  },

  "correlation": {
    "sets": [
      {
        "id": "corr-order",
        "name": "OrderCorrelation",
        "properties": [
          { "name": "OrderId", "type": "string", "expression": "//OrderId" }
        ],
        "pattern": "request-response",
        "sourceMapping": {
          "biztalk": {
            "correlationSet": "OrderCorrelation",
            "correlationType": "OrderCorrelationType"
          }
        },
        "targetMapping": {
          "strategy": "callback-url",
          "gap": false
        }
      }
    ]
  },

  "gaps": [
    {
      "id": "gap-atomic",
      "category": "transaction",
      "severity": "high",
      "title": "Atomic Scope Transaction",
      "description": "BizTalk atomic scope with compensation",
      "resolution": {
        "strategy": "alternative",
        "pattern": "saga-pattern",
        "effort": { "hours": 16 }
      }
    },
    {
      "id": "gap-custom-functoid",
      "category": "custom-code",
      "severity": "medium",
      "title": "Custom Functoid",
      "description": "CalculateDiscount uses custom assembly",
      "resolution": {
        "strategy": "azure-function",
        "effort": { "hours": 8 }
      }
    }
  ],

  "extensions": {
    "biztalk": {
      "application": "OrderProcessing",
      "hosts": ["BizTalkServerApplication", "BizTalkServerIsolatedHost"],
      "messagebox": "BizTalkMsgBoxDb",
      "ssoApplications": ["SAP_SSO"]
    }
  }
}
```

---

## BizTalk-Specific Mapping Reference

### Shapes → Logic Apps Actions

| BizTalk Shape | Logic Apps Action | Notes |
|---------------|-------------------|-------|
| Receive | HTTP Trigger / Connector Trigger | Direct mapping |
| Send | HTTP Action / Connector Action | Direct mapping |
| Transform | Transform XML | Requires Integration Account |
| Decide | Condition / Switch | Direct mapping |
| Loop | For Each / Until | Direct mapping |
| Parallel | Parallel Branches | Direct mapping |
| Scope | Scope | Limited transaction support |
| Call Orchestration | Call Workflow | Direct mapping |

### Adapters → Connectors

| BizTalk Adapter | Logic Apps Connector | Notes |
|-----------------|---------------------|-------|
| HTTP | HTTP | Direct mapping |
| WCF-SQL | SQL Server | Requires gateway for on-prem |
| WCF-SAP | SAP | Requires gateway |
| FILE | File System | Requires gateway |
| FTP/SFTP | FTP/SFTP-SSH | Direct mapping |
| Service Bus | Service Bus | Direct mapping |

---

[← Back to IR Examples Index](../README.md#appendix-ir-examples-by-platform)
