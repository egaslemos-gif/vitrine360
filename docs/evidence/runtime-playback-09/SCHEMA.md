# RUNTIME-PLAYBACK-09 — Schema

Table: `device_command_inbox`

| Column | Notes |
|--------|-------|
| id | UUID PK (row) |
| command_id | UNIQUE logical id (`cmd_…`) |
| tenant_id / device_id | FKs |
| session_id | nullable |
| binding | SESSION_BOUND / DEVICE_BOUND |
| type / payload | JSON text ≤ 8KB |
| issued_at / expires_at / available_at | ms epoch (server) |
| status | QUEUED \| DELIVERED \| ACKED \| REJECTED \| EXPIRED |
| result_status / result_reason | ACK outcome |
| attempts / claimed_at / lease_until | claim/lease |
| correlation_id | optional |

Migration: `drizzle/0009_device_command_inbox.sql` (+ journal + `ensureSchema`).
