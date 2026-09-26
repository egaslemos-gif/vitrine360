# PLATFORM-IDENTITY-10H — Storage Quota Architecture / Reservation Audit

**Status:** **VALIDATED** (storage reservation architecture; remaining decisions closed in PI-10M)  
**Scope:** Architecture audit + decision closure only  
**Enforcement:** NOT implemented  
**Flag:** `ENTITLEMENTS_ENABLED` remains OFF (unchanged)

## Objective

Define the architecture required to support future `storage.maxBytes` HARD_LIMIT without changing current upload behavior.

## Prerequisites (closed)

PI-10A…G validated. Quantitative pilot is `devices.max` (PAIRED_NON_DISABLED, DEC-08). Storage usage foundation exists as `getTenantStorageUsage` = `SUM(media_assets.file_size)` (DB authority, not R2).

## Headline decisions

| ID | Decision | Status |
|---|---|---|
| DEC-07 | Upload reservation **REQUIRED** before HARD_LIMIT enforcement | **CLOSED** |
| DEC-STORAGE-01 | Quota usage = committed DB bytes; physical R2 separate | **CLOSED** |
| DEC-STORAGE-04 | Dedupe: one MediaAsset row → count once | **CLOSED** |
| DEC-STORAGE-10 | Downgrade: BLOCK NEW + ALLOW EXISTING | **CLOSED** |
| DEC-STORAGE-08 | Exact reservation TTL | **CLOSED in PI-10M** (hybrid lazy + optional worker; default 900s) |
| DEC-STORAGE-07 | In-place replacement accounting | **CLOSED in PI-10M** (delta reserve + stable MediaAsset id) |

## Non-goals (this phase)

No `storage.maxBytes` enforcement, reservation table, GC/reconciliation workers, Billing, upload behavior changes, production migrations, or flag activation.

## Evidence

`docs/evidence/platform-identity-10h/` · ADR `docs/adr/ADR-PLATFORM-IDENTITY-010H.md`

## Next

**PI-10I — Storage Quota Foundation** (reservation schema + domain types; still no enforcement until a later phase), after OPEN product params are acceptable as provisional defaults or closed.
