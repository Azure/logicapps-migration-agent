# RabbitMQ

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/rabbitmq/

Connect to a RabbitMQ server for sending and receiving messages.

RabbitMQ is a free, open-source, scalable messaging broker for cloud, on-premises, or local environments. This article describes the operations for the RabbitMQ built-in connector, which is available only for Standard workflows that use the Workflow Service Plan or Hybrid hosting options in Azure Logic Apps. In scenarios that use the Hybrid hosting option, Standard workflows require an on-premises messaging tool compared to Standard workflows with other hosting options, which use Azure Service Bus.

This connector's operations use the Advanced Message Queuing Protocol (AMQP) for client-broker communication. You can use the operations to receive messages from publishers and pass them on to consumers.

---

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

---

## Authentication

### Connection String

RabbitMQ connection string. If the host doesn't contain vhost, then the connection string should end with a trailing slash (/).

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Connection String | RabbitMQ connection string. If the host doesn't contain vhost, then the connection string should end with a trailing slash (/). | securestring | True | |

---

## Actions

| Action | Description |
|--------|-------------|
| Complete a message | This operation performs an acknowledgement on a message in the RabbitMQ server. |
| Create a queue | Create a queue on the RabbitMQ server. |
| Send a message | This operation sends a message to the RabbitMQ server. |

### Complete a message

- **Operation ID:** completeMessage

This operation performs an acknowledgement on a message in the RabbitMQ server.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Delivery Tag | deliveryTag | True | string | A unique identifier assigned by the RabbitMQ server to each message delivered to a consumer over a channel. |
| Consumer Tag | consumerTag | True | string | The unique identifier assigned to each consumer connected to the RabbitMQ server. |
| Acknowledgement | acknowledgement | True | string | Choose whether you want to perform a positive acknowledgement on the message or reject it. If you reject, you need to provide an input whether you want the message to be requeued or not. |
| Requeue on Reject | requeueOnReject | | string | Requeue the message, if rejected. |

### Create a queue

- **Operation ID:** createQueue

Create a queue on the RabbitMQ server.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name of the queue to be created. |
| Queue Durability | durable | True | string | A durable queue will survive a broker restart. |
| Exchange Name | exchangeName | True | string | The name of the exchange to be created. |
| Exchange Type | exchangeType | True | string | The type of exchange you want to create. By default, 'Direct' type is chosen. |
| Binding Key | bindingKey | True | string | The key to bind a queue to an exchange. It acts as a filter for the queue, specifying which messages the queue should accept. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Queue Name | queueName | string | The queue name. |
| Message count | messageCount | string | The message count of the queue. |
| Consumer count | consumerCount | string | The consumer count of the queue. |

### Send a message

- **Operation ID:** sendRabbitMQMessage

This operation sends a message to the RabbitMQ server.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The queue to send the message to. |
| Message body | message | True | string | The message to send to the RabbitMQ server. |
| Exchange Name | exchangeName | | string | The exchange to be used while publishing the message. |
| Routing Key | routingKey | | string | This key acts as the message address that the exchange uses to determine where to send the message. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Message body | body | string | The body in the message. |

---

## Triggers

| Trigger | Description |
|---------|-------------|
| When the queue has messages available | This operation runs your workflow when the queue has messages available. |
| When the queue has messages available (peek-lock) | This operation runs your workflow when the queue has messages available(peek-lock). |

### When the queue has messages available

- **Operation ID:** receiveRabbitMQMessages

This operation runs your workflow when the queue has messages available.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The queue to check for messages. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content Data | contentData | string | The content data. |
| Basic properties | basicProperties | string | The content header in the message. |
| Delivery tag | deliveryTag | string | The delivery tag for this message. |
| Redelivered | redelivered | string | The redelivered flag per the Advanced Message Queueing Protocol (AMQP). |
| Consumer Tag | consumerTag | string | The unique identifier assigned to each consumer connected to the RabbitMQ server. |

### When the queue has messages available (peek-lock)

- **Operation ID:** peeklockRabbitMQMessages

This operation runs your workflow when the queue has messages available(peek-lock).

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The queue to check for messages. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content Data | contentData | string | The content data. |
| Basic properties | basicProperties | string | The content header in the message. |
| Delivery tag | deliveryTag | string | The delivery tag for this message. |
| Redelivered | redelivered | string | The redelivered flag per the Advanced Message Queueing Protocol (AMQP). |
| Consumer Tag | consumerTag | string | The unique identifier assigned to each consumer connected to the RabbitMQ server. |

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/rabbitmq/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/rabbitmq/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/rabbitmq/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/rabbitmq/#triggers)
