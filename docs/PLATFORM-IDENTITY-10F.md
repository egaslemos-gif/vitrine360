# PLATFORM-IDENTITY-10F — Usage & Quota Foundation

**Status:** **VALIDATED** (usage/quota foundation). **No quantitative enforcement** in this phase.  
**Depends on:** PI-10E architecture  
**Flag:** `ENTITLEMENTS_ENABLED` remains **OFF**

## What this phase adds

| Component | Role |
|-----------|------|
| `src/domain/usage.ts` | Metrics, DTO, sources, pure `evaluateQuota` |
| `src/services/usage.ts` | Derived `count*` / `getTenantStorageUsage` / `resolveUsage` |

## What it does **not** do

- No `devices.max` / `storage.maxBytes` enforcement
- No wiring into `pairDevice`, media upload, content, experience
- No Usage API, dashboard, counters, event ledger, reservation
- Does not close OPEN decisions (device semantics, downgrade, etc.)

## Device count

**Canonical:** `PAIRED_NON_DISABLED` (closed — `PLATFORM-IDENTITY-10-QUOTA-SEMANTICS.md`).

## Evidence

`docs/evidence/platform-identity-10f/` + `docs/adr/ADR-PLATFORM-IDENTITY-010F.md`
