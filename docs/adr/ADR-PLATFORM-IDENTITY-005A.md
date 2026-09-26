# ADR-PLATFORM-IDENTITY-005A — Platform Authorization Service Design

**Status:** Accepted (architecture)  
**Date:** 2026-09-23  
**Phase:** PLATFORM-IDENTITY-05A  
**Follow-on:** PI-05B implementation (not this ADR)

## Context

PI-04 delivered `platform_assignments` and a feature flag, but authorization still resolves **tenant membership only** via `getSession()` / `requireSession()`. Platform rows do not grant authority. PI-02/PI-03 require dual-axis, deny-by-default, JWT-as-context.

## Decision

1. Introduce **`getAuthContext()`** alongside unchanged **`getSession()`** (prefer compatibility path A).  
2. Resolve platform authority only when `PLATFORM_IDENTITY_ENABLED` and ACTIVE `platform_assignments` exist.  
3. Keep JWT claim set unchanged in PI-05 — no platform roles/permissions in tokens.  
4. Ship a **minimal** static platform permission catalogue starting with `platform.tenants.read` for `PLATFORM_SUPER_ADMIN`.  
5. Do **not** mix `platform.*` into tenant `ROLE_PERMISSIONS`.  
6. Platform grant ≠ tenant resource access; tenant `SUPER_ADMIN` ≠ platform.  
7. Defer UI, Support Session, Billing, Entitlements.

## Consequences

- PI-05B can wire guards without breaking existing admin routes.  
- Flag OFF remains observationally equivalent for tenant paths.  
- First platform API (if any) is read-only tenant metadata behind platform permission.

## Compliance

Control Plane only. Not Device Runtime, Experience iframe, Manifest, Playback, or Business-plane entitlements.
