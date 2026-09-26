# DEC-STORAGE-08 — Decision Record

## Decision

**CLOSED — HYBRID TTL: lazy expiry mandatory; scheduled worker optional.**

Default TTL **900s**; max **3600s**; `expiresAt` server UTC only.

## Context

Abandoned prepares hold RESERVED capacity. PI-10K added prepare `expiresAt` ≈ 900s and lazy RELEASE on next `reserveStorage`. Serverless (Vercel) cannot assume a long-lived process. DEC left “exact TTL” and “worker” open.

## Options

| ID | Model |
|----|--------|
| A | Lazy only |
| B | Scheduled worker only |
| C | Periodic reconciliation only |
| D | Hybrid (A + optional B) |

## Security impact

- No client-controlled `expiresAt`, `reservedBytes`, or status
- Worker (if any) must be authenticated and tenant-safe
- Expired rows must not commit

## Quota impact

Overdue RESERVED must not count toward active reserved after lazy/worker cleanup. Until cleanup, capacity may be temporarily sticky for that tenant — acceptable bounded by TTL.

## Operational impact

Lazy: zero new infra.  
Optional worker: Vercel Cron or external → idempotent expire/release API.

## Failure behaviour

| Case | Outcome |
|------|---------|
| Abandoned browser upload | Hold until TTL; then RELEASE; object may orphan |
| Server crash mid-upload | Same |
| Multiple instances | Lazy uses DB state; no in-memory scheduler |
| Turso / SQLite | Compare ISO UTC strings; server clock at reserve |
| Complete after expiry | DENY commit; new reserve required |

## Recommended model

**D (Hybrid)** with A required now (already partially present) and B optional later.

## Rejected alternatives

- **B alone:** cron gaps under serverless leave sticky quota  
- Client TTL: trust violation  

## Consequences

Ratifies 900s default and lazy path; documents optional cron; no worker shipped in PI-10M.
