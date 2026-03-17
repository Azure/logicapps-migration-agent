<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-workflow-run-class-definition -->
<!-- Title: TestWorkflowRun class -->

# TestWorkflowRun class

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.Definitions

This class represents the run from a Standard logic app workflow execution for testing purposes. The class includes properties from the workflow run and contains all the data related to that workflow run, including trigger details, action results, outputs, and variables.

## Properties

|Name|Description|Type|Required|
|---|---|---|---|
|StartTime|The start time of workflow run|DateTime?|No|
|EndTime|The end time of the workflow run|DateTime?|No|
|Status|The status of the workflow run|[TestWorkflowStatus](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)|No|
|Error|The workflow run error|[TestErrorInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)|No|
|Trigger|The fired trigger for the workflow run|[TestWorkflowRunTriggerResult](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)|No|
|Actions|The actions in the workflow run |Dictionary&lt;string, [TestWorkflowRunActionResult](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)&gt;|No|
|Outputs|The outputs from the workflow run|Dictionary&lt;string, [TestWorkflowOutputParameter](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-output-parameter-class-definition)&gt;|No|
|Variables|The values from the workflow run variables|Dictionary&lt;string, JToken&gt;|No|

## Related content

- [ActionMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition)
- [TriggerMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition)
- [TestActionExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-action-execution-context-class-definition)
- [TestExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-execution-context-class-definition)
- [TestIterationItem Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)
- [TestErrorInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)
- [TestErrorResponseAdditionalInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition)
- [TestWorkflowOutputParameter Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-output-parameter-class-definition)
- [TestWorkflowRunActionRepetitionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition)
- [TestWorkflowRunActionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)
- [TestWorkflowRunTriggerResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)
- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
