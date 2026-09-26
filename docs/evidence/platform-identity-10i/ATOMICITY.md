# ATOMICITY — PI-10I

`reserveStorage` / release / commit run inside `withTenantAllocationLock(tenantId)` → `db.transaction` (libsql write = BEGIN IMMEDIATE).

Within the same `tx`:

1. load existing operationId row (idempotency)
2. `SUM(media_assets.file_size)`
3. `SUM(storage_reservations.expected_bytes WHERE status=RESERVED)`
4. compare to conceptual `maxBytes`
5. INSERT reservation

No bare `client.execute("BEGIN")`.
