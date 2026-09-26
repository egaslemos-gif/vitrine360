# PLATFORM-IDENTITY-05A — Implementation Preview (PI-05B)

Not executed in 05A.

| Step | Deliverable |
|------|-------------|
| B1 | `PLATFORM_PERMISSIONS` + role map (domain) |
| B2 | `resolvePlatformAuthz` / `getAuthContext` |
| B3 | `requirePlatformPermission` |
| B4 | Tests + security suite |
| B5 | Optional `GET /api/platform/tenants` (metadata only) |
| B6 | Evidence + ADR-005B |

## Rollback

1. Flag OFF.  
2. Redeploy previous if needed.  
3. Platform tables remain; unused by tenant path.

## Checklist before coding PI-05B

- [x] PI-04 VALIDATED  
- [x] 05A architecture accepted (this pack)  
- [ ] Explicit user go-ahead for PI-05B  
- [ ] No production flag ON by default  
