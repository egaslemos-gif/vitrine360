# Tenant Drive — device-media read implementation (local)

**Date:** 2026-10-18  
**Branch / HEAD (base):** `security/rbac-p0-p1` @ `23dc698` (working tree dirty — not committed)  
**Plan:** `docs/diagnostics/TENANT-DRIVE-MEDIA-READ-INTEGRATION-PLAN.md`  
**Scope:** local implementation + unit validation only — **no commit, push, deploy, env, or remote data changes.**

---

## 1. Preflight

| Check | Result |
|-------|--------|
| Branch | `security/rbac-p0-p1` |
| HEAD | `23dc69837648674df6b988138d6d0183455fa349` |
| WIP | Preserved (RBAC/R2 docs, smoke harnesses, prior diagnostics) |
| Destructive git | Not used |

---

## 2. Files ported / added

| File | Origin | Notes |
|------|--------|-------|
| `src/lib/drive-token-crypto.ts` | Copied from main `Vitrine360` | AES-GCM refresh-token crypto |
| `src/services/media/google-drive-tenant-provider.ts` | Copied from main | Includes native `getObjectRange` + 2 MiB `getObject` cap |
| `src/lib/google-drive-oauth.ts` | **Adapted subset** of main | Only `isTenantDriveEnabled` + `refreshDriveAccessToken` (no connect/PKCE/UI) |
| `src/services/tenant-storage.ts` | **Adapted subset** of main | Read path: config load, token refresh/cache, `tryTenantGoogleDriveProvider` |
| `src/db/schema.ts` | Table def from main | Added `tenantStorageConfigs` |
| `src/db/client.ts` | Pattern from main | `ensureSchema` CREATE TABLE IF NOT EXISTS for local self-heal |

### Proxy / resolver changes

| File | Change |
|------|--------|
| `src/services/media/index.ts` | Added `resolveMediaStorageForAsset` — Drive → Tenant Drive only (**no SA / no R2 fallback**) |
| `src/app/api/device/media/[assetId]/route.ts` | After device auth + asset `id+tenantId` query → `await resolveMediaStorageForAsset({… asset.tenantId })` → `serveDeviceObject` |

### Tests updated

| File | Change |
|------|--------|
| `src/services/media/media-storage-resolve.test.ts` | Resolve + Tenant Range mock + credential non-leak |
| `scripts/test-device-media-provider.ts` | DMP-09…12 unit cases |

---

## 3. Tenant validation (preserved)

Order unchanged and reinforced:

1. `authenticateDevice` → **401** if missing/invalid  
2. `SELECT media_assets WHERE id=? AND tenant_id=device.tenantId` → **404** if miss / cross-tenant  
3. Only then `resolveMediaStorageForAsset` with **`asset.tenantId`** (token cache keyed by that tenant)  
4. Provider / OAuth failures → **502 Media unavailable** (server log truncated; no tokens in response)

Cross-tenant: still impossible to reach another tenant’s Drive tokens because the asset row never loads.

---

## 4. Behaviour summary

| Provider | Resolve path | Range |
|----------|--------------|-------|
| `r2` | `getMediaStorageFor("r2")` | Native `getObjectRange` (unchanged) |
| `local` | `getMediaStorageFor("local")` | Unchanged |
| `google_drive` | `tryTenantGoogleDriveProvider(tenantId)` | Native HTTP Range to Drive API |
| Drive disconnected / flag off | Throw → route **502** | N/A — **no** `GOOGLE_DRIVE_*` SA fallback |

`serveDeviceObject` preserved. Manifest / TTL 604800 untouched.

---

## 5. Test results (local)

### `npm run test:device-media-provider`

- `media-storage-resolve.test.ts`: **19 PASS** (factory + resolve + Tenant Range mocks)  
- Script DMP-01…12: **12 PASS**  
- Exit **0**

Explicit unit coverage:

| Case | Kind |
|------|------|
| R2 still resolves / serves / Range 206 | Unit (fake + real factory) |
| Drive resolve without Tenant Drive → fail closed | Unit |
| Tenant `getObjectRange` → 206 via `serveDeviceObject` | Unit (mocked `fetch`) |
| Auth error messages omit credentials | Unit |
| Cross-tenant / missing asset at HTTP route | **Not re-run remotely**; SQL guard unchanged from `23dc698` |

**Not claimed:** live Google Drive OAuth / Preview byte delivery (requires authorized deploy + CONNECTED tenant config).

### `npm run test:manifest-tenant-safe`

- **7 PASS**, 1 NOT_RUN (MF-06b) — Exit **0**

### TypeScript

`npx tsc --noEmit` still reports pre-existing WIP issue only:

`scripts/run-r2-isolation-preview.ts(56,46): error TS2367`  

No new errors attributed to ported Tenant Drive / device-media files in the filtered check.

---

## 6. Dependencies still absent on this branch

Intentionally **not** ported (not required for device-media read if Preview already has CONNECTED rows):

- Admin Drive connect/disconnect routes & UI  
- Full `google-drive-oauth` PKCE / cookie / identity helpers  
- `completeDriveOAuthConnect` / `disconnectTenantDrive`  
- Upload path `resolveMediaStorageForUpload`  

**Runtime requirements on Preview (already present per prior audit):**

- `TENANT_DRIVE_ENABLED`  
- `DRIVE_TOKEN_ENCRYPTION_KEY` (or derivable via `AUTH_SECRET`)  
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (token refresh)  
- `tenant_storage_configs` row `status=CONNECTED` for the asset’s tenant  

**Not introduced:** `GOOGLE_DRIVE_CLIENT_EMAIL` / `PRIVATE_KEY` / `FOLDER_ID`.

---

## 7. Limitations

1. Unit tests use mocked `fetch` — **Preview smoke still required** before declaring Drive playback fixed.  
2. Tenant `getObject` refuses >2 MiB; playback must use Range (tenant provider + `serveDeviceObject` prefer `getObjectRange`).  
3. Connect UI not on this branch — cannot reconnect Drive from this tree without further ports.  
4. Working tree uncommitted; Production untouched.

---

## 8. Rollback

1. Discard or revert local changes to: device-media route, `media/index.ts`, schema/client, and the four ported modules + tests/docs.  
2. Keep commit `23dc698` if R2-only provider-aware behaviour is still desired.  
3. Do not revert Manifest Tenant-Safe `93660dd`.  
4. No env/alias rollback (none changed).

---

## 9. Next step (needs separate authorization)

Commit → push `security/rbac-p0-p1` → Preview deploy → smoke Drive IMAGE/VIDEO with CONNECTED tenant (reuse prior DMP harness). No Production promotion.
