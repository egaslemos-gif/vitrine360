# PLATFORM-IDENTITY-02 — Target Authorization Architecture

**Date:** 2026-09-23  
**Status:** **PLATFORM-IDENTITY-02 — ARCHITECTURE VALIDATED**  
**Nature:** Design / ADR only. **No production code, schema, migrations, APIs, session, or RBAC changes.**

**Depends on:** `docs/PLATFORM-IDENTITY-01-AUDIT.md` (VALIDATED)  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-002.md`  
**Evidence:**

| File |
|------|
| `docs/evidence/platform-identity-02/SCOPE-MODEL.md` |
| `docs/evidence/platform-identity-02/ROLE-MATRIX.md` |
| `docs/evidence/platform-identity-02/PERMISSION-MATRIX.md` |
| `docs/evidence/platform-identity-02/ENTITLEMENT-MODEL.md` |

---

## 1. Objective

Define the **target** authorization architecture for Vitrine360 SaaS so that Platform Administration, Tenant Administration, Plans/Billing/Entitlements, Support, Audit, Live Media, and Experience Runtime can grow **without privilege mixing**.

### Fundamental principle (non-negotiable)

```
Membership.role = SUPER_ADMIN   ≠   Platform Super Admin
```

- Current `SUPER_ADMIN` remains a **TENANT ROLE**.  
- Platform Super Admin is a **PLATFORM ROLE**.  
- Platform roles are **never** stored in `memberships`.

---

## 2. Identity model

**One base identity:** `User` (+ `UserIdentity` for Google, etc.).

```
User / Identity
  ├── Platform Authorization axis   [future]
  └── Tenant Authorization axis     [exists: Membership]
```

| Decision | Rationale |
|----------|-----------|
| Same identity for both axes | No duplicated Users; staff can also be workspace members |
| Separate authorization contexts | Avoids SUPER_ADMIN / Platform confusion |
| Deny by default on each axis | Missing platform assignment ≠ platform access; missing membership ≠ tenant access |

---

## 3. Scope model

See `SCOPE-MODEL.md`. Summary:

| Scope | Authority over |
|-------|----------------|
| **PLATFORM_SCOPE** | SaaS control plane (tenants lifecycle, plans, billing, global settings, platform audit, support sessions) |
| **TENANT_SCOPE** | One Workspace via ACTIVE Membership |
| **RESOURCE_SCOPE** | Objects inside a tenant (+ device Bearer path) |

---

## 4. Platform roles (conceptual minimum)

| Role | Needed | Notes |
|------|--------|-------|
| `PLATFORM_SUPER_ADMIN` | Yes | Full control plane; staff appointment |
| `PLATFORM_ADMIN` | Yes | Day-to-day tenant/ops; limited billing |
| `PLATFORM_SUPPORT` | Yes if support offered | Support Session; no plan write |
| `PLATFORM_VIEWER` | Optional | Read-only metrics/audit |

Details: `ROLE-MATRIX.md`.

---

## 5. Tenant roles (current + recommendation)

**Preserve** enum: `SUPER_ADMIN` · `ADMIN` · `EDITOR` · `OPERATOR` · `VIEWER`.

| Recommendation | |
|----------------|--|
| Do not add `OWNER` / `MANAGER` / `MEMBER` now | Redundant or vague |
| Optional later rename | `SUPER_ADMIN` → display “Workspace Owner” / enum `WORKSPACE_OWNER` |
| Keep special rule | Only tenant SUPER_ADMIN may assign SUPER_ADMIN |

---

## 6. Permissions

Catalogues in `PERMISSION-MATRIX.md`.

- **Platform permissions** namespaced `platform.*`  
- **Tenant permissions** namespaced `tenant.*` (map from today’s coarse `manage_*`)  
- Platform holds lifecycle/billing; Tenant holds content/ops  
- **\*** Platform does **not** auto-get tenant content permissions

---

## 7. Platform Admin vs Tenant Membership

**Q: Must Platform Super Admin be a Membership of every Tenant?**  
**A: No.**

Platform authority exists on the **platform axis**. Tenant content access requires either:

1. Normal **Membership**, or  
2. Explicit **Tenant Support Context** (impersonation/support session)

Never invent silent “membership of all tenants”.

---

## 8. Impersonation / Support (design only)

```
Platform Support
  → Tenant Support Session (explicit)
       · reason (required)
       · max duration (e.g. 15–60 min)
       · actor + targetTenantId
       · audit start/end
       · UI banner “Support session active”
       · permissions ≤ SUPPORT profile (prefer read + limited write)
       · cannot convert into permanent Membership
       · cannot escalate to PLATFORM_SUPER_ADMIN
```

Not implemented in this phase.

---

## 9. Session model (target)

```
Authentication context          Authorization context
─────────────────────          ───────────────────────
Cookie proves Identity         Server resolves:
  User id                        · PlatformRole? (DB/lookup)
  Session validity               · ActiveTenant claim (context)
                                 · Membership (if tenant op)
                                 · Permissions for this request
```

| Rule | |
|------|--|
| Do **not** pack all platform permissions into JWT by default | Avoid stale/over-broad tokens |
| Resolve Platform Context **server-side** per request | Same pattern as membership revalidation today |
| JWT `role` / `tenantId` remain **CONTEXT** | Revalidate before authorize |
| Never trust client/URL tenantId alone | |

Today’s `getSession()` membership revalidation is the pattern to extend for platform assignment lookup.

### Target flows

**Tenant request**

```
requireSession()
  → resolveIdentity()
  → resolveActiveTenantClaim()
  → resolveMembership(ACTIVE)
  → resolveTenantRole()
  → checkTenantPermission()
  → checkResourceScope(tenantId)
  → [checkEntitlement()]
  → operation
```

**Platform request**

```
requireSession()
  → resolveIdentity()
  → resolvePlatformRole()
  → checkPlatformPermission()
  → operation
  // no Membership required
```

**Support request (tenant content via platform)**

```
requireSession()
  → resolvePlatformRole()
  → requireActiveSupportSession(tenantId)
  → checkSupportAllowance()
  → checkResourceScope(tenantId)
  → operation + audit
```

---

## 10. Active Tenant

Active Tenant is **context**, not absolute authority.

Server always verifies: **identity + membership (or support session) + tenant scope**.

---

## 11. Tenant isolation (preserve IDENTITY-01)

All tenant ops keep `tenantId` scoping + server-side auth.

**Avoid Platform → accidental Tenant bypass:**

- Platform handlers must not call tenant services with a “god” tenant skip flag.  
- Shared services accept `AuthzContext` with explicit `scope: PLATFORM | TENANT | SUPPORT`.  
- Suspended tenants: deny TENANT_SCOPE sessions; platform may still read tenant record.

---

## 12. Billing boundary & entitlements

See `ENTITLEMENT-MODEL.md`.

```
Plan → Entitlements → Subscription → Tenant → Effective Entitlements → Feature access
```

| Permission | Entitlement |
|------------|-------------|
| Who may | Plan allows |

Billing changes entitlements, **not** roles.

---

## 13. Audit (future split)

| Stream | Example |
|--------|---------|
| PLATFORM AUDIT | Platform Admin suspended Tenant X |
| TENANT AUDIT | Workspace Admin removed Device Y |

Minimum fields: `actor`, `scope`, `action`, `resource`, `resourceId`, `tenantId?`, `timestamp`, `metadata`, `reason?`.

---

## 14. Security principles

| Principle | Application |
|-----------|-------------|
| Least Privilege | Minimal platform role set; Support Session time-boxed |
| Deny by Default | No platform assignment → no platform APIs |
| Server-side Authorization | Every privileged route |
| Tenant Isolation | Preserve IDENTITY-01 matrices |
| Separation of Duties | Billing write vs Support; staff.manage on SUPER only |
| Explicit Scope | AuthzContext.scope required |
| Auditability | Dual streams; support reason required |
| No Client Authority | Ignore client role/tenant without revalidation |
| No Role Escalation | Tenant SUPER_ADMIN cannot grant platform roles |

---

## 15. Migration strategy (future — not started)

| Phase | Focus |
|-------|--------|
| **A** | Platform Identity / staff assignment model (schema design) |
| **B** | Platform Authorization (permissions + platform API gates) |
| **C** | Tenant permission normalization (`tenant.*` aliases) |
| **D** | Entitlements engine (effective caps/flags) |
| **E** | Plans / Pricing |
| **F** | Subscriptions |
| **G** | Billing provider (e.g. Stripe) |

No phase auto-starts from this document.

---

## 16. Non-goals (this phase)

No Platform Admin UI · no tables/enums · no Billing/Plans/Stripe · no schema/API/middleware/session/RBAC code changes.

---

## 17. Validation checklist

| Criterion | |
|-----------|--|
| Platform / Tenant / Resource scopes defined | Yes |
| Platform roles conceptual | Yes |
| Tenant roles documented (current preserved) | Yes |
| Platform & Tenant permissions documented | Yes |
| Permission vs Entitlement separated | Yes |
| Session / authz flows defined | Yes |
| Platform↔Tenant boundary + Support model | Yes |
| Billing boundary | Yes |
| Migration strategy | Yes |
| No production code altered | Yes — docs only |

### **PLATFORM-IDENTITY-02 — ARCHITECTURE VALIDATED**

Do **not** start implementation phases, RUNTIME-EXPERIENCE-11, LIVE-MEDIA-01, or Billing from this deliverable.
