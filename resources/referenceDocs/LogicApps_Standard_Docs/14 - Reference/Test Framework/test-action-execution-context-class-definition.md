<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-action-execution-context-class-definition -->
<!-- Title: TestActionExecutionContext class -->

# TestActionExecutionContext class

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.Definitions

The execution context for a unit test action, this class stores information about the current action running in a test for a Standard logic app workflow. This information includes the action name, inputs, parent action context, and iteration details for looping scenarios.

## Properties

|Name|Description|Type|Required|
|---|---|---|---|
|ActionName|The current action name|string|Yes|
|ActionInputs|The current action inputs|JToken|No|
|ParentActionName|The current parent action name|string|No|
|CurrentIterationInput|The current iteration input|[TestIterationItem](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)|No|

## Related content

- [ActionMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition)
- [TriggerMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition)
- [TestErrorInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)
- [TestErrorResponseAdditionalInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition)
- [TestExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-execution-context-class-definition)
- [TestIterationItem Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)
- [TestWorkflowOutputParameter Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-output-parameter-class-definition)
- [TestWorkflowRun Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-class-definition)
- [TestWorkflowRunActionRepetitionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition)
- [TestWorkflowRunActionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)
- [TestWorkflowRunTriggerResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)

- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
