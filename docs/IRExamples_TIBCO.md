# IR Example: TIBCO BusinessWorks

> This document provides a complete IR (Intermediate Representation) example for migrating TIBCO BusinessWorks processes to Azure Logic Apps Standard.

## Source Overview

| Property | Value |
|----------|-------|
| **Platform** | TIBCO BusinessWorks |
| **Version** | 6.8 |
| **Artifact Type** | Process (.process) |
| **Complexity** | Medium (Score: 60) |
| **Estimated Effort** | 40 hours |

## Key Characteristics

- **Processes** with activities (HTTP, JDBC, JMS, SOAP, etc.)
- **Mappers** with XSLT transformations
- **Shared Variables** for cross-process state
- **Groups** (Transaction, Iterate, Critical Section)
- **Substitution Variables** for environment configuration

## Main Conversion Gaps

| Gap | Severity | Resolution |
|-----|----------|------------|
| Shared Variables | Medium | Azure Cache for Redis / Table Storage |
| JMS Connections | Medium | Service Bus |
| Transaction Groups | Medium | Scope with compensation |

---

## Complete IR Example

**Source**: TIBCO BW Process with activities and shared variables.

```json
{
  "$schema": "integration-migration-agent/ir/v3",
  "$version": "3.0.0",

  "metadata": {
    "id": "tibco-order-001",
    "name": "OrderProcessingProcess",
    "description": "Order processing from TIBCO BusinessWorks",
    "source": {
      "platform": "tibco",
      "platformVersion": "6.8",
      "application": "OrderIntegration",
      "artifact": {
        "name": "OrderProcessingProcess",
        "type": "process",
        "filePath": "/OrderIntegration/Processes/OrderProcessing.process",
        "fileType": "process"
      }
    },
    "target": {
      "platform": "logic-apps-standard",
      "workflowType": "stateful"
    },
    "migration": {
      "complexity": "medium",
      "complexityScore": 60
    }
  },

  "triggers": [
    {
      "id": "trigger-http-receiver",
      "name": "HTTP_Receiver",
      "type": "http",
      "category": "request-response",
      "config": {
        "method": "POST",
        "relativePath": "/service/orders"
      },
      "sourceMapping": {
        "tibco": {
          "activity": "HTTP Receiver",
          "activityType": "bw.http.HTTPReceiver",
          "httpConnection": "OrderHTTPConnection",
          "operationName": "processOrder",
          "outputStyle": "RPC"
        }
      }
    },
    {
      "id": "trigger-jms-receiver",
      "name": "JMS_Queue_Receiver",
      "type": "service-bus",
      "category": "event",
      "config": {
        "queueName": "ORDER.INPUT"
      },
      "sourceMapping": {
        "tibco": {
          "activity": "JMS Queue Receiver",
          "activityType": "bw.jms.JMSQueueReceiver",
          "jmsConnection": "OrderJMSConnection",
          "destination": "ORDER.INPUT"
        }
      }
    }
  ],

  "actions": [
    {
      "id": "action-mapper",
      "name": "Map_Order",
      "type": "transform",
      "category": "data",
      "runAfter": { "trigger-http-receiver": ["Succeeded"] },
      "config": {
        "transformType": "tibco-mapper",
        "mapRef": "#/maps/order-mapping"
      },
      "sourceMapping": {
        "tibco": {
          "activity": "Mapper",
          "activityType": "bw.generalactivities.Mapper",
          "xsltFile": "OrderMapping.xslt"
        }
      }
    },
    {
      "id": "action-jdbc-query",
      "name": "Query_Customer",
      "type": "database-query",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/oracle-db",
        "query": "SELECT * FROM CUSTOMERS WHERE ID = ?"
      },
      "sourceMapping": {
        "tibco": {
          "activity": "JDBC Query",
          "activityType": "bw.jdbc.JDBCQuery",
          "jdbcConnection": "OracleDBConnection",
          "statement": "SELECT * FROM CUSTOMERS WHERE ID = ?",
          "timeout": 60
        }
      }
    },
    {
      "id": "action-call-process",
      "name": "Call_Validation_Process",
      "type": "call-workflow",
      "category": "control-flow",
      "config": {
        "workflowId": "ValidationProcess"
      },
      "sourceMapping": {
        "tibco": {
          "activity": "Call Process",
          "activityType": "bw.internal.CallProcess",
          "processName": "Processes/Validation/ValidationProcess.process",
          "spawn": false
        }
      }
    },
    {
      "id": "action-condition",
      "name": "Check_Amount",
      "type": "condition",
      "category": "control-flow",
      "config": {
        "expression": {
          "left": "@variables('orderAmount')",
          "operator": "greater",
          "right": 10000
        }
      },
      "branches": {
        "true": { "actions": ["action-approval-flow"] },
        "false": { "actions": ["action-auto-approve"] }
      },
      "sourceMapping": {
        "tibco": {
          "transition": "conditional",
          "conditionType": "xpath",
          "expression": "$OrderAmount > 10000"
        }
      }
    },
    {
      "id": "action-group",
      "name": "Transaction_Group",
      "type": "scope",
      "category": "control-flow",
      "config": {
        "transactional": true
      },
      "actions": ["action-jdbc-insert", "action-jms-send"],
      "errorHandling": {
        "catch": { "actions": ["action-rollback"] }
      },
      "sourceMapping": {
        "tibco": {
          "group": "TransactionGroup",
          "groupType": "Transaction",
          "transactionType": "JDBC"
        }
      }
    },
    {
      "id": "action-foreach-group",
      "name": "Process_Items",
      "type": "foreach",
      "category": "control-flow",
      "config": {
        "items": "@body('GetOrder')?['items']"
      },
      "sourceMapping": {
        "tibco": {
          "group": "IterateItemsGroup",
          "groupType": "Iterate",
          "iterateExpression": "$OrderItems/item"
        }
      }
    },
    {
      "id": "action-soap-invoke",
      "name": "Call_SAP_WebService",
      "type": "http-call",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/sap-ws",
        "operation": "CreateSalesOrder"
      },
      "sourceMapping": {
        "tibco": {
          "activity": "SOAP Request Reply",
          "activityType": "bw.soap.SOAPSendReceive",
          "wsdlFile": "SAP_SalesOrder.wsdl",
          "operation": "CreateSalesOrder",
          "soapAction": "CreateSalesOrder"
        }
      }
    },
    {
      "id": "action-assign",
      "name": "Set_Variables",
      "type": "set-variable",
      "category": "utility",
      "config": {
        "variables": [
          { "name": "orderId", "value": "@body('CreateOrder')?['id']" },
          { "name": "status", "value": "CREATED" }
        ]
      },
      "sourceMapping": {
        "tibco": {
          "activity": "Assign",
          "activityType": "bw.generalactivities.Assign"
        }
      }
    }
  ],

  "variables": [
    {
      "id": "var-process",
      "name": "processVariables",
      "type": "object",
      "sourceMapping": {
        "tibco": {
          "type": "process-variable",
          "schema": "ProcessVariables.xsd"
        }
      }
    },
    {
      "id": "var-shared",
      "name": "sharedVariable",
      "type": "object",
      "sourceMapping": {
        "tibco": {
          "type": "shared-variable",
          "sharedVariableName": "OrderCounterVar",
          "persistence": "memory"
        }
      },
      "targetMapping": {
        "gap": true,
        "gapReason": "Shared variables need Redis or table storage",
        "resolution": "azure-cache-redis"
      }
    }
  ],

  "connections": [
    {
      "id": "oracle-db",
      "name": "Oracle_Database",
      "type": "oracle",
      "category": "database",
      "config": {
        "host": "oracle.contoso.com",
        "database": "ORDERDB"
      },
      "sourceMapping": {
        "tibco": {
          "resource": "JDBC Connection",
          "resourceName": "OracleDBConnection",
          "driver": "oracle.jdbc.OracleDriver",
          "url": "jdbc:oracle:thin:@oracle.contoso.com:1521:ORDERDB"
        }
      }
    },
    {
      "id": "jms-connection",
      "name": "JMS_Server",
      "type": "service-bus",
      "category": "messaging",
      "sourceMapping": {
        "tibco": {
          "resource": "JMS Connection",
          "resourceName": "OrderJMSConnection",
          "providerUrl": "tcp://jms.contoso.com:7222",
          "connectionFactory": "QueueConnectionFactory"
        }
      }
    }
  ],

  "maps": [
    {
      "id": "map-order",
      "name": "OrderMapping",
      "type": "xslt",
      "file": { "sourceFile": "OrderMapping.xslt" },
      "sourceMapping": {
        "tibco": {
          "activity": "Mapper",
          "xsltVersion": "1.0",
          "inputSchema": "OrderInput.xsd",
          "outputSchema": "CanonicalOrder.xsd"
        }
      },
      "targetMapping": {
        "destination": "integration-account",
        "gap": false
      }
    }
  ],

  "errorHandling": {
    "handlers": [
      {
        "id": "handler-error-group",
        "name": "ErrorTransition",
        "type": "catch",
        "sourceMapping": {
          "tibco": {
            "transition": "error",
            "errorTypes": ["ActivityTimedOutException", "JDBCException"],
            "targetActivity": "LogError"
          }
        }
      }
    ]
  },

  "gaps": [
    {
      "id": "gap-shared-var",
      "category": "state",
      "severity": "medium",
      "title": "Shared Variables",
      "description": "TIBCO shared variables need Azure Cache or Table Storage",
      "resolution": {
        "strategy": "alternative",
        "pattern": "azure-cache-redis",
        "effort": { "hours": 8 }
      }
    }
  ],

  "extensions": {
    "tibco": {
      "projectName": "OrderIntegration",
      "appNode": "AppNode_Order",
      "appSpace": "AppSpace_Production",
      "domain": "Production_Domain",
      "substitutionVariables": {
        "DB_HOST": "oracle.contoso.com",
        "JMS_URL": "tcp://jms.contoso.com:7222"
      },
      "sharedModules": ["CommonModule", "SecurityModule"],
      "earFile": "OrderIntegration.ear"
    }
  }
}
```

---

## TIBCO BW-Specific Mapping Reference

### Activities → Logic Apps Actions

| TIBCO Activity | Logic Apps Action | Notes |
|----------------|-------------------|-------|
| HTTP Receiver | HTTP Trigger | Direct mapping |
| HTTP Send Request | HTTP | Direct mapping |
| JMS Queue Receiver | Service Bus Trigger | JMS → Service Bus |
| JMS Queue Send | Service Bus - Send | JMS → Service Bus |
| JDBC Query | SQL - Execute Query | Direct mapping |
| JDBC Update | SQL - Execute Procedure | Direct mapping |
| SOAP Request Reply | HTTP | Direct mapping |
| Mapper | Transform XML | XSLT conversion |
| Assign | Initialize/Set Variable | Direct mapping |
| Call Process | Call Workflow | Direct mapping |

### Groups → Logic Apps Patterns

| TIBCO Group | Logic Apps Pattern | Notes |
|-------------|-------------------|-------|
| Transaction | Scope + Compensation | Requires careful design |
| Iterate | For Each | Direct mapping |
| Critical Section | Concurrency control | Use workflow settings |
| Repeat Until True | Until loop | Direct mapping |
| While True | Until loop | Invert condition |

### Resources → Logic Apps Connections

| TIBCO Resource | Logic Apps Connector |
|----------------|---------------------|
| JDBC Connection | SQL / Oracle / DB2 |
| JMS Connection | Service Bus |
| HTTP Connection | HTTP |
| FTP Connection | FTP |
| SFTP Connection | SFTP-SSH |

### XPath → Logic Apps Expressions

| TIBCO XPath | Logic Apps Expression |
|-------------|----------------------|
| `$Variable/element` | `@variables('Variable')?['element']` |
| `$Activity/output` | `@body('Activity')?['output']` |
| `concat()` | `concat()` |
| `substring()` | `substring()` |
| `string-length()` | `length()` |

---

[← Back to IR Examples Index](../README.md#appendix-ir-examples-by-platform)
