# Vitrine360 — Workspace & RBAC Audit (Phase 2)

Date: 2026-09-21  
Status: **AUDIT COMPLETE — IMPLEMENTATION NOT STARTED**

Phase 1 context: Identity + Membership + Google Authentication is production-validated for Google login. Tenant remains the Workspace. Membership is the authorization source of truth.

This document is the mandatory Phase 2 deliverable before any workspace/RBAC administration code changes.

---

## 1. Current architecture

```
User ──< Membership >── Tenant (Workspace)
  │                         │
  │                         ├── Devices / Device Groups
  │                         ├── Contents / Media
  │                         ├── Playlists / Schedules
  │                         └── Activity logs
  │
  └── UserIdentity (google, …)
```

Session cookie `v360_session` (JWT, jose HS256, 12h) carries:

- `sub` (userId)
- `email`, `name`
- `role` (from **ACTIVE** membership of the active tenant — revalidated on every `getSession`)
- `tenantId` / `activeTenantId` (same value; both mean the active workspace)

Admin data APIs and most services filter by `session.tenantId`, which is always the membership-validated active workspace after Phase 1.

Player / device APIs (`/api/device/*`) are token-scoped and out of Phase 2 scope.

---

## 2. User model

Table `users`:

| Field | Notes |
| --- | --- |
| `id` | PK |
| `email` | Unique **per** `(tenantId, email)`, not globally |
| `name` | Display name |
| `passwordHash` | bcrypt; Google-only users get a random unusable hash |
| `role` | **LEGACY mirror** of home membership role |
| `tenantId` | **LEGACY / TRANSITIONAL** “home” tenant |
| timestamps | `createdAt`, `updatedAt` |

A User can belong to many Tenants only through `memberships`. The row still requires a home `tenantId` for schema compatibility and email uniqueness.

Password login (`authenticateUser`) still keys candidates by `users.email` and optionally `users.tenantId` + slug when the same email exists under multiple home tenants. After password check, session is built exclusively via `resolveActiveMembership`.

---

## 3. Tenant model (Workspace)

Table `tenants`:

| Field | Present | Notes |
| --- | --- | --- |
| `id` | Yes | Workspace id |
| `name` | Yes | Editable today only from `/admin/profile` rename (ADMIN / SUPER_ADMIN) |
| `slug` | Yes | Unique |
| `timezone` | Yes | Default `UTC`; **no admin UI** to edit |
| `status` | Yes | Default `ACTIVE`; not used in membership/session checks |
| `logo` | **No** | Not in schema |
| `metadata` | **No** | Not in schema |
| timestamps | Yes | |

**Do not invent logo/metadata columns** unless product requires them. Phase 2 workspace settings can start with `name` + `timezone` only.

There is **no** second `workspaces` table. Tenant **is** the workspace.

---

## 4. Membership model

Table `memberships`:

| Field | Notes |
| --- | --- |
| `id` | PK |
| `userId`, `tenantId` | UNIQUE together |
| `role` | One of `USER_ROLES` |
| `status` | `ACTIVE` \| `INVITED` \| `SUSPENDED` |
| timestamps | Yes |

Helpers (`src/services/memberships.ts`):

- `listMemberships`, `getMembership`, `resolveActiveMembership`, `createMembership`, `updateMembershipRole`, `membershipRole`

Rules already enforced:

- Only `ACTIVE` memberships authorize sessions or workspace switch.
- Preferred tenant that is not ACTIVE → no session.
- Multiple ACTIVE → oldest by `createdAt`, then `id`.

Missing for member administration:

- suspend / activate / remove membership
- invite lifecycle (token, expiry, accept)
- last-ADMIN protection
- policy for who may assign `SUPER_ADMIN`
- listing non-ACTIVE members in admin UI

---

## 5. Current RBAC

Defined in `src/domain/types.ts`:

| Permission | SUPER_ADMIN | ADMIN | EDITOR | OPERATOR | VIEWER |
| --- | --- | --- | --- | --- | --- |
| `manage_users` | ✓ | ✓ | | | |
| `manage_devices` | ✓ | ✓ | | ✓ | |
| `manage_contents` | ✓ | ✓ | ✓ | | |
| `manage_playlists` | ✓ | ✓ | ✓ | ✓ | |
| `manage_schedules` | ✓ | ✓ | ✓ | ✓ | |
| `view_logs` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `view_dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ |

**SUPER_ADMIN ≡ ADMIN** for the permission set. Difference is label only. Both are **membership-scoped** (Phase 1 decision). Neither is global cross-tenant.

Helpers:

| Helper | Exists | Behavior |
| --- | --- | --- |
| `getSession()` | Yes | JWT + ACTIVE membership reload |
| `requireSession(permission?)` | Yes | 401/403; optional `hasPermission` |
| `requireRole(roles)` | Yes | Calls `requireSession()` then role allow-list |
| `requireMembership()` | **No** | Not a separate helper; membership is inside `getSession` |
| `requirePermission()` | **No** | Use `requireSession(permission)` |
| `hasPermission(role, permission)` | Yes | Pure map lookup |

---

## 6. Current permissions vs real APIs

| Surface | Gate today | Uses `session.tenantId` / `activeTenantId` |
| --- | --- | --- |
| `GET/POST/PATCH /api/admin/users` | `requireSession("manage_users")` | Membership list for `activeTenantId` |
| Devices / groups / assign / presence | mostly `manage_devices`; **presence uses only `getSession()`** | Yes |
| Contents / media / dedupe | `manage_contents` | Yes |
| Playlists REST | `manage_playlists` | Yes |
| **Playlist server actions** (`playlists/actions.ts`) | `requireSession()` **without** permission | Yes — **RISK** |
| Schedules API | `manage_schedules` | Yes |
| Dashboard API | `view_dashboard` | Yes |
| Admin pages (devices, contents, …) | `getSession()` only (any authenticated role) | Yes |
| Users page | session + role in `{ADMIN, SUPER_ADMIN}` | Membership of active tenant |
| Logs page | session only (matches `view_logs` for all roles) | Yes |
| Settings page | session only; shows **global env**, not tenant | N/A |
| Profile rename | role check ADMIN/SUPER_ADMIN | Updates active tenant name |
| Workspace list/switch | `requireSession()` + ACTIVE membership check | Switch re-issues JWT |

---

## 7. Current sidebar behaviour

`navForRole` filters `ADMIN_NAV` with `hasPermission`.

| Nav item | Permission | SUPER_ADMIN/ADMIN | EDITOR | OPERATOR | VIEWER |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `view_dashboard` | ✓ | ✓ | ✓ | ✓ |
| Devices | `manage_devices` | ✓ | | ✓ | |
| Device Groups | `manage_devices` | ✓ | | ✓ | |
| Contents | `manage_contents` | ✓ | ✓ | | |
| Media | `manage_contents` | ✓ | ✓ | | |
| Playlists | `manage_playlists` | ✓ | ✓ | ✓ | |
| Schedules | `manage_schedules` | ✓ | ✓ | ✓ | |
| Users | `manage_users` | ✓ | | | |
| Activity | `view_logs` | ✓ | ✓ | ✓ | ✓ |
| Settings | `view_dashboard` | ✓ | ✓ | ✓ | ✓ |
| Profile | (avatar link, not in nav list) | all | all | all | all |

**Divergence from the Phase 2 brief’s example matrix:**

- Brief suggested EDITOR sees Devices — **code does not** (`manage_devices` absent for EDITOR).
- Brief suggested VIEWER sees Devices/Contents/Playlists — **sidebar hides them**; VIEWER only Dashboard, Activity, Settings (+ Profile).
- Brief suggested OPERATOR without Media/Contents — **matches** code.

Pages are still reachable by URL for any logged-in role (except Users, which redirects). That is a Phase 2 gap: **page-level permission checks**.

---

## 8. Workspace switching

**Exists and is secure at API level.**

- `GET /api/workspaces` — ACTIVE memberships only.
- `POST /api/workspaces/switch` — session → membership ACTIVE for requested `tenantId` → `sessionFromUser` → new cookie → `WORKSPACE_SWITCH` activity.
- UI: `WorkspaceSwitcher` in desktop sidebar and mobile drawer; single-workspace shows name only.

Gaps / UX:

- No role shown beside each workspace option in the select.
- No logo/avatar (no tenant logo field).
- Dashboard title does not show “Workspace: {name}” (sidebar does).
- Switcher does not toast on 403.
- After switch, client `router.refresh()` — adequate, no full redirect.

**Do not trust browser `tenantId` without membership** — already enforced.

---

## 9. Users / Members

`/admin/users` + `UsersManager` + `/api/admin/users`:

| Aspect | Current state |
| --- | --- |
| Scope | **Members of the active workspace** (membership join), not global users |
| Label | Still titled “Users” / “Utilizadores” |
| List | ACTIVE memberships only |
| Create | Creates a **new User row** + ACTIVE membership + password (not invite) |
| Role change UI | **Missing** (PATCH API exists; UI only shows Badge) |
| Suspend / remove | **Missing** |
| Invite | **Missing** |
| Who can open page | ADMIN / SUPER_ADMIN (hardcoded); API uses `manage_users` |
| Can assign SUPER_ADMIN | **Yes** — create form includes all `USER_ROLES` — **RISK** |
| Last ADMIN guard | **Missing** |
| Self role change | Not exposed in UI; PATCH would allow if caller has `manage_users` and targets self — **RISK** |

Correct SaaS framing for Phase 2: rename/reposition as **Members** of the current workspace.

---

## 10. Activity

Table `activity_logs`: `userId`, `tenantId`, `action`, `resource`, `resourceId`, `ip`, `metadata`, `createdAt`.

Already logged (selection):

- `LOGIN_PASSWORD`, `LOGIN_GOOGLE`, `LOGOUT`, `WORKSPACE_SWITCH`, `ACCOUNT_LINK`
- Resource-oriented dotted names: `user.created`, `user.role_updated`, device/content/playlist/schedule events

Phase 2 desired names (map or add; **do not** create a second log system):

| Desired | Exists? |
| --- | --- |
| `WORKSPACE_SWITCH` | Yes |
| `MEMBER_INVITED` | No |
| `MEMBER_ROLE_CHANGED` | Partial as `user.role_updated` |
| `MEMBER_SUSPENDED` / `ACTIVATED` / `REMOVED` | No |
| `WORKSPACE_UPDATED` | No (profile rename does not log) |

Logs page: last 100 for `session.tenantId`; no permission check beyond login (VIEWER can open — consistent with `view_logs`).

---

## 11. Security risks

| ID | Severity | Finding |
| --- | --- | --- |
| R1 | **High** | Playlist **server actions** call `requireSession()` without `manage_playlists` → VIEWER (or any session) can mutate playlists if they hit the action |
| R2 | Medium | Admin **pages** mostly session-only; URL bypass of sidebar hiding for view/mutate UI (API still blocks most mutations except R1) |
| R3 | Medium | Creating members can assign **SUPER_ADMIN**; no policy gate |
| R4 | Medium | No **last ADMIN** protection on role demotion / future remove |
| R5 | Low | `PATCH /api/admin/users` can change own role if caller has `manage_users` |
| R6 | Low | Presence API: authenticated but no `manage_devices` — acceptable for live dashboard polling if VIEWER should not see it; today VIEWER has no Devices nav but can call the route |
| R7 | Info | `users.tenantId` / `users.role` still written on create and sometimes mirrored — not used for API auth after Phase 1 |
| R8 | Info | Email uniqueness per home tenant complicates multi-workspace same-email identities |

No email service, invitation table, or token store found under `src/`. Invite-by-email is a **dependency**, not ready for blind implementation.

---

## 12. Legacy dependencies (`users.tenantId`)

| Location | Classification | Notes |
| --- | --- | --- |
| Schema column + unique `(tenantId, email)` | **LEGACY** / **MIGRATION REQUIRED** later | Cannot drop without redesigning email uniqueness |
| `authenticateUser` filter by home tenant + slug | **CURRENT** (compat) | Still needed for multi-home-email; session then uses membership |
| User create sets `users.tenantId = activeTenantId` | **CURRENT** transitional | Home = workspace of creation |
| `updateMembershipRole` mirrors `users.role` when home matches | **LEGACY** | Safe to keep until column removed |
| Admin services / APIs using `session.tenantId` | **CURRENT** / **SAFE** | Equals validated `activeTenantId` |
| Direct auth on `users.role` / `users.tenantId` for admin APIs | **SAFE TO REMOVE** pattern | Already removed from `getSession` path |
| Seed / backfill `:home` membership | **CURRENT** | Keep until all users have memberships |

**Do not remove `users.tenantId` in Phase 2.** Document and continue treating Membership as SoT.

---

## 13. Permission matrix (proposed — based on real APIs)

Capabilities map to existing permissions; CRUD collapses into the current coarse flags unless Phase 2 splits them (not required for MVP admin).

| Area | VIEW | CREATE/EDIT/DELETE/MANAGE | Roles with access (proposed = current unless noted) |
| --- | --- | --- | --- |
| Dashboard | `view_dashboard` | — | All roles |
| Devices | page: add page gate | `manage_devices` | ADMIN, SUPER_ADMIN, OPERATOR |
| Device Groups | same | `manage_devices` | same |
| Contents | page gate | `manage_contents` | ADMIN, SUPER_ADMIN, EDITOR |
| Media | page gate | `manage_contents` | same |
| Playlists | page gate | `manage_playlists` | ADMIN, SUPER_ADMIN, EDITOR, OPERATOR — **fix actions to match** |
| Schedules | page gate | `manage_schedules` | ADMIN, SUPER_ADMIN, EDITOR, OPERATOR |
| Members | page + API | `manage_users` | ADMIN, SUPER_ADMIN only |
| Activity | `view_logs` | — | All roles (as today) |
| Workspace settings | new | `manage_users` or new `manage_workspace` | Prefer **ADMIN / SUPER_ADMIN only**; do **not** leave on `view_dashboard` |
| Global Settings (env echo) | clarify | today open to all | Restrict to ADMIN+ or move under system |

**Recommended Phase 2 policy additions (not in code yet):**

1. Only `SUPER_ADMIN` may assign `SUPER_ADMIN` (optional: forbid entirely for workspace admins).
2. Cannot demote/remove the last ACTIVE ADMIN/SUPER_ADMIN of a tenant.
3. Cannot change own role via Members API.
4. INVITED / SUSPENDED listed for admins but cannot operate.
5. Fix playlist actions → `requireSession("manage_playlists")`.

**Do not add OWNER / MANAGER / CUSTOM_ROLE.**

---

## 14. Proposed UX

1. **Workspace Switcher** — keep; show role per option; keep ACTIVE-only.
2. **Members** — rename Users → Members; list ACTIVE (+ optional INVITED/SUSPENDED tabs); change role; suspend/activate; remove; create-with-password remains until invites exist.
3. **Invites** — **defer** full email flow; document dependency (no SMTP/Resend/etc.). Optional Phase 2.1: create INVITED membership + copyable accept link without email.
4. **Workspace Settings** — `/admin/settings/workspace` (or section under settings): name, timezone. No billing.
5. **Dashboard** — one line: active workspace name under title (no full redesign).
6. **Sidebar** — keep permission-driven nav; add Workspace Settings for ADMIN+; rename Users → Members.
7. **Profile** — already exists; keep rename or move rename into Workspace Settings and leave profile for identity.

Design constraints: preserve current visual language; desktop-first; touch-usable admin; no player/runtime work.

---

## 15. Implementation plan (after audit approval)

Ordered, smallest safe slices:

| Step | Work | Depends |
| --- | --- | --- |
| 0 | **This audit** | — |
| 1 | Harden playlist server actions + page-level `requireSession(permission)` / redirects | R1/R2 |
| 2 | Members API: list statuses, PATCH role with guards, suspend/activate/remove, last-ADMIN, no self-role, SUPER_ADMIN assign policy | Members |
| 3 | Members UI rename + role controls + status | Step 2 |
| 4 | Workspace settings page (name, timezone) + `WORKSPACE_UPDATED` log | Tenant fields |
| 5 | Dashboard workspace label; switcher role labels | UX |
| 6 | Activity event names aligned | Logging |
| 7 | Tests (matrix in §17) + typecheck + build + scoped lint | — |
| 8 | Production deploy only after software validation | Ops |

**Out of scope for this phase:** billing, Stripe, plans, metering, experience/touch runtime, media studio redesign, playlist redesign, player/SW/IDB/manifest/sync changes, email invite provider unless separately approved.

---

## 16. Migration risks

| Risk | Mitigation |
| --- | --- |
| Dropping `users.tenantId` | Not in Phase 2 |
| Soft-delete membership vs hard delete | Prefer status SUSPENDED / REMOVE membership row carefully (user may remain for other tenants) |
| INVITED without email | Avoid orphan INVITED rows without accept path; or use create+password only until invites |
| SUPER_ADMIN inflation | Policy on assign |
| Existing Google/password sessions | Preserve cookie name and TTL; no Auth.js / Better Auth |
| Turso `ensureSchema` vs drizzle journal | New tables (if any for invitations) must be added to `ensureSchema` like memberships |

---

## 17. Test plan

Mandatory before claiming Phase 2 validated:

1. User with one workspace  
2. User with two workspaces  
3. Workspace switch updates role + data scope  
4. ACTIVE membership session  
5. INVITED → no session / no switch  
6. SUSPENDED → no session / no switch  
7–11. ADMIN / EDITOR / OPERATOR / VIEWER / SUPER_ADMIN API + UI expectations  
12. Last ADMIN protection  
13–14. Cross-tenant + IDOR (devices, contents, playlists, schedules, media, members)  
15. Direct API authorization (including playlist actions)  
16. Sidebar visibility per role  
17. Workspace settings authorization  
18. Activity events for member/workspace ops  
19. Google login regression  
20. Password login regression  

Commands: `npm test`, `npm run typecheck`, `npm run build`, lint **changed** files only. Do not “fix” `player-app.tsx` lint debt.

Regression: Devices, groups, contents, media, playlists, schedules, pairing, manifest, sync, offline runtime, Google + password auth.

---

## 18. Invitation dependency (Part L)

| Question | Answer |
| --- | --- |
| Email service? | **No** |
| Invitation token table? | **No** |
| Invitation expiry? | **No** |
| Email verification? | Only Google `email_verified` on OAuth |
| Activity Log? | **Yes** — extend, don’t replace |

Recommended future flow (not implemented here):

```
Invite → token (+ expiry) → email or copy link → accept (Google or password) → Membership ACTIVE
```

Phase 2 implementation should **not** block on email; either keep password-create members or add INVITED + accept URL without SMTP if approved.

---

## 19. Audit conclusions

| Topic | Verdict |
| --- | --- |
| Membership SoT | Confirmed |
| Tenant = Workspace | Confirmed |
| Multi-tenant session | Confirmed |
| Workspace switcher | Present; polish only |
| Members UI | Present as “Users”; incomplete lifecycle |
| Central RBAC | `requireSession` + map; incomplete page/action coverage |
| Critical fix before feature work | Playlist server-action permissions |
| Workspace settings | Fields exist for name/timezone; UI incomplete |
| Invites | Blocked on missing email/token infrastructure |
| SUPER_ADMIN | Membership-scoped; permission-identical to ADMIN |

**PHASE 2 AUDIT STATUS: COMPLETE**  
**IMPLEMENTATION STATUS: NOT STARTED**

Await approval of this audit (especially §13 matrix and §15 plan) before writing `docs/WORKSPACE-RBAC-IMPLEMENTATION.md` or changing product code.
