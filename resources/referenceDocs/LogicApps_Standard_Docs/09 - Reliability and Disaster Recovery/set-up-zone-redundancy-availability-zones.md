<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/set-up-zone-redundancy-availability-zones -->
<!-- Title: Protect logic apps from zonal failures -->

# Enable zone-redundancy for your logic app

[Include](https://learn.microsoft.com/en-us/azure/includes/logic-apps-sku-consumption-standard.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/reliability/reliability-availability-zone-description-include.md)

For scenarios where you need high reliability for your logic app workflows, you can set up *zone redundancy* with *availability zones* within an Azure region. Azure Logic Apps can then distribute logic app workloads across all the availability zones within a region. This capability protects your apps and their information from datacenter failures within a region.

This guide shows how to enable zone redundancy for your logic apps.

## Prerequisites

- Make sure that you understand zone redundancy support. Also, ensure you meet the requirements to use availability zones, including being in a supported region, when you create your logic app resource. For more information, see [Reliability in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/reliability/reliability-logic-apps#resilience-to-availability-zone-failures).

- You need to have an Azure account and subscription. If you don't have a subscription, [sign up for a free Azure account](https://azure.microsoft.com/pricing/purchase-options/azure-account?cid=msft_learn).

- If you have a firewall or restricted environment, you have to allow traffic through all the IP addresses required by Azure Logic Apps, Azure-hosted managed connectors, and any custom connectors in the Azure region where you create your logic app workflows. New IP addresses that support availability zone redundancy are already published for Azure Logic Apps, managed connectors, and custom connectors. For more information, see the following documentation:

  - [Firewall configuration: IP addresses and service tags](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-limits-and-config#firewall-ip-configuration)

  - [Inbound IP addresses for Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-limits-and-config#inbound)

  - [Outbound IP addresses for Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-limits-and-config#outbound)

  - [Outbound IP addresses for managed connectors and custom connectors](https://learn.microsoft.com/en-us/connectors/common/outbound-ip-addresses)

## Limitations

With HTTP-based actions, certificates exported or created with AES256 encryption won't work when used for client certificate authentication. The same certificates also won't work when used for OAuth authentication.

## Set up zone redundancy for your logic app

For Consumption logic apps, zone redundancy is automatically enabled. You don't need to take any additional steps to enable zone redundancy for Consumption logic apps.

For Standard logic apps only, follow these steps:

1. In the [Azure portal](https://portal.azure.com), start creating a logic app.

1. On the **Create Logic App** page, select **Workflow Service Plan** or **App Service Environment V3**, based on the hosting option you want to use.

   ![Screenshot shows Azure portal, Create Logic App page, Standard plan types.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/set-up-zone-redundancy-availability-zones/select-standard-plan.png)

   For a tutorial, see [Create Standard logic app workflows with single-tenant Azure Logic Apps in the Azure portal](https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-azure-portal).

1. Under **Zone redundancy**, select **Enabled**.

   At this point, your logic app creation experience appears similar to this example:

   ![Screenshot shows Azure portal, Create Logic App page, Standard logic app details, and the Enabled option selected under Zone redundancy.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/set-up-zone-redundancy-availability-zones/enable-zone-redundancy-standard.png)

   > [!NOTE]
   >
   > The **Zone redundancy** options appear unavailable if you select an unsupported Azure region or an 
   > existing Windows plan that was created in an unsupported Azure region. Make sure to select a supported 
   > Azure region and a Windows plan that was created in a supported Azure region, or create a new Windows plan.

1. Finish creating your logic app workflow.

1. If you use a firewall and haven't set up access for traffic through the required IP addresses, make sure to complete that [requirement](#prerequisites).

## Related content

- [Reliability in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/reliability/reliability-logic-apps)
