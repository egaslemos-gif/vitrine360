# PLATFORM-IDENTITY-03 — Current Implementation Audit

Date: 2026-09-23  
Phase: **PLAN / SECURITY GATE ONLY** — zero functional code changes  
Verified against: `src/` (not docs alone)

## 1. Modules found

| Concern | Path |
|---------|------|
| Schema | `src/db/schema.ts` — `tenants`, `users`, `memberships`, `userIdentities` |
| Roles / permissions | `src/domain/types.ts` — `USER_ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `hasPermission` |
| Session / JWT | `src/lib/auth.ts` — `createSessionToken`, `getSession`, `requireSession` |
| Membership SoT | `src/services/memberships.ts`, `src/services/members.ts` |
| Page gates | `src/lib/admin-access.ts` — `requireAdminPage` |
| Device auth | `authenticateDevice` in `src/services/devices.ts` |
| Proxy | `src/proxy.ts` — Experience origin only (**no** session auth) |
| Middleware | **Absent** — no Next middleware auth |
| Seed | `scripts/seed.ts` — demo tenant + `admin@vitrine360.local` SUPER_ADMIN membership |

## 2. Current model (exact)

```text
User
  ├── users.role          (LEGACY mirror)
  ├── users.tenantId      (LEGACY home tenant)
  └── Membership[]  ──► Tenant
        ├── role     ← AUTHORITY (tenant-scoped)
        └── status   ← must be ACTIVE for session
```

| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | all `PERMISSIONS` (+ may assign SUPER_ADMIN) |
| ADMIN | all `PERMISSIONS` |
| EDITOR | contents, playlists, schedules, dashboard, logs |
| OPERATOR | devices, playlists, schedules, dashboard, logs |
| VIEWER | dashboard, logs |

**Finding confirmed:** `SUPER_ADMIN` ≡ tenant workspace power, **not** Platform Super Admin. Permission set identical to `ADMIN` except assign-SUPER_ADMIN rule in `members.ts` / users API.

## 3. Session evaluation

1. Cookie `v360_session` JWT (HS256, 12h) claims: `sub`, `email`, `name`, `role`, `tenantId`, `activeTenantId`.  
2. `getSession()` loads User, then `resolveActiveMembership(userId, claimedTenant)`.  
3. Membership must be **ACTIVE**.  
4. **Role for authz comes from membership**, not JWT `role`.  
5. `requireSession(permission?)` → `hasPermission(session.role, permission)`.

JWT role/tenant = **CONTEXT**; membership DB = **AUTHORITY**. Aligns with PI-01/02.

## 4. Where authorization is evaluated

| Surface | Mechanism |
|---------|-----------|
| Admin pages | `requireAdminPage` / `getSession` + redirect |
| Admin APIs | `requireSession` on `/api/admin/**` |
| Workspace switch | ACTIVE membership required |
| Device APIs | Bearer → `authenticateDevice` (orthogonal) |
| Experience `/x/...` | Package serve by path — **no** admin session (by design) |

## 5. Duplication / inconsistency

| Issue | Severity |
|-------|----------|
| `users.role` / `users.tenantId` legacy mirrors | Low — ignored by `getSession` authz |
| Password login scopes by `users.tenantId` home | Medium — membership multi-tenant not fully used at login |
| `tenants.status` unused in auth | Medium — no deny if tenant deactivated |
| Settings UI hard-codes ADMIN\|SUPER_ADMIN | Low — same effective permissions today |
| `requireRole` unused | Low |
| Media GET with session: any ACTIVE member | Low/medium — broader than `manage_contents` |

## 6. Absences (confirm)

No Platform Identity tables, platform roles, entitlements, billing, Stripe, or `platform.*` permission catalogue in `src/`.

## 7. Drift vs PI-01 / PI-02 docs

| Doc claim | Code |
|-----------|------|
| Membership SoT + ACTIVE revalidation | **Match** |
| SUPER_ADMIN tenant-scoped | **Match** |
| Dual-axis platform roles | **Not implemented** (correct for target docs) |
| SaaS-FOUNDATION audit “no memberships” | **Stale** (already flagged in PI-01) |

## 8. SECURITY BLOCKERS (critical authz bypass)

**None found** of the form:

- trusting JWT `role` without membership revalidation on admin path;  
- membership SUPER_ADMIN acting as cross-tenant platform god;  
- admin write APIs taking client `tenantId` over session tenant.

### Residual risks (not blockers for planning; must fix or accept before Platform Identity go-live)

| ID | Risk |
|----|------|
| R1 | `tenants.status` not enforced |
| R2 | Dev seed credentials if applied to shared DB |
| R3 | `/x/` serve unguessability dependency |
| R4 | Login home-tenant vs membership ambiguity |

## 9. Audit verdict

**CURRENT IMPLEMENTATION AUDIT — COMPLETE**  
Safe to plan Platform Identity introduction without silent fixes in this phase.
