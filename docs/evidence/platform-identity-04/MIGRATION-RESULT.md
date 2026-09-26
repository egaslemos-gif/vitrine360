# PLATFORM-IDENTITY-04 — MIGRATION RESULT

## Applied mechanisms

1. **SQL file:** `drizzle/0006_platform_identity.sql` (CREATE TABLE IF NOT EXISTS + indexes)
2. **Runtime:** `ensureSchema()` in `src/db/client.ts` (idempotent; same DDL)

## Properties

| Property | Result |
|----------|--------|
| Additive | YES |
| Alters memberships | NO |
| Alters tenants | NO |
| Alters devices | NO |
| Alters JWT | NO |
| Backfill SUPER_ADMIN → Platform | **NO** (forbidden) |

## Rollback procedure (manual / safe)

Tooling does not auto-run destructive downs. To reverse PI-04 schema only:

```sql
DROP INDEX IF EXISTS platform_assignments_status_idx;
DROP INDEX IF EXISTS platform_assignments_user_idx;
DROP INDEX IF EXISTS platform_assignments_user_role_uidx;
DROP TABLE IF EXISTS platform_assignments;
```

After rollback:

- Memberships remain
- Tenants remain
- Users remain
- Device identity remains
- Tenant `SUPER_ADMIN` remains

Also set `PLATFORM_IDENTITY_ENABLED` unset/false and remove `ensureSchema` platform DDL on a future code rollback if reverting the release.

## Production

Do **not** auto-deploy production in PI-04. Validate on development/staging first.
