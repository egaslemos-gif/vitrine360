# Vitrine360 — RUNTIME-CACHE-02 Verification Report

**Date:** 2026-09-22  
**Base:** `docs/RUNTIME-CACHE-02-IMPLEMENTATION.md`  
**Mode:** Verification only — **no product code changes**

---

## 1. Software regression

| Command | Result | Notes |
|---------|--------|-------|
| `npm run test:runtime-cache-02` | **PASS** | Activation gate, skip present checksums, checksum change, delta helper, warm-cache zero queue, incomplete must not activate |
| `npm test` | **PASS** | Full suite including acceptance, sched-02, gif-3c, runtime-cache-02 |
| `npm run typecheck` | **FAIL** | Pre-existing: `createSchedule` callers in scripts missing required `startTime`/`endTime` (`acceptance-mvp`, `test-security-audit`, `test-tenant-isolation`, `test-e2e-checklist`, `test-content-studio-3b`). **Not RUNTIME-CACHE-02.** Not fixed (out of scope). |
| `npm run build` | **FAIL** | Compile OK; fails on same TypeScript script errors during `next build` typecheck. **Not RUNTIME-CACHE-02.** Not fixed. |
| `npm run lint` | **FAIL** | 4 **errors**, 40 **warnings** (see below) |

### Lint detail (recorded, not fixed)

| Severity | Item | RUNTIME-CACHE-02 related? |
|----------|------|---------------------------|
| **ERROR** | `content-studio-form.tsx` React Compiler memoization (`initial.media.*`) | **No** (GIF/3C) |
| **ERROR** | `player-app.tsx` refs updated during render (`itemsRef.current` / `contentIdRef.current`) | **Pre-existing pattern**; file touched by RC-02 but rule not introduced by cache logic |
| **WARNING** | `player/sync/engine.ts` — `manifestAssets` unused | **Yes** (dead helper after idle `upToDate`) |
| **WARNING** | `display-engine.tsx` exhaustive-deps | Pre-existing style |
| **WARNING** | `public/tv.js` unused `e` / helpers | Pre-existing + TV path |

```
SOFTWARE REGRESSION SUMMARY
  test:runtime-cache-02  PASS
  npm test               PASS
  typecheck              FAIL (unrelated scripts / SCHED startTime)
  build                  FAIL (same TS)
  lint                   FAIL (4 errors, 40 warnings — mostly unrelated)
```

---

## 2. Warm cache — critical test

### 2.1 Requested measurement

Create Device with Manifest **V25**, assets **A / B / C** persisted locally, then refresh and measure:

| Metric | Expected |
|--------|----------|
| Manifest source | local |
| Assets source | local |
| Media downloads | **0** |
| Playback start | from local cache before sync completes |

### 2.2 Live Network / IDB measurement

| Status | Detail |
|--------|--------|
| **NOT EXECUTED** | No provisioned Chromium player session with warm IDB (CURRENT = v25, blobs A/B/C) was available in this verification pass. Creating a live Device + pairing + full media sync + DevTools Network capture requires an interactive player environment (or CDP attached to a warm kiosk). |

**Verdict for live warm-cache HTTP bytes:** **BLOCKED / UNVERIFIED** (environment), not a code FAIL.

### 2.3 Code-path + unit evidence (desktop React)

Boot order (`player-app.tsx`):

```text
getConfig() (LS)
  → phase playing
  → loadFromCache()          // IDB CURRENT_MANIFEST → publishItems
  → DisplayEngine createObjectUrl(assetId)  // IDB blobs
  → void syncAndShow()       // background
```

Warm `upToDate` (`engine.ts`):

```text
if (delta.upToDate || !delta.manifest)
  → return CURRENT
  // no assetsRequiringDownload
  // no downloadAsset
  // no media HTTP
```

Unit probe (`test:runtime-cache-02` §5): warm present checksums → `assetsRequiringDownload` length **0**.

| Claim | Evidence | Verdict |
|-------|----------|---------|
| Playback manifest from local before sync returns | `loadFromCache` awaited before `syncAndShow` | **PASS** (code) |
| Assets from local when blobs present | `createObjectUrl` first in DisplayEngine | **PASS** (code) |
| Media downloads on warm `upToDate` poll | Idle return; unit queue empty | **PASS** (code + unit) |
| Zero media HTTP on refresh (live) | Requires DevTools on warm device | **UNVERIFIED** |

### 2.4 Control-plane caveat (not a full resync)

On refresh, background sync still issues:

- `GET /api/device/sync?version=N` — when warm + server agrees → `upToDate: true`, **`manifest: null`** (no playlist body)
- `POST /api/device/heartbeat` — presence only

This is **not** a full manifest/media resync. Expected table “Manifest: local” refers to **playback source**, not “zero sync HTTP”.

### 2.5 Activation completeness

| Claim | Evidence | Verdict |
|-------|----------|---------|
| CURRENT only after all required assets local | `prepareNextManifest` → download queue → `activateNextManifest` (checksum/`hasAsset`); throw clears NEXT, keeps CURRENT | **PASS** (code + unit §1/§7) |
| Incomplete set must not activate | `canActivateAssetSet` false → throw | **PASS** (unit) |

---

## 3. Claims under verification

| Claim | Software | Live warm-cache | Overall |
|-------|----------|-----------------|---------|
| **REFRESH ≠ FULL RESYNC** | **PASS** (local-first boot + idle upToDate) | **UNVERIFIED** (no Network capture) | **CONDITIONAL PASS** |
| **SYNC ≠ FULL REDOWNLOAD** | **PASS** (`hasAsset` / `assetsRequiringDownload`) | **UNVERIFIED** | **CONDITIONAL PASS** |
| **CURRENT only when assets complete** | **PASS** | N/A (logic) | **PASS** |

---

## 4. What is still required for production gate

1. **Live warm-cache runbook** on Chromium `/player` (not fragile TV):
   - Pair device; sync until A/B/C in IDB `blobs` + CURRENT version known (e.g. 25).
   - DevTools → Network (filter media) + Application → IndexedDB.
   - Hard refresh.
   - Confirm: `publishItems` from IDB; **0** `/api/device/media` (and 0 R2 media GETs); sync returns `upToDate` without playlist body; playback visible before sync finishes.
2. Optional: CDP script that asserts media request count === 0 after warm refresh.
3. Separate ticket for unrelated **typecheck/build** script `startTime`/`endTime` and lint errors (out of RUNTIME-CACHE-02).

---

## 5. Final verification status

```
RUNTIME-CACHE-02 VERIFICATION
  Unit / code path contracts ........ PASS
  Full npm test ..................... PASS
  typecheck / build ................. FAIL (unrelated, pre-existing)
  lint .............................. FAIL (mostly unrelated; 1 unused helper WARNING in engine)
  Live warm-cache HTTP measurement .. NOT EXECUTED / UNVERIFIED

OVERALL GATE: CONDITIONAL PASS
  — Software contracts for REFRESH≠RESYNC and SYNC≠REDOWNLOAD hold in code + units.
  — Production claim “Media downloads: 0 on refresh” still needs one live Network evidence run.
```

*End of verification — no product code modified.*
