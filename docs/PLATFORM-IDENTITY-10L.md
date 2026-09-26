# PLATFORM-IDENTITY-10L — Storage Hardening

**Status:** VALIDATED  
**Closes:** PI-10K F4 (checksum unique observability), F5 (signed PUT ContentLength)  
**Flag:** `ENTITLEMENTS_ENABLED` remains OFF by default  
**Open (unchanged):** DEC-STORAGE-07, DEC-STORAGE-08 → **CLOSED in PI-10M**

## ContentLength strategy

R2 `createUploadUrl` signs **exact** `ContentLength` + `ContentType` via SigV4 `signableHeaders`.

```
prepare(fileSize)
  → reserve(expectedBytes = fileSize)
  → signed PUT(ContentLength = fileSize)
  → browser PUT with requiredHeaders
  → HEAD (authority)
  → actual ≤ reserved → MediaAsset(fileSize=actual) + COMMIT
```

Oversized PUT is rejected at R2 (HTTP 403) before complete. `completeMediaUpload` remains mandatory and uses HEAD as physical size authority.

## Signed upload security

| Control | Status |
|---------|--------|
| Expiry 900s | Yes |
| Server-generated key `tenants/{tenantId}/{assetId}.ext` | Yes |
| tenantId from session | Yes |
| assetId UUID / existing id | Yes |
| Credentials never to browser | Yes |
| Method PUT + key + content-type + content-length | Yes |

## expectedBytes / actual

- `expectedBytes` must be positive integer ≤ `MAX_UPLOAD_BYTES`
- `actual > reserved` → no MediaAsset, release, error
- `actual < reserved` → commit with actual; full reservation leaves RESERVED (excess freed)
- Unknown HEAD size → DENY

## Checksum unique

- Diagnosed via `diagnoseMediaChecksumDuplicates`
- Unique index created only when no duplicates
- `ensureSchema` no longer treats create failure as “protected”
- Status observable: OK | DUPLICATES_PRESENT | INDEX_MISSING | ERROR

## Orphans

Rejected oversized / failed complete objects may remain in R2 without MediaAsset → **do not count quota**. No GC in this phase.

## Evidence

`docs/evidence/platform-identity-10l/` · ADR `docs/adr/ADR-PLATFORM-IDENTITY-010L.md`
