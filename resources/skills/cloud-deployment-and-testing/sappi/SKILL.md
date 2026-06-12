---
name: cloud-deployment-and-testing
description: Rules for deploying Logic Apps workflows to Azure and conducting cloud-based testing.
---

# SAP PI/PO to Logic Apps — Cloud Deployment and Testing

> **Rules for deploying migrated workflows to Azure and conducting cloud-based validation and testing.**

## Deployment Strategy

### Multi-Environment Deployment

```
Development → Staging → Production
    ↓            ↓           ↓
  4 hours    8 hours    Production
  (Fast)     (Thorough) (Validated)
```

## Development Environment

### Rule 1: Deploy to Dev Environment

Use Azure Developer CLI (azd):

```bash
# Initialize project
azd init

# Provision infrastructure
azd provision

# Deploy workflows
azd deploy
```

This automatically:
- Creates resource group
- Deploys all Logic Apps
- Creates connections
- Provisions storage and databases

### Rule 2: Dev Environment Configuration

```yaml
# infra/parameters/dev.json
{
  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": { "value": "dev" },
    "location": { "value": "eastus" },
    "logAnalyticsRetention": { "value": 7 },
    "enableDiagnostics": { "value": true },
    "enableDetailedLogging": { "value": true },
    "scaleSKU": { "value": "S1" }
  }
}
```

### Rule 3: Dev Testing Tasks

After dev deployment:

1. **Smoke Tests:** Basic functionality
2. **Integration Tests:** All components working
3. **Local Testing:** Against mock data
4. **Connection Validation:** All connections active

## Staging Environment

### Rule 4: Deploy to Staging

```bash
azd deploy --environment staging
```

Staging should mirror production but with:
- Same workflow definitions
- Real connection strings (to test systems)
- Reduced scaling (cost optimization)
- Comprehensive logging enabled

### Rule 5: Staging Testing Strategy

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  workflow_run:
    workflows: ["Test"]
    types: [completed]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success'
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Staging
        run: azd deploy --environment staging
      
      - name: Run Staging Tests
        run: npm run test:staging
      
      - name: Run Performance Baseline
        run: npm run test:performance:baseline
      
      - name: Run Security Scan
        run: npm run security:scan
      
      - name: Notify Team
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment complete'
```

## Production Environment

### Rule 6: Production Deployment Prerequisites

Before deploying to production:

- ✓ All staging tests passed
- ✓ Performance baselines acceptable
- ✓ Security scan passed
- ✓ Stakeholder approval obtained
- ✓ Rollback plan documented
- ✓ Change management completed
- ✓ Monitoring and alerting configured
- ✓ Support team trained

### Rule 7: Blue-Green Deployment

For zero-downtime deployments:

```yaml
# Deploy new version alongside current version
Blue (Current):   order-processing-workflow-v1
Green (New):      order-processing-workflow-v2

# After validation, switch traffic
Traffic: API Gateway → Blue → Green (new)

# Keep Blue available for rollback
```

Implementation:

```bicep
// Deploy new workflow version
resource newWorkflow 'Microsoft.Web/workflows@2019-05-01' = {
  name: 'order-processing-workflow-${newVersion}'
  location: location
  properties: {
    definition: loadJsonContent('./workflows/OrderProcessing/workflow-new.json')
    state: 'Enabled'
  }
}

// Switch traffic via API Management
resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2021-01-01-preview' = {
  name: '${apiService.name}/order-api/policy'
  properties: {
    format: 'xml'
    value: '''
    <policies>
      <inbound>
        <base />
        <set-backend-service 
          base-url="https://${newWorkflow.properties.accessEndpoint}/..."/>
      </inbound>
    </policies>
    '''
  }
}
```

### Rule 8: Production Testing

```javascript
// tests/production/smoke-tests.js
describe('Production Smoke Tests', () => {
  const productionUrl = process.env.PRODUCTION_ENDPOINT;
  
  it('should process order in production', async () => {
    const response = await fetch(`${productionUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'PROD-TEST-001',
        customerId: 'CUST-001',
        items: [{ sku: 'PROD-001', quantity: 1, unitPrice: 50 }]
      })
    });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('orderId');
  });
  
  it('should handle production load', async () => {
    const startTime = Date.now();
    const requests = 100;
    
    const responses = await Promise.all(
      Array(requests).fill(null).map(() =>
        fetch(`${productionUrl}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: `PROD-LOAD-${Date.now()}`,
            customerId: 'CUST-001',
            items: [{ sku: 'PROD-001', quantity: 1, unitPrice: 50 }]
          })
        })
      )
    );
    
    const duration = Date.now() - startTime;
    const successCount = responses.filter(r => r.status === 200).length;
    
    expect(successCount / requests).toBeGreaterThan(0.99);
    expect(duration).toBeLessThan(5000); // 100 requests in 5 seconds
  });
});
```

## Monitoring and Alerting

### Rule 9: Configure Application Insights

```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'ai-${environment}-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 90
    publicNetworkAccessForIngestion: 'Enabled'
  }
}

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: 'law-${environment}-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}
```

### Rule 10: Create Alerts

```bicep
// Alert on workflow failures
resource failureAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-${environment}-workflow-failures'
  location: 'global'
  properties: {
    description: 'Alert when workflow fails'
    severity: 1
    enabled: true
    scopes: [
      logicApp.id
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.MultipleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Runs failed'
          metricName: 'RunsFailed'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert on high latency
resource latencyAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-${environment}-high-latency'
  location: 'global'
  properties: {
    description: 'Alert when latency exceeds threshold'
    severity: 2
    enabled: true
    scopes: [
      logicApp.id
    ]
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.MultipleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Runs latency'
          metricName: 'RunLatency'
          operator: 'GreaterThan'
          threshold: 5000  // 5 seconds
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}
```

## Rollback Strategy

### Rule 11: Implement Rollback Plan

```bash
#!/bin/bash
# scripts/rollback.sh

ENVIRONMENT=$1
PREVIOUS_VERSION=$(get_previous_version $ENVIRONMENT)

echo "Rolling back to version: $PREVIOUS_VERSION"

# Deploy previous version
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters version=$PREVIOUS_VERSION

# Verify deployment
npm run test:production

if [ $? -eq 0 ]; then
  echo "Rollback successful"
  # Notify team
  send_notification "Rollback to $PREVIOUS_VERSION completed successfully"
else
  echo "Rollback verification failed"
  send_notification "CRITICAL: Rollback verification failed!"
  exit 1
fi
```

## Post-Deployment Validation

### Rule 12: Verify Production Deployment

```javascript
// tests/postdeploy/validation.js
describe('Post-Deployment Validation', () => {
  const productionEndpoint = process.env.PRODUCTION_ENDPOINT;
  
  it('should have all connections active', async () => {
    const connections = await fetch(
      `${productionEndpoint}/api/connections`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    ).then(r => r.json());
    
    for (const conn of connections) {
      expect(conn.status).toBe('Connected');
    }
  });
  
  it('should process orders successfully', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`${productionEndpoint}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `VALIDATE-${i}`,
          customerId: 'CUST-001',
          items: [{ sku: 'PROD-001', quantity: 1, unitPrice: 50 }]
        })
      });
      
      expect(response.status).toBe(200);
    }
  });
  
  it('should have monitoring configured', async () => {
    const insights = await getApplicationInsights();
    expect(insights.status).toBe('Enabled');
    expect(insights.retentionDays).toBeGreaterThanOrEqual(30);
  });
});
```

## Deployment Checklist

Before declaring deployment complete:

- ✓ All workflows deployed successfully
- ✓ All connections verified
- ✓ Smoke tests passing
- ✓ Production tests passing
- ✓ Monitoring and alerts active
- ✓ Performance meets baseline
- ✓ No errors in Application Insights
- ✓ Team notified of deployment
- ✓ Documentation updated
- ✓ Support team trained

## Continuous Deployment Pipeline

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy to Production

on:
  push:
    branches: [main]
    paths: ['src/**', 'infra/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run All Tests
        run: npm test

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: azd deploy --environment staging

  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Production
        run: azd deploy --environment production
      
      - name: Post-Deploy Validation
        run: npm run test:production
      
      - name: Notify Teams
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment complete'
```

This systematic approach ensures reliable, validated deployments to production with minimal risk.
