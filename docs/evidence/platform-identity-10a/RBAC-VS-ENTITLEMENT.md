# PLATFORM-IDENTITY-10A — RBAC vs Entitlement Matrix

## Evaluation stack

Auth → **Lifecycle** → **RBAC** → **Entitlement** → Tenant scope

## Operation matrix (illustrative future)

| Operation | RBAC | Entitlement | Lifecycle |
|-----------|------|-------------|-----------|
| Create Device | `manage_devices` | `devices.max` vs usage | ACTIVE |
| Invite User | `manage_users` | `users.max` | ACTIVE |
| Upload Media | media permission | `media.storage.max` | ACTIVE |
| Create Playlist | playlist permission | `playlists.max` (opt.) | ACTIVE |
| Create Schedule | schedule permission | `schedules.enabled` / max | ACTIVE |
| Publish Experience | experience permission | `experiences.enabled` + max | ACTIVE |
| Live Media | live permission (fut.) | `live.enabled` | ACTIVE |
| List own Devices | read permission | — (permission-only) | ACTIVE |
| Platform list tenants | `platform.tenants.read` | — | N/A (platform) |
| Platform suspend tenant | `platform.tenants.suspend` | — | N/A |
| Heartbeat (Device) | Device Bearer | — Day-1; optional later | ACTIVE tenant |

## Classification

| Class | Examples |
|-------|----------|
| **Permission-only** | Read lists within quota already held; platform metadata read |
| **Entitlement-only** | Rare — prefer always bind to an actor permission |
| **Permission + entitlement** | Most creates (devices, media, experiences) |
| **Lifecycle-dependent** | All tenant session / device / experience serve paths (PI-09) |

**Never:** map `devices.max` into a Membership role.
