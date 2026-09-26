# PI-10O Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| O1 | High (ops) | Vercel Preview has no DATABASE_URL / AUTH / R2 — live Preview deploy blocked | OPEN — ENVIRONMENT LIMITATION |
| O2 | Medium | R2 API keys are account-scoped; isolation relies on bucket name | OPEN — residual risk |
| O3 | Low | `compatibility_default` insufficient for quantitative ops (confirmed Tenant C) | CONFIRMED (by design) |
| O4 | Info | Preview `ENTITLEMENTS_ENABLED=false` set; Production remains UNSET | DONE |
| O5 | Info | Bucket `vitrine360-preview` created + probed | DONE |
