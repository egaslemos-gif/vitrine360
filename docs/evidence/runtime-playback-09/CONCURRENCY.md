# RUNTIME-PLAYBACK-09 — Concurrency

- Claim: `withDeviceClaimLock(deviceId)` + drizzle transaction; status CAS `QUEUED → DELIVERED`.
- Concurrent polls: only one active claim per command (CLAIM-002 / CONC-* tests).
- ACK: idempotent terminal states.
- Lease reclaim serialized by same device lock.
