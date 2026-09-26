# RESOLVER-CONTRACT — PI-10C

## Function

`resolveEffectiveEntitlements(tenantId: string, now?: Date): Promise<EntitlementResolveResult>`

## EffectiveEntitlements (DTO)

| Field | Type | Notes |
|-------|------|-------|
| tenantId | string | Requested tenant |
| planId | string | From ACTIVE TenantPlan |
| planKey | string | Plan catalogue key |
| entitlements | EffectiveEntitlement[] | Sorted by `key` |
| resolvedAt | string | ISO from `now` |

### EffectiveEntitlement

| Field | Type |
|-------|------|
| key | string |
| value | boolean \| number |
| valueType | BOOLEAN \| INTEGER \| BYTES |
| enforcementType | FEATURE_GATE \| HARD_LIMIT \| SOFT_LIMIT |
| raw | string (normalized TEXT) |

## Result statuses

| Status | Meaning |
|--------|---------|
| RESOLVED | Effective set produced |
| NO_ACTIVE_PLAN | Zero ACTIVE TenantPlan |
| MULTIPLE_ACTIVE_PLANS | >1 ACTIVE (data corruption) |
| PLAN_NOT_FOUND | ACTIVE binding points to missing Plan |
| TENANT_NOT_FOUND | Unknown tenantId |
| INVALID_ENTITLEMENT | Bad valueType / enforcementType / parse |
| DUPLICATE_ENTITLEMENT | Duplicate def or key in bindings |

## Diagnostics (non-secret)

`NO_ACTIVE_PLAN`, `PLAN_NOT_FOUND`, `TENANT_NOT_FOUND`, `MULTIPLE_ACTIVE_PLANS`, `INACTIVE_DEFINITION_IGNORED`, `INVALID_VALUE`, `DUPLICATE_ENTITLEMENT_BINDING`, `INVALID_DEFINITION_META`

## Source of truth

Database only. Not JWT, cookies, Device Bearer, frontend, or localStorage.
