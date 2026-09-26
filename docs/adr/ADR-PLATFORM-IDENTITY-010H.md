# ADR-PLATFORM-IDENTITY-010H — Storage quota / reservation architecture

## Status

Accepted with open product parameters (PI-10H)

## Context

`devices.max` (PI-10G) proves HARD_LIMIT with derived counts inside an IMMEDIATE transaction. Media upload is multi-step (prepare → PUT → complete), non-transactional across DB and object storage, and concurrent-capable. Applying `SELECT SUM → check → INSERT` without reservation is unsafe.

## Decisions

1. **DEC-07:** Reservation is **REQUIRED** for future `storage.maxBytes` HARD_LIMIT.
2. Quota authority remains **DATABASE** committed bytes (`SUM(media_assets.file_size)`), not R2 inventory.
3. Reservation authority is **DATABASE** (future table/rows); R2 never owns quota.
4. Actual size > reserved → **fail-closed reject** (no silent expand, no billing overage).
5. Deduplication accounts **once per committed MediaAsset row** (tenant-scoped checksum).
6. Downgrade follows DEC-08: BLOCK NEW uploads + ALLOW EXISTING assets.
7. Provider abstraction (`MediaStorageProvider`) stays the storage boundary; quota domain must not call R2 SDK.

## Consequences

- PI-10I+ must introduce reservation persistence + atomic reserve before enabling `storage.maxBytes`.
- Abandoned prepares already leave physical orphans; reservation expiry + future GC are mandatory companions.
- Unique `(tenant_id, checksum)` must be verified/applied in real DBs before relying on UNIQUE race paths.
- Exact TTL and replacement-upload delta reservation: **CLOSED** in ADR-PLATFORM-IDENTITY-010M / PI-10M.
