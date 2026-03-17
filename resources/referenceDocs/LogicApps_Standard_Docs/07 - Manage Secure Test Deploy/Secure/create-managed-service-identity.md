<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/create-managed-service-identity -->

Applies to: **Azure Logic Apps (Consumption + Standard)**

If you want to avoid providing, storing, and managing credentials, secrets, or Microsoft Entra tokens, you can use a managed identity to authenticate access or connections from your logic app workflow to Microsoft Entra protected resources. In Azure Logic Apps, some connector operations support using a managed identity when you must authenticate access to resources protected by Microsoft Entra ID. Azure manages this identity and helps keep authentication information secure so that you don't have to manage this sensitive information. For more information, see [What are managed identities for Azure resources](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview)?

Azure Logic Apps supports the following managed identity types:

[System-assigned managed identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview#managed-identity-types)

[User-assigned managed identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview#managed-identity-types)

The following list describes some differences between these managed identity types:

A logic app resource can enable and use only one unique system-assigned identity.

A logic app resource can share the same user-assigned identity across a group of other logic app resources.

This guide shows how to complete the following tasks:

Enable and set up the system-assigned identity for your logic app resource. This guide provides an example that shows how to use the identity for authentication.

Create and set up a user-assigned identity. This guide shows how to create this identity using the Azure portal or an Azure Resource Manager template (ARM template) and how to use the identity for authentication. For Azure PowerShell, Azure CLI, and Azure REST API, see the following documentation:

Tool
Documentation

Azure PowerShell
[Create user-assigned identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-manage-user-assigned-managed-identities?pivots=identity-mi-methods-powershell)

Azure CLI
[Create user-assigned identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-manage-user-assigned-managed-identities?pivots=identity-mi-methods-azcli)

Azure REST API
[Create user-assigned identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-manage-user-assigned-managed-identities?pivots=identity-mi-methods-rest)

## Prerequisites

An Azure account and subscription. If you don't have a subscription, [sign up for a free Azure account](https://azure.microsoft.com/pricing/purchase-options/azure-account?cid=msft_learn). Both the managed identity and the target Azure resource where you need access must use the same Azure subscription.

The target Azure resource that you want to access. On this resource, you must add the necessary role for the managed identity to access that resource on your logic app's or connection's behalf. To add a role to a managed identity, you need [Microsoft Entra administrator permissions](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/permissions-reference) that can assign roles to the identities in the corresponding Microsoft Entra tenant.

The logic app resource and workflow where you want to use the [trigger or actions that support managed identities](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions).

## Managed identity differences between Consumption and Standard logic apps

Based on your logic app resource type, you can enable either the system-assigned identity, user-assigned identity, or both at the same time:

Logic app
Environment
Managed identity support

Consumption
- Multitenant Azure Logic Apps
- You can enable *either* the system-assigned identity or the user-assigned identity, but not both on your logic app. 

- You can use the managed identity at the logic app resource level and at the connection level. 

- If you create and enable the user-assigned identity, your logic app can have *only one* user-assigned identity at a time.

Standard
- Single-tenant Azure Logic Apps 

- App Service Environment v3 (ASEv3)
- You can enable *both* the system-assigned identity, which is enabled by default, and the user-assigned identity at the same time. You can also add multiple user-assigned identities to your logic app. However, your logic app can use only one managed identity at a time. 

- You can use the managed identity at the logic app resource level and at the connection level. 

**Note**: For hybrid deployment, managed identity authentication is currently unsupported. Instead, you must create and use an app registration. For more information, see [Create Standard logic app workflows for hybrid deployment on your own infrastructure](create-standard-workflows-hybrid-deployment).

For information about managed identity limits in Azure Logic Apps, see [Limits on managed identities for logic apps](logic-apps-limits-and-config#managed-identity). For more information about the Consumption and Standard logic app resource types and environments, see [Resource environment differences](logic-apps-overview#resource-environment-differences).

## Where you can use a managed identity

In Azure Logic Apps, only specific built-in and managed connector operations that support OAuth with Microsoft Entra ID can use a managed identity for authentication. The following tables provide only a sample selection. For a more complete list, see the following documentation:

[Authentication types for triggers and actions that support authentication](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions)

[Azure services that support managed identities for Azure resources](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/managed-identities-status)

[Azure services that support Microsoft Entra authentication](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/services-id-authentication-support)

[Consumption](#tabpanel_1_consumption)

[Standard](#tabpanel_1_standard)

For a Consumption logic app workflow, the following table lists example connectors that support managed identity authentication:

Connector type
Supported connectors

Built-in
- Azure API Management 
- Azure App Services 
- Azure Functions 
- HTTP 
- HTTP + Webhook 

**Note**: HTTP operations can authenticate connections to Azure Storage accounts behind Azure firewalls with the system-assigned identity. However, HTTP operations don't support the user-assigned identity for authenticating the same connections.

Managed
- Azure App Service 
- Azure Automation 
- Azure Blob Storage 
- Azure Container Instance 
- Azure Cosmos DB 
- Azure Data Explorer 
- Azure Data Factory 
- Azure Data Lake 
- Azure Digital Twins 
- Azure Event Grid 
- Azure Event Hubs 
- Azure IoT Central V2 
- Azure Key Vault 
-Azure Monitor Logs 
- Azure Queues 
- Azure Resource Manager 
- Azure Service Bus 
- Azure Sentinel 
- Azure Table Storage 
- Azure VM 
- SQL Server

For a Standard logic app workflow, the following table lists example connectors that support managed identity authentication:

Connector type
Supported connectors

Built-in
- Azure Automation 
- Azure Blob Storage 
- Azure Event Hubs 
- Azure Service Bus 
- Azure Queues 
- Azure Tables 
- HTTP 
- HTTP + Webhook 
- SQL Server 

**Note**: Except for the SQL Server and HTTP connectors, most [built-in, service provider-based connectors](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/) currently don't support selecting user-assigned identities for authentication. Instead, you must use the system-assigned identity. HTTP operations can authenticate connections to Azure Storage accounts behind Azure firewalls with the system-assigned identity.

Managed
- Azure App Service 
- Azure Automation 
- Azure Blob Storage 
- Azure Container Instance 
- Azure Cosmos DB 
- Azure Data Explorer 
- Azure Data Factory 
- Azure Data Lake 
- Azure Digital Twins 
- Azure Event Grid 
- Azure Event Hubs 
- Azure IoT Central V2 
- Azure Key Vault 
- Azure Monitor Logs 
- Azure Queues 
- Azure Resource Manager 
- Azure Service Bus 
- Azure Sentinel 
- Azure Table Storage 
- Azure VM 
- SQL Server

## Enable system-assigned identity in the Azure portal

[Consumption](#tabpanel_2_consumption)

[Standard](#tabpanel_2_standard)

On a Consumption logic app resource, you must manually enable the system-assigned identity.

In the [Azure portal](https://portal.azure.com), open your Consumption logic app resource.

On the logic app menu, under **Settings**, select **Identity**.

On the **Identity** page, under **System assigned**, select **On** > **Save**. When Azure prompts you to confirm, select **Yes**.

![Screenshot shows Azure portal, Consumption logic app, Identity page, and System assigned tab with selected options, On and Save.](https://learn.microsoft.commedia/authenticate-with-managed-identity/enable-system-assigned-identity-consumption.png)

Note

If you get an error that you can have only a single managed identity, your logic app resource is
already associated with the user-assigned identity. Before you can add the system-assigned identity,
you must first remove the user-assigned identity from your logic app resource.

Your logic app resource can now use the system-assigned identity. This identity is registered with Microsoft Entra ID and is represented by an object ID.

![Screenshot shows Consumption logic app, Identity page, and object ID for system-assigned identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/object-id-system-assigned-identity.png)

Property
Value
Description

**Object (principal) ID**
<*identity-resource-ID*>
A Globally Unique Identifier (GUID) that represents the system-assigned identity for your logic app in a Microsoft Entra tenant.

Now follow the [steps that give the system-assigned identity access to the resource](#access-other-resources) later in this guide.

On a Standard logic app resource, the system-assigned identity is automatically enabled. If you need to enable the identity, follow these steps:

In the [Azure portal](https://portal.azure.com), open your Standard logic app resource.

On the logic app menu, under **Settings**, select **Identity**.

On the **Identity** page, under **System assigned**, select **On** > **Save**. When Azure prompts you to confirm, select **Yes**.

![Screenshot shows Azure portal, Standard logic app, Identity page, and System assigned tab with selected options for On and Save.](https://learn.microsoft.commedia/authenticate-with-managed-identity/enable-system-assigned-identity-standard.png)

Your logic app resource can now use the system-assigned identity, which is registered with Microsoft Entra ID and is represented by an object ID.

![Screenshot shows Standard logic app, Identity page, and object ID for system-assigned identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/object-id-system-assigned-identity.png)

Property
Value
Description

**Object (principal) ID**
<*identity-resource-ID*>
A Globally Unique Identifier (GUID) that represents the system-assigned identity for your logic app in a Microsoft Entra tenant.

Now follow the [steps that give that identity access to the resource](#access-other-resources) later in this guide.

## Enable system-assigned identity in an ARM template

To automate creating and deploying logic app resources, you can use an [ARM template](logic-apps-azure-resource-manager-templates-overview). To enable the system-assigned identity for your logic app resource in the template, add the **identity** object and the **type** child property to the logic app's resource definition in the template, for example:

[Consumption](#tabpanel_3_consumption)

[Standard](#tabpanel_3_standard)

{
   "apiVersion": "2016-06-01",
   "type": "Microsoft.logic/workflows",
   "name": "[variables('logicappName')]",
   "location": "[resourceGroup().location]",
   "identity": {
      "type": "SystemAssigned"
   },
   "properties": {},
   <...>
}

{
   "apiVersion": "2021-01-15",
   "type": "Microsoft.Web/sites",
   "name": "[variables('sites_<logic-app-resource-name>_name')]",
   "location": "[resourceGroup().location]",
   "kind": "functionapp,workflowapp",
   "identity": {
      "type": "SystemAssigned"
   },
   "properties": {},
   <...>
}

When Azure creates your logic app resource definition, the **identity** object gets the following other properties:

"identity": {
   "type": "SystemAssigned",
   "principalId": "<principal-ID>",
   "tenantId": "<Entra-tenant-ID>"
}

Property (JSON)
Value
Description

**principalId**
<*principal-ID*>
The Globally Unique Identifier (GUID) of the service principal object for the managed identity that represents your logic app in the Microsoft Entra tenant. This GUID sometimes appears as an "object ID" or **objectID**.

**tenantId**
<*Microsoft-Entra-ID-tenant-ID*>
The Globally Unique Identifier (GUID) that represents the Microsoft Entra tenant where the logic app is now a member. Inside the Microsoft Entra tenant, the service principal has the same name as the logic app instance.

## Create user-assigned identity in the Azure portal

Before you can enable the user-assigned identity on a Consumption logic app resource or Standard logic app resource, you must create that identity as a separate Azure resource.

In the [Azure portal](https://portal.azure.com) search box, enter **managed identities**. From the results list, select **Managed Identities**.

![Screenshot shows Azure portal with selected option named Managed Identities.](https://learn.microsoft.commedia/authenticate-with-managed-identity/find-select-managed-identities.png)

On the **Managed Identities** page toolbar, select **Create**.

Provide information about your managed identity, and select **Review + Create**, for example:

![Screenshot shows page named Create User Assigned Managed Identity, with managed identity details.](https://learn.microsoft.commedia/authenticate-with-managed-identity/create-user-assigned-identity.png)

Property
Required
Value
Description

**Subscription**
Yes
<*Azure-subscription-name*>
The Azure subscription name

**Resource group**
Yes
<*Azure-resource-group-name*>
The Azure resource group name. Create a new group, or select an existing group. This example creates a new group named **fabrikam-managed-identities-RG**.

**Region**
Yes
<*Azure-region*>
The Azure region where to store information about your resource. This example uses **West US**.

**Name**
Yes
<*user-assigned-identity-name*>
The name to give your user-assigned identity. This example uses **Fabrikam-user-assigned-identity**.

After Azure validates the information, Azure creates your managed identity. Now you can add the user-assigned identity to your logic app resource.

## Add user-assigned identity to logic app in the Azure portal

[Consumption](#tabpanel_4_consumption)

[Standard](#tabpanel_4_standard)

In the Azure portal, open your Consumption logic app resource.

On the logic app menu, under **Settings**, select **Identity**.

On the **Identity** page, select **User assigned**, and then select **Add**.

![Screenshot shows Consumption logic app and Identity page with selected option for Add.](https://learn.microsoft.commedia/authenticate-with-managed-identity/add-user-assigned-identity-logic-app-consumption.png)

On the **Add user assigned managed identity** pane, follow these steps:

From the **Select a subscription** list, select your Azure subscription.

From the list that has *all* the managed identities in your subscription, select the user-assigned identity that you want. To filter the list, in the **User assigned managed identities** search box, enter the name for the identity or resource group.

![Screenshot shows Consumption logic app and selected user-assigned identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-user-assigned-identity.png)

When you're done, select **Add**.

Note

If you get an error that you can have only a single managed identity, your logic app
is already associated with the system-assigned identity. Before you can add the
user-assigned identity, you have to first disable the system-assigned identity.

Your logic app is now associated with the user-assigned identity.

![Screenshot shows Consumption logic app with associated user-assigned identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/added-user-assigned-identity-consumption.png)

Now follow the [steps that give the identity access to the resource](#access-other-resources) later in this guide.

In the Azure portal, open your Standard logic app resource.

On the logic app menu, under **Settings**, select **Identity**.

On the **Identity** page, select **User assigned**, and then select **Add**.

![Screenshot shows Standard logic app and Identity page with selected option for Add.](https://learn.microsoft.commedia/authenticate-with-managed-identity/add-user-assigned-identity-logic-app-standard.png)

On the **Add user assigned managed identity** pane, follow these steps:

From the **Select a subscription** list, select your Azure subscription.

From the list with *all* the managed identities in your subscription, select the user-assigned identity that you want. To filter the list, in the **User assigned managed identities** search box, enter the name for the identity or resource group.

![Screenshot shows Standard logic app and selected user-assigned identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-user-assigned-identity.png)

When you're done, select **Add**.

Your logic app is now associated with the user-assigned identity.

![Screenshot shows Standard logic app and associated user-assigned identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/added-user-assigned-identity-standard.png)

To have multiple user-assigned identities, repeat the same steps to add those identities.

Now follow the [steps that give the identity access to the resource](#access-other-resources) later in this guide.

## Create user-assigned identity in an ARM template

To automate creating and deploying logic app resources, you can use an [ARM template](logic-apps-azure-resource-manager-templates-overview). These templates support [user-assigned identities for authentication](https://learn.microsoft.com/en-us/azure/templates/microsoft.managedidentity/userassignedidentities?pivots=deployment-language-arm-template).

In your template's **resources** section, your logic app's resource definition requires the following items:

An **identity** object with the **type** property set to **UserAssigned**

A child **userAssignedIdentities** object that specifies the user-assigned resource and name

[Consumption](#tabpanel_5_consumption)

[Standard](#tabpanel_5_standard)

This example shows a Consumption logic app resource and workflow definition for an HTTP PUT request with a nonparameterized **identity** object. The response to the PUT request and subsequent GET operation also includes this **identity** object:

{
   "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
   "contentVersion": "1.0.0.0",
   "parameters": {<template-parameters>},
   "resources": [
      {
         "apiVersion": "2016-06-01",
         "type": "Microsoft.logic/workflows",
         "name": "[variables('logicappName')]",
         "location": "[resourceGroup().location]",
         "identity": {
            "type": "UserAssigned",
            "userAssignedIdentities": {
               "/subscriptions/<Azure-subscription-ID>/resourceGroups/<Azure-resource-group-name>/providers/Microsoft.ManagedIdentity/userAssignedIdentities/<user-assigned-identity-name>": {}
            }
         },
         "properties": {
            "definition": {<logic-app-workflow-definition>}
         },
         "parameters": {},
         "dependsOn": []
      },
   ],
   "outputs": {}
}

If your template also includes the managed identity's resource definition, you can parameterize the **identity** object. The following example shows how the child **userAssignedIdentities** object references a **userAssignedIdentityName** variable that you define in your template's **variables** section. This variable references the resource ID for your user-assigned identity.

{
   "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
   "contentVersion": "1.0.0.0",
   "parameters": {
      "Template_LogicAppName": {
         "type": "string"
      },
      "Template_UserAssignedIdentityName": {
         "type": "securestring"
      }
   },
   "variables": {
      "logicAppName": "[parameters('Template_LogicAppName')]",
      "userAssignedIdentityName": "[parameters('Template_UserAssignedIdentityName')]"
   },
   "resources": [
      {
         "apiVersion": "2016-06-01",
         "type": "Microsoft.logic/workflows",
         "name": "[variables('logicAppName')]",
         "location": "[resourceGroup().location]",
         "identity": {
            "type": "UserAssigned",
            "userAssignedIdentities": {
               "[resourceId('Microsoft.ManagedIdentity/userAssignedIdentities/', variables('userAssignedIdentityName'))]": {}
            }
         },
         "properties": {
            "definition": {<logic-app-workflow-definition>}
         },
         "parameters": {},
         "dependsOn": [
            "[resourceId('Microsoft.ManagedIdentity/userAssignedIdentities/', variables('userAssignedIdentityName'))]"
         ]
      },
      {
         "apiVersion": "2018-11-30",
         "type": "Microsoft.ManagedIdentity/userAssignedIdentities",
         "name": "[parameters('Template_UserAssignedIdentityName')]",
         "location": "[resourceGroup().location]",
         "properties": {}
      }
  ]
}

A Standard logic app resource can enable and have both the system-assigned identity and multiple user-assigned identities defined. The Standard logic app resource definition is based on the Azure Functions function app resource definition.

This example shows a Standard logic app resource and workflow definition that includes a nonparameterized **identity** object:

{
   "$schema": "https://schema.management.azure.com/schemas/2019-01-01/deploymentTemplate.json#",
   "contentVersion": "1.0.0.0",
   "parameters": {<template-parameters>},
   "resources": [
      {
         "apiVersion": "2021-02-01",
         "type": "Microsoft.Web/sites/functions",
         "name": "[variables('logicappName')]",
         "location": "[resourceGroup().location]",
         "identity": {
            "type": "UserAssigned",
            "userAssignedIdentities": {
               "/subscriptions/<Azure-subscription-ID>/resourceGroups/<Azure-resource-group-name>/providers/Microsoft.ManagedIdentity/userAssignedIdentities/<user-assigned-identity-name>": {}
            },
         },
         "properties": {
            "name": "[variables('appName')]",
            "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', variables('hostingPlanName'))]",
            "hostingEnvironment": "",
            "clientAffinityEnabled": false,
            "alwaysOn": true
         },
         "parameters": {},
         "dependsOn": []
      }
   ],
   "outputs": {}
}

If your template also includes the managed identity's resource definition, you can parameterize the **identity** object. The following example shows how the child **userAssignedIdentities** object references a **userAssignedIdentityName** variable that you define in your template's **variables** section. This variable references the resource ID for your user-assigned identity.

{
   "$schema": "https://schema.management.azure.com/schemas/2019-01-01/deploymentTemplate.json#",
   "contentVersion": "1.0.0.0",
   "parameters": {<template-parameters>},
   "resources": [
      {
         "apiVersion": "2021-02-01",
         "type": "Microsoft.Web/sites/functions",
         "name": "[variables('logicappName')]",
         "location": "[resourceGroup().location]",
         "identity": {
            "type": "UserAssigned",
            "userAssignedIdentities": {
               "[resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', variables('userAssignedIdentityName'))]": {}
            }
         },
         "properties": {
            "name": "[variables('appName')]",
            "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', variables('hostingPlanName'))]",
            "hostingEnvironment": "",
            "clientAffinityEnabled": false,
            "alwaysOn": true
         },
         "parameters": {},
         "dependsOn": [
            "[resourceId('Microsoft.Web/serverfarms', variables('hostingPlanName'))]",
            "[resourceId('Microsoft.ManagedIdentity/userAssignedIdentities/', variables('userAssignedIdentityName'))]"
         ]
      },
      {
         "apiVersion": "2018-11-30",
         "type": "Microsoft.ManagedIdentity/userAssignedIdentities",
         "name": "[parameters('Template_UserAssignedIdentityName')]",
         "location": "[resourceGroup().location]",
         "properties": {}
      },
   ],
   "outputs": {}
}

When the template creates a logic app resource, the **identity** object includes the following properties:

"identity": {
    "type": "UserAssigned",
    "userAssignedIdentities": {
        "<resource-ID>": {
            "principalId": "<principal-ID>",
            "clientId": "<client-ID>"
        }
    }
}

The **principalId** property value is a unique identifier for the identity that's used for Microsoft Entra administration. The **clientId** property value is a unique identifier for the logic app's new identity that's used for specifying which identity to use during runtime calls. For more information about Azure Resource Manager templates and managed identities for Azure Functions, see the following documentation:

[ARM template - Azure Functions](../azure-functions/functions-create-first-function-resource-manager#review-the-template)

[Add a user-assigned identity using an ARM template for Azure Functions](../app-service/overview-managed-identity?tabs=arm,http#add-a-user-assigned-identity).

## Give identity access to resources

Before you can use your logic app's managed identity for authentication, you have to set up access for the identity on the target Azure resource where you want to use the identity. The way that you set up access varies based on the target resource.

Note

When a managed identity has access to an Azure resource in the same subscription, the identity can
access only that resource. However, in some triggers and actions that support managed identities,
you have to first select the Azure resource group that contains the target resource. If the identity
doesn't have access at the resource group level, no resources in that group are listed, despite having
access to the target resource.

To handle this behavior, you must also give the identity access to the resource group, not just
the resource. Likewise, if you have to select your subscription before you can select the
target resource, you must give the identity access to the subscription.

In some cases, you might need the identity to get access to the associated resource. For example,
suppose you have a managed identity for a logic app that needs access to update the application
settings for that same logic app from a workflow. You must give that identity access to the associated logic app.

For example, to use a managed identity for authenticating access to a Blob storage account or key vault in Azure, you need to set up Azure role-based access control (Azure RBAC) and assign the appropriate role for that identity to the storage account or key vault, respectively.

The steps in this section describe how to assign role-based access using the [Azure portal](#azure-portal-assign-role) and [Azure Resource Manager template (ARM template)](../role-based-access-control/role-assignments-template). For Azure PowerShell, Azure CLI, and Azure REST API, see the following documentation:

Tool
Documentation

Azure PowerShell
[Add role assignment](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-assign-app-role-managed-identity-powershell)

Azure CLI
[Add role assignment](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-assign-app-role-managed-identity-cli)

Azure REST API
[Add role assignment](../role-based-access-control/role-assignments-rest)

For Azure Key Vault, you also have the option to create an access policy for your managed identity on your key vault and assign the appropriate permissions for that identity on that key vault. The later steps in this section describe how to complete this task by using the [Azure portal](#azure-portal-access-policy). For Resource Manager templates, PowerShell, and Azure CLI, see the following documentation:

Tool
Documentation

Azure Resource Manager template (ARM template)
[Key Vault access policy resource definition](https://learn.microsoft.com/en-us/azure/templates/microsoft.keyvault/vaults)

Azure PowerShell
[Assign a Key Vault access policy](https://learn.microsoft.com/en-us/azure/key-vault/general/assign-access-policy?tabs=azure-powershell)

Azure CLI
[Assign a Key Vault access policy](https://learn.microsoft.com/en-us/azure/key-vault/general/assign-access-policy?tabs=azure-cli)

### Assign role-based access to a managed identity using the Azure portal

To use a managed identity for authentication, some Azure resources, such as Azure storage accounts, require that you assign that identity to a role that has the appropriate permissions on the target resource. Other Azure resources, such as key vaults, support multiple options. You can choose either role-based access or an [access policy that has the appropriate permissions on the target resource for that identity](#azure-portal-access-policy).

In the [Azure portal](https://portal.azure.com), open the resource where you want to use the identity.

On the resource menu, select **Access control (IAM)** > **Add** > **Add role assignment**.

Note

If the **Add role assignment** option is disabled, you don't have permissions to assign roles.
For more information, see [Microsoft Entra built-in roles](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/permissions-reference).

Assign the necessary role to your managed identity. On the **Role** tab, assign a role that gives your identity the required access to the current resource.

For this example, assign the role that's named **Storage Blob Data Contributor**, which includes write access for blobs in an Azure Storage container. For more information about specific storage container roles, see [Roles that can access blobs in an Azure Storage container](../storage/blobs/authorize-access-azure-active-directory#assign-azure-roles-for-access-rights).

Next, choose the managed identity where you want to assign the role. Under **Assign access to**, select **Managed identity** > **Add members**.

Based on your managed identity's type, select or provide the following values:

Type
Azure service instance
Subscription
Member

**System-assigned**
**Logic App**
<*Azure-subscription-name*>
<*your-logic-app-name*>

**User-assigned**
Not applicable
<*Azure-subscription-name*>
<*your-user-assigned-identity-name*>

For more information about assigning roles, see [Assign roles using the Azure portal](https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal).

After you're done, you can use the identity to [authenticate access for triggers and actions that support managed identities](#authenticate-access-with-identity).

For more general information about this task, see [Assign a managed identity access to an Azure resource or another resource](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-assign-access-azure-resource).

### Create an access policy using the Azure portal

To use a managed identity for authentication, other Azure resources also support or require that you create an access policy that has the appropriate permissions on the target resource for that identity. Other Azure resources, such as Azure storage accounts, instead require that you [assign that identity to a role that has the appropriate permissions on the target resource](#azure-portal-assign-role).

In the [Azure portal](https://portal.azure.com), open the target resource where you want to use the identity.

This example uses a key vault as the target Azure resource.

On the resource menu, select **Access policies** > **Create**, which opens the **Create an access policy** pane.

Note

If the resource doesn't have the **Access policies** option, [try assigning a role assignment instead](#azure-portal-assign-role).

![Screenshot shows Azure portal and key vault example with open pane named Access policies.](https://learn.microsoft.commedia/authenticate-with-managed-identity/create-access-policy.png)

On the **Permissions** tab, select the required permissions that the identity needs to access the target resource.

For example, to use the identity with the Azure Key Vault managed connector's **List secrets** operation, the identity needs **List** permissions. So, in the **Secret permissions** column, select **List**.

![Screenshot shows Permissions tab with selected List permissions.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-access-policy-permissions.png)

When you're ready, select **Next**. On the **Principal** tab, find and select the managed identity, which is a user-assigned identity in this example.

Skip the optional **Application** step, select **Next**, and finish creating the access policy.

The next section shows how to use a managed identity with a trigger or action to authenticate access. The example continues with the steps from an earlier section where you set up access for a managed identity using RBAC and an Azure storage account as the example. However, the general steps to use a managed identity for authentication are the same.

## Authenticate access with managed identity

After you [enable the managed identity for your logic app resource](#azure-portal-system-logic-app) and [give that identity access to the Azure target resource or service](#access-other-resources), you can use that identity in [triggers and actions that support managed identities](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions).

Important

If you have an Azure function where you want to use the system-assigned identity,
first [enable authentication for Azure Functions](call-azure-functions-from-workflows#enable-authentication-functions).

The following steps show how to use the managed identity with a trigger or action using the Azure portal. To specify the managed identity in a trigger or action's underlying JSON definition, see [Managed identity authentication](logic-apps-securing-a-logic-app#managed-identity-authentication).

[Consumption](#tabpanel_6_consumption)

[Standard](#tabpanel_6_standard)

In the [Azure portal](https://portal.azure.com), open your Consumption logic app resource.

If you haven't done so yet, add the [trigger or action that supports managed identities](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions).

Note

Not all connector operations support letting you add an authentication type. For more information, see
[Authentication types for triggers and actions that support authentication](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions).

On the trigger or action that you added, follow these steps:

**Built-in connector operations that support managed identity authentication**

These steps continue by using the **HTTP** action as an example.

From the **Advanced parameters** list, add the **Authentication** property, if the property doesn't already appear.

![Screenshot shows Consumption workflow with built-in action and opened list named Advanced parameters, with selected option for Authentication.](https://learn.microsoft.commedia/authenticate-with-managed-identity/built-in-authentication-consumption.png)

Now, both the **Authentication** property and the **Authentication Type** list appear on the action.

![Screenshot shows advanced parameters section with added Authentication property and Authentication Type list.](https://learn.microsoft.commedia/authenticate-with-managed-identity/authentication-parameter.png)

From the **Authentication Type** list, select **Managed Identity**.

![Screenshot shows Consumption workflow with built-in action, opened Authentication Type list, and selected option for Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/built-in-managed-identity-consumption.png)

The **Authentication** section now shows the following options:

A **Managed Identity** list from where you can select a specific managed identity

The **Audience** property appears on specific triggers and actions so that you can set the resource ID for the Azure target resource or service. Otherwise, by default, the **Audience** property uses the **`https://management.azure.com/`** resource ID, which is the resource ID for Azure Resource Manager.

From the **Managed Identity** list, select the identity that you want to use, for example:

![Screenshot shows Authentication section with Authentication Type list and Audience property.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-specific-managed-identity-consumption.png)

Note

The default selected option is the **System-assigned managed identity**,
even when you don't have any managed identities enabled.

To successfully use a managed identity, you must first enable that identity on your
logic app. On a Consumption logic app, you can have either the system-assigned or
user-assigned managed identity, but not both.

For more information, see [Example: Authenticate built-in trigger or action with a managed identity](#authenticate-built-in-managed-identity).

**Managed connector operations that support managed identity authentication**

On the **Create Connection** pane, from the **Authentication** list, select **Managed Identity**, for example:

![Screenshot shows Consumption workflow with Azure Resource Manager action and selected option for Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-managed-identity-consumption.png)

On the next pane, for **Connection Name**, provide a name to use for the connection.

For the authentication type, choose one of the following options based on your managed connector:

**Single-authentication**: These connectors support only one authentication type, which is the managed identity in this case.

From the **Managed Identity** list, select the currently enabled managed identity.

When you're ready, select **Create New**.

**Multi-authentication**: These connectors support multiple authentication types, but you can select and use only one type at a time.

These steps continue by using an **Azure Blob Storage** action as an example.

From the **Authentication Type** list, select **Logic Apps Managed Identity**.

![Screenshot shows Consumption workflow, connection creation box, and selected option for Logic Apps Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/multi-system-identity-consumption.png)

When you're ready, select **Create New**.

For more information, see [Example: Authenticate managed connector trigger or action with a managed identity](#authenticate-managed-connector-managed-identity).

In the [Azure portal](https://portal.azure.com), open your Standard logic app resource.

If you haven't done so yet, add the [trigger or action that supports managed identities](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions).

Note

Not all triggers and actions support letting you add an authentication type. For more information, see
[Authentication types for triggers and actions that support authentication](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions).

On the trigger or action that you added, follow these steps:

**Built-in operations that support managed identity authentication**

These steps continue by using the **HTTP** action as an example.

From the **Advanced parameters** list, add the **Authentication** property, if the property doesn't already appear.

![Screenshot shows Standard workflow, example built-in action, opened list named Add new parameter, and selected option for Authentication.](https://learn.microsoft.commedia/authenticate-with-managed-identity/built-in-authentication-standard.png)

Now, both the **Authentication** property and the **Authentication Type** list appear on the action.

![Screenshot shows advanced parameters section with added Authentication property and Authentication Type list.](https://learn.microsoft.commedia/authenticate-with-managed-identity/authentication-parameter.png)

From the **Authentication Type** list, select **Managed Identity**.

![Screenshot shows Standard workflow, example built-in action, opened Authentication Type list, and selected option for Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/built-in-managed-identity-standard.png)

The **Authentication** section now shows the following options:

A **Managed Identity** list from where you can select a specific managed identity

The **Audience** property appears on specific triggers and actions so that you can set the resource ID for the Azure target resource or service. Otherwise, by default, the **Audience** property uses the **`https://management.azure.com/`** resource ID, which is the resource ID for Azure Resource Manager.

![Screenshot shows Authentication section with Authentication Type list and Audience property.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-specific-managed-identity-standard.png)

From the **Managed Identity** list, select the identity that you want to use, for example:

![Screenshot shows Standard workflow, example built-in action, and selected managed identity selected to use.](https://learn.microsoft.commedia/authenticate-with-managed-identity/built-in-select-identity-standard.png)

Note

The default selected option is the **System-assigned managed identity**,
even when you don't have any managed identities enabled.

To successfully use a managed identity, you must first enable that identity on your
logic app. On a Standard logic app, you can have both the system-assigned and
user-assigned managed identity defined and enabled. However, your logic app should
use only one managed identity at a time.

For example, a workflow that accesses different Azure Service Bus messaging entities
should use only one managed identity. See [Connect to Azure Service Bus from workflows](../connectors/connectors-create-api-servicebus#prerequisites).

For more information, see [Example: Authenticate built-in trigger or action with a managed identity](#authenticate-built-in-managed-identity).

**Managed connector operations that support managed identity authentication**

On the **Create Connection** pane, from the **Authentication** list, select **Managed Identity**, for example:

![Screenshot shows Standard workflow, Azure Resource Manager action, and selected option for Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-managed-identity-option-standard.png)

On the next pane, for **Connection Name**, provide a name to use for the connection.

For the authentication type, choose one of the following options based on your managed connector:

**Single-authentication**: These connectors support only one authentication type, which is the managed identity in this case.

From the **Managed Identity** list, select the currently enabled managed identity.

When you're ready, select **Create New**.

**Multi-authentication**: These connectors support multiple authentication types, but you can select and use only one type at a time.

These steps continue by using an **Azure Blob Storage** action as an example.

From the **Authentication Type** list, select **Logic Apps Managed Identity**.

![Screenshot shows Standard workflow, connection name pane, and selected option for Logic Apps Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/multi-identity-standard.png)

From the **Managed identity** list, select the identity that you want to use.

![Screenshot shows Standard workflow, the action's Parameters pane, and list named Managed identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-multi-identity-standard.png)

When you're ready, select **Create New**.

For more information, see [Example: Authenticate managed connector trigger or action with a managed identity](#authenticate-managed-connector-managed-identity).

## Example: Authenticate built-in trigger or action with a managed identity

The built-in HTTP trigger or action can use the system-assigned identity that you enable on your logic app resource. In general, the HTTP trigger or action uses the following properties to specify the resource or entity that you want to access:

Property
Required
Description

**Method**
Yes
The HTTP method that's used by the operation that you want to run

**URI**
Yes
The endpoint URL for accessing the target Azure resource or entity. The URI syntax usually includes the resource ID for the target Azure resource or service.

**Headers**
No
Any header values that you need or want to include in the outgoing request, such as the content type

**Queries**
No
Any query parameters that you need or want to include in the request. For example, query parameters for a specific operation or for the API version of the operation that you want to run.

**Authentication**
Yes
The authentication type to use for authenticating access to the Azure target resource or service

As a specific example, suppose that you want to run the [Snapshot Blob operation](https://learn.microsoft.com/en-us/rest/api/storageservices/snapshot-blob) on a blob in the Azure Storage account where you previously set up access for your identity. However, the [Azure Blob Storage connector](https://learn.microsoft.com/en-us/connectors/azureblob/) doesn't currently offer this operation. Instead, you can run this operation by using the [HTTP action](logic-apps-workflow-actions-triggers#http-action) or another [Blob Service REST API operation](https://learn.microsoft.com/en-us/rest/api/storageservices/operations-on-blobs).

Important

To access Azure storage accounts behind firewalls by using the Azure Blob Storage connector
and managed identities, make sure that you also set up your storage account with the
[exception that allows access by trusted Microsoft services](../connectors/connectors-create-api-azureblobstorage#access-blob-storage-in-same-region-with-system-managed-identities).

To run the [Snapshot Blob operation](https://learn.microsoft.com/en-us/rest/api/storageservices/snapshot-blob), the HTTP action specifies the following properties:

Property
Required
Example value
Description

**URI**
Yes
`https://<storage-account-name>/<folder-name>/{name}`
The resource ID for an Azure Blob Storage file in the Azure Global (public) environment, which uses this syntax

**Method**
Yes
`PUT`
The HTTP method that the Snapshot Blob operation uses

**Headers**
For Azure Storage
`x-ms-blob-type` = `BlockBlob` 

`x-ms-version` = `2024-05-05` 

`x-ms-date` = `formatDateTime(utcNow(),'r')`
The `x-ms-blob-type`, `x-ms-version`, and `x-ms-date` header values are required for Azure Storage operations. 

**Important**: In outgoing HTTP trigger and action requests for Azure Storage, the header requires the `x-ms-version` property and the API version for the operation that you want to run. The `x-ms-date` must be the current date. Otherwise, your workflow fails with a `403 FORBIDDEN` error. To get the current date in the required format, you can use the expression in the example value. 

For more information, see the following documentation: 

- [Request headers - Snapshot Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/snapshot-blob#request) 
- [Versioning for Azure Storage services](https://learn.microsoft.com/en-us/rest/api/storageservices/versioning-for-the-azure-storage-services#specifying-service-versions-in-requests)

**Queries**
Only for the Snapshot Blob operation
`comp` = `snapshot`
The query parameter name and value for the operation.

[Consumption](#tabpanel_7_consumption)

[Standard](#tabpanel_7_standard)

On the workflow designer, add any trigger you want, and then add the **HTTP** action.

The following example shows a sample HTTP action with all the previously described property values to use for the Snapshot Blob operation:

![Screenshot shows Azure portal, Consumption workflow, and HTTP action set up to access resources.](https://learn.microsoft.commedia/authenticate-with-managed-identity/http-action-example-consumption.png)

In the **HTTP** action, add the **Authentication** property. From the **Advanced parameters** list, select **Authentication**.

![Screenshot shows Consumption workflow with HTTP action and opened Advanced parameters list with selected property named Authentication.](https://learn.microsoft.commedia/authenticate-with-managed-identity/add-authentication-property.png)

The **Authentication** section now appears in your **HTTP** action.

Note

Not all triggers and actions support letting you add an authentication type. For more information,
see [Authentication types for triggers and actions that support authentication](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions).

From the **Authentication Type** list, select **Managed Identity**.

![Screenshot shows Consumption workflow, HTTP action, and Authentication Type property with selected option for Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-managed-identity.png)

From the **Managed Identity** list, select from the available options based on your scenario.

If you set up the system-assigned identity, select **System-assigned managed identity**.

![Screenshot shows Consumption workflow, HTTP action, and Managed Identity property with selected option for System-assigned managed identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-system-assigned-identity-example.png)

If you set up the user-assigned identity, select that identity.

![Screenshot shows Consumption workflow, HTTP action, and Managed Identity property with selected user-assigned identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-user-assigned-identity-example.png)

This example continues with the **System-assigned managed identity**.

On some triggers and actions, the **Audience** property appears so that you can set the resource ID for the target Azure resource or service.

For example, to authenticate access to a [Key Vault resource in the global Azure cloud](https://learn.microsoft.com/en-us/azure/key-vault/general/authentication), you must set the **Audience** property to *exactly* the following resource ID: **`https://vault.azure.net`**

If you don't set the **Audience** property, by default, the **Audience** property uses the **`https://management.azure.com/`** resource ID, which is the resource ID for Azure Resource Manager.

Important

Make sure that the target resource ID *exactly matches* the value that Microsoft Entra ID expects.
Otherwise, you might get either a **`400 Bad Request`** error or a **`401 Unauthorized`** error. So, if
the resource ID includes any trailing slashes, make sure to include them. Otherwise, don't include
them.

For example, the resource ID for all Azure Blob Storage accounts requires a trailing slash. However,
the resource ID for a specific storage account doesn't require a trailing slash. Check the
resource IDs for the [Azure services that support Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/services-id-authentication-support).

This example sets the **Audience** property to **`https://storage.azure.com/`** so that the access tokens used for authentication are valid for all storage accounts. However, you can also specify the root service URL, **`https://<your-storage-account>.blob.core.windows.net`**, for a specific storage account.

![Screenshot shows Consumption workflow and HTTP action with Audience property set to target resource ID.](https://learn.microsoft.commedia/authenticate-with-managed-identity/set-audience-url-target-resource.png)

For more information about authorizing access with Microsoft Entra ID for Azure Storage, see the following documentation:

[Authorize access to Azure blobs and queues by using Microsoft Entra ID](../storage/blobs/authorize-access-azure-active-directory)

[Authorize access to Azure Storage with OAuth](https://learn.microsoft.com/en-us/rest/api/storageservices/authorize-with-azure-active-directory#use-oauth-access-tokens-for-authentication)

Continue building the workflow the way that you want.

On the workflow designer, add any trigger you want, and then add the **HTTP** action.

The following example shows a sample HTTP action with all the previously described property values to use for the Snapshot Blob operation:

![Screenshot shows Azure portal, Standard workflow, and HTTP action set up to access resources.](https://learn.microsoft.commedia/authenticate-with-managed-identity/http-action-example-standard.png)

In the **HTTP** action, add the **Authentication** property. From the **Advanced parameters** list, select **Authentication**.

![Screenshot shows Standard workflow and HTTP action with opened Advanced parameters list and selected property named Authentication.](https://learn.microsoft.commedia/authenticate-with-managed-identity/add-authentication-property.png)

The **Authentication** section now appears in your **HTTP** action.

Note

Not all triggers and actions support letting you add an authentication type. For more information, see
[Authentication types for triggers and actions that support authentication](logic-apps-securing-a-logic-app#authentication-types-supported-triggers-actions).

From the **Authentication type** list, select **Managed Identity**.

![Screenshot shows Standard workflow, HTTP action, and Authentication property with selected option for Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-managed-identity.png)

From the **Managed Identity** list, select from the available options based on your scenario.

If you set up the system-assigned identity, select **System-assigned managed identity**.

![Screenshot shows Standard workflow, HTTP action, and Managed Identity property with selected option for System-assigned managed identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-system-assigned-identity-example.png)

If you set up a user-assigned identity, select that identity.

![Screenshot shows Standard workflow, HTTP action, and Managed Identity property with selected user-assigned identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-user-assigned-identity-example.png)

This example continues with the **System-assigned managed identity**.

On some triggers and actions, the **Audience** property appears so that you can set the resource ID for the target Azure resource or service.

For example, to [authenticate access to a Key Vault resource in the global Azure cloud](https://learn.microsoft.com/en-us/azure/key-vault/general/authentication), you must set the **Audience** property to *exactly* the following resource ID: **`https://vault.azure.net`**

If you don't set the **Audience** property, by default, the **Audience** property uses the **`https://management.azure.com/`** resource ID, which is the resource ID for Azure Resource Manager.

Important

Make sure that the target resource ID *exactly matches* the value that Microsoft Entra ID expects.
Otherwise, you might get either a **`400 Bad Request`** error or a **`401 Unauthorized`** error. So, if
the resource ID includes any trailing slashes, make sure to include them. Otherwise, don't include
them.

For example, the resource ID for all Azure Blob Storage accounts requires a trailing slash. However,
the resource ID for a specific storage account doesn't require a trailing slash. Check the
resource IDs for the [Azure services that support Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/services-id-authentication-support).

This example sets the **Audience** property to **`https://storage.azure.com/`** so that the access tokens used for authentication are valid for all storage accounts. However, you can also specify the root service URL, **`https://<your-storage-account>.blob.core.windows.net`**, for a specific storage account.

![Screenshot shows Standard workflow and HTTP action with Audience property set to target resource ID.](https://learn.microsoft.commedia/authenticate-with-managed-identity/set-audience-url-target-resource.png)

For more information about authorizing access with Microsoft Entra ID for Azure Storage, see the following documentation:

[Authorize access to Azure blobs and queues by using Microsoft Entra ID](../storage/blobs/authorize-access-azure-active-directory)

[Authorize access to Azure Storage with OAuth](https://learn.microsoft.com/en-us/rest/api/storageservices/authorize-with-azure-active-directory#use-oauth-access-tokens-for-authentication)

Continue building the workflow the way that you want.

## Example: Authenticate managed connector trigger or action with a managed identity

The **Azure Resource Manager** managed connector has an action named **Read a resource**, which can use the managed identity that you enable on your logic app resource. This example shows how to use the system-assigned managed identity with a managed connector.

[Consumption](#tabpanel_8_consumption)

[Standard](#tabpanel_8_standard)

On the workflow designer, add the **Azure Resource Manager** action named **Read a resource**.

On the **Create Connection** pane, from the **Authentication** list, select **Managed Identity**, and then select **Sign in**.

Note

In other connectors, the **Authentication Type** list shows
**Logic Apps Managed Identity** instead, so select this option.

![Screenshot shows Consumption workflow, Azure Resource Manager action, opened Authentication list, and selected option for Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-managed-identity-consumption.png)

Provide a name for the connection, and select the managed identity that you want to use.

If you enabled the system-assigned identity, the **Managed identity** list automatically selects **System-assigned managed identity**. If you enabled a user-assigned identity instead, the list automatically selects the user-assigned identity.

In this example, **System-assigned managed identity** is the only selection available.

![Screenshot shows Consumption workflow and Azure Resource Manager action with connection name entered and selected option for System-assigned managed identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/connection-azure-resource-manager-consumption.png)

Note

If the managed identity isn't enabled when you try to create or change the connection, or if
the managed identity was removed while a managed identity-enabled connection still exists,
you get an error that says you must enable the identity and grant access to the target resource.

When you're ready, select **Create New**.

After the designer successfully creates the connection, the designer can fetch any dynamic values, content, or schema by using managed identity authentication.

Continue building the workflow the way that you want.

On the workflow designer, add the **Azure Resource Manager** action named **Read a resource**.

On the **Create Connection** pane, from the **Authentication** list, select **Managed Identity**, and then select **Sign in**.

Note

In other connectors, the **Authentication Type** list shows
**Logic Apps Managed Identity** instead, so select this option.

![Screenshot shows Standard workflow, Azure Resource Manager action, opened Authentication list, and selected option for Managed Identity.](https://learn.microsoft.commedia/authenticate-with-managed-identity/select-managed-identity-standard.png)

Provide a name for the connection, and select the managed identity that you want to use.

By default, Standard logic app resources automatically have the system-assigned identity enabled. So, the **Managed identity** list automatically selects **System-assigned managed identity**. If you also enabled one or more user-assigned identities, the **Managed identity** list shows all the currently enabled managed identities, for example:

![Screenshot shows Standard workflow and Azure Resource Manager action with connection name and all enabled managed identities.](https://learn.microsoft.commedia/authenticate-with-managed-identity/connection-azure-resource-manager-standard.png)

Note

If the managed identity isn't enabled when you try to create or change the connection, or if
the managed identity was removed while a managed identity-enabled connection still exists,
you get an error that says you must enable the identity and grant access to the target resource.

When you're ready, select **Create New**.

After the designer successfully creates the connection, the designer can fetch any dynamic values, content, or schema by using managed identity authentication.

Continue building the workflow the way that you want.

## Logic app resource definition and connections that use a managed identity

A connection that enables and uses a managed identity is a special connection type that works only with a managed identity. At runtime, the connection uses the managed identity that's enabled on the logic app resource. Azure Logic Apps checks whether any managed connector operations in the workflow are set up to use the managed identity and that all the required permissions exist to use the managed identity for accessing the target resources specified by the connector operations. If this check is successful, Azure Logic Apps retrieves the Microsoft Entra token that's associated with the managed identity, uses that identity to authenticate access to the target Azure resource, and performs the configured operations in the workflow.

[Consumption](#tabpanel_9_consumption)

[Standard](#tabpanel_9_standard)

In a Consumption logic app resource, the connection configuration is saved in the resource definition's **`parameters`** object, which contains the **`$connections`** object that includes pointers to the connection's resource ID along with the managed identity's resource ID when the user-assigned identity is enabled.

This example shows the **`parameters`** object configuration when the logic app enables the *system-assigned* identity:

"parameters": {
   "$connections": {
      "value": {
         "<action-name>": {
            "connectionId": "/subscriptions/<Azure-subscription-ID>/resourceGroups/<resource-group-name>/providers/Microsoft.Web/connections/<connector-name>",
            "connectionName": "<connector-name>",
            "connectionProperties": {
               "authentication": {
                  "type": "ManagedServiceIdentity"
               }
            },
            "id": "/subscriptions/<Azure-subscription-ID>/providers/Microsoft.Web/locations/<Azure-region>/managedApis/<managed-connector-type>"
         }
      }
   }
}

This example shows the **`parameters`** object configuration when the logic app enables the *user-assigned* managed identity:

"parameters": {
   "$connections": {
      "value": {
         "<action-name>": {
            "connectionId": "/subscriptions/<Azure-subscription-ID>/resourceGroups/<resource-group-name>/providers/Microsoft.Web/connections/<connector-name>",
            "connectionName": "<connector-name>",
            "connectionProperties": {
               "authentication": {
                  "type": "ManagedServiceIdentity",
                  "identity": "/subscriptions/<Azure-subscription-ID>/resourceGroups/<resource-group-name>/providers/microsoft.managedidentity/userassignedidentities/<managed-identity-name>"
               }
            },
            "id": "/subscriptions/<Azure-subscription-ID>/providers/Microsoft.Web/locations/<Azure-region>/managedApis/<managed-connector-type>"
         }
      }
   }
}

In a Standard logic app resource, the connection configuration is saved in the logic app resource or project's **`connections.json`** file, which contains a **`managedApiConnections`** object that includes connection configuration information for each managed connector used in a workflow. This connection information includes pointers to the connection's resource ID along with the managed identity properties, such as the resource ID when the user-assigned identity is enabled.

This example shows the **`managedApiConnections`** object configuration when the logic app enables the *system-assigned* identity:

{
    "managedApiConnections": {
        "<connector-name>": {
            "api": {
                "id": "/subscriptions/<Azure-subscription-ID>/providers/Microsoft.Web/locations/<Azure-region>/managedApis/<connector-name>"
            },
            "authentication": { // Authentication for the internal token store
                "type": "ManagedServiceIdentity"
            },
            "connection": {
                "id": "/subscriptions/<Azure-subscription-ID>/resourceGroups/<resource-group-name>/providers/Microsoft.Web/connections/<connector-name>"
            },
            "connectionProperties": {
                "authentication": { // Authentication for the target resource
                    "audience": "<resource-URL>",
                    "type": "ManagedServiceIdentity"
                }
            },
            "connectionRuntimeUrl": "<connection-runtime-URL>"
        }
    }
}

This example shows the **`managedApiConnections`** object configuration when the logic app enables the *user-assigned* identity:

{
    "managedApiConnections": {
        "<connector-name>": {
            "api": {
                "id": "/subscriptions/<Azure-subscription-ID>/providers/Microsoft.Web/locations/<Azure-region>/managedApis/<connector-name>"
            },
            "authentication": { // Authentication for the internal token store
                "type": "ManagedServiceIdentity"
            },
            "connection": {
                "id": "/subscriptions/<Azure-subscription-ID>/resourceGroups/<resource-group-name>/providers/Microsoft.Web/connections/<connector-name>"
            },
            "connectionProperties": {
                "authentication": { // Authentication for the target resource
                    "audience": "<resource-URL>",
                    "type": "ManagedServiceIdentity",
                    "identity": "<user-assigned-identity>" // Optional
                }
            },
            "connectionRuntimeUrl": "<connection-runtime-URL>"
        }
    }
}

## ARM template for API connections and managed identities

If you use an ARM template to automate deployment, and your workflow includes an API connection, which is created by a [managed connector](../connectors/managed) that uses a managed identity, you have an extra step to take.

In an ARM template, the underlying connector resource definition differs based on whether you have a Consumption or Standard logic app resource and whether the [connector shows single-authentication or multi-authentication options](#managed-connectors-managed-identity).

[Consumption](#tabpanel_10_consumption)

[Standard](#tabpanel_10_standard)

The following examples apply to Consumption logic app resources and show how the underlying connector resource definition differs between a single-authentication connector and a multi-authentication connector.

#### Single-authentication

This example shows the underlying connection resource definition for a connector action that supports only one authentication type and uses a managed identity in a Consumption logic app workflow where the definition includes the following attributes:

The **`kind`** property is set to **`V1`** for a Consumption logic app.

The **`parameterValueType`** property is set to **`Alternative`**.

{
    "type": "Microsoft.Web/connections",
    "apiVersion": "[providers('Microsoft.Web','connections').apiVersions[0]]",
    "name": "[variables('connections_<connector-name>_name')]",
    "location": "[parameters('location')]",
    "kind": "V1",
    "properties": {
        "alternativeParameterValues": {},
        "api": {
            "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), '<connector-name>')]"
        },
        "authenticatedUser": {},
        "connectionState": "Enabled",
        "customParameterValues": {},
        "displayName": "[variables('connections_<connector-name>_name')]",
        "parameterValueSet": {},
        "parameterValueType": "Alternative"
    }
},

#### Multi-authentication

This example shows the underlying connection resource definition for a connector action that supports multiple authentication types and uses a managed identity in a Consumption logic app workflow where the definition includes the following attributes:

The **`kind`** property is set to **`V1`** for a Consumption logic app.

The **`parameterValueSet`** object includes a **`name`** property that's set to **`managedIdentityAuth`** and a **`values`** property that's set to an empty object.

{
    "type": "Microsoft.Web/connections",
    "apiVersion": "[providers('Microsoft.Web','connections').apiVersions[0]]",
    "name": "[variables('connections_<connector-name>_name')]",
    "location": "[parameters('location')]",
    "kind": "V1",
    "properties": {
        "alternativeParameterValues": {},
        "api": {
            "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), '<connector-name>')]"
        },
        "authenticatedUser": {},
        "connectionState": "Enabled",
        "customParameterValues": {},
        "displayName": "[variables('connections_<connector-name>_name')]",
        "parameterValueSet": {
            "name": "managedIdentityAuth",
            "values": {}
        }
    }
}

The following examples apply to Standard logic app resources and show how the underlying connector resource definition differs between a single-authentication connector and a multi-authentication connector.

#### Single-authentication

This example shows the underlying connection resource definition for a connector action that supports only one authentication type and uses a managed identity in a Standard logic app workflow where the definition includes the following attributes:

The **`kind`** property is set to **`V2`** for a Standard logic app.

The **`parameterValueType`** property is set to **`Alternative`**.

{
    "type": "Microsoft.Web/connections",
    "apiVersion": "[providers('Microsoft.Web','connections').apiVersions[0]]",
    "name": "[variables('connections_<connector-name>_name')]",
    "location": "[parameters('location')]",
    "kind": "V2",
    "properties": {
        "alternativeParameterValues": {},
        "api": {
            "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), '<connector-name>')]"
        },
        "authenticatedUser": {},
        "connectionState": "Enabled",
        "customParameterValues": {},
        "displayName": "[variables('connections_<connector-name>_name')]",
        "parameterValueSet": {},
        "parameterValueType": "Alternative"
    }
},

#### Multi-authentication

This example shows the underlying connection resource definition for a connector action that supports multiple authentication types and uses a managed identity in a Standard logic app workflow where the definition includes the following attributes:

The **`kind`** property is set to **`V2`** for a Standard logic app.

The **`parameterValueSet`** object includes a **`name`** property that's set to **`managedIdentityAuth`** and a **`values`** property that's set to an empty object.

{
    "type": "Microsoft.Web/connections",
    "apiVersion": "[providers('Microsoft.Web','connections').apiVersions[0]]",
    "name": "[variables('connections_<connector-name>_name')]",
    "location": "[parameters('location')]",
    "kind": "V2",
    "properties": {
        "alternativeParameterValues": {},
        "api": {
            "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), '<connector-name>')]"
        },
        "authenticatedUser": {},
        "connectionState": "Enabled",
        "customParameterValues": {},
        "displayName": "[variables('connections_<connector-name>_name')]",
        "parameterValueSet": {
            "name": "managedIdentityAuth",
            "values": {}
        }
    }
}

In the subsequent **Microsoft.Web/connections** resource definition, make sure that you add an access policy that specifies a resource definition for each API connection and provide the following information:

Parameter
Description

<*connection-name*>
The name for your API connection, for example, **azureblob**

<*object-ID*>
The object ID for your Microsoft Entra identity, previously saved from your app registration

<*tenant-ID*>
The tenant ID for your Microsoft Entra identity, previously saved from your app registration

{
   "type": "Microsoft.Web/connections/accessPolicies",
   "apiVersion": "[providers('Microsoft.Web','connections').apiVersions[0]]",
   "name": "[concat('<connector-name>','/','<object-ID>')]",
   "location": "<location>",
   "dependsOn": [
      "[resourceId('Microsoft.Web/connections', parameters('<connector-name>'))]"
   ],
   "properties": {
      "principal": {
         "type": "ActiveDirectory",
         "identity": {
            "objectId": "<object-ID>",
            "tenantId": "<tenant-ID>"
         }
      }
   }
}

For more information, see [Microsoft.Web/connections/accesspolicies (ARM template)](https://learn.microsoft.com/en-us/azure/templates/microsoft.web/connections).

## Set up advanced control over API connection authentication

When your Standard logic app workflow uses an API connection, which is created by a [managed connector](../connectors/managed), Azure Logic Apps communicates with the target resource, such as your email account, key vault, and so on, using two connections:

![Conceptual diagram shows first connection with authentication between logic app and token store plus second connection between token store and target resource.](https://learn.microsoft.commedia/authenticate-with-managed-identity/api-connection-authentication-flow.png)

Connection #1 is set up with authentication for the internal token store.

Connection #2 is set up with authentication for the target resource.

However, when a Consumption logic app workflow uses an API connection, connection #1 is abstracted from you without any configuration options. With the Standard logic app resource, you have more control over your logic app and workflows. By default, connection #1 is automatically set up to use the system-assigned identity.

If your scenario requires finer control over authenticating API connections, you can optionally change the authentication for connection #1 from the default system-assigned identity to any user-assigned identity that you added to your logic app. This authentication applies to each API connection, so you can mix system-assigned and user-assigned identities across different connections to the same target resource.

In your Standard logic app's **connections.json** file, which stores information about each API connection, each connection definition has two **`authentication`** sections, for example:

"keyvault": {
   "api": {
      "id": "/subscriptions/<Azure-subscription-ID>/providers/Microsoft.Web/locations/<Azure-region>/managedApis/keyvault"
   },
   "authentication": {
      "type": "ManagedServiceIdentity",
   },
   "connection": {
      "id": "/subscriptions/<Azure-subscription-ID>/resourceGroups/<resource-group-name>/providers/Microsoft.Web/connections/<connector-name>"
   },
   "connectionProperties": {
      "authentication": {
         "audience": "https://vault.azure.net",
         "type": "ManagedServiceIdentity"
      }
   },
   "connectionRuntimeUrl": "<connection-runtime-URL>"
}

The first **`authentication`** section maps to connection #1.

This section describes the authentication used for communicating with the internal token store. In the past, this section was always set to **`ManagedServiceIdentity`** for an app that deploys to Azure and had no configurable options.

The second **`authentication`** section maps to connection #2.

This section describes the authentication used for communicating with the target resource can vary, based on the authentication type that you select for that connection.

### Why change the authentication for the token store?

In some scenarios, you might want to share and use the same API connection across multiple logic app resources, but not add the system-assigned identity for each logic app resource to the target resource's access policy.

In other scenarios, you might not want to have the system-assigned identity set up on your logic app entirely, so you can change the authentication to a user-assigned identity and disable the system-assigned identity completely.

### Change the authentication for the token store

In the [Azure portal](https://portal.azure.com), open your Standard logic app resource.

On the resource menu, under **Workflows**, select **Connections**.

On the **Connections** pane, select **JSON View**.

![Screenshot showing the Azure portal, Standard logic app resource, Connections pane with JSON View selected.](https://learn.microsoft.commedia/authenticate-with-managed-identity/connections-json-view.png)

In the JSON editor, find the **`managedApiConnections`** section, which contains the API connections across all workflows in your logic app resource.

Find the connection where you want to add a user-assigned managed identity.

For example, suppose your workflow has an Azure Key Vault connection:

"keyvault": {
   "api": {
      "id": "/subscriptions/<Azure-subscription-ID>/providers/Microsoft.Web/locations/<Azure-region>/managedApis/keyvault"
   },
   "authentication": {
      "type": "ManagedServiceIdentity"
   },
   "connection": {
      "id": "/subscriptions/<Azure-subscription-ID>/resourceGroups/<resource-group-name>/providers/Microsoft.Web/connections/<connector-name>"
   },
   "connectionProperties": {
      "authentication": {
         "audience": "https://vault.azure.net",
         "type": "ManagedServiceIdentity"
      }
   },
   "connectionRuntimeUrl": "<connection-runtime-URL>"
}

In the connection definition, complete the following steps:

Find the first **`authentication`** section. If no **`identity`** property exists in this **`authentication`** section, the logic app implicitly uses the system-assigned identity.

Add an **`identity`** property by using the example in this step.

Set the property value to the resource ID for the user-assigned identity.

"keyvault": {
   "api": {
      "id": "/subscriptions/<Azure-subscription-ID>/providers/Microsoft.Web/locations/<Azure-region>/managedApis/keyvault"
   },
   "authentication": {
      "type": "ManagedServiceIdentity",
      // Add "identity" property here
      "identity": "/subscriptions/<Azure-subscription-ID>/resourcegroups/<resource-group-name>/providers/Microsoft.ManagedIdentity/userAssignedIdentities/<identity-resource-ID>"
   },
   "connection": {
      "id": "/subscriptions/<Azure-subscription-ID>/resourceGroups/<resource-group-name>/providers/Microsoft.Web/connections/<connector-name>"
   },
   "connectionProperties": {
      "authentication": {
         "audience": "https://vault.azure.net",
         "type": "ManagedServiceIdentity"
      }
   },
   "connectionRuntimeUrl": "<connection-runtime-URL>"
}

In the Azure portal, go to the target resource, and [give access to the user-assigned managed identity](#access-other-resources), based on the target resource's needs.

For example, for Azure Key Vault, add the identity to the key vault's access policies. For Azure Blob Storage, assign the necessary role for the identity to the storage account.

## Disable managed identity

To stop using the managed identity for authentication, first [remove the identity's access to the target resource](#disable-identity-target-resource). Next, on your logic app resource, [turn off the system-assigned identity or remove the user-assigned identity](#disable-identity-logic-app).

When you disable the managed identity on your logic app resource, you remove the capability for that identity to request access for Azure resources where the identity had access.

Note

If you disable the system-assigned identity, any and all connections used by workflows in that
logic app's workflow won't work at runtime, even if you immediately enable the identity again.
This behavior happens because disabling the identity deletes its object ID. Each time that you
enable the identity, Azure generates the identity with a different and unique object ID. To resolve
this problem, you need to recreate the connections so that they use the current object ID for the
current system-assigned identity.

Try to avoid disabling the system-assigned identity as much as possible. If you want to remove
the identity's access to Azure resources, remove the identity's role assignment from the target
resource. If you delete your logic app resource, Azure automatically removes the managed identity
from Microsoft Entra ID.

The steps in this section cover using the [Azure portal](#azure-portal-disable) and [Azure Resource Manager template (ARM template)](#template-disable). For Azure PowerShell, Azure CLI, and Azure REST API, see the following documentation:

Tool
Documentation

Azure PowerShell
1. [Remove role assignment](https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-remove#azure-powershell). 
2. [Delete user-assigned identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-manage-user-assigned-managed-identities?pivots=identity-mi-methods-powershell).

Azure CLI
1. [Remove role assignment](https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-remove#azure-cli). 
2. [Delete user-assigned identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-manage-user-assigned-managed-identities?pivots=identity-mi-methods-azcli).

Azure REST API
1. [Remove role assignment](https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-remove#rest-api). 
2. [Delete user-assigned identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-manage-user-assigned-managed-identities?pivots=identity-mi-methods-rest).

For more information, see [Remove Azure role assignments](https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-remove).

### Disable managed identity in the Azure portal

To remove access for the managed identity, remove the identity's role assignment from the target resource, and then disable the managed identity.

#### Remove role assignment

The following steps remove access to the target resource from the managed identity:

In the [Azure portal](https://portal.azure.com), go to the target Azure resource where you want to remove access for the managed identity.

From the target resource's menu, select **Access control (IAM)**. Under the toolbar, select **Role assignments**.

In the roles list, select the managed identities that you want to remove. On the toolbar, select **Remove**.

Tip

If the **Remove** option is disabled, you most likely don't have permissions.
For more information about the permissions that let you manage roles for resources, see
[Administrator role permissions in Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/permissions-reference).

#### Disable managed identity on logic app resource

In the [Azure portal](https://portal.azure.com), open your logic app resource.

On the logic app resource menu, under **Settings**, select **Identity**, and then follow the steps for your identity:

Select **System assigned** > **Off** > **Save**. When Azure prompts you to confirm, select **Yes**.

Select **User assigned** and the managed identity, and then select **Remove**. When Azure prompts you to confirm, select **Yes**.

### Disable managed identity in an ARM template

If you created the logic app's managed identity by using an ARM template, set the **`identity`** object's **`type`** child property to **`None`**.

"identity": {
   "type": "None"
}

## Related content

- [Secure access and data in Azure Logic Apps](logic-apps-securing-a-logic-app)

					
		
	 
		
		
	
					
		
		
			
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
		2025-01-27