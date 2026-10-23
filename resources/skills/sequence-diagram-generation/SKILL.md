---
name: sequence-diagram-generation
description: Generates one business-readable Mermaid sequence diagram for every inbound receive location or equivalent entry point in an analysed flow.
---

# Sequence Diagram Generation

Generate **one separate Mermaid sequence diagram for every inbound receive location** in the flow. These diagrams are for business users, so show the message journey with clear participant names and short, plain-language messages rather than implementation-only identifiers.

## Scope and terminology

- BizTalk: a receive location is the inbound entry point. Include its adapter, receive port, receive pipeline, Message Box, subscriptions, orchestrations, maps, send ports, and external systems when the source evidence supports them.
- MuleSoft: use each inbound `Source` or listener as the equivalent receive location.
- TIBCO BusinessWorks: use each inbound `Starter` or receiver activity as the equivalent receive location.
- Use the exact source name as `receiveLocation` in the stored result. Do not merge multiple inbound entry points into one diagram.

## Evidence rules

1. Read the source artifacts and dependencies required by `analyse-source-design` before drawing.
2. Only show participants, messages, filters, branches, responses, and error paths supported by source evidence. Never invent a business system or interaction.
3. Preserve the actual processing order. Show asynchronous hand-offs with an asynchronous Mermaid arrow and make publish/subscribe or queue behavior explicit in the message label.
4. Include meaningful configuration in labels when it is known (for example adapter protocol, endpoint, pipeline, subscription filter, map, or operation). Keep labels concise and readable.
5. If a value is unresolved, label it as `Unknown` or `Not found in source` and record the uncertainty in the diagram description or analysis notes.

## Mermaid rules

- Each diagram must start with `sequenceDiagram`.
- Use `autonumber` when it improves readability.
- Declare important participants with business-friendly aliases, for example:

  ```mermaid
  sequenceDiagram
      autonumber
      participant Supplier as Supplier System
      participant Receive as Orders FILE Receive Location
      participant MessageBox as BizTalk Message Box
      participant Process as Order Processing
      participant Warehouse as Warehouse API
      Supplier->>Receive: Send order file
      Receive->>MessageBox: Decode and publish order
      MessageBox-->>Process: Subscription matches order
      Process->>Warehouse: Reserve inventory
  ```

- Use `alt`, `opt`, `loop`, `par`, and `critical` only when the corresponding branch, optional step, loop, parallel work, or error handling is evidenced in source.
- Close every block with `end`.
- Use `Note over` sparingly to explain a business rule or subscription filter.
- Do not use flowchart syntax, HTML, raw XML, or a single diagram containing several receive locations.

## Required output and storage

After the architecture flowchart has been generated, create a `sequenceDiagrams` array with exactly one entry per inbound receive location:

```json
[
  {
    "receiveLocation": "Orders_FILE_RL",
    "description": "How an order file moves from the supplier to inventory processing.",
    "mermaid": "sequenceDiagram\n    ..."
  }
]
```

Call `migration_discovery_storeSequenceDiagrams` once with the complete array. The tool validates every Mermaid document and rejects duplicate or missing receive-location names. If the flow has no inbound entry points, call it with an empty array. Do not place sequence diagrams in `migration_discovery_storeArchitecture`; that tool accepts only the overall `flowchart TB` architecture diagram.

Store discovery results in this order:

`migration_discovery_storeMeta` → `migration_discovery_storeArchitecture` → `migration_discovery_storeSequenceDiagrams` → `migration_discovery_storeComponents` → `migration_discovery_storeMessageFlow` → `migration_discovery_storeGaps` → `migration_discovery_storePatterns` → `migration_discovery_storeDependencies` → `migration_discovery_finalize`

The finalizer must always be the last call. If an existing analysis is updated, call the sequence-diagram store tool whenever a receive location or its message journey changes, then call `migration_discovery_finalize` so the visualization refreshes.
