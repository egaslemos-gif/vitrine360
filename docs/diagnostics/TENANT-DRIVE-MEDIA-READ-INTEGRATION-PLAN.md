# Tenant Drive — device-media read integration plan

**Date:** 2026-10-18  
**Branch / HEAD:** `security/rbac-p0-p1` @ `23dc69837648674df6b988138d6d0183455fa349`  
**Preview deploy (evidence):** `dpl_9ascwjRz9MB9ZguoG2yvvmFj9MCu`  
**Scope of this document:** audit + recommendation only — **no code, env, data, commit, push, or deploy changes.**  
**WIP:** preserved (unrelated RBAC/R2 docs and harnesses remain local).

---

## 1. Cause confirmed (502 on Drive)

| Layer | Observation |
|-------|-------------|
| Routing (`23dc698`) | Device proxy loads asset by `id + device.tenantId`, then calls `getMediaStorageFor(asset.storageProvider)`. Logs show `storageProvider: 'google_drive'` — **not** R2 key lookup. |
| Provider constructed | `getMediaStorageFor("google_drive")` → env **service-account** `GoogleDriveProvider`. |
| Runtime error (server) | `Missing GOOGLE_DRIVE_CLIENT_EMAIL or GOOGLE_DRIVE_PRIVATE_KEY` |
| Client | Opaque `502 Media unavailable` |
| Preview env | Has `TENANT_DRIVE_ENABLED`, `DRIVE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. **Lacks** `GOOGLE_DRIVE_CLIENT_EMAIL` / `GOOGLE_DRIVE_PRIVATE_KEY` / `GOOGLE_DRIVE_FOLDER_ID`. |
| Asset origin | Preview Drive assets were uploaded under **per-tenant OAuth** (`drive.file` + app-created folder), not under a platform service account. |

**Root cause:** provider **name** is correct; credential **model** is wrong for Preview. The proxy never uses `tenant_storage_configs` / encrypted refresh tokens on this branch.

---

## 2. Current flows (as deployed vs existing Tenant Drive)

### 2.1 Device media on `security/rbac-p0-p1` (`23dc698`)

```
authenticateDevice(token) → 401 if no tenantId
SELECT media_assets WHERE id=? AND tenant_id=device.tenantId → 404 if miss
getMediaStorageFor(asset.storageProvider)   // sync; ignores tenantId
serveDeviceObject(storage, asset.storageKey, Range…)
```

- Tenant gate **before** storage I/O: **yes** (asset row must match device tenant).
- File id: `media_assets.storage_key` (Drive file id, typically a single segment).
- SA `GoogleDriveProvider` on this branch: **`getObject` only** (no `getObjectRange`). Range in `serveDeviceObject` falls back to full download + in-memory slice.

### 2.2 Tenant Drive stack (main workspace WIP — **not on this branch**)

Present under `Vitrine360` (not in `Vitrine360-rbac-security`):

| Piece | Role |
|-------|------|
| `tenant_storage_configs` | Per-tenant row: encrypted refresh token, folder id, status `CONNECTED` / … |
| `src/lib/drive-token-crypto.ts` | AES-GCM at rest (`DRIVE_TOKEN_ENCRYPTION_KEY` or HKDF(`AUTH_SECRET`)) |
| `src/lib/google-drive-oauth.ts` | Connect OAuth + `refreshDriveAccessToken` via **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** |
| `src/services/tenant-storage.ts` | `getTenantDriveAccessToken`, `tryTenantGoogleDriveProvider`, connect/disconnect |
| `src/services/media/google-drive-tenant-provider.ts` | `MediaStorageProvider` using user OAuth token |
| `resolveMediaStorageForAsset` | Async resolve: Drive → tenant provider first, then SA fallback if env present; **never** silent R2 fallback |

**Tenant determination for read:** always `asset.tenantId` (after the device+asset tenant SQL check). Token cache keyed by `tenantId` (≤5 min in-process).

**Token renew:** decrypt refresh → `refreshDriveAccessToken` → cache access token. Revoked refresh → status `REVOKED`, cache invalidated. Tokens never returned to the client.

**File read (`GoogleDriveTenantProvider`):**

- `storageKey` = Drive file id in URL  
  `GET https://www.googleapis.com/drive/v3/files/{id}?alt=media`
- **`getObjectRange(start,end)`** — sends HTTP `Range` to Drive (**native partial read**).
- **`getObject`** — full download with **hard cap 2 MiB** (forces Range for large media).
- `headObject` — size/mime for total length.

Main’s **admin** `/api/media/[...key]` and **device** `/api/device/media/[assetId]` already call `resolveMediaStorageForAsset`. Security branch device proxy still uses the thinner `getMediaStorageFor`.

---

## 3. Option A — Tenant Drive (recommended)

### Fit with Preview

- Matches how Preview assets and env are already set up (`TENANT_DRIVE_*` + OAuth client).
- Reuses existing encrypt/refresh/folder semantics; no new Vercel secrets for SA.
- Tenant provider **already implements `getObjectRange`**, so `serveDeviceObject`’s preferred Range path applies (chunked large GETs without loading the whole file into one buffer).

### Compatibility with device proxy

| Concern | Assessment |
|---------|------------|
| Auth order | Keep: device auth → asset+tenant SQL → **then** `tryTenantGoogleDriveProvider(asset.tenantId)` → serve |
| Cross-tenant | Unchanged 404 if asset.tenant ≠ device.tenant; token lookup only for **asset.tenantId** |
| Range / 206 | Supported via tenant `getObjectRange` + existing `serveDeviceObject` |
| Large video | Prefer Range/chunked; avoid full `getObject` (tenant provider refuses >2 MiB on full get) |
| Disconnected Drive | `tryTenant…` returns null → fail closed with 502 (do **not** fall back to R2) |

### Exact touch points (minimal on `security/rbac-p0-p1`)

**Call site (required):**

1. `src/app/api/device/media/[assetId]/route.ts`  
   Replace `getMediaStorageFor(asset.storageProvider)` with async resolve that receives `{ storageProvider, tenantId: asset.tenantId }` (same pattern as main’s `resolveMediaStorageForAsset`). Keep `serveDeviceObject` unchanged.

**Resolver (required):**

2. `src/services/media/index.ts`  
   Add `resolveMediaStorageForAsset` (or equivalent):  
   - `r2` / `local` → existing factories  
   - `google_drive` → `tryTenantGoogleDriveProvider(tenantId)` first; optional SA fallback only if SA env present; **never** `getMediaStorage()` for Drive rows  

**Modules to bring onto this branch (reuse, do not invent):**

3. `src/services/tenant-storage.ts` — at least read path: config load, access-token refresh/cache, `tryTenantGoogleDriveProvider`  
4. `src/services/media/google-drive-tenant-provider.ts`  
5. `src/lib/drive-token-crypto.ts`  
6. `src/lib/google-drive-oauth.ts` (refresh + `isTenantDriveEnabled`; shares `GOOGLE_CLIENT_*` with connect)  
7. `src/db/schema.ts` — `tenantStorageConfigs` table definition + `ensureSchema` path  

**Already sufficient if present after port:** `serve-device-object.ts`, device auth, rate limit, opaque 502.

**Out of minimal read scope (unless missing on Preview DB):** OAuth connect UI/routes, folder provisioning — only needed if table/rows absent. Preview already has Tenant Drive env and existing Drive assets ⇒ assume CONNECTED configs exist for those tenants; verify in a later authorized smoke (read-only status check, no token dump).

**Not required for Option A:** new Vercel variables, ACL/alias changes, schema migrations on Production, login changes, manifest/TTL changes.

---

## 4. Option B — Service Account (`GOOGLE_DRIVE_*`)

### Variables required by SA provider (this branch)

| Variable | Used for |
|----------|----------|
| `GOOGLE_DRIVE_CLIENT_EMAIL` | JWT `iss` for SA token |
| `GOOGLE_DRIVE_PRIVATE_KEY` | JWT signing |
| `GOOGLE_DRIVE_FOLDER_ID` | Upload folder (`put`); not sufficient alone to authorize arbitrary file ids |

Optional: `GOOGLE_DRIVE_PUBLIC_ACCESS` (URL shape only on some variants).

Refresh path for Tenant Drive uses **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`**, not the SA trio — different credential class.

### Isolation / permission implications

- SA can only read files **shared with that SA** (or in a drive it owns). Tenant OAuth `drive.file` files live in the **connecting user’s** Drive under an app-created folder — **not** accessible to an unrelated SA unless explicitly shared.
- A single platform SA with broad Drive access would weaken multi-tenant isolation (one credential spanning tenants) and still would not magically open existing tenant-owned file ids.
- Setting SA env on Preview **without** sharing every asset to the SA would keep returning 502/403 at the Drive API layer.

### Verdict on B for this incident

**Not suitable as the primary fix** for current Preview assets. Would require env changes (not authorized here) **and** file sharing/migration work that Tenant Drive already solved per tenant.

Keep SA only as an optional **legacy fallback** when `GOOGLE_DRIVE_*` is present and tenant config is disconnected (as main’s `resolveMediaStorageForAsset` already does).

---

## 5. Comparison

| Criterion | A — Tenant Drive | B — Service Account |
|-----------|------------------|---------------------|
| Matches Preview env | Yes (`TENANT_DRIVE_*`, OAuth client) | No (SA keys absent) |
| Matches asset ownership | Yes (same OAuth / folder) | No unless re-share/migrate |
| Multi-tenant isolation | Per-tenant refresh token + folder | Shared SA → weak / wrong model |
| Range / memory | Native `getObjectRange` on tenant provider | SA on this branch: full `getObject` + slice; main SA has Range but still wrong ACL |
| Env changes needed | None (if CONNECTED rows exist) | Add `GOOGLE_DRIVE_*` + sharing |
| Code on security branch | Port existing modules + swap resolve call | Small resolve change but operationally insufficient |
| Risk to Production | Low if Preview-only deploy; no env edit | Env + ACL blast radius |

**Recommendation: Option A.**

---

## 6. Minimal implementation proposal (for a future authorized change)

1. Port Tenant Drive **read** dependencies onto `security/rbac-p0-p1` (or cherry-pick the already-working main resolve path).  
2. In device-media route, after asset load:  
   `storage = await resolveMediaStorageForAsset({ storageProvider: asset.storageProvider, tenantId: asset.tenantId, storageKey: asset.storageKey })`.  
3. Keep `serveDeviceObject` for Range/206/headers.  
4. Preserve fail-closed messages: 401 / 404 / `502 Media unavailable` (log truncated server message only).  
5. Do **not** change login, manifest, TTL `604800`, Production env, or aliases.  
6. Prefer aligning with main’s `resolveMediaStorageForAsset` to avoid two divergent resolvers.

**Security multi-tenant checklist**

- [ ] Storage I/O only after `device.tenantId` + asset row match  
- [ ] Drive tokens loaded only for `asset.tenantId`  
- [ ] No R2 fallback for `storage_provider=google_drive`  
- [ ] No tokens/signed URLs in logs, responses, or diagnostics  
- [ ] Cross-tenant device → 404  
- [ ] Disconnected / revoked Drive → 502 opaque  

---

## 7. Tests required (after authorized implementation)

### Local

- Unit: resolve Drive → tenant provider when CONNECTED mock; SA fallback only with SA env; never R2 for Drive.  
- Fake provider: Range → 206 via `getObjectRange`; full get capped behaviour.  
- Re-run `npm run test:device-media-provider` and `npm run test:manifest-tenant-safe`.  

### Preview (authorized smoke)

- Confirm tenant of borrowed Drive asset has `tenant_storage_configs.status=CONNECTED` (metadata only — no token values).  
- Same-tenant device → IMAGE 200 + Content-Type; VIDEO Range 206 + Content-Range + byte check.  
- Cross-tenant → 404; bad auth → 401.  
- Player: offlineUrl fetch no longer `Media unavailable` for Drive items.  
- Cleanup: only synthetic resources from that run.  

---

## 8. Memory / latency / Range risks

| Path | Risk | Mitigation (already in tenant provider / serve helper) |
|------|------|--------------------------------------------------------|
| Tenant `getObjectRange` | Low memory per request (chunk size) | Use for Range and chunked full GET |
| Tenant `getObject` | Cap 2 MiB — large full GET without Range fails | Player/TV should send Range; proxy chunked path uses range API |
| SA `getObject` (security branch) | Full object in memory | Avoid as primary path |
| Token refresh storm | Latency on cold cache | In-process cache ≤5 min per tenant |
| Drive API latency | Extra RTT vs R2 | Expected; no load tests in smoke |

**Documented limitation if only SA path were used:** full `getObject` + slice (no native Range on security-branch SA). **With Option A, that limitation does not apply** for the tenant provider.

---

## 9. Rollback plan

1. Revert the integration commit(s) that wire `resolveMediaStorageForAsset` / port Tenant Drive read modules; keep `23dc698` if R2-only fix still desired, or revert both if necessary.  
2. **Do not** revert Manifest Tenant-Safe `93660dd` unless separately decided.  
3. No DB wipe; no env rollback required for Option A (no new vars).  
4. Disconnecting Tenant Drive in admin remains the operational kill-switch for that tenant’s Drive bytes (existing behaviour: playback 502 until reconnect or re-upload).

---

## 10. Recommendation (stop here)

**Implement Option A** on `security/rbac-p0-p1`: reuse Tenant Drive OAuth tokens via `tryTenantGoogleDriveProvider` / `resolveMediaStorageForAsset`, called from `/api/device/media/[assetId]` **after** device+asset tenant validation.

**Do not** pursue Option B (service-account env) as the fix for current Preview Drive assets.

No code or remote configuration was changed in this audit phase.
