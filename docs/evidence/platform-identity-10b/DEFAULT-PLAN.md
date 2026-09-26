# DEFAULT-PLAN — PI-10B

## Statement

**DEFAULT PLAN = COMPATIBILITY PLAN**

| Field | Value |
|-------|-------|
| key | `compatibility_default` |
| name | Compatibility Default |
| commercial | **No** (not Free/Pro/Enterprise) |
| PlanEntitlements | **none** (no artificial quotas) |

## Purpose

- Technical anchor for future TenantPlan backfill / resolution
- Preserve current unrestricted behaviour until product decides caps

## Seed

`seedCompatibilityPlan()` — idempotent; also invoked from `scripts/seed.ts`.
