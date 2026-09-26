# DEDUPLICATION-INTEGRITY — PI-10I

## Gap confirmed (PI-10H)

`schema.ts` declared `media_assets_tenant_checksum_uidx` but SQL/ensureSchema lacked it.

## Fix

Additive `drizzle/0008_storage_reservations.sql` + `ensureSchema` create the unique index.

If historical duplicate rows exist, index creation may warn/fail — data not wiped; run `deduplicateMediaAssets` then retry.

## Reservation + dedupe (model)

Concurrent first uploads of same checksum may hold two reservations briefly; loser should RELEASE after winner commits. Full dedupe-aware reserve at prepare is deferred to PI-10J.
