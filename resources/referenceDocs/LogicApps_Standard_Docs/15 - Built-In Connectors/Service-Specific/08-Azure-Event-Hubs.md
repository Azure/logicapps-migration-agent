# Event Hubs

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventhub/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventhub/)

Connect to Azure Event Hubs to send and receive events.

This article describes the operations for the Azure Event Hubs built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Event Hubs managed connector operations instead, see [Azure Event Hubs managed connector reference](https://learn.microsoft.com/en-us/connectors/eventhubs/).

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Throughput, performance, and scale

Each Azure Event Hubs connection can handle up to 1,000 events per minute. If you need higher throughput, for example, 8,000 events per minute, consider spreading the workload across multiple connections or even workflows.

For more information about the following topics, see the following documentation:

- [Azure Event Hubs quotas and limits](https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-quotas)
- [Best practices and recommendations for optimal responsiveness and peformance](https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-azure-portal#best-practices-and-recommendations)
- [Throughput in Azure Event Hubs](https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-faq#throughput-units)
- [Performance and scale in Azure Event Hubs](https://learn.microsoft.com/en-us/azure/architecture/serverless/event-hubs-functions/performance-scale)

## Connector how-to guide

For more information about connecting to Azure Event Hubs from your workflow in Azure Logic Apps, see [Connect to Azure Event Hubs from workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-azure-event-hubs?tabs=standard).

## Authentication

### Connection String

Azure Event Hubs Connection String

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Connection String | Azure Event Hubs Connection String | securestring | True |  |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Fully qualified namespace | Fully qualified namespace eg: [name].servicebus.windows.net | string | True |  |
| Active Directory OAuth | Active Directory OAuth | string | True |  |
| Authority | Active Directory authority | string | False |  |
| Tenant | Active Directory tenant | string | True |  |
| Credential type | Active Directory credential type | string | False | Certificate, Secret |
| Client ID | Active Directory client ID | string | True |  |
| Client secret | Active Directory client secret | securestring | True |  |
| Pfx | Active Directory pfx | securestring | True |  |
| Password | Active Directory password | securestring | True |  |

### Managed identity

Managed identity

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Fully qualified namespace | Fully qualified namespace eg: [name].servicebus.windows.net | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Replicate events | Send events for replication to another event hub. These events include extra properties for replication purposes. |
| Send Event | Connect to Azure Event Hubs to send event. |
| Send Multiple Events | Connect to Azure Event Hubs to send events. |

### Replicate events

- **Operation ID:** replicateEvents

Send events for replication to another event hub. These events include extra properties for replication purposes. To find available events, use the trigger named "When events are available for replication".

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Event Hub Name | eventHubName | True | string | Name of the Event Hub |
| Skip replicated events? | skipAlreadyReplicated | True | string | Skips already replicated events. |

### Send Event

- **Operation ID:** sendEvent

Connect to Azure Event Hubs to send event.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Event Hub Name | eventHubName | True | string | Name of the Event Hub |
| eventData | eventData | True | string | Send Event |
| Partition key | partitionKey |  | string | Partition key |

### Send Multiple Events

- **Operation ID:** sendEvents

Connect to Azure Event Hubs to send events.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Event Hub Name | eventHubName | True | string | Name of the Event Hub |
| Events | eventDatas | True | string | One or more events to send to the Event Hub partition |
| Partition key | partitionKey |  | string | Partition key |

## Triggers

| Trigger | Description |
| --- | --- |
| When events are available for replication | Run when an event hub has events ready to replicate. |
| When events are available in Event hub | When events are available in Event Hub. |

### When events are available for replication

- **Operation ID:** receiveEventsForReplication

Run when an event hub has events ready to replicate. To replicate events to another event hub, use the action named "Replicate events".

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Event Hub Name | eventHubName | True | string | Name of the Event Hub |
| Consumer Group Name | consumerGroup |  | string | Name of the Consumer Group |

### When events are available in Event hub

- **Operation ID:** receiveEvents

When events are available in Event Hub.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Event Hub Name | eventHubName | True | string | Name of the Event Hub |
| Consumer Group Name | consumerGroup |  | string | Name of the Consumer Group |

#### Returns

One or more events received from Event Hub

- **Events** array

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventhub/#built-in-connector-settings)
- [Throughput, performance, and scale](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventhub/#throughput-performance-and-scale)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventhub/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventhub/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventhub/#actions)
- [Triggers](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventhub/#triggers)
