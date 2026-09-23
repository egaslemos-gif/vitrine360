# Vitrine360 — RUNTIME-CACHE-01 Persistent Device Cache & Idempotent Sync Audit

**Date:** 2026-09-22  
**Phase:** RUNTIME-CACHE-01 (audit only)  
**Status:** **CLOSED** (succeeded by RUNTIME-CACHE-02 — PRODUCTION VALIDATED)  
**Trigger:** Ensure an already-synced Device does not re-download Manifest / Media Assets after refresh, restart, reboot, temporary offline, online recovery, or repeated sync polling.  
**Product code changes in this phase:** **NONE**  
**Schema / Player / Runtime / Manifest / Sync / SW / IndexedDB / Auth:** **NOT MODIFIED**

---

## 1. Executive Verdict

| Criterion | Verdict |
|-----------|---------|
| Refresh ≠ full resync (desktop React `/player`) | **MOSTLY YES** |
| Sync ≠ full redownload when local blobs exist (desktop) | **YES** (`hasAsset` gate) |
| Desired boot order: identity → local manifest → local assets → play → background sync | **YES** (desktop) |
| Identity survives refresh / restart / reboot | **YES** (`localStorage` `v360-player-config`) |
| Active manifest survives (desktop) | **YES** (IDB `CURRENT_MANIFEST`) |
| Media blobs survive + skip HTTP when checksum matches (desktop) | **YES** |
| `upToDate` skips manifest body | **YES** |
| `upToDate` is fully idle (no media work) | **PARTIAL** — still walks assets / probes IDB |
| Poll is idempotent for bytes | **PARTIAL** |
| Cache wiped on normal boot | **NO** (only `?reset=1` / diag `R`) |
| Fragile Smart TV (`/tv.html` + `tv.js`) offline media | **FAIL** — `prepareItems` never called |
| Atomic NEXT activation in live sync path | **FAIL** — helpers exist, engine bypasses |

```
ARCHITECTURE AUDIT — APPROVED FOR RUNTIME-CACHE-02 IMPLEMENTATION
PRIMARY TARGET: Desktop path is largely correct; Smart TV streams remote URLs
every playback and never wires local media cache into the slideshow.
SECONDARY: upToDate still probes every asset; NEXT/atomic path unused;
DisplayEngine network fallback does not persist to IDB.
```

**Desired flow (target):**

```text
Refresh
↓
carregar Device Identity local
↓
carregar Active Manifest local
↓
carregar assets locais
↓
começar playback
↓
fazer sync em background
```

**Desktop React:** matches this flow when blobs are already cached.  
**Hisense / Sraf / fragile UA:** identity + LS manifest yes; **local assets no**.

---

## 2. Scope

### In scope
- Player boot + persistence (`player-app`, `indexed-db`, `sync/engine`, `atomic`)
- Sync API + `buildSyncDelta` version / `effectivePlaybackKey` gating
- Media proxy cache headers + SW behavior
- Fragile TV path (`tv.js`, `tv-sw.js`, `fragile-tv`)
- Scenario matrix: refresh, restart, reboot, offline, recovery, poll

### Out of scope (this phase)
- Product code / schema changes
- Implementing Smart TV media persistence
- Changing sync poll intervals or atomic activation strategy

---

## 3. Storage map

| Data | Store | Key / location | Who uses it |
|------|-------|----------------|-------------|
| Device identity (token, deviceId, codes) | **localStorage** | `v360-player-config` | Boot critical path (all UAs) |
| Pairing client / secret | localStorage | `v360-pairing-client-id`, `v360-pairing-secret` | Pairing |
| Identity mirror | IndexedDB `meta` | `config` | Written fire-and-forget; **not read on boot** |
| Active manifest (React) | IndexedDB `meta` | `CURRENT_MANIFEST` (+ unused `NEXT_MANIFEST`) | Non-fragile only |
| Active manifest (Smart TV) | localStorage | `v360-tv-current-manifest` | `tv.js` only |
| Media blobs (React) | IndexedDB `blobs` + `assets` (checksum/size) | DB `vitrine360-player` | Sync engine + DisplayEngine |
| Media (Smart TV intended) | Cache API `v360-tv-media-v1` + IDB `v360-tv-media-v1` | **Dead path** — never wired into slideshow | — |
| App shell | SW Cache API | `vitrine360-shell-v13`, `vitrine360-runtime-v13` | Non-fragile; **`/api/*` excluded** |
| TV shell | `tv-sw.js` | `v360-tv-shell-v041` | Shell HTML/JS only |

---

## 4. End-to-end flows (as implemented)

### 4.1 Desktop React `/player` (non-fragile)

```text
Boot
  getConfig()                         ← localStorage ONLY
  if deviceToken:
    phase = playing
    loadFromCache()                   ← IDB CURRENT_MANIFEST (8s race)
    publishItems → DisplayEngine
      createObjectUrl(assetId)        ← IDB blob if present
      else remote URL / Bearer fetch  ← NOT written back to IDB
    void syncAndShow()                ← background
      runSyncCycle()
        GET /api/device/sync?version=N
        if upToDate:
          cacheAssetsInBackground(current assets)  ← hasAsset short-circuit
          return CURRENT
        else:
          setMeta(CURRENT_MANIFEST) immediately
          cacheAssetsInBackground(new assets)

Playing loop
  heartbeat 30s (immediate pulse)
  sync 20s (10s if empty playlist)
  online → syncAndShow()
```

Evidence: `src/features/player/player-app.tsx` (boot ~263–286, playing loop ~375–443);  
`src/player/sync/engine.ts` (`runSyncCycle` ~151–221, `downloadAsset` ~86–114);  
`src/player/playback/display-engine.tsx` (~139–171).

### 4.2 Fragile Smart TV `/tv.html`

```text
UA match → redirect away from React
LS identity + LS manifest
doSync every ~60s
  if upToDate → keep playlist (empty recovery forces version -1 once)
  else writeCachedManifest + applyPlaylist(remote URLs)
cacheAsset / prepareItems exist but prepareItems is NEVER called
→ every slide uses remote asset.url (re-hit network / browser HTTP cache)
```

Evidence: `src/player/device/fragile-tv.ts`; `player-app.tsx` redirect ~233–238;  
`public/tv.js` `prepareItems` ~595–606 (definition only), `doSync` ~941–975  
(comment explicitly: play remote URLs immediately; do not wait for IDB).

---

## 5. Layer-by-layer evidence

### 5.1 IndexedDB (`src/player/cache/indexed-db.ts`)

| Topic | Finding |
|-------|---------|
| Stores | `meta`, `assets`, `blobs` (DB `vitrine360-player` v1) |
| Config | Always LS; IDB mirror skipped on fragile UA |
| Boot read | `getConfig()` never falls back to IDB |
| Dead export | `hydrateConfigFromIdbInBackground` — **never called** in `src/` |
| Atomic NEXT | `activateNextManifest` + `canActivateAssetSet` — **unused by sync engine** |
| GC | `cleanStaleAssets` removes keys not in CURRENT `assetIds` |
| Wipe | `clearAllPlayerData` only (`?reset=1` / diag) |
| Timeout | `IDB_TIMEOUT_MS = 4000`; fragile UA rejects `openDb` |

### 5.2 Sync engine (`src/player/sync/engine.ts`)

| Topic | Finding |
|-------|---------|
| Client version | Empty playlist → `-1`; else CURRENT `manifestVersion` |
| `upToDate` | Returns CURRENT; still calls `cacheAssetsInBackground` |
| Download skip | `downloadAsset` returns early if `hasAsset(id, checksum)` |
| Activation | Writes **CURRENT immediately**; clears NEXT; downloads async |
| `changedAssetIds` | Received from API; **never read** |
| Bearer | Only for same-origin / relative URLs (`shouldAttachDeviceBearer`) |

**Does `upToDate` skip redownload?**  
- Manifest payload: **yes** (`manifest: null`).  
- Media bytes: **yes iff** IDB checksum matches; otherwise background fetch.  
- Poll cost: still opens IDB once per asset every cycle.

### 5.3 Atomic helpers (`src/player/sync/atomic.ts`)

Pure: `canActivateAssetSet`, `checksumMatches`, `shouldAttachDeviceBearer`.  
`canActivateAssetSet` only used by unused `activateNextManifest` + security audit script — **not** by `runSyncCycle`.

### 5.4 Server sync (`buildSyncDelta`)

| Condition | Result |
|-----------|--------|
| `clientVersion >= manifestVersion` AND `effectivePlaybackKey` matches (or empty seed) | `{ upToDate: true, manifest: null, changedAssetIds: [] }` |
| Version stale or playback key stale | Full `buildDeviceManifest`; bump version when playback stale |
| `changedAssetIds` | **All** asset ids in playlist — not a true incremental delta |

Evidence: `src/services/manifest.ts` ~301–364; route `src/app/api/device/sync/route.ts`.

Note: `GET /api/device/manifest` supports 304-by-version but the **live player sync path does not use it**.

### 5.5 Media route + SW

| Piece | Behavior |
|-------|----------|
| `/api/device/media/[assetId]` | Bearer + tenant; `Cache-Control: private, max-age=3600` |
| `public/sw.js` | Precaches shell; **`isApi` → bypass** (no Cache API for device media) |
| Offline navigate | `/v360-offline.html` → depends on IDB blobs already present |
| SW register | Skipped on fragile TV (`sw-register.tsx`) |

### 5.6 DisplayEngine fallback gap

Resolution order (`display-engine.tsx` ~139–171):

1. IDB blob URL (`createObjectUrl`)  
2. Absolute `https?` `asset.url`  
3. Bearer fetch `offlineUrl` / `/api/device/media/...` → **ephemeral** blob URL  

Step 3 does **not** call `putAssetBlob` — only the sync engine persists media.

---

## 6. Scenario matrix

| Scenario | Local loads | Network | Media re-fetched? | Notes |
|----------|-------------|---------|-------------------|-------|
| **Browser refresh** (desktop, warm cache) | LS identity; IDB manifest; IDB blobs | Sync + heartbeat; often **2–3 syncs** in first second | **No** if checksum matches | Aligns with desired flow |
| **Browser restart** (desktop) | Same as refresh | Same | Same | LS + IDB survive process |
| **Device reboot** (Chromium / PWA) | LS + IDB + SW shell | Sync when online | No if blobs present | SW does not cache media |
| **Temporary offline** | In-memory + IDB | Sync/HB fail → keep CURRENT | No | Incomplete prior sync → some slides fail |
| **Online recovery** | Keep playlist | `online` → `syncAndShow` | Only missing / mismatch | May stampede with poll |
| **Repeated poll** | IDB version | `GET /sync?version=N`; `upToDate` → no manifest body | No HTTP if `hasAsset` | Still IDB probe per asset |
| **Fragile Smart TV** | LS identity + LS manifest | Sync + remote media URLs | **Effectively always** | `prepareItems` dead |

---

## 7. Gaps / risks (priority)

| Pri | Gap | Impact |
|-----|-----|--------|
| **P0** | Smart TV: `prepareItems` / `cacheAsset` never invoked from `doSync` | Refresh/reboot always re-hit CDN/API for media |
| **P1** | Atomic NEXT unused — CURRENT activated before all blobs land | Offline incomplete after “successful” sync |
| **P1** | `changedAssetIds` unused / not a real delta | Full asset walk on every stale sync |
| **P2** | `upToDate` still walks + IDB-probes all assets every poll | Unnecessary disk/CPU churn; not “idle sync” |
| **P2** | DisplayEngine network fallback does not write IDB | Same asset re-fetched across slides/refreshes if sync lag |
| **P2** | Boot double/triple sync (boot + `initialSync` @0 + heartbeat) | Control-plane noise; harder to reason about |
| **P3** | `hydrateConfigFromIdbInBackground` dead | LS wipe orphans IDB config |
| **P3** | SW never caches device media (by design) | Offline = IDB-only |
| **P3** | Split DBs React vs TV (`vitrine360-player` vs `v360-tv-media-v1`) | No shared offline cache across paths |

---

## 8. Tests related to cache / sync

| Artifact | Covers | Gap |
|----------|--------|-----|
| `scripts/test-security-audit.ts` | `canActivateAssetSet`, checksum, Bearer | No real IDB / `runSyncCycle` |
| `scripts/acceptance-mvp.ts` | Server `buildSyncDelta` upToDate; in-memory offline stub | No player blob persistence |
| `scripts/test-schedule-execution-02.ts` | Server key/version → upToDate | No client download |
| CDP / hardware scripts | Manual SW / shell probes | Not automated “zero media HTTP after warm cache” |
| `src/player/**/*.test.*` | **None** | — |

---

## 9. Acceptance criteria for RUNTIME-CACHE-02 (do not implement here)

### Desktop React (must)

1. After warm cache: refresh → playback starts from **local** identity + manifest + blobs **before** sync returns.  
2. After warm cache: `upToDate` poll performs **zero** media HTTP (optional: skip asset walk when all checksums known good).  
3. Temporary offline: continue slideshow from IDB for assets already cached.  
4. Online recovery: download **only** missing / checksum-mismatched assets.  
5. Normal boot never calls `clearAllPlayerData`.

### Smart TV (must decide product strategy)

6. Either wire a **safe** local media path that does not freeze Sraf, **or** document “online-stream only” as accepted product behavior for fragile UAs.  
7. If caching: `prepareItems` (or equivalent) must run off the critical path and slideshow must prefer local URLs when present.

### Engineering hygiene (should)

8. Either revive NEXT/`activateNextManifest` for offline-complete activation, or document “online-first activate” as intentional.  
9. Make `changedAssetIds` a true delta **or** stop sending/consuming a fake full list.  
10. Persist DisplayEngine Bearer fallback into IDB (or remove duplicate fetch path).  
11. Automated test: warm cache + `upToDate` → assert **zero** media HTTP.

---

## 10. Recommended RUNTIME-CACHE-02 direction (audit only)

1. **Keep** LS-first identity + IDB CURRENT manifest + `hasAsset` gate (desktop foundation is sound).  
2. **Stop** treating every `upToDate` as a full asset walk unless a cheap “missing set” scan is required.  
3. **Decide** Smart TV offline policy explicitly (wire cache vs accept stream-only).  
4. **Do not** expand SW Cache API to `/api/device/media` without a separate security review (Bearer + private content).  
5. **Add** one automated idempotency probe before claiming “Refresh ≠ resync / Sync ≠ redownload”.

---

## 11. Files examined (read-only)

| File | Role |
|------|------|
| `src/player/cache/indexed-db.ts` | LS + IDB persistence |
| `src/player/sync/engine.ts` | Sync cycle + downloads |
| `src/player/sync/atomic.ts` | Pure activation / checksum helpers |
| `src/features/player/player-app.tsx` | Boot + poll + heartbeat |
| `src/player/playback/display-engine.tsx` | Blob vs network URL resolution |
| `src/services/manifest.ts` | `buildSyncDelta` |
| `src/app/api/device/sync/route.ts` | Sync endpoint |
| `src/app/api/device/media/[assetId]/route.ts` | Media proxy headers |
| `src/player/device/fragile-tv.ts` | UA divert |
| `src/player/device/sw-register.tsx` | SW register skip on fragile |
| `public/sw.js` | Shell cache; API bypass |
| `public/tv.js` | Smart TV sync + dead `prepareItems` |

---

*End of RUNTIME-CACHE-01 audit — no product code changed.*
