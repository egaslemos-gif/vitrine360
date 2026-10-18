# Device media proxy — provider-aware fix

**Date:** 2026-10-18  
**Branch:** `security/rbac-p0-p1`  
**HEAD (unchanged):** `93660dd7177ef0cc6a0b6ebbda2f89c37c1b00d3` (Manifest Tenant-Safe)  
**Scope:** local implementation + validation only — no commit, push, deploy, or Production changes.

## Cause (confirmed)

Preview player could render TEXT but failed on IMAGE/VIDEO/AUDIO when assets had `storage_provider=google_drive`.

`/api/device/media/[assetId]` always called `getMediaStorage()`, which resolves from `MEDIA_STORAGE_PROVIDER` (R2 on Preview). The proxy then looked up the Drive file id / key in R2, got 404, and returned `502 Media unavailable`.

The Manifest Tenant-Safe fix at `93660dd` is unrelated and was not reverted.

## Fix summary

1. Resolve the asset by `id` + authenticated `device.tenantId` (unchanged).
2. Select storage with `getMediaStorageFor(asset.storageProvider)`.
3. Serve bytes via extracted `serveDeviceObject()` (same Range / 206 / headers behaviour as before).
4. Keep `getMediaStorage()` for upload/default env path.

## Files changed

| Path | Change |
|------|--------|
| `src/services/media/index.ts` | `getMediaStorageFor`, per-name cache, `clearMediaStorageCacheForTests`; `getMediaStorage` delegates to it |
| `src/services/media/serve-device-object.ts` | **new** — Range / chunked / whole-object / upstream fetch (moved from route) |
| `src/app/api/device/media/[assetId]/route.ts` | provider from asset; auth + tenant filter preserved; 401 / 404 / 502 mapping |
| `src/services/media/media-storage-resolve.test.ts` | **new** — resolve unit tests |
| `scripts/test-device-media-provider.ts` | **new** — fake R2/Drive serve harness |
| `package.json` | script `test:device-media-provider` |

Not modified: manifest, TTL 604800, ACLs, DB schema, remote config, Production.

## Diff (resumo)

- **route:** replace `getMediaStorage()` + inline serve logic with `getMediaStorageFor(asset.storageProvider)` + `serveDeviceObject(...)`. Unsupported provider → 502 (no internal detail to client). Provider read failure → 502. Missing/cross-tenant asset → 404. Bad/missing device auth → 401.
- **index:** factory keyed by normalized `storage_provider` (`r2` \| `google_drive` \| `local`; alias `drive` → `google_drive`).
- **serve-device-object:** behaviour parity with prior route (R2 `getObjectRange` path, Drive `getObject` + in-memory slice, optional upstream `getUrl` fetch).

## Streaming / Range limitations

| Provider | `getObjectRange` | Range / 206 behaviour |
|----------|------------------|------------------------|
| R2 | yes | Native ranged reads; large full GET uses chunked stream (`MEDIA_RANGE_MAX_CHUNK`) |
| Google Drive | **no** (only `getObject`) | Range still returns **206** after loading the **entire** object into memory, then slicing |
| Local FS | yes | Same pattern as R2 |

**Implication:** large Drive videos on the device proxy may increase memory / function duration vs R2. Acceptable for the minimal fix; a Drive native Range API would be a follow-up if needed. No alternative streaming API was invented in this change.

## Auth / tenant controls (preserved)

- `authenticateDevice` required → **401** if missing/invalid.
- Asset query: `eq(id)` **and** `eq(tenantId, device.tenantId)` → **404** if missing or other tenant (no cross-tenant leak).
- Rate limit `device-media` unchanged.
- Response headers: `Content-Type` from asset mime, `Accept-Ranges: bytes`, `Cache-Control: private, max-age=3600`, optional `Content-Range` / `Content-Length` on 206.

HTTP re-tests for 401/404 on the live Preview deployment were **not** run in this step (no remote publish). Logic is unchanged from the previous route aside from provider selection.

## Test results (local, real runs)

### `npm run test:device-media-provider`

```
# media-storage-resolve.test.ts — 10 pass / 0 fail
# test-device-media-provider.ts
PASS DMP-01 resolve r2 vs google_drive
PASS DMP-02 R2-like (range) full GET
PASS DMP-03 R2-like Range → 206
PASS DMP-04 Drive-like (getObject only) full GET
PASS DMP-05 Drive-like Range via whole-object slice → 206
PASS DMP-06 provider failure → throws (route maps to 502)
PASS DMP-07 wrong provider would not see R2 key on Drive fake
PASS DMP-08 unsupported provider name
summary PASS=8 FAIL=0
```

Exit: **0**

### `npm run test:manifest-tenant-safe`

```
PASS MF-01 … MF-07 (7 executed)
NOT_RUN MF-06b (player offline E2E — out of suite)
Executed: 7  PASS: 7  FAIL: 0
```

Exit: **0** — Manifest Tenant-Safe regression intact.

### TypeScript

`npx tsc --noEmit` still reports pre-existing WIP error only:

`scripts/run-r2-isolation-preview.ts(56,46): error TS2367`  
(no errors in `device/media`, `serve-device-object`, or `media/index` from this change)

## Explicitly not claimed

- **Playback E2E on Preview/Production** was not re-run against real Drive/R2 bytes after this fix (no deploy). Local fakes prove provider selection and Range headers; remote media delivery requires a later authorized Preview deploy + smoke.

## Risks

1. Drive full-object load for ranged requests (memory/timeout on very large files).
2. Mis-labelled `storage_provider` in DB still routes to the wrong backend (data issue, not proxy).
3. Env default `MEDIA_STORAGE_PROVIDER` unchanged — uploads still go to env provider; only **read** path for device media is asset-aware.

## Rollback

1. Revert the three source files (`route.ts`, `index.ts`, delete `serve-device-object.ts`) to pre-change behaviour (`getMediaStorage()` only), or discard the uncommitted WIP for those paths.
2. Do **not** revert commit `93660dd` (manifest).
3. No DB / env / Vercel / Cloudflare rollback required for this change alone.

## Next step (requires authorization)

Deploy Preview from this WIP (or a dedicated commit), then smoke IMAGE/VIDEO/AUDIO for a known `google_drive` asset and an R2 asset on the same device token. No Production change until that passes.
