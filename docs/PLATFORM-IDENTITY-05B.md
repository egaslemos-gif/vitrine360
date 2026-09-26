# PLATFORM-IDENTITY-05B — Authorization Service Implementation

**Date:** 2026-09-23  
**Status:** Implementation complete — see evidence for gate verdict  
**Depends on:** PI-04 VALIDATED · PI-05A ARCHITECTURE VALIDATED  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-005B.md`

---

## Delivered

| Piece | Location |
|-------|----------|
| Platform permission catalogue | `src/domain/platform-identity.ts` — `platform.tenants.read` |
| Dual-axis AuthContext | `src/lib/platform-authz.ts` — `buildAuthContext` / `getAuthContext` |
| Platform guard | `requirePlatformPermission` / `assertPlatformPermission` |
| API stub | `GET /api/platform/tenants` (metadata only; flag OFF → 404) |
| Tenant metadata helper | `listTenantsMetadata` in `src/services/tenants.ts` |
| Tests | `npm run test:platform-identity-05b` |

## Invariants preserved

- `getSession()` / JWT claims **unchanged**
- Tenant `PERMISSIONS` / `ROLE_PERMISSIONS` **unchanged** (no `platform.*`)
- Flag default OFF; empty platform axis when OFF
- `SUPER_ADMIN` membership ≠ platform permission
- Platform ACTIVE ≠ tenant content access
- Device Bearer / Experience admit not coupled

## Non-goals (still deferred)

Platform UI (PI-06), Support Session (PI-07), Entitlements/Billing (PI-08/09), JWT platform hints.
