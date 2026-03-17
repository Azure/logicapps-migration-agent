# Confluent

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/confluentkafka/

Confluent Service Provider

Confluent Kafka is a distributed streaming platform for building real-time data pipelines and streaming applications. Many industries such as financial services, Omnichannel retail, autonomous cars, fraud detection services, microservices, and IoT deployments use this platform for its capabilities.

This article describes the operations for the Confluent built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. You can use this connector's operations to exchange messages between your workflow and Confluent Kafka, which provide the following benefits:

- Publish and subscribe to streams of records.
- Store streams of records in a fault tolerant way.
- Process streams of records.

The connector supports both triggers to receive messages and actions to send or publish messages.

---

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

---

## Authentication

### Brokers list

The list of Confluent Kafka brokers.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Brokers list | The list of Confluent Kafka brokers. | string | True | |

### User name

User name for the Kafka cluster.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| User name | User name for the Kafka cluster. | securestring | True | |

### Password

Password for the Kafka cluster.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | Password for the Kafka cluster. | securestring | True | |

### Message compression type

The message compression type.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Message compression type | The message compression type. | string | False | |

### Schema registry URL

Schema registry URL

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Schema registry URL | Schema registry URL | string | False | |

### Schema registry username

The username for the schema registry.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Schema registry username | The username for the schema registry. | string | False | |

### Schema registry password

The password for the schema registry.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Schema registry password | The password for the schema registry. | securestring | False | |

---

## Actions

| Operation | Description |
|-----------|-------------|
| Send messages to Kafka topic (Preview) | Send messages to a Kafka topic. |

### Send messages to Kafka topic (Preview)

- **Operation ID:** SendMessage

Send messages to a Kafka topic.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | TopicName | True | string | The topic of the Kafka message. |
| Message | Message | True | string | The message to send. |
| Key | messageKey | | string | (Optional) The key for the message. |
| Headers | Headers | | object | (Optional) The headers to include with the message. |
| Schema subject name | SchemaSubjectName | | string | The schema subject name for message. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Topic name | TopicName | string | The topic of the Kafka message. |
| Partition | Partition | string | The partition of the Kafka message. |
| Offset | Offset | string | The offset of the Kafka message. |
| Timestamp | Timestamp | string | The timestamp of the Kafka message. |
| Status | Status | string | The status of the message delivery. |

---

## Triggers

| Operation | Description |
|-----------|-------------|
| Receive messages from Confluent Kafka (Preview) | Receive messages from Confluent Kafka. |

### Receive messages from Confluent Kafka (Preview)

- **Operation ID:** ReceiveMessage

Receive messages from Confluent Kafka.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | Topic | True | string | The topic of the Kafka message. |
| Consumer group | ConsumerGroup | | string | The Confluent Kafka consumer group. |
| Authentication mode | AuthenticationMode | | string | The authentication mode for communication. |
| Protocol | Protocol | | string | The protocol used for communication. |
| Avro schema | AvroSchema | | string | The Avro schema used for messages. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Key | messageKey | string | (Optional) The key for the message. |
| Offset | Offset | string | The offset of the Kafka message. |
| Partition | Partition | string | The partition of the Kafka message. |
| Topic name | topic | string | The topic of the Kafka message. |
| Headers | Headers | string | (Optional) The headers to include with the message. |
| Timestamp | Timestamp | string | The timestamp of the Kafka message. |
| Message | Message | string | The message to send. |

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/confluentkafka/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/confluentkafka/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/confluentkafka/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/confluentkafka/#triggers)
