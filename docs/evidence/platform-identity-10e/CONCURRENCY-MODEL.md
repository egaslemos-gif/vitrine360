# CONCURRENCY-MODEL — PI-10E

## Problem

`devices.max = 10`, usage = 9, two concurrent pair requests → both must not become 11.

`SELECT COUNT → check → INSERT` is a classic **TOCTOU** race.

## Unsafe pattern

```
READ usage
CHECK quota
WRITE resource   // another writer interleaved
```

## Recommended pattern (Turso/SQLite)

**Atomic check + write in one transaction:**

1. `BEGIN IMMEDIATE` (or libSQL equivalent exclusive write)
2. Count devices for tenant with agreed filter
3. If `count + delta > max` → ROLLBACK / DENY
4. Else perform mutation
5. COMMIT

Optional later: **reservation** row (`QuotaReservation`) for multi-step flows (R2 prepare→complete) that hold capacity until commit or TTL release.

## Alternatives

| Mechanism | Fit |
|-----------|-----|
| Unique constraint alone | Insufficient for “max N” |
| Optimistic version column on UsageCurrent | Viable if counters exist |
| Application lock / Redis | Avoid — extra infra, not current stack |
| Serializable TX | Prefer IMMEDIATE write lock on SQLite |

## Idempotency

Retries must not double-count:

| Operation | Idempotency key |
|-----------|-----------------|
| Device pair | device id / activation code (single PENDING→ACTIVE transition) |
| Media upload | `(tenant_id, checksum)` unique already |
| Direct upload complete | media asset id + checksum |
| Future UsageEvent | `eventId` / `operationId` UNIQUE |

## Future APIs (not implemented)

- `assertQuota(tenantId, key, delta)` — same TX as write
- `reserveQuota(...)` — for upload prepare; `commitReservation` / `releaseReservation`

## SEC-USAGE-010

Race must not allow quantitative bypass — enforced by TX + fail-closed HARD_LIMIT.
