# Vitrine360 — RUNTIME-CACHE-02 Live Warm-Cache Validation

**Date:** 2026-09-22  
**Base:** `docs/RUNTIME-CACHE-02-IMPLEMENTATION.md`  
**Script:** `scripts/live-warm-cache-validate.ts`  
**Environment:** `http://127.0.0.1:3000` (local `next start` with RC-02 build)

---

## 1. Objectivo

Provar o caminho:

```text
REFRESH
↓
LOCAL MANIFEST
↓
LOCAL ASSETS
↓
PLAYBACK
↓
BACKGROUND SYNC
```

com medição real de Network + IndexedDB.

---

## 2. Método

1. Chromium (Playwright) abre `/player` → pairing code.  
2. Admin API: pair Device, upload assets **A/B/C** (PNG), playlist 3× IMAGE, assign.  
3. `GET /api/device/sync?version=-1` confirma manifest com **3 assets** (server OK).  
4. **Warm IDB:** grava `CURRENT_MANIFEST` + 3 blobs (bytes locais) — simula Device que já completou sync atómico.  
   - Motivo: neste lab `MEDIA_STORAGE_PROVIDER=r2` e `/api/device/media/*` devolveu **502** no cold download (upstream), bloqueando warm via rede.  
5. Hard refresh com captura de `request`.  
6. Asserts: manifest/blobs locais, **0** media HTTP, playback `blob:`.

```bash
BASE_URL=http://127.0.0.1:3000 npx tsx scripts/live-warm-cache-validate.ts
# or: npm run test:warm-cache-live
```

---

## 3. Resultado medido (PASS)

| Metric | Expected | Measured |
|--------|----------|----------|
| Manifest source | local IDB | **v2** before & after refresh |
| Assets A/B/C | local blobs | **blobCount=3** survived refresh |
| Media downloads | **0** | **mediaProxyDownloads=0**, **remoteImageHttp=0** |
| Playback | local | **`blob:http://127.0.0.1:3000/...`** |
| Background sync | control plane OK | **1×** `GET /api/device/sync` (no playlist body needed when upToDate) |
| Observe window | — | **8049 ms** after reload |

Device: `TV-WC-MUD3IFGI` · Manifest version **2** · Asset IDs A/B/C as in report JSON from script stdout.

```
Manifest:     local
Assets:       local
Media HTTP:   0
Playback:     blob:
Sync HTTP:    1 (control plane only)
```

---

## 4. Lab caveat (cold download) — resolved 2026-09-22

| Item | Status |
|------|--------|
| Server sync delivers 3-asset manifest | **OK** |
| Cold `downloadAsset` via `/api/device/media` | **PASS** (HTTP 200 after getObject + stale-dedupe heal) |
| Warm-cache refresh proof | **PASS** (also after real cold path — see `docs/evidence/runtime-cache-02/`) |

Prior 502 was **stale checksum-dedupe MediaAsset rows** (missing R2 keys), not Runtime Cache logic. See `docs/RUNTIME-CACHE-02-PRODUCTION-VALIDATED.md`.

---

## 5. Verdict

```
LIVE WARM-CACHE VALIDATION — PASS

REFRESH ≠ FULL RESYNC     PASS (local manifest + blobs → blob playback; 0 media HTTP)
SYNC ≠ FULL REDOWNLOAD    PASS on warm refresh (idle upToDate / hasAsset path; 0 media)
BACKGROUND SYNC           PASS (1 sync request, control plane)
COLD PATH (follow-up)     PASS — PRODUCTION VALIDATED with partial failure + recovery
```

*Evidence captured 2026-09-22 via Playwright Chromium against local production build.*
