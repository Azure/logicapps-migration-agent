---
name: msmq-built-in-connector
description: Rules for migrating BizTalk MSMQ and NetMsmq adapters to the Logic Apps Standard built-in MSMQ connector, including broker topology, workflow behavior, networking, delivery guarantees, and validation.
---

# Skill: MSMQ Built-In Connector

> **Purpose**: Preserve MSMQ integrations by using the Logic Apps Standard built-in MSMQ connector and its customer-managed MSMQ Broker.

## 1. When to Use

Read and apply this skill whenever a source flow uses BizTalk `MSMQ` or `NetMsmq`, or the target design explicitly uses Microsoft Message Queuing.

- Prefer the built-in MSMQ connector when MSMQ protocol and queue compatibility must be preserved.
- Do not automatically replace MSMQ with Azure Service Bus.
- Use Azure Service Bus only when the approved target architecture intentionally modernizes the messaging platform and accepts the resulting infrastructure and behavior changes.

## 2. Architecture

MSMQ cannot run inside the Logic Apps runtime. The built-in connector communicates with an **MSMQ Broker Windows service** on a customer-owned and customer-managed Windows VM.

The target architecture must include:

- Logic Apps Standard with VNet integration.
- A Windows 11 desktop image or Windows Server 2019 or later VM in the same VNet as the Logic App integration subnet. A connected or peered network is acceptable only when it provides equivalent routing, DNS, NSG, and firewall connectivity.
- Windows MSMQ and the Microsoft-provided MSMQ Broker installed on the VM.
- For trigger scenarios, local private source queues on the broker VM.
- Logic App to broker connectivity on TCP port `5050` by default.
- Broker to Logic App callback connectivity on HTTPS port `443`.

The broker listens on plain HTTP and currently has no authentication. It MUST remain private:

- Do not assign a public endpoint.
- Set public inbound ports to `None` during VM creation.
- Use Azure Bastion, VPN, or another private administrative path instead of exposing RDP.
- Restrict the VM firewall and NSG inbound rule to the Logic App integration subnet.
- Never place the broker host or port in a public network path.

The customer owns VM provisioning, Windows and MSMQ maintenance, broker installation and upgrades, queue creation and permissions, networking, security, availability, and monitoring.

## 3. Connector Capabilities

The connector provides:

- **When a message is available in an MSMQ queue** trigger.
- **Send message to MSMQ** action.

Use the service provider ID `/serviceProviders/msmq`.

### Send Message Action Contract

Use:

- Action type: `ServiceProvider`
- Service provider ID: `/serviceProviders/msmq`
- Operation ID: `sendMsmqMessage`

The Designer-generated action uses these parameters:

| Parameter      | Purpose                                                  |
| -------------- | -------------------------------------------------------- |
| `queueName`    | Destination queue name, path, or MSMQ `FormatName:` path |
| `messageBody`  | Message payload                                          |
| `messageLabel` | MSMQ message label                                       |

Example:

```json
{
    "Send_message_to_MSMQ_queue": {
        "type": "ServiceProvider",
        "inputs": {
            "parameters": {
                "queueName": "FormatName:DIRECT=OS:msmq-broker\\private$\\orders",
                "messageBody": "@triggerBody()",
                "messageLabel": "Order"
            },
            "serviceProviderConfiguration": {
                "connectionName": "msmq",
                "operationId": "sendMsmqMessage",
                "serviceProviderId": "/serviceProviders/msmq"
            }
        },
        "runAfter": {}
    }
}
```

Preserve the double backslashes required by JSON string escaping. The resulting MSMQ path contains single backslashes.

Do not copy literal host names, queue names, payloads, labels, or connection names from examples. Derive them from the source adapter configuration and parameterize environment-specific values.

Before generating an MSMQ trigger or `connections.json`, obtain a current Designer-generated example or connector metadata and copy the exact:

- `operationId`
- connection parameter property names
- trigger and action input property names
- `serviceProviderConfiguration` shape

Do not infer these identifiers from display names and do not invent them when a reference is unavailable.

## 4. Connection and Queue Rules

The connection requires:

| Parameter   | Required | Value                                                          |
| ----------- | -------- | -------------------------------------------------------------- |
| Server name | Yes      | Broker VM private IP address or privately resolvable host name |
| Port        | No       | Broker port; default `5050`                                    |

Parameterize these values through app settings. Do not add credentials because the broker connection does not support authentication.

Queue rules:

- The source queue MUST exist before a trigger subscribes.
- Trigger subscriptions support only local private queues on the broker VM.
- A short trigger queue name such as `orders` resolves to `.\private$\orders`.
- The send action supports local private queue names and paths, plus MSMQ `FormatName:` paths.
- One Logic App workflow can subscribe to a queue. A second subscription is rejected with HTTP `409`.
- Do not run another MSMQ consumer against a trigger-owned queue.
- Each callback contains one message and creates one workflow run. Batching is not supported.

## 5. Delivery and Processing Modes

Delivery is **at least once**. Every workflow MUST be idempotent and deduplicate by `messageId`.

### Fire and Forget

- Set `orderedProcessing` to `false`.
- The broker advances after the Logic Apps runtime returns HTTP `202`.
- Workflow runs can overlap and can complete out of order.

### Ordered Processing

- Set `orderedProcessing` to `true`.
- Add a built-in `Response` action returning HTTP `200`.
- Ensure every terminal workflow path reaches a successful `Response`.
- Keep synchronous processing below approximately 3 minutes 45 seconds. The App Service response path can close at approximately 230 seconds even though the broker waits up to 5 minutes.

Any other response status or timeout is a failed delivery. The broker retries and then applies the dead-letter policy. Ordered processing does not change the at-least-once guarantee.

The trigger supports only the `DeadLetter` failure mode. Failed messages are moved to `<source-queue>_poison`.

## 6. Send Action Rules

- Use `sendMsmqMessage`; do not substitute display text such as `Send message to MSMQ` for the operation ID.
- Populate `queueName`, `messageBody`, and `messageLabel` under `inputs.parameters`.
- `queueName` can use an MSMQ format-name path such as `FormatName:DIRECT=OS:<broker>\\private$\\<queue>`.
- Use workflow expressions for dynamic message bodies and labels rather than hard-coded sample values.

The send action's `isTransactional` value MUST match the target queue:

| Target queue      | `isTransactional` |
| ----------------- | ----------------- |
| Non-transactional | `false`           |
| Transactional     | `true`            |

A mismatch can appear successful even when the message does not arrive. Validate the queue type on the VM before generating the action and test actual delivery.

The send action's dead-letter option controls MSMQ send-side dead-letter behavior. It is separate from the trigger's `<source-queue>_poison` queue.

## 7. Planning and Deployment Requirements

When MSMQ is selected, the plan MUST include:

1. Customer-owned Windows broker VM and VNet topology, with no public inbound ports.
2. Copying `Install-MsmqEnvironmentService.ps1` to the VM and running it from an elevated PowerShell session to install MSMQ, .NET 8, the broker service, and its firewall rule.
3. Source and destination queue creation, transaction modes, and broker identity permissions.
4. NSG, VM firewall, routing, and private DNS configuration in both directions.
5. Logic App connection and workflow deployment.
6. Logic App application restart after any workflow, trigger, connection, or workflow private-key change.
7. Broker health, Windows service, poison queue, subscription, and end-to-end delivery monitoring.

Do not represent the broker as an Azure-managed service.

The installer script is versioned separately from this skill. Confirm its trusted source and supported version before copying it to the VM. If the script is not present in the checked-out repository version, obtain it from the approved connector distribution or repository commit rather than recreating it.

## 8. Validation Checklist

Before declaring the migration complete:

- Confirm `MSMQ` and `MsmqBroker` Windows services are running.
- Confirm `http://localhost:5050/api/admin/health` reports healthy on the broker VM.
- Confirm the broker listens on the configured private port.
- Confirm the source queue exists and the broker identity can peek, receive, and send.
- Confirm a pre-existing poison queue has the same transaction mode as its source queue.
- Confirm the Logic App network path reaches the broker and the broker reaches the Logic App over HTTPS.
- Restart the Logic App and confirm successful trigger subscription after configuration changes.
- Send a unique, non-sensitive test message.
- Confirm the workflow receives the expected `messageId`, label, body, and queue path.
- Confirm duplicate handling works.
- For ordered processing, confirm every path returns HTTP `200` within 3 minutes 45 seconds.
- Confirm the source queue settles the message and the poison queue remains empty.
