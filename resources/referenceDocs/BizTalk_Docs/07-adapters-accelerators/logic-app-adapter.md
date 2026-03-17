> Source: https://learn.microsoft.com/en-us/biztalk/core/logic-app-adapter

# Connect to Azure Logic Apps from BizTalk Server

To exchange messages between BizTalk Server and a logic app workflow in Azure, you can use the adapter in BizTalk Server for Azure Logic Apps. This guide shows how to receive a message in BizTalk Server from a logic app workflow. The workflow can send messages to BizTalk Server. The receiving end uses Internet Information Services (IIS) applications to handle communication with an Azure service.

If BizTalk Server is on premises and joined to your domain, you must install the on-premises data gateway on BizTalk Server, and create an on-premises data gateway resource in Azure. However, if BizTalk Server is installed on an Azure virtual machine, you can choose whether or not to expose the virtual machine as an HTTP endpoint, which has a URL that you can call.

If you choose the HTTP endpoint option, you don't need to use the gateway. Instead, you create a logic app workflow, add the BizTalkServer connector action that you want, and provide the HTTP endpoint URL as required by the action's connection information. However, if you choose the on premises option, you must set up and use the data gateway, described later in this guide.

This guide also shows how to send messages from BizTalk Server to a logic app workflow. Put another way, your logic app workflow can receive messages from BizTalk Server.

This guide shows how to create a receive location and a send port using the Azure Logic Apps adapter. You can use this adapter with an on-premises BizTalk Server or an Azure virtual machine running BizTalk Server.

## Prerequisites

- An Azure account and subscription so that you can sign in to the Azure portal, and create a logic app resource and workflow. If you don't have a subscription, [sign up for a free Azure account](https://azure.microsoft.com/free/?WT.mc_id=A261C142F).
- BizTalk Server requirements based on the location where the server is installed:
  - **On-premises computer with BizTalk Server**: Install and set up the [on-premises data gateway for Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-gateway-install). Then, in the Azure portal, create the [data gateway resource](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-gateway-connection) to use with the BizTalk server connector in your logic app workflow.
  - **Azure virtual machine with BizTalk Server**:
    - If the virtual machine isn't exposed as an HTTP endpoint, install and set up the [on-premises data gateway for Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-gateway-install). Then, in the Azure portal, create the [data gateway resource](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-gateway-connection) to use with the BizTalk Server connector in your logic app workflow.
    - If the virtual machine is exposed as an HTTP endpoint, you don't need to use the data gateway installation nor create the data gateway resource.
- Some familiarity with Azure Logic Apps. If you're new to logic apps, see [What is Azure Logic Apps?](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview) and [create an example Consumption logic app workflow in multitenant Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-first-logic-app-workflow).
- Optionally, a tool that can send HTTP requests to test your workflow (e.g., Visual Studio Code with a REST extension, PowerShell `Invoke-RestMethod`, Bruno, or Curl).

> **Caution**: For scenarios where you have sensitive data, such as credentials, secrets, access tokens, API keys, and other similar information, make sure to use a tool that protects your data with the necessary security features, works offline or locally, doesn't sync your data to the cloud, and doesn't require that you sign in to an online account. This way, you reduce the risk around exposing sensitive data to the public.

## Install the Azure Logic Apps Adapter

### BizTalk Server 2020 and Newer

Starting with BizTalk Server 2020, the Azure Logic Apps adapter is included with the BizTalk Server installation.

### BizTalk Server 2016

1. On your BizTalk Server, download and install the Azure Logic Apps adapter:
   1. Go to [Microsoft BizTalk Server Adapter for Logic Apps](https://www.microsoft.com/download/details.aspx?id=54287), and select **Download**.
   2. To install, open the `LogicAppAdapter.iso` file, and run the `LogicApp Adapter.msi` file.
   3. Accept the license agreement, and select **Install**.
2. After the install completes, restart the **BizTalkServerApplication** and **BizTalkServerIsolatedHost** host instances.

After installation completes, you have the following states:

- The Azure Logic Apps adapter is added to BizTalk Administration.
- The send handler is created and uses the BizTalkServerApplication host instance.
- The receive handler is created as a Windows Communication Foundation service and uses the BizTalkServerIsolatedHost host instance.
- The `LogicApp Adapter` folder is created inside the BizTalk installation directory and includes two services: **Management** and **ReceiveService**.
  - **Management**: Used by the BizTalk connector in a logic app workflow to connect to BizTalk Server using the data gateway. This management service allows BizTalk Server to receive messages from a logic app workflow using the data gateway. This service is used only on the receive side of BizTalk, not the send side.
  - **ReceiveService**: Used by the BizTalk connector in a logic app workflow with the receive location. This service is responsible for sending messages from the logic app workflow. This service is used only on the receive side of BizTalk, not the send side.

### BizTalk Server 2016 Only: NullAdapter and Azure Logic Apps Adapter

If you install the Azure Logic Apps adapter and the NullAdapter, you might see the following error:

> *Another adapter with the same OutboundEngineCLSID value already exists*

The Adapter class GUID is the same for the Azure Logic Apps adapter and NullAdapter. If you need both adapters, follow these steps:

1. Download the [NullAdapter source code on GitHub](https://github.com/tomasr/nulladapter).
2. In the `NullSendAdapter.cs` class, update the GUID.
3. In the `NullAdapter.reg` file, update the OutboundEngineCLSID value.
4. Build and deploy the NullAdapter.

## Receive Messages from a Workflow

This section lists the extra steps required for BizTalk Server to receive messages from a logic app workflow. As the Azure portal can change, some steps might not exactly match those listed.

### Step 1: Create the IIS Applications

The IIS applications use the services Management and ReceiveService. You can run the IIS applications using a new or existing application pool. The identity of the AppPool requires membership in the same groups as the account that runs the BizTalk services, such as the BizTalk Application Users and BizTalk Isolated Host Users groups.

> **Tip**: If you create a new application pool, make sure to keep the default .NET CLR version and managed pipeline. Remember, choose an identity (Advanced Settings) that has membership to the same BizTalk groups as your BizTalk service account.

#### Create the Management IIS Application

The BizTalk Server connector in your logic app workflow uses the URL for this IIS application to connect through the data gateway on your BizTalk Server.

##### BizTalk Server 2020 and Newer

1. Configure the REST APIs using the BizTalk Configuration Wizard. For more information, see the [Configuration Guide](https://learn.microsoft.com/en-us/biztalk/install-and-config-guides/configure-biztalk-server). For more details about the REST APIs, see the [BizTalk REST API Reference](https://learn.microsoft.com/en-us/rest/api/overview/biztalk/?view=rest-biztalk-2020&preserve-view=true).
2. In a web browser, go to `http://localhost/BizTalkManagementService/Schemas`. Based on your web browser, either the schemas list appears, or you get a prompt to open and save a `schemas.json` file. If neither happens, check your REST API configuration.

##### BizTalk Server 2016

1. Open the Internet Information Services (IIS) Manager.
2. From the **Default Web Site** shortcut menu, select **Add Application**.
3. In this new application:
   1. Enter the **Alias** (name) for your application, such as `IISLogicApp`.
   2. Select the application pool.
   3. Set the **Physical path** to `C:\Program Files (x86)\Microsoft BizTalk Server 2016\LogicApp Adapter\Management`.
   4. Test the settings to confirm that the application pool identity passes the Authentication and Authorization tests.
4. Select **OK** to save your changes.
5. In a web browser, go to `http://localhost/YourApplicationAlias/schemas?api-version=2016-10-26`, for example: `http://localhost/IISLogicApp/Schemas?api-version=2016-10-26`. Based on your web browser, either the schemas list appears, or you get a prompt to open and save a `schemas.json` file. If neither happens, your AppPool identity might be missing membership to the BizTalk groups.

#### Create the BizTalk ReceiveService IIS Application

The BizTalk Server connector in your logic app workflow uses the URL for this IIS application for the receive location that you specify.

1. Open the Internet Information Services (IIS) Manager.
2. Open the **Default Web Site** shortcut menu, and select **Add Application**.
3. In this new application:
   1. Enter the **Alias** (name) for your application, such as `ReceiveWCFService`.
   2. Select the same application pool as the previous IIS application.
   3. Set the **Physical path** to:
      - **BizTalk Server 2020**: `C:\Program Files (x86)\Microsoft BizTalk Server\LogicApp Adapter\ReceiveService`
      - **BizTalk Server 2016**: `C:\Program Files (x86)\Microsoft BizTalk Server 2016\LogicApp Adapter\ReceiveService`
   4. Test the settings to confirm that the application pool identity passes the Authentication and Authorization tests.
4. Select **OK** to save your changes.

### Step 2: Create a Logic App Workflow

1. In the [Azure portal](https://portal.azure.com/), create a new logic app resource and blank workflow.
2. [Add the Request trigger named **When an HTTP request is received**](https://learn.microsoft.com/en-us/azure/logic-apps/create-workflow-with-trigger-or-action#add-trigger) to your workflow.
3. [Add the BizTalkServer action named **Prepare message from JSON**](https://learn.microsoft.com/en-us/azure/logic-apps/create-workflow-with-trigger-or-action#add-action) to your workflow.
4. On the action's connection pane, provide the following information:

| Property | Description |
|---|---|
| **Connect via on-premises data gateway** | Select if you're using the on-premises data gateway. The gateway is required only if you're using an on-premises BizTalk Server, or a BizTalk Server on an Azure virtual machine that isn't exposed as an HTTP endpoint. |
| **Connection Name** | Enter a friendly name for the connection. |
| **BizTalk Server URL** | Enter the fully qualified domain name (FQDN) of the BizTalk Management in IIS application URL. For example, enter `http://BizTalkServerName.corp.contoso.com/IISLogicApp/`. |
| **Authentication Type** | Select **Windows**. |
| **Username** | Enter the identity of the IIS application pool. |
| **Password** | Enter the password of the IIS application pool. |
| **Gateway** | Select the Azure subscription associated with the gateway resource, and then select the gateway resource. |

5. Select **Create New**.
6. After the action information pane appears, provide the necessary details:

| Property | Description |
|---|---|
| **Body** | Select the HTTP body output. |
| **Schema** | Select the schema you want to use. |

> **Note**: This step assumes that you're familiar with schemas in BizTalk, and that you know which schema you want. If you're not sure, deploy the HelloWorld SDK sample, update its artifacts to use the Azure Logic Apps adapter, and use its schema and sample message.

7. [Add the BizTalkServer action named **Send message**](https://learn.microsoft.com/en-us/azure/logic-apps/create-workflow-with-trigger-or-action#add-action) to your workflow.

| Property | Description |
|---|---|
| **Receive Location** | From the list, select the URL, or enter the fully qualified domain name (FQDN) for the ReceiveService IIS application URL. For example, enter `http://BizTalkServerName.corp.contoso.com/ReceiveWCFService/Service1.svc`. |
| **Body** | Select the body output from the preceding BizTalk Server action. |

8. **Save** your workflow. This step automatically creates an endpoint URL, which appears in the Request trigger.
9. Copy and save the endpoint URL. You need this information for **Step 4: Send a message**.

### Step 3: Create a Receive Port and a Receive Location

> **Tip**: Rather than create your own receive ports and receive location, you can deploy the HelloWorld SDK sample, and then update the artifacts to use the Azure Logic Apps adapter.

1. In BizTalk Server Administration, expand: **BizTalk Server Administration > BizTalk Group > Applications**
2. Expand the application to use for running the receive location. For example, expand **BizTalk Application - Receive**.
3. From the **Receive Ports** shortcut menu, select **New**, and select **One-way Receive Port**.
4. In the Receive Port properties, enter the following information:

| Property | Description |
|---|---|
| **Name** | Enter a name for the receive port. For example, enter `LAReceivePort`. |
| **Authentication** | **No Authentication** (default): Disable authentication. **Drop messages if authentication fails**: Enable authentication but drops unauthenticated messages. **Keep messages if authentication fails**: Enable authentication and keep unauthenticated messages. |
| **Enable routing for failed messages** | Route any message that fails processing to a subscribing application. Clear this option to suspend failed messages and generate a negative acknowledgment (NACK). |

5. Select **Receive Locations**, and select **New**.
6. Enter a **Name** for the receive location. For example, enter `LAReceiveLoc`.
7. For **Type**, select **LogicApp**, and then select **Configure**.
8. On the **General** tab, set up the endpoint address for your logic app workflow:

| Property | Description |
|---|---|
| **Address (URI)** | Required. Enter the BizTalk ReceiveService IIS application URL. Format: `/{your-IIS-app2-name}/Service1.svc`. Example: `/ReceiveWCFService/Service1.svc`. |
| **Public Address** | Required. Format: `http://{fully-qualified-machine-name}/{your-IIS-App2-name}/Service1.svc`. Example: `http://btsProd.northamerica.corp.contoso.com/ReceiveWCFService/Service1.svc`. This exact URL is also listed in your logic app in the receive location. |

9. Optional. On the **Binding** tab, configure timeout and encoding-related properties:

| Property | Description |
|---|---|
| **Open timeout** | Default: `00:01:00`. Max: `23:59:59`. |
| **Send timeout** | Default: `00:01:00`. Max: `23:59:59`. |
| **Close timeout** | Default: `00:01:00`. Max: `23:59:59`. |
| **Maximum received message size (bytes)** | Default: `65536`. Max: `2147483647`. |
| **Maximum concurrent calls** | Default: `200`. Setting to `0` equals `Int32.MaxValue`. |

10. Optional. On the **Security** tab, configure security properties:

| Property | Description |
|---|---|
| **Security mode** | **None**: Messages aren't secured during transfer. **Transport**: Security provided using HTTPS. **TransportCredentialOnly**: Default. |
| **Transport client credential types** | **None**, **Basic**, **Digest**, **Ntlm** (default), **Windows**, or **Certificate**. |

11. Optional. On the **Messages** tab, use the **Outbound HTTP Headers** property to add custom headers, and use additional properties to help with faults:

| Property | Description |
|---|---|
| **Outbound HTTP Headers** | Enter any HTTP headers that you want stamped on the response message. |
| **Disable location on failure** | Disable the receive location if inbound processing fails. |
| **Suspend request message on failure** | Suspend the request message if inbound processing fails. |
| **Include exception detail in faults** | When an error occurs, return any SOAP faults to help debugging. |

For more receive port and location properties, see [Managing Receive Locations](https://learn.microsoft.com/en-us/biztalk/core/managing-receive-locations).

### Step 4: Send a Message

1. Open your tool for sending HTTP messages or requests.
2. Paste the endpoint URL that you saved from the Request trigger in your logic app workflow.
3. Select **POST** as the HTTP method. Set the `Content-type` header to `application/json`. In the request body, paste the following JSON:

```json
{"hello":"world"}
```

As the request is a one-way call to BizTalk, you should expect an HTTP 202 as the result.

4. If you're using the HelloWorld SDK sample, go to your BizTalk server. A file might exist in your send folder.

## Send Message to Logic App Workflow

### Step 1: Create a Logic App Workflow

1. In the [Azure portal](https://portal.azure.com/), create a new logic app resource and blank workflow.
2. [Add the Request trigger named **When an HTTP request is received**](https://learn.microsoft.com/en-us/azure/logic-apps/create-workflow-with-trigger-or-action#add-trigger) to your workflow.
3. [Add the Office 365 Outlook action named **Send an email**](https://learn.microsoft.com/en-us/azure/logic-apps/create-workflow-with-trigger-or-action#add-action) to your workflow.
4. If prompted, sign in to Office 365 Outlook.
5. On the action's connection pane, provide the following information:

| Property | Description |
|---|---|
| **To** | Enter your Office 365 email address. |
| **Subject** | Enter `Sending from BizTalk`. |
| **Body** | Select inside the edit box. When the lightning and function icons appear, select the lightning icon to open the dynamic content list. From the list, select a trigger output to include in the email. |

6. **Save** your workflow.
7. In the Request trigger information, copy the **HTTP URL**, which is automatically created when you save the workflow. You need this URL for the next step.

### Step 2: Create a Send Port

For BizTalk Server to send messages to a logic app workflow, the workflow must start with a `manual` trigger, such as **When a HTTP request is received**.

1. In BizTalk Server Administration, expand: **BizTalk Server Administration > BizTalk Group > Applications**
2. Expand the application to use for running the send port. For example, expand **BizTalk Application - Send**.
3. From the **Send Ports** shortcut menu, select **New**, and select **Static One-way Send Port**.
4. Enter a **Name** for the send port. For example, enter `LASendPort`.
5. From the **Type** list, select **LogicApp**, and select **Configure**.
6. On the **General** tab, provide the **Callback URI** for your logic app workflow trigger:

   - **Option 1**: In the **Trigger (Callback URI)** property, paste the previously copied HTTP URL.
   - **Option 2**: If you don't know the Callback URI, select **Configure**, sign in to Azure, and select the values for **Subscription**, **Resource Group**, **Logic App**, and **Trigger**.

> **Tip**: You can also use your Azure Resource Manager APIs to get this URI.

7. Optional. On the **Binding** tab, configure timeout and encoding-related properties:

| Property | Description |
|---|---|
| **Open timeout** | Default: `00:01:00`. Max: `23:59:59`. |
| **Send timeout** | Default: `00:01:00`. Max: `23:59:59`. |
| **Close timeout** | Default: `00:01:00`. Max: `23:59:59`. |
| **Maximum received message size (bytes)** | Default: `65536`. Max: `2147483647`. The Azure Logic Apps adapter uses the `WebHttpBinding` class in the buffered transfer mode. For the buffered transport mode, `WebHttpBinding.MaxBufferSize` is always equal to the value of this property. |

8. Optional. On the **Messages** tab, use the **Outbound HTTP Headers** property to add any custom headers on the outgoing message.
9. Select **OK** to save your configuration.

For more send port properties, see [Managing Send Ports and Send Port Groups](https://learn.microsoft.com/en-us/biztalk/core/managing-send-ports-and-send-port-groups).

### Step 3: Send Some Messages

You can create a receive port and a receive location by using the File adapter. Make sure that your logic app resource is enabled.

1. Create a receive port, for example, `FileSendPort`.
2. Create a receive location, and set the properties similar to the following example values:

| Property | Value |
|---|---|
| Receive folder | `C:\temp\In\` |
| File mask | `*.txt` |
| Pipeline | `PassThruReceive` |

3. In the send port that you previously created, set the **Filter** to the following:

| Property | Operator | Value |
|---|---|---|
| BTS.ReceivePortName | == | FileSendPort |

4. Create a text file named `{file-name}.txt` with the following text as your sample message:

```xml
<Data>
  <DataID>DataID_0</DataID>
  <DataDetails>DataDetails_0</DataDetails>
</Data>
```

5. Copy `{file-name}.txt` into the receive folder.

The send port sends the `.txt` file to the logic app workflow by using the URI that you provided. After your workflow receives the files, the workflow sends an email with the sample message to the specified To address.

## Next

- [What is Azure Logic Apps?](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview)
- [Create an example Consumption logic app workflow in multitenant Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/quickstart-create-first-logic-app-workflow)
- [Using adapters in BizTalk Server](https://learn.microsoft.com/en-us/biztalk/core/using-adapters)
