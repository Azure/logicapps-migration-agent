<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps-overview -->
<!-- Title: Monitor logic app workflows -->

# Monitor workflows in Azure Logic Apps

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-intro.md)

For a detailed guide describing how to check Azure Logic Apps workflow status, view workflow run history, and set up alerts, see [Check workflow status, view workflow run history, and set up alerts](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps).

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-insights.md)

### Application Insights

You can set up Application Insights for a logic app or Log Analytics workspace after creation.

[Enable and view enhanced telemetry in Application Insights for Standard workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/enable-enhanced-telemetry-standard-workflows) shows how to turn on enhanced telemetry collection for a Standard logic app resource in Application Insights and view the collected data after the workflow finishes a run.

If your logic app creation and deployment settings support using Application Insights, you can optionally enable diagnostics logging and tracing for your logic app workflow. For more information, see [Enable or open Application Insights after deployment](https://learn.microsoft.com/en-us/azure/logic-apps/create-single-tenant-workflows-azure-portal#enable-open-application-insights).

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-resource-types.md)
For more information about the resource types for Azure Logic Apps, see [Azure Logic Apps monitoring data reference](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps-reference).

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-data-storage.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-platform-metrics.md)

- For a detailed guide showing how to check health and performance metrics for both Consumption and Standard logic app workflows, see [View metrics for workflow health and performance](https://learn.microsoft.com/en-us/azure/logic-apps/view-workflow-metrics).
- For a list of available metrics for Azure Logic Apps, see [Azure Logic Apps monitoring data reference](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps-reference#metrics).

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-resource-logs.md)

- For a detailed walkthrough showing how to set up Azure Monitor Logs and a Log Analytics workspace for Azure Logic Apps workflows, see [Monitor and collect diagnostic data for workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-workflows-collect-diagnostic-data).

- To learn how to set up diagnostic logging and monitor logic apps in Microsoft Defender for Cloud, see [Set up logging to monitor logic apps in Microsoft Defender for Cloud](https://learn.microsoft.com/en-us/azure/logic-apps/healthy-unhealthy-resource).

- For the available resource log categories, their associated Log Analytics tables, and log schemas for Azure Logic Apps, see [Azure Logic Apps monitoring data reference](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps-reference#resource-logs).

## Monitoring for B2B workflows

Azure Logic Apps includes built-in tracking that you can enable for parts of your workflow. To help you monitor the successful delivery or receipt, errors, and properties for business-to-business (B2B) messages, you can create and use AS2, X12, and custom tracking schemas in your integration account.

- To monitor a Consumption workflow that handles business-to-business (B2B) messages in Azure Logic Apps, see [Monitor and track B2B messages in Consumption workflows with Azure Monitor and Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-track-b2b-messages-consumption).

- To monitor a Standard workflow that handles business-to-business (B2B) messages in Azure Logic Apps, see [Monitor and track B2B transactions in Standard workflows](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-track-b2b-transactions-standard).

- For a reference guide to the syntax and attributes for the tracking schemas, see the following documentation:

  - [Tracking schemas for B2B messages in Consumption workflows](https://learn.microsoft.com/en-us/azure/logic-apps/tracking-schemas-consumption)
  - [Tracking schemas for B2B transactions in Standard workflows](https://learn.microsoft.com/en-us/azure/logic-apps/tracking-schemas-standard)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-activity-log.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-analyze-data.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-external-tools.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-kusto-queries.md)

For a detailed guide showing how to view and create queries for Azure Logic Apps, see [View and create queries for monitoring and tracking](https://learn.microsoft.com/en-us/azure/logic-apps/create-monitoring-tracking-queries).

### Sample Kusto queries

Here are some sample queries for analyzing Azure Logic Apps workflow executions.

#### Total executions

Total billable executions by operation name.

```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.LOGIC"
| where Category == "WorkflowRuntime" 
| where OperationName has "workflowTriggerStarted" or OperationName has "workflowActionStarted" 
| summarize dcount(resource_runId_s) by OperationName, resource_workflowName_s
```

#### Execution distribution

Hourly time chart for logic app execution distribution by workflow.

```kusto
AzureDiagnostics 
| where ResourceProvider == "MICROSOFT.LOGIC"
| where Category == "WorkflowRuntime"
| where OperationName has "workflowRunStarted"
| summarize dcount(resource_runId_s) by bin(TimeGenerated, 1h), resource_workflowName_s
| render timechart 
```

#### Execution status summary

Completed executions by workflow, status, and error.

```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.LOGIC"
| where OperationName has "workflowRunCompleted"
| summarize dcount(resource_runId_s) by resource_workflowName_s, status_s, error_code_s
| project LogicAppName = resource_workflowName_s , NumberOfExecutions = dcount_resource_runId_s , RunStatus = status_s , Error = error_code_s 
```

#### Triggered failures count

Action or trigger failures for all logic app workflow executions by resource name.

```kusto
AzureDiagnostics
| where ResourceProvider  == "MICROSOFT.LOGIC"  
| where Category == "WorkflowRuntime" 
| where status_s == "Failed" 
| where OperationName has "workflowActionCompleted" or OperationName has "workflowTriggerCompleted" 
| extend ResourceName = coalesce(resource_actionName_s, resource_triggerName_s) 
| extend ResourceCategory = substring(OperationName, 34, strlen(OperationName) - 43) | summarize dcount(resource_runId_s) by code_s, ResourceName, resource_workflowName_s, ResourceCategory, _ResourceId
| project ResourceCategory, ResourceName , FailureCount = dcount_resource_runId_s , ErrorCode = code_s, LogicAppName = resource_workflowName_s, _ResourceId 
| order by FailureCount desc 
```

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-alerts.md)

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-insights-alerts.md)

> [!NOTE]
>
> Available alert signals differ between Consumption and Standard logic apps. For example, 
> Consumption logic apps have many trigger-related signals, such as **Triggers Completed** 
> and **Triggers Failed**, while Standard workflows have the **Workflow Triggers Completed Count** 
> and **Workflow Triggers Failure Rate** signals.

### Azure Logic Apps alert rules

The following table lists some alert rules for Azure Logic Apps. These alerts are just examples. You can set alerts for any metric, log entry, or activity log entry that's listed in the [Azure Logic Apps monitoring data reference](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps-reference).

| Alert type | Condition | Description |
|:---|:---|:---|
| Metric | Triggers Failed | Whenever the count for **Triggers Failed** is greater than or equal to 1 |
| Activity Log | Workflow Deleted | Whenever the Activity Log has an event with **Category='Administrative', Signal name='Delete Workflow (Workflow)'** |

[Include](https://learn.microsoft.com/en-us/azure/reusable-content/ce-skilling/azure/includes/azure-monitor/horizontals/horz-monitor-advisor-recommendations.md)

## Related content

- For reference information about the metrics, logs, and other important values created for Azure Logic Apps, see [Azure Logic Apps monitoring data reference](https://learn.microsoft.com/en-us/azure/logic-apps/monitor-logic-apps-reference).
- For general details on monitoring Azure resources, see [Monitoring Azure resources with Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/monitor-azure-resource).
