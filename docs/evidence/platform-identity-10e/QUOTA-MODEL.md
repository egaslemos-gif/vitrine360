# QUOTA-MODEL — PI-10E

## Relationship

```
EntitlementDefinition (valueType + enforcementType)
        ↓
PlanEntitlement.value
        ↓
EffectiveEntitlements
        ↓
Quota Evaluation  ←── Current Usage
        ↓
ALLOW / DENY / SOFT_WARN
```

## Decision: Quota as Entitlement (not separate entity)

| Option | Pros | Cons |
|--------|------|------|
| Separate `QuotaDefinition` | Clear naming | Duplicates Plan binding, migration churn |
| **Reuse EntitlementDefinition** | Already supports INTEGER/BYTES + HARD/SOFT; PlanEntitlement exists | Need discipline: FEATURE_GATE vs HARD_LIMIT |

**Chosen for foundation:** reuse entitlements. Future `QuotaEvaluation` is a **function**, not a new catalogue table.

## Limit kinds

| Example key | valueType | enforcementType | Usage input |
|-------------|-----------|-----------------|-------------|
| `devices.enabled` | BOOLEAN | FEATURE_GATE | none (PI-10D) |
| `devices.max` | INTEGER | HARD_LIMIT | device count |
| `storage.maxBytes` | BYTES | HARD_LIMIT | SUM(file_size) |
| `bandwidth.monthlyBytes` | BYTES | SOFT or HARD | period aggregate |

Commercial values are **not** decided here.

## Evaluation contract (future)

```
evaluateQuota({ tenantId, key, delta, usageSnapshot })
→ ALLOW | DENY | SOFT_WARN | NO_ACTIVE_PLAN | ENTITLEMENT_NOT_FOUND | USAGE_UNAVAILABLE
```

Must consume EffectiveEntitlements + Usage; must not re-parse PlanEntitlement in each API.

## Soft vs Hard

| Type | At limit |
|------|----------|
| HARD_LIMIT | Deny mutation (fail-closed) |
| SOFT_LIMIT | Allow + signal (log/metric/UI later) |
| FEATURE_GATE | Boolean allow/deny (existing) |
