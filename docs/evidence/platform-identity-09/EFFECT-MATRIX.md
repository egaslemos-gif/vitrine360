# PLATFORM-IDENTITY-09 — Effect Matrix (as-built)

| Surface | ACTIVE | SUSPENDED |
|---------|--------|-----------|
| Platform tenants.read | Yes | Yes |
| getSession / sessionFromUser (that tenant) | Yes* | No |
| resolveTenantAuthz | Yes* | No |
| /api/admin/** (via session) | Yes* | No |
| Workspace switch to tenant | Yes* | No (403) |
| Device Bearer | Yes† | No |
| Manifest / sync / heartbeat / device media | Yes† | No |
| Experience admit | Yes† | No (via Bearer) |
| /x/* serve | Yes | No (404 `TENANT_NOT_OPERABLE`) |
| Media admin routes | Yes* | No (via session) |
| Membership rows | Kept | Kept |
| Device rows | Kept | Kept (not bulk DISABLED) |
| Object storage bytes | Kept | Kept (access blocked) |
| activity_logs | Keep | + suspend/reactivate audit |

\*Requires ACTIVE membership.  
†Requires ACTIVE device where applicable.
