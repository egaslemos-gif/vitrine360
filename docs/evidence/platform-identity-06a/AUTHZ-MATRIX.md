# PLATFORM-IDENTITY-06A — Authorization Matrix

| Actor | Flag | Platform assignment | Expected GET `/api/platform/tenants` |
|-------|------|---------------------|-------------------------------------|
| Anonymous | any | — | 401 |
| Tenant VIEWER | ON | none | 403 |
| Tenant ADMIN | ON | none | 403 |
| Tenant SUPER_ADMIN | ON | none | 403 |
| User with ACTIVE PLATFORM_SUPER_ADMIN | OFF | ACTIVE | 404 |
| User with ACTIVE PLATFORM_SUPER_ADMIN | ON | ACTIVE | 200 metadata |
| User with REVOKED platform role | ON | REVOKED | 403 |
| Device Bearer | ON | — | 401 (no session cookie) |
| Experience admit path | — | — | N/A (no call) |

## Axis separation

| Gate | Used by platform tenants GET? |
|------|-------------------------------|
| `requireSession` (tenant) | **No** |
| `requirePlatformPermission` | **Yes** |
| Membership SUPER_ADMIN | **Insufficient alone** |
