# DECISION-FLOW — PI-10D

```
enforceEntitlement(tenantId, key)
  ENTITLEMENTS_ENABLED?
    no  → ALLOW (FLAG_OFF)
    yes → resolveEffectiveEntitlements(tenantId)
            not RESOLVED → DENY (mapped reason)
            RESOLVED → evaluateFeatureGate(snapshot, key)
                         missing key → DENY ENTITLEMENT_NOT_FOUND
                         non-BOOLEAN → DENY INVALID_VALUE_TYPE
                         value false → DENY FEATURE_DISABLED
                         value true  → ALLOW FEATURE_ENABLED
```

Fail-closed when flag ON. No silent default plan. No client-supplied entitlement values.
