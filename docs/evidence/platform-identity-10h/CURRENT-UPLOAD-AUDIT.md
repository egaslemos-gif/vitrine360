# CURRENT-UPLOAD-AUDIT — PI-10H

Authoritative paths inspected: `src/services/contents.ts`, `src/services/media/*`, `src/app/api/admin/media/*`, `src/features/media/direct-upload.ts`, `src/services/usage.ts`, `src/db/schema.ts`.

## Dual upload paths

### Path A — Server Buffer (`uploadMediaAsset`)

1. `POST /api/admin/media` (or contents multipart) with file bytes
2. Reject if `byteLength > MAX_UPLOAD_BYTES` (default 50 MiB)
3. SHA-256 of buffer → `checksum = sha256:{hex}`
4. Lookup `(tenantId, checksum)` → reuse if readable; heal if stale
5. MIME sniff + allowlist
6. `storage.put` then `INSERT media_assets`
7. UNIQUE race → delete loser blob, return winner
8. Activity: `media.uploaded`

### Path B — Direct upload (production R2 UI)

1. Client `sha256Hex(file)` (`direct-upload.ts`)
2. `POST /api/admin/media/prepare` → `prepareMediaUpload`
   - Dedupe hit → `{ existing: true }` (no upload)
   - Else require `createUploadUrl` → signed PUT URL
   - **No DB insert at prepare**
3. Browser `PUT` whole file to signed URL
4. `POST /api/admin/media/complete` → `completeMediaUpload`
   - `headObject`; compare `contentLength` vs client `fileSize`
   - MIME sniff first 64 bytes via `getObjectRange`
   - Dedupe / heal / INSERT with **client-declared** `fileSize` + checksum
5. Activity: `media.uploaded` (`metadata.direct: true`)

Fallback: if prepare says direct upload unsupported → multipart Path A.

## Providers

| Provider | Class | Direct upload | Notes |
|---|---|---|---|
| local | `LocalFsProvider` | No | Dev; `/api/media/...` |
| r2 | `R2StorageProvider` | Yes | Production target; single PUT |
| google_drive | `GoogleDriveProvider` | No | Server resumable put of full buffer |

There is **no** `ObjectStorageProvider` type — R2 is the object store.

## What does NOT exist today

- Storage quota / reservation checks on prepare/complete/upload
- DB↔storage transaction
- S3 multipart / client resumable parts
- Idempotency-Key header
- Server GC for abandoned prepares
- Media metadata PATCH API
- `width`/`height`/`duration_ms` population on upload

## Schema note

Drizzle TS declares `uniqueIndex(tenantId, checksum)` but SQL migrations / `ensureSchema` do **not** create it. Application-level select-before-insert still dedupes; UNIQUE race path may be inactive until index is applied.
