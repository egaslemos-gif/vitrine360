# STORAGE-USAGE — PI-10F

`getTenantStorageUsage(tenantId)` → `SUM(file_size)` where `tenant_id = ?`.  
NULL/empty → 0; negative/NaN coerced to 0.  
No R2 HEAD/list for authority. No upload flow changes. No reservation.
