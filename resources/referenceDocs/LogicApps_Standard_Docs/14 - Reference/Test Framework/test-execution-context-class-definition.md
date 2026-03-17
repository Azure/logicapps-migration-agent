<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-execution-context-class-definition -->
<!-- Title: TestExecutionContext class -->

# TestExecutionContext class

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.Definitions

This class provides the execution context for a unit test used for Standard workflow testing in single-tenant Azure Logic Apps. The class helps maintain the state during test execution and is useful when you want to create dynamic mocks that respond differently based on the current workflow state.

## Usage

```C#
var actionMock = new CallExternalSystemsActionMock(name: "Call_External_Systems", onGetActionMock: (testExecutionContext) =>
{
    return new CallExternalSystemsActionMock(
        status: TestWorkflowStatus.Succeeded,
        outputs: new CallExternalSystemsActionOutput {
            Body = new JObject
            {
                { "name", testExecutionContext.ActionContext.ActionName },
                { "inputs", testExecutionContext.ActionContext.ActionInputs },
                { "scope", testExecutionContext.ActionContext.ParentActionName },
                { "iteration", testExecutionContext.ActionContext.CurrentIterationInput.Index }
            }
        }
    );
});
```

## Properties

|Name|Description|Type|Required|
|---|---|---|---|
|ActionContext|Gets the current action context.|[TestActionExecutionContext](https://learn.microsoft.com/en-us/azure/logic-apps/test-action-execution-context-class-definition)|Yes|

## Related content

- [ActionMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition)
- [TriggerMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition)
- [TestActionExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-action-execution-context-class-definition)
- [TestErrorInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)
- [TestErrorResponseAdditionalInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition)
- [TestIterationItem Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)
- [TestWorkflowOutputParameter Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-output-parameter-class-definition)
- [TestWorkflowRun Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-class-definition)
- [TestWorkflowRunActionRepetitionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition)
- [TestWorkflowRunActionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)
- [TestWorkflowRunTriggerResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)
- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
