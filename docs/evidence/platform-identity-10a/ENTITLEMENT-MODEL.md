# PLATFORM-IDENTITY-10A — Entitlement Model

Preserves and extends PI-02 `ENTITLEMENT-MODEL.md`.

## Entities (conceptual)

1. **EntitlementDefinition** — key, type (BOOLEAN\|INTEGER\|BYTES), description, unit  
2. **Plan** — id, name, status (ACTIVE\|ARCHIVED)  
3. **PlanEntitlement** — planId + definitionKey + value  
4. **TenantPlan** — tenantId + planId + status (ACTIVE\|…) + source (`manual`\|`billing`)  
5. **TenantEntitlementOverride** (optional) — key, value, expiresAt?, reason  
6. **UsageMeter** — tenantId + key + amount + asOf  

## Effective resolution

```text
Effective(tenant) =
  PlanEntitlements(TenantPlan.planId)
  ⊕ Overrides(tenant)   // per-key replace
```

## Types

| Type | Semantics |
|------|-----------|
| BOOLEAN | Feature gate |
| INTEGER | Count cap |
| BYTES | Storage cap |
| ENUM | Deferred |

## Non-goals of the model

Price, invoice, payment method, tax — live in **Billing** domain, linked by policy to TenantPlan / Lifecycle.
