# RESOLUTION-FLOW — PI-10C

```
tenantId
  → tenants.id exists?
       no → TENANT_NOT_FOUND
  → tenant_plans WHERE tenant_id AND status=ACTIVE
       0 → NO_ACTIVE_PLAN
       >1 → MULTIPLE_ACTIVE_PLANS
       1 → plan_id
  → plans.id
       missing → PLAN_NOT_FOUND
  → plan_entitlements ⨝ entitlement_definitions
  → for each binding:
       inactive definition → INACTIVE_DEFINITION_IGNORED (skip)
       duplicate def/key → DUPLICATE_ENTITLEMENT
       parseEntitlementValue (PI-10B)
            fail → INVALID_ENTITLEMENT
  → sort by key
  → RESOLVED { EffectiveEntitlements, diagnostics }
```

No writes. No default-plan assignment. No usage counts. No RBAC/JWT/lifecycle filters.
