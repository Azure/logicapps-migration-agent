---
name: workflow-json-generation-rules
description: Rules for generating workflow.json definitions for migrated SAP PI/PO processes.
---

# SAP PI/PO to Logic Apps — Workflow.json Generation

> **Rules for generating Azure Logic Apps workflow.json definitions from SAP PI/PO processes.**

## Workflow Generation Strategy

### Input: Migration Plan

1. Integration Process specification
2. Action mappings (process steps → Logic Apps actions)
3. Message mapping templates (Liquid templates)
4. Connection configuration
5. Error handling strategy

### Output: workflow.json

Complete Logic Apps workflow definition following Azure schema.

## Workflow Structure

```json
{
  "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
  "contentVersion": "1.0.0.0",
  "parameters": { ... },
  "triggers": { ... },
  "actions": { ... },
  "outputs": { ... }
}
```

## Generation Rules by Step Type

### Rule 1: Receive Step → HTTP Trigger

**SAP PI/PO:**
```xml
<Step type="Receive" channel="HTTP_Input" messageType="SalesOrder" />
```

**Generated workflow.json:**
```json
{
  "triggers": {
    "When_HTTP_request_is_received": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "method": "POST",
        "schema": {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": { /* SalesOrder schema */ },
          "required": ["orderId"]
        }
      }
    }
  }
}
```

### Rule 2: Send Step → HTTP Request Action

**SAP PI/PO:**
```xml
<Step type="Send" channel="SAP_Backend" mapping="OrderToInternal" />
```

**Generated workflow.json:**
```json
{
  "actions": {
    "Send_to_SAP": {
      "type": "Send_HTTP_Request",
      "runAfter": { "Transform_Order": ["Succeeded"] },
      "inputs": {
        "method": "POST",
        "uri": "@parameters('sap_backend_url')",
        "headers": {
          "Content-Type": "application/json",
          "Authorization": "@parameters('sap_auth_token')"
        },
        "body": "@body('Transform_Order')",
        "authentication": {
          "type": "ManagedServiceIdentity"
        }
      },
      "runtimeConfiguration": {
        "timeout": "PT30S",
        "retry": {
          "type": "exponential",
          "interval": "PT1S",
          "count": 3,
          "maximumInterval": "PT1H"
        }
      }
    }
  }
}
```

### Rule 3: Transform Step → Liquid Action

**SAP PI/PO:**
```xml
<Step type="Transform" mapping="OrderToInternal">
  <MappingRule source="Order/Items/Item" target="Items/Item" />
</Step>
```

**Generated workflow.json:**
```json
{
  "actions": {
    "Transform_Order": {
      "type": "Liquid",
      "runAfter": { "When_HTTP_request_is_received": ["Succeeded"] },
      "inputs": {
        "content": "@triggerBody()",
        "integrationAccountArtifactSelector": {
          "selectProperties": false
        },
        "map": {
          "name": "order-to-internal.liquid"
        }
      }
    }
  }
}
```

### Rule 4: Fork Step → Parallel Action

**SAP PI/PO:**
```xml
<Step type="Fork">
  <Branch name="SAPBranch"> ... </Branch>
  <Branch name="ArchiveBranch"> ... </Branch>
</Step>
```

**Generated workflow.json:**
```json
{
  "actions": {
    "Parallel_Processing": {
      "type": "Parallel",
      "runAfter": { "Transform_Order": ["Succeeded"] },
      "actions": {
        "SAP_Branch": {
          "type": "Scope",
          "actions": { /* SAP send actions */ }
        },
        "Archive_Branch": {
          "type": "Scope",
          "actions": { /* Archive actions */ }
        }
      }
    }
  }
}
```

### Rule 5: Join Step → Until Action

**SAP PI/PO:**
```xml
<Step type="Join" waitFor="all" timeout="300">
  <Input from="SAPBranch" />
  <Input from="ArchiveBranch" />
</Step>
```

**Generated workflow.json:**
```json
{
  "actions": {
    "Wait_for_Parallel_Completion": {
      "type": "Until",
      "runAfter": { "Parallel_Processing": ["Succeeded"] },
      "inputs": {
        "limit": {
          "timeout": "PT5M"
        },
        "expression": "@equals(length(coalesce(body('Parallel_Processing')?['SAP_Branch'], null)), 1)"
      },
      "actions": {
        "Aggregate_Results": {
          "type": "Compose",
          "inputs": {
            "sap_result": "@body('Parallel_Processing')['SAP_Branch']",
            "archive_result": "@body('Parallel_Processing')['Archive_Branch']"
          }
        }
      }
    }
  }
}
```

### Rule 6: Decision Step → Switch Action

**SAP PI/PO:**
```xml
<Step type="Switch" condition="Order/Type">
  <Case value="Standard"> ... </Case>
  <Case value="Express"> ... </Case>
  <Default> ... </Default>
</Step>
```

**Generated workflow.json:**
```json
{
  "actions": {
    "Route_by_Order_Type": {
      "type": "Switch",
      "runAfter": { "Transform_Order": ["Succeeded"] },
      "cases": [
        {
          "name": "Standard_Order",
          "inputs": {
            "expression": "@equals(body('Transform_Order')['orderType'], 'Standard')"
          },
          "actions": { /* standard order processing */ }
        },
        {
          "name": "Express_Order",
          "inputs": {
            "expression": "@equals(body('Transform_Order')['orderType'], 'Express')"
          },
          "actions": { /* express order processing */ }
        }
      ],
      "default": {
        "actions": { /* default handling */ }
      }
    }
  }
}
```

### Rule 7: Loop Step → For Each Action

**SAP PI/PO:**
```xml
<Step type="Loop" collection="Order/Items/Item">
  <Action> ... </Action>
</Step>
```

**Generated workflow.json:**
```json
{
  "actions": {
    "Process_Order_Items": {
      "type": "Foreach",
      "runAfter": { "Parse_Order": ["Succeeded"] },
      "actions": {
        "Process_Item": {
          "type": "Compose",
          "inputs": {
            "item_id": "@item().itemId",
            "quantity": "@item().quantity"
          }
        }
      },
      "inputs": {
        "from": "@body('Parse_Order')['items']"
      },
      "runtimeConfiguration": {
        "concurrency": {
          "repetitions": 5
        }
      }
    }
  }
}
```

## Error Handling Generation

### Rule: Add Error Handling to All Actions

```json
{
  "actions": {
    "Send_to_SAP": {
      "type": "Scope",
      "actions": [ /* actual send action */ ]
    },
    "Handle_Send_Failure": {
      "type": "Scope",
      "runAfter": {
        "Send_to_SAP": ["Failed", "TimedOut"]
      },
      "actions": [
        {
          "type": "Compose",
          "name": "Log_Error",
          "inputs": {
            "error": "@result('Send_to_SAP')",
            "timestamp": "@utcNow()",
            "orderId": "@body('Transform_Order')['orderId']"
          }
        },
        {
          "type": "Send_an_Email_Notification",
          "inputs": {
            "to": "@parameters('error_notification_email')",
            "subject": "Order Processing Failed",
            "body": "@outputs('Log_Error')"
          }
        }
      ]
    }
  }
}
```

## Parameters Generation

```json
{
  "parameters": {
    "sap_backend_url": {
      "type": "string",
      "description": "SAP backend endpoint URL"
    },
    "sap_auth_token": {
      "type": "securestring",
      "description": "SAP authentication token"
    },
    "error_notification_email": {
      "type": "string",
      "description": "Email for error notifications"
    }
  }
}
```

## Workflow Finalization Rules

### Rule 1: Add Consistent Naming

All actions follow pattern: `{Action}_{TargetSystem}`
- `Transform_Order`
- `Send_to_SAP`
- `Store_in_Archive`

### Rule 2: Add Run-After Dependencies

Every action (except triggers) must have `runAfter` specifying dependencies.

### Rule 3: Add Timeout Configuration

```json
{
  "runtimeConfiguration": {
    "timeout": "PT30S"
  }
}
```

### Rule 4: Add Retry Policy

```json
{
  "runtimeConfiguration": {
    "retry": {
      "type": "exponential",
      "count": 3,
      "interval": "PT1S",
      "maximumInterval": "PT1H"
    }
  }
}
```

### Rule 5: Add Outputs

```json
{
  "outputs": {
    "workflow_status": {
      "type": "string",
      "value": "@if(equals(result('actions'), 'Succeeded'), 'Success', 'Failed')"
    },
    "result_message": {
      "type": "object",
      "value": "@body('last_action')"
    }
  }
}
```

## Generation Pseudocode

```
FUNCTION generateWorkflowJson(integrationProcess, mappings, connections):
  workflow = CREATE_EMPTY_WORKFLOW()
  
  # Add triggers
  FOR EACH receive_step IN integrationProcess.receives:
    workflow.triggers += GENERATE_TRIGGER(receive_step)
  END
  
  # Add transformations
  FOR EACH transform_step IN integrationProcess.transforms:
    workflow.actions += GENERATE_LIQUID_ACTION(transform_step, mappings)
  END
  
  # Add sends
  FOR EACH send_step IN integrationProcess.sends:
    workflow.actions += GENERATE_SEND_ACTION(send_step, connections)
  END
  
  # Add control flow
  FOR EACH control_step IN integrationProcess.control_flow:
    workflow.actions += GENERATE_CONTROL_FLOW(control_step)
  END
  
  # Add error handling
  workflow.actions += ADD_ERROR_HANDLING(workflow.actions)
  
  # Add outputs
  workflow.outputs = GENERATE_OUTPUTS(workflow.actions)
  
  RETURN workflow
END
```

This systematic generation ensures consistent, valid workflow.json files with proper dependencies and error handling.
