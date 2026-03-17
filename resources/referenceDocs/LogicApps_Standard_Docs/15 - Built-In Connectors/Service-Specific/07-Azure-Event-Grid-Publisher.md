# Event Grid Publisher

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventgridpublisher/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventgridpublisher/)

Azure Event Grid is an eventing backplane that enables event based programing with pub/sub semantics and reliable distribution & delivery for all services in Azure as well as third parties.

This article describes the operations for the Azure Event Grid Publisher built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps. If you're looking for the Azure Event Grid Publish managed connector operations instead, see [Azure Event Grid Publish managed connector reference](https://learn.microsoft.com/en-us/connectors/azureeventgridpublish/).

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Authentication

### Access Key

Primary or secondary key for the application topic.

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Topic Endpoint | DNS endpoint for the application topic for events. (eg. https://[yourtopic].[region].eventgrid.azure.net/api/events) | string | True |  |
| Access Key | Primary or secondary key for the application topic. | securestring | True |  |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Topic Endpoint | DNS endpoint for the application topic for events. (eg. https://[yourtopic].[region].eventgrid.azure.net/api/events) | string | True |  |
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
| Topic Endpoint | DNS endpoint for the application topic for events. (eg. https://[yourtopic].[region].eventgrid.azure.net/api/events) | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Publish Events | Publish an Event Grid Event to an Event Grid Topic. |

### Publish Events

- **Operation ID:** publishEvents

Publish an Event Grid Event to an Event Grid Topic.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Event Grid Events | events | True | string | List of Event Grid Event Schema. |

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventgridpublisher/#built-in-connector-settings)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventgridpublisher/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/eventgridpublisher/#actions)
