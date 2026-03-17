# Service Bus

> Source: https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/servicebus/

Connect to Azure Service Bus to send and receive messages.

This article describes the operations for the Azure Service Bus built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Service Bus managed connector operations instead, see [Azure Service Bus managed connector reference](https://learn.microsoft.com/en-us/connectors/servicebus/).

By default, Azure Service Bus built-in connector operations are stateless, but you can [enable stateful mode for these operations](https://learn.microsoft.com/en-us/azure/connectors/enable-stateful-affinity-built-in-connectors).

---

## Built-in connector settings

In a Standard logic app resource, the Azure Service Bus built-in connector includes settings that control various thresholds for performance, throughput, timeout, and so on. For more information, review [Reference for host settings - host.json - Built-in Azure Service Bus operations](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings#built-in-service-bus).

---

## Connector how-to guide

For more information about connecting to Azure Service Bus from your workflow in Azure Logic Apps, see [Connect to Azure Service Bus from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-servicebus?tabs=standard).

---

## Authentication

### Connection String

The connection string for Service Bus.

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Connection String | The connection string for Service Bus. | securestring | True | |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Allowed Values |
|------|-------------|------|----------|----------------|
| Fully qualified namespace | Fully qualified namespace eg: [name].servicebus.windows.net | string | True | |
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
| Fully qualified namespace | Fully qualified namespace eg: [name].servicebus.windows.net | string | True | |
| Managed identity | Managed identity | string | True | |
| Managed identity | Managed identity | string | False | |

---

## Actions

| Operation | Description |
|-----------|-------------|
| Abandon the message in a queue | Abandon the message in a queue. |
| Abandon the message in a session | Abandon the message in a session enabled queue or topic subscription. |
| Abandon the message in a topic subscription | Abandon the message in a topic subscription. |
| Close a queue session | The operation closes a queue session. |
| Close a topic session | The operation closes a topic session. |
| Complete the message in a queue | Complete the message in a queue. |
| Complete the message in a session | Complete the message in a session enabled queue or topic subscription. |
| Complete the message in a topic subscription | Complete the message in a topic subscription. |
| Create a topic subscription | The operation creates a topic subscription. |
| Dead-letter the message in a queue | Dead-letter the message in a queue. |
| Dead-letter the message in a session | Dead-letter the message in a session enabled queue or topic subscription. |
| Dead-letter the message in a topic subscription | Dead-letter the message in a topic subscription. |
| Defer message in a queue | Defer the processing for the message in a queue. |
| Defer message in a session | Defer the processing for the message in a session enabled queue or topic subscription. |
| Defer message in a topic subscription | Defer the processing for the message in a topic subscription. |
| Delete a topic subscription | The operation deletes a topic subscription. |
| Get deferred message from a queue | The operation gets a deferred message from a queue. |
| Get deferred message from a queue session | The operation gets a deferred message from a queue session. |
| Get deferred message from a topic subscription | The operation gets a deferred message from a topic subscription. |
| Get deferred message from a topic subscription session | The operation gets a deferred message from a topic subscription session. |
| Get messages from a queue | The operation gets messages from a queue. |
| Get messages from a queue session | The operation gets messages from a queue session. |
| Get messages from a topic subscription | The operation gets messages from a topic subscription. |
| Get messages from a topic subscription in a session | The operation gets messages from a topic subscription in a session. |
| Renew a queue session | The operation renews a queue session. |
| Renew a topic session | The operation renews a topic session. |
| Renew lock on a message in a topic subscription | The operation renews lock on a message in a topic subscription. |
| Renew lock on a message in queue | The operation renews lock on a message in a queue. |
| Replicate messages | Send messages for replication to another service bus queue or topic. These messages include extra properties for replication purposes. To find available messages, use the trigger named "When messages are available in a queue for replication" or "When messages are available in a topic subscription for replication". |
| Send message | Send message to a queue or topic. |
| Send multiple messages | This operation sends messages to a queue or topic. |

### Abandon the message in a queue

- **Operation ID:** abandonQueueMessageV2

Abandon the message in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Lock token | lockToken | True | string | The lock token of the message to abandon |

### Abandon the message in a session

- **Operation ID:** abandonMessageInSession

Abandon the message in a session enabled queue or topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Message ID | messageId | True | string | The ID for the message to abandon |
| Lock token | lockToken | | string | The lock token of the message to abandon |

### Abandon the message in a topic subscription

- **Operation ID:** abandonTopicMessageV2

Abandon the message in a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Lock token | lockToken | True | string | The lock token of the message to abandon |

### Close a queue session

- **Operation ID:** closeQueueSession

The operation closes a queue session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Session Id | sessionId | True | string | The identifier of the session. |

### Close a topic session

- **Operation ID:** closeTopicSession

The operation closes a topic session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Session Id | sessionId | True | string | The identifier of the session. |

### Complete the message in a queue

- **Operation ID:** completeQueueMessageV2

Complete the message in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Lock token | lockToken | True | string | The lock token of the message to complete. |

### Complete the message in a session

- **Operation ID:** completeMessageInSession

Complete the message in a session enabled queue or topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Message ID | messageId | True | string | The ID for the message to complete. |
| Lock token | lockToken | | string | The lock token of the message to complete. |

### Complete the message in a topic subscription

- **Operation ID:** completeTopicMessageV2

Complete the message in a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Lock token | lockToken | True | string | The lock token of the message to complete. |

### Create a topic subscription

- **Operation ID:** createTopicSubscription

The operation creates a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic Name | topicName | True | string | Name of the topic. |
| Topic subscription name | topicSubscriptionName | True | string | Name of the topic subscription. |
| Filter type | topicSubscriptionFilterType | True | string | The topic subscription filter type. |
| topicSubscriptionCorrelationFilter | topicSubscriptionCorrelationFilter | | string | Name of the topic. |

### Dead-letter the message in a queue

- **Operation ID:** deadLetterQueueMessageV2

Dead-letter the message in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Lock token | lockToken | True | string | The lock token of the message to dead-letter. |
| Dead-letter reason | deadLetterReason | | string | The reason or error code for dead-lettering the message. |
| Dead-letter description | deadLetterErrorDescription | | string | A detailed description of the dead-letter reason. |

### Dead-letter the message in a session

- **Operation ID:** deadLetterMessageInSession

Dead-letter the message in a session enabled queue or topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Message ID | messageId | True | string | The ID for the message to dead-letter. |
| Lock token | lockToken | | string | The lock token of the message to dead-letter. |
| Dead-letter reason | deadLetterReason | | string | The reason or error code for dead-lettering the message. |
| Dead-letter description | deadLetterErrorDescription | | string | A detailed description of the dead-letter reason. |

### Dead-letter the message in a topic subscription

- **Operation ID:** deadLetterTopicMessageV2

Dead-letter the message in a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Lock token | lockToken | True | string | The lock token of the message to dead-letter. |
| Dead-letter reason | deadLetterReason | | string | The reason or error code for dead-lettering the message. |
| Dead-letter description | deadLetterErrorDescription | | string | A detailed description of the dead-letter reason. |

### Defer message in a queue

- **Operation ID:** deferQueueMessageV2

Defer the processing for the message in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Lock token | lockToken | True | string | The lock token of the message to defer. |

### Defer message in a session

- **Operation ID:** deferMessageInSession

Defer the processing for the message in a session enabled queue or topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Message ID | messageId | True | string | The ID for the message to defer. |
| Lock token | lockToken | | string | The lock token of the message to defer. |

### Defer message in a topic subscription

- **Operation ID:** deferTopicMessageV2

Defer the processing for the message in a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Lock token | lockToken | True | string | The lock token of the message to defer. |

### Delete a topic subscription

- **Operation ID:** deleteTopicSubscription

The operation deletes a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic Name | topicName | True | string | Name of the topic. |
| Topic subscription name | topicSubscriptionName | True | string | Name of the topic subscription. |

### Get deferred message from a queue

- **Operation ID:** getDeferredMessageFromQueueV2

The operation gets a deferred message from a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Sequence Number | sequenceNumber | True | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content | contentData | string | Content of the message. |
| Content type | contentType | string | The content type of the message. |
| Session ID | sessionId | string | The identifier of the session. |
| User properties | userProperties | object | Any key-value pairs for user properties. |
| Message ID | messageId | string | A user-defined value that Service Bus can use to identify duplicate messages, if enabled. |
| Lock Token | lockToken | string | The lock token is a reference to the lock that is being held by the broker in peek-lock receive mode. |
| To | to | string | Sends to address |
| Reply to | replyTo | string | The address where to send a reply. |
| Reply to session | replyToSession | string | The identifier of the session where to reply. |
| Label | label | string | Application specific label |
| Scheduled UTC time to enqueue | scheduledEnqueueTimeUtc | string | The UTC date and time for when to add the message to the queue. |
| Correlation ID | correlationId | string | The identifier of the correlation. |
| Time to live | timeToLive | string | The number of ticks or duration for when a message is valid. The duration starts from when the message is sent to Service Bus. |
| Dead-letter Source | deadletterSource | string | Only set in messages that have been dead-lettered and later autoforwarded from the dead-letter queue to another entity. Indicates the entity in which the message was dead-lettered. |
| Delivery Count | deliveryCount | string | Number of deliveries that have been attempted for this message. The count is incremented when a message lock expires, or the message is explicitly abandoned by the receiver. |
| Enqueued Sequence Number | enqueuedSequenceNumber | string | For messages that have been autoforwarded, this property reflects the sequence number that had first been assigned to the message at its original point of submission. |
| Enqueue Time UTC | enqueuedTimeUtc | string | The UTC instant at which the message has been accepted and stored in the entity. |
| Locked Until UTC | lockedUntilUtc | string | For messages retrieved under a lock (peek-lock receive mode, not pre-settled) this property reflects the UTC instant until which the message is held locked in the queue/subscription. |
| Sequence Number | sequenceNumber | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |

### Get deferred message from a queue session

- **Operation ID:** getDeferredMessageFromQueueSession

The operation gets a deferred message from a queue session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Sequence Number | sequenceNumber | True | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |
| Session Id | sessionId | | string | The identifier of the session. |
| Acquire new session | acquireNewSession | | string | Acquire a new session if needed. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content | contentData | string | Content of the message. |
| Content type | contentType | string | The content type of the message. |
| Session ID | sessionId | string | The identifier of the session. |
| User properties | userProperties | object | Any key-value pairs for user properties. |
| Message ID | messageId | string | A user-defined value that Service Bus can use to identify duplicate messages, if enabled. |
| Lock Token | lockToken | string | The lock token is a reference to the lock that is being held by the broker in peek-lock receive mode. |
| To | to | string | Sends to address |
| Reply to | replyTo | string | The address where to send a reply. |
| Reply to session | replyToSession | string | The identifier of the session where to reply. |
| Label | label | string | Application specific label |
| Scheduled UTC time to enqueue | scheduledEnqueueTimeUtc | string | The UTC date and time for when to add the message to the queue. |
| Correlation ID | correlationId | string | The identifier of the correlation. |
| Time to live | timeToLive | string | The number of ticks or duration for when a message is valid. The duration starts from when the message is sent to Service Bus. |
| Dead-letter Source | deadletterSource | string | Only set in messages that have been dead-lettered and later autoforwarded from the dead-letter queue to another entity. Indicates the entity in which the message was dead-lettered. |
| Delivery Count | deliveryCount | string | Number of deliveries that have been attempted for this message. The count is incremented when a message lock expires, or the message is explicitly abandoned by the receiver. |
| Enqueued Sequence Number | enqueuedSequenceNumber | string | For messages that have been autoforwarded, this property reflects the sequence number that had first been assigned to the message at its original point of submission. |
| Enqueue Time UTC | enqueuedTimeUtc | string | The UTC instant at which the message has been accepted and stored in the entity. |
| Locked Until UTC | lockedUntilUtc | string | For messages retrieved under a lock (peek-lock receive mode, not pre-settled) this property reflects the UTC instant until which the message is held locked in the queue/subscription. |
| Sequence Number | sequenceNumber | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |

### Get deferred message from a topic subscription

- **Operation ID:** getDeferredMessageFromTopicV2

The operation gets a deferred message from a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Sequence Number | sequenceNumber | True | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content | contentData | string | Content of the message. |
| Content type | contentType | string | The content type of the message. |
| Session ID | sessionId | string | The identifier of the session. |
| User properties | userProperties | object | Any key-value pairs for user properties. |
| Message ID | messageId | string | A user-defined value that Service Bus can use to identify duplicate messages, if enabled. |
| Lock Token | lockToken | string | The lock token is a reference to the lock that is being held by the broker in peek-lock receive mode. |
| To | to | string | Sends to address |
| Reply to | replyTo | string | The address where to send a reply. |
| Reply to session | replyToSession | string | The identifier of the session where to reply. |
| Label | label | string | Application specific label |
| Scheduled UTC time to enqueue | scheduledEnqueueTimeUtc | string | The UTC date and time for when to add the message to the queue. |
| Correlation ID | correlationId | string | The identifier of the correlation. |
| Time to live | timeToLive | string | The number of ticks or duration for when a message is valid. The duration starts from when the message is sent to Service Bus. |
| Dead-letter Source | deadletterSource | string | Only set in messages that have been dead-lettered and later autoforwarded from the dead-letter queue to another entity. Indicates the entity in which the message was dead-lettered. |
| Delivery Count | deliveryCount | string | Number of deliveries that have been attempted for this message. The count is incremented when a message lock expires, or the message is explicitly abandoned by the receiver. |
| Enqueued Sequence Number | enqueuedSequenceNumber | string | For messages that have been autoforwarded, this property reflects the sequence number that had first been assigned to the message at its original point of submission. |
| Enqueue Time UTC | enqueuedTimeUtc | string | The UTC instant at which the message has been accepted and stored in the entity. |
| Locked Until UTC | lockedUntilUtc | string | For messages retrieved under a lock (peek-lock receive mode, not pre-settled) this property reflects the UTC instant until which the message is held locked in the queue/subscription. |
| Sequence Number | sequenceNumber | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |

### Get deferred message from a topic subscription session

- **Operation ID:** getDeferredMessageFromTopicSession

The operation gets a deferred message from a topic subscription session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Sequence Number | sequenceNumber | True | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |
| Session Id | sessionId | | string | The identifier of the session. |
| Acquire new session | acquireNewSession | | string | Acquire a new session if needed. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content | contentData | string | Content of the message. |
| Content type | contentType | string | The content type of the message. |
| Session ID | sessionId | string | The identifier of the session. |
| User properties | userProperties | object | Any key-value pairs for user properties. |
| Message ID | messageId | string | A user-defined value that Service Bus can use to identify duplicate messages, if enabled. |
| Lock Token | lockToken | string | The lock token is a reference to the lock that is being held by the broker in peek-lock receive mode. |
| To | to | string | Sends to address |
| Reply to | replyTo | string | The address where to send a reply. |
| Reply to session | replyToSession | string | The identifier of the session where to reply. |
| Label | label | string | Application specific label |
| Scheduled UTC time to enqueue | scheduledEnqueueTimeUtc | string | The UTC date and time for when to add the message to the queue. |
| Correlation ID | correlationId | string | The identifier of the correlation. |
| Time to live | timeToLive | string | The number of ticks or duration for when a message is valid. The duration starts from when the message is sent to Service Bus. |
| Dead-letter Source | deadletterSource | string | Only set in messages that have been dead-lettered and later autoforwarded from the dead-letter queue to another entity. Indicates the entity in which the message was dead-lettered. |
| Delivery Count | deliveryCount | string | Number of deliveries that have been attempted for this message. The count is incremented when a message lock expires, or the message is explicitly abandoned by the receiver. |
| Enqueued Sequence Number | enqueuedSequenceNumber | string | For messages that have been autoforwarded, this property reflects the sequence number that had first been assigned to the message at its original point of submission. |
| Enqueue Time UTC | enqueuedTimeUtc | string | The UTC instant at which the message has been accepted and stored in the entity. |
| Locked Until UTC | lockedUntilUtc | string | For messages retrieved under a lock (peek-lock receive mode, not pre-settled) this property reflects the UTC instant until which the message is held locked in the queue/subscription. |
| Sequence Number | sequenceNumber | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |

### Get messages from a queue

- **Operation ID:** getMessagesFromQueueV2

The operation gets messages from a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Maximum number of messages | maxMessages | | string | The maximum number of messages to receive. |

#### Returns

One or more messages received from Service Bus.

- **Messages** array

### Get messages from a queue session

- **Operation ID:** getMessagesFromQueueSession

The operation gets messages from a queue session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Session Id | sessionId | True | string | The identifier of the session. |
| Maximum number of messages | maxMessages | | string | The maximum number of messages to receive. |
| Acquire new session | acquireNewSession | | string | Acquire a new session if needed. |

#### Returns

One or more messages received from Service Bus.

- **Messages** array

### Get messages from a topic subscription

- **Operation ID:** getMessagesFromTopicV2

The operation gets messages from a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Maximum number of messages | maxMessages | | string | The maximum number of messages to receive. |

#### Returns

One or more messages received from Service Bus topic

- **Messages** array

### Get messages from a topic subscription in a session

- **Operation ID:** getMessagesFromTopicSession

The operation gets messages from a topic subscription in a session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Session Id | sessionId | True | string | The identifier of the session. |
| Maximum number of messages | maxMessages | | string | The maximum number of messages to receive. |
| Acquire new session | acquireNewSession | | string | Acquire a new session if needed. |

#### Returns

One or more messages received from Service Bus topic

- **Messages** array

### Renew a queue session

- **Operation ID:** renewQueueSession

The operation renews a queue session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Session Id | sessionId | True | string | The identifier of the session. |

### Renew a topic session

- **Operation ID:** renewTopicSession

The operation renews a topic session.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Session Id | sessionId | True | string | The identifier of the session. |

### Renew lock on a message in a topic subscription

- **Operation ID:** renewLockTopicMessageV2

The operation renews lock on a message in a topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Lock token | lockToken | True | string | The lock token of the message to renew the lock. |

### Renew lock on a message in queue

- **Operation ID:** renewLockQueueMessageV2

The operation renews lock on a message in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Lock token | lockToken | True | string | The lock token of the message to renew the lock. |

### Replicate messages

- **Operation ID:** replicateMessages

Send messages for replication to another service bus queue or topic. These messages include extra properties for replication purposes.

To find available messages, use the trigger named "When messages are available in a queue for replication" or "When messages are available in a topic subscription for replication".

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue or topic name | entityName | True | string | The name of the queue or topic. |
| Skip replicated messages? | skipAlreadyReplicated | True | string | Skips already replicated messages. |

### Send message

- **Operation ID:** sendMessage

Send message to a queue or topic.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue or topic name | entityName | True | string | The name of the queue or topic. |
| message | message | True | string | Send message to a queue or topic. |

### Send multiple messages

- **Operation ID:** sendMessages

This operation sends messages to a queue or topic.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue or topic name | entityName | True | string | The name of the queue or topic. |
| Messages | messages | True | string | One or more messages to send to the queue or topic. |

---

## Triggers

| Operation | Description |
|-----------|-------------|
| On new messages from queue session | The operation gets new messages from a queue session for sequential convoy patterns. |
| On new messages from topic session | The operation gets new messages from a topic session for sequential convoy patterns. |
| On single new message from queue session | The operation gets single new message from a queue session for sequential convoy patterns. |
| On single new message from topic session | The operation gets single new message from a topic session for sequential convoy patterns. |
| When messages are available in a queue | This operation triggers a run when messages are available in a queue. |
| When messages are available in a queue (peek-lock) | The operation triggers a run when a message is received in a queue using peek-lock mode. |
| When messages are available in a queue for replication | Run when a queue has messages ready to replicate. To replicate messages to another service bus queue or topic subscription, use the action named "Replicate messages". |
| When messages are available in a topic | The operation triggers a run when a message is available in topic subscription. |
| When messages are available in a topic subscription (peek-lock) | The operation triggers a run when a message is received in a topic subscription using peek-lock mode. |
| When messages are available in a topic subscription for replication | Run when a topic subscription has messages ready to replicate. To replicate messages to another service bus queue or topic subscription, use the action named "Replicate messages". |

### On new messages from queue session

- **Operation ID:** onNewMessagesFromQueueSession

The operation gets new messages from a queue session for sequential convoy patterns.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Session Id | sessionId | | string | The identifier of the session. |
| Maximum number of messages | maxMessages | | string | The maximum number of messages to receive. |

#### Returns

One or more messages received from Service Bus.

- **Messages** array

### On new messages from topic session

- **Operation ID:** onNewMessagesFromTopicSession

The operation gets new messages from a topic session for sequential convoy patterns.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Session Id | sessionId | | string | The identifier of the session. |
| Maximum number of messages | maxMessages | | string | The maximum number of messages to receive. |

#### Returns

One or more messages received from Service Bus topic

- **Messages** array

### On single new message from queue session

- **Operation ID:** onSingleNewMessageFromQueueSession

The operation gets single new message from a queue session for sequential convoy patterns.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Session Id | sessionId | | string | The identifier of the session. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content | contentData | string | Content of the message. |
| Content type | contentType | string | The content type of the message. |
| Session ID | sessionId | string | The identifier of the session. |
| User properties | userProperties | object | Any key-value pairs for user properties. |
| Message ID | messageId | string | A user-defined value that Service Bus can use to identify duplicate messages, if enabled. |
| Lock Token | lockToken | string | The lock token is a reference to the lock that is being held by the broker in peek-lock receive mode. |
| To | to | string | Sends to address |
| Reply to | replyTo | string | The address where to send a reply. |
| Reply to session | replyToSession | string | The identifier of the session where to reply. |
| Label | label | string | Application specific label |
| Scheduled UTC time to enqueue | scheduledEnqueueTimeUtc | string | The UTC date and time for when to add the message to the queue. |
| Correlation ID | correlationId | string | The identifier of the correlation. |
| Time to live | timeToLive | string | The number of ticks or duration for when a message is valid. The duration starts from when the message is sent to Service Bus. |
| Dead-letter Source | deadletterSource | string | Only set in messages that have been dead-lettered and later autoforwarded from the dead-letter queue to another entity. Indicates the entity in which the message was dead-lettered. |
| Delivery Count | deliveryCount | string | Number of deliveries that have been attempted for this message. The count is incremented when a message lock expires, or the message is explicitly abandoned by the receiver. |
| Enqueued Sequence Number | enqueuedSequenceNumber | string | For messages that have been autoforwarded, this property reflects the sequence number that had first been assigned to the message at its original point of submission. |
| Enqueue Time UTC | enqueuedTimeUtc | string | The UTC instant at which the message has been accepted and stored in the entity. |
| Locked Until UTC | lockedUntilUtc | string | For messages retrieved under a lock (peek-lock receive mode, not pre-settled) this property reflects the UTC instant until which the message is held locked in the queue/subscription. |
| Sequence Number | sequenceNumber | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |

### On single new message from topic session

- **Operation ID:** onSingleNewMessageFromTopicSession

The operation gets single new message from a topic session for sequential convoy patterns.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Session Id | sessionId | | string | The identifier of the session. |

#### Returns

| Name | Path | Type | Description |
|------|------|------|-------------|
| Content | contentData | string | Content of the message. |
| Content type | contentType | string | The content type of the message. |
| Session ID | sessionId | string | The identifier of the session. |
| User properties | userProperties | object | Any key-value pairs for user properties. |
| Message ID | messageId | string | A user-defined value that Service Bus can use to identify duplicate messages, if enabled. |
| Lock Token | lockToken | string | The lock token is a reference to the lock that is being held by the broker in peek-lock receive mode. |
| To | to | string | Sends to address |
| Reply to | replyTo | string | The address where to send a reply. |
| Reply to session | replyToSession | string | The identifier of the session where to reply. |
| Label | label | string | Application specific label |
| Scheduled UTC time to enqueue | scheduledEnqueueTimeUtc | string | The UTC date and time for when to add the message to the queue. |
| Correlation ID | correlationId | string | The identifier of the correlation. |
| Time to live | timeToLive | string | The number of ticks or duration for when a message is valid. The duration starts from when the message is sent to Service Bus. |
| Dead-letter Source | deadletterSource | string | Only set in messages that have been dead-lettered and later autoforwarded from the dead-letter queue to another entity. Indicates the entity in which the message was dead-lettered. |
| Delivery Count | deliveryCount | string | Number of deliveries that have been attempted for this message. The count is incremented when a message lock expires, or the message is explicitly abandoned by the receiver. |
| Enqueued Sequence Number | enqueuedSequenceNumber | string | For messages that have been autoforwarded, this property reflects the sequence number that had first been assigned to the message at its original point of submission. |
| Enqueue Time UTC | enqueuedTimeUtc | string | The UTC instant at which the message has been accepted and stored in the entity. |
| Locked Until UTC | lockedUntilUtc | string | For messages retrieved under a lock (peek-lock receive mode, not pre-settled) this property reflects the UTC instant until which the message is held locked in the queue/subscription. |
| Sequence Number | sequenceNumber | string | The sequence number is a unique 64-bit integer assigned to a message as it is accepted and stored by the broker and functions as its true identifier. |

### When messages are available in a queue

- **Operation ID:** receiveQueueMessages

This operation triggers a run when messages are available in a queue.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| IsSessionsEnabled | isSessionsEnabled | | string | Whether sessions are enabled for the queue. |
| Maximum message batch size | maxMessageBatchSize | | string | Maximum message batch size to receive from a queue. |

#### Returns

One or more messages received from Service Bus.

- **Messages** array

### When messages are available in a queue (peek-lock)

- **Operation ID:** peekLockQueueMessagesV2

The operation triggers a run when a message is received in a queue using peek-lock mode.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| Maximum message batch size | maxMessageBatchSize | | string | Maximum message batch size to receive from a queue. |

#### Returns

One or more messages received from Service Bus (peek-lock).

- **Messages** array

### When messages are available in a queue for replication

- **Operation ID:** receiveQueueMessagesForReplication

Run when a queue has messages ready to replicate.

To replicate messages to another service bus queue or topic subscription, use the action named "Replicate messages".

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Queue name | queueName | True | string | The name for the queue. |
| IsSessionsEnabled | isSessionsEnabled | | string | Whether sessions are enabled for the queue. |
| Maximum message batch size | maxMessageBatchSize | | string | Maximum message batch size to receive from a queue. |

### When messages are available in a topic

- **Operation ID:** receiveTopicMessages

The operation triggers a run when a message is available in topic subscription.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| IsSessionsEnabled | isSessionsEnabled | | string | Whether sessions are enabled for the topic subscription. |
| Maximum message batch size | maxMessageBatchSize | | string | Maximum message batch size to receive from a topic subscription. |

#### Returns

One or more messages received from Service Bus topic

- **Messages** array

### When messages are available in a topic subscription (peek-lock)

- **Operation ID:** peekLockTopicMessagesV2

The operation triggers a run when a message is received in a topic subscription using peek-lock mode.

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| Maximum message batch size | maxMessageBatchSize | | string | Maximum message batch size to receive from a topic subscription. |

#### Returns

One or more messages received from Service Bus (peek-lock).

- **Messages** array

### When messages are available in a topic subscription for replication

- **Operation ID:** receiveTopicMessagesForReplication

Run when a topic subscription has messages ready to replicate.

To replicate messages to another service bus queue or topic subscription, use the action named "Replicate messages".

#### Parameters

| Name | Key | Required | Type | Description |
|------|-----|----------|------|-------------|
| Topic name | topicName | True | string | The name for the topic. |
| Subscription name | subscriptionName | True | string | The name for the topic subscription. |
| IsSessionsEnabled | isSessionsEnabled | | string | Whether sessions are enabled for the topic subscription. |
| Maximum message batch size | maxMessageBatchSize | | string | Maximum message batch size to receive from a topic subscription. |

---

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Reference](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/documentintelligence/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/servicebus/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/servicebus/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/servicebus/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/servicebus/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/servicebus/#triggers)
