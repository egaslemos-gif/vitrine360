# ADR-PLATFORM-IDENTITY-005B — Platform Authorization Service Implementation

**Status:** Accepted  
**Date:** 2026-09-23  
**Phase:** PLATFORM-IDENTITY-05B  
**Supersedes (implements):** ADR-PLATFORM-IDENTITY-005A design

## Context

PI-04 stored platform assignments without authz. PI-05A specified dual-axis `getAuthContext`, thin JWT, and minimal `platform.tenants.read`.

## Decision

1. Implement catalogue + `PLATFORM_ROLE_PERMISSIONS` in `domain/platform-identity.ts`.  
2. Implement `src/lib/platform-authz.ts` without modifying `getSession()` or JWT.  
3. Gate platform API stub with flag + `requirePlatformPermission`.  
4. Flag OFF ⇒ `resolvePlatformAuthz` returns null; stub returns 404.  
5. Do not inject platform keys into tenant RBAC.

## Consequences

- Existing admin/tenant routes unchanged.  
- Platform operators need explicit ACTIVE assignment + flag ON.  
- UI and Support Session remain future phases.
