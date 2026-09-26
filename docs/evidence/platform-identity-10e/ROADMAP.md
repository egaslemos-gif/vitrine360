# ROADMAP — PI-10E

| Phase | Focus |
|-------|--------|
| **PI-10E** | Usage & Quota Architecture Audit ← **this phase** |
| **PI-10F** | Usage & Quota Foundation — metric defs, evaluateQuota helpers, optional UsageEvent schema, derive readers; still flag-gated; no broad enforcement |
| **PI-10G** | Quantitative Enforcement — `devices.max` then `storage.maxBytes` behind flag; atomic TX |
| **PI-10H** | Plan Management — platform assign TenantPlan / catalogue UI+perms |
| **PI-10I** | Usage Observability — metrics, near_limit, reconciliation jobs |
| **PI-10J** | Billing Integration — subscription → TenantPlan only |

## Sequence rationale

Foundation before enforcement avoids racing without TX helpers. Plan Management after first quantitative pilot so assignment/compatibility is deliberate. Billing last to preserve entitlement purity.

Adjust only if product blocks on DEC-08/device semantics before PI-10F code.
