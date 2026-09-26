# FAILURE-MODEL — PI-10E

| Failure | Recommended HARD_LIMIT behaviour | FEATURE_GATE (existing) |
|---------|----------------------------------|-------------------------|
| No Usage / cannot read | **FAIL CLOSED** DENY | N/A |
| Invalid Usage | FAIL CLOSED | N/A |
| Stale counter (if used) | Prefer derive or reconcile; else FAIL CLOSED if uncertain | N/A |
| Missing TenantPlan | DENY `NO_ACTIVE_PLAN` | same |
| Missing quota key | DENY `ENTITLEMENT_NOT_FOUND` | same |
| Invalid quota value | DENY | same |
| R2 unavailable on upload | Fail upload; no usage charge | N/A |
| DB unavailable | Request fails | Request fails |
| TX conflict | Retry once or DENY | N/A |
| Duplicate event | No double increment (idempotent) | N/A |
| Quota exceeded | DENY | N/A |
| Flag OFF | Legacy (no quantitative enforce) | ALLOW FLAG_OFF |

## Fail open vs closed

Quantitative **HARD_LIMIT** under `ENTITLEMENTS_ENABLED=ON` → **fail closed**.  
SOFT_LIMIT may warn and allow.  
Flag OFF → do not invent quotas (legacy preserved).
