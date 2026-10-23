---
name: detect-logical-groups
description: Rules for grouping SAP PI/PO integration artifacts into logical flow groups representing complete integration scenarios.
---

# SAP PI/PO — Logical Flow Group Detection

> **Rules for detecting and grouping SAP PI/PO artifacts into logical integration flow groups.**

## Overview

SAP PI/PO integration scenarios are built from multiple interconnected artifacts. Logical groups represent complete end-to-end integration flows that should be migrated as cohesive units to Azure Logic Apps Standard.

## Grouping Strategy

### Primary Grouping: Integration Processes

Each **Integration Process** forms the core of a logical group:

- An Integration Process defines the orchestration logic and message flow
- All artifacts referenced by that process belong to the same group
- Sender agreements, receiver agreements, and communication channels are included

### Secondary Grouping: Message Mappings

Group message mappings with the processes that use them:

- Direct mappings in Integration Process steps
- Mapping rules applied during message transformation steps
- Custom mapping functions

### Tertiary Grouping: Communication Artifacts

Include all communication infrastructure in the group:

- Sender and receiver communication channels
- Sender and receiver agreements binding channels to processes
- Adapter configurations for each channel

## Detection Rules

### Rule 1: Integration Process as Root

Each Integration Process is identified as a logical group root.

**Detection logic:**
```
IF artifact.type == "IntegrationProcess" THEN
  CREATE_GROUP(groupId=artifact.id, groupName=artifact.name)
END
```

### Rule 2: Direct References from Process Steps

Include artifacts directly referenced in process steps:

```
FOR each process IN integrationProcesses:
  FOR each step IN process.steps:
    IF step.references(artifact) THEN
      ADD_TO_GROUP(process.id, artifact)
    END
  END
END
```

### Rule 3: Message Mapping Inclusion

Include message mappings used during transformation:

```
FOR each process IN integrationProcesses:
  FOR each step IN process.steps:
    IF step.type == "Transform" AND step.mapping != NULL THEN
      ADD_TO_GROUP(process.id, step.mapping)
    END
  END
END
```

### Rule 4: Agreement Binding

Include sender and receiver agreements that bind the process:

```
FOR each process IN integrationProcesses:
  FOR each agreement IN senderAgreements:
    IF agreement.referencesProcess(process) THEN
      ADD_TO_GROUP(process.id, agreement)
      ADD_TO_GROUP(process.id, agreement.receiverAgreements)
    END
  END
END
```

### Rule 5: Communication Channel Inclusion

Include communication channels referenced by agreements:

```
FOR each agreement IN agreements:
  FOR each channel IN agreement.channels:
    ADD_TO_GROUP(agreement.parentProcess, channel)
  END
END
```

### Rule 6: Message Type Inclusion

Include all message types used in the process:

```
FOR each process IN integrationProcesses:
  FOR each messageType IN process.usedMessageTypes:
    ADD_TO_GROUP(process.id, messageType)
  END
END
```

## Grouping Examples

### Example 1: Simple Request-Reply Process

**Process:** OrderProcessing

**Group contents:**
- IntegrationProcess: OrderProcessing
- MessageMapping: OrderToInternal
- MessageType: SalesOrder, InternalOrder
- SenderChannel: HTTP_Input
- ReceiverChannel: SAP_Backend
- SenderAgreement: HTTP_to_OrderProcessing
- ReceiverAgreement: OrderProcessing_to_SAP

### Example 2: Multi-Step Workflow

**Process:** InvoiceApprovalFlow

**Group contents:**
- IntegrationProcess: InvoiceApprovalFlow
- MessageMappings: InvoiceReceive, InvoiceValidate, InvoiceTransform
- MessageTypes: Invoice, InvoiceValidationResult, ApprovalRequest
- SenderChannels: SFTP_InputFolder, Email_Inbox
- ReceiverChannels: SAP_FI, Database_Archive
- Multiple SenderAgreements and ReceiverAgreements
- Adapter configurations for SFTP, Email, and SAP

## Dependency Analysis

### Shared Artifacts

If an artifact is referenced by multiple processes:

- **Message Type:** Create a separate shared group or reference the shared artifact from multiple groups
- **Communication Channel:** If used by multiple processes, consider if it should be dedicated or shared
- **Message Mapping:** If reused across processes, mark as shared and reference from multiple groups

**Strategy:**
- For high-reuse artifacts (used in 3+ processes), create a separate "Shared" group
- For medium reuse (2 processes), duplicate or cross-reference
- Low reuse (1 process) should stay with the primary group

### Dependency Order

Order groups for migration based on dependencies:

1. **Tier 1:** Shared message types and mappings
2. **Tier 2:** Simple processes (no sub-dependencies)
3. **Tier 3:** Complex processes (depend on Tier 2)
4. **Tier 4:** Multi-step workflows (depend on Tier 1-3)

## Special Cases

### Case 1: Fork/Join Processes

If an Integration Process contains fork/join steps:

- All parallel branches stay in the same logical group
- Include all branch-specific mappings and channels

### Case 2: Sub-processes

If one process calls another process:

- Keep both in the same group if they represent a single logical flow
- OR create separate groups with explicit dependency tracking

### Case 3: Error Handling Processes

If an Integration Process is used for error handling:

- Group with the primary process it handles errors for
- Mark relationship as "error-handler"

## Output

The logical grouping produces:

```json
{
  "groups": [
    {
      "id": "group-order-processing",
      "name": "Order Processing",
      "rootArtifact": "IntegrationProcess/OrderProcessing",
      "artifacts": [
        { "id": "ip-order-processing", "type": "integration-process" },
        { "id": "map-order-transform", "type": "message-mapping" },
        { "id": "msg-sales-order", "type": "message-type" },
        { "id": "chl-http-input", "type": "communication-channel" },
        { "id": "agr-http-to-order", "type": "sender-agreement" }
      ],
      "dependencies": ["group-shared-messages"],
      "tier": 2
    }
  ]
}
```
