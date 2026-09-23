# Vitrine360 — Phase 3A Media Library Implementation

**Date:** 2026-09-21  
**Audit basis:** `docs/MEDIA-CONTENT-STUDIO-AUDIT.md`  
**Scope:** Media Library UX + safe MediaAsset delete only

---

## 1. Scope

### In scope

- GIF MIME filter (`image/gif`) in Media Library
- USED / UNUSED usage filter (via ContentAsset count)
- `DELETE /api/admin/media/[id]`
- UI delete with confirmation (unused only)
- Tenant isolation + IDOR tests
- Activity `MEDIA_DELETED`
- Automated regression script `npm run test:media-3a`

### Out of scope (unchanged)

- Player / Display Engine / Legacy / Sync / Manifest / SW / IndexedDB
- Auth / Membership / RBAC model (reuse `manage_contents`)
- Content Studio, GIF content type, fitMode, transitions, Preview Renderer, Experience

---

## 2. Existing Architecture (preserved)

```
MediaAsset → ContentAsset → Content → PlaylistItem → Playlist → Schedule → Device
```

- Physical identity: `UNIQUE(tenantId, checksum)` + SHA-256
- Usage: `COUNT(DISTINCT contentId)` from `content_assets`
- Storage: `MediaStorageProvider` (local / google_drive / r2)
- Permission: `manage_contents` (EDITOR+, not OPERATOR/VIEWER)

---

## 3. Changes

| Area | Change |
|------|--------|
| Filters | `src/features/media/media-library-filters.ts` — MIME GIF + usage helpers |
| UI | `media-library.tsx` — Type GIF, Utilização USED/UNUSED, Eliminar + dialogs |
| Page | `/admin/media` passes `canDelete` (page already gated) |
| Service | `deleteMediaAsset` — PT in-use message, storage-fail safe, `MEDIA_DELETED` |
| API | `DELETE /api/admin/media/[id]` |
| Errors | `handleApiError`: not found → **404**; in-use / storage fail → **409** |
| Tests | `scripts/test-media-library-3a.ts` + `npm run test:media-3a` |

**Not changed:** upload sniff/dedupe architecture, Content delete, Player stack, dedupe-by-filename helper (documented risk only).

---

## 4. Delete API

```
DELETE /api/admin/media/:id
```

Flow:

```
requireSession("manage_contents")
  → tenantId from session
  → deleteMediaAsset(id, tenantId, userId)
       → lookup id+tenant
       → ContentAsset dependency check
       → storage.delete(storageKey)
       → DB delete
       → logActivity MEDIA_DELETED
```

Response success: `{ ok: true, id }`  
In use: **409** + Portuguese message  
Missing / other tenant: **404** `Media asset not found` (no existence leak)  
No permission: **403** Forbidden  
No session: **401**

No `force=true`. No admin bypass.

---

## 5. Delete Safety

| Condition | Result |
|-----------|--------|
| ≥1 ContentAsset | DENIED (409) |
| 0 ContentAssets | ALLOW → storage then DB |
| Wrong tenant | 404 |
| Storage delete throws | DB **not** deleted; 409 |

Content delete still does **not** delete MediaAssets (reuse-safe).

---

## 6. Filters

| Filter | Values | Rule |
|--------|--------|------|
| Type | ALL / IMAGE / VIDEO / GIF | MIME: non-gif `image/*`, `video/*`, exact `image/gif` |
| Usage | ALL / USED / UNUSED | `usageCount > 0` / `=== 0` |
| Sort | NAME / RECENT / SIZE | unchanged |
| Search | filename contains | client-side, unchanged |

GIF is **not** a `CONTENT_TYPE`. Filter only.

---

## 7. Usage

`listMediaAssetsWithUsage` — `count(distinct content_assets.contentId)`.  
Does **not** count PlaylistItems.

UI: `Usado em N conteúdo(s)`.

---

## 8. RBAC

| Role | `manage_contents` | Media page / DELETE |
|------|-------------------|---------------------|
| VIEWER | no | DENIED (page + API) |
| OPERATOR | no | DENIED |
| EDITOR | yes | ALLOW |
| ADMIN | yes | ALLOW |
| SUPER_ADMIN | yes | ALLOW (active membership) |

No new `manage_media` permission.

UI hides Eliminar for in-use assets and for callers without `canDelete`. API remains authority.

---

## 9. Tenant Isolation

All list/get/upload/delete paths filter `tenantId`.  
Cross-tenant delete and `createContent({ mediaAssetId: foreign })` → not found.

---

## 10. IDOR Tests

Covered in `test-media-library-3a.ts`:

- List A does not include B assets
- `deleteMediaAsset(B, tenantA)` rejects
- `createContent` with B’s `mediaAssetId` under A rejects
- `getMediaAsset(A, tenantB)` null

---

## 11. Storage

Order: **storage.delete → DB delete**.

| Provider | Delete failure behaviour |
|----------|--------------------------|
| LocalFs | Missing file ignored (idempotent) |
| R2 / Drive | Thrown errors abort before DB delete |

**Limitation (documented):** storage success + DB failure can leave an orphan blob (no cross-system transaction). No false success returned if either step throws before completion.

---

## 12. Activity

Action: `MEDIA_DELETED`  
Metadata: `mediaAssetId`, `fileName`, `tenantId`  
No signed URLs / secrets.

---

## 13. UI

- Preserved: search, sort, dedupe collapse, usage, image lightbox, video metadata/controls, “Usar em Conteúdo”
- Added: GIF filter + GIF section, USED/UNUSED, Eliminar (unused only), confirm dialog, a11y labels / Escape on dialogs
- In-use assets: no destructive button (API still enforces)

---

## 14. Automated Tests

`npm run test:media-3a` covers filters, upload (image/video/gif), MIME reject, SHA-256 dedupe, usage, delete unused/used/missing/cross-tenant, RBAC permission matrix, activity, LocalFs idempotent delete, content reuse, list isolation.

**Size rejection:** `MAX_UPLOAD_BYTES` is fixed at module load; full oversized-buffer test is environment-dependent and not re-run in-process (see Known Gaps).

Included in `npm test`.

---

## 15. Regression

| Check | Status |
|-------|--------|
| `npm run test:media-3a` | PASS |
| `npm test` | PASS (domain, tenant, security, runtime, acceptance, saas, rbac, media-3a) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS (includes `/api/admin/media/[id]`) |
| Player / Manifest / Sync / Offline | not modified |
| ESLint (changed files) | PASS |

---

## 16. Known Gaps

1. **Client-side full list** — Media Library still loads all tenant assets into the browser. OK ~1k; weak at 10k+; pagination/server search deferred.
2. **Dedupe filename fallback** — empty-checksum rows can still group by `name:{fileName}`; checksum-only preferred later.
3. **MAX_UPLOAD in-process** — limit captured at import.
4. **Orphan blob** if DB delete fails after storage delete.
5. **CONTENT_TYPE GIF / GIF playback policy** — Phase 3C.
6. **Full device Manifest→Sync→Offline chain** — Player pairing UI verified; end-to-end HDMI/device sync not re-run in this smoke.
7. **Minor UI copy** — “Usado em 0 conteúdo s” line-break plural when count is 0 (cosmetic).

---

## 17. Validation Status

| Gate | Status |
|------|--------|
| **IMPLEMENTED** | YES |
| **SOFTWARE VALIDATED** | YES (`typecheck` + `npm test` + `build`) |
| **PRODUCTION DEPLOYED** | YES |
| **PRODUCTION VALIDATED** | YES |

### Production deployment

| Field | Value |
|-------|--------|
| URL | https://vitrine360-psi.vercel.app |
| Deployment | `dpl_HvMBxT31RPBZ7CDyDMEBmgZ5UvX8` |
| Alias | https://vitrine360-psi.vercel.app |
| Inspect | https://vercel.com/egaslemos-5751s-projects/vitrine360/HvMBxT31RPBZ7CDyDMEBmgZ5UvX8 |
| Ready | 2026-09-21 |

### PRODUCTION VALIDATION

| Test | Result |
|------|--------|
| Production deployment | **PASS** — prod alias live, build READY |
| Admin login | **PASS** — Google session ADMIN; workspace “Egas Luís Frederico Lemos”; Media nav visible. Password login also PASS for EDITOR/VIEWER smoke users |
| Media Library | **PASS** — `/admin/media` search, sort, type, usage filters present |
| GIF filter | **PASS** — Tipo=GIF shows only `image/gif` section |
| Upload | **PASS** — PNG / GIF / MP4 via `POST /api/admin/media`; MIME sniffed correctly (`image/png`, `image/gif`, `video/mp4`); R2 storage |
| Deduplication | **PASS** — re-upload same PNG bytes returned same `MediaAsset.id` (count stayed 3, not 4) |
| Content reuse | **PASS** — `POST /api/admin/contents` with existing `mediaAssetId`; content created; no second physical asset |
| Delete unused | **PASS** — API 200 + UI confirm dialog; asset removed; `/admin/logs` contains `MEDIA_DELETED` |
| Delete used | **PASS** — API **409** “Este ficheiro está a ser utilizado…”; Content + MediaAsset remain |
| RBAC | **PASS** — EDITOR: list/upload/create/delete unused **200**; VIEWER: media/content/dedupe **403 Forbidden** (API, not UI-only) |
| Tenant isolation | **PASS** — Tenant B media created in prod Turso; Tenant A list excludes it |
| IDOR | **PASS** — ADMIN `DELETE` / `createContent` with Tenant B `mediaAssetId` → **404** `Media asset not found`; service-layer asserts also PASS |
| Regression | **PASS** — Contents API, Playlists API, `/player` pairing UI load; Player/Sync/Manifest code untouched |

### Phase 3A final status

```
PHASE 3A STATUS:
PRODUCTION VALIDATED
```

Smoke artefacts (non-product): temporary EDITOR/VIEWER members and Tenant B smoke tenant created during validation; safe to leave or clean later by operator.
