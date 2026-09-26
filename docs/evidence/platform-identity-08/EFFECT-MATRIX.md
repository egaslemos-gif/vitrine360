# PLATFORM-IDENTITY-08 — Effect Matrix

Target behaviour after PI-09 enforcement (not current runtime).

| Surface | ACTIVE | SUSPENDED |
|---------|--------|-----------|
| Platform tenants.read | Yes | Yes |
| getSession (that tenant) | Yes* | No |
| /api/admin/** | Yes* | No |
| Device Bearer | Yes† | No |
| Manifest / sync / heartbeat | Yes† | No |
| Experience admit | Yes† | No |
| /x/* serve | Yes | No (prefer 404) |
| Media tenant routes | Yes | No |
| Membership rows | Kept | Kept |
| Object storage bytes | Kept | Kept (access blocked) |

\*Requires ACTIVE membership.  
†Requires ACTIVE device where applicable.
