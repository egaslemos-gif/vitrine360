# USAGE-SEMANTICS — PI-10H

## Four byte categories

| Category | Definition | Who calculates | Where | Authoritative for quota? | Persistent today? |
|---|---|---|---|---|---|
| **RESERVED_BYTES** | Bytes held for in-flight upload ops | Future reservation service | Future DB | Yes (with committed) | **No** (not implemented) |
| **COMMITTED_BYTES** | `SUM(media_assets.file_size)` for tenant | `getTenantStorageUsage` | DB | **Yes** (DEC-STORAGE-01) | Yes (derived) |
| **ACTIVE_BYTES** | Same as committed for V1 (all rows usable) | Same | DB | Same as committed | Yes |
| **PHYSICAL_BYTES** | Bytes in object storage | Provider/list/reconcile | R2/local/Drive | **No** for quota; yes for GC | External |

## V1 quota formula (future enforcement)

```
effective_usage = COMMITTED_BYTES + RESERVED_BYTES
ALLOW iff effective_usage + request_bytes <= storage.maxBytes
```

## ACTIVE vs COMMITTED

Today every committed row is “active” (no soft-deleted media status). Orphan/unreferenced assets **still count** (they occupy storage). References from Content/Playlist do **not** multiply usage.

## Not equal

- Client `fileSize` ≠ measured bytes until complete validates HEAD
- R2 object ≠ MediaAsset row
- Multiple contents sharing one asset ≠ multiple counts
