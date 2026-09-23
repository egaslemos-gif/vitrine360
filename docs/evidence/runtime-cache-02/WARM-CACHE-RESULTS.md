# Warm Cache Results

**Date:** 2026-09-22T20:12:59.372Z (post cold-path) / warm-cache-live re-run same day  
**Environment:** `http://127.0.0.1:3000` (`MEDIA_STORAGE_PROVIDER=r2`)  
**Commit/deployment:** local tree (no `.git`)

## A — After real cold path (no IDB pre-warm)

| Field | Value |
|-------|--------|
| Device code | `TV-COLD-MUD41SWA` |
| Device ID | `c77e1b78-d8bc-42c4-9ce0-c70d13de6b58` |
| Manifest version | **5** |
| Media HTTP on refresh | **0** |
| Control-plane sync HTTP | present (background) |
| IDB blobs | 3 |
| CURRENT | present |
| NEXT | absent |
| Playback source | `blob:` |

**Result:** **PASS**

## B — `npm run test:warm-cache-live` (dedicated script)

| Field | Value |
|-------|--------|
| Device code | `TV-WC-MUD43FCA` |
| Device ID | `48fc0d58-a6d2-400a-a634-dc13ca51ac3d` |
| Manifest version | 2 |
| Media proxy downloads on refresh | **0** |
| Remote image HTTP | 0 |
| Sync requests | 1 (control plane) |
| Playback | `blob:` |
| Verdict flags | localManifest, localAssets, mediaDownloadsZero, playbackFromBlob, syncControlPlaneOnly |

**Result:** **PASS**

Note: dedicated warm script may still seed IDB for isolation; cold→warm path in section A is the production-relevant proof that media HTTP stays at 0 after a real cold sync.

## Limitations

- No secrets in this file.  
- Warm-cache-live historically noted lab 502 workarounds; cold-path evidence supersedes that for cold download.
