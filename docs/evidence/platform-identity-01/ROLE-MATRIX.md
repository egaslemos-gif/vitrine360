# PLATFORM-IDENTITY-01 — Role / Permission Matrix

**Date:** 2026-09-23  
**Source of truth:** `src/domain/types.ts` (`ROLE_PERMISSIONS`, `USER_ROLES`)  
**Authority for role at runtime:** `memberships.role` via `resolveActiveMembership` (`src/services/memberships.ts` + `getSession` in `src/lib/auth.ts`)

## Permission × Role (tenant-scoped)

| Permission | SUPER_ADMIN | ADMIN | EDITOR | OPERATOR | VIEWER |
|------------|:-----------:|:-----:|:------:|:--------:|:------:|
| `manage_users` | ✓ | ✓ | | | |
| `manage_devices` | ✓ | ✓ | | ✓ | |
| `manage_contents` | ✓ | ✓ | ✓ | | |
| `manage_playlists` | ✓ | ✓ | ✓ | ✓ | |
| `manage_schedules` | ✓ | ✓ | ✓ | ✓ | |
| `view_logs` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `view_dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ |

Evidence: `ROLE_PERMISSIONS` — `SUPER_ADMIN` and `ADMIN` both map to **all** `PERMISSIONS`.

## Extra rules beyond the matrix (code)

| Rule | Where | SUPER_ADMIN | ADMIN |
|------|-------|-------------|-------|
| Assign `SUPER_ADMIN` to a member | `src/services/members.ts` `changeMemberRole`; `POST /api/admin/users` | Allowed | Denied |
| See `SUPER_ADMIN` in role picker | `src/features/users/members-manager.tsx` | Yes | Only if target already SUPER_ADMIN (read-only option) |
| Last active ADMIN/SUPER_ADMIN protection | `assertNotLastAdmin` | Same as ADMIN | Same |
| Manage members (role/suspend/remove) | `assertOperatorCanManage` | ✓ | ✓ |
| Update workspace name/timezone | `PATCH /api/admin/workspace` (`manage_users`) | ✓ | ✓ |

## Platform capabilities (none today)

| Capability | Any current role |
|------------|------------------|
| List all tenants | No API / UI |
| Create tenant (admin product) | No — `createTenant` used for seed/tests only (`src/services/tenants.ts`) |
| Suspend tenant | No |
| Plans / pricing / subscriptions / billing | No schema / routes |
| Platform settings UI | No — `system_settings` table unused in `src/` |
| Platform audit stream | No |

## Nav visibility

`src/components/admin-nav.ts` filters by `hasPermission(role, item.permission)`.  
SUPER_ADMIN and ADMIN see the same nav set.
