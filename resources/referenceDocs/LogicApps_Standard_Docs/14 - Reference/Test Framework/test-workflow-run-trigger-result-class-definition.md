<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-workflow-run-trigger-result-class-definition -->
<!-- Title: TestWorkflowRunTriggerResult class -->

# TestWorkflowRunTriggerResult class

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.Definitions

This class represents the result from the trigger execution in a Standard logic app workflow run during unit test execution. The class also provides specific functionality for trigger operations.

## Usage

```C#
// Check trigger status and code
Assert.AreEqual(expected: "200", actual: testFlowRun.Trigger.Code);
Assert.AreEqual(expected: TestWorkflowStatus.Succeeded, actual: testFlowRun.Trigger.Status);

// Check trigger output value
Assert.AreEqual(expected: "Test", actual: testFlowRun.Trigger.Outputs["outputParam"].Value<string>());

// Check trigger error
Assert.IsNull(testFlowRun.Trigger.Error);
```

## Properties

|Name|Description|Type|Required|
|---|---|---|---|
|Name|The trigger name|string|Yes|
|Inputs|The trigger execution inputs|JToken|No|
|Outputs|The trigger execution outputs|JToken|No|
|Code|The trigger status code|string|No|
|Status|The trigger status|[TestWorkflowStatus](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)|Yes|
|Error|The trigger error|[TestErrorInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)|No|

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
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)
- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
