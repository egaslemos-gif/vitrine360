# QUOTA-EVALUATION — PI-10F

Pure `evaluateQuota({ usage, limit, enforcementType })`.

| Type | Behaviour |
|------|-----------|
| HARD_LIMIT | usage < limit → ALLOW; else DENY (blocksAllocation) |
| SOFT_LIMIT | NEAR_LIMIT / EXCEEDED advisory; **never** blocks |
| FEATURE_GATE | INVALID here — use `evaluateFeatureGate` |

Not called from resource APIs in PI-10F.
