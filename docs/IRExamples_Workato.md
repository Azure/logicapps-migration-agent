# IR Example: Workato

> This document provides a complete IR (Intermediate Representation) example for migrating Workato recipes to Azure Logic Apps Standard.

## Source Overview

| Property | Value |
|----------|-------|
| **Platform** | Workato |
| **Version** | 2024.1 |
| **Artifact Type** | Recipe (JSON) |
| **Complexity** | Low (Score: 35) |
| **Estimated Effort** | 8 hours |

## Key Characteristics

- **Recipes** with triggers and actions
- **Formulas** for data transformation
- **Lookup Tables** for data mapping
- **Callable Recipes** for reusability
- **Connection Pooling** for connector management

## Main Conversion Gaps

| Gap | Severity | Resolution |
|-----|----------|------------|
| Lookup Tables | Low | Azure Table Storage / SQL |
| Workato Formulas | Low | Logic Apps Expressions |
| Callable Recipes | Low | Call Workflow |

---

## Complete IR Example

**Source**: Workato Recipe with triggers and actions.

```json
{
  "$schema": "integration-migration-agent/ir/v3",
  "$version": "3.0.0",

  "metadata": {
    "id": "workato-order-001",
    "name": "Salesforce_to_SAP_Order_Sync",
    "description": "Order sync recipe from Workato",
    "source": {
      "platform": "workato",
      "platformVersion": "2024.1",
      "application": "Order Automation",
      "artifact": {
        "name": "Salesforce_to_SAP_Order_Sync",
        "type": "recipe",
        "filePath": "/recipes/sf-sap-order-sync.json",
        "fileType": "json"
      }
    },
    "target": {
      "platform": "logic-apps-standard",
      "workflowType": "stateful"
    },
    "migration": {
      "complexity": "low",
      "complexityScore": 35
    }
  },

  "triggers": [
    {
      "id": "trigger-sf-new-order",
      "name": "New_Order_in_Salesforce",
      "type": "event",
      "category": "webhook",
      "config": {
        "object": "Order",
        "event": "created"
      },
      "sourceMapping": {
        "workato": {
          "trigger": "salesforce.trigger.new_record",
          "connection": "salesforce_production",
          "sobject": "Order",
          "triggerType": "new",
          "pollingInterval": 5
        }
      },
      "targetMapping": {
        "logicAppsAction": "When_a_record_is_created",
        "connector": "salesforce",
        "gap": false
      }
    }
  ],

  "actions": [
    {
      "id": "action-get-account",
      "name": "Get_Salesforce_Account",
      "type": "http-call",
      "category": "integration",
      "runAfter": { "trigger-sf-new-order": ["Succeeded"] },
      "config": {
        "connectionRef": "#/connections/salesforce",
        "operation": "get_record",
        "object": "Account"
      },
      "sourceMapping": {
        "workato": {
          "action": "salesforce.action.get_record",
          "connection": "salesforce_production",
          "sobject": "Account",
          "recordId": "{{Order.AccountId}}"
        }
      }
    },
    {
      "id": "action-conditional",
      "name": "Check_Order_Amount",
      "type": "condition",
      "category": "control-flow",
      "config": {
        "expression": {
          "left": "@triggerBody()?['TotalAmount']",
          "operator": "greater",
          "right": 1000
        }
      },
      "branches": {
        "true": { "actions": ["action-create-sap-order"] },
        "false": { "actions": ["action-queue-for-review"] }
      },
      "sourceMapping": {
        "workato": {
          "action": "workato.action.conditional",
          "condition": {
            "field": "Order.TotalAmount",
            "operator": "greater_than",
            "value": 1000
          }
        }
      }
    },
    {
      "id": "action-formula",
      "name": "Calculate_Tax",
      "type": "compose",
      "category": "data",
      "config": {
        "expression": "@mul(triggerBody()?['TotalAmount'], 0.08)"
      },
      "sourceMapping": {
        "workato": {
          "action": "workato.action.formula",
          "formula": "Order.TotalAmount * 0.08",
          "outputField": "calculatedTax"
        }
      }
    },
    {
      "id": "action-lookup-table",
      "name": "Lookup_Product_Mapping",
      "type": "compose",
      "category": "data",
      "config": {
        "lookupTable": "product-mapping"
      },
      "sourceMapping": {
        "workato": {
          "action": "workato.action.lookup_table",
          "tableName": "SF_to_SAP_Product_Mapping",
          "lookupColumn": "sf_product_id",
          "lookupValue": "{{Order.Product2Id}}",
          "returnColumn": "sap_material_number"
        }
      },
      "targetMapping": {
        "gap": true,
        "gapReason": "Lookup tables need Azure Table Storage or SQL",
        "resolution": "azure-table-storage"
      }
    },
    {
      "id": "action-create-sap-order",
      "name": "Create_SAP_Sales_Order",
      "type": "http-call",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/sap",
        "operation": "create_sales_order"
      },
      "sourceMapping": {
        "workato": {
          "action": "sap.action.create_sales_order",
          "connection": "sap_s4hana",
          "salesOrderType": "OR",
          "salesOrganization": "1000"
        }
      }
    },
    {
      "id": "action-repeat",
      "name": "Process_Line_Items",
      "type": "foreach",
      "category": "control-flow",
      "config": {
        "items": "@triggerBody()?['OrderItems']"
      },
      "actions": ["action-process-item"],
      "sourceMapping": {
        "workato": {
          "action": "workato.action.repeat",
          "collection": "{{Order.OrderItems}}",
          "itemVariable": "currentItem"
        }
      }
    },
    {
      "id": "action-error-handler",
      "name": "Handle_Error",
      "type": "scope",
      "category": "control-flow",
      "errorHandling": {
        "catch": { "actions": ["action-log-error", "action-notify-team"] }
      },
      "sourceMapping": {
        "workato": {
          "action": "workato.action.handle_errors",
          "errorActions": ["log_error", "send_notification"],
          "retryCount": 3
        }
      }
    },
    {
      "id": "action-update-sf",
      "name": "Update_Salesforce_Order",
      "type": "http-call",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/salesforce",
        "operation": "update_record"
      },
      "sourceMapping": {
        "workato": {
          "action": "salesforce.action.update_record",
          "connection": "salesforce_production",
          "sobject": "Order",
          "recordId": "{{Order.Id}}",
          "fields": {
            "SAP_Order_Number__c": "{{SAP.SalesOrderNumber}}",
            "Sync_Status__c": "Synced"
          }
        }
      }
    },
    {
      "id": "action-send-email",
      "name": "Send_Confirmation",
      "type": "http-call",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/email",
        "operation": "send_email"
      },
      "sourceMapping": {
        "workato": {
          "action": "email.action.send_email",
          "connection": "gmail_notifications",
          "to": "{{Account.Email}}",
          "subject": "Order Confirmed",
          "body": "Your order {{Order.OrderNumber}} has been processed"
        }
      }
    }
  ],

  "connections": [
    {
      "id": "salesforce",
      "name": "Salesforce_Production",
      "type": "salesforce",
      "category": "crm",
      "config": {
        "instanceUrl": "https://contoso.my.salesforce.com"
      },
      "sourceMapping": {
        "workato": {
          "connection": "salesforce_production",
          "connectionType": "OAuth2",
          "environment": "Production"
        }
      },
      "targetMapping": {
        "connector": "salesforce",
        "gap": false
      }
    },
    {
      "id": "sap",
      "name": "SAP_S4HANA",
      "type": "sap",
      "category": "erp",
      "sourceMapping": {
        "workato": {
          "connection": "sap_s4hana",
          "connectionType": "OAuth2",
          "systemType": "S/4HANA Cloud"
        }
      }
    }
  ],

  "gaps": [
    {
      "id": "gap-lookup-table",
      "category": "data",
      "severity": "low",
      "title": "Workato Lookup Tables",
      "description": "Need to migrate lookup tables to Azure",
      "resolution": {
        "strategy": "alternative",
        "pattern": "azure-table-storage",
        "effort": { "hours": 4 }
      }
    }
  ],

  "extensions": {
    "workato": {
      "recipeId": "recipe-12345",
      "folderId": "folder-orders",
      "version": 15,
      "status": "active",
      "lastRunAt": "2024-06-15T10:00:00Z",
      "successfulJobs": 15234,
      "failedJobs": 12,
      "connections": ["salesforce_production", "sap_s4hana", "gmail_notifications"],
      "lookupTables": ["SF_to_SAP_Product_Mapping", "Country_Code_Mapping"]
    }
  }
}
```

---

## Workato-Specific Mapping Reference

### Triggers → Logic Apps Triggers

| Workato Trigger | Logic Apps Trigger | Notes |
|-----------------|-------------------|-------|
| New Record | When_a_record_is_created | Direct mapping (Salesforce, etc.) |
| Updated Record | When_a_record_is_modified | Direct mapping |
| New/Updated Record | Polling trigger | Direct mapping |
| Scheduled Trigger | Recurrence | Direct mapping |
| Webhook | HTTP Request | Direct mapping |

### Actions → Logic Apps Actions

| Workato Action | Logic Apps Action | Notes |
|----------------|-------------------|-------|
| Get Record | Get_record | Direct mapping |
| Create Record | Create_record | Direct mapping |
| Update Record | Update_record | Direct mapping |
| Search Records | Get_records | Direct mapping |
| Conditional | Condition | Direct mapping |
| Repeat | For Each | Direct mapping |
| Call Recipe | Call Workflow | Direct mapping |
| Formula | Compose | Expression conversion |
| Lookup Table | HTTP (Table Storage) | Gap - needs Azure Table |

### Formulas → Logic Apps Expressions

| Workato Formula | Logic Apps Expression |
|-----------------|----------------------|
| `field.concat(other)` | `concat(field, other)` |
| `field.upcase` | `toUpper(field)` |
| `field.downcase` | `toLower(field)` |
| `field.strip` | `trim(field)` |
| `field.present?` | `not(empty(field))` |
| `field.to_i` | `int(field)` |
| `field.to_f` | `float(field)` |
| `field.to_date` | `parseDateTime(field)` |
| `if...then...else` | `if(condition, true, false)` |

### Connectors → Logic Apps Connectors

| Workato Connector | Logic Apps Connector | Notes |
|-------------------|---------------------|-------|
| Salesforce | Salesforce | Direct mapping |
| SAP | SAP | Direct mapping |
| NetSuite | NetSuite | Direct mapping |
| Slack | Slack | Direct mapping |
| Email (Gmail/O365) | Office 365 / Gmail | Direct mapping |
| HTTP | HTTP | Direct mapping |
| Database | SQL Server / Oracle | Direct mapping |
| AWS S3 | Azure Blob | Storage migration |
| SFTP | SFTP-SSH | Direct mapping |

### Lookup Tables Migration

Workato lookup tables can be migrated to:

| Option | Pros | Cons |
|--------|------|------|
| Azure Table Storage | Simple, cheap, fast | Limited query capability |
| Azure SQL | Full SQL queries | More expensive |
| Azure Cosmos DB | Global distribution | Higher complexity |
| Logic Apps Variables | Simple lookups | Limited to small tables |

---

[← Back to IR Examples Index](../README.md#appendix-ir-examples-by-platform)
