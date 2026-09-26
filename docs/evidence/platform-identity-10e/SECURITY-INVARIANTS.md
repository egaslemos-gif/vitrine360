# SECURITY-INVARIANTS — PI-10E

| ID | Invariant |
|----|-----------|
| SEC-USAGE-001 | Usage never crosses tenant boundaries |
| SEC-USAGE-002 | Tenant A cannot read Tenant B Usage |
| SEC-USAGE-003 | Client never defines Usage |
| SEC-USAGE-004 | Client never defines quota / PlanEntitlement values |
| SEC-USAGE-005 | JWT is not quota authority |
| SEC-USAGE-006 | Device Bearer cannot alter quota or Usage |
| SEC-USAGE-007 | Platform authority does not auto-grant tenant resources via Usage bypass |
| SEC-USAGE-008 | Usage records must not store secrets/tokens |
| SEC-USAGE-009 | Quota enforcement is server-side only |
| SEC-USAGE-010 | Race conditions must not allow quantitative bypass |

All evaluations use trusted `tenantId` from session/membership, never client-supplied tenant as authority.
