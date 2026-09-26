# PLATFORM-IDENTITY-07 — Minimal Platform Console

**Date:** 2026-09-23  
**Status:** Implementation complete  
**Depends on:** PI-04…PI-06B VALIDATED  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-007.md`

---

## What shipped

Read-only **Platform Console** for tenant metadata observability.

| Route | Behaviour |
|-------|-----------|
| `/platform` | Server gate → redirect `/platform/tenants` |
| `/platform/tenants` | List via `GET /api/platform/tenants` |
| `/platform/tenants/[tenantId]` | Detail via `GET /api/platform/tenants/[tenantId]` |

### Authorization (server)

`requirePlatformPage("platform.tenants.read")`:

1. Session required → else `/admin/login`  
2. Flag OFF → `PlatformDisabled`  
3. No platform permission → `PlatformAccessDenied` (SUPER_ADMIN workspace insufficient)  
4. Allow → render client that calls hardened APIs with cookies  

### UI

- Distinct platform shell (≠ tenant admin sidebar)  
- Loading / empty / error / unauthorized / disabled states  
- Cursor pagination (“Carregar mais”)  
- Design system: PageHeader, StatusBadge, EmptyState, MetadataRow, tokens  

### Explicitly not shipped

Create/edit/delete/suspend · memberships · billing · support · impersonation · new permissions · JWT changes  

Production flag remains **OFF** by default.
