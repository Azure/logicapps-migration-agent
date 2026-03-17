> **Source:** https://learn.microsoft.com/en-us/biztalk/core/tutorial-integrating-biztalk-server-2013-with-salesforce

# Tutorial: Integrating BizTalk Server 2013 with Salesforce

Reviewers: [Nick Hauenstein](https://social.msdn.microsoft.com/profile/nick.hauenstein/), [Steef-Jan Wiggers](https://social.msdn.microsoft.com/profile/steef-jan%20wiggers)

BizTalk Server introduces some new adapters that make a lot of hybrid scenarios, involving on-premises and Azure technologies now possible. In this tutorial, we see how to integrate a purely cloud entity like Salesforce with an on-premises BizTalk Server using some of the new adapters and Microsoft Azure. Before we start, let's understand the business objective we try to achieve by integrating BizTalk Server with Salesforce.

We could also create hybrid solutions involving BizTalk Server and Salesforce with previous version of BizTalk Server, however the solution would be much more complex involving interaction with Salesforce by consuming a Web service (SOAP). With BizTalk Server and the new adapters, the solution is that much easier.

## Business Scenario

Northwind uses the Salesforce online CRM system as their solution for tracking customers through the sales pipeline. Every time a sales opportunity is created in the Salesforce system, Northwind wants its on-premise systems, such as BizTalk Server, to be notified so that other down-stream systems can pick up that data and start other relevant processes. Northwind plans to implement this solution using the new adapters available with BizTalk Server and also by including some components of Microsoft Azure. This is how the end-to-end data flow looks like for the solution:

- A sales representative creates an "opportunity" in the Salesforce system.
- When the status of the opportunity is set to "Closed Won", a notification is sent to a relay endpoint hosted on Microsoft Azure.
- Using the new WCF-BasicHttpRelay adapter, the notification information is passed on to BizTalk Server system housed on-premise.
- Using the information received as part of the notification, BizTalk Server invokes a REST endpoint in Salesforce, using the new WCF-WebHttp adapter, to get more information about the opportunity.
- Finally, BizTalk Server uses the information received from Salesforce to create a purchase order entry in an in-house SQL Server database table.

These are the set of steps that you must perform to achieve the integration objective outlined in this solution. Each of these steps involves broad set of activities that we'll look at as we proceed with creating the solution.

## Prerequisites

You must have the following software installed on the computer where you set up this solution:

- BizTalk Server
- Microsoft BizTalk ESB Toolkit
- WCF LOB Adapter SDK
- BizTalk Adapter Pack

You must have the following service subscriptions:

- A Microsoft Azure subscription
- Salesforce Developer Edition account

## More Resources

In addition to this tutorial, you can also look at the following resources to understand more about integrating BizTalk Server with Salesforce using the new adapters introduced in BizTalk Server.

- A virtual lab demonstrating BizTalk Server and Salesforce integration is available at [https://go.microsoft.com/fwlink/?LinkId=290930](https://go.microsoft.com/fwlink/?LinkId=290930).
- A sample based on this tutorial is available for download at [https://go.microsoft.com/fwlink/?LinkId=290932](https://learn.microsoft.com/en-us/samples/browse/).

## Next Steps

- [Step 1: Create a Service Bus Namespace](https://learn.microsoft.com/en-us/biztalk/core/step-1-create-a-service-bus-namespace)
- [Step 2: Set up the Salesforce System](https://learn.microsoft.com/en-us/biztalk/core/step-2-set-up-the-salesforce-system)
- [Step 3: Create the BizTalk Server Solution in Visual Studio](https://learn.microsoft.com/en-us/biztalk/core/step-3-create-the-biztalk-server-solution-in-visual-studio)
- [Step 4: Configure the BizTalk Server Solution](https://learn.microsoft.com/en-us/biztalk/core/step-4-configure-the-biztalk-server-solution)
- [Step 5: Test the Solution](https://learn.microsoft.com/en-us/biztalk/core/step-5-test-the-solution)

## See Also

- [BizTalk Server Tutorials](https://learn.microsoft.com/en-us/biztalk/core/biztalk-server-tutorials)
