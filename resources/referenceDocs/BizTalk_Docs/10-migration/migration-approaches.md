> **Source:** https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-azure-integration-services-migration-approaches

# Migration Approaches for BizTalk Server to Azure Logic Apps

This guide covers migration strategies and resources along with planning considerations and best practices to help you deliver successful migration solutions.

> **Note:** For a migration overview and guide to choosing services in Azure for your migration, review the following documentation:
>
> - [Why migrate from BizTalk Server to Azure Logic Apps?](https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-to-azure-integration-services-overview)
> - [Choose the best integration service in Azure for your scenario](https://learn.microsoft.com/en-us/azure/logic-apps/azure-integration-services-choose-capabilities)

## Strategy Options

The following sections describe various migration strategies along with their benefits and disadvantages.

### Big Bang

A "big bang" or "direct changeover" is an approach that requires lots of planning and isn't recommended for organizations that are unfamiliar with Azure Logic Apps or that have large systems or solutions to migrate. When an organization implements a new technology stack, new learnings usually often result. By investing too early or too much, you won't have the opportunity to benefit from lessons learned and adjust without risking significant rework.

This approach might also take longer to reap or accrue value. If you've already completed some migration activities, but you haven't yet released them into production due to other pending or in-progress work, your migrated artifacts aren't generating value for your organization.

We recommend that you consider this approach only if you have small, low complexity BizTalk workloads, subject matter experts (SMEs) who know your BizTalk environment, and direct mappings between the BizTalk features that you currently use and Azure Logic Apps. Experience with Azure Logic Apps also considerably reduces the risks with following this approach.

### Iterative or Wave Based (Recommended)

This approach provides the opportunity for your organization to incrementally achieve value, but sooner than they might otherwise. Your project team can learn about the technology stack early by using retrospectives. For example, you can deploy an existing BizTalk interface or project to production and then learn about the solution's needs, which include management, scalability, operations, and monitoring.

Regardless of your approach, if you plan on moving to Azure Logic Apps or Azure in general, strongly consider refactoring your BizTalk Server solutions into serverless or cloud-native solutions before you decommission your server infrastructure.

BizTalk Server and Azure Logic Apps have different architectures. To further modernize your solutions, you can use Azure Integration Services to extend the capabilities in Azure Logic Apps that address core customer integration needs.

For a higher return on investment (ROI), we recommend that any BizTalk migration use the core native capabilities in Azure Logic Apps (Standard) as much as possible and extended with other Azure Integration Services as needed. This combination makes additional scenarios possible, for example:

- Cloud native hybrid capabilities with Azure Logic Apps (Standard) with hybrid deployment
- Stateful or stateless workflow capabilities in Azure Logic Apps (Standard)
- Native, built-in (in-app) mainframe and midranges integration with connectors in Azure Logic Apps (Standard)
- Pub-sub messaging using Azure Service Bus
- Advanced SOAP capabilities in Azure API Management

## Deliver a BizTalk Migration Project

To complete such a project, we recommend that you follow the iterative or wave-based approach and use the [Scrum process](https://www.scrum.org/). While Scrum doesn't include a Sprint Zero (Sprint 0) concept for pre-sprint activities, we recommend that you focus your first sprint on team alignment and technical discovery. After Sprint 0, follow the execution of multiple migration sprints and focus on releasing features towards a minimum viable product (MVP).

### Sprint 0

During this sprint, we recommend that you execute BizTalk Server Environments Discovery with Waves Planning. Understanding the project's breadth and depth is critical for success.

| Area | Details |
|------|---------|
| **Discovery** | Capture data about all your interfaces and applications so you can learn the number of interfaces and applications that you need to migrate. Collect the following information to prioritize work: adapters in use, BizTalk Server features in use (BAM, BRE, EDI, etc.), custom code (expressions, maps, pipeline components), message throughput, message sizes, dependencies, application and system dependencies. |
| **Architecture design** | Create the high-level architecture to use as the focal point for the migration, addressing both functional and non-functional needs. |
| **Minimum viable product (MVP) definition** | Define the first wave features — the processes that need support after you complete the first wave. |
| **Initial migration backlog** | Define the first wave features and their work items with technical elaboration. |

#### Discovery Tools

To help you with migration discovery, you can use:

- **[Azure Integration Migrator (BizTalk Migration tool)](https://github.com/Azure/aimbiztalk):** A Microsoft open-source command-line tool that uses a phased approach to help you uncover useful insights and strategies for migrating your solutions to the cloud. Recommended for discovery and report generation only.
- **[The BizTalk Documenter](https://github.com/mbrimble/biztalkdocumenter):** Developed by Mark Brimble, this tool generates an inventory with BizTalk Server elements. Works with BizTalk Server 2020, despite stating that only BizTalk Server 2016 is supported.

#### Architecture Design

While Azure Logic Apps provides capabilities that let you reuse BizTalk Server assets, you must have a modern architecture design to embrace the benefits from more modern capabilities. For quality and cross-cutting concerns, use the [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework).

Under this framework, BizTalk migrations are mission-critical workloads that require high availability on the platform.

Key resources:

- [Design methodology for mission-critical workloads on Azure](https://learn.microsoft.com/en-us/azure/well-architected/mission-critical/mission-critical-design-methodology)
- [Basic enterprise integration on Azure](https://learn.microsoft.com/en-us/azure/architecture/reference-architectures/enterprise-integration/basic-enterprise-integration) (reference architecture)
- [Azure Integration Services Landing Zone Accelerator](https://github.com/Azure/Integration-Services-Landing-Zone-Accelerator) (for building and deploying an integration platform)

#### Minimum Viable Project (MVP) Definition

An MVP is a product version that has just enough customer-usable features. For a BizTalk migration, your MVP definition reflects the iterations, waves, or groups of sprints that you need to make progress towards working features and to meet initial integration workloads.

Your MVP should include the following **business outcomes (Epics)**:

- What is the primary goal that you want to achieve?
- What capabilities or features must you address for this MVP?
- What are the business process flows?
- What are the business decisions that affect the MVP?

Your MVP should also include the following **in-scope processes (Features)**:

| Feature | Description |
|---------|-------------|
| **High-level system functionality** | Extract using discovery tools and express as features. |
| **Actors or personas** | Determine individuals affected by the MVP's supported scenarios. |
| **Orchestrations** | Extract using discovery tools. |
| **Data entities and messages** | Opportunities to learn about improvements in data exchange. |
| **Data mappings** | Decide the data format and conversion needs for the new platform (JSON vs. XML). |
| **Business rules** | Rethink their approach or reuse them with Azure Logic Apps capabilities. |
| **Data privacy considerations** | Must be a top priority in each wave. |
| **Regulatory considerations** | More relevant if your customers don't have cloud-based workloads. |
| **Secure by design** | Design each feature with security in mind. |
| **Proposed features for coexistence** | Align hybrid architecture with existing SLIs and SLOs. |
| **Non-functional considerations** | Different business processes may have different non-functional requirements. |
| **Business metrics** | An optional opportunity to show progress for the migration work. |

Out-of-scope variables: resource availability, risks, documentation, time to market.

#### Initial Backlog

The initial backlog is a set of User Stories grouped into Features. Ideally, each Epic encompasses a group of BizTalk applications or BizTalk projects. Associate one BizTalk application or BizTalk project with a feature.

Example:

- **Feature:** Loan processing
- **User Story:** "As a customer, I want to submit a loan application so the bank can add funds to my secure account."

Tasks to implement:

- Collect BizTalk reusable artifacts.
- Create a loan request workflow using Azure Logic Apps.
- Configure asynchronous messaging using Azure Service Bus or IBM MQ.
- Map JSON to XML data using an Azure Logic Apps workflow.
- Customize Azure Integration Services as required for messaging patterns.

### Migration Waves (Sprints)

After your team completes Sprint 0, you should have a clear view of the MVP to build. A wave is a set of sprints. During a wave, your team completes the activities to migrate, test, and release to production.

#### Migrate

During each wave, migration focuses on the agreed User Stories. Technology decisions must use the information in the BizTalk Server features mapping described in the Feature matchup section.

| Step | Description |
|------|-------------|
| **1** | Discover existing BizTalk apps and interfaces. Use the BizTalk Migration tool and BizTalk Documenter tool. |
| **2** | Set up your initial migration environment using the Azure Integration Services Landing Zone Accelerator. |
| **3** | Create and test Standard logic app workflows using either the Azure portal or Visual Studio Code with the Azure Logic Apps (Standard) extension. With Visual Studio Code, you can locally develop, test, and store your logic app project using any source control system. |
| **4** | Automate your build and deployment process using the Azure Logic Apps (Standard) extension for Visual Studio Code with Azure DevOps. |
| **5** | Enable zero downtime deployment by creating and using deployment slots. |

#### Test

Each wave has its own testing activities embedded in each User Story. For shift-left testing:

- **Automate your tests:** Azure Logic Apps (Standard) supports automated testing based on the Azure Functions runtime.
  - [Azure Logic Apps Test Framework](https://github.com/Azure/logicapps/tree/master/LogicAppsSampleTestFramework) — Write automated end-to-end tests, perform fine-grained validation, mock HTTP actions and Azure connectors.
  - [Integration Playbook testing framework](https://github.com/michaelstephensonuk/IntegrationPlaybook-LogicApp-Standard-Testing) — Supports additional scenarios including SpecFlow for BDD.
- **Set up mock response testing** using the static results capability in Azure Logic Apps.
- **Run side by side tests** with baseline BizTalk Server integration tests alongside automated Azure Logic Apps tests.

#### Release to Production

After your team finishes and meets the "definition of done" for the User Stories, consider:

1. Create a communication plan for your release to production.
2. Make a "cut-over" plan covering:
   - Prerequisite steps
   - Dress rehearsal
   - People
   - Schedule estimates
   - Disabling interfaces in the old platform
   - Enabling interfaces in the new platform
   - Validation testing
3. Determine a rollback plan.
4. Run validation testing.
5. Plan for operations or production support.
6. Choose "go or no go" criteria for releasing to production.
7. Celebrate your team's success.
8. Hold a retrospective.

## Best Practices for a BizTalk Migration

While best practices might vary across organizations, consider promoting consistency to reduce unnecessary efforts and redundancy. When you help enable reusability, your organization can more quickly build interfaces that become easier to support.

### General Naming Conventions for Azure Resources

Make sure to set up and consistently apply good naming conventions across all Azure resources from resource groups to each resource type. A good naming convention communicates purpose.

Resources:

- [Abbreviation examples for Azure resources](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)
- [Azure Naming Tool](https://github.com/mspnp/AzureNamingTool) — Generates Azure-compliant names and standardizes naming.

### Naming Conventions for Azure Logic Apps Resources

#### Logic App Resource Names

To differentiate between Consumption and Standard logic app resources, use different abbreviations:

- Consumption: `LACon`
- Standard: `LAStd`

Pattern: `LAStd-<business-unit-name>-<department-name or application-name>-<environment-name>`

Example: `LAStd-CorporateServices-HR-DEV`

#### Logic App Workflow Names

A Standard logic app resource can include multiple workflows, so design a naming convention based on the process name:

Pattern: `Process-<process-name>`

Example: `Process-EmployeeOnboarding`

Considerations:

- Follow the parent-child pattern for related workflows.
- Take into account whether a workflow publishes or consumes a message.

#### Workflow Operation Names

When adding triggers or actions, rename them immediately with a brief task descriptor using Pascal Case notation:

Example: `Parse JSON-ChangeEmployeeRecord`

> **Note:** For organizations that extensively use expressions, consider a naming convention that doesn't promote using whitespace (' '). The expression language replaces whitespace with underscores ('_'). Use a dash or hyphen ('-') instead for readability.

#### Connection Names

Pattern: `CN-<connector-name>-<logic-app-or-workflow-name>`

Example: `CN-ServiceBus-OrderQueue`

### Handle Exceptions with Scopes and "Run After" Options

Scopes provide the capability to group multiple actions for Try-Catch-Finally behavior. You can specify when to run the Scope action based on the preceding action's execution status:

- Is successful
- Has failed
- Is skipped
- Has timed out

### Consolidate Shared Services

When building integration solutions, consider creating and using shared services for common tasks:

| Shared Service | Description |
|----------------|-------------|
| **Centralized logging** | Provide common patterns for how developers instrument their code with appropriate logging. |
| **Business tracking and BAM** | Capture and expose data so business subject matter experts can understand state of business transactions. |
| **Configuration data** | Separate application configuration data from code. Provide a unified, consistent approach to access configuration data. |
| **Custom connectors** | Create custom connectors for internal systems that don't have prebuilt connectors. |
| **Common datasets or data feeds** | Expose common datasets and feeds as APIs or connectors to avoid reinventing the wheel. |

## Next Steps

You've now learned more about available migration approaches and best practices for moving BizTalk Server workloads to Azure Logic Apps. To provide detailed feedback about this guide, you can use the following form:

- [Give feedback about migration guidance for BizTalk Server to Azure Logic Apps](https://aka.ms/BizTalkMigrationGuidance)
