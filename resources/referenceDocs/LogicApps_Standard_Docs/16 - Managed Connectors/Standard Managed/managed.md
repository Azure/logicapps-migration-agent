<!-- Source: https://learn.microsoft.com/en-us/azure/connectors/managed -->
<!-- Title: Managed connector overview -->

# Managed connectors in Azure Logic Apps

Managed connectors provide ways for you to access other services and systems where built-in connectors aren't available. You can use these triggers and actions to create workflows that integrate data, apps, cloud-based services, and on-premises systems. Different from built-in connectors, managed connectors are usually tied to a specific service or system such as Office 365, SharePoint, Azure Key Vault, Salesforce, Azure Automation, and so on. Managed by Microsoft and hosted in Azure, managed connectors usually require that you first create a connection from your workflow and authenticate your identity.

For a smaller number of services, systems and protocols, Azure Logic Apps provides a built-in version alongside the managed version. The number and range of built-in connectors vary based on whether you create a Consumption logic app workflow that runs in multitenant Azure Logic Apps or a Standard logic app workflow that runs in single-tenant Azure Logic Apps. In most cases, the built-in version provides better performance, capabilities, pricing, and so on. In a few cases, some built-in connectors are available only in one logic app workflow type, and not the other.

For example, a Standard workflow can use both managed connectors and built-in connectors for Azure Blob, Azure Cosmos DB, Azure Event Hubs, Azure Service Bus, DB2, FTP, MQ, SFTP, and SQL Server, while a Consumption workflow doesn't have the built-in versions. A Consumption workflow can use built-in connectors for Azure API Management, Azure App Services, and Batch, while a Standard workflow doesn't have these built-in connectors. For more information, review [Built-in connectors in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/connectors/built-in) and [Single-tenant versus multitenant in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/single-tenant-overview-compare).

This article provides a general overview about managed connectors and the way they're organized in the Consumption workflow designer versus the Standard workflow designer with examples. For technical reference information about each managed connector in Azure Logic Apps, review [Connectors reference for Azure Logic Apps](https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-logicapps-connectors).

## Managed connector categories

For a Consumption logic app workflow, managed connectors appear in the designer under the following labels:

* [Standard connectors](#standard-connectors) provide access to services such as Azure Blob Storage, Office 365, SharePoint, Salesforce, Power BI, OneDrive, and many more.

* [Enterprise connectors](#enterprise-connectors) provide access to enterprise systems, such as SAP, IBM MQ, and IBM 3270 for an additional cost.

For a Standard logic app *stateful* workflow, all managed connectors appear in the designer under the **Azure** label, which describes how these connectors are hosted on the Azure platform. A Standard *stateless* workflow can use only the built-in connectors designed to run natively in single-tenant Azure Logic Apps.

Regardless whether you have a Consumption or Standard workflow, managed connector pricing follows the pricing for Enterprise connectors and Standard connectors, but metering works differently based on the workflow type. For more pricing information, review [Trigger and action operations in the Consumption model](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-pricing.md#consumption-operations) and [Trigger and action operations in the Standard model](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-pricing.md#standard-operations).

Some managed connectors also fall into the following informal groups:

* [On-premises connectors](#on-premises-connectors) provide access to on-premises systems such as SQL Server, SharePoint Server, SAP, Oracle DB, file shares, and others.

* [Integration account connectors](#integration-account-connectors) help you transform and validate XML, encode and decode flat files, and process business-to-business (B2B) messages using AS2, EDIFACT, and X12 protocols.

<a name="standard-connectors"></a>

## Standard connectors

In the Consumption workflow designer, managed connectors that follow the Standard connector pricing model appear under the **Standard** label. This section lists *only some* of the popular managed connectors. For more pricing information, review [Trigger and action operations in the Consumption model](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-pricing.md#consumption-operations).

In the Standard workflow designer, *all* managed connectors appear under the **Azure** label. Managed connector pricing still follows the pricing for Enterprise connectors and Standard connectors, but metering works differently based on the workflow type. For more pricing information, review [Trigger and action operations in the Standard model](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-pricing.md#standard-operations).

        [![Azure Blob Storage icon][azure-blob-storage-icon]][azure-blob-storage-doc]
        <br><br>[**Azure Blob Storage**][azure-blob-storage-doc]
        <br><br>Connect to your Azure Storage account so that you can create and manage blob content.

        [![Azure Event Hubs icon][azure-event-hubs-icon]][azure-event-hubs-doc]
        <br><br>[**Azure Event Hubs**][azure-event-hubs-doc]
        <br><br>Consume and publish events through an event hub. For example, get output from your workflow with Event Hubs, and then send that output to a real-time analytics provider.

        [![Azure Queues icon][azure-queues-icon]][azure-queues-doc]
        <br><br>[**Azure Queues**][azure-queues-doc]
        <br><br>Connect to your Azure Storage account so that you can create and manage queues and messages.

        [![Azure Service Bus icon][azure-service-bus-icon]][azure-service-bus-doc]
        <br><br>[**Azure Service Bus**][azure-service-bus-doc]
        <br><br>Manage asynchronous messages, sessions, and topic subscriptions with the most commonly used connector in Logic Apps.

        [![Azure Table Storage icon][azure-table-storage-icon]][azure-table-storage-doc]
        <br><br>[**Azure Table Storage**][azure-table-storage-doc]
        <br><br>Connect to your Azure Storage account so that you can create, update, query, and manage tables.

        [![File System icon][file-system-icon]][file-system-doc]
        <br><br>[**File System**][file-system-doc]
        <br><br>Connect to your on-premises file share so that you can create and manage files.

        [![FTP icon][ftp-icon]][ftp-doc]
        <br><br>[**FTP**][ftp-doc]
        <br><br>Connect to FTP servers you can access from the internet so that you can work with your files and folders.

        [![Office 365 Outlook icon][office-365-outlook-icon]][office-365-outlook-doc]
        <br><br>[**Office 365 Outlook**][office-365-outlook-doc]
        <br><br>Connect to your work or school email account so that you can create and manage emails, tasks, calendar events and meetings, contacts, requests, and more.

        [![Salesforce icon][salesforce-icon]][salesforce-doc]
        <br><br>[**Salesforce**][salesforce-doc]
        <br><br>Connect to your Salesforce account so that you can create and manage items such as records, jobs, objects, and more.

        [![SharePoint Online icon][sharepoint-online-icon]][sharepoint-online-doc]
        <br><br>[**SharePoint Online**][sharepoint-online-doc]
        <br><br>Connect to SharePoint Online so that you can manage files, attachments, folders, and more.

        [![SFTP-SSH icon][sftp-ssh-icon]][sftp-ssh-doc]
        <br><br>[**SFTP-SSH**][sftp-ssh-doc]
        <br><br>Connect to SFTP servers that you can access from the internet by using SSH so that you can work with your files and folders.

        [![SQL Server icon][sql-server-icon]][sql-server-doc]
        <br><br>[**SQL Server**][sql-server-doc]
        <br><br>Connect to your SQL Server on premises or an Azure SQL Database in the cloud so that you can manage records, run stored procedures, or perform queries.

<a name="enterprise-connectors"></a>

## Enterprise connectors

In the Consumption workflow designer, managed connectors that follow the Enterprise connector pricing model appear under the **Enterprise** label. These connectors can access enterprise systems for an additional cost. For more pricing information, review [Trigger and action operations in the Consumption model](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-pricing.md#consumption-operations).

In the Standard workflow designer, *all* managed connectors appear under the **Azure** label. Managed connector pricing still follows the pricing for Enterprise connectors and Standard connectors, but metering works differently based on the workflow type. For more pricing information, review [Trigger and action operations in the Standard model](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-pricing.md#standard-operations).

        [![IBM 3270 icon][ibm-3270-icon]][ibm-3270-doc]
        <br><br>[**IBM 3270**][ibm-3270-doc]

        [![IBM MQ icon][ibm-mq-icon]][ibm-mq-doc]
        <br><br>[**MQ**][ibm-mq-doc]

        [![SAP icon][sap-icon]][sap-connector-doc]
        <br><br>[**SAP**][sap-connector-doc]

<a name="on-premises-connectors"></a>

## On-premises connectors

Before you can create a connection to an on-premises system, you must first [download, install, and set up an on-premises data gateway][gateway-doc]. This gateway provides a secure communication channel without having to set up the necessary network infrastructure.

For a Consumption workflow, this section lists example [Standard connectors](#standard-connectors) that can access on-premises systems. For the expanded on-premises connectors list, review [Supported data sources](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-gateway-connection.md#supported-connections).

        [![Apache Impala][apache-impala-icon]][apache-impala-doc]
        <br><br>[**Apache Impala**][apache-impala-doc]

        [![Biztalk Server icon][biztalk-server-icon]][biztalk-server-doc]
        <br><br>[**Biztalk Server**][biztalk-server-doc]

        [![File System icon][file-system-icon]][file-system-doc]
        <br><br>[**File System**][file-system-doc]

        [![IBM DB2 icon][ibm-db2-icon]][ibm-db2-doc]
        <br><br>[**IBM DB2**][ibm-db2-doc]

        [![IBM Informix icon][ibm-informix-icon]][ibm-informix-doc]
        <br><br>[**IBM Informix**][ibm-informix-doc]

        [![MySQL icon][mysql-icon]][mysql-doc]
        <br><br>[**MySQL**][mysql-doc]

        [![Oracle DB icon][oracle-db-icon]][oracle-db-doc]
        <br><br>[**Oracle DB**][oracle-db-doc]

        [![PostgreSQL icon][postgre-sql-icon]][postgre-sql-doc]
        <br><br>[**PostgreSQL**][postgre-sql-doc]

        [![SAP icon][sap-icon]][sap-connector-doc]
        <br><br>[**SAP**][sap-connector-doc]

        [![SharePoint Server icon][sharepoint-server-icon]][sharepoint-server-doc]
        <br><br>[**SharePoint Server**][sharepoint-server-doc]

        [![SQL Server icon][sql-server-icon]][sql-server-doc]
        <br><br>[**SQL Server**][sql-server-doc]

        [![Teradata icon][teradata-icon]][teradata-doc]
        <br><br>[**Teradata**][teradata-doc]

<a name="integration-account-connectors"></a>

## Integration account connectors

Integration account operations support business-to-business (B2B) communication scenarios in Azure Logic Apps. After you create an integration account and define your B2B artifacts, such as trading partners, agreements, and others, you can use integration account connectors to encode and decode messages, transform content, and more.

For example, if you use Microsoft BizTalk Server, you can create a connection from your workflow using the [on-premises BizTalk Server connector](https://learn.microsoft.com/en-us/connectors/biztalk/). You can then extend or perform BizTalk-like operations in your workflow by using these integration account connectors.

* Consumption workflows

  Before you use any integration account operations in a Consumption workflow, you have to [link your logic app resource to your integration account](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-create-integration-account).

* Standard workflows

  Integration account operations don't require that you link your logic app resource to your integration account. Instead, you create a connection to your integration account when you add the operation to your Standard workflow.

For more information, review the following documentation:

* [Business-to-business (B2B) enterprise integration workflows](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-overview)
* [Create and manage integration accounts for B2B workflows](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-create-integration-account)

        [![AS2 Decode v2 icon][as2-v2-icon]][as2-doc]
        <br><br>[**AS2 Decode (v2)**][as2-doc]

        [![AS2 Encode (v2) icon][as2-v2-icon]][as2-doc]
        <br><br>[**AS2 Encode (v2)**][as2-doc]

        [![AS2 decoding icon][as2-icon]][as2-doc]
        <br><br>[**AS2 decoding**][as2-doc]

        [![AS2 encoding icon][as2-icon]][as2-doc]
        <br><br>[**AS2 encoding**][as2-doc]

        [![EDIFACT decoding icon][edifact-icon]][edifact-decode-doc]
        <br><br>[**EDIFACT decoding**][edifact-decode-doc]

        [![EDIFACT encoding icon][edifact-icon]][edifact-encode-doc]
        <br><br>[**EDIFACT encoding**][edifact-encode-doc]

        [![X12 decoding icon][x12-icon]][x12-decode-doc]
        <br><br>[**X12 decoding**][x12-decode-doc]

        [![X12 encoding icon][x12-icon]][x12-encode-doc]
        <br><br>[**X12 encoding**][x12-encode-doc]

## Next steps


> [Create custom APIs you can call from Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-create-api-app)

<!--Managed connector icons-->
[apache-impala-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/apache-impala.png
[appfigures-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/appfigures.png
[asana-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/asana.png
[azure-automation-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-automation.png
[azure-blob-storage-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-blob-storage.png
[azure-cognitive-services-text-analytics-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-cognitive-services-text-analytics.png
[azure-cosmos-db-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-cosmos-db.png
[azure-data-lake-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-data-lake.png
[azure-devops-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-devops.png
[azure-document-db-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-document-db.png
[azure-event-grid-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-event-grid.png
[azure-event-grid-publish-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-event-grid-publish.png
[azure-event-hubs-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-event-hubs.png
[azure-file-storage-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-file-storage.png
[azure-key-vault-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-key-vault.png
[azure-ml-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-ml.png
[azure-monitor-logs-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-monitor-logs.png
[azure-queues-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-queue-storage.png
[azure-resource-manager-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-resource-manager.png
[azure-service-bus-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-service-bus.png
[azure-sql-data-warehouse-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-sql-data-warehouse.png
[azure-table-storage-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/azure-table-storage.png
[basecamp-3-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/basecamp.png
[bitbucket-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/bitbucket.png
[bitly-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/bitly.png
[biztalk-server-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/biztalk.png
[blogger-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/blogger.png
[campfire-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/campfire.png
[common-data-service-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/common-data-service.png
[dynamics-365-financials-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/dynamics-365-financials.png
[dynamics-365-operations-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/dynamics-365-operations.png
[easy-redmine-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/easyredmine.png
[file-system-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/file-system.png
[ftp-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/ftp.png
[github-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/github.png
[google-calendar-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/google-calendar.png
[google-drive-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/google-drive.png
[google-sheets-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/google-sheet.png
[google-tasks-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/google-tasks.png
[hipchat-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/hipchat.png
[ibm-3270-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/ibm-3270.png
[ibm-db2-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/ibm-db2.png
[ibm-informix-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/ibm-informix.png
[ibm-mq-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/ibm-mq.png
[insightly-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/insightly.png
[instagram-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/instagram.png
[instapaper-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/instapaper.png
[jira-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/jira.png
[mandrill-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/mandrill.png
[mysql-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/mysql.png
[office-365-outlook-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/office-365.png
[onedrive-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/onedrive.png
[onedrive-for-business-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/onedrive-business.png
[oracle-db-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/oracle-db.png
[outlook.com-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/outlook.png
[pagerduty-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/pagerduty.png
[pinterest-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/pinterest.png
[postgre-sql-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/postgre-sql.png
[project-online-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/projecton-line.png
[redmine-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/redmine.png
[salesforce-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/salesforce.png
[sap-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/sap.png
[send-grid-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/sendgrid.png
[sftp-ssh-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/sftp.png
[sharepoint-online-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/sharepoint-online.png
[sharepoint-server-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/sharepoint-server.png
[slack-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/slack.png
[smartsheet-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/smartsheet.png
[smtp-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/smtp.png
[sparkpost-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/sparkpost.png
[sql-server-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/sql.png
[teradata-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/teradata.png
[todoist-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/todoist.png
[twilio-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/twilio.png
[vimeo-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/vimeo.png
[wordpress-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/wordpress.png
[youtube-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/youtube.png

<!--Managed connector doc links-->
[apache-impala-doc]: https://learn.microsoft.com/en-us/connectors/impala/ "Connect to your Impala database to read data from tables"
[azure-automation-doc]: https://learn.microsoft.com/en-us/connectors/azureautomation/ "Create and manage automation jobs for your cloud and on-premises infrastructure"
[azure-blob-storage-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-azureblobstorage "Manage files in your blob container with Azure blob storage connector"
[azure-cosmos-db-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-cosmos-db "Connect to Azure Cosmos DB so that you can access and manage Azure Cosmos DB documents"
[azure-event-grid-doc]: https://learn.microsoft.com/en-us/azure/event-grid/monitor-virtual-machine-changes-logic-app "Monitor events published by an Event Grid, for example, when Azure resources or third-party resources change"
[azure-event-hubs-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-azure-event-hubs "Connect to Azure Event Hubs so that you can receive and send events between logic app workflows and Event Hubs"
[azure-file-storage-doc]: https://learn.microsoft.com/en-us/connectors/azurefile/ "Connect to your Azure Storage account so that you can create, update, get, and delete files"
[azure-key-vault-doc]: https://learn.microsoft.com/en-us/connectors/keyvault/ "Connect to your Azure Key Vault so that you can manage your secrets and keys"
[azure-monitor-logs-doc]: https://learn.microsoft.com/en-us/connectors/azuremonitorlogs/ "Run queries against Azure Monitor Logs across Log Analytics workspaces and Application Insights components"
[azure-queues-doc]: https://learn.microsoft.com/en-us/connectors/azurequeues/ "Connect to your Azure Storage account so that you can create and manage queues and messages"
[azure-service-bus-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-servicebus "Manage messages from Service Bus queues, topics, and topic subscriptions"
[azure-sql-data-warehouse-doc]: https://learn.microsoft.com/en-us/connectors/sqldw/ "Connect to Azure Synapse Analytics so that you can view your data"
[azure-table-storage-doc]: https://learn.microsoft.com/en-us/connectors/azuretables/ "Connect to your Azure Storage account so that you can create, update, and query tables and more"
[biztalk-server-doc]: https://learn.microsoft.com/en-us/connectors/biztalk/ "Connect to your BizTalk Server so that you can run BizTalk-based applications side by side with Azure Logic Apps"
[file-system-doc]: file-system.md "Connect to an on-premises file system"
[ftp-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-ftp "Connect to an FTP / FTPS server for FTP tasks, like uploading, getting, deleting files, and more"
[github-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-github "Connect to GitHub and track issues"
[google-calendar-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-googlecalendar "Connects to Google Calendar and can manage calendar"
[google-sheets-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-googlesheet "Connect to Google Sheets so that you can modify your sheets"
[google-tasks-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-googletasks "Connects to Google Tasks so that you can manage your tasks"
[ibm-3270-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-run-3270-apps-ibm-mainframe-create-api-3270 "Connect to 3270 apps on IBM mainframes"
[ibm-db2-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-db2 "Connect to IBM DB2 in the cloud or on-premises. Update a row, get a table, and more"
[ibm-informix-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-informix "Connect to Informix in the cloud or on-premises. Read a row, list the tables, and more"
[ibm-mq-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-mq "Connect to IBM MQ on-premises or in Azure to send and receive messages"
[instagram-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-instagram "Connect to Instagram. Trigger or act on events"
[mandrill-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-mandrill "Connect to Mandrill for communication"
[mysql-doc]: https://learn.microsoft.com/en-us/connectors/mysql/ "Connect to your on-premises MySQL database so that you can read and write data"
[office-365-outlook-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-office365-outlook "Connect to your work or school account so that you can send and receive emails, manage your calendar and contacts, and more"
[onedrive-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-onedrive "Connect to your personal Microsoft OneDrive so that you can upload, delete, list files, and more"
[onedrive-for-business-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-onedriveforbusiness "Connect to your business Microsoft OneDrive so that you can upload, delete, list your files, and more"
[oracle-db-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-oracledatabase "Connect to an Oracle database so that you can add, insert, delete rows, and more"
[outlook.com-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-outlook "Connect to your Outlook mailbox so that you can manage your email, calendars, contacts, and more"
[postgre-sql-doc]: https://learn.microsoft.com/en-us/connectors/postgresql/ "Connect to your PostgreSQL database so that you can read data from tables"
[salesforce-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-salesforce "Connect to your Salesforce account. Manage accounts, leads, opportunities, and more"
[sap-connector-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-using-sap-connector "Connect to an on-premises SAP system"
[sendgrid-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-sendgrid "Connect to SendGrid. Send email and manage recipient lists"
[sftp-ssh-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-sftp-ssh "Connect to your SFTP account by using SSH. Upload, get, delete files, and more"
[sharepoint-server-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-sharepoint "Connect to SharePoint on-premises server. Manage documents, list items, and more"
[sharepoint-online-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-sharepoint "Connect to SharePoint Online. Manage documents, list items, and more"
[slack-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-slack "Connect to Slack and post messages to Slack channels"
[smtp-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-smtp "Connect to an SMTP server and send email with attachments"
[sparkpost-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-sparkpost "Connects to SparkPost for communication"
[sql-server-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-sqlazure "Connect to Azure SQL Database or SQL Server. Create, update, get, and delete entries in an SQL database table"
[teradata-doc]: https://learn.microsoft.com/en-us/connectors/teradata/ "Connect to your Teradata database to read data from tables"
[twilio-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-twilio "Connect to Twilio. Send and get messages, get available numbers, manage incoming phone numbers, and more"
[youtube-doc]: https://learn.microsoft.com/en-us/azure/connectors/connectors-create-api-youtube "Connect to YouTube. Manage your videos and channels"

<!--Integration account connector icons -->
[as2-v2-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/as2-v2.png
[as2-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/as2.png
[edifact-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/edifact.png
[x12-icon]: https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/connectors/media/apis-list/x12.png

<!-- Integration account connector docs -->
[as2-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-as2 "Encode and decode messages that use the AS2 protocol"
[edifact-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-edifact "Encode and decode messages that use the EDIFACT protocol"
[edifact-decode-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-edifact "Decode messages that use the EDIFACT protocol"
[edifact-encode-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-edifact "Encode messages that use the EDIFACT protocol"
[x12-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-x12 "Encode and decode messages that use the X12 protocol"
[x12-decode-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-X12-decode "Decode messages that use the X12 protocol"
[x12-encode-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-enterprise-integration-X12-encode "Encode messages that use the X12 protocol"

<!--Other doc links-->
[gateway-doc]: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-gateway-connection "Connect to data sources on-premises from logic app workflows with on-premises data gateway"
