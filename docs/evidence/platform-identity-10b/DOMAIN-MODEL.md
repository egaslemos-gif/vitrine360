# DOMAIN-MODEL — PI-10B

## Enums

- `EntitlementValueType`: BOOLEAN | INTEGER | BYTES (ENUM deferred)
- `EntitlementEnforcementType`: FEATURE_GATE | HARD_LIMIT | SOFT_LIMIT
- `TenantPlanStatus`: ACTIVE | INACTIVE

## Value parser

`parseEntitlementValue(valueType, raw)` — rejects NaN, floats for INTEGER/BYTES, negatives, objects/arrays.

## Forward contract

`EffectiveEntitlements` type exists for PI-10C; **not resolved or enforced** here.

## Service

`src/services/entitlements.ts` — internal boundary; no Platform Plan Management permissions.
