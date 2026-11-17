---
name: dependency-and-decompilation-analysis
description: Rules for identifying missing dependencies, decompiling SAP PI/PO artifacts, and resolving external references.
---

# SAP PI/PO — Dependency and Decompilation Analysis

> **Rules for identifying dependencies, resolving external references, and detecting missing artifacts.**

## Dependency Analysis

### Direct Dependencies

For each Integration Process, identify:

1. **Message Mappings:** Mappings referenced in transform steps
2. **Message Types:** Source and target message types
3. **Communication Channels:** Channels used in send/receive steps
4. **Agreements:** Sender and receiver agreements

### Indirect Dependencies

Trace through referenced artifacts:

1. **Mapping Dependencies:** Message types and functions used by mappings
2. **Channel Dependencies:** Adapters and connection parameters
3. **Agreement Dependencies:** Channels and process references

### External System Dependencies

Identify external systems connected via adapters:

1. **SAP Systems:** SAP ERP, SAP BW via iDOC or BAPI
2. **Databases:** SQL, Oracle, PostgreSQL
3. **File Systems:** FTP, SFTP, local file shares
4. **Message Queues:** JMS, SAP Message Server
5. **Web Services:** SOAP endpoints, REST APIs

## Decompilation Rules

### Archive Extraction

If SAP PI/PO export is in compressed format (.iar, .zip):

1. Extract archive
2. Identify contained files:
   - `.xml` configuration files
   - `.mapping` files
   - Embedded XSD schemas
   - Property files

### XML Decompilation

For XML configuration files:

1. **Parse XML structure** to identify artifact types
2. **Extract metadata:** names, descriptions, IDs
3. **Extract content:** mappings, processes, channels
4. **Identify references:** cross-artifact dependencies

### Message Type Decompilation

For embedded schema definitions:

1. Extract XSD or schema definition
2. Identify field hierarchy
3. Determine field types (string, int, boolean, complex)
4. Note field cardinality and constraints

### Mapping Function Decompilation

For custom mapping functions:

1. Identify function calls in mapping rules
2. Extract function definitions
3. Analyze function logic and parameters
4. Determine if built-in or custom

## Missing Dependency Detection

### Rule: Unresolved References

Flag artifacts that are referenced but not found:

```
FOR each artifact IN allArtifacts:
  FOR each reference IN artifact.references:
    IF NOT EXISTS(artifactWithId(reference.id)) THEN
      FLAG_MISSING(reference, artifact)
    END
  END
END
```

### Rule: Incomplete Message Types

Flag message types that are referenced but lack schema:

```
FOR each mapping IN messageMappings:
  IF NOT FOUND(messageType(mapping.sourceMessage)) THEN
    FLAG_MISSING_SCHEMA(mapping.sourceMessage)
  END
  IF NOT FOUND(messageType(mapping.targetMessage)) THEN
    FLAG_MISSING_SCHEMA(mapping.targetMessage)
  END
END
```

### Rule: Orphaned Artifacts

Flag artifacts that are never referenced:

```
FOR each artifact IN allArtifacts:
  IF artifact.referencedBy.length == 0 AND artifact.type != "root" THEN
    FLAG_ORPHANED(artifact)
  END
END
```

## Dependency Graph

Create directed graph representation:

```
IntegrationProcess → MessageMapping (uses)
                  → MessageType (input/output)
                  → CommunicationChannel (via agreement)
                  → Adapter (via channel)

MessageMapping → MessageType (source/target)
              → Function (uses)
              → ExternalSystem (if custom)

CommunicationChannel → Adapter (protocol handler)
                    → ExternalSystem (connects to)
```

## Unresolved Reference Report

Generate report of missing dependencies:

```json
{
  "unresolvedReferences": [
    {
      "referenceId": "ext-system-crm",
      "referencedBy": "IntegrationProcess/SalesOrderFlow",
      "type": "external-system",
      "description": "SAP CRM connection not found",
      "severity": "error",
      "recommendation": "Verify SAP CRM adapter configuration"
    },
    {
      "referenceId": "MessageType/LegacyFormat",
      "referencedBy": "MessageMapping/OrderTransform",
      "type": "message-type",
      "description": "Message type definition missing",
      "severity": "error",
      "recommendation": "Import message type from integration repository"
    }
  ],
  "orphanedArtifacts": [
    {
      "id": "MessageMapping/UnusedMapping",
      "type": "message-mapping",
      "severity": "warning",
      "recommendation": "Remove or document reason for keeping"
    }
  ]
}
```

## External System Mapping

Map discovered external systems to Azure services:

| SAP PI/PO Adapter | External System | Azure Service | Note |
|---|---|---|---|
| SAP Adapter (iDOC) | SAP ERP | Azure SAP Connector | Requires SAP gateway |
| JDBC Adapter | Oracle DB | Azure SQL Connector | May need translation |
| FTP Adapter | FTP Server | Azure Blob Storage + FTP | Use managed identity |
| HTTP Adapter | REST/SOAP endpoint | HTTP Connector | Direct integration |
| JMS Adapter | MQ System | Service Bus Queue | Message queue mapping |
| SFTP Adapter | SFTP Server | SFTP Connector | Azure managed |
| Email Adapter | Email Server | Outlook/Gmail Connector | Cloud email |
| File Adapter | File Share | Blob/File Share | Azure storage |

## Decompilation Output Structure

```json
{
  "decompiledArtifacts": [
    {
      "id": "ip-order-processing",
      "name": "OrderProcessing",
      "type": "integration-process",
      "sourceFile": "OrderProcessing.xml",
      "metadata": {
        "created": "2023-01-15",
        "lastModified": "2024-01-20"
      },
      "dependencies": {
        "messageMappings": ["map-order-validate", "map-order-transform"],
        "messageTypes": ["msg-sales-order", "msg-internal-order"],
        "channels": ["chl-http-input", "chl-sap-output"],
        "externalSystems": ["sap-erp"]
      },
      "content": {
        "steps": [
          {
            "id": "receive",
            "type": "receive",
            "properties": {}
          }
        ]
      }
    }
  ],
  "missingDependencies": [],
  "externalSystems": [
    {
      "id": "sap-erp",
      "name": "SAP ERP",
      "type": "sap-system",
      "protocol": "RFC",
      "endpoint": "SAPHOST:3300",
      "requiresGateway": true
    }
  ]
}
```

## Reconciliation Process

After decompilation:

1. **Verify Coverage:** Check that all referenced artifacts were decompiled
2. **Resolve References:** Link artifacts together
3. **Report Gaps:** Flag missing or unresolved dependencies
4. **Recommend Actions:** Suggest steps to resolve gaps

## Gap Resolution Strategies

| Gap Type | Strategy | Effort |
|---|---|---|
| Missing message type | Import from IR export | Low |
| Missing mapping | Recreate from documentation | Medium |
| Missing channel | Check in separate export | Low |
| Missing external system | Configure in Azure | High |
| Custom function | Analyze and rewrite | High |
| Unsupported adapter | Build custom connector | Very High |

This analysis ensures no artifacts are lost during migration and all dependencies are clearly identified.
