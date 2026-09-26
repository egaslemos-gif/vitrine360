# SECURITY-INVARIANTS — PI-10C

| ID | Invariant | Evidence |
|----|-----------|----------|
| INV-01 | Same tenant + same DB state → same entitlements fingerprint | PI10C-INV-01 |
| INV-02 | Tenant A never receives Tenant B plan values | PI10C-INV-02 / RESOLVER-13 |
| INV-03 | Membership role does not alter resolution | Resolver has no user/role input |
| INV-04 | Tenant lifecycle does not alter plan values | PI10C-INV-04 (SUSPENDED still RESOLVED) |
| INV-05 | Device Bearer not consulted | Source scan |
| INV-06 | JWT not source of truth | Source scan |
| INV-07 | Usage not calculated | Source scan |
| INV-08 | Billing not consulted | Source scan |
| INV-09 | No active plan → explicit status | PI10C-INV-09 |
| INV-10 | Compatibility plan has no special privileges | PI10C-INV-10 |

Diagnostics never include secrets, tokens, cookies, or Device Bearer material.
