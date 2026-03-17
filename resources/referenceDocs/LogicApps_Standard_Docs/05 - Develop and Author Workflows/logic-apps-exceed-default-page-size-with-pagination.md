<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-exceed-default-page-size-with-pagination -->
<!-- Title: Exceed Page Size Limit for Items or Rows -->

# Set up pagination to get more data than the page size limit in Azure Logic Apps

[Include](https://learn.microsoft.com/en-us/azure/includes/logic-apps-sku-consumption-standard.md)

When you get data, items, or records by using a connector action in Azure Logic Apps, you might get result sets so large that the action doesn't return all the results at the same time. For example, the default page size for the SQL Server connector's **Get rows** action is 2048, but might vary based on other settings.

For some actions, the number of results might exceed the connector's default page size. In this case, the action returns only the first page of results. 

Some actions let you turn on a *pagination* setting so that your logic app can retrieve more results up to the pagination limit. The action returns those results as a single message when the action finishes.

When you use pagination, you must specify a *threshold* value, which is the number of results you want the action to return. The action gets results until reaching your specified threshold. When your total number of items is less than the specified threshold, the action gets all the results.

Turning on the pagination setting retrieves pages of results based on a connector's page size. This behavior means that sometimes, you might get more results than your specified threshold. For example, when using the SQL Server **Get rows** action, which supports pagination setting:

- The action's default page size is 2048 records per page.
- Suppose you have 10,000 records and specify 5000 records as the minimum.
- Pagination gets pages of records, so to get at least the specified minimum, the action returns 6144 records (3 pages x 2048 records), not 5000 records.

Here's a list of some of the connectors where you can exceed the default page size for some actions:

- [Azure Blob Storage](https://learn.microsoft.com/en-us/connectors/azureblob/)
- [Dynamics 365](https://learn.microsoft.com/en-us/connectors/dynamicscrmonline/)
- [Excel](https://learn.microsoft.com/en-us/connectors/excel/)
- [HTTP](https://learn.microsoft.com/en-us/azure/connectors/connectors-native-http)
- [IBM DB2](https://learn.microsoft.com/en-us/connectors/db2/)
- [Microsoft Teams](https://learn.microsoft.com/en-us/connectors/teams/)
- [Oracle Database](https://learn.microsoft.com/en-us/connectors/oracle/)
- [Salesforce](https://learn.microsoft.com/en-us/connectors/salesforce/)
- [SharePoint](https://learn.microsoft.com/en-us/connectors/sharepointonline/)
- [SQL Server](https://learn.microsoft.com/en-us/connectors/sql/)

## Prerequisites

- An Azure subscription. If you don't have an Azure subscription yet, [sign up for a free Azure account](https://azure.microsoft.com/pricing/purchase-options/azure-account?cid=msft_learn).

- The logic app resource, workflow, and connector action where you want to turn on pagination.

  For more information, see the following articles:
  
  - [Create a Consumption logic app workflow](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-example-consumption-workflow)
  - [Create a Standard logic app workflow](https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-azure-portal)

## Turn on pagination

To determine whether an action supports pagination in the workflow designer, check the action's settings for the **Pagination** setting.

1. In the [Azure portal](https://portal.azure.com), open your logic app resource.

1. Based on the logic app type, follow the corresponding steps:

    - Consumption: On the resource sidebar menu, under **Development Tools**, select the designer to open the workflow.
    
    - Standard: On the resource sidebar menu, under **Workflows**, select **Workflows**. Select the workflow that you want to open the designer.

1. On the designer, select the action. On the information pane that opens, select **Settings**.

   If the action supports pagination, under **Networking**, the **Pagination** setting is available.

1. Change the **Pagination** setting from **Off** to **On**.

   ![Screenshot shows the action information pane with the Settings tab, Pagination set to On, and a Threshold value.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-exceed-default-page-size-with-pagination/sql-action-settings-pagination.png)

1. In the **Threshold** property, specify an integer value for the target number of results that you want the action to return.

1. Save your workflow. On the designer toolbar, select **Save**.

## Workflow definition - pagination

When you turn on pagination for an action that supports this capability, your logic app's workflow definition includes the `"paginationPolicy"` property along with the `"minimumItemCount"` property in that action's `"runtimeConfiguration"` property, for example:

```json
"actions": {
   "HTTP": {
      "inputs": {
         "method": "GET",
         "uri": "https://www.testuri.com"
      },
      "runAfter": {},
      "runtimeConfiguration": {
         "paginationPolicy": {
            "minimumItemCount": 1000
         }
      },
      "type": "Http"
   }
},
```

In this case, the response returns an array that contains JSON objects.

## Get support

- [Azure Logic Apps Q & A](https://learn.microsoft.com/en-us/answers/topics/azure-logic-apps.html)
