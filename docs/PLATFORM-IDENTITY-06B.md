# PLATFORM-IDENTITY-06B — Platform Tenants API Hardening

**Date:** 2026-09-23  
**Status:** Implementation complete  
**Depends on:** PI-06A AUDIT VALIDATED  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-006A.md` (gate) · `docs/adr/ADR-PLATFORM-IDENTITY-006B.md`

---

## Contract (READ-ONLY metadata)

### `GET /api/platform/tenants`

| Query | Rules |
|-------|-------|
| `limit` | optional int 1…100; default **20** |
| `cursor` | optional opaque base64url; invalid → 400 |
| other keys | **400** |

**Auth:** flag ON + `platform.tenants.read`  
**Rate limit:** 60 req / 60s / IP (`platform-tenants`)  
**Flag OFF:** 404  

```json
{
  "tenants": [{ "id", "name", "slug", "status", "createdAt" }],
  "page": { "limit", "nextCursor", "hasMore" }
}
```

### `GET /api/platform/tenants/[tenantId]`

Same auth/flag/rate limit. Response: `{ "tenant": { …allowlist } }` or 404.

---

## Hardening delivered

- Pagination + max page size  
- Query allowlist / validation  
- Explicit serializers  
- Request-scoped cookie auth (`requirePlatformPermission(perm, req)`)  
- Rate limiting  
- Activity log on successful list/read  
- Platform-scoped service `src/services/platform-tenants.ts`  
- HTTP handler tests with session cookies  

## Still forbidden

UI · manage/create/update/delete/suspend · Billing · Support · new permissions/roles · JWT changes
