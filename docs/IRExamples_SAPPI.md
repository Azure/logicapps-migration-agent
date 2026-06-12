# SAP PI/PO Integration Repository (IR) — Intermediate Representation Examples

> **Examples showing how SAP PI/PO artifacts map to the Intermediate Representation (IR) schema.**

## Table of Contents

- [Overview](#overview)
- [Integration Process Example](#integration-process-example)
- [Message Mapping Example](#message-mapping-example)
- [Message Type Example](#message-type-example)
- [Communication Channel Example](#communication-channel-example)
- [Sender/Receiver Agreement Examples](#senderreceiver-agreement-examples)
- [Complete Flow Example](#complete-flow-example)

## Overview

The Intermediate Representation (IR) is a platform-agnostic JSON schema that normalizes artifacts from different integration platforms (BizTalk, MuleSoft, SAP PI/PO, etc.) into a common format. This enables the migration agent to analyze, plan, and convert workflows consistently.

For the complete IR schema definition, see [docs/IRSchema.md](../IRSchema.md).

## Integration Process Example

### SAP PI/PO Source (XML)

```xml
<IntegrationProcess name="OrderProcessing" description="Process sales orders from web portal">
  <Step id="receive" type="Receive">
    <ReceiverChannel name="HTTP_Input" />
    <MessageType name="SalesOrder" />
  </Step>
  
  <Step id="validate" type="Transform">
    <Function name="ValidateOrder" />
    <Input ref="receive" />
  </Step>
  
  <Step id="map" type="Transform">
    <MessageMapping name="SalesOrderToInternal" />
    <Source ref="validate" />
    <Target ref="send" />
  </Step>
  
  <Step id="send" type="Send">
    <SenderChannel name="SAP_Backend" />
  </Step>
</IntegrationProcess>
```

### Corresponding IR Document

```json
{
  "metadata": {
    "platform": "sappi",
    "version": "1.0",
    "name": "OrderProcessing",
    "description": "Process sales orders from web portal",
    "sourceFile": "OrderProcessing.xml"
  },
  "integrationProcesses": [
    {
      "id": "ip-order-processing",
      "name": "OrderProcessing",
      "description": "Process sales orders from web portal",
      "steps": [
        {
          "id": "receive",
          "name": "receive",
          "type": "receive",
          "sourceLocation": {
            "filePath": "OrderProcessing.xml",
            "lineNumber": 2
          },
          "properties": {
            "channelId": "chl-http-input",
            "messageTypeId": "msg-sales-order"
          }
        },
        {
          "id": "map",
          "name": "map",
          "type": "transform",
          "sourceLocation": {
            "filePath": "OrderProcessing.xml",
            "lineNumber": 12
          },
          "properties": {
            "mappingId": "map-sales-to-internal",
            "sourceMessageTypeId": "msg-sales-order",
            "targetMessageTypeId": "msg-internal-order"
          }
        },
        {
          "id": "send",
          "name": "send",
          "type": "send",
          "sourceLocation": {
            "filePath": "OrderProcessing.xml",
            "lineNumber": 18
          },
          "properties": {
            "channelId": "chl-sap-output"
          }
        }
      ],
      "dependencies": {
        "messageMappings": ["map-sales-to-internal"],
        "messageTypes": ["msg-sales-order", "msg-internal-order"],
        "channels": ["chl-http-input", "chl-sap-output"]
      }
    }
  ]
}
```

## Message Mapping Example

### SAP PI/PO Source (XML)

```xml
<MessageMapping name="SalesOrderToInternal">
  <SourceMessage name="SalesOrder" />
  <TargetMessage name="InternalOrder" />
  
  <MappingRule>
    <Source path="Order/OrderID" />
    <Target path="OrderHeader/OrderNumber" />
  </MappingRule>
  
  <MappingRule>
    <Source path="Order/Customer/CustomerID" />
    <Target path="OrderHeader/BuyerID" />
  </MappingRule>
  
  <MappingRule>
    <Source path="Order/OrderDate" />
    <Target path="OrderHeader/CreatedDate" />
    <Function name="FormatDate" />
  </MappingRule>
</MessageMapping>
```

### Corresponding IR Document

```json
{
  "messageMappings": [
    {
      "id": "map-sales-to-internal",
      "name": "SalesOrderToInternal",
      "sourceMessage": "msg-sales-order",
      "targetMessage": "msg-internal-order",
      "rules": [
        {
          "sourcePath": "Order.OrderID",
          "targetPath": "OrderHeader.OrderNumber",
          "type": "map"
        },
        {
          "sourcePath": "Order.Customer.CustomerID",
          "targetPath": "OrderHeader.BuyerID",
          "type": "map"
        },
        {
          "sourcePath": "Order.OrderDate",
          "targetPath": "OrderHeader.CreatedDate",
          "type": "function",
          "functionName": "FormatDate"
        }
      ],
      "sourceLocation": {
        "filePath": "Mappings/SalesOrderToInternal.xml"
      }
    }
  ]
}
```

## Message Type Example

### SAP PI/PO Source (XSD Schema)

```xml
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://sap.example.com/orders">
  <xs:element name="SalesOrder">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="OrderID" type="xs:string" />
        <xs:element name="OrderDate" type="xs:dateTime" />
        <xs:element name="Customer">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="CustomerID" type="xs:string" />
              <xs:element name="CustomerName" type="xs:string" />
            </xs:sequence>
          </xs:complexType>
        </xs:element>
        <xs:element name="Items">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="Item" maxOccurs="unbounded">
                <xs:complexType>
                  <xs:sequence>
                    <xs:element name="SKU" type="xs:string" />
                    <xs:element name="Quantity" type="xs:integer" />
                    <xs:element name="UnitPrice" type="xs:decimal" />
                  </xs:sequence>
                </xs:complexType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>
```

### Corresponding IR Document

```json
{
  "schemas": [
    {
      "id": "msg-sales-order",
      "name": "SalesOrder",
      "namespace": "http://sap.example.com/orders",
      "elements": [
        {
          "name": "OrderID",
          "type": "string",
          "required": true,
          "path": "OrderID"
        },
        {
          "name": "OrderDate",
          "type": "dateTime",
          "required": true,
          "path": "OrderDate"
        },
        {
          "name": "Customer",
          "type": "complex",
          "required": true,
          "path": "Customer",
          "children": [
            {
              "name": "CustomerID",
              "type": "string",
              "required": true
            },
            {
              "name": "CustomerName",
              "type": "string",
              "required": true
            }
          ]
        },
        {
          "name": "Items",
          "type": "complex",
          "path": "Items",
          "children": [
            {
              "name": "Item",
              "type": "complex",
              "maxOccurs": -1,
              "children": [
                { "name": "SKU", "type": "string", "required": true },
                { "name": "Quantity", "type": "integer", "required": true },
                { "name": "UnitPrice", "type": "decimal", "required": true }
              ]
            }
          ]
        }
      ],
      "sourceLocation": {
        "filePath": "Schemas/SalesOrder.xsd"
      }
    }
  ]
}
```

## Communication Channel Example

### SAP PI/PO Source (XML)

```xml
<CommunicationChannel>
  <Name>HTTP_Input</Name>
  <Description>HTTP adapter for receiving orders</Description>
  <Type>Receiver</Type>
  <TransportProtocol>HTTP</TransportProtocol>
  <MessageProtocol>XML</MessageProtocol>
  <Adapter>HTTP</Adapter>
  
  <ChannelConfiguration>
    <Property name="Port" value="8080" />
    <Property name="Path" value="/api/orders" />
    <Property name="Method" value="POST" />
    <Property name="Authentication" value="BasicAuth" />
  </ChannelConfiguration>
</CommunicationChannel>
```

### Corresponding IR Document

```json
{
  "endpoints": [
    {
      "id": "chl-http-input",
      "name": "HTTP_Input",
      "description": "HTTP adapter for receiving orders",
      "direction": "inbound",
      "protocol": "HTTP",
      "adapter": "HTTP",
      "properties": {
        "port": 8080,
        "path": "/api/orders",
        "method": "POST",
        "authentication": "BasicAuth"
      },
      "sourceLocation": {
        "filePath": "Channels/HTTP_Input.xml"
      }
    }
  ]
}
```

## Sender/Receiver Agreement Examples

### Sender Agreement (XML)

```xml
<SenderAgreement>
  <Name>HTTP_to_OrderProcessing</Name>
  <SenderComponent name="WebPortal" />
  <InterfaceName>IOrder</InterfaceName>
  <SenderChannelID>chl-http-input</SenderChannelID>
  <ReceiverAgreements>
    <ReceiverAgreement ref="OrderProcessing_to_SAP" />
  </ReceiverAgreements>
</SenderAgreement>
```

### Receiver Agreement (XML)

```xml
<ReceiverAgreement>
  <Name>OrderProcessing_to_SAP</Name>
  <ReceiverComponent name="SAP_ERP" />
  <InterfaceName>IOrder</InterfaceName>
  <ReceiverChannelID>chl-sap-output</ReceiverChannelID>
  <MessageMapping>map-sales-to-internal</MessageMapping>
  <AckConfiguration>
    <AckTimeout value="300" unit="seconds" />
    <RetryCount value="3" />
    <RetryInterval value="10" unit="seconds" />
  </AckConfiguration>
</ReceiverAgreement>
```

### Corresponding IR Document

```json
{
  "agreements": [
    {
      "id": "agr-http-to-order",
      "name": "HTTP_to_OrderProcessing",
      "type": "sender",
      "senderComponent": "WebPortal",
      "senderChannel": "chl-http-input",
      "interfaceName": "IOrder",
      "properties": {
        "messageFormat": "XML"
      },
      "sourceLocation": {
        "filePath": "Agreements/HTTP_to_OrderProcessing.xml"
      }
    },
    {
      "id": "agr-order-to-sap",
      "name": "OrderProcessing_to_SAP",
      "type": "receiver",
      "receiverComponent": "SAP_ERP",
      "receiverChannel": "chl-sap-output",
      "interfaceName": "IOrder",
      "messageMapping": "map-sales-to-internal",
      "properties": {
        "ackTimeout": 300,
        "retryCount": 3,
        "retryInterval": 10
      },
      "sourceLocation": {
        "filePath": "Agreements/OrderProcessing_to_SAP.xml"
      }
    }
  ]
}
```

## Complete Flow Example

### Full SAP PI/PO Integration Process

The following shows a complete example with all related artifacts:

```json
{
  "metadata": {
    "platform": "sappi",
    "name": "SalesOrderProcessing",
    "createdDate": "2024-01-20"
  },
  "integrationProcesses": [
    {
      "id": "ip-order-proc",
      "name": "OrderProcessing",
      "steps": [
        {
          "id": "step-receive",
          "type": "receive",
          "properties": { "channelId": "chl-http-input" }
        },
        {
          "id": "step-map",
          "type": "transform",
          "properties": { "mappingId": "map-sales-internal" }
        },
        {
          "id": "step-send",
          "type": "send",
          "properties": { "channelId": "chl-sap-output" }
        }
      ]
    }
  ],
  "schemas": [
    {
      "id": "msg-sales-order",
      "name": "SalesOrder",
      "elements": [ /* ... */ ]
    },
    {
      "id": "msg-internal-order",
      "name": "InternalOrder",
      "elements": [ /* ... */ ]
    }
  ],
  "messageMappings": [
    {
      "id": "map-sales-internal",
      "name": "SalesOrderToInternal",
      "sourceMessage": "msg-sales-order",
      "targetMessage": "msg-internal-order",
      "rules": [ /* ... */ ]
    }
  ],
  "endpoints": [
    {
      "id": "chl-http-input",
      "name": "HTTP_Input",
      "protocol": "HTTP",
      "direction": "inbound"
    },
    {
      "id": "chl-sap-output",
      "name": "SAP_Backend",
      "protocol": "RFC",
      "direction": "outbound"
    }
  ],
  "agreements": [
    {
      "id": "agr-sender",
      "type": "sender",
      "senderChannel": "chl-http-input"
    },
    {
      "id": "agr-receiver",
      "type": "receiver",
      "receiverChannel": "chl-sap-output",
      "messageMapping": "map-sales-internal"
    }
  ]
}
```

## Migration to Logic Apps

The IR schema makes it easy to generate Logic Apps workflows:

1. **Integration Process** → Logic Apps Workflow
2. **Steps** → Actions and control flow
3. **Message Mapping** → Liquid transformation
4. **Endpoints** → Logic Apps connectors
5. **Agreements** → Connection configuration

This normalized representation ensures consistency and enables full automation of the migration process.
