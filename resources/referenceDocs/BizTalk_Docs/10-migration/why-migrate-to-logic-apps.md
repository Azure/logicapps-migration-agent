> **Source:** https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-to-azure-integration-services-overview

# Why Migrate from BizTalk Server to Azure Logic Apps?

This guide provides an overview about the reasons and benefits, product comparisons, capabilities, and other information to help you start migrating from on-premises BizTalk Server to Azure Logic Apps. Following this guide, you'll find more guides that cover how to choose the services that best fit your scenario along with migration strategies, planning considerations, and best practices to help you deliver successful results.

## Reasons and Benefits

By migrating your integration workloads to Azure Logic Apps, you can reap the following primary benefits:

| Benefit | Description |
|---------|-------------|
| **Modern integration platform as a service (iPaaS)** | Azure Logic Apps is part of Azure Integration Services, which provides capabilities that didn't exist when BizTalk Server was originally built, for example: the capability to create and manage REST APIs, scalable cloud infrastructure, authentication schemes that are modern, more secure, and easier to implement, simplified development tools including many web browser-based experiences, automatic platform updates and integration with other cloud-native services, and the ability to run on premises (Azure Logic Apps hybrid deployment model). |
| **BizTalk feature investments** | Azure Logic Apps, the successor to BizTalk Server, includes some core BizTalk Server capabilities. For example, the Azure Logic Apps Rules Engine uses the same runtime as the BizTalk Business Rules Engine (BRE). To help you preserve customer investments in BizTalk Server, the workflow designer in Azure Logic Apps includes additional capabilities such as the Data Mapper tool when you use Visual Studio Code, support for running custom code, and native XML support. |
| **Consumption-based pricing** | With traditional middleware platforms, you must often make significant capital investments in procuring licenses and infrastructure, forcing you to "build for peak" and creating inefficiencies. Azure Integration Services provides multiple pricing models that generally let you pay for what you use. |
| **Lower barrier to entry** | BizTalk Server is a very capable middleware broker but requires significant time to learn and gain proficiency. Azure Logic Apps reduces the time required to start, learn, build, and deliver solutions. For example, Azure Logic Apps includes a visual designer that gives you a no-code or low-code experience for building the declarative workflows that you want to replace BizTalk orchestrations. |
| **SaaS connectivity** | Microsoft has built an expansive and continually growing connector ecosystem with hundreds of APIs to work with Microsoft and non-Microsoft services, systems, and protocols. In Azure Logic Apps, you can use the workflow designer to select operations from these connectors, easily create and authenticate connections, and configure the operations they want to use. |
| **Multiple geographical deployments** | Azure currently offers 60+ announced regions, more than any other cloud provider, so that you can easily choose the datacenters and regions that are right for you and your customers. This reach lets you deploy solutions in a consistent manner across many geographies and provides opportunities from both a scalability and redundancy perspective. |

## What is Azure Logic Apps?

Azure Logic Apps is a cloud-based and hybrid service for automating workflows and orchestrating business processes, applications, and data across hybrid environments by using a visual designer. This service is part of Azure Integration Services, which are a set of cloud-based, serverless, scalable, and Microsoft-managed building blocks for you to create comprehensive integration solutions and migrate existing BizTalk Server solutions:

| Service | Description |
|---------|-------------|
| **Azure Logic Apps** | Create and run automated logic app workflows that orchestrate your apps, data, services, and systems. You can quickly develop highly scalable integration solutions for your enterprise and business-to-business (B2B) scenarios. A Consumption logic app includes only one stateful workflow that runs in multitenant Azure Logic Apps. A Standard logic app can include multiple stateful or stateless workflows that run in single-tenant Azure Logic Apps, an App Service Environment v3, or on Azure Arc-enabled Kubernetes clusters (hybrid deployment model). |
| **Azure Functions** | Write less code, maintain less infrastructure, and save on costs to run applications. Without you having to deploy and maintain servers, the cloud infrastructure provides all the up-to-date resources needed to keep your applications running. |
| **Azure Data Factory** | Visually integrate all your data sources by using more than 90 built-in, maintenance-free connectors at no added cost. Easily construct ETL and ELT processes code-free in an intuitive environment, or write your own code. |
| **Azure Service Bus** | Transfer data between applications and services, even when offline, as messages using this highly reliable enterprise message broker. Get more flexibility when brokering messages between client and server with structured FIFO messaging, publish-subscribe capabilities, and asynchronous operations. |
| **Azure Event Grid** | Integrate applications using events delivered by an event broker to subscriber destinations, such as Azure services, other applications, or any endpoint where Event Grid has network access. |
| **Azure API Management** | Deploy API gateways side-by-side and optimize traffic flow with APIs hosted in Azure, other clouds, and on-premises. Meet security and compliance requirements, while you enjoy a unified management experience and full observability across all internal and external APIs. |

## Complementary Azure Services

Beyond the previously described services, Microsoft also offers the following complementary services that provide underlying capabilities for Azure Integration Services:

| Service | Description |
|---------|-------------|
| **Azure Storage** | Provides highly available, massively scalable, durable, secure, and modern storage for various data objects in the cloud. |
| **Azure RBAC** | Manage access to cloud resources with fine-grained access management built on Azure Resource Manager. |
| **Azure Key Vault** | Provides capabilities for secrets management, key management, and certificate management. |
| **Azure Policy** | Helps you enforce organizational standards and assess compliance in a scalable way. |
| **Azure Networking** | Provides a wide variety of networking capabilities, including connectivity, application protection, delivery, and monitoring services. |
| **Azure Event Hubs** | Build dynamic data pipelines and immediately respond to business challenges by streaming millions of events per second from any source. |
| **Azure SQL Database** | A viable solution when migrating on-premises SQL Server databases to the cloud for custom logging strategies or custom configurations. |
| **Azure App Configuration** | Centrally manage application settings and feature flags for modern distributed programs. |
| **Azure Monitor** | Application Insights provides application performance management and monitoring for live apps with telemetry storage and health monitoring. |
| **Azure Automation** | Automate your Azure management tasks and orchestrate actions across external systems within Azure, built on PowerShell workflow. |

## Supported Developer Experiences

| Platform | Supported Tools |
|----------|----------------|
| **BizTalk Server** | Each BizTalk Server version supports a specific version of Visual Studio. For example, BizTalk Server 2020 supports Visual Studio 2019 Enterprise or Professional. However, Visual Studio Community Edition isn't supported. |
| **Azure Integration Services** | Azure Logic Apps (Standard): Azure portal and Visual Studio Code. Azure Logic Apps (Consumption): Azure portal and Visual Studio Code. Azure Functions: Azure portal, Visual Studio Code, and Visual Studio 2022. Azure API Management: Azure portal and Visual Studio Code. Azure Service Bus: Azure portal and Service Bus Explorer. Azure Data Factory: Azure portal and Visual Studio 2015. |

## BizTalk Server versus Azure Logic Apps

To compare BizTalk Server with Azure Logic Apps, let's first briefly summarize what BizTalk Server does. Originally available in 2000, BizTalk Server is an on-premises, stable, middleware platform that connects various systems by using adapters. This platform works as a broker between businesses, systems, or applications and is now a well-established integration platform.

BizTalk Server offers the following main capabilities:

- **Orchestration (business flow):** Provides the capability to create and run orchestrations or graphically defined business processes.
- **Messaging:** Provides the capability to communicate with a wide range of software applications using adapters.

The BizTalk Server engine includes the following components:

| Component | Description |
|-----------|-------------|
| **Business Rule Engine (BRE)** | Evaluates complex sets of rules. |
| **Enterprise Single Sign-On (SSO)** | Provides the capability to map authentication information between Windows and non-Windows systems. |
| **Business Activity Monitoring (BAM)** | Enables information workers to monitor a running business process. |
| **Group Hub** | Enables support personnel to manage the engine and the orchestrations that run. |

### How Does BizTalk Server Work?

BizTalk Server uses a publish-subscribe messaging engine architecture with the MessageBox database at the heart. MessageBox is responsible for storing messages, message properties, subscriptions, orchestration states, tracking data, and other information.

When BizTalk Server receives a message, the server passes and processes the message through a pipeline. This step normalizes and publishes the message to MessageBox. BizTalk Server then evaluates any existing subscriptions and determines the message's intended recipient, based on the message context properties. Finally, BizTalk Server routes the message to the intended recipient, based on subscriptions or filters. This recipient is either an orchestration or a Send port.

The MessageBox database has the following components:

- **Messaging agent:** BizTalk Server interacts with MessageBox using this agent, which provides interfaces for publishing messages, subscribing to messages, retrieving messages, and more.
- **One or more SQL Server databases:** These databases provide the persistence store for messages, message parts, message properties, subscriptions, orchestration state, tracking data, host queues for routing, and more.

### Business Processes

#### BizTalk Server

In BizTalk Server, orchestrations are executable business processes that can subscribe to (receive) messages and publish (send) messages through the MessageBox database. Orchestrations can construct new messages and can receive messages using the subscription and routing infrastructure.

BizTalk Server offers the following advantages:

- **Designer-first (declarative):** Design complex processes by using easy-to-understand design tools to implement patterns and workflows that might otherwise be difficult to implement in code.
- **Abstraction with end systems:** Design processes with focus on the messages, not the end system.

#### Azure Logic Apps

In Azure Logic Apps, you can create executable business processes and applications as logic app workflows by using a "building block" way of programming with a visual designer and prebuilt operations from hundreds of connectors, requiring minimal code.

Azure Logic Apps offers the following advantages:

- **Designer-first (declarative):** Design complex processes by using easy-to-understand design tools.
- **Flexible and scalable:** A cloud-based, serverless, highly scalable computing service that automatically scales and adapts to meet evolving business needs.
- **Connects to anything:** Select from a constantly expanding gallery with hundreds of prebuilt connectors. If no prebuilt connector exists for the resource that you want to access, you can use the generic HTTP operation or create a custom connector.

### Reusable Components

#### BizTalk Server

- **Orchestrations:** Share common business logic across different workflows, internally inside the same application or with multiple applications.
- **Adapters:** Software components providing connectivity using commonly recognized data protocols and document formats.
- **Schemas:** XML Schema Definition (XSD) schemas enable contract-based messaging.
- **Maps and custom functoids:** Enable XML message translation or transformation. Custom functoids extend the range of available operations in the mapping environment.
- **.NET Framework assemblies:** Share assemblies across BizTalk Server projects.
- **Custom pipelines and pipeline components:** Provide an implementation of the Pipes and Filters integration pattern.
- **Rules Engine policies:** Share Business Rules Engine policies across BizTalk Server applications.

#### Azure Logic Apps

- **Integration account:** A cloud-based container providing centralized access to reusable artifacts including trading partners, agreements, XSD schemas, XSLT maps, Liquid template-based maps, certificates, batch configurations, and .NET Fx assemblies.
- **APIs:** Reuse APIs managed with Azure API Management within Azure Logic Apps.
- **Custom connectors:** Wrap an external API with an OpenAPI schema to create a custom connector. For Standard logic app workflows, you can create your own built-in custom connectors based on a service provider.

### Adapters and Connectors

#### BizTalk Server

To exchange messages with external systems, BizTalk Server provides adapters — COM or .NET Fx components that transfer messages to and from business endpoints. BizTalk Server provides native adapters that support various protocols:

- A File adapter for sending and receiving messages from a file location
- Adapters for EDI, FTP, HTTP, MSMQ, SMTP, POP3, and SOAP protocols
- An adapter for Windows SharePoint Services

#### Azure Logic Apps

Azure Logic Apps provides a constantly expanding gallery with hundreds of connectors. Connectors are either:

- **Built-in connectors:** Designed to run natively on the Azure Logic Apps runtime with better performance, throughput, and capacity.
- **Managed connectors:** Deployed, hosted, and managed by Microsoft in Azure, providing triggers and actions for cloud services, on-premises systems, or both.

### Application Connectivity

#### BizTalk Server

Adapters provide the connectivity capabilities and run locally on the BizTalk server. Approximately 30 out-of-the-box adapters are available. Commonly used adapters include FILE, SFTP, SQL, WCF (Basic-HTTP), HTTP, and SMTP.

#### Azure Logic Apps

Connectors provide connectivity capabilities and offer an abstraction on top of APIs. When you select Built-in, you can find connectors such as Azure Functions, Azure Service Bus, IBM DB2, SQL Server, Azure Storage, File System, HTTP, and more. If you select Shared, you can find over 1,000 connectors.

### Web Services and API Connectivity

#### BizTalk Server

Web services support is available by integrating with Windows Communication Foundation (WCF). WCF adapters provide support for WS-* standards. WCF supports transactions using the WS-AtomicTransaction protocol. BizTalk Server can expose WCF-BasicHTTP receive locations as endpoints within Azure API Management.

#### Azure Logic Apps

REST is the default approach for connecting systems. The OpenAPI specification makes this capability possible for both humans and computers. Authentication schemes vary by connector and generally include: Basic, Client certificate, Active Directory OAuth, Raw, and Managed Identity.

### Block Adapter or Connector Usage

#### BizTalk Server

BizTalk Server doesn't include the concept of blocking specific adapters. You can "block" their usage by removing those adapters from the environment.

#### Azure Logic Apps

With Azure Policy, you can define and enforce policies that prevent creating or using connections for connectors that you want to block.

### Message Durability

#### BizTalk Server

The MessageBox database acts as a persistence point that makes sure a message is persisted in storage before attempting to send to an endpoint. Administrators can resume suspended messages from the BizTalk Administration Console.

#### Azure Logic Apps

- **Stateful workflows** have checkpoints that track the workflow state and store messages. You can rerun a workflow instance through Azure portal or an API.
- **Peek-lock messaging** in Azure Service Bus lets you either commit a message after successful execution or abandon the message when a failure happens.

### Publish-Subscribe Architecture

#### BizTalk Server

Pub-sub capabilities exist through the MessageBox database. A popular way to create subscriptions is by using Promoted Properties.

#### Azure Logic Apps

Through Azure Service Bus, Azure Logic Apps supports building publish-subscribe solutions with message queues and publish-subscribe topics in a namespace. Message properties (user properties) can be used as key-value pairs evaluated by filters on topic subscriptions.

### Business Rules Engine

#### BizTalk Server

Includes a forward-chaining rules engine that lets you construct "if-then-else" rules by using a visual editor. Policies can access XSD schemas, .NET Fx code, and SQL Server database tables.

#### Azure Logic Apps

Azure Logic Apps includes the Azure Logic Apps Rules Engine (currently in public preview), which includes the BizTalk Business Rules Engine (BRE) runtime so you can reuse existing BizTalk BRE policies. Currently, support exists only for XML and .NET Framework facts.

### Data Transformation

#### BizTalk Server

Provides rich tooling for XML message transformation using XSLT maps with support for extension objects and custom .NET Fx code. Also provides encoding and decoding for CSV and JSON formats.

#### Azure Logic Apps

- **Enterprise Integration Pack:** Follows similar concepts to BizTalk Server for B2B capabilities using integration accounts.
- **Liquid templates:** For advanced JSON transformations.
- **XML operations:** Built-in XML operations for transformations.
- **EDI schemas:** All BizTalk EDI schemas are publicly available in the Microsoft Integration GitHub repository.
- **Standard logic apps:** Upload maps and schemas directly; call custom compiled assemblies from XSLT maps.
- **Azure Functions:** Execute XSLT or Liquid template transformations using any programming language.

### Network Connectivity

#### BizTalk Server

Network connectivity depends on the underlying server's network configuration. Configuration areas include dependencies and inbound/outbound connectivity to end systems. This usually involves firewall configuration to enable TCP and UDP ports for well-known services or protocols.

#### Azure Logic Apps

Azure provides multiple ways to isolate services and connect workloads:

- **On-premises data gateway:** Acts as a bridge between Azure and resources within a network perimeter.
- **Hybrid Connections:** Provides access from your app to a TCP endpoint.
- **Virtual network integration:** Connect your Azure resource to a virtual network configured in Azure.
- **Private endpoints:** A network interface that uses a private IP address from your virtual network.

| Service | On-premises Data Gateway | Hybrid Connections | Virtual Network Integration | Private Endpoints |
|---------|:---:|:---:|:---:|:---:|
| Azure API Management | ✅ | | ✅ | ✅ |
| Azure Logic Apps (Consumption) | ✅ | | | |
| Azure Logic Apps (Standard) | ✅ (Azure connectors) | ✅ (built-in) | ✅ (built-in) | ✅ |
| Azure Service Bus | | | ✅ | ✅ |
| Azure Event Grid | | | | |

### Custom Code

#### BizTalk Server

| Type | Description |
|------|-------------|
| **Inline code** | Write inline C# code within an Orchestration shape or a BizTalk Map. |
| **Compiled assemblies** | Call from Expression shapes, BizTalk maps, Business Rules Engine policies, and Pipelines. |
| **Custom adapters** | Create your own adapter if needed. |
| **Custom WCF behaviors** | Extend WCF adapter capabilities by developing custom behaviors. |
| **Extensibility in maps** | Create inline code using C#, JScript, Visual Basic, XSLT, or XSLT Call Templates. Create custom functoids. |

#### Azure Logic Apps

Azure Logic Apps provides the capability for you to author and run .NET code from your Standard logic app workflow using Visual Studio Code with the Azure Logic Apps (Standard) extension. The Inline Code Operations connector provides actions for JavaScript Code, CSharp Script Code (Preview), and PowerShell Code (Preview). You can also extend workflows by including Azure API apps or web apps created with Azure App Service.

### Application Groups

#### BizTalk Server

BizTalk Server supports the concept of an application where you can deploy a Visual Studio solution into a BizTalk application. Uses an explicit sharing model where you can add references to compiled assemblies.

#### Azure Logic Apps

A Consumption logic app resource includes only a single stateful workflow (1-to-1 relationship). A Standard logic app resource can include and run multiple workflows (1-to-many relationship). You can organize workflows into logical groups based on: business process affinity, end-to-end monitoring and support, security, RBAC, and network isolation, performance and business criticality, and geo-location and geo-redundancy.

### Security and Governance

#### BizTalk Server

Includes Enterprise Single Sign-On (SSO) to store, map, and transmit encrypted credentials used by adapters. You can also configure SSO affiliate applications for non-Windows systems.

#### Azure Logic Apps

- **Azure Key Vault:** Store credentials, secrets, API keys, and certificates. Supports secure inputs and outputs functionality to obfuscate sensitive data.
- **OAuth-based integration:** Most connectors use this authentication type.
- **Managed identities:** Authenticate access to resources protected by Microsoft Entra ID without providing credentials, secrets, or tokens.

### Application Management and Access Management

#### BizTalk Server

Administrators use the BizTalk Server Administrator Console (MMC thick client) to manage applications, review transactions, and perform troubleshooting.

#### Azure Logic Apps

The Azure portal provides rich transaction traces through run history. Granular role-based access controls (RBAC) are available to manage and restrict access at various levels.

### Storage

#### BizTalk Server

Heavily relies on SQL Server for data store and data persistence. High availability is typically provided using Windows Clustering with SQL Server in an active-passive configuration.

#### Azure Logic Apps

Relies on Azure Storage to store and automatically encrypt data at rest using Microsoft-managed keys by default.

### Data Configuration

#### BizTalk Server

- BizTalk NT Service executable (`BTSNTSvc.exe.config`)
- Enterprise SSO tool
- Custom cache components
- Custom database
- Business Rules Engine (BRE)
- Custom configuration files
- Windows registry

#### Azure Logic Apps

- Azure Key Vault
- Azure App Configuration
- Azure Cosmos DB
- Azure Table Storage
- Custom caching (Azure API Management caching policies, Azure Managed Redis)
- Custom database

### Large File Processing

#### BizTalk Server

- **Message routing only:** Messages are streamed to the MessageBox using the .NET XmlReader interface. Successfully tested up to 1 GB.
- **Data transforms with maps:** Uses the .NET XslCompiledTransform class. Default message size threshold is 1 MB; messages above this threshold are buffered to the file system.

#### Azure Logic Apps

- **File size limits:** Some connectors support message chunking for messages exceeding the default size limit.
- **Claim-check pattern:** Split a large message into a claim check and a payload, stored on an external service.
- **Azure Data Factory:** A cloud-based ETL/ELT service for handling large datasets across various data sources.

### Monitoring and Alerts

#### BizTalk Server

- **BizTalk Health Monitor:** MMC snap-in for monitoring health and performing maintenance.
- **BizTalk Administration Console:** MMC snap-in for discovering failures, suspended instances, and transaction state.
- **BizTalk360:** External web solution providing operations, monitoring, and analytics.

#### Azure Logic Apps

- **Consumption workflows:** Azure Monitor logs with Logic Apps Management Solution.
- **Standard workflows:** Application Insights support with curated visualizations and dashboards built on Azure Workbooks.
- **Serverless 360:** External solution providing monitoring, management, dead letter queue reprocessing, and self-healing.

### Business Activity Monitoring

#### BizTalk Server

Includes Business Activity Monitoring (BAM) allowing developers and business analysts to define tracking profiles applied to orchestrations. Custom implementation available through a .NET Fx API.

#### Azure Logic Apps

Azure Business Process Tracking allows building business processes that visually represent business logic. Serverless 360 also provides a business activity monitoring feature for end-to-end tracking.

### Tracking

#### BizTalk Server

- **Message tracking:** Persist message bodies for troubleshooting and audit purposes. Data is copied to the BizTalk Tracking database (BizTalkDTADb).
- **Health and Activity Tracking (HAT):** Search for data through the New Query interface within the Group Overview experience.
- **Integration with Application Insights and Azure Event Hubs:** Available since BizTalk Server 2016 Feature Pack 1.

#### Azure Logic Apps

Provides rich run history for reviewing action-by-action telemetry, including all processed inputs and outputs. Supports secure inputs and outputs, Azure RBAC rules, and IP address range restrictions.

### Hosting

#### BizTalk Server

BizTalk Server 2020 supports (starting with Cumulative Update 6): Windows Server 2022, Windows Server 2019, Windows 11, Visual Studio 2019, SQL Server 2022, SQL Server 2019, Office 2019, and Office 2016. Can be installed on your own hardware, on-premises VMs, or Azure VMs.

#### Azure Logic Apps

- **Hosting plans:** WS1 (1 vCPU, 3.5 GB), WS2 (2 vCPU, 7 GB), WS3 (4 vCPU, 14 GB).
- **Hybrid deployment model (preview):** Deploy and host Standard workflows in on-premises, private cloud, or public cloud scenarios.
- **Availability and redundancy:** Availability zones provide resiliency and active-active-active zone scalability.
- **Isolated and dedicated environment:** App Service Environment (ASE) v3 for fully isolated, dedicated, high-scale environments.

### Deployment

#### BizTalk Server

Native deployment packaging uses MSI files combined with environment configuration (bindings) files. The BizTalk Deployment Framework (BTDF) open-source project supports component deployment and environment configuration from the same package. CI/CD pipeline support is available in BizTalk Server 2020 with Azure DevOps.

#### Azure Logic Apps

Supports Infrastructure as Code (IaC) using ARM templates, Bicep, Terraform, or Pulumi. The CI/CD process involves:

- **Continuous integration:** Get source code, prepare with environment-specific configuration, and package for deployment.
- **Continuous deployment:** Deploy packaged code, update application settings, update permissions, and get application ready for execution.

## Feature Matchup

The following table roughly shows how resources, artifacts, features, and capabilities compare between BizTalk Server, Azure Logic Apps, and Azure Integration Services:

| Feature | BizTalk Server | Azure Integration Services |
|---------|---------------|---------------------------|
| **Orchestrations** | BizTalk Server orchestration, C# code | Azure Logic Apps workflow, workflow templates, Azure Functions |
| **Pipelines** | BizTalk Server pipelines, pipeline components | Azure Logic Apps workflows, Azure API Management, Azure Functions, Azure API app |
| **Message routing** | MessageBox, Property Promotions, Filters | Azure Service Bus queues/topics, Azure Event Grid, Azure API Management, SQL Server, Azure Managed Redis |
| **Application connectivity** | Out-of-the-box and custom adapters, IIS, Azure API Management | Azure Logic Apps connectors, Azure API Management, Azure Functions, Azure API app |
| **Schemas (XSD)** | BizTalk Server schemas (XML, JSON, flat file) | Azure Logic Apps (Standard), integration account, Azure storage, Azure Functions |
| **Maps** | BizTalk Mapper, XSLT maps | XSLT maps, Liquid templates, Azure integration account, Data Mapper tool |
| **Business rules** | BizTalk Server Business Rules Engine | Azure Logic Apps Rules Engine |
| **Business activity monitoring** | BizTalk Server BAM | Azure Business Process Tracking |
| **EDI** | Out-of-the-box (Parties, partners, agreements, AS2, X12, EDIFACT) | Azure Logic Apps and integration account |
| **HL7, RosettaNet, SWIFT** | BizTalk Server accelerators | Azure Logic Apps connectors, Azure API Management for FHIR |
| **Secrets** | Enterprise SSO | Azure Key Vault, SQL Server, App Configuration |
| **Security and governance** | SSO, Active Directory, Signing certificates, IIS Security, Network security | Microsoft Entra ID, Azure Network Security, Azure RBAC, Claims/tokens, Shared Access Policies |
| **Data configuration** | Config files, SSO, custom cache, custom database, BRE, Windows registry | Azure Key Vault, Azure App Configuration, Azure Cosmos DB, Azure Table Storage, custom caching/database |
| **Deployment** | BizTalk Server binding file | Azure Pipelines, Bicep scripts, Terraform |
| **Tracking** | BizTalk Server tracking, IIS tracking, Azure API Management analytics | Azure Logic Apps run history, Azure Storage, Azure Monitor, Azure API Management analytics, custom solutions |
| **Monitoring** | BizTalk Administration Console, BizTalk Health Monitor | Azure Monitor (Application Insights, Log Analytics) |
| **Operations** | BizTalk Administration Console, Azure Pipelines, MSI, PowerShell, BTDF | Azure portal, Azure Monitor, ARM templates, Azure Pipelines, PowerShell, CLI, Bicep |

## Next Steps

You've learned more about how Azure Logic Apps compares to BizTalk Server. Next, learn how to choose the best Azure capabilities for your scenarios, or skip ahead to review suggested approaches and resources, planning considerations, and best practices for your migration.

- [Choose the best Azure Integration Services offerings for your scenario](https://learn.microsoft.com/en-us/azure/logic-apps/azure-integration-services-choose-capabilities)
- [Migration approaches for BizTalk Server to Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-azure-integration-services-migration-approaches)
