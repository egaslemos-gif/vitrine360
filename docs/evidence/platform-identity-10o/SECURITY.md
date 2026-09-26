# PI-10O Security Tests

| ID | Assertion | Result |
|----|-----------|--------|
| PI10O-SEC-001 | Suite DB is isolated file — not Production Turso | PASS |
| PI10O-SEC-002 | Suite does not write Production R2 bucket | PASS |
| PI10O-SEC-003 | Client cannot toggle entitlement flag | PASS |
| PI10O-SEC-004 | Client cannot choose plan | PASS |
| PI10O-SEC-005 | Client cannot choose maxBytes | PASS |
| PI10O-SEC-006 | Cross-tenant quota isolation | PASS |
| PI10O-SEC-007 | SUPER_ADMIN cannot bypass quota (service path) | PASS |
| PI10O-SEC-008 | PLATFORM_SUPER_ADMIN cannot bypass quota | PASS |
| PI10O-SEC-009 | Device Bearer cannot bypass quota | PASS |
| PI10O-SEC-010 | SUSPENDED tenant cannot allocate | PASS |

## Residual

Account-scoped R2 credentials could target Production bucket if `R2_BUCKET_NAME` were mis-set. Preview Vercel must use Preview-only bucket name and eventually bucket-scoped keys.
