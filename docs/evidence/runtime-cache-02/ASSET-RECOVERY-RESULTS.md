# Asset Recovery Results

**Date:** 2026-09-22T20:12:59.370Z  
**Environment:** `http://127.0.0.1:3000` (`MEDIA_STORAGE_PROVIDER=r2`)  
**Commit/deployment:** local tree (no `.git`); same session as cold-path live  
**Device code:** `TV-COLD-MUD41SWA`  
**Device ID:** `c77e1b78-d8bc-42c4-9ce0-c70d13de6b58`

## Starting state

- CURRENT complete: A, B-new, C (blobs=3)  
- Server Manifest **unchanged** in content; playlist re-assign used only to bump sync version so the client runs a cycle.

## Steps

1. Delete **only** B-new blob + asset meta from IndexedDB (`f8e0c336-afb7-42cd-907b-9d1939c270d9`).  
2. Re-assign same playlist → version bump → reload.  
3. Observe network: only missing asset redownloaded.

## Observed

| Metric | Value |
|--------|-------|
| Expected | A/C `hasAsset` → no download; B-new → real `/api/device/media` download |
| Media HTTP 200 count | **1** |
| Media HTTP ≥400 | 0 |
| Bytes | via proxy (same PNG class as cold assets) |
| IDB blobs after | **3** |
| CURRENT | intact / warm again |
| Playback | continues (`blob:`) |
| Follow-up warm refresh | 0 media HTTP (see WARM-CACHE-RESULTS) |

## Result

**PASS**

## Limitations

- Version bump via re-assign required to force sync when server playlist content is unchanged.  
- Device bearer / storage secrets not logged.
