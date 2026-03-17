# IR Example: IBM Integration Bus (IIB) / App Connect Enterprise

> This document provides a complete IR (Intermediate Representation) example for migrating IBM IIB/ACE message flows to Azure Logic Apps Standard.

## Source Overview

| Property | Value |
|----------|-------|
| **Platform** | IBM Integration Bus (IIB) / App Connect Enterprise |
| **Version** | 10.0.0.24 |
| **Artifact Type** | Message Flow (.msgflow) |
| **Complexity** | High (Score: 75) |
| **Estimated Effort** | 60+ hours |

## Key Characteristics

- **Message Flows** with nodes (MQInput, Compute, Filter, Route, etc.)
- **ESQL** (Extended SQL) for transformations and logic
- **Message Models** (DFDL, Message Sets)
- **Subflows** for reusable flow components
- **Aggregation** patterns (fan-out/fan-in)

## Main Conversion Gaps

| Gap | Severity | Resolution |
|-----|----------|------------|
| ESQL Compute Nodes | High | Azure Functions |
| IBM MQ | Medium | Service Bus / MQ Connector |
| Aggregation Pattern | High | Durable Functions |
| Message Models | Medium | XSD Conversion |

---

## Complete IR Example

**Source**: IIB Message Flow with ESQL compute nodes.

```json
{
  "$schema": "integration-migration-agent/ir/v3",
  "$version": "3.0.0",

  "metadata": {
    "id": "iib-order-001",
    "name": "OrderProcessingFlow",
    "description": "Order processing message flow from IBM IIB",
    "source": {
      "platform": "ibm-iib",
      "platformVersion": "10.0.0.24",
      "application": "OrderApplication",
      "artifact": {
        "name": "OrderProcessingFlow",
        "type": "message-flow",
        "filePath": "/OrderApplication/OrderProcessingFlow.msgflow",
        "fileType": "msgflow"
      }
    },
    "target": {
      "platform": "logic-apps-standard",
      "workflowType": "stateful"
    },
    "migration": {
      "complexity": "high",
      "complexityScore": 75
    }
  },

  "triggers": [
    {
      "id": "trigger-mq-input",
      "name": "MQ_Input",
      "type": "service-bus",
      "category": "event",
      "config": {
        "queueName": "ORDER.IN.QUEUE"
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "MQInput",
          "nodeName": "Order_MQ_Input",
          "queueManager": "QM_ORDER",
          "queueName": "ORDER.IN.QUEUE",
          "transactionMode": "yes",
          "terminal": "Out"
        }
      },
      "targetMapping": {
        "logicAppsAction": "When_messages_are_available_in_a_queue",
        "connector": "service-bus",
        "gap": false,
        "notes": "MQ → Service Bus migration"
      }
    },
    {
      "id": "trigger-http-input",
      "name": "HTTP_Input",
      "type": "http",
      "category": "request-response",
      "config": {
        "method": "POST",
        "relativePath": "/orders"
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "HTTPInput",
          "nodeName": "Order_HTTP_Input",
          "urlSpecifier": "/orders",
          "terminal": "Out",
          "httpVersion": "1.1"
        }
      }
    }
  ],

  "actions": [
    {
      "id": "action-compute",
      "name": "Transform_Order",
      "type": "transform",
      "category": "data",
      "runAfter": { "trigger-mq-input": ["Succeeded"] },
      "config": {
        "transformType": "esql",
        "computeNode": "Transform_ESQL"
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "Compute",
          "nodeName": "Transform_Order_Compute",
          "esqlModule": "OrderTransform",
          "esqlFunction": "Main",
          "dataSource": "ORDERDB",
          "terminal": "Out"
        }
      },
      "targetMapping": {
        "logicAppsAction": "Compose",
        "gap": true,
        "gapReason": "ESQL requires manual conversion",
        "resolution": "azure-function"
      }
    },
    {
      "id": "action-route",
      "name": "Route_by_Type",
      "type": "switch",
      "category": "control-flow",
      "runAfter": { "action-compute": ["Succeeded"] },
      "config": {
        "expression": "@body('Transform')?['orderType']"
      },
      "cases": {
        "DOMESTIC": { "actions": ["action-domestic-flow"] },
        "INTERNATIONAL": { "actions": ["action-intl-flow"] }
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "RouteToLabel",
          "nodeName": "Order_Router",
          "routingExpression": "$Root/XMLNSC/Order/OrderType",
          "labels": ["DOMESTIC", "INTERNATIONAL"]
        }
      }
    },
    {
      "id": "action-filter",
      "name": "Filter_Valid_Orders",
      "type": "condition",
      "category": "control-flow",
      "config": {
        "expression": {
          "left": "@body('Parse')?['status']",
          "operator": "equals",
          "right": "VALID"
        }
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "Filter",
          "nodeName": "ValidOrderFilter",
          "filterExpression": "$Root/XMLNSC/Order/Status = 'VALID'",
          "terminals": {
            "true": "True",
            "false": "False",
            "unknown": "Unknown"
          }
        }
      }
    },
    {
      "id": "action-aggregate",
      "name": "Aggregate_Responses",
      "type": "compose",
      "category": "data",
      "config": {
        "operation": "aggregate"
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "AggregateReply",
          "nodeName": "Response_Aggregator",
          "aggregateMode": "all",
          "timeout": 30000
        }
      },
      "targetMapping": {
        "gap": true,
        "gapReason": "IIB aggregation pattern needs redesign",
        "resolution": "durable-functions"
      }
    },
    {
      "id": "action-db-node",
      "name": "Insert_Order_DB",
      "type": "database-execute",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/db2-database",
        "operation": "execute",
        "sql": "INSERT INTO ORDERS VALUES(?, ?, ?)"
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "DatabaseRoute",
          "nodeName": "OrderDB_Insert",
          "dataSource": "ORDERDB",
          "statement": "INSERT INTO ORDERS VALUES(?, ?, ?)",
          "transactionMode": "automatic"
        }
      }
    },
    {
      "id": "action-subflow-call",
      "name": "Call_Validation_SubFlow",
      "type": "call-workflow",
      "category": "control-flow",
      "config": {
        "workflowId": "ValidationSubFlow",
        "isAsync": false
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "SubFlowCall",
          "nodeName": "Call_Validation",
          "subflowName": "ValidationSubFlow",
          "location": "same-integration-server"
        }
      }
    },
    {
      "id": "action-mq-output",
      "name": "Send_to_Output_Queue",
      "type": "http-call",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/mq-output",
        "operation": "send"
      },
      "sourceMapping": {
        "ibm-iib": {
          "node": "MQOutput",
          "nodeName": "Order_MQ_Output",
          "queueManager": "QM_ORDER",
          "queueName": "ORDER.OUT.QUEUE",
          "transactionMode": "yes"
        }
      }
    }
  ],

  "connections": [
    {
      "id": "mq-connection",
      "name": "IBM_MQ_Connection",
      "type": "service-bus",
      "category": "messaging",
      "config": {
        "migrationNote": "IBM MQ → Azure Service Bus"
      },
      "sourceMapping": {
        "ibm-iib": {
          "type": "MQ",
          "queueManager": "QM_ORDER",
          "host": "mq.contoso.com",
          "port": 1414,
          "channel": "ORDER.CHANNEL"
        }
      },
      "targetMapping": {
        "connector": "service-bus",
        "gap": false,
        "notes": "Consider IBM MQ connector if keeping MQ"
      }
    },
    {
      "id": "db2-database",
      "name": "DB2_Order_Database",
      "type": "database",
      "category": "database",
      "sourceMapping": {
        "ibm-iib": {
          "dataSource": "ORDERDB",
          "type": "DB2",
          "database": "ORDERDB",
          "host": "db2.contoso.com",
          "port": 50000
        }
      },
      "targetMapping": {
        "connector": "db2",
        "gap": false
      }
    }
  ],

  "schemas": [
    {
      "id": "schema-message-model",
      "name": "OrderMessageModel",
      "type": "xml-schema",
      "sourceMapping": {
        "ibm-iib": {
          "type": "message-model",
          "library": "OrderLib",
          "messageSet": "OrderMessageSet",
          "messageDefinition": "OrderMsgDef"
        }
      }
    }
  ],

  "maps": [
    {
      "id": "map-esql",
      "name": "OrderTransform",
      "type": "esql",
      "sourceMapping": {
        "ibm-iib": {
          "module": "OrderTransform",
          "language": "ESQL",
          "lineCount": 150,
          "hasDatabaseCalls": true,
          "hasComplexLogic": true
        }
      },
      "targetMapping": {
        "gap": true,
        "gapReason": "ESQL requires manual conversion to Logic Apps expressions + Azure Function",
        "resolution": {
          "strategy": "azure-function",
          "effort": { "hours": 24 }
        }
      }
    }
  ],

  "errorHandling": {
    "handlers": [
      {
        "id": "handler-catch",
        "name": "Error_Handler",
        "type": "catch",
        "sourceMapping": {
          "ibm-iib": {
            "terminal": "Catch",
            "connectedNode": "Error_Handler_Compute",
            "errorCode": "*"
          }
        }
      },
      {
        "id": "handler-failure",
        "name": "Failure_Handler",
        "type": "catch",
        "sourceMapping": {
          "ibm-iib": {
            "terminal": "Failure",
            "connectedNode": "Failure_Queue_Output"
          }
        }
      }
    ]
  },

  "gaps": [
    {
      "id": "gap-esql",
      "category": "custom-code",
      "severity": "high",
      "title": "ESQL Compute Nodes",
      "description": "Complex ESQL logic requires manual conversion",
      "affectedElements": ["#/actions/action-compute"],
      "resolution": {
        "strategy": "azure-function",
        "pattern": "function-per-compute-node",
        "effort": { "hours": 24 }
      }
    },
    {
      "id": "gap-mq-migration",
      "category": "infrastructure",
      "severity": "medium",
      "title": "IBM MQ to Service Bus",
      "description": "MQ infrastructure needs migration to Azure Service Bus",
      "resolution": {
        "strategy": "alternative",
        "pattern": "service-bus-migration",
        "effort": { "hours": 16 }
      }
    },
    {
      "id": "gap-aggregate",
      "category": "pattern",
      "severity": "high",
      "title": "Fan-out/Fan-in Aggregation",
      "description": "IIB aggregation pattern needs Durable Functions",
      "resolution": {
        "strategy": "alternative",
        "pattern": "durable-functions",
        "effort": { "hours": 20 }
      }
    }
  ],

  "extensions": {
    "ibm-iib": {
      "integrationServer": "IS_ORDER",
      "integrationNode": "NODE_PROD",
      "executionGroups": ["EG_ORDER"],
      "messageFlows": ["OrderProcessingFlow", "ValidationSubFlow"],
      "sharedLibraries": ["OrderLib", "CommonLib"],
      "policies": {
        "activityLog": "OrderActivityLog",
        "monitoring": "OrderMonitoringProfile"
      },
      "barFile": "OrderApplication.bar"
    }
  }
}
```

---

## IBM IIB-Specific Mapping Reference

### Nodes → Logic Apps Actions

| IIB Node | Logic Apps Action | Notes |
|----------|-------------------|-------|
| MQInput | Service Bus Trigger | Queue migration required |
| MQOutput | Service Bus - Send | Queue migration required |
| HTTPInput | HTTP Trigger | Direct mapping |
| HTTPReply | Response | Direct mapping |
| Compute | Azure Function | ESQL conversion required |
| Filter | Condition | Expression conversion |
| RouteToLabel | Switch | Direct mapping |
| DatabaseRoute | SQL Connector | Direct mapping |
| SubFlowCall | Call Workflow | Direct mapping |
| AggregateReply | Durable Functions | Pattern redesign |

### ESQL → Logic Apps / Azure Functions

| ESQL Construct | Logic Apps Equivalent |
|----------------|----------------------|
| SET statements | Compose action |
| IF/THEN/ELSE | Condition action |
| CASE/WHEN | Switch action |
| CREATE | Initialize variable |
| PROPAGATE | Parallel branches |
| PASSTHRU (DB) | SQL Execute |
| CALL procedure | Azure Function |
| CAST/CONVERT | Expression functions |

### Error Terminals → Logic Apps

| IIB Terminal | Logic Apps Pattern |
|--------------|-------------------|
| Catch | Scope + Run After (Failed) |
| Failure | Scope + Run After (Failed) |
| Out | Run After (Succeeded) |
| Alternate | Run After + Condition |

---

[← Back to IR Examples Index](../README.md#appendix-ir-examples-by-platform)
