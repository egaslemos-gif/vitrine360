# ADR-PLATFORM-IDENTITY-010B — Entitlements Schema & Domain

## Status

Accepted (foundation). Enforcement deferred.

## Context

PI-10A approved the conceptual model Plan → PlanEntitlement → TenantPlan → EffectiveEntitlements, separate from RBAC, lifecycle, feature flags, and billing.

## Decision

1. Persist four tables: `entitlement_definitions`, `plans`, `plan_entitlements`, `tenant_plans`.
2. Gate future use with `ENTITLEMENTS_ENABLED` (default OFF). PI-10B does not enforce.
3. Ship technical `compatibility_default` plan with zero limiting bindings.
4. Store PlanEntitlement values as TEXT; validate via domain parser (BOOLEAN / INTEGER / BYTES).
5. Enforce at most one ACTIVE TenantPlan per tenant in the service layer (SQLite lacks easy partial unique indexes).
6. Soft-deactivate (`active=false`) preferred over hard delete; reject Plan deactivate while ACTIVE TenantPlans exist.
7. No overrides, usage, JWT, RBAC, or playback changes in this phase.

## Consequences

- Tenants keep current behaviour until a later enforcement phase.
- Journal lag (0003–0006 vs `_journal.json` @ 0002) remains; runtime uses `ensureSchema` + numbered SQL `0007_entitlements.sql`.

## Alternatives considered

- Commercial Free/Pro plans now — rejected (no product decision).
- Enforcement in same PR — rejected (scope PI-10D).
