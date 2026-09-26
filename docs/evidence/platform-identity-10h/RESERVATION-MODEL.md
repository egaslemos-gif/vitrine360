# RESERVATION-MODEL — PI-10H

## DEC-07 — REQUIRED

**Status: CLOSED — Reservation REQUIRED for `storage.maxBytes` HARD_LIMIT.**

### Why Model A (check-after-persist) is insufficient

```
max=100MB, committed=80MB
Upload A=15MB and B=15MB concurrently
Both observe 80 → both complete → 110MB
```

Multi-step prepare→PUT→complete widens the race window vs device pair.

### Model B — conceptual flow

```
reserve(expectedBytes)   -- atomic: committed+reserved+expected <= max
  → upload (PUT / put)
  → validate actualBytes
  → if actual > reserved: FAIL CLOSED (reject; release)
  → commit MediaAsset; release reservation (or convert reserved→committed)
```

Invariant:

```
committed + reserved <= max   (when flag ON and entitlement present)
```

## Conceptual reservation record (DO NOT CREATE YET)

| Field | Purpose |
|---|---|
| reservationId | Primary key |
| tenantId | Isolation |
| expectedBytes | Client/server declared size |
| committedBytes | 0 until asset commit |
| status | CREATED→RESERVED→UPLOADING→COMMITTED / RELEASED / EXPIRED |
| createdAt / expiresAt | TTL / cleanup |
| operationId | Idempotency for retry |
| checksum? | Optional link to dedupe |

## Lifecycle (conceptual)

```
CREATED → RESERVED → UPLOADING → COMMITTED
RESERVED → RELEASED (abort/fail)
RESERVED → EXPIRED → RELEASED (TTL)
```

## Atomic boundary (future)

```
BEGIN IMMEDIATE (or equivalent)
  committed = SUM(file_size)
  reserved  = SUM(active reservations)
  if committed + reserved + expected > max → DENY
  INSERT reservation
COMMIT
```

Same pattern lessons as PI-10G: COUNT/SUM and INSERT must share one write transaction.

## OPEN

Exact TTL minutes, cleanup worker cadence — product (DEC-STORAGE-08).
