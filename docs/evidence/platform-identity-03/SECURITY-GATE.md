# PLATFORM-IDENTITY-03 — Security Gate

Must be **PASS** before `PLATFORM_IDENTITY_ENABLED=true` in any shared environment.

## A. Current baseline (pre-platform)

| ID | Check | Expected |
|----|-------|----------|
| B1 | JWT `role` forged → still bound to ACTIVE membership role | PASS today |
| B2 | Cross-tenant content IDOR | Denied |
| B3 | Device bearer ≠ admin session | Isolated |
| B4 | SUPER_ADMIN cannot list other tenants’ data via admin APIs | Tenant-scoped |
| B5 | Non-ACTIVE membership cannot session | Denied |

## B. Platform introduction (required before flag on)

| ID | Check | Fail condition |
|----|-------|----------------|
| S1 | Platform API without platform assignment | Must 401/403 |
| S2 | Tenant SUPER_ADMIN → platform API | Must 403 |
| S3 | Platform SUPER_ADMIN → tenant content API without membership/Support Session | Must 403 |
| S4 | JWT claim `hasPlatformAccess=true` forged without DB row | Must not authorize |
| S5 | Suspended platform assignment | Must deny |
| S6 | Feature flag off | Identical to pre-PI behaviour |
| S7 | Support Session expiry | Access revoked |
| S8 | Audit log for platform mutations | Present |
| S9 | Device experience admit cannot mint platform session | Isolated |
| S10 | Seed/bootstrap of first platform admin is ops-gated | Not via workspace UI |

## C. Residual risks to close or accept (documented)

| ID | Risk | Gate action |
|----|------|-------------|
| R1 | `tenants.status` unused | Fix or accept with ticket before PI-06 tenant lifecycle |
| R2 | Dev seed passwords | Forbid in prod; rotate if ever applied |
| R3 | `/x/` unauthenticated serve | Keep deny-by-default Experience security; review before public packages |
| R4 | Login home tenant vs memberships | Prefer membership-aware login in PI-05 |

## D. SECURITY BLOCKER status (PI-03)

**No critical authz bypass** blocking the plan.  
Do not silently patch R1–R4 in this documentation phase.

## E. Sign-off template

```text
Environment: ________
Flag: OFF / ON
Suite: test:security + IDOR + PI gate scripts
Result: PASS / FAIL
Blockers: ________
Signer: ________  Date: ________
```
