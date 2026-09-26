# DEVICE-COUNT-SEMANTICS — CLOSED

## Decision

**PAIRED_NON_DISABLED** (canonical).

```
tenant_id IS NOT NULL AND status != 'DISABLED'
```

| Status | Counts? |
|--------|---------|
| ACTIVE | Yes |
| OFFLINE | Yes |
| PENDING with tenant_id | Yes (rare) |
| PENDING tenant_id NULL | **No** |
| DISABLED | **No** |

Former OPEN options A/C/D rejected. Aligns with PI-10F provisional SQL (now promoted).

Code: `DEVICE_COUNT_MODE_CANONICAL` in `src/domain/usage.ts`.
