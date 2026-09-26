# PLATFORM-IDENTITY-09 — Security Gate

## Implementation gate (from PI-08 §9.2)

| ID | Check | Result |
|----|-------|--------|
| TL-I1 | Suspended tenant: session for that tenant fails | **PASS** |
| TL-I2 | Suspended tenant: Device Bearer denied | **PASS** |
| TL-I3 | Experience serve checks operable (404) | **PASS** |
| TL-I4 | Platform read still returns SUSPENDED | **PASS** |
| TL-I5 | Tenant SUPER_ADMIN cannot call suspend API | **PASS** |
| TL-I6 | Idempotent suspend/reactivate | **PASS** |
| TL-I7 | Audit rows present | **PASS** |
| TL-I8 | Flag OFF → lifecycle API 404 | **PASS** |
| TL-I9 | No hard delete API | **PASS** |
| TL-I10 | JWT has no tenant status claims | **PASS** |

Additional: TL-I0 domain, TL-I-HTTP suspend 200, restore after reactivate.

## Sign-off

```text
PI-09 Implementation: VALIDATED
Mutations: suspend + reactivate only
Hard delete: ABSENT
R1 status: CLOSED (enforced)
Flag default: OFF
```
