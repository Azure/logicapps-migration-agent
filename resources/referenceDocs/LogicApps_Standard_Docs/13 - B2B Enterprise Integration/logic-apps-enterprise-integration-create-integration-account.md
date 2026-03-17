<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-create-integration-account -->

Table of contents 
			
			
				
				Exit editor mode
			
		
	
			
				
					
		
			
				
		
			
				
					
				
			
			
		

		
	 
		
			
		
			
				
			
		
		
			
				
			
			Ask Learn
		
		
			
				
			
			Ask Learn
		
	 
		
			
				
			
			Focus mode
		
	 

			
				
					
						
					
				
				
					
		
			
				
			
			Table of contents
		
	 
		
			
				
			
			Read in English
		
	 
		
			
				
			
			Add
		
	
					
		
			
				
			
			Add to plan
		
	  
		
			
				
			
			Edit
		
	
					
		
		#### Share via
		
					
						
							
						
						Facebook
					

					
						
							
						
						x.com
					

					
						
							
						
						LinkedIn
					
					
						
							
						
						Email
					
			  
	 
		
		
				
					
						
						
						
					
					Copy Markdown
				
		   
				
					
						
					
					Print
				
		  
	
				
			
		
	
			
		
	  
		
		
			
			
				
					

						
							
						
						Note
					

					

						Access to this page requires authorization. You can try [signing in](#) or changing directories.
					

					

						Access to this page requires authorization. You can try changing directories.
					

				
			
		
	
					# Create and manage integration accounts for B2B workflows in Azure Logic Apps with the Enterprise Integration Pack
					
		
			 
				
					
		
			
				
			
			Feedback
		
	
				
		  
		
	 
		
			
				
					
				
				
					
						Summarize this article for me
					
				
			
			
			
		
	 
		
	
					
Applies to: **Azure Logic Apps (Consumption + Standard)**

Before you can build business-to-business (B2B) and enterprise integration workflows using Azure Logic Apps, you need to create an *integration account* resource. This account is a scalable cloud-based container in Azure that simplifies how you store and manage B2B artifacts that you define and use in your workflows for B2B scenarios, for example:

- [Trading partners](../logic-apps-enterprise-integration-partners)
- [Agreements](../logic-apps-enterprise-integration-agreements)
- [Maps](../logic-apps-enterprise-integration-maps)
- [Schemas](../logic-apps-enterprise-integration-schemas)
- [Certificates](../logic-apps-enterprise-integration-certificates)

You also need an integration account to electronically exchange B2B messages with other organizations. When other organizations use protocols and message formats different from your organization, you have to convert these formats so your organization's system can process those messages. With Azure Logic Apps, you can build workflows that support the following industry-standard protocols:

- [AS2](../logic-apps-enterprise-integration-as2)
- [EDIFACT](../logic-apps-enterprise-integration-edifact)
- [RosettaNet](../logic-apps-enterprise-integration-rosettanet)
- [X12](../logic-apps-enterprise-integration-x12)

If you're new to creating B2B enterprise integration workflows in Azure Logic Apps, see [B2B enterprise integration workflows with Azure Logic Apps and Enterprise Integration Pack](../logic-apps-enterprise-integration-overview).

## Prerequisites

An Azure account and subscription. If you don't have an Azure subscription, [sign up for a free Azure account](https://azure.microsoft.com/pricing/purchase-options/azure-account?cid=msft_learn). Make sure that you use the same Azure subscription for both your integration account and logic app resource.

Whether you're working on a Consumption or Standard logic app workflow, your logic app resource must already exist if you need to link your integration account.

For Consumption logic app resources, this link is required before you can use the artifacts from your integration account with your workflow. Although you can create your artifacts without this link, the link is required when you're ready to use these artifacts. To create an example Consumption logic app workflow, see [Quickstart: Create an example Consumption logic app workflow in multitenant Azure Logic Apps](../quickstart-create-example-consumption-workflow).

For Standard logic app resources, this link might be required or optional, based on your scenario:

If you have an integration account with the artifacts that you need or want to use, link the integration account to each Standard logic app resource where you want to use the artifacts.

Some Azure-hosted integration account connectors don't require the link and let you create a connection to your integration account. For example, such as **AS2**, **EDIFACT**, and **X12** don't require the link, but the **AS2 (v2)** connector requires the link.

The built-in connectors named **Liquid** and **Flat File** let you select maps and schemas that you previously uploaded to your logic app resource or to a linked integration account.

If you don't have or need an integration account, you can use the upload option. Otherwise, you can use the linking option, which also means you don't have to upload maps and schemas to each logic app resource. Either way, you can use these artifacts across all child workflows within the *same logic app resource*.

To create an example Standard logic app workflow, see [Create an example Standard logic app workflow in single-tenant Azure Logic Apps](../create-single-tenant-workflows-azure-portal).

A [Premium integration account](#create-integration-account) supports using a [private endpoint](../../private-link/private-endpoint-overview) within an Azure virtual network to securely communicate with other Azure resources in the same network. Your integration account, virtual network, and Azure resources must also exist in the same Azure region. For more information, see [Create a virtual network](../../virtual-network/quick-create-portal) and the steps in this guide to set up your Premium integration account.

For example, a Standard logic app can access the private endpoint if they exist in the same virtual network. However, a Consumption logic app doesn't support virtual network integration and can't access the private endpoint.

To create a Standard logic app with virtual network integration, see [Create an example Standard logic app workflow in single-tenant Azure Logic Apps](../create-single-tenant-workflows-azure-portal).

To set up an existing Standard logic app with virtual network integration, see [Set up virtual network integration](../secure-single-tenant-workflow-virtual-network-private-endpoint#set-up-virtual-network-integration).

## Create integration account

Integration accounts are available in different tiers that [vary in pricing](https://azure.microsoft.com/pricing/details/logic-apps/). Based on the tier you choose, creating an integration account might incur costs. For more information, see [Azure Logic Apps pricing and billing models](../logic-apps-pricing#integration-accounts) and [Azure Logic Apps pricing](https://azure.microsoft.com/pricing/details/logic-apps/).

Based on your requirements and scenarios, determine the appropriate integration account tier to create. The following table describes the available tiers:

Your integration account uses an automatically created and enabled system-assigned managed identity to authenticate access.

Tier
Description

**Premium**
For scenarios with the following criteria: 

- Store and use unlimited artifacts, such as partners, agreements, schemas, maps, certificates, and so on. 

- Bring and use your own storage, which contains the relevant runtime states for specific B2B actions and EDI standards. For example, these states include the MIC number for AS2 actions and the control numbers for X12 actions, if configured on your agreements. 

To access this storage, your integration account uses its system-assigned managed identity, which is automatically created and enabled for your integration account. 

You can also apply more governance and policies to data, such as customer-managed ("Bring Your Own") keys for data encryption. To store these keys, you'll need a key vault. 

- Set up and use a key vault to store private certificates or customer-managed keys. To access these keys, your Premium integration account uses its system-assigned managed identity, not an Azure Logic Apps shared service principal. 

- Set up a private endpoint that creates a secure connection between your Premium integration account and Azure services in an Azure virtual network. 

Pricing follows the [Standard integration account billing model](https://azure.microsoft.com/pricing/details/logic-apps/). 

**Limitations and known issues**: 

- If you use a key vault to store private certificates, your integration account's managed identity might not work. For now, use the linked logic app's managed identity instead. 

- B2B operations are available in *built-in* and *managed* versions. The Premium integration account supports only built-in operations, which are natively hosted and run with the Azure Logic Apps runtime. Managed operations, which aren't supported, run in shared clusters in multitenant Azure. 

- Currently doesn't support the [Azure CLI for Azure Logic Apps](https://learn.microsoft.com/en-us/cli/azure/service-page/logic%20apps).

**Standard**
For scenarios where you have more complex B2B relationships and increased numbers of entities that you must manage. 

Supported by the Azure Logic Apps SLA.

**Basic**
For scenarios where you want only message handling or to act as a small business partner that has a trading partner relationship with a larger business entity. 

Supported by the Azure Logic Apps SLA.

**Free**
For exploratory scenarios, not production scenarios. This tier has limits on region availability, throughput, and usage. For example, the Free tier is available only for public regions in Azure, for example, West US or Southeast Asia, but not for [Microsoft Azure operated by 21Vianet](https://learn.microsoft.com/en-us/azure/china/overview-operations) or [Azure Government](../../azure-government/documentation-government-welcome). 

**Note**: Not supported by the Azure Logic Apps SLA.

For this task, you can use the Azure portal, [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/resource#az-resource-create), or [Azure PowerShell](https://learn.microsoft.com/en-us/powershell/module/Az.LogicApp/New-AzIntegrationAccount).

Important

For you to successfully link and use your integration account with your logic app,
make sure that both resources exist in the *same* Azure subscription and Azure region.

[Portal](#tabpanel_1_azure-portal)

[Azure CLI](#tabpanel_1_azure-cli)

In the [Azure portal](https://portal.azure.com) search box, enter **integration accounts**, and select **Integration accounts**.

Under **Integration accounts**, select **Create**.

On the **Create an integration account** pane, provide the following information about your integration account:

Property
Required
Value
Description

**Subscription**
Yes
<*Azure-subscription-name*>
The name for your Azure subscription

**Resource group**
Yes
<*Azure-resource-group-name*>
The name for the [Azure resource group](../../azure-resource-manager/management/overview) to use for organizing related resources. For this example, create a new resource group named **FabrikamIntegration-RG**.

**Integration account name**
Yes
<*integration-account-name*>
Your integration account's name, which can contain only letters, numbers, hyphens (`-`), underscores (`_`), parentheses (`()`), and periods (`.`). This example uses **Fabrikam-Integration**.

**Pricing Tier**
Yes
<*pricing-level*>
The pricing tier for the integration account, which you can change later. For this example, select **Free**. For more information, see the following documentation: 

- [Logic Apps pricing model](../logic-apps-pricing#integration-accounts) 
- [Logic Apps limits and configuration](../logic-apps-limits-and-config#integration-account-limits) 
- [Logic Apps pricing](https://azure.microsoft.com/pricing/details/logic-apps/)

**Storage account**
Available only for the Premium integration account
None
The name for an existing [Azure storage account](../../storage/common/storage-account-create). For the example in this guide, this option doesn't apply.

**Region**
Yes
<*Azure-region*>
The Azure region where to store your integration account metadata. Either select the same location as your logic app resource, or create your logic apps in the same location as your integration account. For this example, use **West US**.

**Enable log analytics**
No
Unselected
For this example, don't select this option.

When you're done, select **Review + create**.

After deployment completes, Azure opens your integration account.

If you created a Premium integration account, make sure to [set up access to the associated Azure storage account](#set-up-access-storage-account). You can also create a private connection between your Premium integration account and Azure services by [setting up a private endpoint for your integration account](#set-up-private-endpoint).

### Prepare your environment for the Azure CLI

Use the Bash environment in [Azure Cloud Shell](https://learn.microsoft.com/en-us/azure/cloud-shell/overview). For more information, see [Get started with Azure Cloud Shell](https://learn.microsoft.com/en-us/azure/cloud-shell/quickstart).

![](https://learn.microsoft.com../../reusable-content/azure-cli/media/hdi-launch-cloud-shell.png)

If you prefer to run CLI reference commands locally, [install](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) the Azure CLI. If you're running on Windows or macOS, consider running Azure CLI in a Docker container. For more information, see [How to run the Azure CLI in a Docker container](https://learn.microsoft.com/en-us/cli/azure/run-azure-cli-docker).

If you're using a local installation, sign in to the Azure CLI by using the [az login](https://learn.microsoft.com/en-us/cli/azure/reference-index#az-login) command. To finish the authentication process, follow the steps displayed in your terminal. For other sign-in options, see [Authenticate to Azure using Azure CLI](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli).

When you're prompted, install the Azure CLI extension on first use. For more information about extensions, see [Use and manage extensions with the Azure CLI](https://learn.microsoft.com/en-us/cli/azure/azure-cli-extensions-overview).

Run [az version](https://learn.microsoft.com/en-us/cli/azure/reference-index?#az-version) to find the version and dependent libraries that are installed. To upgrade to the latest version, run [az upgrade](https://learn.microsoft.com/en-us/cli/azure/reference-index?#az-upgrade).

To add the [az logic integration-account](https://learn.microsoft.com/en-us/cli/azure/logic/integration-account) extension, use the [az extension add](https://learn.microsoft.com/en-us/cli/azure/extension#az-extension-add) command:

az extension add –-name logic

To create a resource group or use an existing resource group, run the [az group create](https://learn.microsoft.com/en-us/cli/azure/group#az-group-create) command:

az group create --name myresourcegroup --location westus

To list the integration accounts for a resource group, use the [az logic integration-account list](https://learn.microsoft.com/en-us/cli/azure/logic/integration-account#az-logic-integration-account-list) command:

az logic integration-account list --resource-group myresourcegroup

To create an integration account, run the [az logic integration-account create](https://learn.microsoft.com/en-us/cli/azure/logic/integration-account#az-logic-integration-account-create) command:

az logic integration-account create --resource-group myresourcegroup \
    --name integration_account_01 --location westus --sku Standard

Your integration account name can contain only letters, numbers, hyphens (-), underscores (_), parentheses (()), and periods (.).

To view a specific integration account, use the [az logic integration-account show](https://learn.microsoft.com/en-us/cli/azure/logic/integration-account#az-logic-integration-account-show) command:

az logic integration-account show --name integration_account_01 --resource-group myresourcegroup

You can change your SKU, or pricing tier, by using the [az logic integration-account update](https://learn.microsoft.com/en-us/cli/azure/logic/integration-account#az-logic-integration-account-update) command:

az logic integration-account update --sku name=Basic --name integration_account_01 \
    --resource-group myresourcegroup

For more information about pricing, see these resources:

- [Azure Logic Apps pricing model](../logic-apps-pricing#integration-accounts)
- [Azure Logic Apps limits and configuration](../logic-apps-limits-and-config#integration-account-limits)
- [Azure Logic Apps pricing](https://azure.microsoft.com/pricing/details/logic-apps/)

To import an integration account by using a JSON file, use the [az logic integration-account import](https://learn.microsoft.com/en-us/cli/azure/logic/integration-account#az-logic-integration-account-import) command:

az logic integration-account import --name integration_account_01 \
    --resource-group myresourcegroup --input-path integration.json

## Set up storage access for Premium integration account

To read artifacts and write any state information, your Premium integration account needs access to the selected and associated Azure storage account. Your integration account uses its automatically created and enabled system-assigned managed identity to authenticate access.

In the [Azure portal](https://portal.azure.com), open your Premium integration account.

On the integration account menu, under **Settings**, select **Identity**.

On the **System assigned** tab, which shows the enabled system-assigned managed identity, under **Permissions**, select **Azure role assignments**.

On the **Azure role assignments** toolbar, select **Add role assignment (Preview)**, provide the following information, select **Save**, and then repeat for each required role:

Parameter
Value
Description

**Scope**
**Storage**
For more information, see [Understand scope for Azure RBAC](../../role-based-access-control/scope-overview).

**Subscription**
<*Azure-subscription*>
The Azure subscription for the resource to access.

**Resource**
<*Azure-storage-account-name*>
The name for the Azure storage account to access. 

**Note** If you get an error that you don't have permissions to add role assignments at this scope, you need to get those permissions. For more information, see [Microsoft Entra built-in roles](../../active-directory/roles/permissions-reference).

**Role**
- **Storage Account Contributor** 

- **Storage Blob Data Contributor** 

- **Storage Table Data Contributor**
The roles that your Premium integration account requires to access your storage account.

For more information, see [Assign Azure role to system-assigned managed identity](https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal-managed-identity)

## Set up private endpoint for Premium integration account

To create a secure connection between your Premium integration account and Azure services, you can set up a [private endpoint](../../private-link/private-endpoint-overview) for your integration account. This endpoint is a network interface that uses a private IP address from your Azure virtual network. This way, traffic between your virtual network and Azure services stays on the Azure backbone network and never traverses the public internet. Private endpoints ensure a secure, private communication channel between your resources and Azure services by providing the following benefits:

Eliminates exposure to the public internet and reducing the risks from attacks.

Helps your organization meet data privacy and compliance requirements by keeping data within a controlled and secured environment.

Reduces latency and improve workflow performance by keeping traffic within the Azure backbone network.

Removes the need for complex network setups, such as virtual private networks or ExpressRoute.

Saves on costs by reducing extra network infrastructure and avoiding data egress charges through public endpoints.

### Best practices for private endpoints

Carefully plan your virtual network and subnet architecture to accommodate private endpoints. Make sure to properly segment and secure your subnets.

Make sure that your domain name system settings are up-to-date and correctly configured to handle name resolution for private endpoints.

Control traffic flow to and from your private endpoints and enforce strict security policies by using network security groups.

Thoroughly test your integration account's connectivity and performance to make sure that everything works as expected with private endpoints before you deploy to production.

Regularly monitor network traffic to and from your private endpoints. Audit and analyze traffic patterns by using tools such as Azure Monitor and Azure Security Center.

### Create a private endpoint

Before you start, make sure that you have an [Azure virtual network](../../virtual-network/quick-create-portal) defined with the appropriate subnets and network security groups to manage and secure traffic.

In the [Azure portal](https://portal.azure.com), in the search box, enter **private endpoint**, and then select **Private endpoints**.

On the **Private endpoints** page, select **Create**.

On the **Basics** tab, provide the following information:

Property
Value

**Subscription**
<*Azure-subscription*>

**Resource group**
<*Azure-resource-group*>

**Name**
<*private-endpoint*>

**Network interface name**
<*private-endpoint*>**-nic**

**Region**
<*Azure-region*>

On the **Resource** tab, provide the following information:

Property
Value

**Connection method**
- **Connect to an Azure resource in my directory**: Creates a private endpoint that is *automatically approved* and ready for immediate use. The endpoint's **Connection status** property is set to **Approved** after creation. 

- **Connect to an Azure resource by resource ID or alias**: Create a private endpoint that is *manually approved* and requires data administrator approval before anyone can use. The endpoint's **Connection status** property is set to **Pending** after creation. 

**Note**: If the endpoint is manually approved, the **DNS** tab is unavailable.

**Subscription**
<*Azure-subscription*>

**Resource type**
**Microsoft.Logic/integrationAccounts**

**Resource**
<*Premium-integration-account*>

**Target sub-resource**
**integrationAccount**

On the **Virtual Network** tab, specify the virtual network and subnet where to you want to create the endpoint:

Property
Value

**Virtual network**
<*virtual-network*>

**Subnet**
<*subnet-for-endpoint*>

Your virtual network uses a network interface attached to the private endpoint.

On the **DNS** tab, provide the following information to make sure your aps can resolve the private IP address for your integration account. You might have to set up a private DNS zone and link to your virtual network.

Property
Value

**Subscription**
<*Azure-subscription*>

**Resource group**
<*Azure-resource-group-for-private-DNS-zone*>

When you're done, confirm all the provided information, and select **Create**.

After you confirm that Azure created the private endpoint, check your connectivity and test your setup to make sure that the resources in your virtual network can securely connect to your integration account through the private endpoint.

### View pending endpoint connections

For a private endpoint that requires approval, follow these steps:

In the Azure portal, go to the **Private Link** page.

On the left menu, select **Pending connections**.

### Approve a pending private endpoint

For a private endpoint that requires approval, follow these steps:

In the Azure portal, go to the **Private Link** page.

On the left menu, select **Pending connections**.

Select the pending connection. On the toolbar, select **Approve**. Wait for the operation to finish.

The endpoint's **Connection status** property changes to **Approved**.

### Enable Standard logic app calls through private endpoint on Premium integration account

- Choose one of the following options:

To create a Standard logic app with virtual network integration, see [Create an example Standard logic app workflow in single-tenant Azure Logic Apps](../create-single-tenant-workflows-azure-portal).

To set up an existing Standard logic app with virtual network integration, see [Set up virtual network integration](../secure-single-tenant-workflow-virtual-network-private-endpoint#set-up-virtual-network-integration).

To make calls through the private endpoint, include an **HTTP** action in your Standard logic app workflow where you want to call the integration account.

In the Azure portal, go to your Premium integration account. On the integration account menu, under **Settings**, select **Callback URL**, and copy the URL.

In your workflow's **HTTP** action, on the **Parameters** tab, in the **URI** property, enter the callback URL using the following format:

**`https://{domain-name}-{integration-account-ID}.cy.integrationaccounts.microsoftazurelogicapps.net:443/integrationAccounts/{integration-account-ID}?api-version=2015-08-01-preview&sp={sp}&sv={sv}&sig={sig}`**

The following example shows sample values:

`https://prod-02-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.cy.integrationaccounts.microsoftazurelogicapps.net:443/integrationAccounts/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX?api-version=2015-08-01-preview&sp={sp}&sv={sv}&sig={sig}`

For the **HTTP** action's **Method** property, select **GET**.

Finish setting up the **HTTP** action as necessary, and test your workflow.

## Link to logic app

For you to successfully link your integration account to your logic app resource, make sure that both resources use the *same* Azure subscription and Azure region.

[Consumption](#tabpanel_2_consumption)

[Standard](#tabpanel_2_standard)

In the [Azure portal](https://portal.azure.com), open your logic app resource.

On your logic app's navigation menu, under **Settings**, select **Workflow settings**. Under **Integration account**, open the **Select an Integration account** list, and select the integration account you want.

![Screenshot shows Azure portal, integration account menu with open page named Workflow settings, and opened list named Select an Integration account.](https://learn.microsoft.commedia/create-integration-account/select-integration-account.png)

To finish linking, select **Save**.

![Screenshot shows page named Workflow settings, and selected Save option.](https://learn.microsoft.commedia/create-integration-account/save-link.png)

After your integration account is successfully linked, Azure shows a confirmation message.

![Screenshot shows Azure confirmation message.](https://learn.microsoft.commedia/create-integration-account/link-confirmation.png)

Now your logic app workflow can use the artifacts in your integration account plus the B2B connectors, such as XML validation and flat file encoding or decoding.

#### Find your integration account's callback URL

Before you can link your integration account to a Standard logic app resource, you need to have your integration account's **callback URL**.

In the [Azure portal](https://portal.azure.com) search box, enter **integration accounts**, and then select **Integration accounts**.

From the **Integration accounts** list, select your integration account.

On your selected integration account's navigation menu, under **Settings**, select **Callback URL**.

Find the **Generated Callback URL** property value, copy the value, and save the URL to use later for linking.

#### Link integration account to Standard logic app
Azure portal

In the [Azure portal](https://portal.azure.com), open your Standard logic app resource.

On your logic app's navigation menu, under **Settings**, select **Environment variables**.

On the **Environment variables** page, check whether the app setting named **WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL** exists.

If the app setting doesn't exist, at the end of the settings list, add a new app setting by entering the following:

Property
Value

**Name**
**WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL**

**Value**
<*integration-account-callback-URL*>

When you're done, select **Apply**.

Visual Studio Code

From your Standard logic app project in Visual Studio Code, open the **local.settings.json** file.

In the `Values` object, add an app setting that has the following properties and values, including the previously saved callback URL:

Property
Value

**Name**
**WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL**

**Value**
<*integration-account-callback-URL*>

This example shows how a sample app setting might appear:

{
    "IsEncrypted": false,
    "Values": {
        "AzureWebJobStorage": "UseDevelopmentStorage=true",
        "FUNCTIONS_WORKER_RUNTIME": "dotnet",
        "WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL": "https://prod-03.westus.logic.azure.com:443/integrationAccounts/...."
    }
}

When you're done, save your changes.

## Change pricing tier

To increase the [limits](../logic-apps-limits-and-config#integration-account-limits) for an integration account, you can [upgrade to a higher pricing tier](#upgrade-pricing-tier), if available. For example, you can upgrade from the Free tier to the Basic tier, Standard tier, or Premium tier. You can also [downgrade to a lower tier](#downgrade-pricing-tier), if available. For more information pricing information, review the following documentation:

- [Azure Logic Apps pricing](https://azure.microsoft.com/pricing/details/logic-apps/)
- [Azure Logic Apps pricing model](../logic-apps-pricing#integration-accounts)

### Upgrade pricing tier

To make this change, you can use either the Azure portal or the Azure CLI.

[Portal](#tabpanel_3_azure-portal)

[Azure CLI](#tabpanel_3_azure-cli)

In the [Azure portal](https://portal.azure.com) search box, enter **integration accounts**, and select **Integration accounts**.

Azure shows all the integration accounts in your Azure subscriptions.

Under **Integration accounts**, select the integration account that you want to move. On your integration account resource menu, select **Overview**.

![Screenshot shows Azure portal with integration account menu and selected Overview option.](https://learn.microsoft.commedia/create-integration-account/integration-account-overview.png)

On the **Overview** page, select **Upgrade Pricing Tier**, which lists any available higher tiers. When you select a tier, the change immediately takes effect.

![Screenshot shows integration account, Overview page, and selected option to Upgrade Pricing Tier.](https://learn.microsoft.commedia/create-integration-account/upgrade-pricing-tier.png)

If you haven't done so already, [install the Azure CLI prerequisites](https://learn.microsoft.com/en-us/cli/azure/get-started-with-azure-cli).

In the Azure portal, open the [Azure Cloud Shell](../../cloud-shell/overview) environment.

![Screenshot shows Azure portal toolbar with selected Cloud Shell options.](https://learn.microsoft.commedia/create-integration-account/open-azure-cloud-shell-window.png)

At the command prompt, enter the [**az resource** command](https://learn.microsoft.com/en-us/cli/azure/resource#az-resource-update), and set `skuName` to the higher tier that you want.

az resource update --resource-group {ResourceGroupName} --resource-type Microsoft.Logic/integrationAccounts --name {IntegrationAccountName} --subscription {AzureSubscriptionID} --set sku.name={SkuName}

For example, if you have the Basic tier, you can set `skuName` to `Standard`:

az resource update --resource-group FabrikamIntegration-RG --resource-type Microsoft.Logic/integrationAccounts --name Fabrikam-Integration --subscription XXXXXXXXXXXXXXXXX --set sku.name=Standard

### Downgrade pricing tier

To make this change, use the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/get-started-with-azure-cli).

If you haven't done so already, [install the Azure CLI prerequisites](https://learn.microsoft.com/en-us/cli/azure/get-started-with-azure-cli).

In the Azure portal, open the [Azure Cloud Shell](../../cloud-shell/overview) environment.

![Screenshot shows Azure portal toolbar with selected Cloud Shell.](https://learn.microsoft.commedia/create-integration-account/open-azure-cloud-shell-window.png)

At the command prompt, enter the [**az resource** command](https://learn.microsoft.com/en-us/cli/azure/resource#az-resource-update) and set `skuName` to the lower tier that you want.

az resource update --resource-group <resourceGroupName> --resource-type Microsoft.Logic/integrationAccounts --name <integrationAccountName> --subscription <AzureSubscriptionID> --set sku.name=<skuName>

For example, if you have the Standard tier, you can set `skuName` to `Basic`:

az resource update --resource-group FabrikamIntegration-RG --resource-type Microsoft.Logic/integrationAccounts --name Fabrikam-Integration --subscription XXXXXXXXXXXXXXXXX --set sku.name=Basic

## Unlink from logic app

[Consumption](#tabpanel_4_consumption)

[Standard](#tabpanel_4_standard)

If you want to link your logic app to another integration account, or no longer use an integration account with your logic app, delete the link by using Azure Resource Explorer.

Open your browser window, and go to [Azure Resource Explorer (https://resources.azure.com)](https://resources.azure.com). Sign in with the same Azure account credentials.

![Screenshot shows a web browser with Azure Resource Explorer.](https://learn.microsoft.commedia/create-integration-account/resource-explorer.png)

In the search box, enter your logic app's name to find and open your logic app.

![Screenshot shows explorer search box, which contains your logic app name.](https://learn.microsoft.commedia/create-integration-account/resource-explorer-find-logic-app.png)

On the explorer title bar, select **Read/Write**.

![Screenshot shows title bar with selected option for Read/Write.](https://learn.microsoft.commedia/create-integration-account/resource-explorer-select-read-write.png)

On the **Data** tab, select **Edit**.

![Screenshot shows Data tab with selected option for Edit.](https://learn.microsoft.commedia/create-integration-account/resource-explorer-select-edit.png)

In the editor, find the **integrationAccount** object, which has the following format, and delete the object:

{
   // <other-attributes>
   "integrationAccount": {
      "name": "<integration-account-name>",
      "id": "<integration-account-resource-ID>",
      "type": "Microsoft.Logic/integrationAccounts"  
   },
}

For example:

![Screenshot shows how to find the object named integrationAccount.](https://learn.microsoft.commedia/create-integration-account/resource-explorer-delete-integration-account.png)

On the **Data** tab, select **Put** to save your changes.

![Screenshot shows Data tab with Put selected.](https://learn.microsoft.commedia/create-integration-account/resource-explorer-save-changes.png)

In the Azure portal, open your logic app. On your logic app menu, under **Workflow settings**, confirm that the **Integration account** property now appears empty.

![Screenshot shows Azure portal, logic app menu, and selected Workflow settings.](https://learn.microsoft.commedia/create-integration-account/unlinked-account.png)

#### Azure portal

In the [Azure portal](https://portal.azure.com), open your Standard logic app resource.

On your logic app menu, under **Settings**, select **Environment variables**.

On the **Environment variables** page, find the app setting named **WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL**.

Clear the app setting name and its value.

When you're done, select **Apply**.

#### Visual Studio Code

From your Standard logic app project in Visual Studio Code, open the **local.settings.json** file.

In the `Values` object, find and delete the app setting that has the following properties and values:

Property
Value

**Name**
**WORKFLOW_INTEGRATION_ACCOUNT_CALLBACK_URL**

**Value**
<*integration-account-callback-URL*>

When you're done, save your changes.

## Move integration account

You can move your integration account to another Azure resource group or Azure subscription. When you move resources, Azure creates new resource IDs, so make sure that you use the new IDs instead and update any scripts or tools associated with the moved resources. If you want to change the subscription, you must also specify an existing or new resource group.

For this task, you can use either the Azure portal by following the steps in this section or the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/resource#az-resource-move).

In the [Azure portal](https://portal.azure.com) search box, enter **integration accounts**, and select **Integration accounts**.

Azure shows all the integration accounts in your Azure subscriptions.

Under **Integration accounts**, select the integration account that you want to move. On your integration account menu, select **Overview**.

On the **Overview** page, next to either **Resource group** or **Subscription name**, select **change**.

![Screenshot shows Azure portal, integration account, Overview page, and selected change option, which is next to Resource group or Subscription name.](https://learn.microsoft.commedia/create-integration-account/change-resource-group-subscription.png)

Select any related resources that you also want to move.

Based on your selection, follow these steps to change the resource group or subscription:

Resource group: From the **Resource group** list, select the destination resource group. Or, to create a different resource group, select **Create a new resource group**.

Subscription: From the **Subscription** list, select the destination subscription. From the **Resource group** list, select the destination resource group. Or, to create a different resource group, select **Create a new resource group**.

To acknowledge your understanding that any scripts or tools associated with the moved resources won't work until you update them with the new resource IDs, select the confirmation box, and then select **OK**.

After you finish, make sure that you update all scripts with the new resource IDs for your moved resources.

## Delete integration account

For this task, you can use either the Azure portal by following the steps in this section, [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/resource#az-resource-delete), or [Azure PowerShell](https://learn.microsoft.com/en-us/powershell/module/az.logicapp/remove-azintegrationaccount).

[Portal](#tabpanel_5_azure-portal)

[Azure CLI](#tabpanel_5_azure-cli)

In to the [Azure portal](https://portal.azure.com) search box, enter **integration accounts**, and select **Integration accounts**.

Azure shows all the integration accounts in your Azure subscriptions.

Under **Integration accounts**, select the integration account that you want to delete. On your integration account menu, select **Overview**.

![Screenshot shows Azure portal with integration accounts list and integration account menu with Overview selected.](https://learn.microsoft.commedia/create-integration-account/integration-account-overview.png)

On the **Overview** page, select **Delete**.

![Screenshot shows Overview page with Delete selected.](https://learn.microsoft.commedia/create-integration-account/delete-integration-account.png)

To confirm that you want to delete your integration account, select **Yes**.

![Screenshot shows confirmation box with Yes selected.](https://learn.microsoft.commedia/create-integration-account/confirm-delete.png)

You can delete an integration account by using the [az logic integration-account delete](https://learn.microsoft.com/en-us/cli/azure/logic/integration-account#az-logic-integration-account-delete) command:

az logic integration-account delete --name integration_account_01 --resource-group myresourcegroup

## Next steps

- [Create trading partners in your integration account](../logic-apps-enterprise-integration-partners)
- [Create agreements between partners in your integration account](../logic-apps-enterprise-integration-agreements)

					
		
	 
		
		
	
					
		
		
			
			## Feedback
			
				

					Was this page helpful?
				

				
					
						
							
						
						Yes
					
					
						
							
						
						No
					
					
						
							
								
							
							No
						
						
							

								Need help with this topic?
							

							

								Want to try using Ask Learn to clarify or guide you through this topic?
							

							
		
			
		
			
				
			
		
		
			
				
			
			Ask Learn
		
		
			
				
			
			Ask Learn
		
	
			
				
					
				
				 Suggest a fix? 
			
		
	
						
					
				
			
		
		
	
				
				
		
			
			
				Additional resources
			
			
		
	 
		
	 
		
	 
		
	
		
	 
		
			
			
				
			
				Last updated on 
		2025-09-05