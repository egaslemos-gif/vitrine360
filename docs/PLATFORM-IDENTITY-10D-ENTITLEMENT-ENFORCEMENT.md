# PLATFORM-IDENTITY-10D — Entitlement Enforcement (Controlled Pilot)

**Status:** **VALIDATED** (enforcement engine + Device pair pilot).  
**Depends on:** PI-10B (schema), PI-10C (resolve)  
**Next:** broader gates / Usage for `devices.max` (future)

## Principle

```
API → Authentication → RBAC → Tenant Lifecycle → enforceEntitlement → Domain
```

Do **not** scatter `if (plan)` checks across routes. One engine: `enforceEntitlement`.

## Pilot

| Key | Type | Path |
|-----|------|------|
| `devices.enabled` | BOOLEAN FEATURE_GATE | `pairDevice` (admin device association) |

**Not** implemented: `devices.max`, usage counters, Media/Content/Experience/Player gates.

## Flag

| `ENTITLEMENTS_ENABLED` | Behaviour |
|------------------------|-----------|
| OFF (default) | `ALLOW` reason `FLAG_OFF` — legacy preserved |
| ON | Fail-closed evaluation of EffectiveEntitlements |

**Activation in production requires explicit authorization.** Default remains OFF.

## Files

- `src/domain/entitlements.ts` — `evaluateFeatureGate`, contract
- `src/services/entitlements.ts` — `enforceEntitlement`, `assertDevicesEnabled`
- `src/services/devices.ts` — gate in `pairDevice`
- `src/lib/api.ts` — `ENTITLEMENT_DENIED` 403 body

Evidence: `docs/evidence/platform-identity-10d/`
