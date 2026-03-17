> **Source:** https://learn.microsoft.com/en-us/biztalk/install-and-config-guides/whats-new-in-biztalk-server-2020

# What's New in BizTalk Server 2020

Read about what's new in BizTalk Server 2020.

## New in BizTalk Server 2020

| Feature | Description |
|---------|-------------|
| **Support for newer platforms** | BizTalk Server 2020 adds support for the following Microsoft platforms: Visual Studio 2019 (Enterprise and Professional editions are supported), Windows Server 2019, Windows Server 2016, Windows 10, SQL Server 2019, SQL Server 2017, SQL Server 2016 SP3, Office 2019, Office 2016. BizTalk Server 2020 CU6 adds support for: Windows Server 2022, Windows 11, SQL Server 2022. For more information, see Hardware and Software Requirements for BizTalk Server 2020. |
| **Analytics** | Operational Data Monitoring and Analytics. Leveraging the power of Azure (Application Insight and Event Hub) for deep data storage and Power BI for reporting and viewing of data. Send tracking data to Azure. Configure data feed for Power BI. |
| **Application Lifecycle Management with VSTS** | Using Visual Studio Team Services, you can define multi-server deployments of BizTalk Server 2020, and then maintain those systems throughout the application lifecycle. Configure automatic deployment using VSTS. |
| **Management APIs** | Manage your environment remotely using the new REST APIs with full Swagger support. REST API reference. |
| **Support for Always Encrypted** | Use the WCF-SQL adapter to connect to SQL Server secure Always Encrypted columns. Query Always Encrypted database in SQL Server. |
| **Advanced Scheduling** | New and improved scheduling capabilities in Adapters. Configure time zone and recurrence. |
| **Backup to Azure Blob Storage** | When deploying BizTalk Server to Azure VMs, you can backup BizTalk Server databases to Azure blob storage. Configure the Backup Job. |
| **Adapter for Service Bus v2** | When using the Service Bus Adapter, you can utilize Azure Service Bus Premium for enterprise-scale workloads. SB-Messaging Adapter. |
| **Transport Layer Security 1.2** | Securely deploy BizTalk Server using industry-standard TLS 1.2 authentication and encryption. |
| **FIPS Compliance** | Configure, deploy and run BizTalk Server on machines where FIPS security policy is enabled. |
| **API Management** | Publish Orchestration endpoints using Azure API Management, enabling organizations to publish APIs to external, partner and internal developers to unlock the potential of their data and services. Connect to Azure API Management. |
| **Event Hubs Adapter** | Using the new Event Hub Adapter, BizTalk Server can send and receive messages with Azure Event Hubs, where BizTalk Server can function as both an event publisher and subscriber, as part of a new Azure cloud-based event-driven application. Event Hubs adapter. |
| **Office 365 Adapters** | Leverage the power of BizTalk in newer office automation workflows by integrating with Adapters that allows you to send or receive Office 365 emails, receive or transmit Office 365 calendar events and create Office 365 contacts. Office 365 Outlook Email adapter, Office 365 Outlook Calendar adapter, Office 365 Outlook Contact adapter. |
| **Group Managed Service Accounts** | Extend Windows GMSA support to BizTalk operations and services. Using Group Managed Service Account. |
| **Blob Adapter** | Send and Receive messages to/from Azure Blob Storage. Azure Blob storage adapter. |
| **Audit Log** | Making BizTalk further secure by maintaining audit trails of all management operation. Configuring and Viewing Audit Logs. |
| **New Read Only Operator role** | Brand new read only operator role to facilitate dev ops model, where access to production stamp is provided without the ability to update anything. BizTalk Server Read Only Users group. |
| **XSLT 3.0** | New extensible model for runtime map execution, out of box wiring to work with Saxon XSLT3.0. XSLT Transform Engine. XSLT custom transform implementation. |
| **Additional updates** | Move to new long term supported Microsoft OLEDB Driver for SQL Server. Support for SSO Affiliate applications in SFTP adapter. SQL Availability Group support for BAM DTS Package via SSIS Catalog. Partially disabled receive locations. How to Enable Receive Location Fault Tolerance. Throughput improvements for Dynamic Send Ports with Ordered Delivery. |

## Deprecated & Removed List

| Item | Status | Replacement |
|------|--------|-------------|
| Samples | Removed | Removed from BizTalk Server installation. |
| POP3 and SMTP adapters | Deprecated | Office 365 adapters |
| Support for ACS authentication in adapters | Removed | SAS authentication |
| SOAP adapter | Deprecated | WCF-BasicHttp Adapter |
| Old SQL adapter | Removed | WCF-SQL Adapter |
| BPEL support | Deprecated | None |
| JDE OneWorld adapter | Deprecated | None |
| OWC redist | Removed | None |
| BAM Portal | Deprecated | None |
| WCF-NetTcpRelay adapter | Deprecated | None |

> **Important:** Some of these deprecated features may be found in newer versions of BizTalk. In these scenarios, consider the following:
>
> - The feature may be used internally within BizTalk, and is not meant to be used by customer solutions. It is not supported in customer solutions.
> - The interfaces may have been modified by Microsoft, and may not be publicly available.

## Next Steps

- [Hardware & software requirements](https://learn.microsoft.com/en-us/biztalk/install-and-config-guides/hardware-and-software-requirements-for-biztalk-server-2020)
- [Setup & install prerequisites](https://learn.microsoft.com/en-us/biztalk/install-and-config-guides/set-up-and-install-prerequisites-for-biztalk-server-2020)
- [Install BizTalk](https://learn.microsoft.com/en-us/biztalk/install-and-config-guides/install-biztalk-server-2020)
