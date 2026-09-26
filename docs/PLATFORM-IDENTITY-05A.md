# PLATFORM-IDENTITY-05A — Authorization Service Architecture

**Date:** 2026-09-23  
**Status:** **ARCHITECTURE VALIDATED** (design only — **no production authz wiring in this phase**)  
**Depends on:** PI-01…PI-04 VALIDATED · ARCHITECTURE-FUTURE-01  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-005A.md`  
**Evidence:** `docs/evidence/platform-identity-05a/`

---

## Absolute rule (this phase)

**Zero** production changes to:

- JWT shape / claims  
- `getSession()` behaviour (must remain tenant-only until PI-05B ships behind flag)  
- Membership RBAC catalogue (`PERMISSIONS` / `ROLE_PERMISSIONS`)  
- Device Bearer / Experience / Playback  
- Platform UI / Billing / Entitlements  

PI-05A delivers **architecture + acceptance criteria** for PI-05B implementation.

---

## 1. Objective

Design the **Platform Authorization Service** that turns PI-04 persistence into **deny-by-default, server-revalidated** platform authority — without collapsing Platform into Tenant Membership.

```text
PI-04: storage exists, unused by authz
PI-05A: define how authz will resolve (this doc)
PI-05B: implement resolve + guards (+ minimal stubs if approved)
PI-06+: UI / Support Session / Entitlements
```

---

## 2. Current authorization audit (as-built)

| Surface | Path | Axis today | Notes |
|---------|------|------------|-------|
| Session JWT | `src/lib/auth.ts` `createSessionToken` | Context only | Claims: `sub`, `email`, `name`, `role`, `tenantId`, `activeTenantId` |
| Session resolve | `getSession()` | **Tenant only** | Revalidates user + ACTIVE membership; role from membership |
| API gate | `requireSession(permission?)` | Tenant | Uses `hasPermission(role, permission)` |
| Page gate | `requireAdminPage` / `requirePermission` | Tenant | `src/lib/admin-access.ts` |
| Tenant RBAC | `src/domain/types.ts` | Tenant | `USER_ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS` |
| Membership SoT | `src/services/memberships.ts` | Tenant | ACTIVE only authorizes |
| Platform storage | `platform_assignments` + repository | **Unused by authz** | Flag-gated; not imported by auth |
| Device Bearer | `devices.ts` | Device / Resource | Separate identity |
| Experience admit | `/api/device/experience/admit` | Device | Must never receive platform JWT |

### Gaps vs PI-02/PI-03 target

| Gap | Severity for PI-05 |
|-----|-------------------|
| No `getAuthContext` dual resolve | Required in PI-05B |
| No platform permission catalogue in code | Required (minimal) in PI-05B |
| No `requirePlatformPermission` | Required in PI-05B |
| No `/api/platform/**` | Optional stubs in PI-05B; UI in PI-06 |
| JWT lacks platform hint | **Keep absent** in PI-05 (JWT remains thin) |

### PI-04 PARTIALs relevant to PI-05B

| Partial | Design response |
|---------|-----------------|
| No SQL CHECK on role/status | Authz must use domain validators + ACTIVE filter only |
| UNIQUE blocks re-INSERT after REVOKED | Authz reads status; re-activate = status UPDATE (ops path) |
| Table may exist with flag OFF | When flag OFF: platform axis **empty / disabled** — never grant |

---

## 3. Dual-axis model (normative)

```text
                    ┌─────────────────────────────┐
 Request            │     getAuthContext()        │
 (cookie JWT)  ───► │  JWT = identity hint only   │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
     resolveTenantAuthz(userId, tenantId)    resolvePlatformAuthz(userId)
              │                                       │
     ACTIVE membership + role                ACTIVE platform_assignment(s)
              │                                       │
     tenant permissions (existing)           platform permissions (new catalogue)
              │                                       │
              └───────────────────┬───────────────────┘
                                  ▼
                         authorize(route class)
```

**Independent deny-by-default:**

| Route class | Requires |
|-------------|----------|
| Tenant admin (`/admin/**`, `/api/admin/**`) | Tenant authz only |
| Platform (`/admin/platform/**`, `/api/platform/**` — future) | Platform authz only |
| Tenant resource by id | Tenant membership on **that** tenant (+ permission) |
| Device / Experience | Device Bearer — **never** platform session |

**Forbidden equivalences:**

```text
Membership.role = SUPER_ADMIN  ⇏  platform.*
platform assignment ACTIVE     ⇏  tenant content access
PLATFORM_IDENTITY_ENABLED=true ⇏  any grant without assignment
```

---

## 4. AuthContext (target type)

Conceptual TypeScript (implement in PI-05B):

```ts
type AuthContext = {
  userId: string;
  email: string;
  name: string;
  /** Tenant axis — null only if no usable ACTIVE membership for claimed tenant */
  tenant: null | {
    tenantId: string;
    role: UserRole; // SUPER_ADMIN | ADMIN | …
    permissions: readonly Permission[];
  };
  /** Platform axis — always empty when flag OFF */
  platform: null | {
    roles: readonly PlatformRole[]; // e.g. PLATFORM_SUPER_ADMIN
    permissions: readonly PlatformPermission[];
  };
  flag: { platformIdentityEnabled: boolean };
};
```

### Resolution rules

1. Verify JWT signature + `sub` + claimed tenant (same as today).  
2. Load user from DB; abort if missing.  
3. **Tenant:** `resolveActiveMembership(userId, claimedTenant)` → role → `ROLE_PERMISSIONS`.  
4. **Platform (only if `PLATFORM_IDENTITY_ENABLED`):**  
   - `findActiveByUser(userId)`  
   - map roles → static `PLATFORM_ROLE_PERMISSIONS`  
   - SUSPENDED/REVOKED ignored  
5. Never trust JWT `role` as authority; membership/assignment DB is SoT.  
6. Never copy platform roles into JWT in PI-05.

### Compatibility with `getSession()`

| Approach (PI-05B choice) | Recommendation |
|--------------------------|----------------|
| A. Keep `getSession()` unchanged; add `getAuthContext()` alongside | **Preferred** — zero regression risk when flag OFF |
| B. Make `getSession()` call `getAuthContext` and project tenant fields | Allowed only if behaviour ≡ today when flag OFF / no platform |

**PI-05A decision:** Prefer **A**. Existing callers keep tenant-only session. Platform routes call `getAuthContext` / `requirePlatformPermission`.

---

## 5. Platform permission catalogue (PI-05 minimum)

Ship **static** catalogue. Do **not** add Billing/Entitlement permissions yet.

| Permission | Intent | PI-05B? |
|------------|--------|---------|
| `platform.tenants.read` | List/search tenants (metadata only) | **Yes** — first useful gate |
| `platform.audit.read` | Read platform audit of authz decisions (optional stub) | Optional |
| `platform.staff.manage` | Assign/revoke platform roles | Defer ops script; gate later |
| `platform.tenants.manage` / `suspend` | Mutate tenants | **Defer** to PI-06+ |
| `platform.support.session.start` | Support Session | **PI-07** |
| `platform.plans.*` / `billing.*` / `entitlements.*` | Commercial | **PI-08/09** |

### Role map (minimum role today)

| Role | Permissions (PI-05) |
|------|---------------------|
| `PLATFORM_SUPER_ADMIN` | `platform.tenants.read` (+ later staff.manage when exposed) |

Future roles (`PLATFORM_ADMIN`, `PLATFORM_SUPPORT`, …) remain defined in PI-02; **not required** to implement until needed. Catalogue must be extensible without JWT changes.

**Do not** add any `platform.*` key into tenant `PERMISSIONS` / `ROLE_PERMISSIONS`.

---

## 6. Authorization Service API (library surface)

Proposed module: `src/services/platform-authz.ts` (or `src/lib/platform-authz.ts`) — PI-05B.

| Function | Behaviour |
|----------|-----------|
| `resolvePlatformAuthz(userId)` | Flag OFF → empty; else ACTIVE assignments → permissions |
| `hasPlatformPermission(authz, perm)` | Deny-by-default |
| `requirePlatformPermission(perm)` | 401/403; uses AuthContext |
| `getAuthContext()` | Dual resolve |
| `assertNotTenantEscalation(...)` | Tests/helpers: platform grant ≠ tenant membership |

Tenant helpers remain in `auth.ts` / `admin-access.ts` unchanged.

---

## 7. Feature flag behaviour (authz)

| Flag | Tenant authz | Platform authz |
|------|--------------|----------------|
| OFF / undefined | ≡ today | Always deny / empty |
| ON | ≡ today | Only ACTIVE `platform_assignments` |

Enabling the flag **never** invents assignments. Empty table ⇒ no platform user has access.

---

## 8. JWT policy (PI-05)

| Change | Decision |
|--------|----------|
| Add `platformRole` / permissions to JWT | **Forbidden** in PI-05 |
| Add `hasPlatformAccess` hint | **Deferred** (optional later; never authoritative) |
| Keep existing claims | **Required** |

Authority = DB revalidation on every privileged request.

---

## 9. Route / API strategy

| Surface | Gate | PI-05B scope |
|---------|------|--------------|
| Existing `/admin/**`, `/api/admin/**` | Tenant only | Unchanged |
| Future `/api/platform/**` | Platform only | **Stub optional**: e.g. `GET` health or tenants list read behind flag + permission |
| Future `/admin/platform/**` | Platform only | **PI-06** UI |
| Device / `/x/**` | Device / Experience | Unchanged; must fail closed if somehow passed session |

If PI-05B includes an API stub:

- Must call `requirePlatformPermission('platform.tenants.read')`  
- Must **not** return tenant content (playlists, media bytes, experience packages)  
- Must **not** be reachable when flag OFF (404/403)

---

## 10. Security invariants (acceptance for PI-05B)

1. Tenant `SUPER_ADMIN` cannot pass `requirePlatformPermission` without ACTIVE platform assignment.  
2. ACTIVE platform assignment cannot pass tenant content IDOR without membership.  
3. JWT forged `role=PLATFORM_SUPER_ADMIN` (or tenant SUPER_ADMIN) cannot elevate without DB rows.  
4. Flag OFF ⇒ platform deny; tenant behaviour ≡ pre-PI-05.  
5. Device Bearer cannot obtain platform authz.  
6. Experience admit cannot read platform assignments.  
7. SUSPENDED/REVOKED assignments produce no platform permissions.  
8. No auto-promotion from membership → platform.

---

## 11. Implementation plan for PI-05B (preview)

| Step | Deliverable | Must not |
|------|-------------|---------|
| B1 | Domain: `PLATFORM_PERMISSIONS`, `PLATFORM_ROLE_PERMISSIONS`, helpers | Touch tenant `PERMISSIONS` |
| B2 | `resolvePlatformAuthz` + `getAuthContext` | Change JWT |
| B3 | `requirePlatformPermission` | Change `requireSession` semantics |
| B4 | Tests PI05-* / SEC-PI05-* | Promote SUPER_ADMIN |
| B5 | Optional read-only `/api/platform/tenants` stub | UI, billing, support session |
| B6 | Docs + ADR-005B + evidence | Production flag ON by default |

---

## 12. Non-goals of PI-05A / PI-05B

- Platform Admin UI (PI-06)  
- Support Session (PI-07)  
- Entitlements / Plans / Billing (PI-08/09)  
- Renaming Membership `SUPER_ADMIN`  
- Device / Experience / Playback changes  
- Automatic production enable of `PLATFORM_IDENTITY_ENABLED`

---

## 13. Verdict

**PLATFORM-IDENTITY-05A — ARCHITECTURE VALIDATED**

Ready for **PI-05B — Authorization Service Implementation** after explicit go-ahead.

Do **not** start PI-05B until this design is accepted.
