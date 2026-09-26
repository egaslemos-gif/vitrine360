# PLATFORM-IDENTITY-05A — Security Invariants

Hard fail if any are violated in PI-05B:

| ID | Invariant |
|----|-----------|
| INV-1 | JWT is not the authority source for platform or tenant |
| INV-2 | Flag OFF ⇒ platform axis empty; tenant ≡ pre-PI-05 |
| INV-3 | SUPER_ADMIN membership ⇏ platform permission |
| INV-4 | Platform ACTIVE assignment ⇏ tenant content access |
| INV-5 | SUSPENDED/REVOKED ⇏ platform permission |
| INV-6 | Device Bearer ⇏ platform authz |
| INV-7 | Experience / `/x/` ⇏ platform authz |
| INV-8 | No auto-promotion membership → platform |
| INV-9 | `platform.*` never added to tenant `ROLE_PERMISSIONS` |
| INV-10 | No platform claims added to JWT in PI-05 |

## Recommended PI-05B test IDs (preview)

- PI05-001 flag OFF empty platform axis  
- PI05-002 flag ON without assignment → deny platform  
- PI05-003 ACTIVE PLATFORM_SUPER_ADMIN → `platform.tenants.read`  
- PI05-004 tenant SUPER_ADMIN alone → deny platform  
- PI05-005 platform alone → deny tenant content IDOR  
- PI05-006 revoked/suspended → deny  
- PI05-007 JWT role forgery ineffective  
- PI05-008 getSession unchanged shape  
- SEC-PI05-001… Device / Experience isolation  
