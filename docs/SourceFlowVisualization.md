# Source Flow Visualization - Design Specification

## Overview

The Source Flow Visualizer (D7) displays **ALL types** of integration flows as interactive visual diagrams - not just orchestrations, but also messaging-only patterns, pipelines, and subscription-based routing.

---

## Flow Types Supported

| Flow Type | Description | Example |
|-----------|-------------|---------|
| **Orchestration** | Process-driven workflow with shapes | BizTalk .odx, MuleSoft Flow |
| **Messaging-Only (CBR)** | Content-based routing without orchestration | Receive → Filter → Send |
| **Port-to-Port** | Direct routing with optional transform | File receive → HTTP send |
| **Pipeline Processing** | Staged message processing | Decode → Validate → Transform |
| **Pub/Sub Routing** | Subscription-based message distribution | MessageBox subscriptions |

---

## Visual Mockup 1: BizTalk Orchestration Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📊 Source Flow Visualizer                                              [🔍] [📤] [⚙] │
│─────────────────────────────────────────────────────────────────────────────────────│
│  Flow: OrderProcessing.odx                     Type: Orchestration                  │
│  Application: OrderManagement                  Shapes: 12                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│    ┌─────────────────────────────────────────────────────────────────────────┐     │
│    │                                                                         │     │
│    │                    ╔═══════════════════════╗                            │     │
│    │                    ║    🟢 Receive_Order   ║                            │     │
│    │                    ║   [FILE: OrderPort]   ║                            │     │
│    │                    ╚═══════════╤═══════════╝                            │     │
│    │                                │                                        │     │
│    │                                ▼                                        │     │
│    │                    ┌───────────────────────┐                            │     │
│    │                    │   📐 Transform_Order  │                            │     │
│    │                    │   [OrderToInternal]   │                            │     │
│    │                    └───────────┬───────────┘                            │     │
│    │                                │                                        │     │
│    │                                ▼                                        │     │
│    │                    ◇═══════════════════════◇                            │     │
│    │                   ╱   🔶 Check_Inventory   ╲                            │     │
│    │                  ╱   [InStock == true]      ╲                           │     │
│    │                 ◇═══════════════════════════◇                           │     │
│    │                ╱                              ╲                          │     │
│    │     ┌─────────┘ YES                      NO └─────────┐                 │     │
│    │     │                                                 │                 │     │
│    │     ▼                                                 ▼                 │     │
│    │ ╔═══════════════════╗                     ╔═══════════════════╗         │     │
│    │ ║  🔵 Send_Confirm  ║                     ║  🔵 Send_Backorder║         │     │
│    │ ║ [HTTP: ConfirmSvc]║                     ║  [MSMQ: BOQueue] ║         │     │
│    │ ╚═════════╤═════════╝                     ╚═════════╤═════════╝         │     │
│    │           │                                         │                   │     │
│    │           └────────────────┬────────────────────────┘                   │     │
│    │                            │                                            │     │
│    │                            ▼                                            │     │
│    │             ┌──────────────────────────────┐                            │     │
│    │             │   📋 Log_Completion          │                            │     │
│    │             │   [Expression: LogMsg]       │                            │     │
│    │             └──────────────┬───────────────┘                            │     │
│    │                            │                                            │     │
│    │                            ▼                                            │     │
│    │                    ╔═══════════════════════╗                            │     │
│    │                    ║   🔴 End_Process      ║                            │     │
│    │                    ╚═══════════════════════╝                            │     │
│    │                                                                         │     │
│    └─────────────────────────────────────────────────────────────────────────┘     │
│                                                                                     │
│  [◀ Prev] [▶ Next]                                              Zoom: [−] 100% [+] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  📋 Shape Details                                                                   │
│  ─────────────────                                                                  │
│  Selected: Check_Inventory (Decide Shape)                                           │
│  ├─ Condition: InStock == true                                                      │
│  ├─ True Branch: Send_Confirm → Log_Completion                                      │
│  ├─ False Branch: Send_Backorder → Log_Completion                                   │
│  └─ Variables Used: InStock, OrderMsg                                               │
│                                                                     [View Source]   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complex Orchestration with Parallel Actions & Error Handling

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📊 Source Flow Visualizer                                              [🔍] [📤] [⚙] │
│─────────────────────────────────────────────────────────────────────────────────────│
│  Orchestration: FulfillmentProcess.odx                         Platform: BizTalk    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│         ╔═══════════════════════╗                                                   │
│         ║   🟢 Receive_Order    ║                                                   │
│         ╚═══════════╤═══════════╝                                                   │
│                     │                                                               │
│    ┌────────────────┴─────────────────────────────────────────────┐                 │
│    │  ⚠️ SCOPE: OrderProcessingScope                              │                 │
│    │  ───────────────────────────────────────────                 │                 │
│    │                     │                                        │                 │
│    │    ═══════════════╪══════════════════                        │                 │
│    │    ║   PARALLEL ACTIONS              ║                       │                 │
│    │    ═══════════════╪══════════════════                        │                 │
│    │         ╱         │          ╲                               │                 │
│    │        ╱          │           ╲                              │                 │
│    │       ▼           ▼            ▼                             │                 │
│    │  ┌─────────┐ ┌─────────┐ ┌─────────┐                         │                 │
│    │  │ Validate│ │ Check   │ │ Reserve │                         │                 │
│    │  │ Credit  │ │Inventory│ │ Stock   │                         │                 │
│    │  └────┬────┘ └────┬────┘ └────┬────┘                         │                 │
│    │       │           │           │                              │                 │
│    │       └───────────┼───────────┘                              │                 │
│    │    ═══════════════╪══════════════════                        │                 │
│    │    ║   JOIN (All complete)           ║                       │                 │
│    │    ═══════════════╪══════════════════                        │                 │
│    │                   │                                          │                 │
│    │                   ▼                                          │                 │
│    │         ╔═══════════════════╗                                │                 │
│    │         ║  🔵 Send_Confirm  ║                                │                 │
│    │         ╚═══════════════════╝                                │                 │
│    │                                                              │                 │
│    ├──────────────────────────────────────────────────────────────┤                 │
│    │  🔴 EXCEPTION HANDLER: SystemException                       │                 │
│    │  ─────────────────────────────────────                       │                 │
│    │         ┌───────────────────┐                                │                 │
│    │         │  📧 Send_Alert    │                                │                 │
│    │         │  [SMTP: AlertSvc] │                                │                 │
│    │         └─────────┬─────────┘                                │                 │
│    │                   ▼                                          │                 │
│    │         ┌───────────────────┐                                │                 │
│    │         │ 🔄 Compensate     │ ──► Rollback: Reserve_Stock    │                 │
│    │         └───────────────────┘                                │                 │
│    └──────────────────────────────────────────────────────────────┘                 │
│                     │                                                               │
│                     ▼                                                               │
│         ╔═══════════════════════╗                                                   │
│         ║      🔴 End           ║                                                   │
│         ╚═══════════════════════╝                                                   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Shape Legend

| Icon | Shape Type | Visual Style | Description |
|------|------------|--------------|-------------|
| 🟢 | Receive Location | Green rounded rect | Message receive point |
| 🔵 | Send Port | Blue rounded rect | Message send point |
| 🔶 | Decide/Filter | Yellow diamond | Conditional branching |
| 📐 | Transform/Map | Purple parallelogram | Data transformation |
| 📋 | Expression | Gray rectangle | Variable assignment |
| ⚠️ | Scope | Dashed border box | Transaction boundary |
| 🔴 | Exception | Red border section | Error handling |
| 🔄 | Compensate | Orange rectangle | Rollback logic |
| ║═║ | Parallel | Fork/join bars | Concurrent paths |
| 📞 | Call | Double-border rect | Sub-process call |
| 🗃️ | MessageBox | Cylinder shape | Pub/sub hub |
| 🔧 | Pipeline | Stacked rects | Pipeline stages |
| 🔗 | Subscription | Funnel shape | Filter criteria |

---

## Visual Mockup 2: Messaging-Only Flow (No Orchestration)

This shows **Content-Based Routing (CBR)** - messages flow through ports without any orchestration:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📊 Source Flow Visualizer                                              [🔍] [📤] [⚙] │
│─────────────────────────────────────────────────────────────────────────────────────│
│  Flow: Order Routing (CBR)                     Type: Messaging-Only                 │
│  Application: OrderManagement                  No Orchestration                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│    ┌─────────────────────────────────────────────────────────────────────────┐     │
│    │                                                                         │     │
│    │   ╔════════════════════════════════╗                                    │     │
│    │   ║  🟢 RECEIVE LOCATION           ║                                    │     │
│    │   ║  ─────────────────────────     ║                                    │     │
│    │   ║  Name: Orders_FILE_RL          ║                                    │     │
│    │   ║  Adapter: FILE                 ║                                    │     │
│    │   ║  Path: C:\Orders\Incoming\*.xml║                                    │     │
│    │   ╚══════════════╤═════════════════╝                                    │     │
│    │                  │                                                      │     │
│    │                  ▼                                                      │     │
│    │   ┌──────────────────────────────┐                                      │     │
│    │   │  🔧 RECEIVE PIPELINE         │                                      │     │
│    │   │  XMLReceive                  │                                      │     │
│    │   │  ┌────────┬────────┬───────┐ │                                      │     │
│    │   │  │ Decode │Disassem│Validate│ │                                      │     │
│    │   │  └────────┴────────┴───────┘ │                                      │     │
│    │   └──────────────┬───────────────┘                                      │     │
│    │                  │                                                      │     │
│    │                  ▼                                                      │     │
│    │   ┌──────────────────────────────┐                                      │     │
│    │   │  📐 MAP (at Receive Port)    │                                      │     │
│    │   │  OrderExternal_to_Internal   │                                      │     │
│    │   └──────────────┬───────────────┘                                      │     │
│    │                  │                                                      │     │
│    │                  ▼                                                      │     │
│    │        ╔═════════════════════╗                                          │     │
│    │        ║   🗃️ MESSAGE BOX    ║                                          │     │
│    │        ║   (Pub/Sub Hub)     ║                                          │     │
│    │        ╚════════╤════════════╝                                          │     │
│    │                 │                                                       │     │
│    │      ┌──────────┼──────────┬──────────────┐                             │     │
│    │      │          │          │              │                             │     │
│    │      ▼          ▼          ▼              ▼                             │     │
│    │   ┌──────┐  ┌──────┐  ┌──────┐     ┌──────────┐                         │     │
│    │   │🔗Filter│  │🔗Filter│  │🔗Filter│     │🔗 Filter │                         │     │
│    │   │Region │  │Region │  │Region │     │ Default │                         │     │
│    │   │="US"  │  │="EU"  │  │="APAC"│     │ (Other) │                         │     │
│    │   └───┬───┘  └───┬───┘  └───┬───┘     └────┬────┘                         │     │
│    │       │          │          │              │                             │     │
│    │       ▼          ▼          ▼              ▼                             │     │
│    │ ╔═══════════╗╔═══════════╗╔═══════════╗╔════════════╗                    │     │
│    │ ║🔵 Send_US ║║🔵 Send_EU ║║🔵Send_APAC║║🔵 Send_DLQ ║                    │     │
│    │ ║HTTP:US-Svc║║HTTP:EU-Svc║║HTTP:AP-Svc║║FILE:Errors ║                    │     │
│    │ ╚═══════════╝╚═══════════╝╚═══════════╝╚════════════╝                    │     │
│    │                                                                         │     │
│    └─────────────────────────────────────────────────────────────────────────┘     │
│                                                                                     │
│  [◀ Prev] [▶ Next]                                              Zoom: [−] 100% [+] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  📋 Component Details                                                               │
│  ────────────────────                                                               │
│  Selected: Send_US (Send Port)                                                      │
│  ├─ Filter: BTS.MessageType == "Order" AND Region == "US"                          │
│  ├─ Adapter: HTTP                                                                   │
│  ├─ URI: https://us-orders.contoso.com/api/orders                                  │
│  ├─ Pipeline: XMLTransmit                                                           │
│  └─ Map: Internal_to_USFormat                                                       │
│                                                                     [View Binding]  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Mockup 3: Pipeline Detail View

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📊 Pipeline Visualizer                                                 [🔍] [📤] [⚙] │
│─────────────────────────────────────────────────────────────────────────────────────│
│  Pipeline: CustomOrderReceive.btp              Type: Receive Pipeline               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                          RECEIVE PIPELINE STAGES                            │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐                  │
│   │  DECODE   │───►│DISASSEMBLE│───►│ VALIDATE  │───►│ RESOLVE   │                  │
│   │           │    │           │    │           │    │  PARTY    │                  │
│   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘                  │
│         │                │                │                │                        │
│         ▼                ▼                ▼                ▼                        │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐                  │
│   │ MIME/SMIME│    │ XML       │    │ XML       │    │ (None)    │                  │
│   │ Decoder   │    │Disassembler│   │ Validator │    │           │                  │
│   │           │    │           │    │           │    │           │                  │
│   │ ⚙️ Props: │    │ ⚙️ Props: │    │ ⚙️ Props: │    │           │                  │
│   │ Signed=Y  │    │ Schema=   │    │ Schema=   │    │           │                  │
│   │           │    │ Order.xsd │    │ Order.xsd │    │           │                  │
│   └───────────┘    └───────────┘    └───────────┘    └───────────┘                  │
│                                                                                     │
│   ─────────────────────────────────────────────────────────────────────────────     │
│   Message Flow: Encrypted XML → Decrypted → Split Messages → Validated → Routed    │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Mockup 4: Application Overview (All Flows)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📊 Application Flow Overview                                           [🔍] [📤] [⚙] │
│─────────────────────────────────────────────────────────────────────────────────────│
│  Application: OrderManagement                  Total Flows: 8                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│    ┌─ ORCHESTRATIONS ─────────────────────────────────────────────────────────┐    │
│    │                                                                          │    │
│    │   ┌──────────────┐       ┌──────────────┐       ┌──────────────┐         │    │
│    │   │ 📄 Order     │──────►│ 📄 Fulfill   │──────►│ 📄 Ship      │         │    │
│    │   │ Processing   │ calls │ment Process  │ calls │ Notification │         │    │
│    │   │ (12 shapes)  │       │ (8 shapes)   │       │ (5 shapes)   │         │    │
│    │   └──────────────┘       └──────────────┘       └──────────────┘         │    │
│    │                                                                          │    │
│    └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│    ┌─ MESSAGING-ONLY (CBR) ───────────────────────────────────────────────────┐    │
│    │                                                                          │    │
│    │   ┌──────────────┐       ┌──────────────┐                                │    │
│    │   │ 🔀 Regional  │       │ 🔀 Error     │                                │    │
│    │   │ Routing      │       │ Handling     │                                │    │
│    │   │ (4 ports)    │       │ (2 ports)    │                                │    │
│    │   └──────────────┘       └──────────────┘                                │    │
│    │                                                                          │    │
│    └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│    ┌─ SHARED RESOURCES ───────────────────────────────────────────────────────┐    │
│    │                                                                          │    │
│    │   📐 Maps: 6          📋 Schemas: 12         🔧 Pipelines: 3              │    │
│    │                                                                          │    │
│    └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│                            [Click any flow to view details]                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Side-by-Side Comparison View

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  📊 Flow Comparison: Source vs Target                                               │
├─────────────────────────────────┬───────────────────────────────────────────────────┤
│  BizTalk: OrderProcessing.odx   │  Logic Apps: order-processing (workflow.json)    │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│                                 │                                                   │
│  ╔═══════════════════╗          │    ┌───────────────────┐                          │
│  ║  🟢 Receive_Order ║  ◄────►  │    │ 🟢 When_a_file_is │                          │
│  ╚═════════╤═════════╝          │    │    _added        │                          │
│            │                    │    └─────────┬─────────┘                          │
│            ▼                    │              │                                    │
│  ┌───────────────────┐          │              ▼                                    │
│  │  📐 Transform     │  ◄────►  │    ┌───────────────────┐                          │
│  │   OrderToInternal │          │    │ 📐 Transform_JSON │                          │
│  └─────────┬─────────┘          │    └─────────┬─────────┘                          │
│            │                    │              │                                    │
│            ▼                    │              ▼                                    │
│  ◇═════════════════◇            │    ┌───────────────────┐                          │
│  ╱  🔶 Decide      ╲  ◄────►    │    │ 🔶 Condition      │                          │
│  ╲  InStock==true  ╱            │    │   @equals(...)    │                          │
│  ◇═════════════════◇            │    └─────────┬─────────┘                          │
│     ╱         ╲                 │         ╱         ╲                              │
│    ▼           ▼                │        ▼           ▼                             │
│  [Send]     [Send]    ◄────►    │    [HTTP]      [Queue]                           │
│                                 │                                                   │
├─────────────────────────────────┴───────────────────────────────────────────────────┤
│  Mapping: 5/5 shapes mapped (100%)    ⚠️ 1 warning: MSMQ → Service Bus conversion   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Features Summary

### Core Visualization
- ✅ Orchestration flows (process-driven)
- ✅ Messaging-only flows (CBR, port-to-port)
- ✅ Pipeline processing stages
- ✅ MessageBox pub/sub routing
- ✅ Subscription filter visualization
- ✅ Shape-specific styling
- ✅ Message flow arrows with animation

### Interactivity
- ✅ Click component → Show properties panel
- ✅ Double-click → Open source file/binding
- ✅ Hover → Tooltip with quick info
- ✅ Zoom/pan/fit-to-screen
- ✅ Mini-map for navigation

### Export & Documentation
- ✅ Export as PNG/SVG
- ✅ Print-friendly view
- ✅ Include in assessment reports

### Multi-Flow Support
- ✅ Application-level overview
- ✅ Navigate between all flow types
- ✅ Side-by-side source/target comparison
- ✅ Show relationships between flows
