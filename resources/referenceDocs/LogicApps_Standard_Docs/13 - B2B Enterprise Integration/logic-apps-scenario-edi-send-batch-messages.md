<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-scenario-edi-send-batch-messages -->
<!-- Title: Process EDI Messages in Batches or Groups -->

# Exchange EDI messages in batches or groups between trading partners in Azure Logic Apps

[Include](https://learn.microsoft.com/en-us/azure/includes/logic-apps-sku-consumption-standard.md)

In business to business (B2B) scenarios, partners often exchange messages in groups or *batches*. When you build a batching solution with Azure Logic Apps, you can send messages to trading partners and process those messages together in batches.

Processing X12 messages in batches works the same way as batching other messages. You use a batch trigger to collect messages into a batch. You use a batch action to send messages to the batch. Before the messages go to the trading partner or other destination, you also include an X12 encoding step. For more information, see [Send, receive, and batch process messages](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-batch-process-send-receive-messages).

This guide shows how to build a batching solution that processes Electronic Data Interchange (EDI) messages by creating two logic apps, a *batch sender* and a *batch receiver*. As an example, this solution handles X12 messages.

- The [batch receiver](#receiver) collects messages into a batch until specific criteria are met to release and process these messages. This batch receiver also encodes the messages in the batch by using the specified X12 agreement or partner identities.

  You must first create the batch receiver as the batch destination. You can then later select the batch receiver when you create the batch sender.

- The [batch sender](#sender) logic app workflow sends messages to the previously created batch receiver.

Your batch receiver and batch sender must use the same Azure subscription *and* Azure region. If they don't, you can't select the batch receiver when you create the batch sender because they're not visible to each other.

> [!NOTE]
>
> In a Standard logic app, you can create two workflows as the batch receiver and batch sender. Consumption logic app only has a single workflow, so you must create two logic apps.

## Prerequisites

- An Azure account and subscription. If you don't have a subscription, [sign up for a free Azure account](https://azure.microsoft.com/pricing/purchase-options/azure-account?cid=msft_learn).

- Basic knowledge about how to create logic app workflows. For more information, see the following documentation:

  - [Create a Consumption logic app workflow](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-example-consumption-workflow)
  - [Create a Standard logic app workflow](https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-azure-portal)

- An [integration account](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-create-integration-account) that uses the same Azure subscription and is linked to your logic app.

- At least two [trading partners](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-partners) in your integration account. Each partner must use the X12 (Standard Carrier Alpha Code) qualifier as a business identity in the partner properties.

- An existing [X12 agreement](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-x12) in your integration account.

[Include](https://learn.microsoft.com/en-us/azure/includes/api-test-http-request-tools-bullet.md)

<a name="receiver"></a>

## Create X12 batch receiver

Before you can send messages to a batch, the batch must first exist as the destination batch. So, create the batch receiver first and start the workflow with the **Batch trigger**. That way, when you create the batch sender, you can select the batch receiver.

The batch receiver collects messages until the specified criteria are met to release and process these messages. Batch receivers don't have to know about the batch senders, but batch senders must know where to send the messages.


1. In the [Azure portal](https://portal.azure.com) or Visual Studio Code, create a logic app named **BatchX12Messages**.

1. If you didn't previously link logic app to your integration account, [link your logic app now](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-create-integration-account#link-account).


1. Follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow#add-trigger) to add a **Batch Operations** trigger named **Batch trigger**.

1. On the designer, select **Batch trigger** to open the trigger information pane.

1. On the information pane, select the title for **Batch trigger**. Change the name to **Batch messages*.

1. On the **Parameters** tab, provide values for the following parameters:

   | Parameter | Value | Notes |
   |-----------|-------|-------|
   | **Mode** | **Inline** or **IntegrationAccount** | Only available for Consumption workflows. |
   | **Batch Name** | \<*batch-name*\> | The batch name to use. This example uses `TestBatch`. <br><br>- Consumption workflows: Only available when **Mode** is **Inline**. This example uses `TestBatch`. <br>- Standard workflows: Always available. |
   | **Release Criteria** | - **Message count based** <br>- **Size based** <br>- **Schedule based** | The release criteria type to use. <br><br>- Consumption workflows: Only available when **Mode** is **Inline**. <br>- Standard workflows: Always available. <br><br>This example uses **Message count based** and **Schedule based**. |
   | **Message Count** | \<*integer*\> | Only available when **Release Criteria** is **Message count based**. Specifies the number of messages to collect and release. This example uses `10` as the value. |
   | **Interval** | \<*integer*\> | Only available when **Release Criteria** is **Schedule based**. Specifies the number of time intervals for the recurrence. This example uses `10` as the value. |
   | **Frequency** | \<*time-unit*\> | Only available when **Release Criteria** is **Schedule based**. Specifies the time unit for the recurrence. This example uses **Minute** as the value. |

   ![Screenshot shows the batch messages trigger pane where you can enter the parameter values.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-scenario-EDI-send-batch-messages/batch-receiver-release-criteria.png)

   > [!NOTE]
   >
   > This example doesn't set up a partition for the batch. Each batch uses the same partition key. For more information about partitions, see [Create batch sender](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-batch-process-send-receive-messages#batch-sender).

1. Add an action that encodes each batch:

   1. Follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow#add-action) to add an **X12** action named **Batch encode <*any-version*>**.

   1. If you didn't previously connect to your integration account, create the connection now.
   
      1. Provide a name for your connection.
      1. Provide values for the **Integration Account ID** and **Integration Account SAS URL** parameters.
      1. Select **Create new**.

      ![Screenshot shows the connection name and integration account where you create a connection between batch encoder and integration account.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-scenario-EDI-send-batch-messages/batch-encoder-connect-integration-account.png)

   1. On the designer, select the batch encoder action to open the action information pane. On the **Parameters** tab, provide values for the following parameters. If necessary, select parameters from **Advanced parameters**.

      | Parameter | Description |
      |-----------|-------------|
      | **Name of X12 agreement** | From this list, select your agreement. <br><br>**Note**: If the list is empty, make sure you [link your logic app to the integration account](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-create-integration-account#link-account) that has your agreement. | 
      | **BatchName** | Select inside this box to show the input options. Select the lighting icon to open the dynamic content list. From the list, under **Batch messages**, select the trigger output named **Batch Name**. | 
      | **PartitionName** | Select inside this box to show the input options. Select the lightning icon to open the dynamic content list. From the list, under **Batch messages**, select **Partition Name**. | 
      | **Items** | Select the **T** icon for **Switch to input entire array**. Select inside the **Items** box to show the input options. Select the lightning icon to open the dynamic content list. From this list, under **Batch messages**, select the trigger output named **Batched Items**. |

      ![Screenshot shows the Batch encode by agreement name action where you can specify values.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-scenario-EDI-send-batch-messages/batch-encode-action-details.png)

      For the **Items** box:

      ![Screenshot shows the Items box where you specify Batched Items.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-scenario-EDI-send-batch-messages/batch-encode-action-items.png)

1. Save your workflow.

1. If you use Visual Studio Code, first [deploy the batch receiver logic app to Azure](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-logic-apps-visual-studio-code). Otherwise, you can't select the batch receiver when you create the batch sender.

### Test your workflow

To make sure your batch receiver works as expected, you can add an HTTP action for testing purposes, and send a batched message to the [Request Bin service](https://requestbin.com/).

1. Follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/add-trigger-action-workflow#add-action) to add the **HTTP** action named **HTTP**.

1. On the designer, select the **HTTP** action to open the action information pane. On the **Parameters** tab, provide values for the following parameters:

   | Parameter | Description |
   |----------|-------------|
   | **Method** | From this list, select **POST**. |
   | **URI** | Generate a URI for your request bin, and then enter that URI in this box. |
   | **Body** | Select inside this box to show the input options. Select the lighting icon to open the dynamic content list. From this list, under **Batch encode by agreement name**, select the action output named **Content**. <br><br>If **Content** doesn't appear, next to **Batch encode by agreement name**, select **See more**. |

   ![Screenshot shows an HTTP action where you specify values.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-scenario-EDI-send-batch-messages/batch-receiver-add-http-action-details.png)

1. Save your workflow.

   Your batch receiver workflow looks like the following example: 

   ![Screenshot shows the completed batch receiver workflow.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-scenario-EDI-send-batch-messages/batch-receiver-finished.png)
   
1. Continue to the next section where you create a batch sender to send messages to the batch receiver.

<a name="sender"></a>

## Create X12 batch sender

Now you need one or more logic apps that send messages to the batch receiver. For each batch sender, specify the batch receiver and batch name, message content, and any other settings. You can optionally provide a unique partition key to divide the batch into subsets and collect messages with that key.

Before you start, make sure that you finished the following tasks:

- You [created your batch receiver](#receiver). The batch receiver must exist when you create your batch sender. Otherwise, you can't select the batch receiver as the destination batch. Batch receivers don't need to know about batch senders, but batch senders must know where to send messages.

- Make sure both the batch receiver and batch sender use the same Azure subscription *and* Azure region. If they don't, you can't select the batch receiver when you create the batch sender because they're not visible to each other.

1. Create another logic app named **SendX12MessagesToBatch**.

1. Follow these [general steps](create-workflow-with-trigger-or-action.md?tab=consumption#add-trigger) to add the **Request** trigger named **When a HTTP request is received**.

1. Follow these [general steps](https://learn.microsoft.com/en-us/azure/logic-apps/create-workflow-with-trigger-or-action#add-action) to add the **Batch Operations** action based on your logic app type:

   - Consumption: **Send to batch trigger workflow**
   - Standard: **Send to batch**

   1. Follow the steps for your logic app type:
   
      - Consumption: Select your previously created **BatchX12Messages** **>** **Batch_messages** **>** **Add action**.
      - Standard: Skip this step and go to the next step.

1. On the **Parameters** tab, provide values for the following parameters:

   | Parameter | Description |
   |-----------|-------------|
   | **Batch Name** | The batch name defined in the batch receiver, which is `TestBatch` for this example. <br><br>**Important**: The batch name gets validated at runtime and must match the name specified by the batch receiver. Changing the batch name causes the batch sender to fail. |
   | **Message Content** | The message content to send, which is the **Body** output from the **HTTP** trigger. <br><br>Select inside the **Message Content** box to show the input options. Select the lightning icon to open the dynamic content list. From the list, under **HTTP**, select **Body**. |
   | - Consumption: **Workflow Id** <br>- Standard: **Workflow Name** | - Consumption workflows: The value is prepopulated. <br>- Standard: Enter the trigger name in the batch receiver workflow, which is **Batch messages** in this example. |
   | **Trigger Name** | - Consumption workflows: The value is prepopulated. <br>- Standard: Enter the trigger name from the batch receiver workflow. |
    
   ![Screenshot shows the BatchX12Messages action where you set the batch parameters.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-scenario-EDI-send-batch-messages/batch-sender-set-batch-properties.png)

1. Save your workflow.

   Your batch sender looks like the following example:

   ![Screenshot shows the workflow for your batch sender logic app.](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/logic-apps/media/logic-apps-scenario-EDI-send-batch-messages/batch-sender-finished.png)

## Test your workflows

To test your batching solution, from your HTTP request tool, send HTTP POST requests with X12 messages to your batch sender. If you used the example values, you start getting X12 messages in your request bin, either every 10 minutes or in batches of 10, all with the same partition key.

## Related content

- [Process messages as batches](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-batch-process-send-receive-messages)
