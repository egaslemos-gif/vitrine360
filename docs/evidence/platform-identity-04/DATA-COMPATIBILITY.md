# PLATFORM-IDENTITY-04 — DATA COMPATIBILITY

## Fixture after migration (no backfill)

| User | Tenant membership | Platform Identity |
|------|-------------------|-------------------|
| A | SUPER_ADMIN @ Tenant A | **NONE** |
| B | ADMIN @ Tenant A | **NONE** (until explicit test create/revoke) |
| C | SUPER_ADMIN @ Tenant B | **NONE** (until explicit test suspend path) |
| TEST PLATFORM ADMIN | ADMIN @ Tenant A + explicit `PLATFORM_SUPER_ADMIN` assignment | **EXPLICIT** |

## Existing data classes

| Existing Data | Result |
|---------------|--------|
| Users | PASS — unchanged |
| Tenants | PASS — unchanged |
| Memberships | PASS — unchanged |
| SUPER_ADMIN | PASS — remains tenant-scoped |
| Devices | PASS — unchanged |
| Device Bearer | PASS — no platform coupling |
| Seed `admin@vitrine360.local` | PASS — not promoted |

## Seed policy

`scripts/seed.ts` **not** altered to create Platform Identity. Test fixture is separate (`platform-admin-*@pi04.test`).
