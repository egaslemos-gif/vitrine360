# Vitrine360 — Workspace & RBAC Implementation (Phase 2)

Date: 2026-09-21  
Baseline audit: `docs/WORKSPACE-RBAC-AUDIT.md` (APPROVED)  
Permission matrix: **§13 of the audit — unchanged**

| Gate | Result |
| --- | --- |
| IMPLEMENTED | Yes |
| SOFTWARE VALIDATED | Yes (`npm test` incl. `test:rbac`, typecheck, build; scoped eslint of changed files) |
| PRODUCTION CONFIGURED | N/A (no new env vars) |
| PRODUCTION VALIDATED | Deploy live; operator smoke still needed for FULLY VALIDATED |

---

## 1. Executive summary

Phase 2 hardens authorization (playlist server actions and page gates), adds workspace member administration with last-ADMIN protection, and adds workspace settings (name + timezone) using existing Tenant fields. The §13 matrix and Role→Permission map in `src/domain/types.ts` were not rewritten.

## 2. Authorization hardening

- All playlist server actions now call `requireSession("manage_playlists")`.
- `requireAdminPage(permission?)` + `AccessDenied` (403 UX) on admin pages.
- `requirePermission` alias in `src/lib/admin-access.ts`.
- Presence API uses `requireSession("view_dashboard")`.
- Resource mutations continue to pass `session.tenantId` / `activeTenantId` into services that filter by tenant (IDOR covered by existing service checks + Phase 2 tests).

## 3. RBAC

Source of truth remains `ROLE_PERMISSIONS` / `hasPermission` (§13). No OWNER/MANAGER/CUSTOM_ROLE. SUPER_ADMIN stays membership-scoped and permission-identical to ADMIN, with an extra policy: only SUPER_ADMIN may assign SUPER_ADMIN.

## 4. Members

- UI: `/admin/users` retitled **Members**; `MembersManager` supports create (password), change role, suspend, activate, remove.
- API: `GET/POST/PATCH /api/admin/users` with `action: role|suspend|activate|remove`.
- Service: `src/services/members.ts` verifies operator has ACTIVE ADMIN/SUPER_ADMIN membership on the target tenant.
- Email invites: **GAP** (no email service / invitation table).

## 5. Last ADMIN protection

Cannot suspend, remove, or demote the last ACTIVE ADMIN/SUPER_ADMIN membership in a workspace. Clear `MembershipError` (409/403). Self role/suspend/remove also blocked.

## 6. Workspace settings

- `/admin/settings/workspace` + `GET/PATCH /api/admin/workspace`
- Fields: `name`, `timezone` (validated via `Intl.DateTimeFormat`)
- Permission: `manage_users` (ADMIN / SUPER_ADMIN per matrix)
- No logo/metadata columns added

## 7. Page gates

| Page | Permission |
| --- | --- |
| Dashboard | `view_dashboard` |
| Devices / Device Groups | `manage_devices` |
| Contents / Media | `manage_contents` |
| Playlists (+ editor) | `manage_playlists` |
| Schedules | `manage_schedules` |
| Members | `manage_users` |
| Activity | `view_logs` |
| Workspace settings | `manage_users` |
| Settings (system echo) | `view_dashboard` |

## 8. Navigation

- Users → **Members**
- Added **Workspace** → `/admin/settings/workspace` (`manage_users`)
- Switcher options show role; dashboard shows active workspace name + role

## 9. Activity

Logged when supported:

- `WORKSPACE_SWITCH` (existing)
- `MEMBER_ROLE_CHANGED`, `MEMBER_SUSPENDED`, `MEMBER_ACTIVATED`, `MEMBER_REMOVED`
- `WORKSPACE_UPDATED` (API + profile rename)

## 10. Security

- Session → ACTIVE membership → role → permission → tenant-scoped resource
- Viewer cannot mutate playlists via server actions
- Cross-tenant member ops denied without ADMIN membership on that tenant
- Manipulated `tenantId` on switch still requires ACTIVE membership (Phase 1)

## 11. Tests

`scripts/test-workspace-rbac.ts` (`npm run test:rbac`): matrix checks, playlist tenant isolation, members CRUD policies, last-admin, suspend session denial, remove keeps user, multi-workspace role, cross-tenant denial.

Full `npm test` + `npm run typecheck` + `npm run build`: PASS.

## 12. Regression

Acceptance (pairing, playlist, manifest, sync, offline keep): PASS. Player / SW / IDB / manifest engine / sync engine not modified. `player-app.tsx` lint debt unchanged.

## 13. Production validation

Deploy: `dpl_GzZcHWV55WdNzEZunBiq3zwHbjJb` → https://vitrine360-psi.vercel.app

Software is live. Operator should confirm:

1. Google login  
2. Password login  
3. Workspace + role on dashboard  
4. VIEWER denied gated pages / playlist mutations  
5. ADMIN Members + Workspace settings  
6. Cross-tenant denial  

Until that smoke is recorded: **SOFTWARE VALIDATED — PRODUCTION DEPLOYED — OPERATOR SMOKE PENDING**.  

## 14. Known gaps

- Email invitations / tokens  
- INVITED accept flow UI  
- Coarse permissions (no separate VIEW vs DELETE flags)  
- `users.tenantId` legacy column retained  
- System Settings still visible to all roles with `view_dashboard`

## 15. Technical debt

- Full-tree `eslint` still fails on pre-existing `player-app.tsx` `react-hooks/refs`  
- Playlist server actions throw `AuthError` to the client boundary (same pattern as before; APIs return JSON)
