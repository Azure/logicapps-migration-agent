<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps-reference -->
<!-- Title: Monitoring data reference for Azure Logic Apps -->

# Azure Logic Apps monitoring data reference

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-intro.md)

For details about the data you can collect for Azure Logic Apps and how to use that data, see [Monitor Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps).

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-metrics-intro.md)

### Supported metrics for Microsoft.Logic/IntegrationServiceEnvironments

The following table lists the metrics available for the **Microsoft.Logic/IntegrationServiceEnvironments** resource type.

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-metrics-tableheader.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/reference/metrics/microsoft-logic-integrationserviceenvironments-metrics-include.md)  

### Supported metrics for Microsoft.Logic/Workflows

The following table lists the metrics available for the **Microsoft.Logic/Workflows** resource type.

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-metrics-tableheader.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/reference/metrics/microsoft-logic-workflows-metrics-include.md)  

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-metrics-dimensions-intro.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-no-metrics-dimensions.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-resource-logs.md)

### Supported resource logs for Microsoft.Logic/IntegrationAccounts

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/reference/logs/microsoft-logic-integrationaccounts-logs-include.md)

### Supported resource logs for Microsoft.Logic/Workflows

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/reference/logs/microsoft-logic-workflows-logs-include.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-logs-tables.md)

### Azure Logic Apps

Microsoft.Logic/workflows

- [AzureActivity](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/AzureActivity#columns)
- [AzureMetrics](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/AzureMetrics#columns)
- [AzureDiagnostics](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/AzureDiagnostics#columns). Logs are collected in the **AzureDiagnostics** table under the resource provider name of `MICROSOFT.LOGIC`.
- [LogicAppWorkflowRuntime](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/LogicAppWorkflowRuntime#columns)

### Integration account

Microsoft.Logic/integrationAccounts

- [AzureActivity](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/AzureActivity#columns)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-ref-activity-log.md)

- [Microsoft.Logic resource provider operations](https://learn.microsoft.com/en-us/azure/role-based-access-control/permissions/integration#microsoftlogic)

## Related content

- For an overview about monitoring Azure Logic Apps, see [Monitor Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps-overview).
- For a description about monitoring workflow status and history and creating alerts, see [Monitor workflows](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps).
- For details about monitoring Azure resources, see [Monitor Azure resources with Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/monitor-azure-resource).
