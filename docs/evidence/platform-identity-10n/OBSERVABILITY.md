# PI-10N Observability

Existing mechanisms (no new commercial metrics stack):

| Signal | Source |
|--------|--------|
| Quota / entitlement deny | `EntitlementDeniedError` → API `403` `{ error: ENTITLEMENT_DENIED, code, entitlement, reason }` + optional `entitlement.denied` activity |
| Tenant suspended | `TenantLifecycleError` / session null |
| Reservation lifecycle | storage reservation rows + activity on media upload |
| Auth / RBAC | `AuthError` / `MembershipError` |

Distinguish: AUTH vs RBAC vs TENANT_NOT_OPERABLE vs QUOTA_EXCEEDED vs storage provider errors.
