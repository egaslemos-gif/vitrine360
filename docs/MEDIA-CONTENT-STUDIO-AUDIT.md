# Vitrine360 — Media & Content Studio Architecture Audit (Phase 3)

**Date:** 2026-09-21  
**Status:** AUDIT ONLY — no product code changes in this phase  
**Context:** Phase 1 (Identity + Membership + Google Auth) and Phase 2 (Workspace + RBAC) are production-validated. This audit maps the existing Media / Content / Playlist stack before any Content Studio implementation.

**Hard constraints respected:** no changes to Player, Runtime, Sync Engine, Manifest Engine, Service Worker, IndexedDB, Device pairing, Authentication, Membership, or RBAC.

---

## 1. Executive Summary

The core domain already encodes the correct Digital Experience Management pipeline:

```
MediaAsset (physical file)
    ↓ ContentAsset
Content (logical unit)
    ↓ PlaylistItem (playback config)
Playlist
    ↓ Schedule / Device.currentPlaylistId
Device → Manifest → Sync → Runtime
```

This is **not** a Content→Device shortcut. Presentation (`fitMode`), transition, and duration override live on **PlaylistItem**, so the same Content can render differently in different playlists.

**What already works (evidence in code):**

- Tenant-scoped `media_assets` with SHA-256 content-addressing and upload-time deduplication
- `MediaStorageProvider` abstraction (local / Google Drive / R2)
- Content create with **upload OR library select**
- Natural video duration (`VIDEO` + `durationMs = 0`)
- Manifest refresh of playback URLs + offline device media proxy
- RBAC via Phase 2 permission `manage_contents` / `manage_playlists`

**What is incomplete or inconsistent (must guide Phase 3):**

| Area | Verdict |
|------|---------|
| GIF as MIME under IMAGE | PARTIAL (upload + `<img>` animate; no GIF content type / filter / natural-loop policy) |
| Content type `GIF` | NOT IMPLEMENTED |
| Media single-delete API/UI | NOT IMPLEMENTED (service exists) |
| Transition contract | Domain ≠ UI ≠ Legacy class names |
| `fitMode` presentation | Stored + UI + manifest; **not applied** in React or Legacy renderers |
| Dedicated Content Studio (`/admin/contents/[id]`) | NOT IMPLEMENTED (single page create+list) |
| Dedicated Content Preview | NOT IMPLEMENTED (playlist timed preview only) |
| EXPERIENCE / HTML sandbox | Explicitly out of scope — architecture hooks only |
| IDOR automated tests for pickers | NOT FOUND |

**Final verdict (see §29):**  
**ARCHITECTURE AUDIT — APPROVED WITH ACTION ITEMS**

---

## 2. Current Architecture

### 2.1 Layer map

| Layer | Responsibility | Primary locations |
|-------|----------------|-------------------|
| Physical asset | File bytes + checksum + storage key | `media_assets`, `src/services/media/*`, `uploadMediaAsset` |
| Logical content | Title, type, duration, payload, status | `contents`, `src/services/contents.ts` |
| Link | N:M Content↔MediaAsset | `content_assets` |
| Playback config | Order, duration override, transition, fit | `playlist_items` |
| Distribution | Versioned playlist list for a device | `schedules`, `devices.currentPlaylistId`, `buildDeviceManifest` |
| Hardware / runtime | Offline sync + playback | `/api/device/*`, `src/player/*`, `public/tv.js` |

### 2.2 Preserved pipeline (non-negotiable)

```
Content → Playlist → Schedule → Device
```

Do **not** introduce sector-specific tables (`BankContent`, `RestaurantContent`, …). Sector is usage context, not a domain fork.

### 2.3 Admin surfaces today

| Route | Purpose |
|-------|---------|
| `/admin/media` | Media Library list, filters (image/video), dedupe |
| `/admin/contents` | Create form + list/edit/delete (single page) |
| `/admin/playlists/[id]` | Playlist builder: ContentPicker, presentation, transitions, timed preview |

There is **no** `/admin/contents/[id]` detail studio yet.

---

## 3. Media Library

### 3.1 Current UX (`src/features/media/media-library.tsx`)

Exists today:

- Search by filename
- Filter: `all` \| `image` \| `video` (GIF counted as image via `mime.startsWith("image/")`)
- Sort: name / recent / size
- Duplicate collapse + “Remover N duplicados”
- Usage count: “Usado em N conteúdo(s)”
- Image lightbox preview; video shows metadata (no full player in library)
- CTA to create content with `?mediaAssetId=`

Missing (propose only — not implement):

- Dedicated GIF filter
- Unused / used-only filter
- Date range filter
- Single-asset delete with safety dialog
- Pagination / virtualization for 1k–100k assets
- Server-side search

### 3.2 APIs

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/admin/media` | `manage_contents` |
| POST | `/api/admin/media` | `manage_contents` (upload only) |
| POST | `/api/admin/media/deduplicate` | `manage_contents` |
| DELETE | `/api/admin/media/[id]` | **NOT IMPLEMENTED** |

---

## 4. MediaAsset

### 4.1 Schema (`media_assets`)

| Field | Notes |
|-------|-------|
| `id`, `fileName`, `mimeType`, `fileSize` | Identity + client-facing metadata |
| `storageProvider`, `storageKey`, `url` | Provider + locator + last known URL |
| `width`, `height`, `durationMs` | **Nullable; never populated on upload today** |
| `checksum` | `sha256:{hex}`; unique with `tenantId` |
| `tenantId` | FK tenants, cascade |
| `createdAt` | |

Unique index: `(tenantId, checksum)` → per-tenant content addressing.

### 4.2 How a MediaAsset is created

1. `uploadMediaAsset` (`src/services/contents.ts`) or `POST /api/admin/media` / multipart content create.
2. Enforce `MAX_UPLOAD_BYTES` (default 50 MiB).
3. Compute SHA-256 → `sha256:{hex}`.
4. If row exists for `(tenantId, checksum)` → **return existing** (no second `put`).
5. `safeFileExtension` + `sniffMime` (magic bytes); reject if MIME ∉ allowlist.
6. Key `{tenantId}/{uuid}.{ext}` → `getMediaStorage().put(...)`.
7. Insert row; on UNIQUE race, delete orphan blob and return winner.

### 4.3 SHA-256

- Pre-put in service (authoritative for DB).
- Recomputed inside each provider `put` (returned `checksum` should match).
- Player sync re-hashes downloads (`src/player/sync/engine.ts` + `checksumMatches`).

### 4.4 Deduplication

| Mechanism | Behavior |
|-----------|----------|
| Upload-time | Same checksum → reuse row, no re-upload |
| Admin `deduplicateMediaAssets` | Groups by checksum (or `name:{fileName}` if checksum empty); remaps `content_assets`; deletes losers |

**Risk:** filename grouping can merge different files with the same name when checksum is empty (legacy rows). Prefer checksum-only for future hardening.

### 4.5 Reuse

Same `MediaAsset.id` can be linked from many `content_assets` rows (many Contents). Creating Content B with an existing `mediaAssetId` does **not** copy bytes.

### 4.6 In-use detection

`listMediaAssetsWithUsage`: `count(distinct content_assets.contentId)` per asset, tenant-scoped. No stored `usageCount` column.

### 4.7 Delete safety

`deleteMediaAsset(id, tenantId)`:

1. Load by id + tenant.
2. If any `content_assets` → throw (cannot delete).
3. Else storage `delete` + DB delete + activity log.

**Gap:** no HTTP DELETE / UI. Orphan unused assets accumulate after content delete (content delete does not cascade-delete media).

### 4.8 Tenant isolation

All list/get/upload/delete/dedupe paths filter `eq(mediaAssets.tenantId, tenantId)`. Cross-tenant `mediaAssetId` on create/update is rejected by tenant-scoped lookup. Device media routes require device tenant match.

### 4.9 Path to Player / Manifest / Offline

```
MediaAsset.url (stored)
    ↓ buildDeviceManifest
freshPlaybackUrl(storageKey) via provider.getUrl()
    + offlineUrl = /api/device/media/{assetId}
    ↓ Sync Engine
IndexedDB blob (checksum verified)
    ↓ Runtime
blob URL → else https url → else Bearer offlineUrl
```

R2: 7-day presigned GET. Local: `/api/media/...`. Drive: public uc download URL.

---

## 5. Content

### 5.1 Schema (`contents`)

| Field | Notes |
|-------|-------|
| `type` | See §8 |
| `title`, `description` | |
| `status` | `ACTIVE` \| `INACTIVE` |
| `payload` | JSON text (TEXT/NOTICE/etc. bodies) |
| `durationMs` | Default 10000; VIDEO create uses `0` |
| `version` | Bumped on update |
| `validFrom` / `validTo` | Optional |
| `tenantId` | Required |

### 5.2 Separation of concerns (confirmed)

| Entity | Means |
|--------|-------|
| **MediaAsset** | Physical file |
| **Content** | Logical publishable unit |
| **ContentAsset** | Relationship (`role` default `primary`) |

Same MediaAsset → Content A, B, C is supported and correct.

### 5.3 Delete safety

`deleteContent` blocks if any `playlist_items` reference the content. Does **not** delete linked MediaAssets.

---

## 6. ContentAsset

Composite PK `(contentId, mediaAssetId)`, both FKs `onDelete: cascade`.

- Create with `mediaAssetId` inserts one primary link.
- Update with new `mediaAssetId` deletes all links for that content and re-inserts primary.
- One content can theoretically have multiple assets (schema), but UI/API only manage a single primary today.

---

## 7. Media Types

Allowlist (`ALLOWED_MIME`):

`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`

Magic sniff: JPEG, PNG, GIF, WEBP, MP4 (`ftyp`), WebM (EBML). Client `file.type` is not trusted.

### Matrix (evidence-based)

| Type | Upload | Preview | Playback | Offline | Manifest | Legacy | React | Hisense |
|------|--------|---------|----------|---------|----------|--------|-------|---------|
| IMAGE (jpeg/png/webp) | PASS | PASS (library lightbox + playlist preview) | PASS (`<img>`) | PASS (asset in manifest + IDB) | PASS | PASS | PASS | PASS* |
| VIDEO (mp4/webm) | PASS | PASS (playlist `<video>`) | PASS | PASS | PASS | PASS | PASS | PARTIAL† |
| GIF | PARTIAL‡ | PARTIAL (as IMAGE `<img>`) | PARTIAL (browser-animated GIF as IMAGE) | PARTIAL (stored as image asset) | PARTIAL (as IMAGE) | PARTIAL | PARTIAL | UNKNOWN / PARTIAL§ |

\* Hisense/Sraf: fragile SW/IDB path; images via `<img>` are the safer path (`fragile-tv.ts`).  
† Video on Hisense has dedicated mitigations (no hidden preload video plane); natural duration path exists in `tv.js`.  
‡ GIF MIME accepted; **no** content type `GIF`; duration always IMAGE timer, not loop-until-complete policy.  
§ No GIF-specific Hisense tests found.

**Declaration:** GIF = **PARTIAL**. Content type `GIF` = **NOT IMPLEMENTED**.

---

## 8. Content Types

### 8.1 Current enum (`CONTENT_TYPES`)

`IMAGE`, `VIDEO`, `TEXT`, `NOTICE`, `EVENT`, `NEWS`, `QR_CODE`, `CLOCK`

Statuses: `ACTIVE`, `INACTIVE`.

### 8.2 Real support

| Type | Create UI | Payload | React Player | Legacy `tv.js` |
|------|-----------|---------|--------------|----------------|
| IMAGE | Yes + media | assets | `<img>` | `<img>` |
| VIDEO | Yes + media | assets | `<video>` + natural end | `<video>` + natural end |
| TEXT | Yes | `{ body, align, fontSize }` | Title + body card | Text card |
| NOTICE | Yes | `{ message }` | Same text card (`message`) | Same |
| EVENT | Yes | `{ description, date, time, location }` | Uses description/body fields partially | Text card |
| NEWS | Yes | `{ body, … }` | Text card | Text card |
| QR_CODE | Yes | `{ url, label, size }` | Payload URL may resolve as media URL fallback; **no dedicated QR renderer** | Text card (no QR draw) |
| CLOCK | Yes | `{ showDate, showTime, format }` | Live clock | Live clock |

### 8.3 Evolution proposal (do not implement now)

**CURRENT (operational):** IMAGE, VIDEO, GIF*(as IMAGE MIME)*, NOTICE (+ TEXT family already present)

**FUTURE (architecture reservation only):**

| Type | Intent |
|------|--------|
| TEXT | Keep; refine payload schema |
| DASHBOARD | Data widgets — future |
| DATA | External metrics — future |
| EXPERIENCE | Interactive HTML_APP — **not in Phase 3** |

Do **not** add sandbox, iframe runtime, camera/mic, or network permission model in Phase 3.

---

## 9. Content Builder

### 9.1 Current flow (`content-create-form.tsx` + `/admin/contents`)

**Fields:** type, title, duration (VIDEO locked automatic/`0`), body/URL for non-media, CLOCK defaults.

**Media modes (IMAGE/VIDEO):**

- **A) Upload** — multipart `POST /api/admin/contents`
- **B) Media Library** — JSON `{ mediaAssetId }`  
- Preselect via `?mediaAssetId=` from library

**Validation:** Zod `createContentSchema`; media asset must belong to tenant.

**Edit (`content-list-manager.tsx`):** title + durationMs only; status toggle; delete/bulk delete. **No** media re-attach, **no** payload editor.

**Bug / gap:** edit UI requires `durationMs > 0`, which conflicts with VIDEO natural duration `0`.

### 9.2 Verdict on reuse requirement

The user is **not** forced to re-upload: library select path exists and is wired end-to-end. Gap is UX polish (picker quality, filters, detail studio), not domain.

---

## 10. Preview

| Surface | Exists | Types |
|---------|--------|-------|
| Playlist timed preview | YES (`playlist-timed-preview.tsx`) | IMAGE, VIDEO, CLOCK, text-like types |
| Content Studio preview | NO | — |
| Media library image lightbox | YES | images only |

**Principle to preserve:**

```
Content → Preview Renderer
Content → PlaylistItem → Runtime Renderer
```

Admin Preview ≠ Production Player. Preview must not depend on a real Device, pairing, or IndexedDB. Share **rules** (duration resolution, type→renderer map) via a thin shared model / pure helpers later — do not import the full player stack into admin.

---

## 11. Presentation

### 11.1 Storage

`playlist_items.fit_mode` (`fitMode`), default `"black"`.

UI options (`playlist-builder.tsx`):

- `black` — “Slide inteiro, fundo preto”
- `adaptive` — **same label** (no behavioral difference today)

### 11.2 Pipeline

| Layer | Status |
|-------|--------|
| DB | Stored |
| API / `updatePlaylistItem` | Accepts `fitMode` |
| UI | Select control |
| Manifest | Emits `fitMode` |
| React `display-engine` | **Ignored** (always contain + black stage) |
| Legacy `tv.js` | **Ignored** (always contain + black) |

**Architectural decision (preserve):** Presentation belongs on **PlaylistItem**, not Content — same Content may be COVER in Playlist A and CONTAIN in Playlist B.

**Phase 3D item:** define real semantics (`black` / `contain` / `cover` / `adaptive`) and apply in both renderers — without moving fields to Content.

---

## 12. Transitions

### 12.1 Contract drift (critical for Phase 3E)

| Layer | Tokens |
|-------|--------|
| Domain `TRANSITIONS` | `fade`, `slide`, `cut` |
| Playlist UI | `fade`, `slide-left`, `zoom`, `cut` |
| React CSS (`globals.css`) | `.player-slide-fade`, `-slide-left`, `-zoom`, `-cut` |
| Legacy `tv.js` `transitionClass` | `slide-left`, `zoom`, `cut`, else `fade-in` |
| Zod on playlist item | **None** (free string) |

Domain value `slide` has **no** matching CSS. UI never offers `slide`.

### 12.2 Matrix (current evidence)

| Transition | React | Legacy | Video | Image | GIF | Offline |
|------------|-------|--------|-------|-------|-----|---------|
| fade | PASS | PASS (as fade-in) | PASS* | PASS | PARTIAL (as IMAGE) | N/A (CSS only) |
| slide | NOT WIRED | NOT WIRED | — | — | — | — |
| slide-left | PASS | PASS | PASS* | PASS | PARTIAL | N/A |
| zoom | PASS | PASS | PASS* | PASS | PARTIAL | N/A |
| cut | PASS | PASS | PASS* | PASS | PARTIAL | N/A |

\* Video + transitions: React skips opacity animation when current/next is VIDEO or transition is `cut` (keeps frame). Legacy has separate video plane handling. Transitions are presentation-layer; offline does not change transition tokens.

**Do not add new transitions in audit.** First unify the contract (recommend aligning domain enum to UI tokens: `fade` \| `slide-left` \| `zoom` \| `cut`).

---

## 13. Duration

### 13.1 Validated rule (preserve)

```
effectiveDuration = durationOverrideMs ?? content.durationMs
```

Manifest (`manifest.ts`): `durationMs: item.durationOverrideMs ?? content.durationMs`.

### 13.2 Natural video duration (preserve)

`VIDEO` + `durationMs === 0` → no fixed timer; advance on `ended` (React + Legacy). Create UI forces VIDEO `durationMs: 0`.

Override `0` on PlaylistItem is treated as Natural in playlist builder UI.

### 13.3 Per type

| Type | Behavior today |
|------|----------------|
| IMAGE | Explicit `durationMs` (default 10s); playlist override optional |
| VIDEO | `0` = natural; override > 0 loops/holds for that duration |
| GIF | Treated as IMAGE → **timer-based**, not “play GIF cycles” |
| NOTICE / TEXT family | Explicit `durationMs`; render text card |

**Do not alter Natural Video Duration architecture.**

---

## 14. Playlist Integration

`PlaylistItem` fields used for playback configuration:

| Field | Role |
|-------|------|
| `contentId` | Logical content |
| `position` | Order |
| `durationOverrideMs` | Optional duration |
| `transition` | Transition token |
| `fitMode` | Presentation (stored; not yet rendered) |
| `active` | Enable/disable item |

Same Content in Playlist A/B/C with different duration/presentation/transition is supported.

`addPlaylistItem` validates playlist + content both belong to `tenantId` (IDOR-safe at service layer).

ContentPicker receives **already tenant-filtered** contents from the playlist page — client-only search; server still re-checks on add.

---

## 15. Storage

```
MediaStorageProvider
├── LocalFsProvider      (name: "local")
├── GoogleDriveProvider  (name: "google_drive") — legacy/experimental
└── R2StorageProvider    (name: "r2")
```

Factory: `getMediaStorage()` from `MEDIA_STORAGE_PROVIDER`.

ADR mentions future generic `ObjectStorageProvider`; **no such class exists** — R2 is the object-storage implementation.

**Content Studio must depend only on `MediaStorageProvider` / service APIs**, never import R2 SDK in UI.

---

## 16. Offline

Pipeline:

```
Manifest assets[] → Sync download → checksum → IndexedDB → Runtime blob URL
```

| Type | Offline path |
|------|----------------|
| IMAGE | Asset bytes cached |
| VIDEO | Asset bytes cached (quota risk for large files) |
| GIF | Same as IMAGE if linked as primary asset |
| NOTICE / TEXT / CLOCK | No media asset; payload in manifesto — works offline without blob |

**Gaps / risks (do not modify offline now):**

- Large video quota / failed downloads / atomic activation already exist; Content Studio must not invent parallel caches
- GIF animated size can be large; treat as image quota peer
- MIME must remain sniff-validated so Cache API / blob type stay consistent
- Hisense fragile path may disable SW — offline behavior differs by device class

---

## 17. Device Compatibility

| Capability | React | Legacy | Hisense / VIDAA / Sraf | Android Chrome |
|------------|-------|--------|------------------------|----------------|
| IMAGE | PASS | PASS | PASS (preferred path) | PASS |
| VIDEO | PASS | PASS | PARTIAL (special-cased; no hidden preload) | PASS |
| GIF | PARTIAL (as IMAGE) | PARTIAL | UNKNOWN / PARTIAL | PARTIAL (browser GIF) |
| NOTICE | PASS (text card) | PASS | PASS (DOM text) | PASS |
| Transitions CSS | PASS | PASS (different class names) | PARTIAL (CSS support varies) | PASS |
| fitMode apply | NOT APPLIED | NOT APPLIED | NOT APPLIED | NOT APPLIED |
| Offline IDB/SW | PASS | N/A (legacy lighter) | FRAGILE / often disabled | PASS |

Do not assume HTML5 support ⇒ Smart TV support.

---

## 18. RBAC

Reuse Phase 2 matrix. **No new permission names required for MVP Content Studio** if operations stay under existing permissions.

| Operation | Permission | Roles (Phase 2) | UI | API |
|-----------|------------|-----------------|----|-----|
| List/upload media | `manage_contents` | SUPER_ADMIN, ADMIN, EDITOR | `/admin/media` | `/api/admin/media` |
| Deduplicate media | `manage_contents` | same | Media Library | `/api/admin/media/deduplicate` |
| Delete media | `manage_contents` | same | **missing** | **missing** (service only) |
| CRUD contents | `manage_contents` | same | `/admin/contents` | `/api/admin/contents*` |
| Playlist item / presentation / transition | `manage_playlists` | SUPER_ADMIN, ADMIN, EDITOR, OPERATOR | Playlist builder | playlist actions/API |
| Schedules | `manage_schedules` | SUPER_ADMIN, ADMIN, EDITOR, OPERATOR | schedules | schedules API |

OPERATOR can manage playlists (attach Content) but **cannot** create Contents/Media. VIEWER cannot. Enforce on **server** (`requireSession` / page gates) — UI hide is insufficient.

Optional future split (not required now): `manage_media` vs `manage_contents` — only if product needs finer editor roles.

---

## 19. Multi-tenancy

All of the following are tenant-scoped in services:

MediaAsset, Content, ContentAsset (via content/media tenant checks), Playlist, PlaylistItem (via playlist tenant), Schedule.

**Picker risk surface:**

| Picker | Client | Server |
|--------|--------|--------|
| ContentPicker | Filtered list from page | `addPlaylistItem` checks content.tenantId |
| Media library select in create form | Assets from tenant page | `createContent` / `updateContent` checks media.tenantId |

**IDOR tests:** no dedicated automated IDOR suite found for media/content pickers. **Action item:** add cross-tenant IDOR tests before declaring Phase 3G complete.

---

## 20. Security

| Control | Status |
|---------|--------|
| MIME sniff + allowlist | PASS |
| Extension sanitization | PASS (`safeFileExtension`) |
| Max upload size | PASS |
| Checksum integrity (upload + device sync) | PASS |
| Tenant isolation on media/content APIs | PASS (service-level) |
| Signed URLs (R2 7d) | PASS |
| Device Bearer on offline proxy | PASS |
| Malware / AV scanning | NOT IMPLEMENTED — document as future evolution |
| Separate media delete authz | N/A until API exists |

Future: AV/content scanning as async post-upload job; quarantine status on MediaAsset — **not** Phase 3A–3B.

---

## 21. Performance

| Risk | At ~1k | At ~10k | At ~100k |
|------|--------|---------|----------|
| `listMediaAssets` full table | OK | Slow | **BLOCKER for UX** |
| Client-side ContentPicker filter | OK | Painful | **BLOCKER** |
| `listMediaAssetsWithUsage` join/group | OK | Heavy | Needs pagination + indexed filters |
| Thumbnails | None generated | — | Need derived thumbs / lazy |
| Large video preview in admin | Memory risk | — | Use ranged/stream preview, not full download |
| Dedup scan all assets | OK | Heavy | Background job |

No premature optimization in Phase 3A; **require pagination + server search before 10k+ workspaces**.

---

## 22. Future Experience Runtime

Conceptual extension only:

```
CONTENT
 ├── MEDIA (IMAGE / VIDEO / GIF-as-media)
├── NOTICE (and TEXT family)
 └── EXPERIENCE
      └── HTML_APP   ← NOT IMPLEMENTED
```

Extension points already present:

- `DISPLAY_TYPES`, `INTERACTION_MODES`, `PLAYER_RUNTIME` in `domain/types.ts`
- Content `type` + `payload` open JSON
- PlaylistItem as playback configuration layer

**Forbidden in Phase 3:** HTML/CSS/JS authoring, iframe sandbox, interactive runtime, camera/mic/network permission model.

---

## 23. UX Proposal (specify only)

### 23.1 End-to-end flow

```
MEDIA LIBRARY
     ↓ upload / select
CONTENT STUDIO
     ↓ preview
SAVE CONTENT
     ↓
PLAYLIST
     ↓ presentation + transition + duration override
SCHEDULE
     ↓
DEVICE
```

### 23.2 Routes (proposed)

| Route | Purpose |
|-------|---------|
| `/admin/media` | Library: upload, search, filters, usage, delete safety |
| `/admin/contents` | Studio index: search, filters, create |
| `/admin/contents/new` | Create wizard (optional split from index) |
| `/admin/contents/[id]` | Edit, duplicate, preview, dependency view |
| `/admin/playlists/[id]` | Keep presentation/transition here |

### 23.3 Content Studio capabilities (future)

Create, edit, duplicate, visualize/preview, search, filter, archive/delete per dependencies, reuse MediaAssets without re-upload.

### 23.4 Media Library filters (future)

IMAGE \| VIDEO \| GIF \| OTHER; size; date; used / unused.

### 23.5 Content search filters (future)

type; status; media type; created/updated; used in playlists; unused.

### 23.6 Design system

Stay consistent with current admin (shadcn cards/tables/dialogs, clean SaaS whitespace). No radical redesign. Content Studio must feel native to Vitrine360 (Linear/Stripe/Notion-adjacent clarity already partially present).

---

## 24. Multi-sector Architecture

Same core entities serve all sectors — only Content title/payload/media change:

| Sector | Example Content | Types used |
|--------|-----------------|------------|
| Banco | “Crédito Habitação” | VIDEO / IMAGE / NOTICE |
| Restaurante | “Menu Executivo” | IMAGE / NOTICE |
| Hotel | “Welcome” | IMAGE / VIDEO / CLOCK |
| Universidade | “Calendário Académico” | NOTICE / IMAGE |
| Farmácia | “Campanha Vitamina” | IMAGE / VIDEO |
| Indústria | “Produção Linha 2” | NOTICE / IMAGE / future DATA |

**Do not** create `BankContent` etc. Optional later: workspace tags / templates — still not new core entities.

---

## 25. Risks

1. **Transition enum drift** → silent wrong CSS class if domain `slide` stored.
2. **fitMode dead field** → operators believe presentation changes something.
3. **Orphan MediaAssets** after content delete → storage cost.
4. **Filename dedupe** in admin tool → wrong merges if checksum empty.
5. **VIDEO edit UI** rejecting `durationMs = 0` → corrupts natural duration.
6. **QR_CODE** not actually rendering QR codes on players.
7. **R2 URL TTL 7d** → mitigated by manifest refresh; stale admin previews possible.
8. **Large library without pagination** → admin DoS-by-UX.
9. **GIF policy undefined** → operators expect full-play vs timed slide.
10. **Missing IDOR tests** on pickers → regression risk as Studio grows.

No critical security hole found that blocks audit completion; media delete absence is a product gap, not an open IDOR by itself.

---

## 26. Gaps

| ID | Gap | Severity |
|----|-----|----------|
| G1 | No Content detail route / full editor | High (Phase 3B) |
| G2 | No standalone Content Preview Renderer | Medium (Phase 3F) |
| G3 | GIF type + policy incomplete | Medium (Phase 3C) |
| G4 | Media DELETE API/UI missing | Medium (Phase 3A) |
| G5 | Transition domain contract inconsistent | High (Phase 3E) |
| G6 | fitMode not applied in players | Medium (Phase 3D) — touches Player later with care |
| G7 | width/height/durationMs on MediaAsset unused | Low |
| G8 | No pagination / server search | High at scale |
| G9 | Content duplicate action missing | Low/Medium |
| G10 | QR renderer missing | Low (out of Media Studio core) |
| G11 | Automated IDOR tests for media/content | High before 3G |
| G12 | EXPERIENCE reserved only | Intentional |

---

## 27. Proposed Implementation Phases

Adjusted from the brief based on audit evidence:

| Phase | Scope | Touches Player? |
|-------|-------|-----------------|
| **3A — Media Library UX** | Pagination design, filters (incl. GIF MIME filter), upload affordance, wire `deleteMediaAsset` API/UI with safety, unused filter | No |
| **3B — Content Studio** | `/admin/contents` + `/admin/contents/[id]`, full edit (payload + media reattach), duplicate Content (logical copy, same MediaAsset), fix VIDEO duration edit | No |
| **3C — GIF support** | Explicit product policy (timer vs loops), optional type or MIME badge, library filter, tests on React + Legacy | Minimal / evidence-first |
| **3D — Presentation refinement** | Unify fitMode semantics; apply in React + Legacy **only after contract doc**; keep on PlaylistItem | Yes (controlled) |
| **3E — Transition contract** | Align domain enum ↔ UI ↔ CSS ↔ Legacy; Zod validation; no new effects | Yes (controlled) |
| **3F — Preview** | Shared Preview Renderer for Content Studio; reuse duration/type rules; no Device dependency | No |
| **3G — E2E validation** | IDOR, RBAC, dedupe, reuse, natural video, manifest/offline smoke, Legacy + React | No new features |

**Recommended order:** 3A → 3B → 3F → 3E (contract) → 3C → 3D → 3G  
(Rationale: Studio UX unlocks value without touching Player; transition/presentation player work is higher risk and should follow a frozen contract.)

---

## 28. Test Strategy (propose only)

| Area | Suggested tests |
|------|-----------------|
| MediaAsset upload | MIME reject, size reject, checksum format |
| Deduplication | Same bytes → same id; different bytes → different id |
| Reuse | Two contents → one media row |
| Content create/update/delete | Zod + playlist block on delete |
| ContentAsset | Primary link replace on update |
| Media / Content pickers | Cross-tenant IDOR (expect 403/error) |
| RBAC | EDITOR ok; OPERATOR no content write; VIEWER denied |
| Presentation | Persist fitMode; (later) render assert |
| Transition | Only allowed tokens persist; CSS class maps |
| Duration | override ?? content; VIDEO 0 natural React+Legacy |
| Manifest | assets offlineUrl; duration resolution |
| Offline | checksum fail rejects activation |
| Players | IMAGE/VIDEO/NOTICE smoke React + Legacy |

Do **not** implement these in the audit phase beyond using existing tests as evidence.

---

## 29. Final Architectural Verdict

### Domain proposal (future-stable)

| Entity | Represents |
|--------|------------|
| **MediaAsset** | Physical Asset |
| **Content** (+ ContentAsset) | Logical Content |
| **PlaylistItem** | Playback Configuration (duration, presentation, transition, position) |
| **Playlist + Schedule** | Distribution |
| **Device** | Hardware |

### Media vs Content duplication (clarity)

- **MEDIA DEDUPLICATION** = same SHA-256 → one physical file per tenant. Correct.
- **CONTENT DUPLICATION** = new logical Content row (possibly sharing the same MediaAsset). Also correct.
- **Never** collapse two Contents into one solely because they share a checksum.

### Verdict

The foundation correctly separates physical media from logical content and keeps playback configuration on PlaylistItem. Storage abstraction, tenant scoping, natural video duration, and upload-or-library create paths are sound enough to proceed with phased implementation.

Blocking gaps are **not** architectural dead-ends; they are **action items** (Studio UX, delete API, transition/fitMode contracts, GIF policy, scale, IDOR tests). Player/offline stacks must remain frozen until 3D/3E with an explicit contract.

```
ARCHITECTURE AUDIT — APPROVED WITH ACTION ITEMS
```

---

## Appendix A — Evidence index

| Topic | Path |
|-------|------|
| Schema | `src/db/schema.ts` (`media_assets`, `contents`, `content_assets`, `playlist_items`) |
| Domain enums | `src/domain/types.ts` |
| Content/media services | `src/services/contents.ts` |
| Playlists | `src/services/playlists.ts` |
| Manifest | `src/services/manifest.ts` |
| Storage | `src/services/media/*` |
| Admin APIs | `src/app/api/admin/media/*`, `contents/*` |
| UI | `src/features/media/*`, `contents/*`, `playlists/*` |
| React player | `src/player/playback/display-engine.tsx` |
| Legacy player | `public/tv.js` |
| Transitions CSS | `src/app/globals.css` |
| Fragile TV | `src/player/device/fragile-tv.ts` |
| Phase 2 RBAC | `docs/WORKSPACE-RBAC-AUDIT.md` |

## Appendix B — What this audit did not do

- No production code changes
- No DB/enum/API/UI migrations executed
- No Player / Sync / Manifest / SW / IndexedDB / Auth / Membership / RBAC modifications
- No EXPERIENCE / sandbox implementation
- No declaration of IMPLEMENTED / VALIDATED / PRODUCTION READY for Phase 3
