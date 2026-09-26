# SECURITY-VALIDATION — PI-10D

| ID | Check | Result |
|----|-------|--------|
| SEC-PI10D-001 | Tenant A ≠ Tenant B entitlement | PASS |
| SEC-PI10D-002 | Entitlement true ≠ RBAC bypass | PASS |
| SEC-PI10D-003 | Frontend not authority | PASS |
| SEC-PI10D-004 | Client cannot inject entitlement value | PASS |
| SEC-PI10D-005 | No active plan → DENY | PASS |
| SEC-PI10D-006 | Invalid → DENY | PASS |
| SEC-PI10D-007 | Device Bearer does not grant entitlement | PASS |
| SEC-PI10D-008 | JWT not entitlement source | PASS |
