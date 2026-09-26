# SECURITY-VALIDATION — PI-10B

| ID | Invariant | Status |
|----|-----------|--------|
| INVARIANT-01 | Membership role ≠ entitlement | PASS (no merge) |
| INVARIANT-02 | Entitlement ≠ RBAC permission | PASS |
| INVARIANT-03 | Device Bearer ≠ entitlement | PASS (no wiring) |
| INVARIANT-04 | Frontend not source of truth | PASS (server domain) |
| INVARIANT-05 | JWT not entitlement authority | PASS (no JWT claims) |
| INVARIANT-06 | Plan has no tenant scope | PASS |
| INVARIANT-07 | TenantPlan is tenant-scoped | PASS |
| INVARIANT-08 | Tenant A ↛ Tenant B TenantPlan | PASS (service query by tenantId) |
| INVARIANT-09 | Suspended tenant unchanged by Plan | PASS (no lifecycle coupling) |
| INVARIANT-10 | Plan ≠ Tenant Lifecycle | PASS |
| INVARIANT-11 | PI-10B does not apply quotas | PASS |
| INVARIANT-12 | Flag OFF preserves behaviour | PASS |

PI-10B NÃO implementa enforcement.
