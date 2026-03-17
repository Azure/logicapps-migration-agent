<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-workflow-run-action-repetition-result-class-definition -->
<!-- Title: TestWorkflowRunActionRepetitionResult class -->

# TestWorkflowRunActionRepetitionResult class

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.Definitions

This class extends the **`TestWorkflowRunActionResult`** class to represent the result from an action in a loop iteration for a Standard logic app workflow run during unit test execution. Such actions can appear inside **For each** loops or **Until** loops.

## Usage

```C#
var callExternalSystemsAction = testFlowRun.Actions["Call_External_Systems"];

for (int i=0; i<callExternalSystemsAction.Repetitions.Length; i++)
{
    var currActionRepetition = callExternalSystemsAction.Repetitions[i];

    // Check action repetition status and code
    Assert.AreEqual(expected: "200", actual: currActionRepetition.Code);
    Assert.AreEqual(expected: TestWorkflowStatus.Succeeded, actual: currActionRepetition.Status);

    // Check action repetition output value
    Assert.AreEqual(expected: "Test", actual: currActionRepetition.Outputs["outputParam"].Value<string>());

    // Check action repetition error
    Assert.IsNull(currActionRepetition.Error);
}
```

## Properties

|Name|Description|Type|Required|
|---|---|---|---|
|Name|The action name|string|Yes|
|Inputs|The action execution inputs|JToken|No|
|Outputs|The action execution outputs|JToken|No|
|Code|The action status code|string|No|
|Status|The action status|[TestWorkflowStatus](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)|Yes|
|Error|The action error|[TestErrorInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)|No|
|ChildActions|The nested action results|Dictionary&lt;string, [TestWorkflowRunActionResult](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)&gt;|No|
|Repetitions|The repetition action results|[TestWorkflowRunActionRepetitionResult](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition)|No|
|IterationItem|The iteration item|[TestIterationItem](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)|No|

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
- [TestWorkflowRunActionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)
- [TestWorkflowRunTriggerResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)
- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
