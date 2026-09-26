# ADR-PLATFORM-IDENTITY-010E — Usage & Quota Architecture

## Status

Accepted as architecture baseline. Implementation deferred to PI-10F+.

## Context

PI-10D enforces only BOOLEAN `devices.enabled`. Quantitative limits (`devices.max`, `storage.maxBytes`, temporal bandwidth) require a Usage model that survives concurrency, Turso/SQLite, R2 upload races, plan changes, and tenant suspension — without coupling to Billing.

## Decisions

1. **Quota as Entitlement** — HARD_LIMIT / SOFT_LIMIT stay on `EntitlementDefinition` + `PlanEntitlement.value`; no separate QuotaDefinition table in the first foundation.
2. **Usage ≠ Activity Log** — activity_logs remain audit; Usage has dedicated future projections/events.
3. **Hybrid measurement** — RESOURCE_COUNT and STORAGE current usage derived from authoritative resource tables; temporal metrics use events + period aggregates; materialized counters optional after correctness.
4. **Atomic enforcement** — future HARD_LIMIT must check+mutate in one transaction; reservation optional for multi-step uploads.
5. **Fail-closed** for HARD_LIMIT when usage cannot be determined safely under flag ON.
6. **Billing boundary** — Subscription may assign TenantPlan; never bypass Entitlement/Usage for payments.
7. **No implementation in PI-10E** — docs only; `ENTITLEMENTS_ENABLED` stays OFF.

## Consequences

- PI-10F can add `UsageMetricDefinition` / `UsageEvent` / evaluation helpers without redesigning Plans.
- Product must still decide device status filters and downgrade UX before shipping HARD_LIMIT.

## Alternatives considered

- Parallel Quota schema — deferred (duplication with PlanEntitlement).
- Counters-only from day one — rejected until reconciliation story exists.
- Fail-open HARD_LIMIT — rejected for security.
