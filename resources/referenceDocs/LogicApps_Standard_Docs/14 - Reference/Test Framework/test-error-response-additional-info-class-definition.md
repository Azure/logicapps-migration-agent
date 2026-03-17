<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-error-response-additional-info-class-definition -->
<!-- Title: TestErrorResponseAdditionalInfo class -->

# TestErrorResponseAdditionalInfo class

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.ErrorResponses

This class provides more contextual information for the error responses in workflow testing scenarios. The information schema is service-specific and dependent on the **Type** string.

## Usage

```C#
// The request ID for the additional info
var requestIdInfo = new TestErrorResponseAdditionalInfo
{
    Type = "RequestId",
    Info = JToken.FromObject("req-abc123")
};

// The timestamp for the additional info
var timestampInfo = new TestErrorResponseAdditionalInfo
{
    Type = "Timestamp",
    Info = JToken.FromObject(DateTime.UtcNow)
};

// Complex additional info with nested data
var complexInfo = new TestErrorResponseAdditionalInfo
{
    Type = "ValidationDetails",
    Info = JToken.Parse(@"{
        ""field"": ""email"",
        ""providedValue"": ""invalid-email"",
        ""expectedFormat"": ""user@domain.com""
    }")
};

// Use in error context
var error = new TestErrorInfo(
    ErrorResponseCode.BadRequest,
    "Validation failed",
    null,
    new[] { requestIdInfo, timestampInfo }
);
```

## Properties

|Name|Description|Type|Required|
|---|---|---|---|
|Type|The type for the additional error info|string|No|
|Info|The additional information|JToken|No|

## Related content

- [ActionMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition)
- [TriggerMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition)
- [TestActionExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-action-execution-context-class-definition)
- [TestExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-execution-context-class-definition)
- [TestIterationItem Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)
- [TestWorkflowRun Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-class-definition)
- [TestErrorInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)
- [TestWorkflowOutputParameter Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-output-parameter-class-definition)
- [TestWorkflowRunActionRepetitionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition)
- [TestWorkflowRunActionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)
- [TestWorkflowRunTriggerResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)
- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
