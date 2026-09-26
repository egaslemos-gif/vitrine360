# PLATFORM-IDENTITY-05B — Evidence Checklist

## Acceptance

- [x] `PLATFORM_PERMISSIONS` + role map (minimal `platform.tenants.read`)
- [x] `buildAuthContext` / `getAuthContext` dual resolve
- [x] `requirePlatformPermission` / `assertPlatformPermission`
- [x] Flag OFF → platform axis null / deny
- [x] Flag ON without assignment → deny
- [x] ACTIVE `PLATFORM_SUPER_ADMIN` → grant `platform.tenants.read`
- [x] Tenant SUPER_ADMIN alone → deny platform
- [x] Platform grant ≠ cross-tenant content
- [x] REVOKED / SUSPENDED → deny
- [x] JWT unchanged (no platform claims)
- [x] `getSession` / `auth.ts` not wired to platform catalogue
- [x] `GET /api/platform/tenants` stub (flag + permission; metadata only)
- [x] No Platform UI / Billing / Entitlements / Support Session
- [x] `test:platform-identity-05b` PASS
- [x] `test:platform-identity-04` PASS (SEC-002 updated for GET-only stub)
- [x] typecheck / rbac / tenant / security / build PASS

## Production

Flag remains default OFF. Production enable not performed in this phase.
