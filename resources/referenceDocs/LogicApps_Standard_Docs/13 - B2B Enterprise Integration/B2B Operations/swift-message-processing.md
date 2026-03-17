<!-- Source: https://techcommunity.microsoft.com/t5/azure-integration-services-blog/announcement-public-preview-of-swift-message-processing-using/ba-p/3670014 -->

## Blog PostAzure Integration Services Blog 3 MIN READ# !! Announcement !! Public Preview of SWIFT message processing using Azure Logic Apps[![DivSwa's avatar](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/dS0xNTYxNTYzLTQxNzI3NmlGRjYyMDM2MjI1MjVFMjhD?image-dimensions=50x50)](https://learn.microsoft.com/users/divswa/1561563)[DivSwa](https://learn.microsoft.com/users/divswa/1561563)![Icon for Microsoft rank](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/cmstNC05WEo0blc?image-dimensions=100x16&constrain-image=true)MicrosoftNov 04, 2022# SWIFT message processing using Azure Logic Apps

 

We are very excited to announce the **Public Preview of SWIFT MT encoder and decoder for Azure Logic Apps**. This release will enable customers to process SWIFT based payment transactions with Logic Apps Standard and build cloud native applications with full security, isolation and VNET integration.

 

## What is SWIFT

SWIFT is the Society for Worldwide Interbank Financial Telecommunication (SWIFT) is a global member-owned cooperative that provides a secure network that enables financial institutions worldwide to send and receive financial transactions in a safe, standardized, and reliable environment. The SWIFT group develops several message standards to support business transactions in the financial market. One of the longest established and widely used formats supported by the financial community is SWIFT MT and it is used by SWIFT proprietary FIN messaging service.

 

SWIFT network is used globally by more than 11,000 financial institutions in 200 regions/countries. These institutions pay SWIFT annual fees as well as based on the processing of financial transactions. Failures in the processing in SWIFT network create delays and result in penalties. This is where Logic Apps enables customers to send/receive these transactions as per the standard as well as proactively address these issues.

 

Azure Logic Apps enables you to easily create SWIFT workloads to automate their processing, thereby reducing errors and costs. With Logic Apps Standard, these workloads can run on cloud or in isolated environments within VNET. With built-in and Azure connectors, we offer 600+ connectors to a variety of applications, on-premises or on cloud. Logic Apps is gateway to Azure – with the rich AI and ML capabilities, customers can further create business insights to help their business.

##  
## SWIFT capabilities in Azure Logic Apps

The SWIFT connector has two actions – Encoder and Decoder for MT messages. There are two key capabilities of the connector – transformation of the message from flat file to XML and viceversa. Secondly, the connector performs message validation based on the SWIFT guidelines as described in the SRG (SWIFT Release Guide). The SWIFT MT actions support the processing of all categories of MT messages.

 

## How to use SWIFT in Logic Apps

In this example we are listing the steps to receive an MT flat file message, decode to MT XML format, and then send it to downstream application

 

- SWIFT support is only available in the ‘Standard’ SKU of Azure Logic Apps. Create a standard Logic App
- Add a new workflow. You can choose stateful or stateless workflow.
- Create the first step of your workflow which is also the trigger, depending on the source of your MT message. We are using a Request based trigger.
- Choose the SWIFT connector under Built-in tab. Add the action ‘SWIFT Encode’ as a next step. This step will transform the MT XML message (sample is attached) to MT flat file format.

![DivSwa_3-1667602325952.png](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS0zNjcwMDE0LTQxNzI4MGkzRDdFNzQwQkVGRDk0MDJD?image-dimensions=435x458&revision=5)

 

![DivSwa_4-1667602382992.png](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS0zNjcwMDE0LTQxNzI4MWlCOEYxRTJGMjIwMzI4MDk5?image-dimensions=732x320&revision=5)

 

By default, the action does message validation based on the SWIFT Release Guide specification. It can be disabled via the Message validation drop-down

- For scenarios where you are receiving a SWIFT MT message as flat file (sample is attached) from SWIFT network, you can use SWIFT decode action to validate and transform the message to MT XML format

 

![DivSwa_5-1667602443085.png](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS0zNjcwMDE0LTQxNzI4M2lBNTBFMERDMTE5NUY0QjYx?image-dimensions=811x500&revision=5)

 

## Note regarding local development or VSCode support

The VSCode updates will be available towards the end of the month. Until then, please use Azure portal for building your Logic Apps. We will be updating this article when the update is released.

 

## Advanced Scenarios

For now, you need to contact us if you have any scenarios described below. We plan to document them soon so this is a short term friction.

SWIFT processing within VNET

- To perform message validation, Logic Apps runtime leverages artifacts that are hosted on a public endpoint. If you want to limit calls to the internet, and want to do all the processing within VNET, you need to override the location of those artifacts with an endpoint within your VNET. Please reach out to us and we can share instructions.

 

BIC (Bank Identifier Code) validation

- By default, BIC validation is disabled. If you would like to enable BIC validation, please reach out to us and we can share instructions

Updated Nov 07, 2022Version 2.0[SWIFTSampleFiles.zip2 KB](https://techcommunity.microsoft.com/t5/s/gxcuf89792/attachments/gxcuf89792/IntegrationsonAzureBlog/302/1/SWIFTSampleFiles.zip)[](https://techcommunity.microsoft.com/t5/s/gxcuf89792/attachments/gxcuf89792/IntegrationsonAzureBlog/302/1/SWIFTSampleFiles.zip)[logic apps](https://learn.microsoft.com/tag/logic%20apps?nodeId=board%3AIntegrationsonAzureBlog)[serverless](https://learn.microsoft.com/tag/serverless?nodeId=board%3AIntegrationsonAzureBlog)CommentComment[![DivSwa's avatar](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/dS0xNTYxNTYzLTQxNzI3NmlGRjYyMDM2MjI1MjVFMjhD?image-dimensions=50x50)](https://learn.microsoft.com/users/divswa/1561563)[DivSwa](https://learn.microsoft.com/users/divswa/1561563)![Icon for Microsoft rank](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/cmstNC05WEo0blc?image-dimensions=100x16&constrain-image=true)MicrosoftJoined October 11, 2022Send Message[View Profile](https://learn.microsoft.com/users/divswa/1561563)[](https://learn.microsoft.com/category/azure/blog/integrationsonazureblog)[Azure Integration Services Blog ](https://learn.microsoft.com/category/azure/blog/integrationsonazureblog)Follow this blog board to get notified when there's new activity