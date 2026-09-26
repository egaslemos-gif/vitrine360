# ADR-PLATFORM-IDENTITY-007 — Minimal Platform Console

**Status:** Accepted  
**Date:** 2026-09-23  
**Phase:** PLATFORM-IDENTITY-07

## Context

Hardened platform tenant APIs exist. Operators need a Control Plane UI that is not the tenant admin console and does not treat `SUPER_ADMIN` as platform authority.

## Decision

1. Add `/platform/**` route group with its own shell.  
2. Gate every page with `requirePlatformPage("platform.tenants.read")` (server).  
3. Load data only through existing `GET /api/platform/tenants` APIs (client fetch + cookies).  
4. Keep admin nav tenant-scoped; link back to `/admin` from platform shell.  
5. Remain read-only; no manage/suspend/UI mutations.

## Consequences

- Flag OFF or missing assignment → no console content.  
- Workspace SUPER_ADMIN without platform assignment sees Access Denied.  
- Further platform features (support, billing) require later phases.
