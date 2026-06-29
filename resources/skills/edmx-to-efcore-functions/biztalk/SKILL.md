---
name: edmx-to-efcore-functions
description: Rules for converting BizTalk Entity Framework EDMX data models and the custom .NET data-access code that uses them into Azure Functions custom code backed by EF Core. Covers EDMX parsing, DbContext/entity generation, NuGet packages, connection strings, and invocation from workflow.json.
---

# Skill: EDMX + Custom Code → Azure Functions with EF Core

> **Purpose**: Authoritative rules for migrating BizTalk `.edmx` Entity Framework models and their associated custom data-access code into a Logic Apps Standard **.NET 8 local Functions** project that uses **EF Core**. Follow exactly. Read `dotnet-local-functions-logic-apps` first — that skill owns the project layout, csproj, function.json, and invocation mechanics; this skill only adds the EF Core data layer on top of it.

---

## 1. When to Use

Use this skill when a flow's behavior depends on a database accessed through Entity Framework, indicated by any of:

- `.edmx` files in the source (Entity Framework Designer model — XML containing CSDL/SSDL/MSL).
- Custom `.cs`/`.vb` code referencing `ObjectContext`, `DbContext`, `System.Data.Entity`, `EntityConnection`, or a generated `*.Designer.cs`/`*.Context.cs`.
- Orchestrations/pipelines/maps calling into a helper assembly that performs SQL/LINQ-to-Entities queries.

**Do NOT** use this for stateless transforms with no database — those belong in a plain function (see `dotnet-local-functions-logic-apps`).

---

## 2. Mandatory Inputs

1. The `.edmx` file(s). Decompile referenced assemblies first if behavior is only in a DLL (see `dependency-and-decompilation-analysis`).
2. The custom code that consumes the model (queries, updates, business logic).
3. The connection string from `App.config`/`Web.config` (`<connectionStrings>` → `metadata=...;provider=...;data source=...`). Strip the EF `metadata=...` wrapper; keep only the inner `provider connection string`.

---

## 3. Parse the EDMX

The `.edmx` has three sections. Map them as follows:

| EDMX section                   | Meaning                          | EF Core target                              |
| ------------------------------ | -------------------------------- | ------------------------------------------- |
| **CSDL** (`<EntityType>`)      | Conceptual entities + properties | C# entity classes                           |
| **SSDL** (`<Schema>` store)    | Physical tables, types, keys     | `[Table]`, `[Column]`, column types, keys   |
| **MSL** (`<EntitySetMapping>`) | C↔S mapping                      | Reconcile names; prefer DB-First names      |
| `<Association>` / NavProperty  | Foreign keys                     | EF Core navigation props + `HasOne/HasMany` |

Extract: entity names, key(s), property names + nullable + SQL type, table name, and associations (multiplicity → 1:1 / 1:N / N:N).

---

## 4. Target Layout

Add a data layer inside the Functions project from `dotnet-local-functions-logic-apps`:

```
Functions/
  Functions.csproj
  Models/        <Entity>.cs            ← one per CSDL EntityType
  Data/          <Name>DbContext.cs     ← DbContext with DbSet<T> + Fluent config
  Services/      <Name>Repository.cs    ← query/update logic from custom code
  <Flow>Function.cs                     ← [Function] invoked by workflow.json
```

## 5. EF Core NuGet Packages — .NET 8

Add to the existing package list (use SQL Server provider unless source DB differs):

| Package                                   | Version | Why                          |
| ----------------------------------------- | ------- | ---------------------------- |
| `Microsoft.EntityFrameworkCore`           | 8.0.*   | Core ORM                     |
| `Microsoft.EntityFrameworkCore.SqlServer` | 8.0.*   | SQL Server provider          |
| `Microsoft.EntityFrameworkCore.Design`    | 8.0.*   | Migrations/scaffolding (dev) |

Keep `<TargetFramework>net8</TargetFramework>` and the `TriggerPublishOnBuild` target unchanged.

## 6. Entity + DbContext (no stubs — real columns)

```csharp
namespace <Ns>.Models;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("Customers")]
public class Customer
{
    [Key] public int CustomerId { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
```

```csharp
namespace <Ns>.Data;
using Microsoft.EntityFrameworkCore;
using <Ns>.Models;

public class SalesDbContext : DbContext
{
    public SalesDbContext(DbContextOptions<SalesDbContext> options) : base(options) { }
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasOne(o => o.Customer)
            .WithMany(c => c.Orders).HasForeignKey(o => o.CustomerId); // from <Association>
    }
}
```

## 7. Connection String

Put it in `local.settings.json` `Values` (and App settings on Azure) — never hard-code:

```json
{ "Values": { "SalesDb": "Server=...;Database=Sales;Trusted_Connection=True;TrustServerCertificate=True;" } }
```

Read via `Environment.GetEnvironmentVariable("SalesDb")`. Register `DbContext` via DI in `Program.cs` (isolated worker) or build `DbContextOptionsBuilder` per call. Translate LINQ-to-Entities/EntitySQL into EF Core LINQ — preserve every filter, join, and projection from the source custom code.

## 8. Invoke From Workflow

Expose each data operation as a `[Function]` per `dotnet-local-functions-logic-apps` §4.4/§7. Function params come via `[WorkflowActionTrigger]`; return a result model whose properties the workflow reads with `@body('ActionName')?['Prop']`. One function = one business operation; do NOT expose raw EF entities as triggers.

## 9. Validation

- `dotnet build` succeeds; DLLs publish to `lib/custom/net8/`.
- No `System.Data.Entity` / ObjectContext remain (full move to EF Core).
- Connection string only in settings.
- Every query/mutation from the original custom code preserved — no stubs (`no-stubs-code-generation`).
