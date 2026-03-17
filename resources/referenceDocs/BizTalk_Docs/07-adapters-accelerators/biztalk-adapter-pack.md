> Source: https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/biztalk-adapter-pack

# BizTalk Adapter Pack

## Overview

The Microsoft BizTalk Adapter Pack includes adapters that enable enterprise applications and databases to interface with each other by using a common adapter framework. Similar to programming to web services, adapters enable clients to program to different enterprise applications. Technically, adapters are a binding to Windows Communication Framework (WCF). The BizTalk Adapter Pack includes the following adapters:

- Microsoft BizTalk Adapter for Oracle Database (Oracle Database adapter)
- Microsoft BizTalk Adapter for Oracle E-Business Suite (Oracle E-Business adapter)
- Microsoft BizTalk Adapter for mySAP Business Suite (SAP adapter). This also includes the .NET Framework Data Provider for mySAP Business Suite (Data Provider for SAP)
- Microsoft BizTalk Adapter for Siebel eBusiness Applications (Siebel adapter). This also includes the .NET Framework Data Provider for Siebel eBusiness Applications (Data Provider for Siebel)
- Microsoft BizTalk Adapter for SQL Server (SQL adapter)

Using these adapters, you can connect to these on-premises line-of-business (LOB) systems to get data, and put data. The BizTalk Adapter Pack is included with BizTalk Server, and can be used or consumed from:

- BizTalk Server
- A .NET application
- An ADO interface
- A Microsoft SharePoint portal

## Install BAP

### BizTalk Server 2020 and Newer

Starting with BizTalk Server 2020 and newer, all BizTalk Adapter Pack features, including the SDK, are included with BizTalk Server 2020 installation. A separate installation of BizTalk Adapter Pack or WCF LOB Adapter SDK isn't required.

- Installing the BizTalk Developer Tools/SDK and BizTalk Server Visual Studio Extension also installs the WCF LOB Adapter SDK.
- Installing the BizTalk Server Runtime and Windows Communication Foundation adapters installs all adapters included in the BizTalk Adapter Pack.
- The BizTalk Adapter Pack is included with BizTalk Server.

### Other Versions

- [Install BizTalk Adapter Pack 2016](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/install-the-biztalk-adapter-pack-2016)
- [Install BizTalk Adapter Pack 2013 R2 and 2013](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/install-biztalk-adapter-pack-2013-r2-and-2013)

## FAQ

Get some answers to [Frequently asked questions](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/frequently-asked-questions-for-the-biztalk-adapter-pack) about the BizTalk Adapter Pack.

## Oracle Database Adapter

[Microsoft BizTalk Adapter for Oracle Database](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/adapter-oracle-database/microsoft-biztalk-adapter-for-oracle-database-documentation) includes information on the architecture, and how to use the adapter in BizTalk Server, and the WCF service and channel models. Security, troubleshooting the adapter, and the adapter reference are also covered.

## Oracle E-Business Suite Adapter

[Microsoft BizTalk Adapter for Oracle E-Business Suite](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/adapter-oracle-ebs/microsoft-biztalk-adapter-for-oracle-e-business-suite-documentation) includes information on the architecture, and how to use the adapter in BizTalk Server, and the WCF service and channel models. Security, troubleshooting the adapter, and the adapter reference are also covered.

## SAP Adapter

[Microsoft BizTalk Adapter for mySAP Business Suite](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/adapter-sap/microsoft-biztalk-adapter-for-mysap-business-suite-documentation) includes information on the architecture, and how to use the adapter in BizTalk Server, and the WCF service and channel models. Security, troubleshooting the adapter, and the adapter reference are also covered.

## Siebel Adapter

[Microsoft BizTalk Adapter for Siebel eBusiness Applications](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/adapter-siebel/microsoft-biztalk-adapter-for-siebel-ebusiness-applications-documentation) includes information on the architecture, and how to use the adapter in BizTalk Server, and the WCF service and channel models. Security, troubleshooting the adapter, and the adapter reference are also covered.

## SQL Adapter

[Microsoft BizTalk Adapter for SQL Server](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/adapter-sql/microsoft-biztalk-adapter-for-sql-server-documentation) includes information on the architecture, and how to use the adapter in BizTalk Server, and the WCF service and channel models. Security, troubleshooting the adapter, and the adapter reference are also covered.

## WCF LOB Adapter SDK

Use the [WCF Line of Business Adapter SDK](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/wcf-lob-adapter-sdk/microsoft-wcf-line-of-business-adapter-sdk-documentation) to create your own service-oriented interfaces to existing LOB systems.

## Who Should Use the BizTalk Adapter Pack?

The potential users for the BizTalk Adapter Pack include:

- **Developers** who directly program to the adapters
- **IT professionals** who consume the adapters using other integration platforms, such as BizTalk Server
- **Independent software vendors (ISVs)** who build solutions on top of the adapters

Suggested skills and knowledge for these roles include:

- A **developer** using these adapters should be at least moderately experienced with:
  - Microsoft Visual Studio, and the development of .NET solutions
  - Programming with the .NET Framework
  - Programming with the Microsoft Windows Communication Foundation (WCF) Line of Business (LOB) Adapter SDK
  - Extensible Markup Language (XML)
  - XML Schema Definition (XSD) language
  - Web Services Definition Language (WSDL)

- An **IT professional** using these should be at least moderately experienced with:
  - SQL Server Integration Services (SSIS)
  - Microsoft BizTalk Server
  - Windows SharePoint Services

- **ISVs** using these adapters should be at least moderately experienced with:
  - The internal workings and concepts of each adapter, and be able to build applications on top of the adapters
  - .NET Framework
  - The WCF LOB Adapter SDK

## See Also

- [Adapters and Accelerators in BizTalk Server](https://learn.microsoft.com/en-us/biztalk/adapters-and-accelerators/adapters-and-accelerators-in-biztalk-server)
