<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-templates -->

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
					

				
			
		
	
					# Create workflows from prebuilt templates in Azure Logic Apps
					
		
			 
				
					
		
			
				
			
			Feedback
		
	
				
		  
		
	 
		
			
				
					
				
				
					
						Summarize this article for me
					
				
			
			
			
		
	 
		
	
					
Applies to: **Azure Logic Apps (Consumption + Standard)**

Azure Logic Apps provides prebuilt templates so that you can more quickly build workflows for integration solutions by using the Azure portal. These templates follow commonly used workflow patterns and help you streamline development because they offer a starting point or baseline with predefined business logic and configurations.

For example, the following screenshot shows the workflow templates gallery for creating Standard logic app workflows:

![Screenshot shows Azure portal and workflow templates gallery for Standard workflows.](https://learn.microsoft.commedia/create-workflows-from-templates/templates-gallery.png)

This guide shows how to use a template to kickstart your workflow.

## Prerequisites

An Azure account and subscription. If you don't have a subscription, [sign up for a free Azure account](https://azure.microsoft.com/pricing/purchase-options/azure-account?cid=msft_learn).

A Standard or Consumption logic app resource with a blank workflow.

For more information, see the following articles:

- [Create an example Standard logic app workflow](create-single-tenant-workflows-azure-portal)
- [Create an example Consumption logic app workflow](quickstart-create-example-consumption-workflow)

Access or sign-in credentials for each connection that the template creates for the workflow.

To authenticate access for connections that support using a managed identity, you need to set up your logic app resource and the managed identity with the necessary permissions.

A managed identity provides the best option for keeping your data secure because you don't need to provide account or user credentials to sign in. Azure manages this identity and removes the burden on you to rotate credentials, secrets, access tokens, and so on. The managed identity option also reduces security risks because unauthorized users don't have access to your sign-in details.

Before you can use a managed identity for authentication, you need to set up your logic app resource and the managed identity with the necessary permissions. For more information, see the following documentation:

[What are managed identities for Azure resources](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview)?

[Authenticate access to Azure resources with managed identities in Azure Logic Apps](authenticate-with-managed-identity?tabs=standard)

## Select a template from the gallery

To find and choose a template for your workflow, follow the corresponding steps for your Consumption or Standard logic app.

[Consumption](#tabpanel_1_consumption)

[Standard](#tabpanel_1_standard)

In the [Azure portal](https://portal.azure.com), open your Consumption logic app resource.

On the sidebar menu, under **Development Tools**, select **Logic app templates**, which opens the templates gallery.

In the gallery, from the **Subscriptions** list, select the Azure subscriptions associated with the templates that you want to view, for example:

![Screenshot shows Azure portal, templates gallery for Consumption workflow, and Subscriptions list filtered with example Azure subscriptions.](https://learn.microsoft.commedia/create-publish-workflow-templates/subscription-filter.png)

Note

You can view only the workflow templates in the Azure subscriptions where you have access.

Find and select the template you want by using the search box or other filters.

Select your template, which opens the templates overview pane where you can review the workflow's purpose.

The **Summary** tab shows more detailed information, such as any connections, prerequisites, and more information about the workflow.

The **Workflow** tab shows a preview for the workflow that the template creates.

The following example shows the **Summary** tab and **Workflow** tab for a template information pane:

![Screenshot shows template information with Summary and Workflow tabs.](https://learn.microsoft.commedia/create-workflows-from-templates/template-information.png)

Select **Use this template** and continue to the next section.

In the [Azure portal](https://portal.azure.com), open your Standard logic app resource.

On the sidebar menu, under **Workflows**, select **Workflows**.

On the **Workflows** page toolbar, select **Add** > **Add from Template**, which opens the **Templates** gallery.

In the gallery, from the **Subscriptions** list, select the Azure subscriptions associated with the templates that you want to view, for example:

![Screenshot shows Azure portal, templates gallery for Standard workflow, and Subscriptions list filtered with example Azure subscriptions.](https://learn.microsoft.commedia/create-publish-workflow-templates/subscription-filter.png)

Note

You can view only the workflow templates in the Azure subscriptions where you have access.

Find and select the template you want by using the search box or other filters.

Select your template, which opens the templates overview pane where you can review the workflow's purpose.

The **Summary** tab shows more detailed information, such as any connections, prerequisites, and more information about the workflow.

The **Workflow** tab shows a preview for the workflow that the template creates.

The following example shows the **Summary** tab and **Workflow** tab for a template information pane:

![Screenshot shows template information with Workflow and Summary tabs.](https://learn.microsoft.commedia/create-workflows-from-templates/template-information.png)

Select **Use this template** and continue to the next section.

## Provide information about your workflow

In the **Create a new workflow from template** pane appears, on the **Basics** tab, provide the following information about your workflow:

Parameter
Required
Description

**Workflow name**
Yes
Enter the name to use for your workflow.

**State type**
Yes
Select either **Stateful** or **Stateless**, which determines whether to record the run history, inputs, outputs, and other data for the workflow. 

For more information, see [Stateful and stateless workflows](single-tenant-overview-compare#stateful-stateless).

Select **Next** and continue to the next steps.

## Create connections for your workflow

The **Connections** tab lists any connections that the workflow needs to create and authenticate.

To create each listed connection, in the **Connection** column, select **Connect**.

For each connection type, follow the prompts to provide the necessary connection information.

If a connection type supports using a managed identity to authenticate access, choose this option.

Select **Next** or the **Parameters** tab and continue to the next steps.

## Provide values for action parameters

On the **Parameters** tab, provide the necessary values for various action parameters in the workflow.

The parameters on this tab vary, based on the actions that appear in the workflow template.

Select **Next** or the **Review + create** tab and continue to the next steps.

## Review details and create workflow

On the **Review + create** tab, review all the provided information for your workflow.

When you're ready, select **Create**.

When Azure finishes creating your workflow, select **Go to my workflow**.

## Review the created workflow in the designer

[Consumption](#tabpanel_2_consumption)

[Standard](#tabpanel_2_standard)

On the logic app sidebar, under **Development Tools**, select the designer to open the workflow.

Continue working on the workflow by adding or removing the operations that you want.

Make sure to provide the information necessary for each operation.

On the workflow menu, under **Tools**, select the designer to view the workflow.

Continue working on the workflow by adding or removing the operations that you want.

Make sure to provide the information necessary for each operation.

## Related content

[Create and publish workflow templates for Azure Logic Apps](create-publish-workflow-templates)

					
		
	 
		
		
	
					
		
		
			
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
		2025-07-10