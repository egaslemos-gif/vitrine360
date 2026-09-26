# PLATFORM-IDENTITY-05B — Security Tests

Suite: `npm run test:platform-identity-05b`

| ID | Result |
|----|--------|
| PI05-001 / 001b flag OFF empty platform | PASS |
| PI05-002 flag ON no assignment deny | PASS |
| PI05-003 ACTIVE platform grant | PASS |
| PI05-004 SUPER_ADMIN ≠ platform | PASS |
| PI05-005 platform ≠ tenant B content | PASS |
| PI05-006 / b / c revoke suspend reactivate | PASS |
| PI05-007 JWT no platform claims | PASS |
| PI05-008 session shape unchanged | PASS |
| PI05-009 catalogue isolation | PASS |
| PI05-010 API stub surface | PASS |
| PI05-011 deny-by-default helper | PASS |
| SEC-PI05-001 SUPER_ADMIN → 403 | PASS |
| SEC-PI05-002 flag OFF API 404 | PASS |
| SEC-PI05-003 Device isolation | PASS |
| SEC-PI05-004 Experience isolation | PASS |
| SEC-PI05-005 auth.ts untouched | PASS |
| SEC-PI05-006 tenant ADMIN ≠ platform | PASS |
