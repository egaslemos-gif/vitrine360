# PLATFORM-IDENTITY-05A — Current Authz Audit

**Date:** 2026-09-23  
**Nature:** Read-only against `src/`

## Session / JWT

| Item | Finding |
|------|---------|
| Cookie | `v360_session` |
| Claims | `sub`, `email`, `name`, `role`, `tenantId`, `activeTenantId` |
| Authority | Revalidated in `getSession()` from DB membership |
| Platform claims | **None** |
| Platform imports in `auth.ts` | **None** |

## Tenant gates

| Helper | File | Uses |
|--------|------|------|
| `getSession` | `lib/auth.ts` | Membership ACTIVE |
| `requireSession` | `lib/auth.ts` | + optional tenant `Permission` |
| `requireAdminPage` | `lib/admin-access.ts` | Page redirect / AccessDenied |
| `hasPermission` | `domain/types.ts` | Tenant catalogue only |

## Platform foundation (PI-04)

| Item | Finding |
|------|---------|
| Storage | `platform_assignments` |
| Repository | `services/platform-identity.ts` (flag-gated) |
| Wired into authz? | **No** |
| Flag default | OFF |

## Isolation surfaces

| Surface | Coupled to platform authz? |
|---------|----------------------------|
| Device Bearer | No |
| Experience admit / `/x/` | No |
| Tenant memberships | No |
| Seed admin | Tenant SUPER_ADMIN only |

## Conclusion

Safe to design dual-axis authz **additive** to existing tenant gates. Highest regression risk is mutating `getSession()` / JWT — avoid in PI-05B.
