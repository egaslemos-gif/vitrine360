# PLATFORM-IDENTITY-01 — Identity, Roles, Permissions & Platform/Tenant Scope Audit

**Date:** 2026-09-23  
**Status:** **PLATFORM-IDENTITY-01 — AUDIT VALIDATED**  
**Nature:** Architecture audit only. **No production code, schema, migrations, APIs, or RBAC changes.**

**Related prior docs (historical; verify against this audit):**  
`docs/WORKSPACE-RBAC-AUDIT.md` (membership model — still accurate for tenant RBAC)  
`docs/SAAS-FOUNDATION-ARCHITECTURE-AUDIT.md` (partially **stale** — claimed no `memberships`; code now has them)

**Evidence:**  
- `docs/evidence/platform-identity-01/ROLE-MATRIX.md`  
- `docs/evidence/platform-identity-01/TENANT-ISOLATION-MATRIX.md`  
- `docs/adr/ADR-PLATFORM-IDENTITY-001.md`

---

## 1. Executive Summary

Vitrine360 today is a **multi-tenant SaaS with tenant-scoped RBAC**. Authorization authority is **Membership** (`memberships.role` + `ACTIVE` status) for an **active Tenant (Workspace)**.

**Critical finding:** current `SUPER_ADMIN` is **not** a Platform Super Admin. It is a **workspace membership role** with the **same permission set as `ADMIN`**, plus the ability to **assign** the `SUPER_ADMIN` membership role inside that workspace.

There is **no** Platform Identity, Platform Role, Platform Permission, platform console, tenant catalogue for operators, plans, billing, or entitlements.

The codebase **is prepared** for a clean split later:

- **PLATFORM_SCOPE** — new domain (not yet present)  
- **TENANT_SCOPE** — existing Membership + Tenant model (solid foundation)  
- **RESOURCE_SCOPE** — tenant-owned rows + device Bearer tokens  

Do **not** grow platform power by overloading `SUPER_ADMIN` on memberships.

---

## 2. Current Architecture

```
User ──< Membership (role, status) >── Tenant  (= Workspace)
  │                                         │
  └── UserIdentity (google, …)              ├── Devices / Device Groups
                                            ├── Media / Contents
                                            ├── Playlists / Schedules
                                            ├── Activity logs
                                            └── Experience packages (in-memory, keyed by tenantId)

Session cookie v360_session (JWT)
  → getSession() revalidates User + ACTIVE Membership
  → SessionUser { id, email, name, role, tenantId, activeTenantId }
```

Evidence:

| Concept | Location |
|---------|----------|
| Schema | `src/db/schema.ts` — `tenants`, `users`, `memberships`, `userIdentities`, … |
| Roles / permissions | `src/domain/types.ts` |
| Session / auth | `src/lib/auth.ts` |
| Membership resolution | `src/services/memberships.ts` |
| Member admin | `src/services/members.ts` |
| Page gates | `src/lib/admin-access.ts` `requireAdminPage` |
| API gates | `requireSession(permission?)` on `/api/admin/**` |
| Workspace switch | `POST /api/workspaces/switch` |
| Device auth | Bearer → `authenticateDevice` (separate from admin session) |

### Answers (evidence-based)

| Question | Answer |
|----------|--------|
| Can a User belong to several Workspaces? | **Yes** — multiple `memberships` rows per `userId` (`memberships_user_tenant_uidx`). |
| Membership per Workspace? | **Yes** — `(userId, tenantId)` unique. |
| Where is role stored? | **`memberships.role`** (authority). `users.role` is a **legacy mirror** of home membership. |
| Role global or tenant-scoped? | **Tenant-scoped** via membership of the active tenant. |
| How is active Workspace determined? | JWT `activeTenantId` / `tenantId` claim → `resolveActiveMembership(userId, claimedTenant)`; must be **ACTIVE**. Switch via `/api/workspaces/switch`. |
| Does session contain tenantId? | **Yes** — both `tenantId` and `activeTenantId` (same value after resolution). |
| How does server validate tenant? | Re-load membership; reject if missing/non-ACTIVE. Services take `session.tenantId`. |
| Global role / Platform Identity / Platform Role / Platform Permission? | **None** in schema or runtime. |

### Workspace vs Tenant

**Equivalent.** UI says “Workspace”; table is `tenants`. `SessionUser.tenantId` === `activeTenantId`. No second workspaces table.

---

## 3. Current SUPER_ADMIN Meaning

`SUPER_ADMIN` ∈ `USER_ROLES` and is stored on **memberships** (and mirrored on `users.role` for home tenant).

From `ROLE_PERMISSIONS`, **SUPER_ADMIN ≡ ADMIN** for all seven permissions.

The **only** product difference found in code:

- Only an operator with membership role `SUPER_ADMIN` may **assign** `SUPER_ADMIN` to another member (`changeMemberRole`, create-user POST).

There is **no** cross-tenant visibility, platform console, or billing power attached to this role.

### Capability matrix (current SUPER_ADMIN)

| Acção | SUPER_ADMIN actual |
|-------|--------------------|
| Gerir Workspace (name/timezone of **active** tenant) | Yes (`manage_users` → workspace API) |
| Gerir membros (active tenant) | Yes |
| Gerir dispositivos | Yes |
| Gerir conteúdos / media | Yes |
| Gerir playlists | Yes |
| Gerir schedules | Yes |
| Ver outros tenants | **No** (only own memberships via switcher) |
| Criar tenant (product) | **No** |
| Suspender tenant | **No** |
| Gerir planos / preços / subscrições / billing | **No** |
| Platform settings | **No** |
| Platform audit | **No** |

---

## 4. Current Roles

| Role | Scope | Meaning today |
|------|-------|----------------|
| `SUPER_ADMIN` | Tenant membership | Workspace “super” admin — full tenant permissions + can grant SUPER_ADMIN |
| `ADMIN` | Tenant membership | Full tenant permissions; cannot grant SUPER_ADMIN |
| `EDITOR` | Tenant membership | Contents, playlists, schedules, view |
| `OPERATOR` | Tenant membership | Devices, playlists, schedules, view |
| `VIEWER` | Tenant membership | Dashboard + logs |

No `OWNER` / `MEMBER` enums exist (those names do not appear in `USER_ROLES`).

---

## 5. Current Permissions

Defined only as tenant operational permissions in `src/domain/types.ts`:

`manage_users` · `manage_devices` · `manage_contents` · `manage_playlists` · `manage_schedules` · `view_logs` · `view_dashboard`

Checked via `hasPermission(session.role, permission)` after membership-derived role.

Full matrix: `docs/evidence/platform-identity-01/ROLE-MATRIX.md`.

---

## 6. Current Session Model

Cookie: `v360_session` (httpOnly, SameSite=lax, 12h, HS256 JWT via `jose`).

### JWT claims (issued)

`sub`, `email`, `name`, `role`, `tenantId`, `activeTenantId`

### After `getSession()` (authoritative SessionUser)

| Field | Class | Notes |
|-------|-------|-------|
| `id` | AUTHORITY (identity) | Loaded from `users` by `sub` |
| `email`, `name` | CONTEXT | From DB user |
| `role` | AUTHORITY (revalidated) | From **ACTIVE membership**, not trusted JWT alone |
| `tenantId` / `activeTenantId` | AUTHORITY (revalidated) | From membership.tenantId after preferred claim check |

**Client must not be trusted for role/tenant.** Current `getSession` correctly revalidates. Risk = future shortcuts that skip `getSession` and trust JWT claims.

Device sessions are **orthogonal**: device Bearer token → device row → `device.tenantId`.

---

## 7. Tenant Isolation Audit

See `docs/evidence/platform-identity-01/TENANT-ISOLATION-MATRIX.md`.

Summary: content domains used by admin APIs consistently filter by `session.tenantId`. Automated `test-tenant-isolation` covers contents, playlists attach, devices, dual-home email.

---

## 8. Security Findings

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| SI-01 | Naming: `SUPER_ADMIN` reads as platform-wide but is tenant-scoped | High (conceptual / future abuse risk) | Documented — do not extend |
| SI-02 | SUPER_ADMIN and ADMIN identical permission arrays | Medium (privilege distinction weak) | By design today; clarify naming later |
| SI-03 | Legacy `users.role` / `users.tenantId` still written | Medium (confusion) | Session ignores for auth; keep as transitional |
| SI-04 | JWT embeds `role` (CONTEXT) — safe only while `getSession` revalidates | Medium if bypassed | Current path OK |
| SI-05 | No Platform Scope → impossible to grant SaaS ops without misusing membership | High (product gap) | Target architecture below |
| SI-06 | `activity_logs.tenantId` nullable; no platform audit channel | Low–Medium | Future split |
| SI-07 | `system_settings` global, unused, no ACL | Low | Future platform domain |
| SI-08 | `listStoredExperiencePackages()` unscoped helper | Low | Ensure never public |
| SI-09 | Auth ≠ Authz confusion | Watch | Admin pages use `requireAdminPage(permission)`; APIs use `requireSession(permission)`. Workspace switch uses `requireSession()` then membership check — OK |

**No production fixes in this phase.**

---

## 9. Platform Scope Gap

Missing for a true SaaS control plane:

- Platform identity / staff accounts  
- Platform roles & permissions  
- Tenant lifecycle APIs (create, suspend, reactivate, list)  
- Impersonation / support break-glass (optional, audited)  
- Plans, prices, subscriptions, usage, entitlements, invoices  
- Platform audit log  
- Separation of duties: platform ops without automatic membership in every tenant  

---

## 10. Recommended Target Architecture

```
Identity (User / UserIdentity)
   │
   ├── Platform Authorization          ← NEW (PLATFORM_SCOPE)
   │       PlatformRole → PlatformPermissions
   │       Acts on: tenants, plans, billing, global config, platform audit
   │       Does NOT auto-grant Membership in every tenant
   │
   └── Tenant Authorization            ← EXISTING
           Membership → TenantRole → TenantPermissions
           Acts on: devices, media, contents, playlists, schedules, members
```

**Do not** implement Platform Super Admin as `membership.role = SUPER_ADMIN` with extra permissions.

Prefer renaming clarity later (e.g. membership `WORKSPACE_OWNER` / `WORKSPACE_ADMIN`) while introducing separate `platform_roles` — **out of scope for this audit**.

### Security recommendation (Platform vs Workspace)

| Actor | Should |
|-------|--------|
| Workspace SUPER_ADMIN / ADMIN | Only TENANT_SCOPE for memberships they hold |
| Platform Super Admin | PLATFORM_SCOPE; manage tenant records without being a member of all tenants; optional time-boxed support membership with audit |
| Device | RESOURCE_SCOPE via device token + device.tenantId |

Least privilege · separation of duties · tenant isolation · auditability.

---

## 11. Platform Role Model (conceptual only)

Suggested future roles (names illustrative):

- `PLATFORM_SUPER_ADMIN` — full SaaS control plane  
- `PLATFORM_ADMIN` — tenant ops + support without billing write  
- `PLATFORM_BILLING` — plans/subscriptions/invoices  
- `PLATFORM_READONLY` — audit / observability  

Permissions examples: `platform.tenants.read|write`, `platform.billing.*`, `platform.settings.*`, `platform.audit.read`.

---

## 12. Tenant Role Model (conceptual evolution)

Keep Membership-based roles. Possible future rename for clarity:

| Today | Possible future label |
|-------|------------------------|
| SUPER_ADMIN | Workspace Owner / Workspace Super Admin |
| ADMIN | Workspace Admin |
| EDITOR / OPERATOR / VIEWER | keep or refine |

Permissions stay tenant operational (current set + future entitlements checks).

---

## 13. Future SaaS / Billing Boundary

**PLATFORM DOMAIN** (not tenant content):

`Plan` · `Price` · `Subscription` · `SubscriptionItem` · `Usage` · `Entitlement` · `Invoice` · `Payment` · `BillingCustomer`

Binding: `Subscription.tenantId → tenants.id` (workspace consumes entitlements).

Entitlement examples (not coded): `maxDevices`, `maxStorage`, `maxUsers`, `maxPlaylists`, `maxExperiences`, `liveMedia`, `advancedScheduling`, `analytics`, `customBranding`.

Enforcement later: check entitlement **after** tenant membership auth, before resource create.

---

## 14. Scopes (conceptual)

| Scope | Subject | Typical check |
|-------|---------|----------------|
| **PLATFORM_SCOPE** | Platform staff | Platform role permission |
| **TENANT_SCOPE** | Workspace member | ACTIVE membership + tenant permission |
| **RESOURCE_SCOPE** | Device / asset / experience | Tenant ownership + resource id |

Example chains:

- Platform Super Admin → PLATFORM_SCOPE → suspend tenant  
- Workspace Admin → TENANT_SCOPE → manage devices  
- Device heartbeat → RESOURCE_SCOPE (device token)  
- Experience package serve → tenantId in path/key + origin policy  

---

## 15. Active Workspace

- Multi-workspace UI: `WorkspaceSwitcher` → `POST /api/workspaces/switch` with `{ tenantId }`  
- Server verifies ACTIVE membership, rebuilds JWT via `sessionFromUser(user, tenantId)`  
- Role may **change** per workspace (membership role per tenant)  
- No URL-tenant authority; cookie is source of active workspace after switch  

---

## 16. Audit Logging

Today: single `activity_logs` stream, typically tenant-tagged (`MEMBER_*`, `WORKSPACE_*`, content/device actions).

Future:

| Stream | Examples |
|--------|----------|
| TENANT AUDIT | User removed Device Y |
| PLATFORM AUDIT | Platform Admin suspended Tenant Z |

Do not mix without a `scope` / separate table later.

---

## 17. Migration Risks (when implementing later)

1. Renaming `SUPER_ADMIN` without dual-read breaks seeds and UIs.  
2. Granting platform powers onto membership roles creates irreversible privilege confusion.  
3. Global email uniqueness vs current `(homeTenant, email)` uniqueness.  
4. Support impersonation must be explicit + audited, never silent JWT forgery.  
5. Billing tables must not live inside content services.

---

## 18. Recommended Next Steps (human-ordered; not started)

1. Product decision: rename vs keep membership `SUPER_ADMIN` when Platform roles land.  
2. PLATFORM-IDENTITY-02 (design only or thin schema): Platform staff model + ADR.  
3. Entitlements/billing domain design (still no Stripe).  
4. Do **not** auto-start RUNTIME-EXPERIENCE-11 / LIVE-MEDIA-01 / BILLING from this audit.

---

## 19. Completion Criteria

| Criterion | |
|-----------|--|
| Current model documented with code evidence | Yes |
| SUPER_ADMIN meaning clear (tenant ≠ platform) | Yes |
| Platform Scope separated conceptually | Yes |
| Tenant Scope documented | Yes |
| Tenant isolation matrix | Yes |
| Session model (AUTHORITY vs CONTEXT) | Yes |
| Role/permission matrix | Yes |
| Security findings listed | Yes |
| Target architecture documented | Yes |
| No production code changed | Yes |

### **PLATFORM-IDENTITY-01 — AUDIT VALIDATED**
