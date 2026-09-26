# USAGE-DOMAIN — PI-10F

Metrics: `devices.count`, `contents.count`, `playlists.count`, `experiences.count`, `storage.bytes`  
Units: COUNT | BYTES  
Sources: DERIVED_RESOURCE | DERIVED_STORAGE (| EVENT | COUNTER reserved)

DTO `UsageSnapshot`: tenantId, metric, value, unit, source, resolvedAt (+ optional deviceCountMode note).
