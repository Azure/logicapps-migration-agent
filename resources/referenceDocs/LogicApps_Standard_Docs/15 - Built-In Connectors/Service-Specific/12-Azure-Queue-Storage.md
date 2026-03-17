# Azure Queue Storage

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurequeues/

Connect to your Azure Queue Storage to create, query, delete queue entries and queues.

This article describes the operations for the Azure Queue Storage built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Table Storage managed connector operations instead, see [Azure Queue Storage managed connector reference](https://learn.microsoft.com/en-us/connectors/azurequeues/).

---

## Built-in connector settings

In a Standard logic app resource, the Azure Queue Storage built-in connector includes settings that control various thresholds for performance, timeout, execution time, and so on. For example, you can change the timeout value for queue storage requests from the Azure Logic Apps runtime. For more information, review [Reference for host settings - host.json - Table and queue storage](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings#built-in-storage).

---

## Authentication

### Storage account connection string

The connection string for your Azure storage account.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Storage account connection string | The connection string for your Azure storage account. | securestring | True | |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Queue Storage endpoint | Queue Storage endpoint eg: https://[queuename].queue.core.windows.net/ | string | True | |
| Active Directory OAuth | Active Directory OAuth | string | True | |
| Authority | Active Directory authority | string | False | |
| Tenant | Active Directory tenant | string | True | |
| Credential type | Active Directory credential type | string | False | Certificate, Secret |
| Client ID | Active Directory client ID | string | True | |
| Client secret | Active Directory client secret | securestring | True | |
| Pfx | Active Directory pfx | securestring | True | |
| Password | Active Directory password | securestring | True | |

### Managed identity

Managed identity

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Queue Storage endpoint | Queue Storage endpoint eg: https://[queuename].queue.core.windows.net/ | string | True | |
| Managed identity | Managed identity | string | True | |
| Managed identity | Managed identity | string | False | |

---

## Actions

| Operation | Description |
|-----------|-------------|
| Add a message to queue | Add a message without additional encoding to queue. By default, encoding in base64 is required to pick up the message when using the Azure Queue built-in connector trigger. |
| Create a new queue | Create a new queue. |
| Delete message | Delete a specific message from the queue. |
| Get Messages | Get a specific set of messages from the queue. The messages will be hidden but remain on the queue until the delete action is used. |
| List queues | Lists the queues for your storage account. If the max count parameter value is less than the number of queues returned in the paginated response from the API, the final response would return all the queues from that page. |

### Add a message to queue

- **Operation ID:** putMessage

Add a message without additional encoding to queue. By default, encoding in base64 is required to pick up the message when using the Azure Queue built-in connector trigger.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The queue to put a message to. |
| Message | message | True | string | The message body without additional encoding. |
| Time to live | timeToLive | | string | Time to live. The input should be in timespan format. eg : "4.12:14:45". |
| Initial visibility delay | visibilityTimeout | | string | Initial visibility delay. The input should be in timespan format. eg : "4.12:14:45". |

### Create a new queue

- **Operation ID:** putQueue

Create a new queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name of the queue to create. |

### Delete message

- **Operation ID:** deleteMessage

Delete a specific message from the queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The queue to delete messages from. |
| Message ID | messageId | True | string | The ID of the message to delete. |
| Pop Receipt | popReceipt | True | string | A valid pop receipt value returned from an earlier call to the Get Messages. |

### Get Messages

- **Operation ID:** getMessages

Get a specific set of messages from the queue. The messages will be hidden but remain on the queue until the delete action is used.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue Name | queueName | True | string | The queue to get Messages from. |
| Number of Messages | messageCount | | string | The number of messages to grab from the queue. |
| Visibility Timeout | visibilityTimeout | | string | The time in seconds that messages will be invisible to other consumers. The input should be in timespan format. eg : "4.12:14:45". |

#### Returns

- **Output** array

### List queues

- **Operation ID:** listQueues

Lists the queues for your storage account. If the max count parameter value is less than the number of queues returned in the paginated response from the API, the final response would return all the queues from that page.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue prefix | prefix | | string | Queue prefix. |
| Max count | maxCount | | string | Maximum number of queues to fetch. |
| Continuation Token | continuationToken | | string | Continuation Token. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| List of queues | queueList | string | List of queues. |
| Continuation Token | continuationToken | string | Continuation Token. |

---

## Triggers

| Operation | Description |
|-----------|-------------|
| When a specified number of messages are available in a queue | This operation triggers a run when a specified number of messages are available in a queue. |
| When messages are available in a queue | This operation triggers a run when messages are available in a queue. |

### When a specified number of messages are available in a queue

- **Operation ID:** specifiedNumberOfMessagesAvailable

This operation triggers a run when a specified number of messages are available in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue Name | queueName | True | string | The queue to check for messages. |
| Threshold | threshold | True | string | The number of messages to wait for to fire the trigger. |

#### Returns

Number of messages in the queue.

- **Number of Messages** integer

### When messages are available in a queue

- **Operation ID:** receiveQueueMessages

This operation triggers a run when messages are available in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue Name | queueName | True | string | The queue to check for messages. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content | messageText | string | Content of the message. |
| Message ID | messageId | string | An identifier that Azure Queue can use to identify duplicate messages, if enabled. |
| Insertion Time | insertedOn | string | The time the message was inserted into the queue. |
| Expiration Time | expiresOn | string | The time the message will expire from the queue. |
| Pop Receipt | popReceipt | string | Used to delete the message after popping it off the queue. |
| Next Visible Time | nextVisibleOn | string | The time the message will be visible to other consumers. |

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurequeues/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurequeues/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurequeues/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/azurequeues/#triggers)
