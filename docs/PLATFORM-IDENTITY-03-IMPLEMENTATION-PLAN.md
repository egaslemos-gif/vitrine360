# PLATFORM-IDENTITY-03 — Implementation Plan & Security Gate

**Status:** PLAN VALIDATED (architecture only — **not implemented**)  
**Date:** 2026-09-23  
**Depends on:** PLATFORM-IDENTITY-01 AUDIT · PLATFORM-IDENTITY-02 TARGET · ARCHITECTURE-FUTURE-01  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-003.md`

## Absolute rule (this phase)

**Zero** schema, migration, API, session, JWT, RBAC, UI, or seed changes in PLATFORM-IDENTITY-03.

Evidence pack:

| File |
|------|
| [CURRENT-IMPLEMENTATION-AUDIT.md](./evidence/platform-identity-03/CURRENT-IMPLEMENTATION-AUDIT.md) |
| [SECURITY-GATE.md](./evidence/platform-identity-03/SECURITY-GATE.md) |
| [MIGRATION-PLAN.md](./evidence/platform-identity-03/MIGRATION-PLAN.md) |
| [COMPATIBILITY-PLAN.md](./evidence/platform-identity-03/COMPATIBILITY-PLAN.md) |
| [IMPLEMENTATION-PHASES.md](./evidence/platform-identity-03/IMPLEMENTATION-PHASES.md) |
| [CHECKLIST.md](./evidence/platform-identity-03/CHECKLIST.md) |

---

## 1. Answers (executive)

| # | Question | Answer |
|---|----------|--------|
| 1 | Introduce Platform Identity without breaking Users? | Same `User` row; add **platform assignments** on a separate axis; never rewrite membership roles into platform roles. |
| 2 | Preserve tenant `SUPER_ADMIN`? | Keep enum + semantics; UI may later label “Workspace Owner”; never grant `platform.*`. |
| 3 | Introduce Platform scope? | New tables/services for platform roles + permissions; new `/admin/platform/**` (or host) gated on platform axis only. |
| 4 | Separate Platform Role vs Membership Role? | Dual evaluation: `resolvePlatformAuthz(userId)` ∧ `resolveTenantAuthz(userId, tenantId)` — independent deny-by-default. |
| 5 | Change JWT without bypass? | JWT stays thin context; **every** privileged request revalidates platform + membership from DB (extend `getSession` pattern). Never trust JWT role catalogues. |
| 6 | Preserve tenant isolation? | Platform ops that touch tenant data require explicit Support Session or membership; no auto-join all tenants. |
| 7 | Migrate data? | Additive schema; backfill zero platform rows; existing memberships untouched. |
| 8 | Backward compatibility? | Feature flag `PLATFORM_IDENTITY_ENABLED`; off = today’s membership-only path. |
| 9 | Entitlements later? | Separate Business plane tables; billing mutates entitlements, **not** roles (PI-02). |
| 10 | Test security before activate? | Mandatory SECURITY-GATE checklist + IDOR / cross-tenant / JWT forgery suites before flag on. |

---

## 2. Target model (recap)

```text
PLATFORM
  Platform Identity / Roles / Permissions / Operations
        │
        ▼
TENANT
  Membership / Tenant Roles / Tenant Permissions
        │
        ▼
RESOURCE
  Device · Content · Playlist · Experience · …
```

```text
Membership.role = SUPER_ADMIN  ≠  PLATFORM_SUPER_ADMIN
Permissions (RBAC)             ≠  Entitlements (commercial)
```

---

## 3. Implementation strategy (no code yet)

### 3.1 Additive schema (future phase)

Suggested (illustrative names — finalize in implementation RFC):

- `platform_memberships` or `platform_role_assignments` (`userId`, `role`, `status`, audit columns)  
- Optional `platform_permissions` override table — prefer static catalogue first  
- **Do not** add platform flags onto `memberships.role`  
- **Do not** remove `memberships` or rename `SUPER_ADMIN` in the first ship

### 3.2 Session / JWT

- Keep claims: `sub`, `email`, `name`, `tenantId`, `activeTenantId`  
- Optional later: `hasPlatformAccess: boolean` as **hint only**  
- `getSession()` / new `getAuthContext()`:
  - resolve ACTIVE tenant membership (unchanged)  
  - if flag on: resolve platform assignment from DB  
  - authorize with **intersection**: platform routes need platform permission; tenant routes need tenant permission  

### 3.3 API / UI split

| Surface | Gate |
|---------|------|
| `/admin/**` (existing) | Tenant membership + tenant permission |
| `/admin/platform/**` (future) | Platform permission only |
| `/api/admin/**` | Tenant |
| `/api/platform/**` (future) | Platform |
| Device Bearer | Unchanged — Resource/Device axis |

### 3.4 Preserve SUPER_ADMIN

| Keep | Forbid |
|------|--------|
| Assign SUPER_ADMIN only by SUPER_ADMIN in same tenant | Using SUPER_ADMIN to list all tenants |
| Full tenant `PERMISSIONS` | Mapping SUPER_ADMIN → `platform.*` |
| Existing member admin tests | Inflating ROLE_PERMISSIONS with platform keys |

---

## 4. Security gate (summary)

Full checklist: [SECURITY-GATE.md](./evidence/platform-identity-03/SECURITY-GATE.md).

**Hard fail (must pass before enable):**

1. JWT role forgery cannot elevate platform or tenant.  
2. Tenant SUPER_ADMIN cannot call platform APIs.  
3. Platform admin cannot read tenant content without Support Session / membership.  
4. Cross-tenant IDOR suites green.  
5. Device bearer cannot obtain platform or admin session powers.  
6. Feature flag off ⇒ behaviour ≡ today.  

**No critical SECURITY BLOCKER** in current code that blocks planning; residual risks R1–R4 tracked in audit (tenant status, seed, `/x/`, login home).

---

## 5. Migration & compatibility

See [MIGRATION-PLAN.md](./evidence/platform-identity-03/MIGRATION-PLAN.md) and [COMPATIBILITY-PLAN.md](./evidence/platform-identity-03/COMPATIBILITY-PLAN.md).

Headline:

1. Ship schema additive + flag **off**.  
2. Bootstrap first Platform Super Admin via **ops-controlled** seed/script (not membership SUPER_ADMIN).  
3. Enable flag in staging → run SECURITY-GATE.  
4. Production enable with rollback (flag off).  
5. Entitlements / Billing only after platform authz stable.

---

## 6. Phased delivery (future code phases)

See [IMPLEMENTATION-PHASES.md](./evidence/platform-identity-03/IMPLEMENTATION-PHASES.md).

| Phase | Intent |
|-------|--------|
| PI-04 | Schema + domain types + flag (no UI) |
| PI-05 | `getAuthContext` dual resolve + platform API stubs |
| PI-06 | Platform console minimal (tenants list read) |
| PI-07 | Support Session (time-bounded) |
| PI-08 | Entitlements model (no Stripe yet) |
| PI-09 | Plans / Subscriptions / Billing |

Each phase requires its own gate; do not collapse into one PR.

---

## 7. Non-goals of PLATFORM-IDENTITY-03

- No migrations / seeds / JWT / RBAC code changes  
- No Stripe / billing / entitlements implementation  
- No Experience / Player / Manifest / Clock changes  
- No silent security “fixes” — document only  

---

## 8. Verdict

**PLATFORM-IDENTITY-03 — PLAN VALIDATED**

Executable plan, security gate, migration and compatibility strategies are documented. Implementation remains deferred to PI-04+.
