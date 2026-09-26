# SCHEMA-AUDIT — PI-10B

## Tables

| Entity | Table | Scope | Notes |
|--------|-------|-------|-------|
| EntitlementDefinition | `entitlement_definitions` | PLATFORM | unique `key` |
| Plan | `plans` | PLATFORM | no `tenant_id`, no price |
| PlanEntitlement | `plan_entitlements` | PLATFORM | unique (planId, definitionId); FK restrict |
| TenantPlan | `tenant_plans` | TENANT | FK tenant cascade; one ACTIVE via service |

## Indexes

- `entitlement_definitions_key_uidx`, `_active_idx`
- `plans_key_uidx`, `_active_idx`
- `plan_entitlements_plan_def_uidx`, `_plan_idx`, `_def_idx`
- `tenant_plans_tenant_idx`, `_plan_idx`, `_status_idx`, `_tenant_status_idx`

## ensureSchema

Mirrored in `src/db/client.ts` (CREATE IF NOT EXISTS).
