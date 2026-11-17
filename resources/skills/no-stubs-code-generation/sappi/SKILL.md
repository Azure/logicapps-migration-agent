---
name: no-stubs-code-generation
description: Rules ensuring generated code is complete with no placeholders or stub implementations.
---

# SAP PI/PO to Logic Apps — No-Stubs Code Generation

> **Rules ensuring all generated code is production-ready with no placeholders or stub implementations.**

## Validation Rules

### Rule 1: No Placeholder Strings

Scan all generated code for stub indicators:

```
FORBIDDEN_PATTERNS = [
  "TODO:",
  "FIXME:",
  "STUB:",
  "NOT_IMPLEMENTED",
  "...",
  "<!-- TODO -->",
  "/* TODO */",
  "placeholder",
  "stub",
  "mock",
  "fake"
]

FOR EACH file IN generated_code:
  FOR EACH pattern IN FORBIDDEN_PATTERNS:
    IF file.contains(pattern):
      FLAG_ERROR("Placeholder found: " + pattern)
    END
  END
END
```

### Rule 2: No Incomplete References

All references must be fully resolved:

```
FOR EACH reference IN code_references:
  IF reference.target == NULL OR reference.target == UNDEFINED:
    FLAG_ERROR("Unresolved reference: " + reference)
  END
  
  IF reference.target.status != "DEFINED":
    FLAG_ERROR("Target not fully defined: " + reference.target)
  END
END
```

### Rule 3: All Actions Have Implementations

Every Logic Apps action must have complete configuration:

```json
{
  "Send_to_SAP": {
    // ✓ COMPLETE: All required fields present
    "type": "Send_HTTP_Request",
    "inputs": {
      "method": "POST",
      "uri": "@parameters('sap_endpoint')",
      "headers": { "Content-Type": "application/json" },
      "body": "@body('transform')",
      "authentication": { "type": "ManagedServiceIdentity" }
    },
    "runAfter": { "transform": ["Succeeded"] }
  },
  
  // ✗ INCOMPLETE: Missing inputs
  "Send_to_Database": {
    "type": "Execute_SQL_Query",
    // Missing: inputs, runAfter
  }
}
```

### Rule 4: All Liquid Templates Are Complete

Every Liquid template must have all field mappings:

**Valid:**
```liquid
{
  "order_id": "{{ order.id }}",
  "customer": {
    "id": "{{ order.customer_id }}",
    "name": "{{ order.customer_name }}"
  },
  "items": [
    {%- for item in order.items -%}
    {
      "sku": "{{ item.sku }}",
      "quantity": {{ item.quantity }},
      "price": {{ item.unit_price }}
    }
    {%- if forloop.last == false %},{% endif -%}
    {%- endfor -%}
  ],
  "total": {{ calculateTotal(order.items) }}
}
```

**Invalid (has undefined fields):**
```liquid
{
  "order_id": "{{ order.id }}",
  "customer": {
    "id": "{{ order.customer_id }}"
    // Missing: name
  },
  "items": [...]
  // Missing: total calculation
}
```

### Rule 5: All Error Handlers Are Defined

Every scope must have error handling:

```json
{
  "actions": {
    "Process_Order": {
      "type": "Scope",
      "actions": [
        // Processing actions
      ]
    },
    "Handle_Errors": {
      "type": "Scope",
      "runAfter": { "Process_Order": ["Failed", "TimedOut"] },
      "actions": [
        {
          "type": "Send_an_Email_Notification",
          "inputs": {
            "to": "@parameters('error_email')",
            "subject": "Order Processing Failed",
            "body": "@body('error')"
          }
        }
      ]
    }
  }
}
```

## Code Quality Checks

### Rule 6: All Connections Are Configured

Every connector action must reference a connection:

```
FOR EACH connector_action IN workflow.actions:
  IF connector_action.type IN ["SQL", "ServiceBus", "HTTP", "SAP"]:
    IF NOT connector_action.inputs.connection THEN
      FLAG_ERROR("Connection not configured: " + connector_action.name)
    END
  END
END
```

### Rule 7: All Parameters Are Declared

Every referenced parameter must be declared:

```
REFERENCED_PARAMS = EXTRACT_PARAMS(workflow.actions)
DECLARED_PARAMS = KEYS(workflow.parameters)

FOR EACH param IN REFERENCED_PARAMS:
  IF param NOT IN DECLARED_PARAMS:
    FLAG_ERROR("Parameter not declared: " + param)
  END
END
```

### Rule 8: All Variables Are Initialized

Every variable used must be initialized:

```
USED_VARIABLES = EXTRACT_VARIABLES(workflow.actions)
INITIALIZED_VARIABLES = []

FOR EACH action IN workflow.actions:
  IF action.type == "Initialize_variable":
    INITIALIZED_VARIABLES.push(action.inputs.variables[0].name)
  END
END

FOR EACH var IN USED_VARIABLES:
  IF var NOT IN INITIALIZED_VARIABLES:
    FLAG_ERROR("Variable not initialized: " + var)
  END
END
```

## Function Code Validation

### Rule 9: All Functions Have Return Statements

```javascript
// ✓ VALID: Has explicit return
module.exports = async function (context, req) {
  const result = processOrder(req.body);
  context.res = {
    status: 200,
    body: result
  };
};

// ✗ INVALID: Missing return
module.exports = async function (context, req) {
  const result = processOrder(req.body);
  // No return statement
};
```

### Rule 10: All Exception Paths Are Handled

```javascript
// ✓ VALID: All paths handled
module.exports = async function (context, req) {
  try {
    if (!req.body.orderId) {
      return {
        status: 400,
        body: { error: "orderId required" }
      };
    }
    
    const result = await processOrder(req.body);
    return {
      status: 200,
      body: result
    };
  } catch (error) {
    context.log.error(`Error: ${error}`);
    return {
      status: 500,
      body: { error: error.message }
    };
  }
};

// ✗ INVALID: Missing error handling
module.exports = async function (context, req) {
  const result = await processOrder(req.body);
  return { status: 200, body: result };
};
```

## Completeness Checklist

Before finalizing code, verify:

- ✓ No "TODO" or "FIXME" comments
- ✓ All references resolved
- ✓ All actions configured
- ✓ All templates populated
- ✓ All error handlers present
- ✓ All connections configured
- ✓ All parameters declared
- ✓ All variables initialized
- ✓ All functions have returns
- ✓ All exceptions handled
- ✓ No undefined/null inputs
- ✓ No missing required fields
- ✓ All test cases passing
- ✓ Documentation complete

## Validation Output

Generate validation report:

```json
{
  "validationReport": {
    "timestamp": "2024-01-20T10:30:00Z",
    "workflow": "OrderProcessing",
    "status": "VALID",
    "checks": [
      {
        "name": "No Placeholders",
        "status": "PASS",
        "findings": 0
      },
      {
        "name": "Reference Resolution",
        "status": "PASS",
        "findings": 0
      },
      {
        "name": "Connection Configuration",
        "status": "PASS",
        "findings": 0
      },
      {
        "name": "Parameter Declaration",
        "status": "PASS",
        "findings": 0
      },
      {
        "name": "Variable Initialization",
        "status": "PASS",
        "findings": 0
      },
      {
        "name": "Error Handling",
        "status": "PASS",
        "findings": 0
      }
    ],
    "totalIssues": 0,
    "recommendation": "READY_FOR_DEPLOYMENT"
  }
}
```

## Continuous Validation

Add to deployment pipeline:

```yaml
# .github/workflows/validate-code.yml
name: Code Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Check for Placeholders
        run: |
          if grep -r "TODO\|FIXME\|STUB\|placeholder" src/workflows/; then
            echo "Found placeholders in code"
            exit 1
          fi
      
      - name: Validate Workflow JSON
        run: |
          npm run validate:workflows
      
      - name: Validate Functions
        run: |
          npm run validate:functions
      
      - name: Run Tests
        run: |
          npm test
      
      - name: Code Quality Check
        run: |
          npm run lint
```

This ensures all generated code is production-ready with no partial implementations.
