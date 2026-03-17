> **Source:** https://learn.microsoft.com/en-us/biztalk/core/tutorial-4-creating-a-hybrid-application-using-biztalk-server-2013

# Tutorial 4: Creating a Hybrid Application Using BizTalk Server 2013

This section provides a step-by-step walkthrough on how to create a hybrid application involving Microsoft Azure BizTalk Services and BizTalk Server.

## Business Scenario

Northwind is an enterprise that receives sales orders from its partners, one of them being Contoso, in the form of a flat-file EDI message. Northwind wants to set up an end-to-end application that does the following:

- **Manage the EDI message processing** – This module of the application must verify that the message received from Contoso conforms to the standard EDI message formats. This module must also generate all the required acknowledgements to verify that the message is successfully processed.
- **Use business logic to process the data** – Once the EDI message is successfully verified and processed, Northwind must run the message against business logic for further processing. For example, if the order quantity in the received message is more than a given amount, the data is stored in a SQL Server database. Otherwise, the data is sent to a shared file location.

To achieve this scenario, Northwind decides to set up a hybrid application where the EDI message processing is done on the cloud while the business-logic-driven data processing is done within the premises. To set up this hybrid application Northwind uses the following:

- **Microsoft Azure BizTalk Services** – The Azure BizTalk Portal available with Microsoft Azure BizTalk Services enables customers to configure trading partners and EDI agreements on Microsoft Azure. Northwind uses the Microsoft Azure BizTalk Services – April 2012 release to create and deploy an agreement that processes the incoming EDI message, validates it against the X12 840 sales order schema, transforms the message to a schema required by Northwind, and then sends the message to a Service Bus Queue. So, to develop a hybrid application, the data should be sent from the Service Bus Queue to an on-premises application.

- **BizTalk Server** – The new adapter for Service Bus (SB-Messaging) available with BizTalk Server enables applications to receive messages from Service Bus entities like Queues, Topics, and so on into BizTalk Server. As part of the BizTalk Server application, Northwind uses an orchestration to decide whether the quantity requested in the received sales order is more than 100. If the quantity is more than 100, the message is inserted into a SQL Server database table called **SalesOrder**. If the quantity is less than 100, the message is sent to a shared file location.

  To insert the message into a SQL Server database table, Northwind uses the Microsoft BizTalk Adapter for SQL Server available as part of the BizTalk Adapter Pack.

### End-to-end Message Flow

This is how the message flows through the hybrid application:

1. Contoso sends an X12 sales order message to the endpoint where the EDI agreement is deployed on the cloud.
2. After the message is successfully processed through the EDI agreement, it is sent to the Service Bus Queue.
3. SB-Messaging receive adapter consumes the message from the Service Bus Queue and instantiates the orchestration deployed in BizTalk Server to send the message to different destinations based on the order quantity.
4. If the quantity ordered is greater than 100, the orchestration inserts the message to a **SalesOrder** table. If the quantity ordered is less than or equal to 100, the message is written to a shared file location.

## Set up Your Computer

This tutorial requires you to perform four broad activities. The following table lists the activities and the software requirements for each activity:

| Activity | Software Requirements |
|---|---|
| Create the EDI artifacts required for the EDI agreement | This tutorial was created with the Microsoft Azure BizTalk Services – April 2012 release as well as the X12 840 sales order schema. These can be downloaded from https://go.microsoft.com/fwlink/p/?LinkId=235057. |
| Create and deploy the EDI agreement | Because the EDI agreement is deployed on Azure, you only need a Web browser (e.g. Internet Explorer) to log in to the Azure BizTalk Portal. |
| Build, deploy, and configure the BizTalk Server application | If you want to provision a BizTalk Server computer on an Azure VM, follow the instructions at https://msdn.microsoft.com/library/azure/jj248689.aspx. |
| Send a test message to the EDI agreement endpoint | You can use the MessageSender tool available in the samples package shipped with Microsoft Azure BizTalk Services. You can download the samples package from https://go.microsoft.com/fwlink/p/?LinkId=235057. |

You can opt to install all these on the same computer or on different computers.

## In This Section

- [Step 1 (For Azure): Create the EDI Project](https://learn.microsoft.com/en-us/biztalk/core/step-1-for-azure-create-the-edi-project)
- [Step 2 (For Azure): Create an EDI Agreement](https://learn.microsoft.com/en-us/biztalk/core/step-2-for-azure-create-an-edi-agreement)
- [Step 3 (For Azure): Create a Service Bus Queue](https://learn.microsoft.com/en-us/biztalk/core/step-3-for-azure-create-a-service-bus-queue)
- [Step 4 (On Premises): Create the SQL Server Table](https://learn.microsoft.com/en-us/biztalk/core/step-4-on-premises-create-the-sql-server-table)
- [Step 5 (On Premises): Generate the Schema for Inserting a Message into SalesOrder Table](https://learn.microsoft.com/en-us/biztalk/core/step-5-generate-the-schema-for-inserting-a-message-into-salesorder-table)
- [Step 6 (On Premises): Create a Transform to Map the Message from the Queue to the Insert Schema](https://learn.microsoft.com/en-us/biztalk/core/step-6-map-the-message-from-the-queue-to-the-insert-schema)
- [Step 7 (On Premises): Create an Orchestration](https://learn.microsoft.com/en-us/biztalk/core/step-7-on-premises-create-an-orchestration)
- [Step 8 (On Premises): Configure the BizTalk Server Application](https://learn.microsoft.com/en-us/biztalk/core/step-8-on-premises-configure-the-biztalk-server-application)
- [Step 9: Test the Solution](https://learn.microsoft.com/en-us/biztalk/core/step-9-test-the-solution)
