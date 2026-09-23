# Domain Model

## Entities (MVP)

| Entity | Purpose |
|--------|---------|
| **User** | Admin console identity + role |
| **Device** | Playback endpoint (Android TV Box first) |
| **DeviceGroup** | Bulk assignment unit |
| **Content** | Logical display unit (IMAGE, VIDEO, TEXT, …) |
| **MediaAsset** | Binary/file metadata (storage-agnostic) |
| **Playlist** | Ordered sequence of contents |
| **PlaylistItem** | Content in playlist + position/duration |
| **Schedule** | Time windows + priority for playlist/content |
| **DeviceAssignment** | Device ↔ playlist (or via group) |
| **ActivityLog** | Audit trail |
| **SystemSetting** | Operational knobs (heartbeat window, max upload, …) |

## Multi-tenant readiness

MVP is single-organization. Schema reserves nullable `tenant_id` / `workspace_id` on org-scoped tables without implementing multi-tenant isolation yet.

## Content types

`IMAGE | VIDEO | TEXT | NOTICE | EVENT | NEWS | QR_CODE | CLOCK`

Payload specifics live in typed JSON `payload` on `Content` (validated by Zod per type).

## Device statuses (persisted)

`PENDING | ACTIVE | OFFLINE | DISABLED`

Runtime derived presence: `ONLINE | OFFLINE` from `last_seen_at` vs configurable heartbeat window (default 90s).

## Roles (RBAC)

`SUPER_ADMIN | ADMIN | EDITOR | OPERATOR | VIEWER`

Permissions: `manage_users`, `manage_devices`, `manage_contents`, `manage_playlists`, `manage_schedules`, `view_logs`, `view_dashboard`.

## Schedule priority

`NORMAL | HIGH | EMERGENCY` — EMERGENCY may interrupt current playlist.

## Versioning

- `playlist.version` increments on structural change  
- `manifest_version` per device (or global config revision) for player polling  
- `content.version` increments on content/payload/asset change  

Player asks “is there a newer version?” before downloading assets.
