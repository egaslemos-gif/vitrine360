# DEDUPLICATION — PI-10H

## Current behavior

- Upload/prepare/complete: lookup `(tenantId, checksum)` → reuse readable asset (no second physical put when hit).
- Manual `deduplicateMediaAssets`: groups by `checksum || name:${fileName}`; keeps newest; remaps `content_assets`; deletes dup objects/rows.
- Tenant isolation: lookups always scoped by `tenantId`. **No cross-tenant shared storage.**

## DEC-STORAGE-04 — CLOSED

**Quota counts once per committed MediaAsset row.**

If Asset1 SHA=X size=100MB exists, second upload of SHA=X:

- Reuses same row → usage stays **100MB** (not 200).
- Physical object remains one (when dedupe works).

## Concurrent duplicate uploads

Both may put objects; UNIQUE/select race → one winner row; loser blob deleted best-effort. Desired future behavior with reservation:

- Same checksum + existing committed → **no new reservation** (reuse).
- Same checksum concurrent first-time → one reservation / one commit; other resolves to existing or releases reservation.

## Gaps

- Unique index may be missing in live SQL → duplicate rows possible → double-count risk.
- Name-based manual dedupe can merge different bytes sharing a filename — **out of quota model**; quota must use checksum/row only.
