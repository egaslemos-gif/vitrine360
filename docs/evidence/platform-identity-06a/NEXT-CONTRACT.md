# PLATFORM-IDENTITY-06A — PI-06B Contract Preview

Additive only. Still behind `PLATFORM_IDENTITY_ENABLED`.

1. Keep GET list; add optional pagination (`limit` ≤ 100, cursor).  
2. Add GET `/api/platform/tenants/[tenantId]` metadata (404 if missing).  
3. Add rate limit + optional activity log.  
4. Move/wrap `listTenantsMetadata` as platform-scoped service.  
5. HTTP tests: 401 / 403 / 404 flag OFF / 200 allowlist.  
6. **Do not** add manage/suspend/UI unless separately approved.

Rollback: flag OFF; redeploy.
