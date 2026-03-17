<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/test-error-info-class-definition -->
<!-- Title: TestErrorInfo class -->

# TestErrorInfo class

**Namespace**: Microsoft.Azure.Workflows.UnitTesting.ErrorResponses

This class provides extended and detailed error information for Standard logic app workflow testing scenarios, including error codes, messages, nested error details, and other contextual information.

## Usage

```C#
// Simple error
var basicError = new TestErrorInfo(
    ErrorResponseCode.BadRequest,
    "Invalid input parameter"
);

// Nested errors with additional info
var detailError1 = new TestErrorInfo(
    ErrorResponseCode.ValidationError,
    "Field 'email' is required"
);

var detailError2 = new TestErrorInfo(
    ErrorResponseCode.ValidationError,
    "Field 'age' must be a positive number"
);

var additionalInfo = new TestErrorResponseAdditionalInfo[]
{
    new TestErrorResponseAdditionalInfo
    {
        Type = "RequestId",
        Info = JToken.FromObject("req-12345")
    }
};

var complexError = new TestErrorInfo(
    ErrorResponseCode.BadRequest,
    "Request validation failed",
    new[] { detailError1, detailError2 },
    additionalInfo
);
```

## Constructors

### Primary constructor

Creates a new instance of the **`TestErrorInfo`** class.

```C#
public TestErrorInfo(ErrorResponseCode code, string message, TestErrorInfo[] details = null, TestErrorResponseAdditionalInfo[] additionalInfo = null)
```

|Name|Description|Type|Required|
|---|---|---|---|
|code|The error code|ErrorResponseCode|Yes|
|message|The error message|string|Yes|
|details|The detailed error message details|[TestErrorInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)|No|
|additionalInfo|The array of additional information|[TestErrorResponseAdditionalInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition)|No|

```C#
// Example: Creating an error with code and message
var error = new TestErrorInfo(
    ErrorResponseCode.NotFound,
    "The specified resource was not found"
);
```

## Properties

|Name|Description|Type|Required|
|---|---|---|---|
|Code|The error code|ErrorResponseCode|Yes|
|Message|The error message|string|Yes|
|Details|The detailed error message details|[TestErrorInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition)|No|
|AdditionalInfo|The array of additional information|[TestErrorResponseAdditionalInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition)|No|

## Related content

- [ActionMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition)
- [TriggerMock Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition)
- [TestActionExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-action-execution-context-class-definition)
- [TestExecutionContext Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-execution-context-class-definition)
- [TestIterationItem Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition)
- [TestWorkflowRun Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-class-definition)
- [TestErrorResponseAdditionalInfo Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition)
- [TestWorkflowOutputParameter Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-output-parameter-class-definition)
- [TestWorkflowRunActionRepetitionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition)
- [TestWorkflowRunActionResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition)
- [TestWorkflowRunTriggerResult Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition)
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)
- [UnitTestExecutor Class Definition](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition)
