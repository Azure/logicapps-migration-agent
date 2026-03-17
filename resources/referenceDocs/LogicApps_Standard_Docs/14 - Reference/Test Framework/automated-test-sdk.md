<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/testing-framework/automated-test-sdk -->
<!-- Title: Azure Logic Apps Automated Test SDK -->

# Azure Logic Apps Automated Test SDK

This SDK provides a comprehensive framework for unit testing Standard workflows in single-tenant Azure Logic Apps. You can create mock operations and data, run workflows in isolation, and validate execution results.

The SDK contains several key components that work together to provide a complete testing solution:

| Component | Description |
|-----------|-------------|
| **Test execution** | Core classes for running workflow tests and data map transformations |
| **Mock data** | Classes for creating mock triggers and actions |
| **Test context** | Classes that represent test execution state and context |
| **Results** | Classes that contain workflow execution results and status information |
| **Error handling** | Classes for managing test errors and exceptions |

## SDK classes and enums

| Class/Enum | Description | Type |
|------------|-------------|------|
| [UnitTestExecutor](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition) | Main entry point for executing unit tests for Standard workflows in Azure Logic Apps | Class |
| [DataMapTestExecutor](https://learn.microsoft.com/en-us/azure/logic-apps/data-map-test-executor-class-definition) | Provides functionality to compile, generate XSLT, and execute data map tests for Standard workflows | Class |
| [ActionMock](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition) | Represents a mock action for workflow testing. | Class |
| [TriggerMock](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition) | Represents a mock trigger for workflow testing. | Class |
| [TestActionExecutionContext](https://learn.microsoft.com/en-us/azure/logic-apps/test-action-execution-context-class-definition) | Represents the execution context for a specific action in a test workflow. | Class |
| [TestExecutionContext](https://learn.microsoft.com/en-us/azure/logic-apps/test-execution-context-class-definition) | Represents the execution context for a test workflow. | Class |
| [TestIterationItem](https://learn.microsoft.com/en-us/azure/logic-apps/test-iteration-item-class-definition) | Represents an iteration item in a test workflow execution. | Class |
| [TestWorkflowRun](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-class-definition) | Represents the result of a workflow test execution. | Class |
| [TestErrorInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-info-class-definition) | Contains detailed information about errors that occur during workflow testing. | Class |
| [TestErrorResponseAdditionalInfo](https://learn.microsoft.com/en-us/azure/logic-apps/test-error-response-additional-info-class-definition) | Contains more information about error responses in workflow testing. | Class |
| [TestWorkflowOutputParameter](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-output-parameter-class-definition) | Represents an output parameter from a workflow test execution. | Class |
| [TestWorkflowRunActionRepetitionResult](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-repetition-result-class-definition) | Represents the result of an action repetition in a workflow test run. | Class |
| [TestWorkflowRunActionResult](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-action-result-class-definition) | Represents the result of an action execution in a workflow test run. | Class |
| [TestWorkflowRunTriggerResult](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-trigger-result-class-definition) | Represents the result of a trigger execution in a workflow test run. | Class |
| [TestWorkflowStatus](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-status-enum-definition) | Defines the possible status values for a test workflow execution. | Enum |

## Get started

To begin using the Azure Logic Apps Automated Test SDK, set up and run your workflow tests by starting with the [**`UnitTestExecutor`**](https://learn.microsoft.com/en-us/azure/logic-apps/unit-test-executor-class-definition) class. For data map testing and transformations, use the [**`DataMapTestExecutor`**](https://learn.microsoft.com/en-us/azure/logic-apps/data-map-test-executor-class-definition) class. Create test data with the [**`ActionMock`**](https://learn.microsoft.com/en-us/azure/logic-apps/action-mock-class-definition) and [**`TriggerMock`**](https://learn.microsoft.com/en-us/azure/logic-apps/trigger-mock-class-definition) classes, and validate your workflow behavior by examining the [**`TestWorkflowRun`**](https://learn.microsoft.com/en-us/azure/logic-apps/test-workflow-run-class-definition) results.

## Key concepts

### Test execution flow

#### Workflow testing

1. **Initialize**: Create a **`UnitTestExecutor`** object with your workflow definition and configuration files.

1. **Mock the data**: Create **`TriggerMock`** and **`ActionMock`** objects to simulate external dependencies.

1. **Execute**: Run the workflow using the **`RunWorkflowAsync()`** method.

1. **Validate**: Examine the **`TestWorkflowRun`** result to verify the expected behavior.

#### Data map testing

1. **Initialize**: Create a **`DataMapTestExecutor`** object with your logic app project path.

1. **Generate XSLT**: Compile your data map definition to XSLT using the **`GenerateXslt()`** method.

1. **Execute**: Run the transformation using the **`RunMapAsync()`** method with sample input data.

1. **Validate**: Examine the transformation output to verify the expected results.

### Mock objects

Mock objects let you simulate external dependencies and control the data flow in your tests.

- **`TriggerMock`**: Simulates workflow triggers, such as HTTP requests, timers, and so on.
- **`ActionMock`**: Simulates workflow actions, such as API calls, database operations, and so on.

### Test results

The SDK provides the following detailed information about test execution:

| Item | Description |
|------|-------------|
| **Status** | Overall workflow execution status |
| **Actions** | Individual action execution results |
| **Errors** | Detailed error information if execution fails |
| **Output** | Workflow output parameters and values |

## Best practices

- Create comprehensive mock data that covers both success and failure scenarios.
- Improve test readability by using meaningful names for your mock objects.
- Validate both successful execution paths and error handling scenarios.
- Organize your test files in a clear directory structure.
- Use appropriate timeout values for your specific workflow requirements.

## Related content

- [Create unit tests from Standard workflow definitions in Azure Logic Apps with Visual Studio Code](https://learn.microsoft.com/en-us/azure/logic-apps/create-unit-tests-Standard-workflow-definitions-visual-studio-code)
- [Create unit tests from Standard workflow runs in Azure Logic Apps with Visual Studio Code](https://learn.microsoft.com/en-us/azure/logic-apps/create-unit-tests-standard-workflow-runs-visual-studio-code)
