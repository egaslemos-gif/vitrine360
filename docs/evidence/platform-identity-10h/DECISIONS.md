# DECISIONS — PI-10H

| ID | Decision | Status | Rationale |
|---|---|---|---|
| DEC-07 | Upload reservation | **CLOSED — REQUIRED** | Multi-step upload + concurrent completes make check-after-persist unsafe for HARD_LIMIT |
| DEC-STORAGE-01 | Logical vs physical bytes | **CLOSED** | Quota = DB committed (+ reserved); physical = reconciliation/GC only |
| DEC-STORAGE-02 | Reservation source of truth | **CLOSED** | Database reservation rows; never R2 |
| DEC-STORAGE-03 | Expected vs actual size | **CLOSED** | If actual > reserved → **fail-closed reject** (option A). No silent expand; no billing overage |
| DEC-STORAGE-04 | Deduplication accounting | **CLOSED** | One MediaAsset row → count once; tenant-scoped |
| DEC-STORAGE-05 | Delete accounting | **CLOSED** | Committed usage drops when DB row deleted |
| DEC-STORAGE-06 | Orphan object treatment | **CLOSED** | Orphans do not count toward quota until committed; must be GC’d separately |
| DEC-STORAGE-07 | Replacement upload | **OPEN** | No in-place replace API; provisional: reserve full `new` |
| DEC-STORAGE-08 | Reservation expiration TTL | **OPEN** | Product (suggest UTC, minutes-scale provisional later) |
| DEC-STORAGE-09 | Reconciliation authority | **CLOSED** | DB for quota; R2 for physical detection; never invent rows from R2 |
| DEC-STORAGE-10 | Downgrade overage | **CLOSED** | BLOCK NEW + ALLOW EXISTING (align DEC-08); uploads DENY; deletes ALLOW; downloads/metadata ALLOW |

## Expected bytes (detail)

Client may send `expectedBytes` at reserve/prepare. Complete must compare provider `headObject.contentLength` (already partially done). Oversized actual → reject + release reservation. Undersized → commit actual; release unused reserved capacity.

## Billing

`storage.maxBytes` is entitlement/quota, **not** payment. No Subscription dependency.
