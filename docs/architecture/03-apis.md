# API Design

Two surfaces. Device tokens never grant admin routes.

## Admin API (`/api/admin/*`)

Auth: session cookie (admin users). Server-side RBAC.

| Area | Examples |
|------|----------|
| Devices | `GET/POST /devices`, `POST /devices/pair`, `PATCH /devices/:id`, disable |
| Contents | CRUD `/contents`, type-specific validation |
| Media | `POST /media/upload`, `GET /media`, delete |
| Playlists | CRUD, reorder items, duplicate, preview data |
| Schedules | CRUD `/schedules` |
| Groups | CRUD `/device-groups`, members |
| Dashboard | `GET /dashboard/stats` |
| Logs | `GET /activity-logs` |
| Settings | `GET/PATCH /settings` |
| Users | `GET/POST /users` (SUPER_ADMIN/ADMIN) |

## Device API (`/api/device/*`)

Auth: `Authorization: Bearer <device_token>` (except bootstrap pairing).

| Endpoint | Purpose |
|----------|---------|
| `POST /bootstrap` | Exchange activation / first register → token |
| `POST /pair/start` | Player generates activation code (PENDING) |
| `POST /heartbeat` | Presence + player telemetry |
| `GET /manifest` | Current manifest + version (authorized payload only) |
| `GET /sync` | Delta since `client_manifest_version` |
| `GET /config` | Device display/settings |

### Heartbeat body (example)

```json
{
  "deviceId": "...",
  "timestamp": "ISO",
  "playerVersion": "1.0.0",
  "playlistId": "...",
  "contentId": "...",
  "playerState": "PLAYING",
  "resolution": "1920x1080"
}
```

Backend updates `last_seen_at` and derives ONLINE if within heartbeat window.

### Manifest poll

Client sends `If-None-Match` / `?version=N`. Response `304` or full/delta sync package.

## Security notes

- Admin credentials never embed in Player  
- Uploads: size limit, MIME allowlist, server validation  
- Rate limit pairing + heartbeat  
- HTTPS in production (Vercel)
