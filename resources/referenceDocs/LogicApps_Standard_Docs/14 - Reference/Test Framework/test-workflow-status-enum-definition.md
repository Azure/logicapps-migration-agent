<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-workflow-status-enum-definition -->
<!-- Title: TestWorkflowStatus enum -->

# TestWorkflowStatus enum

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.Definitions

This enumeration represents the possible execution states that a unit test run can have for a Standard logic app workflow, trigger, or action during test execution.

## Values

|Name|Description|
|---|---|
|Succeeded|The status is 'Succeeded.'|
|Skipped|The status is 'Skipped.'|
|Cancelled|The status is 'Cancelled.'|
|Failed|The status is 'Failed.'|
|TimedOut|The status is 'Timed out.'|
|Terminated|The status is 'Terminated.'|
|NotSpecified|The status isn't specified.|

> [!NOTE]
>
> You can create mock operations with only the **Succeeded** and **Failed** statuses. Azure Logic 
> Apps uses the other statuses to report the final operation state after execution completes.

## Related content

- [ActionMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition)
- [TriggerMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition)
- [TestActionExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-action-execution-context-class-definition)
- [TestExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-execution-context-class-definition)
- [TestIterationItem Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)
- [TestWorkflowRun Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-class-definition)
- [TestErrorInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)
- [TestErrorResponseAdditionalInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition)
- [TestWorkflowOutputParameter Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-output-parameter-class-definition)
- [TestWorkflowRunActionRepetitionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition)
- [TestWorkflowRunActionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)
- [TestWorkflowRunTriggerResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)
- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
