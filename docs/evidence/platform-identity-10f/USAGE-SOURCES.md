# USAGE-SOURCES — PI-10F

| Metric | Source | Authority |
|--------|--------|-----------|
| devices.count | DERIVED_RESOURCE | `devices` (mode provisional) |
| contents.count | DERIVED_RESOURCE | `contents` |
| playlists.count | DERIVED_RESOURCE | `playlists` |
| experiences.count | DERIVED_RESOURCE | `contents` type=EXPERIENCE |
| storage.bytes | DERIVED_STORAGE | `SUM(media_assets.file_size)` |

EVENT / COUNTER sources are extensibility stubs — not implemented.
Client-supplied usage values are ignored / never accepted as authority.
