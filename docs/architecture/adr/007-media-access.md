# Media access & storage decisions (pilot)

## Current storage

| Layer | Implementation | Status |
|-------|----------------|--------|
| Provider interface | `MediaStorageProvider` | Done |
| Local filesystem | `LocalFsProvider` under `MEDIA_LOCAL_DIR` | **Current for pilot** |
| Google Drive | `GoogleDriveProvider` | **Stub only** — throws until credentials |

Pilot and Android TV validation use **LocalFs**. Drive does not block Player validation.

## Current media access

```text
Admin session  ─┐
                ├─→ GET /api/media/<tenantId>/<file>  → file bytes
Device Bearer  ─┘     (tenant ownership required)
```

Player downloads with `Authorization: Bearer <deviceToken>`, then caches blobs in IndexedDB. Offline playback does not re-hit the API.

## Signed URL evolution (decision)

Proposed future path:

```text
Player → authorized API → temporary signed URL → storage
```

**Pilot decision:** keep session/Bearer media GET.

Reasons:

1. LocalFs has no native signed-URL semantics without inventing HMAC tokens.
2. Player already caches assets; HTML media elements use blob URLs after sync.
3. Unauthenticated public media was removed in the security audit.
4. Migrating storage (S3/R2/Drive) later can introduce signed URLs without changing Passive Runtime pairing.

**When to revisit:** multi-CDN delivery, browser clients that cannot attach Bearer on media requests, or Drive/S3 production cutover.

## Production storage (future)

Prefer object storage with signed GET (S3-compatible / R2 / Drive with short-lived links). Keep `MediaStorageProvider` as the only business dependency.
