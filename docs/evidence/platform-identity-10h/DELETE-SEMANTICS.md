# DELETE-SEMANTICS — PI-10H

## Current `deleteMediaAsset`

1. Load by id + tenant
2. Block if any `content_assets` reference
3. `storage.delete(storageKey)` — failure → keep DB, throw
4. `db.delete(mediaAssets)`
5. Activity `MEDIA_DELETED`

Synchronous attempt; no retry queue; no GC.

## DEC-STORAGE-05 — CLOSED

| Event | Quota (committed) | Physical |
|---|---|---|
| DB delete succeeds | **Decreases immediately** | May already be gone |
| R2 delete fails | Unchanged (delete aborted) | Still present |
| R2 gone, DB remains | Still counted until DB delete | Missing object |
| Content deleted | Media row **unchanged** | Unchanged |

Future quota: release capacity only when **committed row** is removed (or marked deleted if soft-delete is introduced later — not present today).

## Unreferenced assets

Media with zero contents still occupies storage and **must count** toward usage until deleted.
