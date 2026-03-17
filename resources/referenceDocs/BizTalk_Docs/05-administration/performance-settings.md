> Source: https://learn.microsoft.com/en-us/biztalk/core/managing-biztalk-server-performance-settings

# Manage BizTalk Server Performance Settings

The BizTalk Settings Dashboard in BizTalk Server collates the performance settings, and provides a central console to manage these settings. This helps to:

- Improve the discoverability of the properties that can be set
- Reduce the time-to-solution because all settings are now accessible in a single place and can be exported/imported easily
- Offers a holistic view of level of performance tuning done on a given BizTalk deployment

## Why Use It?

The BizTalk Settings Dashboard is targeted towards IT administrators who need to extensively tweak BizTalk Server settings for performance optimization.

You can use the BizTalk Settings Dashboard to modify settings for the BizTalk Group, and all the BizTalk Hosts and BizTalk Host Instances in that Group.

To know more about the group, host, and host instance settings, see [How to Modify Group Settings](https://learn.microsoft.com/en-us/biztalk/core/how-to-modify-group-settings), [How to Modify Host Settings](https://learn.microsoft.com/en-us/biztalk/core/how-to-modify-host-settings), and [How to Modify Host Instance Settings](https://learn.microsoft.com/en-us/biztalk/core/how-to-modify-host-instance-settings).

## Prerequisites

You can launch the BizTalk Settings Dashboard from the BizTalk Server Administration console. For information on how to manage BizTalk Server performance settings using the BizTalk Server Administration console, see [Using the BizTalk Server Administration Console](https://learn.microsoft.com/en-us/biztalk/core/using-the-biztalk-server-administration-console).

## Where Do I Start?

You can access the BizTalk Settings Dashboard in any of the following ways:

- Start the BizTalk Server Administration console, right-click **BizTalk Group** in the console tree, and then select **Settings**.
- Right-click any host under the **Platform Settings** node in MMC and click on **Settings**. This launches BizTalk Settings Dashboard and you can modify the settings related to that host.
- Right-click any host instance under the **Platform Settings** node in MMC and click on **Settings**. This launches BizTalk Settings Dashboard and you can modify the settings related to that host instance.

## Export and Import Settings

The BizTalk Settings Dashboard can be used to export settings from a BizTalk Server environment and import it into another BizTalk Server environment, thereby reducing the overall time-to-solution. This is especially useful in scenarios where the administrators try to tune BizTalk Server performance in a test environment, and upon achieving the desired results, they can import the settings into a production environment.

For information about how to import/export using the BizTalk Settings Dashboard user interface, see [Import or export BizTalk Settings Using Settings Dashboard](https://learn.microsoft.com/en-us/biztalk/core/how-to-import-biztalk-settings-using-settings-dashboard).

## Scripting Support

The BizTalk Settings Dashboard not only provides a central user interface to manage BizTalk settings but also ensures that all settings and the import/export tasks are accessible via APIs and command-line options. This enables BizTalk Server administrators to automate tasks related to BizTalk Server settings. As part of the scripting support:

- All group settings can be accessed and modified via the WMI Class: `MSBTS_GroupSetting`
- All host settings can be accessed and modified via the WMI Class: `MSBTS_HostSetting`
- All host instance settings can be accessed and modified via the WMI Class: `MSBTS_HostInstanceSetting`
- Import and export operations can be accessed through BTSTask.exe commands: `ExportSettings` and `ImportSettings`

For details about how to import/export using the BTSTask.exe command-line utility, see [Import or export BizTalk Settings Using BTSTask](https://learn.microsoft.com/en-us/biztalk/core/how-to-import-biztalk-settings-using-btstask).

## Next

- [Use Settings Dashboard for BizTalk Server Performance Tuning](https://learn.microsoft.com/en-us/biztalk/core/using-settings-dashboard-for-biztalk-server-performance-tuning)
- [Automate BizTalk Server Performance Tuning](https://learn.microsoft.com/en-us/biztalk/core/automating-biztalk-server-performance-tuning)

## See Also

- [Manage BizTalk Server](https://learn.microsoft.com/en-us/biztalk/core/use-groups-create-artifacts-optimize-performance-and-more-in-biztalk-server)
