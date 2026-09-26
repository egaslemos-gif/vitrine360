# RUNTIME-PLAYBACK-09 — Delivery Lifecycle

```
CREATED (enqueue) → QUEUED → DELIVERING/DELIVERED (claim+lease)
  → RECEIVED (device) → DISPATCHED → APPLIED|REJECTED|DUPLICATE|STALE_SESSION|EXPIRED
  → ACK → ACKED|REJECTED|EXPIRED
```

Lease expiry (within command TTL) → requeue QUEUED → redelivery (same commandId).  
Command TTL expiry → EXPIRED (never execute).  
Cleanup: lazy expire + delete terminal rows past retention (24h).
