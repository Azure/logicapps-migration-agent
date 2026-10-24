---
name: soap-built-in-connector
description: Rules for migrating SOAP and compatible WCF web-service calls to the Logic Apps Standard built-in SOAP connector using WSDL-driven operations and supported authentication modes.
---

# Skill: SOAP Built-In Connector

> **Purpose**: Generate WSDL-driven SOAP calls with the Logic Apps Standard built-in SOAP service provider instead of hand-building SOAP envelopes with the HTTP connector.

## 1. When to Use

Read and apply this skill whenever a source flow uses:

- BizTalk `SOAP`
- `WCF-BasicHttp`
- `WCF-WSHttp` when its binding and security features are supported by the connector
- another SOAP-over-HTTP service with an accessible WSDL

Prefer the built-in SOAP connector when the WSDL imports successfully and its authentication and SOAP requirements are supported.

Use the HTTP connector or another approved design only when the SOAP connector cannot import or invoke the service. Record the unsupported WSDL, binding, transport, policy, authentication, or WS-\* requirement as a migration gap. `WCF-NetTcp` is not SOAP-over-HTTP and must not be mapped to this connector without an explicit protocol redesign.

## 2. Service Provider Contract

Use:

- Service provider ID: `/serviceProviders/soap`
- Action operation ID: `invokeOperation`
- Action type: `ServiceProvider`

The connector invokes operations; it does not provide an inbound SOAP trigger.

Example action shape:

```json
{
    "Invoke_SOAP_Operation": {
        "type": "ServiceProvider",
        "inputs": {
            "parameters": {
                "importMethod": "SoapToRest",
                "operationName": "Multiply",
                "soapVersion": "1.1",
                "parameters": {
                    "intA": 1000,
                    "intB": 999
                }
            },
            "serviceProviderConfiguration": {
                "connectionName": "soap",
                "operationId": "invokeOperation",
                "serviceProviderId": "/serviceProviders/soap"
            }
        },
        "runAfter": {}
    }
}
```

The WSDL dynamically defines `operationName` and the nested operation `parameters`. Before generating an action:

1. Import the actual WSDL through the connector.
2. Select the required operation in the Designer.
3. Copy the Designer-generated input names and structure exactly.
4. Preserve the source SOAP version and verify whether the binding uses SOAP 1.1 or SOAP 1.2.

Do not invent operation parameter names from XSD element names or sample payloads.

## 3. Connection Configuration

All connections use `/serviceProviders/soap`. Supported WSDL sources shown by the connector include:

- WSDL URL: `wsdlSource` plus `wsdlUrl`
- Raw WSDL content: `wsdlSource` plus `wsdlContent`

Common values:

- `endpointUrl`
- `authType`

Supported parameter-set shapes include:

### No Authentication

```json
{
    "displayName": "SOAP",
    "parameterSetName": "None",
    "parameterValues": {
        "authType": "@appsetting('soap_authType')",
        "endpointUrl": "@appsetting('soap_endpointUrl')",
        "wsdlSource": "@appsetting('soap_wsdlSource')",
        "wsdlUrl": "@appsetting('soap_wsdlUrl')"
    },
    "serviceProvider": {
        "id": "/serviceProviders/soap"
    }
}
```

### Basic Authentication

Use `parameterSetName` value `Basic` and include parameterized `username` and `password`.

### WS-Security Username Token

Use `parameterSetName` value `WsSecurity` and include parameterized:

- `username`
- `password`
- `wsSecurityPasswordType`

Use the exact `authType`, `wsdlSource`, and `wsSecurityPasswordType` values emitted by the Designer for the selected options. Do not invent enumeration values.

## 4. Parameterization and Secrets

- Put environment-specific connection values in app settings and reference them with `@appsetting(...)`.
- Never embed usernames, passwords, endpoint credentials, or sensitive WSDL content in `workflow.json`.
- Use a WSDL URL when the runtime can securely reach a stable WSDL endpoint.
- If raw WSDL content is required, preserve the complete WSDL and all required imported schemas. Validate app-setting size and deployment behavior before choosing this mode.
- Use distinct app-setting names for multiple SOAP connections.

## 5. Migration Rules

- Preserve the source service operation, SOAP version, endpoint, authentication mode, and message semantics.
- Compare BizTalk binding settings and policies with the connector-supported connection options.
- Treat unsupported WS-\* policies, certificates, custom bindings, transport security, message encodings, or imported WSDL/XSD dependencies as explicit gaps.
- Do not manually construct `SOAPAction`, envelopes, or XML bodies when the built-in connector successfully imports the WSDL.
- Keep XML transformation and schema validation as separate built-in Logic Apps actions when they are separate steps in the source flow.
- Validate SOAP faults as failure paths and preserve source retry or exception-handling behavior.

## 6. Validation Checklist

Before declaring the migration complete:

- Import the real WSDL without unresolved imports.
- Confirm the expected operation appears in the Designer.
- Confirm the generated action uses `/serviceProviders/soap` and `invokeOperation`.
- Verify the SOAP version matches the selected WSDL binding.
- Verify the generated operation parameter names and types against the WSDL.
- Test the configured authentication mode without exposing credentials.
- Invoke the real endpoint with representative non-sensitive data.
- Validate the successful response mapping.
- Exercise a SOAP fault and verify the workflow's error handling.
- Confirm deployment supplies every referenced app setting.
