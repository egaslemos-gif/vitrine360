# PLATFORM-IDENTITY-10D TEST RESULTS

| Test | Result | Detail |
|------|--------|--------|
| PI10D-ENFORCEMENT-09 | PASS | flag OFF default |
| PI10D-ENFORCEMENT-09b | PASS | flag OFF → legacy ALLOW without plan |
| PI10D-DEVICE-A | PASS | flag OFF + valid path → pair works |
| PI10D-ENFORCEMENT-10 | PASS | flag ON |
| PI10D-ENFORCEMENT-01 | PASS | devices.enabled=true → ALLOW |
| PI10D-ENFORCEMENT-02 | PASS | devices.enabled=false → DENY |
| PI10D-ENFORCEMENT-03 | PASS | entitlement missing → DENY |
| PI10D-ENFORCEMENT-04 | PASS | no active plan → DENY |
| PI10D-ENFORCEMENT-05 | PASS | invalid entitlement → DENY |
| PI10D-ENFORCEMENT-06 | PASS | tenant A true / tenant B false |
| PI10D-ENFORCEMENT-07 | PASS | tenant isolation |
| PI10D-ENFORCEMENT-08 | PASS | deterministic result |
| PI10D-ENFORCEMENT-11 | PASS | no DB mutation |
| PI10D-ENFORCEMENT-12 | PASS | no JWT dependency |
| PI10D-ENFORCEMENT-13 | PASS | no Device Bearer dependency |
| PI10D-ENFORCEMENT-14 | PASS | no Usage dependency |
| PI10D-ENFORCEMENT-15 | PASS | no Billing dependency |
| PI10D-DEVICE-B | PASS | flag ON + devices.enabled=true → pair works |
| PI10D-DEVICE-C | PASS | flag ON + devices.enabled=false → denied |
| PI10D-DEVICE-D | PASS | flag ON + no active plan → denied |
| PI10D-DEVICE-E | PASS | flag ON + invalid entitlement → denied |
| PI10D-DEVICE-F | PASS | Tenant A/B isolation on pair path |
| PI10D-ERROR-01 | PASS | HTTP 403 ENTITLEMENT_DENIED contract |
| SEC-PI10D-001 | PASS | Tenant A não utiliza entitlement de B |
| SEC-PI10D-002 | PASS | entitlement true ≠ RBAC bypass (VIEWER lacks manage_devices) |
| SEC-PI10D-003 | PASS | frontend não é autoridade (service gate) |
| SEC-PI10D-004 | PASS | client cannot send devices.enabled=true (DB is source of truth) |
| SEC-PI10D-005 | PASS | No active plan não resulta em ALLOW |
| SEC-PI10D-006 | PASS | Invalid entitlement não resulta em ALLOW |
| SEC-PI10D-007 | PASS | Device Bearer não concede entitlement |
| SEC-PI10D-008 | PASS | JWT não é fonte de entitlement |
| PI10D-COMPAT-01 | PASS | compatibility plan devices.enabled=true → ALLOW |
| PI10D-ENFORCEMENT-16 | PASS | pure feature gate DENY |
| PI10D-SCOPE-01 | PASS | enforcement não ligado a Media/Experience/Player |

Generated: 2026-09-29T22:07:46.551Z

ENTITLEMENTS_ENABLED default OFF — activation requires explicit ops authorization.
