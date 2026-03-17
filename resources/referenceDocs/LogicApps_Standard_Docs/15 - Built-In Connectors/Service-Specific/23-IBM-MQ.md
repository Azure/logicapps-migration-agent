# MQ

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/mq/

The MQ connector provides an API to work with IBM MQ server.

This article describes the operations for the IBM MQ built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the MQ managed connector operations instead, see [MQ managed connector reference](https://learn.microsoft.com/en-us/connectors/mq/).

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Connector how-to guide

For more information about connecting to an MQ system from your workflow in Azure Logic Apps, see [Connect to IBM MQ servers from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-mq?tabs=standard).

## Authentication

### Server name

The host name for the MQ server

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Server name | The host name for the MQ server | string | True | |

### Port number

The TCP port number for connecting to the MQ queue manager on the host

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Port number | The TCP port number for connecting to the MQ queue manager on the host | int | True | |

### Channel

The name for the MQ server connection channel

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Channel | The name for the MQ server connection channel | string | True | |

### Queue manager

Queue manager name

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Queue manager | Queue manager name | string | True | |

### Connect As

Connect As name

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Connect As | Connect As name | string | True | |

### Dead-letter queue name

The dead-letter queue name

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Dead-letter queue name | The dead-letter queue name | string | False | |

### Backup server name

The name for the optional backup MQ server in a multi-instance queue manager setup

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Backup server name | The name for the optional backup MQ server in a multi-instance queue manager setup | string | False | |

### Backup port number

The optional backup port number in a multi-instance queue manager setup

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Backup port number | The optional backup port number in a multi-instance queue manager setup | int | False | |

### User name

The optional username for connection authentication

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| User name | The optional username for connection authentication | string | False | |

### Password

The optional user password for connection authentication

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Password | The optional user password for connection authentication | securestring | False | |

### Max connections

The optional maximum number of pooled connections for the flow. The default is 10 connections.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Max connections | The optional maximum number of pooled connections for the flow. The default is 10 connections. | int | False | |

### Connection timeout

The optional time out period in seconds for a pooled connection before the connection is closed and any browse-locked messages are unlocked and return to the queue. The default is '3600' seconds.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Connection timeout | The optional time out period in seconds for a pooled connection before the connection is closed and any browse-locked messages are unlocked and return to the queue. The default is '3600' seconds. | int | False | |

### Use TLS

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Use TLS | | bool | False | |

### Client Cert Thumbprint

The client certificate thumbprint for use with Mutual TLS authentication

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Client Cert Thumbprint | The client certificate thumbprint for use with Mutual TLS authentication | securestring | False | |

## Actions

| Operation | Description |
|-----------|-------------|
| Browse message | Returns a message from a queue using browse-lock. The received message is locked but not deleted from the queue. |
| Browse multiple messages | Returns one or more messages from a queue using browse-lock. The received messages are locked but not deleted from the queue. If no maximum message count is provided, the default count is 20 messages. |
| Complete message | Either commits (deletes from queue) or abort (unlocks in queue) a browse-locked message. |
| Complete multiple messages | Either commits (deletes from queue) or abort (unlocks in queue) multiple browse-locked messages. |
| Move message to MQ dead-letter queue | Move a selected message to the MQ dead-letter queue (DLQ) |
| Receive message | Returns a message from a queue using auto-complete. The received message is deleted from the queue. |
| Receive multiple messages | Returns one or more messages from a queue using auto-complete. The received messages are deleted from the queue. If no maximum message count is provided, the default count is 20 messages. |
| Send message | Sends a message to a queue. |
| Send multiple messages | Sends one or more messages to a queue. |

### Browse message

- **Operation ID:** browseMessage

Returns a message from a queue using browse-lock. The received message is locked but not deleted from the queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Include headers | includeInfo | True | string | Yes to include message headers |
| getMessageOptions | getMessageOptions | | string | The name for the IBM MQ queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation connection ID | connectionId | string | The unique connection ID used in the operation |
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Operation message count | count | string | The number of messages affected by the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| Message item | message | string | The message affected by the operation |

### Browse multiple messages

- **Operation ID:** browseBatch

Returns one or more messages from a queue using browse-lock. The received messages are locked but not deleted from the queue. If no maximum message count is provided, the default count is 20 messages.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Include headers | includeInfo | True | string | Yes to include message headers |
| getMessageOptions | getMessageOptions | | string | The name for the IBM MQ queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation connection ID | connectionId | string | The unique connection ID used in the operation |
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Operation message count | count | string | The number of messages affected by the operation |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| messages | messages | string | The list of messages affected by the operation |

### Complete message

- **Operation ID:** completeMessage

Either commits (deletes from queue) or abort (unlocks in queue) a browse-locked message.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Connection ID | connectionId | True | string | The connection ID from the previous browse operation |
| Queue name | queueName | True | string | The queue name from the previous browse operation |
| Unique identifier | uniqueId | True | string | The MQ message unique identifier from previous browse operation. |
| Message ID | messageId | True | string | The message ID from the previous browse operation |
| Complete action | completeAction | True | string | The commit (delete from queue) or abort (unlock in queue) options when completing a browse-locked message |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation connection ID | connectionId | string | The unique connection ID used in the operation |
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Operation message count | count | string | The number of messages affected by the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| Completed message | message | string | The message affected by the operation |

### Complete multiple messages

- **Operation ID:** completeBatch

Either commits (deletes from queue) or abort (unlocks in queue) multiple browse-locked messages.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Connection ID | connectionId | True | string | The connection ID from the previous browse operation |
| Queue name | queueName | True | string | The queue name from the previous browse operation |
| Complete action | completeAction | True | string | The commit (delete from queue) or abort (unlock in queue) options when completing a browse-locked message |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation connection ID | connectionId | string | The unique connection ID used in the operation |
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Operation message count | count | string | The number of messages affected by the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| messages | messages | string | The list of messages affected by the operation |

### Move message to MQ dead-letter queue

- **Operation ID:** moveMessageToDeadLetterQueue

Move a selected message to the MQ dead-letter queue (DLQ)

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Message item | message | True | string | The message schema item to send to the MQ dead-letter queue |
| Dead-letter Reason | reasonCode | True | string | The reason or error code for why the message is being moved to the dead-letter queue |
| Dead-letter queue | deadLetterQueueName | | string | The MQ dead-letter queue name |
| sendMessageOptions | sendMessageOptions | | string | The message schema item to send to the MQ dead-letter queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Operation message count | count | string | The number of messages affected by the operation |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| Message | message | string | The message affected by the operation |

### Receive message

- **Operation ID:** receiveMessage

Returns a message from a queue using auto-complete. The received message is deleted from the queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Include headers | includeInfo | True | string | Yes to include message headers |
| getMessageOptions | getMessageOptions | | string | The name for the IBM MQ queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Operation message count | count | string | The number of messages affected by the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| Message item | message | string | The message affected by the operation |

### Receive multiple messages

- **Operation ID:** receiveBatch

Returns one or more messages from a queue using auto-complete. The received messages are deleted from the queue. If no maximum message count is provided, the default count is 20 messages.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Include headers | includeInfo | True | string | Yes to include message headers |
| getMessageOptions | getMessageOptions | | string | The name for the IBM MQ queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Operation message count | count | string | The number of messages affected by the operation |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| messages | messages | string | The list of messages affected by the operation |

### Send message

- **Operation ID:** sendMessage

Sends a message to a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Content | message | True | string | The message body content |
| sendMessageOptions | sendMessageOptions | | string | The name for the IBM MQ queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Sent message count | count | string | The number of messages affected by the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| Message | message | string | The message affected by the operation |

### Send multiple messages

- **Operation ID:** sendBatch

Sends one or more messages to a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Messages | messageList | True | string | One or more messages schema to send to the queue |
| sendMessageOptions | sendMessageOptions | | string | The name for the IBM MQ queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Operation queue name | queueName | string | The name for the queue used in the operation |
| Operation reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Operation reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Sent message count | count | string | The number of messages affected by the operation |
| Operation timestamp | timestamp | string | The timestamp for the operation |
| messages | messages | string | The list of messages affected by the operation |

## Triggers

| Operation | Description |
|-----------|-------------|
| When message is available in a queue | Triggers a flow when a message is available in a queue. |
| When one or more messages are received from a queue (auto-complete) | Triggers a flow when one or more messages are received from a queue using auto-complete. The received messages are deleted from the queue. |
| When one or more messages are received from a queue (browse-lock) | Triggers a flow when one or more messages are received from a queue using browse-lock. The received messages are locked but not deleted from the queue. |

### When message is available in a queue

- **Operation ID:** pollAvailable

Triggers a flow when a message is available in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Wait interval (sec) | waitIntervalInSeconds | | string | The wait period (sec) before MQ returns from a GET call without a message. The default is 0 second. The maximum allowed is 360 seconds. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Trigger queue name | queueName | string | The name for the queue used in the operation |
| Trigger reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Trigger reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Trigger timestamp | timestamp | string | The timestamp for the operation |

### When one or more messages are received from a queue (auto-complete)

- **Operation ID:** pollMessages

Triggers a flow when one or more messages are received from a queue using auto-complete. The received messages are deleted from the queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Include headers | includeInfo | True | string | Yes to include message headers |
| getMessageOptions | getMessageOptions | | string | The name for the IBM MQ queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Trigger queue name | queueName | string | The name for the queue used in the operation |
| Trigger reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Trigger reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Trigger message count | count | string | The number of messages affected by the operation |
| Trigger timestamp | timestamp | string | The timestamp for the operation |
| messages | messages | string | The list of messages returned from the trigger operation |

### When one or more messages are received from a queue (browse-lock)

- **Operation ID:** pollBrowseMessages

Triggers a flow when one or more messages are received from a queue using browse-lock. The received messages are locked but not deleted from the queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the IBM MQ queue |
| Include headers | includeInfo | True | string | Yes to include message headers |
| getMessageOptions | getMessageOptions | | string | The name for the IBM MQ queue |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Trigger connection ID | connectionId | string | The unique connection ID used in the operation |
| Trigger queue name | queueName | string | The name for the queue used in the operation |
| Trigger reason code | reasonCode | string | The numeric value that is the IBM representation of a status code. |
| Trigger reason code description | reasonCodeDescription | string | The description for the numeric reason code, similar to an exception message. |
| Trigger message count | count | string | The number of messages affected by the operation |
| Trigger timestamp | timestamp | string | The timestamp for the operation |
| messages | messages | string | The list of messages returned from the trigger operation |

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/mq/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/mq/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/mq/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/mq/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/mq/#triggers)
