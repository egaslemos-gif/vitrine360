# PLATFORM-IDENTITY-10A — Entitlements & Plan Model Architecture Audit

**Date:** 2026-09-24  
**Status:** **CLOSED** (architecture audit complete; documentation only at time of phase — **ZERO** schema / API / JWT / RBAC / Billing / UI / Runtime code changes in PI-10A)  
**Depends on:** PI-01…PI-09 (lifecycle enforced) · PI-02 Entitlement Model (design)  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-010A.md`  
**Evidence:** `docs/evidence/platform-identity-10a/`  

---

## Absolute rule

PI-10A does **not** change runtime behaviour.  
It deepens the **Plan / Entitlement / Quota / Usage / Billing boundary** so a future PI-10B+ can implement incrementally without mixing RBAC or Tenant Lifecycle.

---

## 1. Current state (code is source of truth)

| Layer | Exists? | Notes |
|-------|---------|-------|
| Plan / Subscription / Entitlement tables | **No** | Absent from `schema.ts` |
| Plan fields on `tenants` | **No** | Only `status` (lifecycle ACTIVE\|SUSPENDED) |
| Entitlement engine / `getEffectiveEntitlements` | **No** | |
| Billing / Stripe / invoices | **No** | |
| Informal plan limits in create Device/User/Media | **No** | Grep: no `maxDevices` / plan quotas in services |
| Platform permissions for plans/billing | **Catalogue only (PI-02 docs)** | Not in `PLATFORM_PERMISSIONS` code (only `tenants.read` + `tenants.suspend`) |
| Feature flag | **Yes** | `PLATFORM_IDENTITY_ENABLED` — infra gate, **not** a commercial entitlement |
| Tenant Lifecycle | **Yes (PI-09)** | Operable gate `isTenantOperable` |
| Tenant RBAC | **Yes** | `ROLE_PERMISSIONS` / memberships |
| Platform RBAC | **Yes (flag OFF default)** | `platform_assignments` + `platform.*` |

**Conclusion:** Entitlements exist as **architecture docs (PI-01/02)** only. No commercial enforcement is hidden in UI/API.

### Phase numbering note

Early roadmap (PI-03) labelled “PI-08 Entitlements / PI-09 Billing”.  
**Actual** PI-08/09 shipped **Tenant Lifecycle**.  
Entitlements resume here as **PI-10A** (audit) → future **PI-10B+** (implementation). Preserve PI-02 semantics; do not reinvent.

---

## 2. Responsibility separation (normative)

| Concern | Question | Authority |
|---------|----------|-----------|
| **RBAC** | Who may execute this action? | Membership role / Platform assignment |
| **Entitlement** | Does this tenant’s commercial package allow the capability? | Plan → Effective entitlements |
| **Quota** | How much of a metered resource may they use? | Integer/bytes caps on entitlements |
| **Usage** | How much are they using now? | Measured counters (devices, bytes, …) |
| **Lifecycle** | Is the tenant operable? | `tenants.status` ACTIVE\|SUSPENDED (PI-09) |
| **Feature flag** | Is the technical capability deployed/enabled? | Env / release flags (e.g. `PLATFORM_IDENTITY_ENABLED`) |
| **Billing** | What is the commercial/financial relationship? | Subscription / provider (future) |

**Forbidden collapses**

- Membership role ≠ plan entitlement  
- `Tenant.SUSPENDED` ≠ “unpaid subscription” (billing may *trigger* suspend later; axes stay distinct)  
- Feature flag ≠ paid entitlement  
- JWT claim ≠ durable entitlement authority  

---

## 3. Conceptual model (not implemented)

```text
EntitlementDefinition (PLATFORM catalogue)
        ↑
Plan ───┴── PlanEntitlement (value per definition)
        ↑
TenantPlan / Subscription binding (TENANT-scoped row)
        ↑
Tenant
        │
        ├── EffectiveEntitlements(tenant)   [resolved]
        └── Usage meters (optional)         [observed]
```

| Entity | Scope | Cardinality |
|--------|-------|-------------|
| `EntitlementDefinition` | PLATFORM | 1 per key (`devices.max`, …) |
| `Plan` | PLATFORM | many |
| `PlanEntitlement` | PLATFORM | N per Plan |
| `TenantPlan` (or Subscription) | TENANT | **1 active** commercial plan binding per tenant (Day-1); history allowed later |
| `TenantEntitlementOverride` | TENANT | optional, Platform-only, audited |
| `UsageSnapshot` / meters | TENANT | per meter key |

**Justification:** Matches PI-02; Tenant domain **consumes** effective entitlements and never owns Plan/Price tables.

---

## 4. Entitlement value types (Day-1 proposal)

| Type | Example | Use |
|------|---------|-----|
| **BOOLEAN** | `experiences.enabled` | Feature gate |
| **INTEGER** | `devices.max` | Hard/soft caps |
| **BYTES** | `media.storage.max` | Storage caps |
| **ENUM** | `analytics.tier` | Deferred unless product needs tiers |

Day-1 implementation should support BOOLEAN + INTEGER + BYTES. ENUM optional.

Illustrative keys (non-final):  
`devices.max` · `users.max` · `media.storage.max` · `playlists.max` · `contents.max` · `schedules.enabled` · `experiences.enabled` · `experiences.max` · `live.enabled` · `analytics.enabled`

---

## 5. Effective entitlements

```text
base = PlanEntitlements(active TenantPlan.planId)
effective = merge(base, TenantEntitlementOverrides?)
```

**Precedence (proposed):** Override wins per key when present; missing key → fail closed for **feature gates**; for **quotas**, missing key → treat as **0** or “unlimited only if explicitly defined” — **OPEN DECISION** (recommend: missing INTEGER/BYTES = 0 fail-closed for create paths).

**Overrides:** Platform-only (`platform.entitlements.manage` future). Tenant SUPER_ADMIN cannot raise caps. Time-boxed + audited.

**JWT:** Do **not** embed entitlements as durable authority. Resolve server-side (DB ± short TTL cache).

---

## 6. Evaluation order (future API)

```text
1. Authenticate (session / Device Bearer)
2. Lifecycle: isTenantOperable? (PI-09)
3. RBAC: hasPermission?
4. Entitlement: feature enabled? / under quota?
5. Tenant scope: resource.tenantId match?
6. Execute + optional usage increment
```

---

## 7. Quotas vs gates

| Kind | Behaviour |
|------|-----------|
| **FEATURE GATE** | BOOLEAN off → deny create/use of capability |
| **HARD LIMIT** | INTEGER/BYTES at or over → deny create |
| **SOFT LIMIT** | Warn / allow with audit (product policy later) |

No commercial prices or FREE/PRO/ENTERPRISE SKUs in this phase.

---

## 8. Security (source of truth)

- Source of truth: **server DB** (future tables) + Platform catalogue.  
- Client/UI never authoritative.  
- Device Bearer does not grant entitlements.  
- SUPER_ADMIN / membership cannot self-grant entitlements.  
- Suspended tenant: lifecycle deny **before** entitlement checks.  
- Cache: invalidate on plan assign/change, override change, suspend/reactivate.

---

## 9. Multi-tenancy

| Data | Scope |
|------|-------|
| Plans, entitlement definitions | PLATFORM (readable by platform staff; not tenant-writable) |
| TenantPlan, overrides, usage | TENANT-scoped; Tenant A never reads Tenant B |

---

## 10. Billing boundary (future)

```text
BillingProvider → Subscription status → (policy) → TenantPlan / Lifecycle actions
```

`payment_failed` **may** trigger Platform suspend **via explicit policy**, not by equating billing status with entitlement rows automatically.  
Billing unavailable ≠ auto-lock all tenants (default fail-open on billing outage for **existing** ACTIVE entitlements until policy says otherwise — OPEN for product).

---

## 11. Migration strategy (future PI-10B+)

1. Additive schema behind flag (e.g. `ENTITLEMENTS_ENABLED`).  
2. Seed default Plan + definitions.  
3. Backfill `TenantPlan` for all existing tenants → default plan (unlimited or generous MVP caps — product).  
4. Enforcement OFF until suite green; then gradual create-path checks.  
5. No JWT shape change; no RBAC catalogue merge.

---

## 12. Failure modes (principles)

| Case | Principle |
|------|-----------|
| No TenantPlan | Fail closed on **new** entitlement-gated creates; Platform must assign plan |
| Unknown entitlement key | Deny feature / treat quota as 0 |
| Quota exceeded | 403/402 with stable code `ENTITLEMENT_QUOTA` |
| Tenant SUSPENDED | Lifecycle wins (existing PI-09) |
| Stale cache | TTL + invalidate on mutations |
| Billing down | Do not mass-suspend; alert Platform |

---

## 13. Audit events (future)

`plan.assigned` · `plan.changed` · `entitlement.override.set` · `quota.changed`  
Fields: actor, tenantId, from/to, reason, source (`platform`\|`billing`\|`system`), timestamp.

---

## 14. Non-goals (this phase)

Schema · migrations · JWT · RBAC edits · Billing/Stripe · UI plans · quota enforcement · Player/Device/Experience/Storage changes.

---

## 15. Verdict

**PLATFORM-IDENTITY-10A — ARCHITECTURE VALIDATED**

Open product decisions (default plan caps, soft limits, billing-outage policy) are documented; they do **not** block architecture acceptance.
