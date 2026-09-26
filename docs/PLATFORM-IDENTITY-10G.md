# PLATFORM-IDENTITY-10G — Quantitative Enforcement (`devices.max`)

**Status:** VALIDATED  
**Pilot:** `devices.max` HARD_LIMIT only  
**Flag:** `ENTITLEMENTS_ENABLED` (default OFF — not activated in production)

## Objective

First server-side quantitative quota enforcement for Device Count, reusing PI-10C/D/F resolution without reopening closed decisions.

## Canonical semantics

- **Usage:** `PAIRED_NON_DISABLED` (`tenant_id` set ∧ `status != DISABLED`)
- **Downgrade:** DEC-08 `BLOCK NEW + ALLOW EXISTING`
- **Allocation boundaries:** `pairDevice`, `setDeviceStatus(DISABLED→ACTIVE)`
- **Non-allocations:** heartbeat, offline, disable, delete, sync, playback

## Enforcement flow

```
Request → Auth → RBAC → Tenant lifecycle → assertDevicesEnabled
  → withTenantAllocationLock(tenantId)
    → db.transaction (libsql BEGIN IMMEDIATE)
      → resolveEffectiveEntitlements → evaluateQuota(COUNT via tx)
      → mutation via same tx
    → COMMIT
```

## Concurrency

Per-tenant in-process mutex + drizzle `db.transaction` (libsql write = `BEGIN IMMEDIATE`). COUNT and mutation share the same transaction handle. Bare `client.execute("BEGIN")` is **not** used (does not hold the connection across drizzle queries).

## Out of scope

`storage.maxBytes`, bandwidth, Experience quotas, Billing, Player changes, persistent counters/reservations.

## Evidence

See `docs/evidence/platform-identity-10g/` and `docs/adr/ADR-PLATFORM-IDENTITY-010G.md`.

## Production

`ENTITLEMENTS_ENABLED` remains **OFF**. No production flag flip in this phase.
