<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-custom-api-host-deploy-call -->
<!-- Title: Call Web APIs and REST APIs from Workflows -->

# Call your own web APIs and REST APIs from workflows in Azure Logic Apps

[Include](https://learn.microsoft.com/en-us/azure/includes/logic-apps-sku-consumption-standard.md)

When you have existing web APIs or REST APIs that you want to call from workflows in Azure Logic Apps, you must first complete some setup steps before you can call these APIs. Primarily, you must deploy your APIs as web apps or API apps. You can perform this task by hosting your APIs on Azure App Service, a cloud platform that provides highly scalable, easy API hosting.

In App Service, you can deploy your APIs as web apps but consider deploying your APIs as API apps instead. This approach makes your job easier when you build, host, and consume APIs in the cloud and in on-premises environments. You don't have to change any code in your APIs to deploy to an API app.

You can call any API from a workflow, but for the best experience, add [Swagger metadata](https://swagger.io/specification/) to your web app or API app. This Swagger document describes your API operations and parameters, which helps logic app workflows work better and more easily with your API. You must also set up Cross-Origin Resource Sharing (CORS) on your web app or API app so your workflow can access your API.

This guide shows how to add a Swagger document, set up CORS for your web app or API app, and provide options for calling your API from a workflow after you complete deployment and hosting for your API in App Service.

For more information, see:

- [Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/overview)
- [Create and deploy an ASP.NET web app](https://learn.microsoft.com/en-us/azure/app-service/quickstart-dotnetcore)
- [Create host a RESTful API with CORS in Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-rest-api)

## Prerequisites

- An Azure account with an active subscription. If you don't have a subscription, [create a free account](https://azure.microsoft.com/pricing/purchase-options/azure-account?cid=msft_learn).

- A web API or REST API that follows [one of the patterns compatible with workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-create-api-app) and is deployed to App Service as a web app or API app.

  For more information, see:

  - [Create and deploy an ASP.NET web app](https://learn.microsoft.com/en-us/azure/app-service/quickstart-dotnetcore)
  - [Create host a RESTful API with CORS in Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-rest-api)

## Add Swagger and CORS access to your web app or API app

When you add a Swagger document to your web app or API app, the workflow designer in Azure Logic Apps can more easily find and show the available operations and parameters in your API. You must also set up Cross-Origin Resource Sharing (CORS) on your web app or API app so your workflow can access your API.

To make your Swagger document readable from your workflow in the designer, on your web app or API app, set the API definition properties and CORS access.

1. In the [Azure portal](https://portal.azure.com), find and open your web app or API app resource.

1. On the app resource sidebar, select **Overview**.

1. On the **Properties** tab, under **Domains**, from the **Default domain** property, copy and save the website name somewhere for the next step.

1. On the app resource sidebar, under **API**, select **API definition**. For **API definition location**, enter the URL for your Swagger JSON file, which typically uses the following format, but might differ if your Swagger file uses a newer API specification:

   `https://<website-name>/swagger/docs/v1`

   The following example shows a Swagger URL with the newer API specification:

   ![Screenshot shows the Azure portal, web app's API definition page, and URL for your API's Swagger document.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-custom-api-deploy-call/custom-api-swagger-url.png)

1. When you're done, select **Save**.

1. On the app resource sidebar, under **API**, select **CORS**.

1. For **Allowed Origin**, set the CORS policy to **'*'**, which means to allow all.

   This setting permits requests from the workflow designer in Azure Logic Apps.

   ![Screenshot shows web app's CORS pane with Allowed Origins set to *, which allows all.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-custom-api-deploy-call/custom-api-cors.png)

1. On the toolbar, select **Save**.

For more information, see [Host a RESTful API with CORS in Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-rest-api).

## Call your API from your workflow

After you set up the API definition URL and CORS, your API operations appear in the connector gallery for you find and add to your workflow. 

- To view websites that have OpenAPI URLs, you can browse your subscription websites in the workflow designer.

- To view available actions and inputs by pointing at a Swagger document, use the [HTTP + Swagger](https://learn.microsoft.com/en-us/azure/connectors/connectors-native-http-swagger) trigger or action.

- To call any API, including APIs that don't have or expose a Swagger document, you can always create a request with the [HTTP action](https://learn.microsoft.com/en-us/azure/connectors/connectors-native-http).

## Related content

- [Custom connectors in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/custom-connector-overview)
