# PLATFORM-IDENTITY-09 — Tenant Lifecycle Enforcement & Suspend/Reactivate

**Date:** 2026-09-23  
**Status:** **VALIDATED**  
**Depends on:** PI-04…PI-08 (ARCHITECTURE VALIDATED)  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-009.md`  
**Evidence:** `docs/evidence/platform-identity-09/`  
**Suite:** `npm run test:platform-identity-09` (TL-I*)

---

## What shipped

| Capability | Detail |
|------------|--------|
| Domain | `TENANT_STATUSES = ACTIVE \| SUSPENDED`; `isTenantOperableStatus` fail-closed |
| Service | `suspendTenant` / `reactivateTenant` / `isTenantOperable` / `assertTenantOperable` |
| Permission | `platform.tenants.suspend` on `PLATFORM_SUPER_ADMIN` |
| APIs | `POST …/suspend`, `POST …/reactivate` (flag OFF → 404; rate-limited; idempotent) |
| Console | Suspend / Reactivate buttons on `/platform/tenants/[id]` |
| Audit | `platform.tenant.suspend` / `platform.tenant.reactivate` in `activity_logs` |
| Hard delete | **Not shipped** (SECURITY BLOCKER per PI-08) |

### Operable gate (central)

`isTenantOperable(tenantId)` — only `ACTIVE` passes; missing / unknown / `SUSPENDED` fail closed.

Wired into:

| Surface | Mechanism |
|---------|-----------|
| Session | `getSession`, `sessionFromUser` |
| AuthContext tenant axis | `resolveTenantAuthz` |
| Workspace switch | `/api/workspaces/switch` |
| Device Bearer | `authenticateDevice` → heartbeat / sync / manifest / media / admit |
| Experience serve | `/x/[tenantId]/…` → 404 `TENANT_NOT_OPERABLE` |
| Media | Via `getSession` + `authenticateDevice` (no separate bypass) |
| Platform read | **Not gated** — ops must still see SUSPENDED tenants |

Membership rows and device rows are **not** mass-mutated on suspend.

---

## State machine

```text
ACTIVE ⇄ SUSPENDED
```

- Suspend / reactivate = Platform scope (`platform.tenants.suspend`)  
- `Membership.SUSPENDED` ≠ `Tenant.SUSPENDED`  
- JWT never carries tenant status — revalidated from DB each request  

---

## Explicitly not shipped

Hard delete · `platform.tenants.manage` create · Billing auto-suspend · Entitlements · Support session · Device Runtime redesign · Experience package changes  

Production flag remains **OFF** by default (`PLATFORM_IDENTITY_ENABLED`).

---

## Verdict

**PLATFORM-IDENTITY-09 — VALIDATED**

Residual **R1** (`tenants.status` unused) is **closed**: status is enforced at the control-plane operable gate.
