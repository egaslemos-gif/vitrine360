# PLATFORM-IDENTITY-10A — Security Model

## Invariants

1. User cannot mutate own entitlements.  
2. Tenant SUPER_ADMIN cannot grant entitlements.  
3. Membership role ≠ entitlement.  
4. Device Bearer ≠ entitlement grant.  
5. Client/UI never source of truth.  
6. Future APIs check entitlements **server-side**.  
7. JWT must not carry durable entitlement authority (revalidate like lifecycle).  
8. Entitlement cache: short TTL + invalidate on plan/override/lifecycle change.  
9. SUSPENDED tenant: lifecycle deny first.  
10. Platform axis ≠ Tenant axis.

## Source of truth

Future: relational tables under Platform catalogue + TenantPlan/overrides/usage.  
Today: N/A (no engine) — product behaves as **unconstrained quotas** subject to RBAC + lifecycle only.

## Threat notes

| Threat | Mitigation |
|--------|------------|
| Client spoofs plan | Ignore client; server resolve |
| Tenant escalates via role rename | Entitlements not in ROLE_PERMISSIONS |
| Stale “unlimited” cache after downgrade | Invalidate on TenantPlan change |
| Billing webhook rewrites roles | Forbidden — update TenantPlan / entitlements only |
