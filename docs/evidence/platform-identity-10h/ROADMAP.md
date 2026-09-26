# ROADMAP — PI-10H → next

## Done (10H)

Architecture audit, usage semantics, reservation REQUIRED, consistency/failure/security docs, decision table.

## Recommended next: PI-10I — Storage Quota Foundation

Provisional (additive, flag OFF, **no enforcement**):

1. Ensure unique `(tenant_id, checksum)` exists in real schema/migrations
2. Reservation domain types + table (inactive when flag OFF)
3. Atomic reserve/release APIs (unused by upload until later)
4. Wire prepare/complete hooks behind flag in a **later** enforcement phase (not 10I if 10I is foundation-only)

## Later

- PI-10J (suggested): storage.maxBytes enforcement on prepare/complete
- GC / reconciliation workers
- Observability events (`storage.reservation.*`, etc.)
- Close DEC-STORAGE-07/08 with product

## Explicitly later / never in 10H–10I

Billing, Plan UI, storage dashboard, multipart redesign, Device quota changes, Player/Experience changes.
