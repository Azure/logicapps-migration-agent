> **Source:** https://learn.microsoft.com/en-us/azure/logic-apps/azure-integration-services-choose-capabilities

# Choose the Best Integration Services in Azure for Enterprise Integration Scenarios

Azure Integration Services offers many capabilities across this collection of integration services, but some overlapping capabilities might exist. This guide provides information to help you choose the best services for your enterprise integration scenarios and requirements. Remember also to consider the full impact of using a particular service, including performance requirements, skill set availability, operational support, and costs.

> **Note:** If you're a BizTalk Server customer looking to move your workloads to Azure Logic Apps, you can get a migration overview and compare the capabilities between these two offerings by reviewing [Why migrate from BizTalk Server to Azure Logic Apps?](https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-to-azure-integration-services-overview)

## When to Choose a Specific Integration Service and Why

| Service | When to Use | Why |
|---------|------------|-----|
| **Azure Logic Apps** | You have business processes to orchestrate across multiple systems that span from legacy systems to artificial intelligence workloads. You need to migrate from Microsoft BizTalk Server or other integration platforms. | Provides greater developer productivity through the low-code workflow designer. Excels at wiring API calls together quickly using prebuilt, out-of-the-box connectors. Supports both synchronous and asynchronous processing. Offers rich debugging history for stateful workflows. Supports stateless workflows for low latency requirements. Supports creating custom APIs and custom connectors (Consumption) and custom built-in connectors based on a service provider (Standard). |
| **Azure Functions** | You need to build central utility functions that you can access from other integration platform components, such as Azure Logic Apps. You have unique data transformation requirements. | Provides an event driven, compute-on-demand experience for developers that need to extend the Azure application platform by implementing code triggered by events in Azure or other services and on-premises systems. |
| **Azure Data Factory** | You need the capability to transform and move large datasets across various data sources, such as file systems, database, SAP, Azure Blob Storage, Azure Data Explorer, Oracle, DB2, Amazon RDS, and more. | Provides a cloud-based serverless ETL service for scale-out, dataset integration, and data transformation. Can handle large data and message processing requirements. Offers code-free UI for intuitive authoring and single-pane-of-glass monitoring. Supports lift-and-shift for existing SSIS packages to Azure. |
| **Azure Service Bus** | You need a messaging system that supports the publish-subscribe model, ordered delivery, duplicate detection, message scheduling, and message expiration scenarios. | Provides a fully managed enterprise message broker with message queues and publish-subscribe topics. Decouples applications and services for load balancing, safe routing, and coordinated transactional work. Complements Azure Logic Apps and supports SDK-based interactions with Service Bus entities. |
| **Azure Event Grid** | You need an event subscription architecture to stay updated on state changes in one or more applications and systems because your integration solutions depend heavily on events. | Provides a highly scalable, serverless event broker for integrating applications using events. Increases efficiency by avoiding constant polling to determine state changes. |
| **Azure API Management** | You want to abstract and protect your underlying service implementation in Azure Logic Apps from end users and consumers. | Provides a hybrid, multi-cloud management platform for APIs across all environments. Offers the capability to reuse central services in a secure way with governance and control. |

## Next Steps

You've now learned more about which offerings in Azure Integration Services best suit specific scenarios and needs. If you're considering moving from BizTalk Server to Azure Integration Services, learn more about migration approaches, planning considerations, and best practices to help with your migration project.

- [Migration approaches for BizTalk Server to Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-azure-integration-services-migration-approaches)
