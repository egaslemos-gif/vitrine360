# RESOURCE-COUNT-SEMANTICS — PI-10E (updated)

| Resource | Filter | Status |
|----------|--------|--------|
| Devices | `tenant_id IS NOT NULL AND status != 'DISABLED'` | **DECIDED** (PAIRED_NON_DISABLED) |
| Contents | All tenant rows or status=ACTIVE | Optional later |
| Playlists | All or ACTIVE | Low priority |
| Experiences | `contents.type = EXPERIENCE` | Durable; package store not authority |
| Media | Count of `media_assets` rows | Align with storage logical model |

Soft delete: devices/media are **hard delete** today — Usage decreases on delete commit. DISABLED frees device quota without delete.
