# ADR-PLATFORM-IDENTITY-010M — Storage Decision Closure

## Status

Accepted (VALIDATED) — architecture / decision only; no code change in this ADR’s phase.

## Context

PI-10H left DEC-STORAGE-07 (replacement accounting) and DEC-STORAGE-08 (reservation TTL) open. PI-10I–L implemented reservation, enforcement, audit, and ContentLength hardening while keeping those DECs open. PI-10M closes them without implementing replace API or TTL worker.

## Decision

### DEC-STORAGE-07 — CLOSED: Delta reservation + stable MediaAsset id

- `reserveBytes = max(0, size(B) - size(A))`
- Keep `MediaAsset.id` stable so ContentAsset/Playlist references survive
- Failures preserve A; orphans do not count quota
- Reject full-B reserve without crediting A; reject upload-without-reservation

### DEC-STORAGE-08 — CLOSED: Hybrid TTL

- Default TTL **900s** (signed URL aligned); max **3600s**; server-set `expiresAt` UTC only
- **Lazy expiry REQUIRED** for correctness (ratify PI-10K behaviour)
- **Scheduled worker OPTIONAL** (e.g. future Vercel Cron) for stranded capacity
- Expired/overdue reservations must not commit; no client-controlled expiry

## Consequences

- Future replace and TTL worker work must follow this ADR.
- No production behaviour change from PI-10M itself.
- DEC-STORAGE-07 and DEC-STORAGE-08 are no longer OPEN.
