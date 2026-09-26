# PLATFORM-IDENTITY-02 — Role Matrix (Target + Current)

**Date:** 2026-09-23  
**Design only — no enums/tables created**

---

## A. Platform roles (proposed — minimum set)

| Role | Purpose | Powers (conceptual) | Limitations | Needed? |
|------|---------|---------------------|-------------|---------|
| **PLATFORM_SUPER_ADMIN** | Full control plane | All platform permissions; appoint platform staff; irreversible ops (with audit) | Still **no** automatic tenant Membership; content ops only via Support Context | **Yes** — at least one break-glass operator |
| **PLATFORM_ADMIN** | Day-to-day SaaS ops | Tenants read/manage/suspend; usage read; settings (non-billing); audit read | No billing write; no appoint PLATFORM_SUPER_ADMIN | **Yes** |
| **PLATFORM_SUPPORT** | Customer support | Tenants read; optional Support Session start; audit read of own actions | No suspend without dual-control (optional); no billing; no plans write; Support Session required for tenant content | **Yes** if human support is offered |
| **PLATFORM_VIEWER** | Finance / compliance / observability | Global metrics, audit read, subscriptions read | No mutations | **Optional** — can start as permission subset of ADMIN |

**Rejected as Day-1 roles unless product demands:** PLATFORM_BILLING as separate role — start as permission set on PLATFORM_ADMIN / SUPER; split later for Separation of Duties.

### Least privilege / SoD

- Billing write ≠ Support Session start (prefer different people or dual approval later).  
- Suspend tenant ≠ silent content edit.  
- Platform roles **never** appear in `memberships.role`.

---

## B. Tenant roles (current — preserved)

| Role (today) | Scope | Recommendation |
|--------------|-------|----------------|
| `SUPER_ADMIN` | Tenant Membership | Keep as **tenant** “workspace owner-class”. Do **not** map to Platform. Optional future **label** rename → `WORKSPACE_OWNER` (migration later). |
| `ADMIN` | Tenant Membership | Keep — workspace admin. |
| `EDITOR` | Tenant Membership | Keep — content/studio. |
| `OPERATOR` | Tenant Membership | Keep — devices/ops. |
| `VIEWER` | Tenant Membership | Keep — read-only. |

### Evaluated but **not** added now

| Candidate | Verdict |
|-----------|---------|
| `OWNER` | Overlaps SUPER_ADMIN; rename later if desired — **do not add enum now** |
| `MANAGER` | Overlaps ADMIN/EDITOR mix; **no Day-1 need** |
| `MEMBER` | Vague; avoid |

**Do not change `USER_ROLES` enum in this phase.**

---

## C. Same identity, two authorization axes

```
User (Identity)
  ├── PlatformStaffAssignment?  → PlatformRole  → PlatformPermissions   [future]
  └── Membership*               → TenantRole    → TenantPermissions     [exists]
```

One User account; zero duplicated Users for platform staff who also hold workspace memberships.
