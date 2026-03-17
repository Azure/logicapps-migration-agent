# IR Example: Dell Boomi

> This document provides a complete IR (Intermediate Representation) example for migrating Dell Boomi AtomSphere integrations to Azure Logic Apps Standard.

## Source Overview

| Property | Value |
|----------|-------|
| **Platform** | Dell Boomi AtomSphere |
| **Version** | 2024.1 |
| **Artifact Type** | Process (XML) |
| **Complexity** | Low (Score: 40) |
| **Estimated Effort** | 12 hours |

## Key Characteristics

- **Processes** with shapes (Start, Map, Decision, Branch, Connector)
- **Visual Maps** with profiles and functions
- **Connectors** (SAP, Database, HTTP, SFTP)
- **Cross-Reference Tables** for data lookups
- **Atom/Molecule Deployment** configurations

## Main Conversion Gaps

| Gap | Severity | Resolution |
|-----|----------|------------|
| Boomi Visual Maps | Medium | Convert to XSLT |
| Cross-Reference Lookups | Medium | Azure Table Storage / Function |
| Process Properties | Low | Logic Apps Parameters |

---

## Complete IR Example

**Source**: Boomi Process with connectors, maps, and decision shapes.

```json
{
  "$schema": "integration-migration-agent/ir/v3",
  "$version": "3.0.0",

  "metadata": {
    "id": "boomi-order-001",
    "name": "Order_Sync_Process",
    "description": "Order synchronization process from Boomi AtomSphere",
    "source": {
      "platform": "boomi",
      "platformVersion": "2024.1",
      "application": "Order Integration",
      "artifact": {
        "name": "Order_Sync_Process",
        "type": "process",
        "filePath": "/processes/Order_Sync_Process.xml",
        "fileType": "xml"
      },
      "environment": {
        "name": "Production",
        "atomId": "atom-prod-001"
      }
    },
    "target": {
      "platform": "logic-apps-standard",
      "workflowType": "stateful"
    },
    "migration": {
      "complexity": "low",
      "complexityScore": 40
    }
  },

  "triggers": [
    {
      "id": "trigger-http-listen",
      "name": "Start_HTTP_Listener",
      "type": "http",
      "category": "request-response",
      "config": {
        "method": "POST",
        "relativePath": "/orders/sync"
      },
      "sourceMapping": {
        "boomi": {
          "shape": "Start",
          "shapeType": "HTTP Client",
          "operation": "Listen",
          "connectorId": "conn-http-001",
          "responseProfile": "OrderResponse"
        }
      }
    },
    {
      "id": "trigger-schedule",
      "name": "Scheduled_Trigger",
      "type": "timer",
      "category": "polling",
      "config": {
        "schedule": {
          "frequency": "hour",
          "interval": 1
        }
      },
      "sourceMapping": {
        "boomi": {
          "shape": "Start",
          "shapeType": "No Data",
          "schedule": {
            "type": "interval",
            "minutes": 60
          }
        }
      }
    }
  ],

  "actions": [
    {
      "id": "action-map-transform",
      "name": "Map_Order_to_SAP",
      "type": "transform",
      "category": "data",
      "runAfter": { "trigger-http-listen": ["Succeeded"] },
      "config": {
        "transformType": "boomi-map",
        "mapRef": "#/maps/order-to-sap"
      },
      "sourceMapping": {
        "boomi": {
          "shape": "Map",
          "mapId": "map-001",
          "sourceProfile": "OrderProfile",
          "destinationProfile": "SAPOrderProfile",
          "functionCount": 5
        }
      },
      "targetMapping": {
        "logicAppsAction": "Transform_XML",
        "gap": true,
        "notes": "Boomi map requires conversion to XSLT"
      }
    },
    {
      "id": "action-decision",
      "name": "Check_Order_Type",
      "type": "switch",
      "category": "control-flow",
      "runAfter": { "action-map-transform": ["Succeeded"] },
      "config": {
        "expression": "@body('Map')?['orderType']"
      },
      "cases": {
        "NEW": { "actions": ["action-create-order"] },
        "UPDATE": { "actions": ["action-update-order"] },
        "CANCEL": { "actions": ["action-cancel-order"] }
      },
      "sourceMapping": {
        "boomi": {
          "shape": "Decision",
          "decisionType": "value",
          "firstValue": "OrderType",
          "operator": "equals",
          "branches": [
            { "value": "NEW", "path": "path-create" },
            { "value": "UPDATE", "path": "path-update" },
            { "value": "CANCEL", "path": "path-cancel" }
          ]
        }
      }
    },
    {
      "id": "action-branch",
      "name": "Parallel_Processing",
      "type": "parallel",
      "category": "control-flow",
      "branches": {
        "erp-update": { "actions": ["action-sap-connector"] },
        "notification": { "actions": ["action-send-email"] }
      },
      "sourceMapping": {
        "boomi": {
          "shape": "Branch",
          "branchType": "Parallel",
          "paths": ["ERP Path", "Notification Path"]
        }
      }
    },
    {
      "id": "action-sap-connector",
      "name": "Create_SAP_Order",
      "type": "http-call",
      "category": "integration",
      "config": {
        "connectionRef": "#/connections/sap-connector",
        "operation": "CREATE"
      },
      "sourceMapping": {
        "boomi": {
          "shape": "Connector",
          "connectorType": "SAP",
          "connectorId": "conn-sap-001",
          "action": "SEND",
          "operation": "BAPI_SALESORDER_CREATEFROMDAT2",
          "operationType": "BAPI"
        }
      }
    },
    {
      "id": "action-try-catch",
      "name": "Error_Handling_Block",
      "type": "scope",
      "category": "control-flow",
      "actions": ["action-sap-connector"],
      "errorHandling": {
        "catch": { "actions": ["action-log-error", "action-notify-admin"] }
      },
      "sourceMapping": {
        "boomi": {
          "shape": "Try/Catch",
          "tryPath": "main-path",
          "catchPath": "error-path"
        }
      }
    },
    {
      "id": "action-data-process",
      "name": "Aggregate_Results",
      "type": "compose",
      "category": "data",
      "config": {
        "operation": "combine"
      },
      "sourceMapping": {
        "boomi": {
          "shape": "Data Process",
          "processType": "Combine Documents",
          "combineType": "Merge"
        }
      }
    },
    {
      "id": "action-flow-control",
      "name": "Loop_Line_Items",
      "type": "foreach",
      "category": "control-flow",
      "config": {
        "items": "@body('GetOrder')?['items']"
      },
      "actions": ["action-process-item"],
      "sourceMapping": {
        "boomi": {
          "shape": "Flow Control",
          "flowType": "Process Call",
          "runMode": "parallel"
        }
      }
    }
  ],

  "connections": [
    {
      "id": "sap-connector",
      "name": "SAP_Connection",
      "type": "sap",
      "category": "erp",
      "config": {
        "applicationServer": "sap.contoso.com",
        "systemNumber": "00"
      },
      "sourceMapping": {
        "boomi": {
          "connector": "SAP",
          "connectionId": "conn-sap-001",
          "environment": "Production",
          "connectionType": "Connection Pool",
          "poolSize": 5
        }
      }
    },
    {
      "id": "sftp-connection",
      "name": "SFTP_Server",
      "type": "sftp",
      "category": "file",
      "config": {
        "host": "sftp.contoso.com",
        "port": 22
      },
      "sourceMapping": {
        "boomi": {
          "connector": "SFTP",
          "connectionId": "conn-sftp-001",
          "connectionType": "username-password"
        }
      }
    }
  ],

  "schemas": [
    {
      "id": "profile-order",
      "name": "OrderProfile",
      "type": "xml-schema",
      "sourceMapping": {
        "boomi": {
          "profile": "OrderProfile",
          "profileId": "prof-001",
          "profileType": "XML",
          "elementCount": 25
        }
      }
    },
    {
      "id": "profile-flat-file",
      "name": "LegacyOrderProfile",
      "type": "flat-file",
      "flatFileConfig": {
        "structure": "delimited",
        "fieldDelimiter": ",",
        "textQualifier": "\""
      },
      "sourceMapping": {
        "boomi": {
          "profile": "LegacyOrderProfile",
          "profileType": "Flat File",
          "delimiter": "Comma"
        }
      }
    }
  ],

  "maps": [
    {
      "id": "map-order-sap",
      "name": "Order_to_SAP_Map",
      "type": "boomi-map",
      "source": { "schemaRef": "#/schemas/profile-order" },
      "target": { "schemaRef": "#/schemas/profile-sap" },
      "functions": [
        { "name": "String Concatenate", "type": "string-concat", "convertible": true },
        { "name": "Date Format", "type": "date", "convertible": true },
        { "name": "Lookup Table", "type": "lookup", "convertible": false }
      ],
      "sourceMapping": {
        "boomi": {
          "mapId": "map-001",
          "mapName": "Order_to_SAP_Map",
          "functionCount": 12,
          "hasScripting": false,
          "hasCrossReference": true
        }
      },
      "targetMapping": {
        "type": "xslt",
        "conversionNeeded": true,
        "gap": true,
        "notes": "Cross-reference lookups need Azure Function"
      }
    }
  ],

  "gaps": [
    {
      "id": "gap-boomi-map",
      "category": "transform",
      "severity": "medium",
      "title": "Boomi Map Conversion",
      "description": "Boomi visual maps need conversion to XSLT",
      "resolution": {
        "strategy": "auto-generate",
        "pattern": "xslt-generation",
        "effort": { "hours": 8 }
      }
    },
    {
      "id": "gap-cross-reference",
      "category": "lookup",
      "severity": "medium",
      "title": "Cross Reference Table",
      "description": "Boomi cross-reference lookups need alternative",
      "resolution": {
        "strategy": "azure-function",
        "pattern": "lookup-function",
        "effort": { "hours": 4 }
      }
    }
  ],

  "extensions": {
    "boomi": {
      "accountId": "account-12345",
      "atomId": "atom-prod-001",
      "atomName": "Production-Atom",
      "environment": "Production",
      "processProperties": {
        "maxDocuments": 1000,
        "timeout": 3600
      },
      "deployedLocations": ["cloud", "atom-prod-001"],
      "executionMode": "low-latency"
    }
  }
}
```

---

## Boomi-Specific Mapping Reference

### Shapes → Logic Apps Actions

| Boomi Shape | Logic Apps Action | Notes |
|-------------|-------------------|-------|
| Start (HTTP) | HTTP Trigger | Direct mapping |
| Start (Schedule) | Recurrence Trigger | Direct mapping |
| Map | Transform XML/JSON | Requires XSLT conversion |
| Decision | Switch / Condition | Direct mapping |
| Branch | Parallel Branches | Direct mapping |
| Connector | Various Connectors | Depends on connector type |
| Try/Catch | Scope + Run After | Direct mapping |
| Data Process | Compose / Various | Depends on process type |
| Flow Control | For Each | Direct mapping |

### Connectors → Logic Apps Connectors

| Boomi Connector | Logic Apps Connector | Notes |
|-----------------|---------------------|-------|
| HTTP Client | HTTP | Direct mapping |
| SAP | SAP | Direct mapping |
| Database | SQL/Oracle/MySQL | Direct mapping |
| SFTP | SFTP-SSH | Direct mapping |
| Salesforce | Salesforce | Direct mapping |
| NetSuite | NetSuite | Direct mapping |
| Disk | File System | Requires gateway |

### Map Functions → XSLT/Expressions

| Boomi Function | XSLT/Logic Apps Equivalent |
|----------------|---------------------------|
| String Concatenate | `concat()` |
| Date Format | `format-dateTime()` |
| Substring | `substring()` |
| Lookup Table | Azure Function / Table Storage |
| Cross Reference | Azure Function / Table Storage |
| Scripting | Azure Function |

---

[← Back to IR Examples Index](../README.md#appendix-ir-examples-by-platform)
