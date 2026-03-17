> **Source:** https://learn.microsoft.com/en-us/biztalk/core/tutorial-5-invoking-a-rest-interface-using-biztalk-server

# Tutorial 5: Invoking a REST Interface Using BizTalk Server

This section provides a step-by-step walkthrough on how to invoke a REST endpoint using BizTalk Server. In this tutorial you invoke a REST endpoint available from the Microsoft Azure Marketplace that returns the delays in flights of US air carriers. The tutorial uses the new WCF-WebHttp adapter introduced in BizTalk Server to invoke the REST endpoint.

## Scenario Used in This Tutorial

Microsoft Azure Marketplace provides the following REST resource URL to retrieve flight delays of US air carriers:

```
https://api.datamarket.azure.com/oakleaf/US_Air_Carrier_Flight_Delays_Incr/On_Time_Performance
```

If you enter this URL in your web browser, you are prompted for credentials to access the resource. After you sign in to the [Microsoft Azure Marketplace](https://azuremarketplace.microsoft.com/), you can get the credentials from the **My Account** tab on the web page. The credentials are listed against the **Customer ID** (user name) and **Primary Account Key** (password) labels.

In this tutorial, you use the resource URL and the credentials to configure a two-way **WCF-WebHttp** send port. The receive pipeline of the two-way send port receives the response message with the flight details and publishes the message to the BizTalk Server message box database. You configure a FILE send port that subscribes to all the messages published by the WCF-WebHttp send port. The FILE send port consumes the message from the BizTalk Server and copies it to a file location.

In a real-world business scenario, the WCF-WebHttp send port can be triggered by associating it with a larger business process such as a receive location that gets a message from a business application. However, in this tutorial, because the focus is on demonstrating how to invoke a REST interface, you can use a simple FILE location that receives a dummy message to trigger the send port.

So, to summarize, you must perform the following steps to configure this solution:

1. Configure a FILE receive location to pick a dummy request message.
2. Configure a two-way WCF-WebHttp send port to invoke the REST resource URL and receive a response.
3. Configure a one-way FILE send port to consume the response message with the flight details and copy it to a file location.

## Set up Your Microsoft Azure Marketplace Account

To access the flight delay data exposed through the REST endpoint, you must first subscribe to the US Air Carrier Flight Delays sample data feed. Perform the following steps to do so:

#### To subscribe to the data feed

1. Log in to the Microsoft Azure Marketplace using your Microsoft account.
2. In the **Data** tab, locate and click the **US Air Carrier Flight Delays** service.
3. On the data service page, click **Sign Up**. On the Sign Up page, accept the terms of agreement and then click **Sign up** again.
4. In the **My Account** tab, retrieve the credentials to access the data service. The credentials are listed against the **Customer ID** (user name) and **Primary Account Key** (password) labels. You will need these credentials while configuring the WCF-WebHttp send port.

## Set up Your Computer

To configure the scenario used in this tutorial you must have BizTalk Server installed and configured on your computer. If you want to provision a BizTalk Server computer on a Windows Azure VM, follow the instructions at [Configuring BizTalk Server on an Azure VM](https://learn.microsoft.com/en-us/previous-versions/azure/jj248689(v=azure.100)).

## In This Section

- [Step 1: Configure a FILE Receive Location](https://learn.microsoft.com/en-us/biztalk/core/step-1-configure-a-file-receive-location)
- [Step 2: Configure a Two-way WCF-WebHttp Send Port](https://learn.microsoft.com/en-us/biztalk/core/step-2-configure-a-two-way-wcf-webhttp-send-port)
- [Step 3: Configure a One-way FILE Send Port](https://learn.microsoft.com/en-us/biztalk/core/step-3-configure-a-one-way-file-send-port)
- [Step 4: Test the Solution](https://learn.microsoft.com/en-us/biztalk/core/step-4-test-the-solution)
