# PLATFORM-IDENTITY-04 — SECURITY TESTS

Suite: `npm run test:platform-identity-04`

| ID | Intent | Expected |
|----|--------|----------|
| SEC-PI04-001 | Flag not overridden by request-derived values | PASS |
| SEC-PI04-002 | No `/api/platform`; cannot self-create via API | PASS |
| SEC-PI04-003 | Tenant SUPER_ADMIN cannot self-promote via role name | PASS |
| SEC-PI04-004 | `tenantId` rejected on create | PASS |
| SEC-PI04-005 | Platform assignment ≠ automatic tenant access | PASS |
| SEC-PI04-006 | Tenant membership ≠ Platform access | PASS |
| SEC-PI04-007 | Device Bearer path cannot create Platform identity | PASS |
| SEC-PI04-008 | Experience admit cannot access Platform identity | PASS |
| SEC-PI04-009 | JWT shape unchanged (no platform* claims) | PASS |
| SEC-PI04-010 | Disabled flag blocks create | PASS |

Results recorded by the suite runner and REGRESSION.md.
