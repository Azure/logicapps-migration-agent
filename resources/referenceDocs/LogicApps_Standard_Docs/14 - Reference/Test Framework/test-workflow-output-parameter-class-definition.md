<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-workflow-output-parameter-class-definition -->
<!-- Title: TestWorkflowOutputParameter class -->

# TestWorkflowOutputParameter class

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.Definitions

This class represents the output parameter for a unit test flow when a Standard logic app workflow runs during test execution. The output parameter includes its type, value, description, and any associated error information.

## Usage

```C#
// Check output parameter value
Assert.AreEqual(expected: "Test", actual: testFlowRun.Outputs["outputName"].Value.Value<string>());

// Check output error
Assert.IsNull(flow.Outputs["outputName"].Error);
```

## Properties

|Name|Description|Type|Required|
|---|---|---|---|
|Type|The type of the output parameter|TestFlowTemplateParameterType?|No|
|Value|The value of the output parameter|JToken|No|
|Description|The description of the output parameter|string|No|
|Error|The operation error|TestErrorInfo|No|

## Related content

- [ActionMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition)
- [TriggerMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition)
- [TestActionExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-action-execution-context-class-definition)
- [TestExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-execution-context-class-definition)
- [TestIterationItem Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)
- [TestWorkflowRun Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-class-definition)
- [TestErrorInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)
- [TestErrorResponseAdditionalInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition)
- [TestWorkflowRunActionRepetitionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition)
- [TestWorkflowRunActionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)
- [TestWorkflowRunTriggerResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)
- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
