# PLATFORM-IDENTITY-10C — Effective Entitlements

**Status:** **VALIDATED** (resolver). **No enforcement** in this phase.  
**Depends on:** PLATFORM-IDENTITY-10B  
**Next:** PI-10D — Entitlement Enforcement

## Summary

| Concern | Owner |
|---------|-------|
| Persist Plan / TenantPlan | PI-10B |
| **Resolve EffectiveEntitlements** | **PI-10C** |
| Enforce quotas / gates | PI-10D |

```
Tenant → ACTIVE TenantPlan → Plan → PlanEntitlement → EntitlementDefinition
                                                      → EffectiveEntitlements
```

## API (internal)

```ts
resolveEffectiveEntitlements(tenantId, now?): Promise<EntitlementResolveResult>
```

- Read-only, deterministic, server-side, tenant-scoped
- Does **not** mutate DB, assign plans, check RBAC/JWT/lifecycle, or block resources
- Does **not** fall back to `compatibility_default` when no ACTIVE TenantPlan

## Contract

See `docs/evidence/platform-identity-10c/RESOLVER-CONTRACT.md`.

Statuses: `RESOLVED` | `NO_ACTIVE_PLAN` | `PLAN_NOT_FOUND` | `INVALID_ENTITLEMENT` | `DUPLICATE_ENTITLEMENT` | `TENANT_NOT_FOUND` | `MULTIPLE_ACTIVE_PLANS`

## Feature flag

`ENTITLEMENTS_ENABLED` — resolver may be called in tests with flag OFF; production resource APIs must not wire enforcement yet. Flag ON does not enable enforcement in PI-10C.

## Explicitly not implemented

Overrides, usage, billing, cache, public Plan APIs, JWT/RBAC/Device Bearer/Player/Experience changes, resource blocking.

## Files

- `src/domain/entitlements.ts` — DTO + `assembleEffectiveEntitlements`
- `src/services/entitlements.ts` — `resolveEffectiveEntitlements`
- `scripts/test-platform-identity-10c.ts`
- Evidence: `docs/evidence/platform-identity-10c/`

**PI-10C RESOLVE — PI-10D ENFORCES.**
