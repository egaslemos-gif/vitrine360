# RESERVATION-SCHEMA — PI-10I

Table `storage_reservations`:

| Column | Notes |
|---|---|
| id | PK |
| tenant_id | FK tenants CASCADE |
| operation_id | idempotency key |
| expected_bytes | integer ≥ 0 (TS validated) |
| status | text, default RESERVED |
| created_at / expires_at / committed_at / released_at | ISO text; expiresAt structural only |

Indexes:

- UNIQUE `(tenant_id, operation_id)`
- `(tenant_id)`
- `(tenant_id, status)`

Also: UNIQUE `media_assets (tenant_id, checksum)` via same migration.
