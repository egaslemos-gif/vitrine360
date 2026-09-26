# SECURITY-RESULTS — PI-10G

| ID | Scenario | Result |
|---|---|---|
| PI10G-SEC-001 | Tenant isolation A deny / B allow | PASS |
| PI10G-SEC-002 | Client cannot override usage | PASS (server-derived) |
| PI10G-SEC-003 | Client cannot override max | PASS (plan-bound) |
| PI10G-SEC-004 | Cross-tenant plan isolation | Covered by SEC-001 |
| PI10G-SEC-005 | Device Bearer bypass | N/A at pair path (admin session); no device-bearer allocate |
| PI10G-SEC-006 | RBAC authoritative | Preserved at API (`manage_devices`); quota → 403 not 401 |
| PI10G-SEC-007 | Suspended tenant | PASS (`isTenantOperable` false) |
| PI10G-SEC-008 | DISABLED does not consume | PASS |
| PI10G-SEC-009 | OFFLINE still consumes | PASS |
| PI10G-SEC-010 | Delete under overage ALLOW | PASS |
| PI10G-SEC-011 | Disable under overage ALLOW | PASS |
| PI10G-SEC-012 | No bypass route | PASS (service boundary scan) |
