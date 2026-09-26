# USAGE-MODEL — PI-10E

## Taxonomy (Vitrine360-relevant)

| Category | Example keys | Priority |
|----------|--------------|----------|
| RESOURCE_COUNT | `devices.count`, `contents.count`, `playlists.count` | High (devices first) |
| STORAGE | `storage.bytes` (logical asset SUM) | High |
| ACTIVE_RESOURCE | `devices.active` (status=ACTIVE) | Medium — clarify vs all non-deleted |
| OPERATIONS | `uploads.count` | Medium — needs idempotent events |
| BANDWIDTH | `bandwidth.egress_bytes` | Deferred — no meter today |
| CONCURRENT | `sessions.concurrent` | Deferred — not product-critical yet |

## Current vs Historical

| Kind | Definition | Recommended source |
|------|------------|-------------------|
| **Current Usage** | Instantaneous amount charged against HARD_LIMIT | Derived from authoritative resource tables (or reconciled projection) |
| **Historical Usage** | Time-bucketed consumption | `UsageEvent` → period aggregates |

Both coexist: current for enforcement; historical for reporting/Billing later.

## Strategies compared

| Strategy | Consistency | Perf | Concurrency | Complexity | Turso/SQLite | Serverless | Vitrine360 fit |
|----------|-------------|------|-------------|------------|--------------|------------|----------------|
| A COUNT(*) live | Strong if same TX | OK small tenants | Needs TX with write | Low | Excellent | Good | **Default for RESOURCE_COUNT/STORAGE** |
| B Materialized counter | Stale risk | Best | Needs atomic incr | Med | Good | Good | After correctness + hot path |
| C Event ledger + projection | Auditable | Write-heavy | Idempotent events | High | Good | Good | **Temporal / bandwidth / ops** |
| D Hybrid | Best overall | Tunable | TX + events | Med-High | Excellent | Excellent | **Recommended** |

## Recommendation

**Hybrid (D):**

1. Current RESOURCE_COUNT / STORAGE: derive in the same transaction as create/delete.
2. OPERATIONS / future BANDWIDTH: append-only events with idempotency keys; aggregate by period.
3. Optional `UsageCurrent` projection for read dashboards, reconciled from (1).

## Domain concepts (future — not implemented)

| Concept | Responsibility |
|---------|----------------|
| UsageMetricDefinition | Catalogue of measurable keys/units |
| UsageCurrent | Optional materialization per tenant+metric |
| UsageEvent | Immutable increment/decrement/reserve release |
| UsagePeriod | Aggregates for MONTHLY etc. |

Source of truth for resource counts remains **resource tables** until projection proves equal via reconciliation.
