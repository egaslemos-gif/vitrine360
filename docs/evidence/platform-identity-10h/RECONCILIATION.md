# RECONCILIATION — PI-10H

## Purpose (future)

Compare DB committed inventory vs provider physical objects.

| Signal | Meaning |
|---|---|
| R2 > DB | Orphan objects (abandoned prepare, failed DB, delete race) |
| DB > R2 | Missing objects (stale rows; heal path exists for same checksum re-upload) |

## DEC-STORAGE-09 — CLOSED

- **Quota authority:** DB committed (+ reserved when implemented)
- **Physical correction:** reconciler may delete orphans or flag missing; must **never** invent MediaAsset rows from R2 alone
- **Safety:** tenant-scoped keys (`tenants/{tenantId}/…` on R2); never cross-tenant delete
- **Audit:** log reconciliation findings without credentials

## Not in this phase

No worker, cron, or automated delete.
