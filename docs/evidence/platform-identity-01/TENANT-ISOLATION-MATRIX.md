# PLATFORM-IDENTITY-01 — Tenant Isolation Matrix

**Date:** 2026-09-23  
**Evidence base:** `src/db/schema.ts`, admin services, device auth, `scripts/test-tenant-isolation.ts`

## Legend

- **tenantId column:** resource row stores owning workspace id  
- **Guard:** server path that enforces tenant before mutate/read  
- **Cross-tenant safe:** foreign id from another tenant must not succeed when caller is scoped to tenant A

| Domain | tenantId | Guard | Cross-tenant safe | Notes |
|--------|----------|-------|-------------------|-------|
| Tenants / Workspaces | N/A (is the tenant) | Session membership for active only | N/A | No global tenant catalogue for admins |
| Memberships | Yes | `listWorkspaceMembers(session.activeTenantId)` | Yes (scoped list) | Unique `(userId, tenantId)` |
| Users | `users.tenantId` **legacy home** | Auth via membership, not home column | Partial | Email unique per **home** tenant; multi-workspace via memberships on same `users.id` |
| UserIdentities | Via `userId` | Google link to user | N/A | No tenant column |
| Devices | Nullable until paired; set on pair | Services filter `eq(devices.tenantId, tenantId)`; device Bearer auth | Yes (admin + media) | Pre-pair devices have `tenantId = null` |
| Device groups | Yes | Admin APIs + services with session tenant | Yes | |
| Media assets | Yes | `getMediaAsset(id, tenantId)`; `/api/media` checks session/device tenant | Yes | Storage key lookup + tenant filter |
| Contents | Yes | `getContent(id, tenantId)` | Yes | Covered by tenant isolation test |
| Content assets | Via content | Through content tenant | Yes | |
| Playlists | Yes | Services + attach checks content tenant | Yes | Isolation test blocks foreign content attach |
| Playlist items | Via playlist | Through playlist | Yes | |
| Schedules | Yes | Services with tenant | Yes | |
| Schedule targets | Via schedule | Through schedule | Yes | |
| Activity logs | Nullable column | Admin page filters `eq(activityLogs.tenantId, session.tenantId)` | Mostly | `logActivity` allows null tenantId |
| Experience packages (in-memory store) | Key prefix `tenantId::…` | `getStoredExperiencePackage(tenantId,…)` | Yes if callers pass session tenant | No Drizzle table yet |
| Experience origin (`proxy.ts`) | Host-based | Origin host only serves `/x/*` | Origin isolation, not membership | Platform host ≠ Experience origin |
| `system_settings` | **None** (global KV) | **Unused** in application code | N/A | Future platform domain candidate |
| Device runtime APIs | Device’s `tenantId` | Bearer token → device row | Yes | Separate from admin session |

## Automated evidence

`npm run test:tenant` → `scripts/test-tenant-isolation.ts`:

- Tenant A cannot list Tenant B contents/devices  
- Cannot attach Tenant B content into Tenant A playlist  
- Same email allowed under different **home** tenants (legacy user rows)

## Residual risks (document only — not fixed here)

1. **Legacy `users.role` / `users.tenantId`** — mirrors; must not be used as authorization authority (session already revalidates membership).  
2. **`activity_logs.tenantId` nullable** — platform-style events could be logged without tenant; no platform audit separation yet.  
3. **`listStoredExperiencePackages()`** returns all in-process packages without tenant filter — safe only if never exposed via unscoped API.  
4. **JWT carries `role`** — context only; if a future code path trusted JWT role without `getSession` revalidation, that would be a bug. Current `getSession` reloads membership role.
