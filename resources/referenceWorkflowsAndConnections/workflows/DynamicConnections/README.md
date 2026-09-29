# Dynamic Built-in Connection Selection

These are connector-neutral format templates, not deployable files. Replace all angle-bracket placeholders using the selected connector's references before generating a real project.

Source: [Dynamic Connection Properties in Azure Logic Apps Standard](https://techcommunity.microsoft.com/blog/integrationsonazureblog/dynamic-connection-properties-in-azure-logic-apps-standard/4527525).

## Files

- [workflow.json](workflow.json): one `ServiceProvider` action and a response. The inline expression selects `connectionA` when `team` is `teamA`, otherwise `connectionB`, preserving the supplied example's selection pattern. No resolver or validation actions are added.
- [connections.json](../../connections/DynamicConnections/connections.json): two built-in connections for that selection, plus a separate generic managed-connection entry illustrating the supplied managed format. The workflow does not use the managed connection; omit it when not needed.

## Connector-Specific Values

| Placeholder | Replace with |
| --- | --- |
| `<providerId>` | Exact built-in provider identifier; use the same provider in the action and both connections |
| `<operationId>` | Exact operation ID for that provider |
| `<operationParameterName>` | Actual action parameter name; expand the parameter object for the selected operation |
| `<connectionParameterName>` | Actual connection parameter name; expand `parameterValues` for the selected connector |
| `<managedApiName>` | Managed connector API name |
| `<managedConnectionResourceName>` | Deployed managed connection resource name |

`operationInput` is unconstrained in the template; set its request schema and action mapping to the types required by the selected operation. Keep connection keys and references case-sensitive and consistent when renaming them.

Use separate app settings for each built-in connection's values. Include `parameterSetName` and `authProvider` only when required by that connector's authentication format; do not assume every provider uses the Key Vault managed-identity shape from the supplied example. Keep secrets out of source control.

For managed connections, supply the workflow subscription/location/resource-group app settings and the runtime URL/authentication workflow parameters shown in the template. Match their authentication values to the managed connector's actual configuration.

## Scope

- Choose the connector from the source flow, not from an example. Dynamic `connectionName` selection is for built-in `ServiceProvider` actions, not `managedApiConnections`.
- Every selected key must already exist under `serviceProviderConnections`; this does not create connections at runtime.
- Author dynamic names in Code View; the designer does not visually support them.
- Adapt the selector/default behavior to the source flow and its access requirements. The template's `team` field is not proof of authorization.
- Search reference tools for `DynamicConnections` to find these format templates, then use connector-specific references for real IDs, parameters, and authentication.