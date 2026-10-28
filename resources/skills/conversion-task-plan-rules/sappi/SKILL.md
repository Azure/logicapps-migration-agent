---
name: conversion-task-plan-rules
description: Rules for decomposing migration plans into concrete conversion tasks.
---

# SAP PI/PO to Logic Apps — Conversion Task Planning

> **Rules for breaking down migration plans into executable conversion tasks.**

## Task Decomposition Strategy

### Task Categories

1. **Infrastructure Setup Tasks**
   - Create Azure Storage accounts
   - Create Service Bus namespaces
   - Create connections for external systems
   - Configure managed identities

2. **Workflow Development Tasks**
   - Create Logic Apps workflow
   - Implement trigger
   - Implement actions
   - Implement error handling

3. **Mapping Development Tasks**
   - Create Liquid templates for message mappings
   - Create Local Functions for custom logic
   - Create variable schemas

4. **Connection Configuration Tasks**
   - Set up SAP connector connection
   - Set up SQL connector connection
   - Set up SFTP connector connection
   - Configure connection string parameters

5. **Testing Tasks**
   - Create test data
   - Run unit tests
   - Run integration tests
   - Run performance tests

6. **Deployment Tasks**
   - Deploy workflow to dev environment
   - Deploy workflow to staging environment
   - Deploy workflow to production
   - Configure monitoring and alerts

## Task Generation Rules

### For Each Integration Process:

```
1. CREATE infrastructure_task:
   - Task: Set up connections and storage
   - Dependencies: None
   - Effort: 4 hours
   - Owner: Infrastructure team

2. CREATE workflow_task:
   - Task: Create Logic Apps workflow structure
   - Dependencies: infrastructure_task
   - Effort: 2 hours
   - Owner: Developer

3. FOR EACH trigger IN process:
   CREATE trigger_task:
   - Task: Implement [trigger_type] trigger
   - Dependencies: workflow_task
   - Effort: [estimated effort]
   - Owner: Developer

4. FOR EACH transformation IN process:
   CREATE mapping_task:
   - Task: Create Liquid template or function
   - Dependencies: workflow_task
   - Effort: [estimated effort]
   - Owner: Developer

5. FOR EACH action IN process:
   CREATE action_task:
   - Task: Implement [action_type] action
   - Dependencies: mapping_task (if any), workflow_task
   - Effort: [estimated effort]
   - Owner: Developer

6. CREATE error_handling_task:
   - Task: Implement error handling and retry logic
   - Dependencies: All action tasks
   - Effort: 3 hours
   - Owner: Developer

7. CREATE testing_task:
   - Task: Create and run tests
   - Dependencies: error_handling_task
   - Effort: 4 hours
   - Owner: QA

8. CREATE deployment_task:
   - Task: Deploy to environments
   - Dependencies: testing_task
   - Effort: 2 hours
   - Owner: DevOps
```

## Task Structure

Each task has:

```json
{
  "taskId": "task-order-http-trigger",
  "name": "Implement HTTP Trigger for Order Processing",
  "description": "Create HTTP trigger that receives sales orders",
  "category": "workflow-development",
  "processId": "ip-order-processing",
  "effort": 1.5,
  "effortUnit": "hours",
  "priority": 1,
  "status": "ready",
  "dependencies": [
    "task-order-infrastructure-setup"
  ],
  "assignedTo": "developer-1",
  "generatedCode": {
    "language": "json",
    "content": "{ trigger definition JSON }"
  },
  "acceptanceCriteria": [
    "Trigger accepts POST requests",
    "Request body validates against schema",
    "Returns 200 OK on success",
    "Returns 400 on validation error"
  ],
  "testPlan": [
    "Test with valid order payload",
    "Test with invalid payload",
    "Test with missing required fields"
  ]
}
```

## Dependency Management

### Dependency Graph

Create execution order by analyzing:

1. **Sequential Dependencies:** Task B depends on Task A
2. **Parallel Opportunities:** Tasks that can run in parallel
3. **Resource Constraints:** Shared resources (connections, storage)

### Critical Path

Identify critical path (longest dependency chain):

```
Infrastructure Setup (4h)
  → Workflow Creation (2h)
    → HTTP Trigger (1.5h)
      → HTTP Action (2h)
        → Liquid Mapping (3h)
          → Error Handling (1h)
            → Testing (4h)
              → Deployment (2h)

Critical Path Total: ~18.5 hours
```

## Task Prioritization

Prioritize using:

1. **Dependencies:** Lower priority for blocking tasks
2. **Risk:** Higher priority for risky items
3. **Complexity:** Front-load complex tasks
4. **Effort:** Group similar effort levels

## Code Generation Integration

For each task, generate applicable code:

### Trigger Task → Generated Trigger Code

```json
{
  "triggers": {
    "http_receive_order": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "method": "POST",
        "schema": {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": {
            "orderId": { "type": "string" },
            "items": { "type": "array" }
          },
          "required": ["orderId"]
        }
      }
    }
  }
}
```

### Mapping Task → Generated Liquid Template

```liquid
{
  "OrderID": "{{ body('http_receive_order').orderId }}",
  "Items": [
    {%- for item in body('http_receive_order').items -%}
    {
      "LineNumber": {{ forloop.index }},
      "SKU": "{{ item.sku }}",
      "Quantity": {{ item.quantity }},
      "Amount": {{ item.price * item.quantity }}
    }
    {%- if forloop.last == false %},{% endif -%}
    {%- endfor -%}
  ]
}
```

### Action Task → Generated Action Code

```json
{
  "type": "Send_HTTP_Request",
  "inputs": {
    "method": "POST",
    "uri": "@parameters('sap_backend_url')",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": "@body('transform_order')"
  }
}
```

## Task List Output

Generate comprehensive task list:

```markdown
# Order Processing Migration — Task List

## Phase 1: Infrastructure (Est: 4 hours)
- [ ] Create Azure Storage Account
- [ ] Create Service Bus Namespace
- [ ] Create SAP Connection
- [ ] Configure Managed Identity

## Phase 2: Workflow Development (Est: 14 hours)
- [ ] Create Logic Apps Workflow (2h)
- [ ] Implement HTTP Trigger (1.5h)
  - Acceptance: Receives orders
  - Test: Valid/invalid payload
- [ ] Implement Order Mapping (3h)
  - Acceptance: Transforms to internal format
  - Test: All field mappings correct
- [ ] Implement SAP Send (2h)
  - Acceptance: Sends to SAP ERP
  - Test: Error scenarios
- [ ] Implement Error Handling (1h)
  - Acceptance: Catches and logs errors
  - Test: Error recovery

## Phase 3: Testing (Est: 4 hours)
- [ ] Unit test each action
- [ ] Integration test full workflow
- [ ] Performance test under load
- [ ] Security review

## Phase 4: Deployment (Est: 2 hours)
- [ ] Deploy to dev environment
- [ ] Deploy to staging environment
- [ ] Deploy to production

**Total Effort: ~24 hours (3 days)**
```

## Parallel Execution Groups

Identify work that can be parallelized:

```
Group 1 (Day 1 - Start in parallel):
  - Infrastructure setup (4h)
  - Liquid template creation (3h)

Group 2 (Day 2):
  - Trigger implementation (1.5h)
  - Mapping implementation (2h)
  - Action implementation (2h)

Group 3 (Day 3):
  - Error handling (1h)
  - Testing (4h)
  - Deployment (2h)
```

This structured task planning ensures clear, executable work items with proper sequencing and resource allocation.
