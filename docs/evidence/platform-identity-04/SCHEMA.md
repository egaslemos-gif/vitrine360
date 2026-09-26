# PLATFORM-IDENTITY-04 — SCHEMA

## Table `platform_assignments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `user_id` | text FK → users | ON DELETE CASCADE |
| `role` | text | App: `PLATFORM_SUPER_ADMIN` |
| `status` | text | Default `ACTIVE`; `ACTIVE`\|`SUSPENDED`\|`REVOKED` |
| `created_by_user_id` | text FK → users nullable | ON DELETE SET NULL |
| `created_at` | text | datetime |
| `updated_at` | text | datetime |

## Indexes

- `platform_assignments_user_role_uidx` UNIQUE (`user_id`, `role`)
- `platform_assignments_user_idx` (`user_id`)
- `platform_assignments_status_idx` (`status`)

## Explicit non-columns

- No `tenant_id` (global platform scope)
- No billing / entitlement / plan fields

## Drizzle

`src/db/schema.ts` → `platformAssignments`
