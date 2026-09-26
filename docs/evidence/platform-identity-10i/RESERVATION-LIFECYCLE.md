# RESERVATION-LIFECYCLE — PI-10I

```
RESERVED → COMMITTED | RELEASED | EXPIRED
EXPIRED  → RELEASED
COMMITTED / RELEASED → (terminal for capacity; no return to RESERVED)
```

Idempotent: RELEASED→RELEASED, COMMITTED→COMMITTED, EXPIRED→EXPIRED.

`commitStorageReservation` does **not** insert MediaAsset — foundation only.
