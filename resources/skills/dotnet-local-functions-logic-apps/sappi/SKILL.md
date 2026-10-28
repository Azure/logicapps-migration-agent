---
name: dotnet-local-functions-logic-apps
description: Rules for generating .NET local functions in Azure Functions for Logic Apps Standard.
---

# SAP PI/PO to Logic Apps — .NET Local Functions

> **Rules for generating and integrating .NET Azure Functions for custom logic and transformations.**

## When to Use Local Functions

Generate local functions for:

1. **Complex Mapping Logic:** Transformations too complex for Liquid
2. **Custom Validation:** Business rule validation
3. **Legacy Code Integration:** Wrap existing .NET components
4. **Performance-Critical Logic:** Optimized calculations
5. **Specialized Algorithms:** Encryption, hashing, compression

## Function Project Structure

```
src/functions/
├── local-function-app/
│   ├── .gitignore
│   ├── host.json
│   ├── local.settings.json
│   ├── package.json (or .csproj for .NET)
│   ├── OrderValidator/
│   │   ├── function.json
│   │   └── index.js (or run.cs)
│   ├── OrderCalculator/
│   │   ├── function.json
│   │   └── index.js
│   └── ...
```

## Generation Rules

### Rule 1: Create Function Project

Generate `host.json`:

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[2.*, 3.0.0)"
  },
  "functionTimeout": "00:05:00",
  "tracing": {
    "consoleLevel": "verbose"
  }
}
```

### Rule 2: Order Validator Function

From SAP PI/PO custom mapping for order validation:

**Function.json:**
```json
{
  "scriptFile": "index.js",
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post"],
      "route": "validate-order"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "$return"
    }
  ]
}
```

**index.js:**
```javascript
module.exports = async function (context, req) {
    const order = req.body;
    const errors = [];
    
    // Validate required fields
    if (!order.orderId) errors.push("orderId is required");
    if (!order.customerId) errors.push("customerId is required");
    if (!order.items || order.items.length === 0) errors.push("items must not be empty");
    
    // Validate items
    for (const item of order.items || []) {
        if (!item.sku) errors.push(`Item missing SKU`);
        if (item.quantity < 0) errors.push(`Item quantity cannot be negative`);
    }
    
    // Validate order total
    const total = (order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (total > 1000000) errors.push("Order total exceeds limit");
    
    context.res = {
        status: errors.length > 0 ? 400 : 200,
        body: {
            isValid: errors.length === 0,
            errors: errors,
            validatedAt: new Date().toISOString()
        }
    };
};
```

### Rule 3: Order Calculator Function

For complex calculations:

**index.js:**
```javascript
module.exports = async function (context, req) {
    const items = req.body.items;
    let subtotal = 0;
    let taxAmount = 0;
    const taxRate = 0.08;
    
    // Calculate line items
    const lineItems = items.map(item => {
        const lineTotal = item.quantity * item.unitPrice;
        const discount = (item.discountPercent || 0) / 100;
        const lineAmount = lineTotal * (1 - discount);
        subtotal += lineAmount;
        
        return {
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: discount * 100,
            lineAmount: lineAmount
        };
    });
    
    taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    
    context.res = {
        status: 200,
        body: {
            items: lineItems,
            subtotal: subtotal,
            tax: taxAmount,
            total: total,
            calculatedAt: new Date().toISOString()
        }
    };
};
```

### Rule 4: Data Transformation Function

For complex mapping transformations:

**index.js:**
```javascript
module.exports = async function (context, req) {
    const sourceOrder = req.body;
    
    // Transform source order to internal format
    const internalOrder = {
        order_id: sourceOrder.orderId,
        customer: {
            id: sourceOrder.customerId,
            name: sourceOrder.customerName,
            email: sourceOrder.contactEmail
        },
        line_items: (sourceOrder.items || []).map((item, index) => ({
            line_number: index + 1,
            material_number: item.sku,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            currency: sourceOrder.currency || 'USD',
            plant: sourceOrder.plantCode || '1000'
        })),
        delivery_address: {
            street: sourceOrder.shipToAddress?.street,
            city: sourceOrder.shipToAddress?.city,
            state: sourceOrder.shipToAddress?.state,
            postal_code: sourceOrder.shipToAddress?.zip,
            country: sourceOrder.shipToAddress?.country
        },
        payment_terms: sourceOrder.paymentTerms || 'NET30',
        order_date: new Date().toISOString(),
        source_system: 'API_GATEWAY',
        processing_id: `ORD-${Date.now()}`
    };
    
    context.res = {
        status: 200,
        body: internalOrder
    };
};
```

## Function Integration with Logic Apps

### Rule 5: Call Function from Workflow

In workflow.json:

```json
{
  "actions": {
    "Call_Validation_Function": {
      "type": "Function",
      "inputs": {
        "function": {
          "id": "[concat('/subscriptions/', subscription().subscriptionId, '/resourceGroups/', resourceGroup().name, '/providers/Microsoft.Web/sites/', parameters('functionAppName'), '/functions/OrderValidator')]"
        },
        "body": "@body('Transform_Order')",
        "method": "POST"
      }
    }
  }
}
```

### Rule 6: Error Handling for Functions

```json
{
  "actions": {
    "Call_Function_With_Error_Handling": {
      "type": "Scope",
      "actions": [
        {
          "type": "Function",
          "name": "Call_Validation",
          "inputs": { /* function call */ }
        }
      ],
      "runAfter": {}
    },
    "Handle_Function_Error": {
      "type": "If",
      "runAfter": { "Call_Function_With_Error_Handling": ["Failed", "TimedOut"] },
      "expression": "@equals(result('Call_Function_With_Error_Handling'), 'Failed')",
      "actions": {
        "Log_Function_Error": {
          "type": "Compose",
          "inputs": {
            "error": "@result('Call_Function_With_Error_Handling')",
            "timestamp": "@utcNow()"
          }
        }
      }
    }
  }
}
```

## .NET C# Example

For C# Azure Functions:

**run.csx:**
```csharp
public static async Task<IActionResult> Run(
    HttpRequest req,
    ILogger log)
{
    try
    {
        string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
        dynamic order = JsonConvert.DeserializeObject(requestBody);
        
        // Validation logic
        var errors = new List<string>();
        
        if (string.IsNullOrEmpty(order?.orderId?.ToString()))
            errors.Add("orderId is required");
        
        if (order?.items == null || ((IEnumerable)order.items).Cast<object>().Count() == 0)
            errors.Add("items must not be empty");
        
        return new OkObjectResult(new
        {
            isValid = errors.Count == 0,
            errors = errors,
            validatedAt = DateTime.UtcNow
        });
    }
    catch (Exception ex)
    {
        log.LogError($"Validation error: {ex.Message}");
        return new BadRequestObjectResult(new { error = ex.Message });
    }
}
```

## Deployment Integration

### Rule 7: Deploy Functions with Infrastructure

In Bicep template:

```bicep
resource functionApp 'Microsoft.Web/sites@2021-02-01' = {
  name: 'func-${environment}-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${listKeys(storageAccount.id, '2021-02-01').keys[0].value}'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
}
```

## Best Practices

1. **Keep functions small and focused** — One responsibility per function
2. **Use dependency injection** — For logging, configuration
3. **Add comprehensive error handling** — All functions need try-catch
4. **Log all operations** — Application Insights integration
5. **Test thoroughly** — Unit test all functions
6. **Document requirements** — API contracts and schemas
7. **Version your functions** — Support multiple versions if needed
8. **Monitor performance** — Track execution time and failures

This approach enables complex custom logic while maintaining the maintainability benefits of Logic Apps.
