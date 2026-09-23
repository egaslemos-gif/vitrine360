# Cold Download Results

**Date:** 2026-09-22T20:12:29.705Z  
**Environment:** `http://127.0.0.1:3000` (`MEDIA_STORAGE_PROVIDER=r2`, production `npm start`)  
**Commit/deployment:** local tree (no `.git` in workspace); build via `next build` + `npm start`  
**Device code:** `TV-COLD-MUD41SWA`  
**Device ID:** `c77e1b78-d8bc-42c4-9ce0-c70d13de6b58`  
**Manifest version (CURRENT after cold):** `2`

## Root cause of prior HTTP 502 (diagnosed)

| Layer | Status |
|-------|--------|
| Browser → `/api/device/media/[id]` | reached |
| Device Bearer auth | OK |
| MediaAsset row + tenant ownership | OK |
| `storageProvider` / `storageKey` | OK in DB |
| R2 credentials / bucket / endpoint | OK (SDK readable for healthy keys) |
| **Failure layer** | App: stale checksum-dedupe `MediaAsset` rows pointed at **missing R2 keys** (2 path segments vs healthy 3). Proxy fell through to presigned `fetch` → upstream miss → **502**. |

**Fixes (minimal):**

1. Device media route prefers `storage.getObject()` (R2 SDK) before presigned fetch.
2. Content upload heals stale dedupe when backing object is unreadable (re-upload / new key).

No Runtime Cache architecture change. No artificial 502 fallback.

## Assets (A / B / C)

| Label | MediaAsset ID | Checksum | Proxy HTTP | Bytes |
|-------|---------------|----------|------------|-------|
| A | `b349398f-282f-44de-b959-8460c2784319` | `sha256:c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77` | 200 | 70 |
| B | `a2c2b019-8f29-41ba-be7f-59e2789d5d32` | `sha256:6b7fa434f92a8b80aab02d9bf1a12e49ffcae424e4013a1c4f68b67e3d2bbcd0` | 200 | 70 |
| C | `a02d644c-9aef-48a8-938c-7f79c9247371` | `sha256:a86fc9c7b91d20881b5cc9597074202438213b4769c956088f3ea5a7d09f4e94` | 200 | 70 |

## Cold path (IndexedDB empty — not pre-warmed)

1. Pair device → `GET /api/device/sync?version=-1` → Manifest A/B/C  
2. Real downloads via `/api/device/media/*`  
3. SHA-256 validated client-side before persist  
4. NEXT completed → atomic activate → CURRENT  

| Metric | Value |
|--------|-------|
| Media HTTP 200 (observed during sync) | 6 |
| Media HTTP ≥400 | 0 |
| Bytes received (proxy probe) | 70+70+70 |
| IDB blobs / asset meta | 3 / 3 |
| CURRENT assetIds | 3 |
| NEXT after activate | absent (`hasNext: false`) |
| Playback source | `blob:` |

## Result

**PASS**

## Limitations

- Lab PNGs (70 B each), not production video bitrate.  
- Secrets (R2 keys, DB token, device bearer) not recorded.
