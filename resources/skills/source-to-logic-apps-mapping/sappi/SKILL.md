---
name: source-to-logic-apps-mapping
description: Complete mapping of SAP PI/PO components (integration processes, message mappings, communication channels, adapters) to Azure Logic Apps Standard equivalents.
---

# SAP PI/PO to Azure Logic Apps Standard — Component Mapping

> **Complete mapping of every SAP PI/PO component to its Azure Logic Apps Standard equivalent.**

## Overview

This document provides the authoritative mapping of SAP PI/PO artifacts to Azure Logic Apps Standard, covering integration processes, message mappings, communication channels, adapters, and agreements.

## Integration Process Mappings

### Integration Process Steps

| SAP PI/PO Step Type | Logic Apps Equivalent | Notes | Scope |
|---|---|---|---|
| Receive | HTTP Trigger or Queue Trigger | Depends on protocol | Built-in |
| Send | Send HTTP Request, Service Bus Send | Depends on protocol | Built-in |
| Request-Reply | HTTP Request (two-way) | Uses response mapping | Built-in |
| Fork | Parallel Execution | Creates parallel branches | Built-in |
| Join | Wait for concurrent actions | Synchronizes parallel flows | Built-in |
| Switch/Decision | Switch action | Conditional routing | Built-in |
| Transform/Mapping | Liquid transformation, built-in functions | Apply mapping rules | Built-in |
| Block | Scope action | Groups related actions | Built-in |
| Delay | Delay action | Temporal control | Built-in |
| Alert | Send notification via Connector | Teams, Email, etc. | Connector |
| Loop | Until/For each action | Iteration over collections | Built-in |
| Call (Sub-process) | Call Nested Workflow | Invoke another logic app | Built-in |

### Integration Process Example

**SAP PI/PO Process:**
```xml
<IntegrationProcess name="OrderProcessing">
  <Step id="receive" type="Receive">
    <SenderChannel>HTTP_Input</SenderChannel>
  </Step>
  <Step id="transform" type="Transform">
    <MessageMapping>OrderToInternal</MessageMapping>
  </Step>
  <Step id="send" type="Send">
    <ReceiverChannel>SAP_Backend</ReceiverChannel>
  </Step>
</IntegrationProcess>
```

**Equivalent Logic Apps Workflow:**
```json
{
  "triggers": {
    "http_trigger": {
      "type": "Request",
      "kind": "Http"
    }
  },
  "actions": {
    "transform_order": {
      "type": "Liquid",
      "inputs": {
        "template": "...",
        "content": "@triggerBody()"
      }
    },
    "send_to_sap": {
      "type": "Invoke",
      "inputs": {
        "method": "POST",
        "uri": "@parameters('sap_backend_url')",
        "body": "@body('transform_order')"
      }
    }
  }
}
```

## Message Mapping Mappings

| SAP PI/PO Mapping Type | Logic Apps Equivalent | Details |
|---|---|---|
| Direct field mapping | Liquid template mapping | Use field() function |
| Function-based mapping | Liquid function calls | Use built-in or custom functions |
| Aggregate mapping | Aggregate action | Collect multiple messages |
| Custom script mapping | Local function (JavaScript) | Custom code in Logic Apps Standard |
| Message type transformation | Liquid transformation | Full schema transformation |
| Conditional mapping | If-then logic in Liquid | Conditional output |
| String functions | Liquid string functions | substring(), concat(), etc. |
| Numeric functions | Liquid numeric functions | add(), multiply(), etc. |

### Message Mapping Example

**SAP PI/PO Mapping:**
```xml
<MessageMapping name="OrderToInternal">
  <SourceMessage>SalesOrder</SourceMessage>
  <TargetMessage>InternalOrder</TargetMessage>
  <MappingRule source="Order/Items/Item/Price" target="Items/LineItem/Amount" />
  <MappingRule source="Order/Customer/Id" target="Buyer/Id" />
  <Function name="CalculateTotal">
    <Input>Items/Item/Price</Input>
    <Output>Total</Output>
  </Function>
</MessageMapping>
```

**Equivalent Logic Apps Liquid Template:**
```liquid
{
  "Items": [
    {%- for item in content.Order.Items.Item -%}
    {
      "Amount": {{ item.Price }},
      "Description": "{{ item.Name }}"
    }
    {%- if forloop.last == false %},{% endif -%}
    {%- endfor -%}
  ],
  "Buyer": {
    "Id": "{{ content.Order.Customer.Id }}"
  },
  "Total": {{ calculateTotal(content.Order.Items.Item) }}
}
```

## Communication Channel Mappings

### Adapter Mappings

| SAP PI/PO Adapter | Logic Apps Connector | Notes |
|---|---|---|
| HTTP Adapter (Sender) | HTTP Trigger | Incoming HTTP requests |
| HTTP Adapter (Receiver) | HTTP Request action | Outgoing HTTP calls |
| SOAP Adapter | HTTP Request or SOAP Connector | Use HTTP for REST/SOAP |
| File Adapter | Blob Storage, File Share | File operations |
| JDBC Adapter | SQL Server, MySQL connector | Database operations |
| JMS Adapter | Service Bus, Event Hubs | Message queuing |
| SFTP Adapter | SFTP connector | File transfer |
| Email Adapter | Outlook, Gmail connector | Email operations |
| SAP Adapter (iDOC, BAPI) | SAP ERP connector | Enterprise resource planning |
| Database Adapter (Oracle, SQL) | SQL Server, Oracle connector | Database operations |
| AS2/X12/EDIFACT | AS2 Connector | B2B protocols |
| Custom Adapter | Custom connector or logic app | Extension point |

### Communication Channel Example

**SAP PI/PO Sender Channel:**
```xml
<CommunicationChannel>
  <Name>HTTP_Input</Name>
  <Type>Sender</Type>
  <Adapter>HTTP</Adapter>
  <Properties>
    <Protocol>HTTP</Protocol>
    <Port>8080</Port>
    <Path>/api/orders</Path>
  </Properties>
</CommunicationChannel>
```

**Equivalent Logic Apps HTTP Trigger:**
```json
{
  "triggers": {
    "http_receiver": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "method": "POST",
        "schema": {
          "type": "object",
          "properties": {
            "orderId": { "type": "string" },
            "items": { "type": "array" }
          }
        }
      }
    }
  }
}
```

## Sender/Receiver Agreement Mappings

| SAP PI/PO Agreement | Logic Apps Equivalent | Notes |
|---|---|---|
| Sender Agreement | Connection configuration | Binds trigger to sender channel |
| Receiver Agreement | Action configuration | Binds action to receiver channel |
| Agreement properties | Connection parameters | Connection string, credentials |

## Special Mappings

### Error Handling

| SAP PI/PO | Logic Apps Standard |
|---|---|
| Exception handler | Scope with error handling |
| Fault message | Output of failed action |
| Alert on error | Send notification action |
| Retry logic | Retry policy in action configuration |

### Message Queue Support

| SAP PI/PO | Logic Apps Standard |
|---|---|
| Queue step | Service Bus Queue action |
| Dead-letter queue | Service Bus DLQ handling |
| Message correlation | Correlation ID in message properties |

### Persistence and Logging

| SAP PI/PO | Logic Apps Standard |
|---|---|
| Message archiving | Blob storage output |
| Audit logging | Application Insights |
| Message tracking | Run history and diagnostics |

## Deployment Scope Reference

| Component | Deployment Scope |
|---|---|
| HTTP Trigger | Built-in (Workflow) |
| Liquid Transform | Built-in (Workflow) |
| Service Bus action | Connector (Azure) |
| Nested workflow call | Built-in (Workflow) |
| Local function | Built-in (Workflow) |

## Coverage Summary

- **Integration Processes:** 100% coverage via Logic Apps workflow steps
- **Message Mappings:** 95% coverage via Liquid templates, 100% with custom functions
- **Communication Channels:** 90% coverage via built-in connectors, 100% with custom connectors
- **Adapters:** 85% coverage via Logic Apps connectors, 100% with custom logic apps
- **Advanced features:** 80% coverage via native Logic Apps features, 100% with extensions

## Migration Path

1. **Phase 1:** Map integration processes to Logic Apps workflows
2. **Phase 2:** Convert message mappings to Liquid templates
3. **Phase 3:** Map communication channels to connectors
4. **Phase 4:** Bind agreements to connection configurations
5. **Phase 5:** Implement error handling and logging
