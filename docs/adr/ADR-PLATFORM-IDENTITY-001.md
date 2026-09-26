# ADR-PLATFORM-IDENTITY-001 — Separate Platform Scope from Tenant Membership Roles

**Date:** 2026-09-23  
**Status:** Accepted (architecture decision for future work; **not implemented**)  
**Context audit:** `docs/PLATFORM-IDENTITY-01-AUDIT.md`

## Context

Vitrine360 is multi-tenant. Authorization today is:

```
User → Membership(role, ACTIVE) → Tenant (Workspace) → Tenant permissions
```

The membership role named `SUPER_ADMIN` grants full **tenant** permissions (same as `ADMIN`) plus the ability to assign `SUPER_ADMIN` within that workspace. It does **not** administer the SaaS platform (tenants catalogue, plans, billing, global settings).

Product requires a future **Platform Super Admin** for SaaS operations. Collapsing that into membership `SUPER_ADMIN` would mix PLATFORM_SCOPE and TENANT_SCOPE and violate least privilege / separation of duties.

## Decision

1. **Treat current `SUPER_ADMIN` as a tenant-scoped role** until an explicit rename migration.  
2. **Introduce Platform Authorization as a separate axis** (Platform Identity / Platform Role / Platform Permissions), not as “more permissions on Membership”.  
3. **Platform Super Admin must not automatically become a member of every tenant.** Tenant access for support, if ever needed, is explicit, time-bounded, and audited.  
4. **Workspace Admin / Super Admin never inherit Platform permissions** by naming coincidence.  
5. **Billing, plans, subscriptions, entitlements, invoices** live in the **platform domain**, bound to `tenantId` as the customer workspace — not inside content/runtime tables.  
6. **Session JWT claims for role/tenant remain CONTEXT**; server continues to revalidate membership (and, later, platform roles) on every privileged request.

## Consequences

### Positive

- Clear security boundary for SaaS ops vs workspace ops  
- Preserves existing tenant isolation and membership model  
- Avoids irreversible privilege inflation of `SUPER_ADMIN`

### Negative / cost

- Additional schema and admin surfaces later  
- Possible rename of membership `SUPER_ADMIN` for clarity (migration + UX)  
- Dual audit streams (tenant vs platform)

### Non-goals of this ADR

- No schema/migration in PLATFORM-IDENTITY-01  
- No Stripe / billing implementation  
- No change to Player, Experience Runtime, or device auth

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| `SUPER_ADMIN` + extra platform permissions on same role | Mixes scopes; any workspace SUPER_ADMIN becomes SaaS admin |
| Global `users.role = PLATFORM_*` without membership | Ignores multi-workspace; conflates identity with platform staff |
| Platform admin as member of a magic “platform tenant” | Confuses content tenancy with control plane |

## References

- `src/domain/types.ts` — `ROLE_PERMISSIONS`  
- `src/lib/auth.ts` — session revalidation  
- `src/services/memberships.ts` / `members.ts`  
- `docs/evidence/platform-identity-01/ROLE-MATRIX.md`  
- `docs/evidence/platform-identity-01/TENANT-ISOLATION-MATRIX.md`
