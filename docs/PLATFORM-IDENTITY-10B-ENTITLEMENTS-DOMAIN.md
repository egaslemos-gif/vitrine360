# PLATFORM-IDENTITY-10B — Entitlements Schema & Domain

**Status:** **VALIDATED** (schema + domain foundation). **No enforcement** in this phase.  
**Depends on:** PLATFORM-IDENTITY-10A (architecture audit)  
**Next:** PI-10C Effective Entitlements → PI-10D Enforcement → PI-10E Plan Management

## Summary

Additive persistence and domain for:

| Entity | Scope |
|--------|-------|
| `EntitlementDefinition` | PLATFORM |
| `Plan` | PLATFORM (no `tenant_id`) |
| `PlanEntitlement` | PLATFORM via Plan |
| `TenantPlan` | TENANT |

Feature flag: `ENTITLEMENTS_ENABLED` (server-side, fail-closed, default OFF).

## Behaviour

| Flag | Effect |
|------|--------|
| OFF | Schema/seed may exist; **no** operation blocked |
| ON | Domain available for later phases; **still no enforcement in PI-10B** |

`TenantPlan` existence alone never blocks Devices / Media / Content / Experiences.

## Default / Compatibility Plan

- Key: `compatibility_default`
- Documented as **DEFAULT PLAN = COMPATIBILITY PLAN**
- Not Free / Pro / Enterprise
- No artificial quota bindings

## Explicitly deferred

- Overrides table
- Usage meters / counters
- `getEffectiveEntitlements()` resolution
- Quota enforcement
- Billing / Stripe / price fields
- Platform Plan Management UI / permissions

## Files

- `src/db/schema.ts` — tables
- `drizzle/0007_entitlements.sql` — additive SQL
- `src/db/client.ts` — `ensureSchema`
- `src/domain/entitlements.ts` — types + value parser
- `src/lib/entitlements-flag.ts`
- `src/services/entitlements.ts`
- `scripts/test-platform-identity-10b.ts`
- Evidence: `docs/evidence/platform-identity-10b/`
