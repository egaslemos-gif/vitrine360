# Tenant Drive media read — technical review (local)

**Date:** 2026-10-18  
**Branch / HEAD:** `security/rbac-p0-p1` @ `23dc698` (+ uncommitted Tenant Drive read WIP)  
**Reviewed against:** `docs/diagnostics/TENANT-DRIVE-MEDIA-READ-IMPLEMENTATION-REPORT.md`  
**Constraints:** no commit / push / deploy / env / remote DB / Production. WIP preserved.

---

## 1. Files analysed

| Path | Role |
|------|------|
| `src/app/api/device/media/[assetId]/route.ts` | Device auth → asset tenant query → resolve → serve |
| `src/services/media/index.ts` | `resolveMediaStorageForAsset` (no SA / no R2 for Drive) |
| `src/services/tenant-storage.ts` | Config load, refresh cache, `tryTenantGoogleDriveProvider` |
| `src/services/media/google-drive-tenant-provider.ts` | `getObject` / `getObjectRange` / `headObject` |
| `src/services/media/serve-device-object.ts` | HTTP 200/206/416 + headers |
| `src/lib/http-range.ts` | Range parse + `MEDIA_RANGE_MAX_CHUNK` |
| `src/lib/drive-token-crypto.ts` | AES-256-GCM at rest |
| `src/lib/google-drive-oauth.ts` | Flag + refresh (OAuth client, not SA) |
| `src/db/schema.ts` / `src/db/client.ts` | `tenantStorageConfigs` + `ensureSchema` DDL |
| Tests | `media-storage-resolve.test.ts`, `scripts/test-device-media-provider.ts` |

---

## 2. Real execution flow

```
GET /api/device/media/{assetId}
  → enforceRateLimit
  → authenticateDevice(Bearer|?token)     // 401 if no device.tenantId
  → SELECT media_assets
       WHERE id = assetId AND tenant_id = device.tenantId
       // 404 if missing or other tenant
  → resolveMediaStorageForAsset({
       storageProvider: asset.storageProvider,
       tenantId: asset.tenantId,          // same as device.tenantId after SQL
       storageKey: asset.storageKey
     })
       → r2|local: getMediaStorageFor(...)
       → google_drive: tryTenantGoogleDriveProvider(asset.tenantId)
            → TENANT_DRIVE_ENABLED?
            → row status=CONNECTED + folder + enc refresh?
            → GoogleDriveTenantProvider({ getAccessToken → decrypt+refresh })
            → null/throw → route 502 (no R2/SA fallback)
  → serveDeviceObject(storage, storageKey, Range, mime, fileSize)
       → Prefer getObjectRange when present + total>0
       → 416 / 206 / 200 (+ chunked stream for large full GET)
  → catch → 502 "Media unavailable" (log message truncated ≤200 chars)
```

**Auth before bytes:** confirmed.  
**Tenant isolation before provider:** confirmed (SQL + `asset.tenantId` only).  
**No Drive→R2 fallback:** confirmed in `resolveMediaStorageForAsset`.  
**No SA dependency on device-media path:** confirmed (throws if Tenant Drive unavailable).

---

## 3. Test results (executed this review)

| Command | Result |
|---------|--------|
| `npm run test:device-media-provider` | **PASS** — unit file **19/19**; script DMP-01…12 **12/12**; exit 0 |
| `npm run test:manifest-tenant-safe` | **PASS** — **7/7** executed; MF-06b **NOT_RUN**; exit 0 |
| `npx tsc --noEmit` | **FAIL** (pre-existing WIP only): `scripts/run-r2-isolation-preview.ts(56,46) TS2367` — **not** introduced by Tenant Drive files |
| Ad-hoc Range integration (`serveDeviceObject` + `GoogleDriveTenantProvider` + mocked fetch) | **PASS** for 206 + Content-Range/Length/Accept-Ranges + byte integrity; **416** `bytes */N`; **200** full |
| Isolated `next build` (temp dir + junctions) | **NOT_RUN / BLOCKED** — Turbopack panic: junction `src` points outside filesystem root |

Counts match the implementation report when re-run fresh; not reused from prior session memory alone.

---

## 4. Findings by severity

### High

*None* for the local security/isolation contract of this change.

### Medium

1. **Range oversize if upstream returns 200 with full body**  
   `getObjectRange` accepts Drive status `200` or `206`. Ad-hoc probe: when mock returns **full** body with status 200 for `Range: bytes=0-3`, `serveDeviceObject` responds **206** with `Content-Range: bytes 0-15/16` and 16 bytes — i.e. bytes **outside** the requested window.  
   Google Drive `alt=media` normally returns **206** with a sliced body; this is a **defensive** gap, not proven against live Drive.  
   **Suggested fix (optional before Preview):** in `getObjectRange` (or `serveDeviceObject`), if `buf.byteLength > (end-start+1)`, truncate to the requested slice (or fail closed).

2. **Range failure fallthrough → `getObject` (2 MiB cap)**  
   If ranged read throws, `serveDeviceObject` falls through to full `getObject`. Tenant provider refuses >2 MiB → **502**. Fail-closed and safe; large videos depend on Range succeeding. Document for Preview smoke.

### Low

3. **`refreshDriveAccessToken` embeds Google error response body** in `Error.message`. Route logs truncate to 200 chars and never return it to the client. Unlikely to contain refresh tokens; still noisier than a status-only message.

4. **Stale comment** in `serve-device-object.ts` still says Drive has `getObject` only — Tenant Drive now has native Range.

5. **`getMediaStorageFor("google_drive")` still constructs SA factory** for env/default callers. Device-media does **not** use it. Residual confusion risk only.

6. **No `HEAD` handler** on device-media route (GET only). Pre-existing; not a regression of this WIP.

7. **Production build not verified** in isolation (Turbopack/junction limitation on this machine).

---

## 5. Evidence: tenant isolation, Range, errors

| Requirement | Evidence |
|-------------|----------|
| Device auth first | `authenticateDevice` before any `media_assets` / storage I/O |
| Asset `id + tenantId` | Drizzle `and(eq(id), eq(tenantId, device.tenantId))` → 404 |
| Provider only for authorized tenant | `tryTenantGoogleDriveProvider(asset.tenantId)` after SQL match |
| No cross-tenant / no R2 fallback | Resolve throws when Tenant Drive unavailable; never calls `getMediaStorage()` for Drive |
| Errors opaque to client | `jsonError("Media unavailable", 502)` / `Unauthorized` / `Not found` |
| Tokens not in client responses | Confirmed; unit DMP-12 / resolve tests assert messages omit fixture secrets |
| Range 206 + headers | Ad-hoc + DMP-11: `Content-Range`, `Content-Length`, `Accept-Ranges`, exact bytes |
| Range 416 | Ad-hoc: `bytes */16` for unsatisfiable |
| Full 200 | Ad-hoc + DMP-02 |
| AES-256-GCM | `drive-token-crypto.ts`: `aes-256-gcm`, 12-byte IV, auth tag, 32-byte key (env or HKDF) |
| R2 path | `resolveMediaStorageForAsset` → `getMediaStorageFor("r2")`; DMP-02/03 PASS |

---

## 6. Unit / mock limitations

- No live OAuth refresh, no real Drive file I/O, no Preview HTTP.  
- Cross-tenant **HTTP** not re-exercised in this review (SQL guard unchanged from `23dc698`; prior Preview smoke covered 404).  
- `CONNECTED` row + decrypt + refresh path only structurally reviewed.  
- Oversize-Range behaviour shown only with a hostile mock.  
- Build isolation failed (environment), not a code compile error in Tenant Drive modules.

---

## 7. Corrections status

| # | Priority | Status |
|---|----------|--------|
| **C1** | Medium | **DONE** — `normalizeRangedBody` in `serveDeviceObject` + defense in `GoogleDriveTenantProvider.getObjectRange` |
| C2 | Low | Open (optional) — Google refresh error body in `Error.message` |
| C3 | Low | **DONE** — stale Drive “getObject only” comment updated |
| C4 | Out of scope | Pre-existing `scripts/run-r2-isolation-preview.ts` TS2367 |
| C5 | Later | Preview smoke (authorized separately) |

### C1 fix (2026-10-18, same WIP)

**Problem:** If `getObjectRange` returned a full object (ignored Range), HTTP 206 advertised a window based on `buf.byteLength`, leaking bytes outside the request.

**Fix:**

1. `normalizeRangedBody(buf, start, end)` in `serve-device-object.ts`:
   - exact/short → pass through;
   - oversized but covers `end` from file offset 0 → `subarray(start, end+1)`;
   - otherwise throw (fail closed — no misleading 206).
2. Applied in `readSlice` after every `getObjectRange` call (so R2 exact slices unchanged).
3. Tenant Drive `getObjectRange` also extracts the window when `raw.byteLength > expected && raw.byteLength > end`.

**Not done:** blind truncate-from-zero without offset check (would break mid-file ranges).

---

## 8. Tests re-run after C1 (this session)

| Suite | Result |
|-------|--------|
| `media-storage-resolve.test.ts` | **28 PASS** (includes 8 C1 subtests) |
| `scripts/test-device-media-provider.ts` | **13 PASS** (DMP-01…12 + DMP-C1) |
| `npm run test:manifest-tenant-safe` | **7 PASS**, MF-06b NOT_RUN |
| `npx tsc --noEmit` | Only pre-existing WIP TS2367 in `run-r2-isolation-preview.ts` |
| Production build | **Not approved** — isolated build still blocked by env/Turbopack; not re-attempted as success |

---

## 9. Proposed commit pathspec (NOT staged / NOT committed)

Include **only** these paths when authorization is granted:

```
src/app/api/device/media/[assetId]/route.ts
src/services/media/index.ts
src/services/media/serve-device-object.ts
src/services/media/google-drive-tenant-provider.ts
src/services/media/media-storage-resolve.test.ts
src/services/tenant-storage.ts
src/lib/drive-token-crypto.ts
src/lib/google-drive-oauth.ts
src/db/schema.ts
src/db/client.ts
scripts/test-device-media-provider.ts
docs/diagnostics/TENANT-DRIVE-MEDIA-READ-INTEGRATION-PLAN.md
docs/diagnostics/TENANT-DRIVE-MEDIA-READ-IMPLEMENTATION-REPORT.md
docs/diagnostics/TENANT-DRIVE-MEDIA-READ-REVIEW.md
```

**Exclude:** RBAC/R2 Preview docs & harnesses, `DEVICE-MEDIA-PROVIDER-AWARE-*` (prior), `LOGIN-AND-PLAYER-*`, `package.json` (unchanged since `23dc698`), Production config.

Suggested message:

`fix(media): serve device Drive assets via Tenant Drive OAuth`

---

## 10. Recommendation (updated)

### **APROVADO PARA PREPARAR COMMIT** (C1 included)

- Tenant Drive read path + C1 Range integrity are locally validated.  
- **No `git add` / `git commit` / push / deploy performed in this step.**  
- Next: user-authorized commit with the pathspec above, then Preview smoke (C5).

---

## 11. Final commit gate (2026-10-18) — pathspec verification only

**Baseline:** branch `security/rbac-p0-p1`, HEAD `23dc69837648674df6b988138d6d0183455fa349`  
**Staged:** empty  
**Unrelated dirty WIP (excluded from commit):** `DEVICE-MEDIA-PROVIDER-AWARE-FIX.md`, `RBAC-CROSS-TENANT-TEST-MATRIX.md`, `RBAC-REMEDIATION-REPORT.md`, plus untracked R2/RBAC/PV-MF scripts & reports.

### 11.1 Evidence vs initial state (`git diff HEAD` / untracked)

| # | Path | vs HEAD | Classification | Mixed hunks? |
|---|------|---------|----------------|--------------|
| 1 | `src/app/api/device/media/[assetId]/route.ts` | Modified: `getMediaStorageFor` → `resolveMediaStorageForAsset` | **Necessary — Tenant Drive Read** | No — entire diff is integration |
| 2 | `src/services/media/index.ts` | Modified: adds `resolveMediaStorageForAsset` | **Necessary — Tenant Drive Read** | No |
| 3 | `src/services/media/serve-device-object.ts` | Modified: `normalizeRangedBody` + C1 in `readSlice` | **Necessary — C1 / Tenant Drive Read** | No |
| 4 | `src/services/media/google-drive-tenant-provider.ts` | **Untracked (new)** | **Necessary — Tenant Drive Read** | N/A (whole file) |
| 5 | `src/services/media/media-storage-resolve.test.ts` | Modified: resolve + Tenant Range + C1 suites | **Necessary — tests** | No |
| 6 | `src/services/tenant-storage.ts` | **Untracked (new)** | **Necessary — Tenant Drive Read** | N/A |
| 7 | `src/lib/drive-token-crypto.ts` | **Untracked (new)** | **Necessary — Tenant Drive Read** | N/A |
| 8 | `src/lib/google-drive-oauth.ts` | **Untracked (new)** | **Necessary — Tenant Drive Read** | N/A |
| 9 | `src/db/schema.ts` | Modified: only `tenantStorageConfigs` table + type | **Necessary — Tenant Drive Read** | No — additive only |
| 10 | `src/db/client.ts` | Modified: only `ensureSchema` CREATE for that table | **Necessary — Tenant Drive Read** | No — additive only |
| 11 | `scripts/test-device-media-provider.ts` | Modified: DMP-09…12 + DMP-C1 | **Necessary — tests** | No |
| 12 | `docs/diagnostics/TENANT-DRIVE-MEDIA-READ-INTEGRATION-PLAN.md` | Untracked | **Necessary — documentation** | N/A |
| 13 | `docs/diagnostics/TENANT-DRIVE-MEDIA-READ-IMPLEMENTATION-REPORT.md` | Untracked | **Necessary — documentation** | N/A |
| 14 | `docs/diagnostics/TENANT-DRIVE-MEDIA-READ-REVIEW.md` | Untracked | **Necessary — documentation** | N/A |

**Ambiguous / preexistente / unrelated in this list:** none.  
**Preexisting WIP outside list (do not include):** RBAC/R2/PV-MF diagnostics & harnesses; `DEVICE-MEDIA-PROVIDER-AWARE-FIX.md` (prior provider-aware note only).

### 11.2 C1 test coverage check

| Criterion | Covered? | Where |
|-----------|----------|--------|
| Range start = 0 | Yes | C1 `bytes=0-3` exact + full-body |
| Range start ≠ 0 | Yes | C1 `bytes=4-7` exact + full-body + Tenant Drive mock |
| Range at EOF | Yes | C1 `bytes=12-15` |
| Oversized body covering window | Yes | `normalizeRangedBody` full-body + full-body provider + DMP-C1 |
| Oversized unmappable offset | Yes | `normalizeRangedBody` throw (`Buffer.alloc(8)` vs `[10,15]`) |
| Bytes ↔ Content-Range ↔ Content-Length ↔ status | Yes | `assertRange` + DMP-C1 |
| R2 regression | Yes | DMP-02/03 R2-like Range; resolve `r2→r2`; factory r2 tests |

**Lacunas (não bloqueantes):**

- Suffix ranges (`bytes=-N`) not explicitly tested (pre-existing `parseRangeHeader` behaviour; out of C1 scope).  
- No live Drive / Preview HTTP.  
- Production **build not approved** (env/Turbopack isolation failure).  
- `tsc` still fails only on unrelated WIP `scripts/run-r2-isolation-preview.ts` TS2367 (file **not** in pathspec).

### 11.3 Minimal exact commit set

All **14** paths in §9 — no hunk-level splitting required (no mixed files).  
Suggested pathspec when authorized:

```text
git add -- \
  "src/app/api/device/media/[assetId]/route.ts" \
  src/services/media/index.ts \
  src/services/media/serve-device-object.ts \
  src/services/media/google-drive-tenant-provider.ts \
  src/services/media/media-storage-resolve.test.ts \
  src/services/tenant-storage.ts \
  src/lib/drive-token-crypto.ts \
  src/lib/google-drive-oauth.ts \
  src/db/schema.ts \
  src/db/client.ts \
  scripts/test-device-media-provider.ts \
  docs/diagnostics/TENANT-DRIVE-MEDIA-READ-INTEGRATION-PLAN.md \
  docs/diagnostics/TENANT-DRIVE-MEDIA-READ-IMPLEMENTATION-REPORT.md \
  docs/diagnostics/TENANT-DRIVE-MEDIA-READ-REVIEW.md
```

### 11.4 Gate recommendation

### **PRONTO PARA AUTORIZAÇÃO DE COMMIT**

- 14/14 proposed files are exclusively Tenant Drive Read + C1 + tests/docs.  
- No mixed hunks with unrelated WIP.  
- Staged area empty; WIP elsewhere preserved.  
- Build not claimed; `tsc` WIP error remains outside the commit.  
- **This gate did not run `git add`, `git commit`, push, deploy, or remote ops.**
