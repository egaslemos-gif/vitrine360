# FAILURE-MODES — PI-10C

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| NO_ACTIVE_PLAN | No ACTIVE TenantPlan | Typed result; no silent default |
| MULTIPLE_ACTIVE_PLANS | >1 ACTIVE | Typed failure; no pick |
| PLAN_NOT_FOUND | Missing Plan row | Typed failure; no create |
| TENANT_NOT_FOUND | Unknown tenant | Typed failure |
| INVALID_ENTITLEMENT | Parse / meta invalid | Typed failure; no partial force |
| DUPLICATE_ENTITLEMENT | Corrupt duplicate bindings | Typed failure; no silent choose |
| INACTIVE_DEFINITION_IGNORED | `active=false` | Diagnostic; excluded from set |

Hard throws are reserved for infrastructure failures, not expected domain states.
