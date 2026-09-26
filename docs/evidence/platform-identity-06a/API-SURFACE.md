# PLATFORM-IDENTITY-06A — API Surface Inventory

| Method | Path | Auth | Flag OFF | Body / query | Exists |
|--------|------|------|----------|--------------|--------|
| GET | `/api/platform/tenants` | `platform.tenants.read` | 404 | none | **Yes** |
| GET | `/api/platform/tenants/[id]` | — | — | — | **No** |
| POST | `/api/platform/tenants` | — | — | — | **No** |
| PATCH | `/api/platform/tenants/[id]` | — | — | — | **No** |
| DELETE | `/api/platform/tenants/[id]` | — | — | — | **No** |

## Response allowlist (GET list)

`id`, `name`, `slug`, `status`, `createdAt`

## Forbidden under `platform.tenants.read`

Any nested or sibling payload carrying: devices, playlists, contents, media URLs/tokens, experience packages, member password hashes, device bearer secrets.
