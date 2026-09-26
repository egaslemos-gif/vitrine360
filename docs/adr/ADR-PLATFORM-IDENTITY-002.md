# ADR-PLATFORM-IDENTITY-002 — Dual-Axis Authorization (Platform × Tenant)

**Date:** 2026-09-23  
**Status:** Accepted (target architecture; **not implemented**)  
**Supersedes / extends:** ADR-PLATFORM-IDENTITY-001  
**Full design:** `docs/PLATFORM-IDENTITY-02-TARGET-ARCHITECTURE.md`

## Context

PLATFORM-IDENTITY-01 established that authorization today is Membership → Tenant, and that `SUPER_ADMIN` is tenant-scoped—not a SaaS control-plane role.

Vitrine360 must later support Platform Administration (tenants, plans, billing, support, global audit) without collapsing those powers into `memberships.role`.

## Decision

1. **Dual authorization axes** on a **single User identity**:
   - Platform axis: Platform Role → Platform Permissions  
   - Tenant axis: Membership → Tenant Role → Tenant Permissions  

2. **Three scopes:** `PLATFORM_SCOPE` · `TENANT_SCOPE` · `RESOURCE_SCOPE` (see evidence `SCOPE-MODEL.md`).

3. **Platform Super Admin is never encoded as Membership `SUPER_ADMIN`.**

4. **Platform staff do not auto-join every tenant.** Content access uses Membership or an explicit audited **Tenant Support Session**.

5. **Permissions ≠ Entitlements.** Billing mutates entitlements; it does not rewrite roles.

6. **Session JWT remains authentication + thin context.** Platform and tenant authorization are **resolved server-side** per request (extend today’s membership revalidation pattern). Do not embed full permission catalogues in JWT by default.

7. **Preserve current tenant role enum** until a dedicated migration; optional future rename of membership `SUPER_ADMIN` for clarity only.

8. **Implementation order:** Platform Identity → Platform Authz → Tenant permission normalization → Entitlements → Plans/Pricing → Subscriptions → Billing.

## Consequences

### Positive

- Clean SaaS control plane without privilege confusion  
- Least privilege and separation of duties enforceable  
- Compatible with existing Membership and tenant isolation  

### Negative / cost

- New schema and platform console later  
- Support Session complexity  
- Dual audit streams  

### Non-goals of this ADR

- No code, migrations, Stripe, or UI in PLATFORM-IDENTITY-02  

## Alternatives rejected

| Alternative | Why rejected |
|-------------|--------------|
| Inflate Membership SUPER_ADMIN with platform permissions | Every workspace owner becomes SaaS admin |
| Magic “platform tenant” Membership | Confuses content tenancy with control plane |
| Trust JWT role/tenant without revalidation | Client authority / stale grants |

## References

- `docs/PLATFORM-IDENTITY-01-AUDIT.md`  
- `docs/PLATFORM-IDENTITY-02-TARGET-ARCHITECTURE.md`  
- `docs/evidence/platform-identity-02/*`  
- Current runtime: `src/lib/auth.ts`, `src/services/memberships.ts`, `src/domain/types.ts`
