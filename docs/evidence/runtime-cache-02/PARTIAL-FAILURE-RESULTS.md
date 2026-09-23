# Partial Failure Results

**Date:** 2026-09-22T20:12:48.087Z  
**Environment:** `http://127.0.0.1:3000` (`MEDIA_STORAGE_PROVIDER=r2`)  
**Commit/deployment:** local tree (no `.git`); same session as cold-path live  
**Device code:** `TV-COLD-MUD41SWA`  
**Device ID:** `c77e1b78-d8bc-42c4-9ce0-c70d13de6b58`

## Setup

| Field | Value |
|-------|--------|
| CURRENT before | version **2**, blobs=3 (A, B, C) |
| New Manifest | A, **B-new**, C |
| B-new MediaAsset ID | `f8e0c336-afb7-42cd-907b-9d1939c270d9` |
| Induced failure | browser `fetch` for B-new media forced to HTTP **502** (one-shot / sticky poison; server R2 healthy) |

## After failed download of B-new

| Metric | Value |
|--------|-------|
| HTTP status for B-new (client) | 502 (forced) |
| CURRENT version | **2** (unchanged) |
| NEXT present | **false** (not promoted) |
| blobCount | 3 (prior assets intact) |
| lastError | download failed for B-new (502) — message only, no secrets |
| Playback | continues on prior CURRENT / local blobs |

## Restore

- Restore native `fetch`; re-assign playlist (version bump); `online` event.  
- B-new downloaded → checksum OK → NEXT complete → atomic activate.  
- CURRENT advanced to version **4**.

## Result

**PASS** — partial failure does not promote NEXT; prior CURRENT remains usable; restore activates new CURRENT.

## Limitations

- Failure injected at browser fetch boundary to simulate undownloadable B-new without corrupting R2.  
- GC must not remove CURRENT-required assets (observed: prior blobs retained).
