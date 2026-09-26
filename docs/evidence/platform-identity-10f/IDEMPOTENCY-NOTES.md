# IDEMPOTENCY-NOTES — PI-10F

No IdempotencyKey table in this phase.

Future UsageEvent increments must carry unique `eventId` / `operationId` to prevent HTTP retry double-count.

Existing natural keys: media `(tenant_id, checksum)`; device pair PENDING→ACTIVE transition.
