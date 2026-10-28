---
name: logic-apps-planning-rules
description: Rules for generating comprehensive migration plans for SAP PI/PO integration processes.
---

# SAP PI/PO to Logic Apps — Migration Planning Rules

> **Rules for generating detailed per-flow migration plans with action mappings and effort estimates.**

## Planning Workflow

### Phase 1: Process Analysis

For each Integration Process, analyze:

1. **Scope:** All artifacts in logical group
2. **Complexity:** Number of steps, branches, mappings
3. **Dependencies:** External systems, custom code
4. **Risks:** Unsupported features, performance concerns

### Phase 2: Architecture Design

Design target Logic Apps workflow:

1. **Trigger Design:** Map process receiver to Logic Apps trigger
2. **Action Design:** Map each process step to Logic Apps action
3. **Variable Design:** Identify state variables and messaging
4. **Error Handling:** Plan exception handling strategy

### Phase 3: Mapping Strategy

Define mapping from SAP PI/PO to Logic Apps:

1. **Liquid Templates:** For message mappings
2. **Connectors:** For communication channels
3. **Functions:** For custom logic
4. **Connections:** For external system access

### Phase 4: Implementation Plan

Create detailed task breakdown:

1. **Infrastructure Tasks:** Create connections, storage, functions
2. **Development Tasks:** Build workflow, mappings, functions
3. **Testing Tasks:** Unit test, integration test, UAT
4. **Deployment Tasks:** Deploy to Azure, configure production

## Planning Output

### Migration Plan Document

For each Integration Process:

```json
{
  "planId": "plan-order-processing",
  "processName": "Order Processing",
  "status": "ready-for-implementation",
  "sections": [
    {
      "title": "Executive Summary",
      "content": "Description of process and migration approach"
    },
    {
      "title": "Current State Architecture",
      "content": "Mermaid diagram showing SAP PI/PO process"
    },
    {
      "title": "Target State Architecture",
      "content": "Mermaid diagram showing Logic Apps workflow"
    },
    {
      "title": "Action Mappings",
      "content": "Detailed mapping from process steps to Logic Apps actions"
    },
    {
      "title": "Data Mappings",
      "content": "Liquid templates for message transformations"
    },
    {
      "title": "Connection Configuration",
      "content": "Connection setup for external systems"
    },
    {
      "title": "Gap Analysis",
      "content": "Features requiring workarounds or custom solutions"
    },
    {
      "title": "Implementation Tasks",
      "content": "Breakdown of work items"
    },
    {
      "title": "Effort Estimation",
      "content": "Time estimates for implementation"
    },
    {
      "title": "Risk Assessment",
      "content": "Identified risks and mitigations"
    }
  ]
}
```

## Action Mapping Rules

### Receive Step Mapping

SAP PI/PO **Receive** step → Logic Apps **Trigger**:

```
IF step.type == "Receive" THEN
  SELECT trigger_type BASED ON:
    channel.adapter == "HTTP" → HTTP Trigger
    channel.adapter == "JMS" → Service Bus Trigger
    channel.adapter == "File" → Blob Storage Trigger
    channel.adapter == "SFTP" → SFTP Trigger (polling)
    channel.adapter == "Email" → Outlook Trigger
  END
  
  CONFIGURE trigger WITH:
    connection: agreements.sender.channel.connection
    method: channel.properties.method
    path: channel.properties.path OR topic_subscription
    schema: messageType.schema
END
```

### Send Step Mapping

SAP PI/PO **Send** step → Logic Apps **Action**:

```
IF step.type == "Send" THEN
  SELECT action_type BASED ON:
    channel.adapter == "HTTP" → Send HTTP Request
    channel.adapter == "JMS" → Send Service Bus Message
    channel.adapter == "File" → Create Blob / Create File
    channel.adapter == "SFTP" → Create SFTP File
    channel.adapter == "SAP" → Invoke SAP API Connector
    channel.adapter == "Database" → Execute SQL Query
  END
  
  CONFIGURE action WITH:
    connection: agreements.receiver.channel.connection
    endpoint: channel.properties.endpoint
    payload: TRANSFORM(messageMapping.rules)
    headers: agreements.receiver.properties
END
```

### Transform Step Mapping

SAP PI/PO **Transform** step → Logic Apps **Action**:

```
IF step.type == "Transform" THEN
  mapping := step.messageMapping
  
  IF mapping.isLiquidCompatible THEN
    ACTION_TYPE := "Liquid Template"
    GENERATE liquid_template FROM mapping.rules
  ELSE IF mapping.hasCustomCode THEN
    ACTION_TYPE := "Compose + Local Function"
    CREATE_LOCAL_FUNCTION(mapping.functions)
  ELSE
    ACTION_TYPE := "Compose"
    GENERATE json_path_mapping FROM mapping.rules
  END
END
```

### Fork/Join Step Mapping

SAP PI/PO **Fork/Join** → Logic Apps **Parallel/Until**:

```
IF step.type == "Fork" THEN
  FOREACH branch IN step.branches:
    parallel_action := BUILD_WORKFLOW_SECTION(branch)
    ADD_TO(parallel_execute.branches, parallel_action)
  END
  
  IF step.hasJoin THEN
    ADD_ACTION(wait_for_all_branches)
    ADD_ACTION(aggregate_results)
  END
END
```

### Decision/Switch Step Mapping

SAP PI/PO **Switch** → Logic Apps **Switch**:

```
IF step.type == "Switch" THEN
  FOREACH case IN step.cases:
    CONFIGURE switch_case WITH:
      condition: case.condition (convert to Logic Apps expression)
      actions: PROCESS_STEPS(case.steps)
    ADD_TO(switch.cases, switch_case)
  END
  
  IF step.hasDefault THEN
    CONFIGURE switch_default WITH:
      actions: PROCESS_STEPS(step.defaultSteps)
    ADD_TO(switch.cases, switch_default)
  END
END
```

### Loop Step Mapping

SAP PI/PO **Loop** → Logic Apps **For Each / Until**:

```
IF step.type == "Loop" THEN
  IF step.iterationType == "collection" THEN
    ACTION_TYPE := "For Each"
    CONFIGURE forEach WITH:
      collection: step.collectionPath
      actions: PROCESS_STEPS(step.loopSteps)
  ELSE IF step.iterationType == "conditional" THEN
    ACTION_TYPE := "Until"
    CONFIGURE until WITH:
      expression: step.exitCondition
      actions: PROCESS_STEPS(step.loopSteps)
  END
END
```

## Effort Estimation Rules

### Base Effort Scores

| Component | Effort (hours) |
|---|---|
| Simple receive step | 1 |
| Simple send step | 2 |
| Direct field mapping | 0.5 per rule |
| Liquid-based mapping | 3 |
| Custom function mapping | 8 |
| Fork/join workflow | 5 |
| Decision logic | 2 |
| Error handling | 3 |
| Connection setup | 2 per connector |

### Effort Multipliers

| Factor | Multiplier |
|---|---|
| New technology stack | 1.5x |
| High complexity custom code | 2x |
| Integration with multiple systems | 1.3x |
| Strict performance requirements | 1.2x |
| Security/compliance requirements | 1.2x |

### Example Calculation

For OrderProcessing process:
- 1 HTTP receive: 1 hour
- 1 Liquid mapping: 3 hours
- 1 SAP send: 2 hours
- Connection setup: 2 hours
- **Subtotal:** 8 hours

Adjustments:
- Custom validation logic: +2 hours
- Error handling: +1 hour
- Testing: +4 hours
- **Total: 15 hours** (2 days)

## Risk Assessment

Identify risks for each migration:

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Unsupported function | Low | High | Build Azure Function |
| Performance degradation | Medium | Medium | Implement caching/throttling |
| Complex error scenarios | Medium | High | Comprehensive testing |
| Data sensitivity | High | High | Implement encryption, audit logging |
| Third-party dependency | Low | Very High | Contract/SLA verification |

## Planning Checklist

Before implementation:

- ✅ Action mappings complete and reviewed
- ✅ All message types and schemas defined
- ✅ Connection strings configured
- ✅ Error handling strategy defined
- ✅ Testing plan created
- ✅ Rollback plan defined
- ✅ Documentation complete
- ✅ Security review completed
- ✅ Performance review completed
- ✅ Deployment plan approved

This comprehensive planning ensures smooth implementation and minimal rework.
