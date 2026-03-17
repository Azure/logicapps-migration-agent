<!-- Source: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-ftp -->
<!-- Title: Connect to FTP Servers from Workflows -->

# Connect to FTP servers from workflows in Azure Logic Apps

[Include](https://learn.microsoft.com/en-us/azure/includes/logic-apps-sku-consumption-standard.md)

This article shows how to access your File Transfer Protocol (FTP) server from a workflow in Azure Logic Apps with the FTP connector. You can create automated workflows that run when triggered by events in your FTP server or in other systems and run actions to manage files on your FTP server.

For example, your workflow can start with an FTP trigger that monitors and responds to events on your FTP server. The trigger makes the outputs available to actions in your workflow. Your workflow can run FTP actions that create, send, receive, and manage files through your FTP server account using the following specific tasks:

- Monitor when files are added or changed.
- Create, copy, delete, list, and update files.
- Get file metadata and content.
- Manage folders.

If you're new to Azure Logic Apps, see the following documentation:

- [What is Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview)
- [Quickstart: Create an example Consumption logic app workflow](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-example-consumption-workflow)

## Connector technical reference

The FTP connector has different versions, based on [logic app type and host environment](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview.md#resource-environment-differences).

| Logic app type (plan) | Environment | Connector version |
|------------------------|-------------|-------------------|
| **Consumption** | Multitenant Azure Logic Apps | Managed connector, which appears in the connector gallery with the **Shared** filter. For more information, see: <br><br>- [FTP managed connector reference](https://learn.microsoft.com/en-us/connectors/ftp) <br>- [Managed connectors in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/managed) |
| **Standard** | Single-tenant Azure Logic Apps and App Service Environment v3 (Windows plans only) | - Managed connector, which appears in the connector gallery with the **Shared** filter. <br>- Built-in connector, which appears in the connector gallery with the **Built-in** filter and is [service provider based](https://learn.microsoft.com/en-us/azure/logic-apps/custom-connector-overview.md#service-provider-interface-implementation). The built-in connector can directly access Azure virtual networks with a connection string. For more information, see: <br><br>- [FTP managed connector reference](https://learn.microsoft.com/en-us/connectors/ftp) <br>- [FTP built-in connector operations](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/) <br>- [Managed connectors in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/managed) <br>- [Built-in connectors in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/built-in) |

## Limitations

- Capacity and throughput

  - Built-in connector for Standard workflows:

    By default, FTP actions can read or write files that are *200 MB or smaller*. Currently, the FTP built-in connector doesn't support chunking.

  - Managed connector for Consumption and Standard workflows

    By default, FTP actions can read or write files that are *50 MB or smaller*. To handle files larger than 50 MB, FTP actions support [message chunking](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-handle-large-messages). The **Get file content** action implicitly uses chunking.

- Triggers for the FTP managed or Azure-hosted connector might experience missing, incomplete, or delayed results when the *last modified* timestamp is preserved. On the other hand, the FTP *built-in* connector trigger in Standard logic app workflows doesn't have this limitation. For more information, see the FTP connector's [Limitations](https://learn.microsoft.com/en-us/connectors/ftp/#limitations).

- The FTP managed connector can create a limited number of connections to the FTP server. The limit is based on the connection capacity in the Azure region where your logic app resource exists. If this limit poses a problem in a Consumption logic app workflow, create a Standard logic app workflow that uses the FTP built-in connector.

* Both the built-in and managed FTP connector support only explicit FTP over FTPS, which is an extension of TLS. Neither connector version supports implicit FTPS.

## Prerequisites

- An Azure account and subscription. If you don't have an Azure subscription, [sign up for a free Azure account](https://azure.microsoft.com/pricing/purchase-options/azure-account?cid=msft_learn).

- The logic app workflow where you want to access your FTP account. To start your workflow with an FTP trigger, you have to start with a blank workflow. To use an FTP action, start your workflow with another trigger, such as the **Recurrence** trigger.

- For more requirements that apply to both the FTP managed connector and built-in connector, see the [FTP managed connector reference - Requirements](https://learn.microsoft.com/en-us/connectors/ftp/#requirements).

<a name="known-issues"></a>

## Known issues

[Include](https://learn.microsoft.com/en-us/azure/includes/connectors-managed-trigger-split-on.md)

<a name="add-ftp-trigger"></a>

## Add an FTP trigger

A Consumption logic app workflow can use only the FTP managed connector. However, a Standard logic app workflow can use the FTP managed connector *and* the FTP built-in connector.

The FTP managed connector and built-in connector each have only one trigger available:

- Managed connector trigger: The FTP trigger named **When a file is added or modified (properties only)** runs a Consumption or Standard logic app workflow when one or more files are added or changed in a folder on the FTP server. This trigger gets only the file properties or metadata, not the file content. To get the file content, your workflow can follow this trigger with other FTP actions.

  For more information, see [When a file is added or modified (properties only)](https://learn.microsoft.com/en-us/connectors/ftp/#when-a-file-is-added-or-modified-(properties-only)).

- Built-in connector trigger: The FTP trigger named **When a file is added or updated** runs a Standard logic app workflow when one or more files are added or changed in a folder on the FTP server. This trigger gets only the file properties or metadata, not the file content. To get the content, your workflow can follow this trigger with other FTP actions. For more information, see [When a file is added or updated](https://learn.microsoft.com/en-us/connectors/ftp/#when-a-file-is-added-or-modified-(properties-only)).

The following procedures use the Azure portal. With the corresponding Azure Logic Apps extension for Consumption or Standard logic apps, you can use the following tools instead to create and edit logic app workflows:

- Consumption logic app workflows: [Visual Studio Code](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-logic-apps-visual-studio-code)
- Standard logic app workflows: [Visual Studio Code](https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-visual-studio-code)

This section shows the steps for the following FTP connector triggers:

- [*Built-in* trigger named **When a file is added or updated**](#built-in-connector-trigger)

  If you use this FTP built-in trigger, you can get the file content by using the FTP built-in action named **Get file content** without using the **Get file metadata** action first, unlike when you use the FTP managed trigger. For more information about FTP built-in connector operations, see [FTP built-in connector operations](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/).

  This built-in FTP trigger isn't available for Consumption logic app workflows.

- [*Managed* trigger named **When a file is added or modified (properties only)**](#managed-connector-trigger)

  If you use this FTP managed trigger, you must use the **Get file metadata** action to get a single array item before you use any other action on the file that was added or modified. This workaround results from the [known issue around the **Split On** setting](#known-issues) described earlier in this article.

<a name="built-in-connector-trigger"></a>

### Add built-in connector trigger

To add a built-in connector trigger to a Standard workflow:

1. In the [Azure portal](https://portal.azure.com), open your logic app resource.

1. On the resource sidebar menu, under **Workflows**, select **Workflows**, and then select your empty workflow, which opens in the designer.

1. On the designer, select **Add a trigger**.

1. Follow the [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow.md#add-trigger) to add the FTP trigger **When a file is added or updated (preview)**.

1. Provide the [information for your connection](https://learn.microsoft.com/en-us/connectors/ftp/#creating-a-connection). When you're done, select **Create new**.

   ![Screenshot shows the Create connection page in workflow designer with the FTP built-in trigger information.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-trigger-connection-built-in.png)

   > [!NOTE]
   >
   > By default, this connector transfers files in text format. To transfer files in binary format, for example, where and when encoding is used, select the binary transport option.

1. After the trigger information pane appears, in the **Folder Path** box, specify the path to the folder that you want to monitor.

   ![Screenshot shows workflow designer with the FTP built-in trigger and Folder path with the specific folder path to monitor.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-trigger-built-in-folder-path.png)

1. When you're done, save your workflow.

When you save your workflow, Azure publishes your updates to your deployed and live logic app in Azure. With only a trigger, your workflow just checks the FTP server based on your specified schedule. You have to add an action that responds to the trigger and does something with the trigger outputs, as described in later sections.

<a name="managed-connector-trigger"></a>

### Add managed connector trigger

To add a managed connector trigger to a Consumption or Standard workflow:

1. In the [Azure portal](https://portal.azure.com), find and open your logic app resource.
 
1. Based on whether you have a Consumption or Standard logic app:

   - Consumption: On the resource sidebar menu, under **Development Tools**, select the designer to open the workflow.

   - Standard: On the resource sidebar menu, under **Workflows**, select **Workflows**. Select the blank workflow, which opens in the designer.

1. On the workflow designer, select **Add a trigger**.

1. Follow the [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow.md#add-trigger) to add the FTP trigger **When a filed is added or modified (properties only)**.

1. Provide the [information for your connection](https://learn.microsoft.com/en-us/connectors/ftp/#creating-a-connection). When you're done, select **Create new**.

   ![Screenshot shows workflow designer with the FTP managed connector trigger information.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-trigger-connection-azure.png)

   > [!NOTE]
   >
   > By default, this connector transfers files in text format. To transfer files in binary format, for example, where and when encoding is used, select the binary transport option.


1. When the trigger information pane opens, find the folder that you want to monitor for new or edited files.

   1. In the **Folder** box, select the folder icon to view the folder directory.

   1. Select the right arrow (**>**). Browse to the folder that you want, and then select the folder.

   ![Screenshot shows workflow designer with FTP managed connector trigger with the option to select a folder.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-trigger-azure-select-folder.png)

   Your selected folder appears in the **Folder** box.

   ![Screenshot shows workflow designer with the FTP managed connector trigger and Folder path with the specific folder path to monitor.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-trigger-azure-selected-folder.png)

1. When you're done, save your workflow.

When you save your workflow, Azure publishes your updates to your deployed and live logic app. With only a trigger, your workflow just checks the FTP server based on your specified schedule. You must add an action that responds to the trigger and does something with the trigger outputs, as described in later sections.

<a name="add-ftp-action"></a>

## Add an FTP action

A Consumption logic app workflow can use only the FTP managed connector. A Standard logic app workflow can use the FTP managed connector and the FTP built-in connector. Each version has multiple actions. For example, both managed and built-in connector versions have their own actions to get file metadata and get file content.

- Built-in connector actions: These actions run only in a Standard logic app workflow.
- Managed connector actions: These actions run in a Consumption or Standard logic app workflow.

The following procedures use the Azure portal. With the corresponding Azure Logic Apps extension for Consumption or Standard, you can use the following tools instead to create and edit logic app workflows:

- Consumption workflows: [Visual Studio Code](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-logic-apps-visual-studio-code)
- Standard workflows: [Visual Studio Code](https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-visual-studio-code)

Before you can use an FTP action, your workflow must already start with a trigger, which can be any kind that you choose. For example, you can use the generic **Recurrence** built-in trigger to start your workflow on specific schedule.

The steps to add and use an FTP action differ based on whether your workflow uses the built-in connector or the managed connector.

- [**Built-in trigger workflows**](#built-in-trigger-workflows): Describes the steps to add a built-in action to a workflow that starts with a built-in trigger.

  If you used the FTP built-in trigger, and you want the content from a newly added or updated file, you can use a **For each** loop to iterate through the array returned by the trigger. You can then use just the **Get file content** action without any other intermediary actions. For more information about FTP built-in connector operations, see [FTP built-in connector operations](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/ftp/).

- [**Managed trigger workflows**](#managed-trigger-workflows): Describes the steps to add a managed action to a workflow that starts with a managed trigger.

  If you used the FTP managed connector trigger, and want the content from a newly added or modified file, you can use a **For each** loop to iterate through the array returned by the trigger. You then have to use intermediary actions such as the FTP action named **Get file metadata** before you use the **Get file content** action.

<a name="built-in-trigger-workflows"></a>

### Workflows with a built-in trigger

To add actions to a Standard workflow that starts with a built-in connector trigger:

1. In the [Azure portal](https://portal.azure.com), find and open your logic app resource.

1. On the resource sidebar menu, under **Workflows**, select **Workflows**. Select the workflow with the FTP built-in trigger.

1. On the designer, follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow.md#add-action) to add the FTP action named **Get file content** to your workflow.

1. If necessary, provide the [information for your connection](https://learn.microsoft.com/en-us/connectors/ftp/#creating-a-connection). When you're done, select **Create new**.

   ![Screenshot shows workflow designer with an FTP built-in action with connection information.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-action-connection-built-in.png)

   > [!NOTE]
   >
   > By default, this connector transfers files in text format. To transfer files in binary format, for example, where and when encoding is used, select the binary transport option.

1. In the action information pane that opens, select inside the **File Path** to show the input options. Select the lightning icon to open the dynamic content list.

   You can now select outputs from the preceding trigger.

1. In the dynamic content list, under **When a file is added or updated**, select **File path**.

   ![Screenshot shows workflow designer and Get file content action with the dynamic content list open and File path highlighted.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-action-get-file-content-file-path-built-in.png)

   The **File path** property now references the **File path** trigger output.

   ![Screenshot shows workflow designer with the Get file content action complete.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-action-get-file-content-complete-built-in.png)

1. Add any other actions that your workflow needs. 

1. When you're done, save your workflow. On the designer toolbar, select **Save**.

<a name="managed-trigger-workflows"></a>

### Workflows with a managed trigger

To add actions to a Consumption or Standard workflow that starts with a managed connector trigger:

1. In the [Azure portal](https://portal.azure.com), find and open your logic app resource.

1. Based on whether you have a Consumption or Standard logic app:

   - Consumption: On the resource sidebar menu, under **Development Tools**, select the designer to open the workflow.

   - Standard: On the resource sidebar menu, under **Workflows**, select **Workflows**. Select the workflow that starts with the FTP managed connector trigger. In the workflow sidebar menu, select the designer to open the workflow.

1. On the designer, follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow.md#add-action) to add the FTP action named **Get file metadata** to your workflow.

1. If necessary, provide the [information for your connection](https://learn.microsoft.com/en-us/connectors/ftp/#creating-a-connection). When you're done, select **Create new**.

   ![Screenshot shows workflow designer with FTP managed connector action with connection information.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-action-connection-azure.png)

   > [!NOTE]
   >
   > By default, this connector transfers files in text format. To transfer files in binary format, for example, where and when encoding is used, select the binary transport option.

1. In the action information pane that opens, select inside **File** to show the input options. Select the lightning icon to open the dynamic content list.

   You can now select outputs from the preceding trigger.

1. In the dynamic content list, under **When a file is added or modified (properties only)**, select **List of Files Id**.

   ![Screenshot shows workflow designer with the Get file metadata action dynamic content list opened and List of Files Id highlighted.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-get-file-metadata-list-files-azure.png)

   The **File** property now references the **List of Files Id** trigger output.

   ![Screenshot shows workflow designer with the Get file metadata action and File set to List of Files Id.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-get-file-metadata-complete-azure.png)

1. On the designer, follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow.md#add-action) to add the FTP action named **Get file content** to your workflow.

1. In the action information pane that appears, select inside **File** to show the input options. Select the lightning icon to open the dynamic content list.

   You can now select outputs from the preceding trigger or actions.

1. In the dynamic content list, under **Get file metadata**, select **Id**.

   ![Screenshot shows workflow designer with Get file content action dynamic content list opened and Id highlighted.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-get-file-content-file-id-azure.png)

   The **File** property now references the **Id** action output.

   ![Screenshot shows workflow designer with Get file content action with File set to Id.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/ftp-get-file-content-complete-azure.png)

1. Add any other actions that your workflow needs.

1. When you're done, save your workflow. On the designer toolbar, select **Save**.

## Test your workflow

To check that your workflow returns the content that you expect, add another action that sends you the content from the added or updated file. This example uses the Office 365 Outlook action named **Send an email**.

### Workflow with built-in trigger and actions

To add an Office 365 Outlook action to your Standard workflow:

1. On the designer, under the **Get file content** action, follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow.md#add-action) to add the action named **Send an email** to your workflow. 

   If you have an Outlook.com account instead, add the Outlook.com **Send an email** action.

1. If necessary, sign in to your email account.

1. In the action information pane, provide the required values and include any other parameters or properties that you want to test.

   For example, you can include the **File content** output from the **Get file content** action. To find this output, follow these steps:

   1. In the **Get file content** action, select inside the **Body** to show the input options. Select the lightning icon to open the dynamic content list. From this list, under **Get file content**, select **File content**.

      ![Screenshot shows workflow designer with Send an email action dynamic content list opened with Get file content selected.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/send-email-action-body-see-more-built-in.png)

   1. In the dynamic content list, under **Get file content**, select **File content**.

      The **Body** property now contains the **File content** action output.

      ![Screenshot shows workflow designer with Send an email action with File content action output.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/send-email-action-complete-built-in.png)

1. Save your workflow.

To run and trigger the workflow, follow these steps:

1. On designer toolbar, select **Run** > **Run**.

1. Add a file to the FTP folder that your workflow monitors.

#### Workflow with managed trigger and actions

To add an Office 365 Outlook action to your Consumption or Standard workflow:

1. On the designer, under the **Get file content** action, follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow.md#add-action) to add the action named **Send an email** to your workflow.

   If you have an Outlook.com account instead, add the Outlook.com **Send an email** action.

1. If necessary, sign in to your email account.

1. In the action information box, provide the required values and include any other parameters or properties that you want to test.

   For example, you can include the **File content** output from the **Get file content** action. To find this output, follow these steps:

   1. In the **Get file content** action, select inside the **Body** box to show the input options. Select the lightning icon to open the dynamic content list. From this list, under **Get file content**, select **File content**.

      ![Screenshot shows workflow designer with Send an email action dynamic content list opened with File content highlighted.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/send-email-action-body-see-more-azure.png)

   1. In the dynamic content list, under **Get file content**, select **File content**.

      The **Body** property now contains the **File content** action output.

      ![Screenshot shows workflow designer and Send an email action with File content as managed action output.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/connectors-create-api-ftp/send-email-action-complete-azure.png)

1. Save your logic app workflow.

To run and trigger the workflow, follow these steps:

1. On designer toolbar, select **Run** > **Run**.

1. Add a file to the FTP folder that your workflow monitors.

<a name="built-in-operations"></a>

## Related content

- [Managed connectors for Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/managed)
- [Built-in connectors for Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/built-in)
- [What are connectors in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/introduction)
