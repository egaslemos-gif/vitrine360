# PI-10P Security — Preview OFF Baseline

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| SEC-001 | Preview does not point to Production DB | PASS | `/api/health` host = preview Turso |
| SEC-002 | Production secrets not exposed | PASS | no decrypt / no log of Production tokens |
| SEC-003 | Preview secrets not in browser | PASS | only `NEXT_PUBLIC_APP_URL`; secrets are server env |
| SEC-004 | `DATABASE_AUTH_TOKEN` not in logs | PASS | scripts redact / never print |
| SEC-005 | `R2_SECRET_ACCESS_KEY` not in logs | PASS | probe reports SET only |
| SEC-006 | `AUTH_SECRET` not in logs | PASS | scripts never print |
| SEC-007 | Preview `ENTITLEMENTS_ENABLED=false` | PASS | health + Vercel Preview env |
| SEC-008 | Production entitlements OFF/UNSET | PASS | no Production env key |
| SEC-009 | Device Bearer not in public logs | PASS | baseline prints PRESENT only |
| SEC-010 | Tenant isolation | PASS | isolate script + `test:tenant` |

## Residual notes

- Account-scoped R2 keys may exist for both buckets; bucket name isolation is the enforced boundary.
- Preview deploy used CLI path due to Git collaboration BLOCKED state (not a secret leak).
