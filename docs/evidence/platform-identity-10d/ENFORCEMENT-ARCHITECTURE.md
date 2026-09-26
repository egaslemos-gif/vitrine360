# ENFORCEMENT-ARCHITECTURE — PI-10D

```
Request
  → Authentication (session)
  → Tenant Context (membership.tenantId)
  → RBAC (manage_devices)
  → Tenant Lifecycle (ACTIVE / operable)
  → enforceEntitlement(tenantId, key)
       → if FLAG_OFF → ALLOW
       → else resolveEffectiveEntitlements
       → evaluateFeatureGate
  → Domain mutation (pairDevice)
```

Engine location: `src/services/entitlements.ts`  
Pure evaluation: `evaluateFeatureGate` in `src/domain/entitlements.ts`  
Does not query PlanEntitlement directly from APIs.
