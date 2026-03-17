# Azure OpenAI

Source: [https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/openai/](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/openai/)

Connects to Azure OpenAI to perform operations on large language models.

This article describes the operations for the Azure OpenAI built-in connector, which is available only for Standard workflows in single-tenant Azure Logic Apps.

## Built-in connector settings

In a Standard logic app resource, the application and host settings control various thresholds for performance, throughput, timeout, and so on. For more information, see [Edit host and app settings for Standard logic app workflows](https://learn.microsoft.com/en-us/azure/logic-apps/edit-app-settings-host-settings).

## Connector how-to guide

For more information about integrating Azure OpenAI with your workflow in Azure Logic Apps, see [Integrate Azure AI services with Standard workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/azure-ai).

## Authentication

### URL and key-based authentication

Authentication type

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Azure OpenAI endpoint URL | The URL for the Azure OpenAI endpoint. | string | True |  |
| Authentication key | The authentication key for Azure OpenAI. | securestring | True |  |

### Active Directory OAuth

Active Directory OAuth

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Azure OpenAI endpoint URL | The URL for the Azure OpenAI endpoint. | string | True |  |
| Active Directory OAuth | Active Directory OAuth | string | True |  |
| Authority | Active Directory authority | string | False |  |
| Tenant | Active Directory tenant | string | True |  |
| Credential type | Active Directory credential type | string | False | Certificate, Secret |
| Client ID | Active Directory client ID | string | True |  |
| Client secret | Active Directory client secret | securestring | True |  |
| Pfx | Active Directory pfx | securestring | True |  |
| Password | Active Directory password | securestring | True |  |

### Managed identity

Managed identity

#### Parameters

| Name | Description | Type | Required | Default |
| --- | --- | --- | --- | --- |
| Azure OpenAI endpoint URL | The URL for the Azure OpenAI endpoint. | string | True |  |
| Managed identity | Managed identity | string | True |  |
| Managed identity | Managed identity | string | False |  |

## Actions

| Action | Description |
| --- | --- |
| Get an embedding | Executes a GetEmbeddings request for the specified single text input. |
| Get chat completions | Gets chat completions for the specified text input. |
| Get chat completions using Prompt Template | Gets chat completions for the specified Prompt Template. |
| Get completion | Gets completion for the specified text prompt. |
| Get multiple chat completions | Get multiple chat completion options for the specified text input. |
| Get multiple embeddings | Executes a GetEmbeddings request for the specified array of text inputs. |

### Get an embedding

- **Operation ID:** getSingleEmbedding

Executes a GetEmbeddings request for the specified single text input.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Deployment identifier | deploymentId | True | string | The deployment or model name. |
| Single text input | input | True | string | The single text to convert to an embedding. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Embedding | embedding | string | An array of floats that represent the input's computed embeddings. |
| Usage details | usage | string | The token usage details. |

### Get chat completions

- **Operation ID:** getChatCompletions

Gets chat completions for the specified text input.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Deployment identifier | deploymentId | True | string | The deployment or model name. |
| Sampling temperature | temperature |  | string | A value that controls the apparent creativity of generated completions. Higher values make output more random, while lower values make results more focused and deterministic. |
| messages | messages | True | string | The deployment or model name. |
| Nucleus sampling (top_p) | top_p |  | string | A value that controls the apparent creativity of generated completions and an alternative to 'Temperature'. Recommendation: Change either this value or 'Temperature', but not both. |
| Max tokens | max_tokens |  | string | The maximum number of tokens to generate for a chat completion. |
| Presence penalty | presence_penalty |  | string | A value that influences the probability of generated tokens appearing, based on their existence in generated text. Positive values penalize new tokens, based on their frequency in the text so far and decreasing the model's likelihood to repeat the same line verbatim. |
| Frequency penalty | frequency_penalty |  | string | A value that affects the probability of generated tokens appearing, based on their cumulative frequency. Positive values penalize new tokens, based on their frequency in the text so far and decreasing the model's likelihood to repeat the same line verbatim. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Chat completion output role | role | string | The chat completion output role. |
| Chat completion response | content | string | The chat completion response. |
| Chat user | name | string | A unique identifier that represents the chat user, which can help monitor and detect abuse. |
| Usage details | usage | string | The token usage details. |

### Get chat completions using Prompt Template

- **Operation ID:** getChatCompletionsUsingPromptTemplate

Gets chat completions for the specified Prompt Template.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Deployment identifier | deploymentId | True | string | The deployment or model name. |
| Sampling temperature | temperature |  | string | A value that controls the apparent creativity of generated completions. Higher values make output more random, while lower values make results more focused and deterministic. |
| Prompt Template | promptTemplateInput | True | string | The prompt template in Prompty liquid format. See https://aka.ms/logic-apps/liquid-prompt-templates for more details. |
| Prompt Template Variable | promptTemplateInputVariables |  | object | The prompt template variables. |
| Nucleus sampling (top_p) | top_p |  | string | A value that controls the apparent creativity of generated completions and an alternative to 'Temperature'. Recommendation: Change either this value or 'Temperature', but not both. |
| Max tokens | max_tokens |  | string | The maximum number of tokens to generate for a chat completion. |
| Presence penalty | presence_penalty |  | string | A value that influences the probability of generated tokens appearing, based on their existence in generated text. Positive values penalize new tokens, based on their frequency in the text so far and decreasing the model's likelihood to repeat the same line verbatim. |
| Frequency penalty | frequency_penalty |  | string | A value that affects the probability of generated tokens appearing, based on their cumulative frequency. Positive values penalize new tokens, based on their frequency in the text so far and decreasing the model's likelihood to repeat the same line verbatim. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Prompt template request | request | string | The prompt template request. |
| Prompt template response | response | string | The chat completion input role. |
| Usage details | usage | string | The token usage details. |

### Get completion

- **Operation ID:** getCompletion

Gets completion for the specified text prompt.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Deployment identifier | deploymentId | True | string | The deployment or model name. |
| Sampling temperature | temperature |  | string | A value that controls the apparent creativity of generated completions. Higher values make output more random, while lower values make results more focused and deterministic. |
| prompts | prompts | True | string | The deployment or model name. |
| stopSequences | stopSequences |  | string | The deployment or model name. |
| Max tokens | max_tokens |  | string | The maximum number of tokens to generate for a chat completion. |
| Presence penalty | presence_penalty |  | string | A value that influences the probability of generated tokens appearing, based on their existence in generated text. |
| Frequency penalty | frequency_penalty |  | string | A value that affects the probability of generated tokens appearing, based on their cumulative frequency. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Completion response | text | string | The completion response. |
| Usage details | usage | string | The token usage details. |

### Get multiple chat completions

- **Operation ID:** getMultipleChatCompletions

Get multiple chat completion options for the specified text input.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Deployment identifier | deploymentId | True | string | The deployment or model name. |
| Sampling temperature | temperature |  | string | A value that controls the apparent creativity of generated completions. |
| messages | messages | True | string | The deployment or model name. |
| Nucleus sampling (top_p) | top_p |  | string | A value that controls the apparent creativity of generated completions and an alternative to 'Temperature'. |
| Max tokens | max_tokens |  | string | The maximum number of tokens to generate for a chat completion. |
| Choice count (n) | n |  | string | The number of chat responses to generate. To minize costs, keep this value set to 1. |
| Presence penalty | presence_penalty |  | string | A value that influences the probability of generated tokens appearing. |
| Frequency penalty | frequency_penalty |  | string | A value that affects the probability of generated tokens appearing, based on their cumulative frequency. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Chat message choices | choices | string | The array of chat message choices. |
| Usage details | usage | string | The token usage details. |

### Get multiple embeddings

- **Operation ID:** getArrayEmbeddings

Executes a GetEmbeddings request for the specified array of text inputs.

#### Parameters

| Name | Key | Required | Type | Description |
| --- | --- | --- | --- | --- |
| Deployment identifier | deploymentId | True | string | The deployment or model name. |
| Array input | input | True | string | The array input to convert to embeddings. |

#### Returns

| Name | Path | Type | Description |
| --- | --- | --- | --- |
| Embeddings array | embeddings | string | An array with arrays of floats representing the input's computed embeddings. |
| Usage details | usage | string | The token usage details. |

## Additional Links

- [Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Built-in connector settings](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/openai/#built-in-connector-settings)
- [Connector how-to guide](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/openai/#connector-how-to-guide)
- [Authentication](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/openai/#authentication)
- [Actions](https://learn.microsoft.com/en-us/azure/logic-apps/connectors/built-in/reference/openai/#actions)
