# ADR-PLATFORM-IDENTITY-003 — Implementation Plan & Security Gate

## Status

Accepted — PLATFORM-IDENTITY-03 (**plan only; not implemented**)

## Context

PI-01 established that membership `SUPER_ADMIN` is tenant-scoped.  
PI-02 defined dual-axis Platform × Tenant authorization and Permissions ≠ Entitlements.  
ARCHITECTURE-FUTURE-01 placed Business / Control plane ownership for platform ops.

Before writing migrations or auth code, the programme needs an executable plan, security gate, migration and compatibility strategy so agents do not overload `memberships.role` or trust JWT claims.

## Decision

1. **PI-03 delivers plans and gates only** — no schema/API/session/RBAC/UI changes.  
2. Platform Identity will be introduced **additively** with a feature flag default **off**.  
3. **Never** encode Platform Super Admin as Membership `SUPER_ADMIN`.  
4. Session JWT remains thin; **DB revalidation** extends to platform assignments.  
5. Migration **does not** auto-promote workspace SUPER_ADMINs to platform.  
6. SECURITY-GATE.md must PASS before enabling the flag in shared environments.  
7. Entitlements and Billing remain later phases (PI-08/09).  
8. Residual risks (tenant status unused, seed credentials, `/x/` serve, login home) are documented — **not** silently patched in PI-03.

## Consequences

### Positive

- Clear execution path for PI-04+  
- Reduced risk of privilege collapse  
- Compatible with existing Membership and EXPERIENCE-11 boundaries  

### Cost

- Platform features stay unavailable until PI-04+  
- Ops must bootstrap platform admins deliberately  

## Non-goals

Code, migrations, Stripe, platform UI, Experience/Player changes.

## References

- `docs/PLATFORM-IDENTITY-03-IMPLEMENTATION-PLAN.md`  
- `docs/evidence/platform-identity-03/*`  
- ADR-PLATFORM-IDENTITY-001 / 002  
- `docs/ARCHITECTURE-FUTURE-01.md`
