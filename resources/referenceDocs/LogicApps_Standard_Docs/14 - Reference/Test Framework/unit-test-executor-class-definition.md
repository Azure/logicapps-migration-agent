<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/unit-test-executor-class-definition -->
<!-- Title: UnitTestExecutor class -->

# UnitTestExecutor class

This class provides functionality to run unit tests for Standard logic app workflows in single-tenant Azure Logic Apps. The class serves as the main entry point for running workflow tests with mock data and custom configurations.

## Namespace

**`Microsoft.Azure.Workflows.UnitTesting`**

## Usage

You can use the **`UnitTestExecutor`** class to load workflow definitions and run the workflows by using test data:

```csharp
// Initialize with workflow file path
var executor = new UnitTestExecutor("path/to/workflow.json");

// Initialize with all configuration files
var executor = new UnitTestExecutor(
    workflowFilePath: "path/to/workflow.json",
    connectionsFilePath: "path/to/connections.json",
    parametersFilePath: "path/to/parameters.json",
    localSettingsFilePath: "path/to/local.settings.json"
);

// Execute workflow with test mocks
var testMock = new TestMockDefinition
{
    TriggerMock = new TriggerMock { /* trigger configuration */ },
    ActionMocks = new List<ActionMock> { /* action mocks */ }
};

var result = await executor.RunWorkflowAsync(testMock);
```

## Constructors

### UnitTestExecutor(string, string, string, string)

Initializes a new instance for the **`UnitTestExecutor`** class by using workflow and configuration files.

#### Parameters

| Name | Type | Description | Required |
|------|------|-------------|----------|
| workflowFilePath | string | The path to the workflow definition file | Yes |
| connectionsFilePath | string | The path to the connections configuration file | No |
| parametersFilePath | string | The path to the parameters configuration file | No |
| localSettingsFilePath | string | The path to the local settings file | No |

#### Example

```csharp
var executor = new UnitTestExecutor(
    workflowFilePath: "MyWorkflow/workflow.json",
    connectionsFilePath: "MyWorkflow/connections.json",
    parametersFilePath: "MyWorkflow/parameters.json",
    localSettingsFilePath: "local.settings.json"
);
```

## Properties

### WorkflowSettings

The workflow definition settings.

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| WorkflowSettings | TestWorkflowSettings | Configuration settings for the workflow test execution | Yes |

## Methods

### RunWorkflowAsync(TestMockDefinition, string, int)

Executes a workflow by using the provided configuration files with the specified mock trigger and mock action.

#### Parameters

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| testMock | TestMockDefinition | The test mock definition containing the mock trigger and mock action | Yes | - |
| customCodeFunctionFilePath | string | The path to custom code function file | No | null |
| timeoutInSeconds | int | The timeout configuration in seconds | No | DefaultUnitTestTimeoutSeconds |

#### Returns

**`Task<TestWorkflowRun>`**: A task that represents the asynchronous operation that returns the workflow run result.

#### Example

```csharp
var testMock = new TestMockDefinition
{
    TriggerMock = new TriggerMock
    {
        Kind = "Http",
        Outputs = new
        {
            body = new { message = "Test message" },
            statusCode = 200
        }
    },
    ActionMocks = new List<ActionMock>
    {
        new ActionMock
        {
            ActionName = "Send_an_email",
            Kind = "Office365Outlook",
            Outputs = new { status = "success" }
        }
    }
};

// Run with default timeout
var result = await executor.RunWorkflowAsync(testMock);

// Run with custom timeout and custom code
var result = await executor.RunWorkflowAsync(
    testMock: testMock,
    customCodeFunctionFilePath: "path/to/custom-functions.js",
    timeoutInSeconds: 120
);
```

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
- [TestWorkflowStatus Enum Definition](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition)
