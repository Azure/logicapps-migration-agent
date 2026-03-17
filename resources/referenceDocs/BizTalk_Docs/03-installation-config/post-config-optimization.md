> **Source:** https://learn.microsoft.com/en-us/biztalk/install-and-config-guides/post-configuration-steps-to-optimize-your-environment

# Post-Configuration Steps to Optimize Your Environment

Post-configuration steps to help improve performance, maintain your BizTalk environment, and install the EDI schemas.

## Disable Shared Memory Protocol in SQL Server

1. Open **SQL Server Configuration Manager** > expand **SQL Server Network Configuration** > **Protocols for MSSQLSERVER**.
2. Right-click **Shared Memory** > **Disable**.
3. Select **SQL Server Services**, right-click **SQL Server (MSSQLServer)** > **Restart**.
4. Close SQL Server Configuration Manager.

## Configure the SQL Agent Jobs

1. Open **SQL Server Management Studio**, and connect to **Database Engine**.

2. Expand **SQL Server Agent**, and expand **Jobs**. Configure the following jobs:

   - **Backup BizTalk Server**: Backs up the BizTalk Server databases and the log files. When configuring the job, you determine parameters like frequency and file location.

     The following links describe the SQL Agent job and its parameters:
     - [Backing Up and Restoring BizTalk Server Databases](https://learn.microsoft.com/en-us/biztalk/core/backing-up-and-restoring-biztalk-server-databases)
     - [How to Configure the Backup BizTalk Server Job](https://learn.microsoft.com/en-us/biztalk/core/how-to-configure-the-backup-biztalk-server-job)

     This SQL Agent job also truncates the transaction logs, which helps improve performance.

     This job doesn't remove or delete backup files, including older files. To delete backup files, refer to The "Backup BizTalk Server" job fails when backup files accumulate over time in the Microsoft BizTalk Server database server.

   - **DTA Purge and Archive**: Truncates and archives the BizTalk Server Tracking database (BizTalkDTADb). When configuring the job, you determine parameters like how many days to keep completed instances and how many days to keep all data.

     The following links describe the SQL Agent job and its parameters:
     - [Archiving and Purging the BizTalk Tracking Database](https://learn.microsoft.com/en-us/biztalk/core/archiving-and-purging-the-biztalk-tracking-database)
     - [How to Configure the DTA Purge and Archive Job](https://learn.microsoft.com/en-us/biztalk/core/how-to-configure-the-dta-purge-and-archive-job)

     This SQL Agent job directly affects performance by maintaining the tracking host and purging tracking events.

## Maintain Your Backup Files

BizTalk Server does not include any job to delete backup files. As a result, how you maintain your backup files is up to you. Many users create the `sp_DeleteBackupHistoryAndFiles` stored procedure, and then call this stored procedure directly in the Backup BizTalk Server job. Some users create a maintenance plan. The choice is yours. This topic lists both options.

### Option 1: Create the sp_DeleteBackupHistoryAndFiles Stored Procedure

1. In SQL Server Management Studio, select the BizTalk Management database (BizTalkMgmtDb).

2. Select **New Query**, and run the following T-SQL script to create the `sp_DeleteBackupHistoryAndFiles` (BizTalk Server 2016) or `sp_DeleteBackupHistoryAndFiles2013` (BizTalk Server 2013 R2 and older) stored procedure:

**sp_DeleteBackupHistoryAndFiles (BizTalk Server 2016 and newer)**

```sql
CREATE PROCEDURE [dbo].[sp_DeleteBackupHistoryAndFiles] @DaysToKeep smallint = null
AS

BEGIN
set nocount on
IF @DaysToKeep IS NULL OR @DaysToKeep <= 1
RETURN
/*
Only delete full sets
If a set spans a day in such a way that some items fall into the deleted group and the other does not, do not delete the set
*/

/*
First delete MarkName from all other databases
*/
declare @BackupServer sysname ,@BackupDB sysname, @tsql nvarchar(1024), @MarkToBeDeleted nvarchar(128)
DECLARE BackupDB_Cursor insensitive cursor for
SELECT	ServerName, DatabaseName
FROM	admv_BackupDatabases
ORDER BY ServerName
open BackupDB_Cursor

SELECT @MarkToBeDeleted = MAX([MarkName])
FROM [dbo].[adm_BackupHistory] [h1]
WHERE [BackupType] = 'lg' AND datediff( dd, [BackupDateTime], getdate() ) >= @DaysToKeep
AND	[BackupSetId] NOT IN ( SELECT [BackupSetId] FROM [dbo].[adm_BackupHistory] [h2] WHERE [h2].[BackupSetId] = [h1].[BackupSetId] AND datediff( dd, [h2].[BackupDateTime], getdate() ) < @DaysToKeep AND [h2].[BackupType] = 'lg')
AND EXISTS( SELECT TOP 1 1 FROM [dbo].[adm_BackupHistory] [h2] WHERE [h2].[BackupSetId] > [h1].[BackupSetId] AND [h2].[BackupType] = 'lg')
fetch next from BackupDB_Cursor into @BackupServer, @BackupDB

while @@fetch_status = 0
	begin
	set @tsql = '[' + @BackupServer + '].[' + @BackupDB + '].[dbo].[sp_CleanUpMarkLog]'
	exec @tsql @MarkName=@MarkToBeDeleted
	fetch next from BackupDB_Cursor into @BackupServer, @BackupDB
	end

close BackupDB_Cursor
deallocate BackupDB_Cursor

DECLARE DeleteBackupFiles CURSOR
-- xp_delete_file variant
FOR SELECT [BackupFileLocation] + '\' + [BackupFileName] FROM [adm_BackupHistory]
-- xp_cmdshell variant
-- FOR SELECT 'del "' + [BackupFileLocation] + '\' + [BackupFileName] + '"' FROM [adm_BackupHistory]
WHERE  datediff( dd, [BackupDateTime], getdate() ) >= @DaysToKeep
AND [BackupSetId] NOT IN ( SELECT [BackupSetId] FROM [dbo].[adm_BackupHistory] [h2] WHERE [h2].[BackupSetId] = [BackupSetId] AND datediff( dd, [h2].[BackupDateTime], getdate() ) < @DaysToKeep )

DECLARE @cmd varchar(400)
OPEN DeleteBackupFiles
FETCH NEXT FROM DeleteBackupFiles INTO @cmd
WHILE (@@fetch_status <> -1)
BEGIN
    IF (@@fetch_status <> -2)
    BEGIN
-- xp_delete_file variant
        EXECUTE master.dbo.xp_delete_file 0, @cmd
-- xp_cmdshell variant
--        EXEC master.dbo.xp_cmdshell @cmd, NO_OUTPUT
        delete from [adm_BackupHistory] WHERE CURRENT OF DeleteBackupFiles
        print @cmd
    END
    FETCH NEXT FROM DeleteBackupFiles INTO @cmd
END

CLOSE DeleteBackupFiles
DEALLOCATE DeleteBackupFiles
END
GO
```

**sp_DeleteBackupHistoryAndFiles2013 (BizTalk 2013 R2 and older)**

```sql
CREATE PROCEDURE [dbo].[sp_DeleteBackupHistoryAndFiles2013] @DaysToKeep smallint = null
AS

BEGIN
set nocount on
IF @DaysToKeep IS NULL OR @DaysToKeep <= 1
RETURN
/*
Only delete full sets
If a set spans a day in such a way that some items fall into the deleted group and the other does not, do not delete the set
*/

DECLARE DeleteBackupFiles CURSOR
FOR SELECT 'del "' + [BackupFileLocation] + '\' + [BackupFileName] + '"' FROM [adm_BackupHistory]
WHERE  datediff( dd, [BackupDateTime], getdate() ) >= @DaysToKeep
AND [BackupSetId] NOT IN ( SELECT [BackupSetId] FROM [dbo].[adm_BackupHistory] [h2] WHERE [h2].[BackupSetId] = [BackupSetId] AND  datediff( dd, [h2].[BackupDateTime], getdate() ) < @DaysToKeep )

DECLARE @cmd varchar(400)
OPEN DeleteBackupFiles
FETCH NEXT FROM DeleteBackupFiles INTO @cmd
WHILE (@@fetch_status <> -1)
BEGIN
    IF (@@fetch_status <> -2)
    BEGIN
        EXEC master.dbo.xp_cmdshell @cmd, NO_OUTPUT
        delete from [adm_BackupHistory] WHERE CURRENT OF DeleteBackupFiles
        print @cmd
    END
    FETCH NEXT FROM DeleteBackupFiles INTO @cmd
END

CLOSE DeleteBackupFiles
DEALLOCATE DeleteBackupFiles
END
GO
```

3. Open the **Backup BizTalk Server** job > select **Steps**.

4. Edit the **Clear Backup History** step so that it calls the new `sp_DeleteBackupHistoryAndFiles` or `sp_DeleteBackupHistoryAndFiles2013` stored procedure instead of the previous `sp_DeleteBackupHistory` stored procedure.

5. Select **OK** to save your changes.

### Option 2: Create a Maintenance Plan

1. In SQL Server Management Studio, expand **Management**, right-click **Maintenance Plans**, and select **Maintenance Plan Wizard**.
2. Name the plan (for example, name it *Purge Backup Files*), and then select the **Change** button next to **Schedule**.
3. Choose how frequently you want to purge the backup files. These settings are completely up to you. Select **OK**, and then select **Next**.
4. Select **Maintenance Cleanup Task** > **Next**.
5. In the **Cleanup Task** window, go to **Search folder and delete files...**, select your backup Folder (maybe `f:\BizTalkBackUps`), and enter `.bak` for the **File extension**. You can also choose to delete files based on their age. For example, enter 3 if you want to delete files that are older than 3 weeks. Select **Next**.
6. Finish going through the wizard and enter any additional information you want. Select **Finish**.

## Install EDI Schemas and More EDI AS2 Configuration

The EANCOM, EDIFACT, HIPAA, and X12 schema files are included in a self-extracting executable file named MicrosoftEdiXSDTemplates.exe. To create EDI solutions, extract these files, and deploy with your projects. To install and extract these files:

1. Run the BizTalk Server installation, and install the **Developer Tools and SDK** component. This component downloads the MicrosoftEdiXSDTemplates.exe EDI schema file to the `\XSD_Schema\EDI` folder.

   > **Note:** If you upgrade BizTalk Server, the MicrosoftEdiXSDTemplates.exe file in your installation is replaced with the new MicrosoftEdiXSDTemplates.exe file associated with the upgrade. If you need the previous schemas, then back up the previous MicrosoftEdiXSDTemplates.exe file.

   > **Note:** If you upgrade message schemas when you upgrade BizTalk Server to a later build, you may encounter issues using the updated schemas, or you may have to perform additional updating steps. See the "Considerations for updating schemas" section in [Important Considerations for Updating Applications](https://learn.microsoft.com/en-us/biztalk/core/important-considerations-for-updating-applications).

2. Go to `\Program Files (x86)\Microsoft BizTalk Server <VERSION>\XSD_Schema\EDI`, and double-click **MicrosoftEdiXSDTemplates.exe**.

3. Extract the schemas to `\Program Files (x86)\Microsoft BizTalk Server <VERSION>\XSD_Schema\EDI`. When you extract the schemas, they are stored in EANCOM, EDIFACT, HIPAA, and X12 folders.

### Add a Reference to the BizTalk Server EDI Application

EDI schemas, pipelines, and orchestrations are deployed in the BizTalk EDI Application. To use any other application as an EDI application, add a reference to the BizTalk EDI Application. Steps:

1. In the **BizTalk Server Administration Console**, expand **Applications**. Right-click the application that you want to use for EDI (such as BizTalk Application 1), select **Add**, and then select **References**.

2. Select **BizTalk EDI Application**, and select **OK** to save your changes.

> **Tip:** To see references to other applications, right-click any application, and select **Properties**. Select **References**. You can also add new references, and remove existing references.

> **Note:** Do not add custom artifacts to the BizTalk EDI Application. It's best to leave this application as-is.

### Start Batch Orchestrations

If you enable a party to receive and/or send EDI batches, then start the batching orchestrations. These orchestrations are not started by the installation wizard or the configuration wizard. Steps:

1. In **BizTalk Server Administration Console**, expand **BizTalk EDI Application**, and select **Orchestrations**.

2. Right-click each of the following orchestrations, and select **Start**:

   - Microsoft.BizTalk.Edi.BatchSuspendOrchestration.BatchElementSuspendService (assembly: Microsoft.BizTalk.Edi.BatchingOrchestration.dll)
   - Microsoft.BizTalk.Edi.BatchingOrchestration.BatchingService (assembly: Microsoft.BizTalk.Edi.BatchingOrchestration.dll)
   - Microsoft.BizTalk.Edi.RoutingOrchestration.BatchRoutingService (assembly: Microsoft.BizTalk.Edi.RoutingOrchestration.dll)

> **Note:** The EDI batching orchestrations should only be started if you receive and/or send EDI batches. Starting them when the system is not receiving or sending EDI batches could affect system performance.

### Migrate EDI Artifacts from a Previous BizTalk Version

The way trading partners are managed in BizTalk Server was updated in BizTalk Server 2010 and newer versions. In the previous BizTalk Server versions, a party was created only for the trading partner, and not for the partner hosting BizTalk Server. In BizTalk Server 2010 and newer, a party must be created for all the trading partners, including the partner hosting BizTalk Server. In previous BizTalk Server versions, the encoding (X12 and EDIFACT) and transport (AS2) protocol properties are defined at the party level. In BizTalk Server 2010 and newer versions, these properties are defined through agreements.

To migrate party data from previous versions, BizTalk Server includes a Party Migration Tool. Consider the following migration paths:

| BizTalk Version | Migration Path |
|---|---|
| BizTalk Server 2006 R2 | Upgrade to BizTalk Server 2009. Then, use the Party Migration Tool included with BizTalk Server 2013/2013 R2 to migrate to BizTalk Server 2013/2013 R2. Or, use the Party Migration Tool included with BizTalk Server 2013/2013 R2 to migrate to BizTalk Server 2010. Then, upgrade to BizTalk Server 2013/2013 R2. |
| BizTalk Server 2009 | Use the Party Migration Tool included with BizTalk Server 2013/2013 R2 to migrate directly to BizTalk Server 2013/2013 R2. |
| BizTalk Server 2010 | Upgrade to BizTalk Server 2013/2013 R2. |

The Party Migration Tool is available on the BizTalk Server media under the `\PartyMigrationTool` folder.

## Install BizTalk Health Monitor (BHM)

BizTalk Health Monitor provides a dashboard to create and view MessageBox Viewer reports, create custom queries, run Terminator tasks, monitor multiple BizTalk environments, and more. If you are responsible for a BizTalk environment, we suggest you install and use this tool to check the health of your BizTalk environment, and also maintain it.

Key links:

- [Download BHM](https://www.microsoft.com/download/details.aspx?id=43716)
- [Install BHM](https://social.technet.microsoft.com/wiki/contents/articles/26466.biztalk-server-how-to-install-the-new-biztalk-health-monitor-snap-in.aspx)
- [BHM Official Blog](https://learn.microsoft.com/en-us/archive/blogs/biztalkhealthmonitor/)

## Create Your Hosts and Host Instances

It is recommended to separate some key tasks into separate hosts. For example, always create a separate host that is dedicated to only tracking. Create another host/host instance that focuses on receiving messages, another host/host instance for sending messages, and another host/host instance for orchestration.

There are many recommendations in this area. Here are a few to get you started:

- [Managing BizTalk Hosts and Host Instances](https://learn.microsoft.com/en-us/biztalk/core/managing-biztalk-hosts-and-host-instances)
- [Providing High Availability for BizTalk Hosts](https://learn.microsoft.com/en-us/biztalk/core/providing-high-availability-for-biztalk-hosts)
- [Best Practices: Create and Configure BizTalk Server Host and Host Instances](https://social.technet.microsoft.com/wiki/contents/articles/19701.biztalk-server-best-practices-create-and-configure-biztalk-server-host-and-host-instances.aspx)
- [Running Orchestrations in Multiple Hosts on the Same Computer](https://social.technet.microsoft.com/wiki/contents/articles/31183.biztalk-server-running-orchestrations-in-multiple-hosts-on-the-same-computer.aspx)
- [PowerShell to Create and Configure BizTalk Server Host, Host Instances and Handlers](https://learn.microsoft.com/en-us/archive/technet-wiki/32456.biztalk-creating-hosts-host-instances-adapter-handlers-and-custom-event-log-with-powershell)
- [BizTalk Server Resources on the TechNet Wiki](https://learn.microsoft.com/en-us/archive/technet-wiki/53832.biztalk-server-2020)
