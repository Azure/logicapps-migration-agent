---
name: runtime-validation-and-testing
description: Rules for runtime validation and comprehensive testing of migrated Logic Apps workflows.
---

# SAP PI/PO to Logic Apps — Runtime Validation and Testing

> **Rules for comprehensive testing and runtime validation of migrated Logic Apps workflows.**

## Testing Strategy

### Three-Tier Testing Approach

1. **Tier 1: Unit Testing** — Individual actions and functions
2. **Tier 2: Integration Testing** — Complete workflow execution
3. **Tier 3: Performance Testing** — Load and stress testing

## Tier 1: Unit Testing

### Rule 1: Test Individual Liquid Templates

Create test cases for each mapping:

```javascript
// tests/unit/mappings.test.js
const { applyTemplate } = require('../../src/templates/liquid-engine');

describe('Order Mapping', () => {
  it('should transform valid order to internal format', () => {
    const input = {
      orderId: '12345',
      customerId: '67890',
      items: [
        { sku: 'PROD-001', quantity: 2, unitPrice: 49.99 }
      ]
    };
    
    const template = require('../../src/templates/mappings/order-to-internal.liquid');
    const output = applyTemplate(template, input);
    
    expect(output.order_id).toBe('12345');
    expect(output.customer.id).toBe('67890');
    expect(output.line_items.length).toBe(1);
    expect(output.line_items[0].quantity).toBe(2);
  });
  
  it('should handle missing optional fields', () => {
    const input = {
      orderId: '12345',
      customerId: '67890'
      // items missing
    };
    
    const output = applyTemplate(template, input);
    expect(output.line_items).toEqual([]);
  });
  
  it('should apply discount correctly', () => {
    const input = {
      orderId: '12345',
      items: [
        { quantity: 1, unitPrice: 100, discountPercent: 10 }
      ]
    };
    
    const output = applyTemplate(template, input);
    expect(output.line_items[0].lineAmount).toBe(90); // 100 * (1 - 0.10)
  });
});
```

### Rule 2: Test Azure Functions

```javascript
// tests/unit/functions.test.js
const { validateOrder } = require('../../src/functions/order-validator');

describe('Order Validation', () => {
  it('should validate complete order', async () => {
    const order = {
      orderId: '12345',
      customerId: '67890',
      items: [{ sku: 'PROD-001', quantity: 1, unitPrice: 50 }]
    };
    
    const result = await validateOrder(order);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });
  
  it('should reject order without orderId', async () => {
    const order = {
      customerId: '67890',
      items: [{ sku: 'PROD-001', quantity: 1 }]
    };
    
    const result = await validateOrder(order);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('orderId is required');
  });
  
  it('should reject order with empty items', async () => {
    const order = {
      orderId: '12345',
      customerId: '67890',
      items: []
    };
    
    const result = await validateOrder(order);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('items must not be empty');
  });
});
```

## Tier 2: Integration Testing

### Rule 3: End-to-End Workflow Testing

Test complete workflow execution:

```javascript
// tests/integration/order-workflow.test.js
const LogicAppTester = require('@microsoft/logic-app-tester');

describe('Order Processing Workflow', () => {
  const logicApp = new LogicAppTester('order-processing-workflow');
  
  it('should process valid order successfully', async () => {
    const request = {
      orderId: '12345',
      customerId: '67890',
      items: [
        { sku: 'PROD-001', quantity: 2, unitPrice: 49.99 }
      ]
    };
    
    const result = await logicApp.trigger('When_HTTP_request_is_received', request);
    
    expect(result.status).toBe('Succeeded');
    expect(result.outputs.statusCode).toBe(200);
    
    // Verify SAP was called
    const sapAction = result.actions['Send_to_SAP'];
    expect(sapAction.status).toBe('Succeeded');
    expect(sapAction.inputs.body).toHaveProperty('order_id');
  });
  
  it('should handle validation failure gracefully', async () => {
    const request = {
      customerId: '67890'
      // Missing orderId
    };
    
    const result = await logicApp.trigger('When_HTTP_request_is_received', request);
    
    expect(result.status).toBe('Succeeded');
    expect(result.outputs.statusCode).toBe(400);
    expect(result.outputs.body).toHaveProperty('errors');
  });
  
  it('should retry on transient SAP failure', async () => {
    const request = {
      orderId: '12345',
      customerId: '67890',
      items: [{ sku: 'PROD-001', quantity: 1, unitPrice: 50 }]
    };
    
    // Mock SAP to fail initially, then succeed
    logicApp.mockAction('Send_to_SAP', [
      { status: 'Failed', error: 'Timeout' },
      { status: 'Succeeded', outputs: { body: { id: 'SAP123' } } }
    ]);
    
    const result = await logicApp.trigger('When_HTTP_request_is_received', request);
    
    expect(result.status).toBe('Succeeded');
    expect(result.actions['Send_to_SAP'].retryCount).toBe(1);
  });
  
  it('should archive order successfully', async () => {
    const request = {
      orderId: '12345',
      customerId: '67890',
      items: [{ sku: 'PROD-001', quantity: 1, unitPrice: 50 }]
    };
    
    const result = await logicApp.trigger('When_HTTP_request_is_received', request);
    
    // Verify archive action succeeded
    const archiveAction = result.actions['Archive_to_Blob'];
    expect(archiveAction.status).toBe('Succeeded');
  });
});
```

### Rule 4: Data Consistency Testing

```javascript
describe('Data Consistency', () => {
  it('should maintain data integrity through transformation', async () => {
    const originalOrder = {
      orderId: '12345',
      items: [
        { sku: 'A', quantity: 2, unitPrice: 100 },
        { sku: 'B', quantity: 3, unitPrice: 50 }
      ]
    };
    
    const result = await logicApp.triggerWithCapture(
      'When_HTTP_request_is_received',
      originalOrder
    );
    
    // Verify all items are in transformed order
    const sapPayload = result.capturedRequests['Send_to_SAP'][0].body;
    expect(sapPayload.line_items.length).toBe(2);
    
    // Verify total calculation
    const expectedTotal = (2 * 100) + (3 * 50); // 350
    expect(sapPayload.total).toBe(expectedTotal);
  });
});
```

## Tier 3: Performance Testing

### Rule 5: Load Testing

```javascript
// tests/performance/load-test.js
const k6 = require('k6');
const http = require('k6/http');
const { check, sleep } = require('k6');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Steady
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% under 500ms
    'http_req_failed': ['rate<0.1'],     // Less than 10% failures
  },
};

export default function () {
  const order = {
    orderId: `order-${Date.now()}`,
    customerId: 'CUST-001',
    items: [
      { sku: 'PROD-001', quantity: 1, unitPrice: 50 }
    ]
  };
  
  const response = http.post(
    'https://logicapp-prod.azurewebsites.net/api/orders',
    JSON.stringify(order),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  sleep(1);
}
```

### Rule 6: Stress Testing

```javascript
// tests/performance/stress-test.js
describe('Stress Testing', () => {
  it('should handle concurrent requests', async () => {
    const concurrency = 100;
    const requests = [];
    
    for (let i = 0; i < concurrency; i++) {
      requests.push(
        logicApp.trigger('When_HTTP_request_is_received', {
          orderId: `order-${i}`,
          customerId: `cust-${i}`,
          items: [{ sku: 'PROD-001', quantity: 1, unitPrice: 50 }]
        })
      );
    }
    
    const results = await Promise.all(requests);
    
    const successCount = results.filter(r => r.status === 'Succeeded').length;
    const successRate = successCount / concurrency;
    
    expect(successRate).toBeGreaterThan(0.95); // 95% success
  });
});
```

## Test Data Management

### Rule 7: Create Comprehensive Test Data Sets

```javascript
// tests/data/test-fixtures.js
module.exports = {
  validOrder: {
    orderId: '12345',
    customerId: '67890',
    items: [
      { sku: 'PROD-001', quantity: 2, unitPrice: 49.99 }
    ]
  },
  
  largeOrder: {
    orderId: '99999',
    customerId: '88888',
    items: Array.from({ length: 1000 }, (_, i) => ({
      sku: `PROD-${String(i+1).padStart(4, '0')}`,
      quantity: 1,
      unitPrice: 100
    }))
  },
  
  edgeCaseOrder: {
    orderId: '00000',
    customerId: '00000',
    items: [
      { sku: 'PROD-001', quantity: 0, unitPrice: 0 }
    ]
  }
};
```

## Validation Checklist

Before production deployment:

- ✓ All unit tests passing (100%)
- ✓ All integration tests passing (100%)
- ✓ Performance tests within SLA
- ✓ No unhandled exceptions in error paths
- ✓ Retry policies tested
- ✓ Timeout handling verified
- ✓ Concurrent load verified
- ✓ Data consistency validated
- ✓ Security tests passed
- ✓ Documentation complete

## Continuous Testing

Add to CI/CD pipeline:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install Dependencies
        run: npm install
      
      - name: Run Unit Tests
        run: npm run test:unit
      
      - name: Run Integration Tests
        run: npm run test:integration
      
      - name: Run Performance Tests
        run: npm run test:performance
      
      - name: Generate Coverage Report
        run: npm run coverage
      
      - name: Upload Coverage to Codecov
        uses: codecov/codecov-action@v2
```

This comprehensive testing strategy ensures reliable, high-performance Logic Apps deployments.
