# PLATFORM-IDENTITY-08 — Tenant Lifecycle Architecture & Security Gate

**Date:** 2026-09-23  
**Status:** **ARCHITECTURE VALIDATED** (documentation only — **ZERO production code / schema / API / UI changes**)  
**Depends on:** PI-04…PI-07 VALIDATED · ARCHITECTURE-FUTURE-01 · PI-02 Scope Model  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-008.md`  
**Evidence:** `docs/evidence/platform-identity-08/`  
**Implements next:** PLATFORM-IDENTITY-09 (mutations) — **not this phase**

---

## Absolute rule

PI-08 does **not** change runtime behaviour.  
It closes the long-standing residual risk **R1** (`tenants.status` unused) by defining semantics **before** any mutation API exists.

---

## 1. Current model audit (code is source of truth)

### 1.1 Identity graph (as-built)

```text
User
 ├── platform_assignments → PLATFORM_SUPER_ADMIN + status (ACTIVE|SUSPENDED|REVOKED)
 └── memberships → role (SUPER_ADMIN|…) + status (ACTIVE|INVITED|SUSPENDED)
        └── tenants → status text DEFAULT 'ACTIVE'  ⚠ NOT ENFORCED
```

### 1.2 Tenant schema (factual)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `name` | text | Editable by tenant `manage_users` via workspace PATCH |
| `slug` | text unique | Immutable in current UI/API |
| `timezone` | text | Editable by workspace PATCH |
| `status` | text default `ACTIVE` | **No CHECK enum; no transition API** |
| `created_at` / `updated_at` | text | |

### 1.3 What exists today

| Capability | Exists? | Who | Notes |
|------------|---------|-----|-------|
| Create tenant | Yes | `createTenant()` (seed/tests/google flow helpers) | Always inserts `status: "ACTIVE"` |
| Read tenant metadata (platform) | Yes | `platform.tenants.read` | Lists/exposes `status` as opaque string |
| Update name/timezone | Yes | Tenant `manage_users` | **Does not** change `status` |
| Update `tenants.status` | **No** | — | No service/API |
| Delete tenant | **No** | — | No `deleteTenant`; FK cascades would be catastrophic if raw SQL used |
| Enforce status on session | **No** | `getSession` | Only ACTIVE **membership** |
| Enforce status on Device Bearer | **No** | `devices.ts` | Only device lifecycle status |
| Enforce status on Experience admit | **No** | admission domain | Device/tenant id match; not tenant status |
| Enforce status on Manifest/Media | **No** | — | Tenant scoping only |

### 1.4 Residual risk R1 (PI-03) — restated

> `tenants.status` is stored and now **visible** in Platform Console, but changing it (or leaving it non-ACTIVE) has **no effect** on authz or runtime.

This is a **semantic landmine**: operators may believe SUSPENDED means suspended.

**PI-08 decision:** Define lifecycle semantics now; implement enforcement only in PI-09+.

---

## 2. Target lifecycle states (normative for PI-09)

Minimal set — do not invent unused states.

| State | Meaning | Operator intent |
|-------|---------|-----------------|
| **ACTIVE** | Tenant is fully operable | Normal SaaS customer workspace |
| **SUSPENDED** | Tenant is **blocked** at the control plane | Non-payment, abuse, legal hold, ops freeze |
| **PENDING** *(optional later)* | Provisioned but not yet usable | Onboarding / invite-only — **defer** unless product needs it |
| **ARCHIVED** *(optional later)* | Soft-retired; read-only metadata; no runtime | Offboarding — **defer**; use SUSPENDED first |

**Hard delete** is **not** a status. It is a separate, high-risk operation (see §7).

### 2.1 Allowed status vocabulary (future CHECK / app enum)

```text
TENANT_STATUSES = ["ACTIVE", "SUSPENDED"]   // Day-1 PI-09
```

Unknown DB values must **fail closed** in enforcement (treat as non-ACTIVE) once PI-09 ships.

---

## 3. Transitions (target)

```text
        create
          │
          ▼
       ACTIVE ◄──────────────┐
          │                  │
          │ suspend          │ reactivate
          ▼                  │
      SUSPENDED ─────────────┘
```

| Transition | From → To | Permission (future) | Actor |
|------------|-----------|---------------------|-------|
| Provision | — → ACTIVE | `platform.tenants.manage` | Platform staff / controlled ops |
| Suspend | ACTIVE → SUSPENDED | `platform.tenants.suspend` | Platform staff |
| Reactivate | SUSPENDED → ACTIVE | `platform.tenants.suspend` (or manage) | Platform staff |
| Hard delete | any → erased | **Not in PI-09**; separate ADR | Dual-control / ops |

**Forbidden:**

- Tenant Membership `SUPER_ADMIN` suspending own or other tenants via platform APIs  
- Client/UI-only “soft hide” without server enforcement  
- Mapping Membership SUSPENDED ≡ Tenant SUSPENDED (different axes)

### 3.1 Idempotency

| Call | Result |
|------|--------|
| Suspend already SUSPENDED | 200 no-op + audit `idempotent=true` |
| Reactivate already ACTIVE | 200 no-op + audit |
| Concurrent suspend/reactivate | Last writer wins on `updated_at`; both audited; enforcement reads DB on each request |

### 3.2 Concurrency

- Optimistic: `UPDATE … WHERE id=? AND status=?` expected-from  
- Or version/`updated_at` predicate  
- Never rely on JWT for tenant status

---

## 4. Effect matrix (target when enforced)

Legend: **Block** = deny new privileged ops; **Drain** = existing tokens eventually fail revalidation; **Keep** = unchanged.

| Surface | ACTIVE | SUSPENDED (target) | Today (as-built) |
|---------|--------|--------------------|------------------|
| Platform Console metadata read | Allow (`tenants.read`) | **Allow** (ops must see suspended tenants) | Allow if assignment |
| Tenant admin login / `getSession` | Allow if membership ACTIVE | **Deny** session for that tenant | Ignores tenant status |
| Workspace switch to tenant | Allow | **Deny** | Membership only |
| Tenant APIs (`/api/admin/**`) | Allow | **Deny** 403 | Membership only |
| Device claim / Bearer auth | Allow if device ACTIVE | **Deny** (fail closed) | Device status only |
| Heartbeat / sync / manifest | Allow | **Deny** | Device + tenantId scope |
| Experience admit | Allow | **Deny** | Device rules only |
| `/x/*` package serve | Allow if published | **Deny** (prefer 404) | No tenant status check |
| Media byte routes (tenant-owned) | Allow | **Deny** | Tenant scope only |
| Schedules / resolver | Operate | **No new manifests**; treat as offline | No tenant status |
| Membership rows | Intact | **Intact** (do not mass-suspend members) | N/A |
| Platform assignment of staff | Intact | Intact | N/A |
| Activity logs | Keep | Keep + require suspend/reactivate audit | Partial |
| Storage objects (R2/local) | Keep bytes | **Keep bytes**; block access paths | Access via routes |
| Billing/Entitlements | N/A | Future may *trigger* suspend | Out of scope |

### 4.1 Design rule: Membership vs Tenant lifecycle

```text
Membership.SUSPENDED  → one user blocked in one tenant
Tenant.SUSPENDED      → entire workspace blocked for all members + devices
```

Do **not** cascade-update all memberships on tenant suspend (lossy, hard to reverse). Enforce at **tenant gate**.

### 4.2 Sessions

- Existing JWT for a suspended tenant must fail on next `getSession()` / `getAuthContext()` tenant resolve once enforcement exists.  
- No need to revoke cookies globally; revalidation is the control (same pattern as membership).

### 4.3 Devices

- Prefer deny at Bearer authentication boundary when tenant is SUSPENDED.  
- Do **not** bulk-set `devices.status=DISABLED` on suspend (unless product later wants a visible device-side signal); keep reversible.

### 4.4 Experience / Playback

- Control Plane decision must not leak into Experience iframe privileges.  
- Enforcement is on admit + serving routes + device auth — not inside package JS.

---

## 5. Authorization (platform axis)

Permissions already reserved in PI-02 (not all implemented):

| Permission | PI-08 status | PI-09 intent |
|------------|--------------|--------------|
| `platform.tenants.read` | **Implemented** | List/detail including SUSPENDED |
| `platform.tenants.manage` | Not implemented | Create tenant, rename metadata (platform-side) |
| `platform.tenants.suspend` | Not implemented | ACTIVE ↔ SUSPENDED |

**SoD recommendation:**  
`suspend` ≠ `manage` when staffing allows; Day-1 may grant both to `PLATFORM_SUPER_ADMIN` only.

Tenant `SUPER_ADMIN` **never** receives these permissions via Membership.

---

## 6. Auditability (required before enabling mutations)

Every lifecycle mutation must write `activity_logs` with at least:

| Field | Example |
|-------|---------|
| `action` | `platform.tenant.suspend` / `reactivate` / `create` |
| `resource` | `tenant` |
| `resourceId` | tenant id |
| `userId` | platform operator |
| `metadata` | `{ from, to, reason?, idempotent? }` |
| `ip` | request IP |

Reads may continue as today (`platform.tenants.list` / `.read`).

---

## 7. Deletion & recovery

### 7.1 Hard delete — deferred

Schema uses `ON DELETE cascade` from `tenants` to memberships, devices, contents, etc. A raw delete is **data destruction**.

**PI-08 gate:** Hard delete is a **SECURITY BLOCKER** until:

1. Explicit ops runbook  
2. Soft-archive period  
3. Dual approval or break-glass  
4. Backup / export path  
5. Separate permission (not `suspend`)

### 7.2 Recovery from SUSPENDED

Reactivate → ACTIVE restores gates; no data rebuild required if enforcement was gate-only.

---

## 8. Compatibility with current system

| Invariant | PI-08 | PI-09 |
|-----------|-------|-------|
| Flag OFF behaviour | Unchanged | Unchanged until enforcement behind flag/permission |
| Read-only console | Unchanged | Shows real effects only after enforcement |
| JWT shape | Unchanged | Unchanged (status from DB) |
| Device Bearer model | Unchanged | Add tenant-status check |
| Experience security model | Unchanged | Add tenant-status check at admit/serve |

**Migration of existing rows:** all current tenants are effectively ACTIVE; no backfill required beyond optional normalize of non-standard status strings before CHECK constraint.

---

## 9. Security gate (must PASS before PI-09 enablement)

### 9.1 Design gate (PI-08) — this document

| ID | Check | Result |
|----|-------|--------|
| TL-01 | Current status non-enforcement documented | **PASS** |
| TL-02 | ACTIVE/SUSPENDED semantics defined | **PASS** |
| TL-03 | Effect matrix covers auth, device, experience, media | **PASS** |
| TL-04 | Membership ≠ Tenant lifecycle | **PASS** |
| TL-05 | Hard delete deferred with cascade warning | **PASS** |
| TL-06 | No mutation code in PI-08 | **PASS** |
| TL-07 | Permissions for future transitions named | **PASS** |
| TL-08 | Audit requirements specified | **PASS** |

### 9.2 Implementation gate (PI-09 preview)

| ID | Check | Fail if |
|----|-------|---------|
| TL-I1 | Suspended tenant: `getSession` for that tenant fails | Session still works |
| TL-I2 | Suspended tenant: Device Bearer denied | Sync/manifest still works |
| TL-I3 | Suspended tenant: Experience admit denied | Admit succeeds |
| TL-I4 | Platform read still lists SUSPENDED | Hidden / 404 incorrectly |
| TL-I5 | Tenant SUPER_ADMIN cannot call suspend API | 200 |
| TL-I6 | Idempotent suspend/reactivate | Duplicate errors / double side-effects |
| TL-I7 | Audit row present | Missing |
| TL-I8 | Flag/permission OFF → no mutation routes | Routes open |
| TL-I9 | No hard delete in PI-09 | Cascade wipe available via API |
| TL-I10 | JWT forgery cannot override tenant status | Status trusted from token |

### 9.3 SECURITY BLOCKER status (PI-08)

| Item | Blocker for PI-08 architecture? | Blocker for PI-09 ship? |
|------|----------------------------------|-------------------------|
| Status unused today | **No** (documented) | **Yes** until enforcement tests PASS |
| Cascade hard delete | **No** (forbidden in design) | **Yes** if API exposes delete |
| Residual seed / `/x/` | Unrelated | Track separately |

**PI-08 verdict:** No architecture blocker. Do **not** implement mutations until §9.2 passes.

---

## 10. Recommended PI-09 scope (preview only)

1. Domain: `TENANT_STATUSES`, `assertTenantOperable(tenantId)`  
2. Central gate used by `getSession` / device auth / experience admit / media  
3. APIs: `POST/PATCH` suspend & reactivate only (no delete)  
4. Optional platform create-tenant under `manage`  
5. Tests TL-I1…I10  
6. Console: show status + suspend/reactivate actions (still no content access)

---

## 11. Non-goals of PI-08 / PI-09

- Billing-driven auto-suspend (may *call* suspend later)  
- Entitlements  
- Support Session / impersonation  
- Renaming Membership SUPER_ADMIN  
- Device Runtime protocol changes beyond authz deny  
- Experience package format changes  

---

## 12. Verdict

**PLATFORM-IDENTITY-08 — ARCHITECTURE VALIDATED**

Tenant lifecycle is specified; residual **R1** is acknowledged and scheduled for enforcement in **PLATFORM-IDENTITY-09**.

**Next gate:** PI-09 — Tenant Lifecycle Enforcement (mutations + gates), after explicit go-ahead.
