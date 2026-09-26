# PI-10N Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| N1 | BLOCKER (wholesale) | `compatibility_default` lacks `devices.max` / `storage.maxBytes` → ON blocks quantitative ops | Documented — assign explicit staging plans |
| N2 | WARNING | No Vercel Preview env currently holds the flag | ENVIRONMENT LIMITATION |
| N3 | INFO | Production key absent → OFF | Confirmed safe |
| N4 | INFO | Flag OFF rollback restores legacy without schema rollback | Proven in suite |

No CRITICAL security bypass found in activation paths.
