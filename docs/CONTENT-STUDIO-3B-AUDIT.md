# Vitrine360 — Phase 3B Content Studio Audit

**Date:** 2026-09-21  
**Status:** AUDIT COMPLETE — **NO PRODUCT CODE CHANGES IN THIS DOCUMENT**  
**Prerequisite:** Phase 3A Media Library — PRODUCTION VALIDATED  
**Related:** `docs/MEDIA-CONTENT-STUDIO-AUDIT.md` §23 / §27 Phase 3B

This is the mandatory Phase 0 deliverable before any Content Studio implementation.

---

## 1. Executive verdict

| Area | Verdict |
|------|---------|
| Domain model Content / ContentAsset / MediaAsset | **EXISTS** — correct separation |
| CRUD services + admin APIs | **EXISTS** |
| Inline create on `/admin/contents` | **EXISTS** (upload + library) |
| `/admin/contents/new` | **NOT IMPLEMENTED** |
| `/admin/contents/[id]` Studio | **NOT IMPLEMENTED** |
| `duplicateContent` | **NOT IMPLEMENTED** |
| Media reattach on edit (service) | **EXISTS** |
| Media reattach on edit (UI) | **NOT IMPLEMENTED** |
| VIDEO `durationMs = 0` (create + Zod + Player) | **OK** |
| VIDEO `durationMs = 0` (edit UI) | **BUG — MUST FIX** |
| MIME ↔ Content type compatibility (IMAGE vs VIDEO) | **NOT IMPLEMENTED** (backend) |
| Delete safety (playlist) | **EXISTS** |
| Delete safety (schedule.contentId) | **GAP** — not checked in service |
| Transactions create/update + ContentAsset | **NOT IMPLEMENTED** |
| Dedicated Content Preview | **OUT OF SCOPE** (Phase 3F) |
| Player / Runtime / Manifest / Sync | **MUST NOT TOUCH** |

**Gate to implement Phase 3B:** **APPROVED TO IMPLEMENT** after this audit — architecture is sound; work is consolidation + Studio UX + critical VIDEO edit fix + safety hardening.

---

## 2. Preserved architecture (do not change)

```
MediaAsset → ContentAsset → Content → PlaylistItem → Playlist → Schedule/Device → Manifest → Sync → Runtime
```

Presentation (`fitMode`), transition, `durationOverrideMs` remain on **PlaylistItem**, not Content.

Phase 3B only owns:

```
Content Studio (admin) → Content (+ ContentAsset) → Media Library / MediaAsset
```

---

## 3. Schema (evidence)

**File:** `src/db/schema.ts`

### `contents`
| Field | Notes |
|-------|--------|
| `id`, `type`, `title`, `description` | |
| `status` | default `ACTIVE` — reuse; do not add second status column |
| `payload` | JSON text |
| `durationMs` | default `10000` |
| `version`, `validFrom`, `validTo` | |
| `tenantId` | FK cascade |

### `content_assets`
Composite PK `(contentId, mediaAssetId)`; both FKs **onDelete cascade**; `role` default `primary`.

### `playlist_items`
`contentId` → contents cascade; also `durationOverrideMs`, `transition`, `fitMode`.

### `schedules`
Optional `contentId` → contents **onDelete cascade** (`schema.ts` ~338–340).  
`deleteContent` today only checks `playlist_items` — **must also block (or explicitly handle) schedules referencing content** in Phase 3B.

### `media_assets`
Unchanged; Phase 3A owns physical delete / usage via ContentAsset.

---

## 4. Domain enums

**File:** `src/domain/types.ts`

**CONTENT_TYPES:** `IMAGE`, `VIDEO`, `TEXT`, `NOTICE`, `EVENT`, `NEWS`, `QR_CODE`, `CLOCK`  
**CONTENT_STATUSES:** `ACTIVE`, `INACTIVE`

**Do not add `GIF` as Content type** (Phase 3C).  
**Do not invent new types.**

---

## 5. Services (`src/services/contents.ts`)

| Function | Status | Notes |
|----------|--------|-------|
| `createContentSchema` | EXISTS | `durationMs: z.number().int().nonnegative()` → **0 allowed** |
| `updateContentSchema` | EXISTS | `.partial()` |
| `createContent` | EXISTS | Tenant-scoped `mediaAssetId`; insert content then ContentAsset; activity `content.created` |
| `updateContent` | EXISTS | Can replace ContentAsset if `mediaAssetId` set; activity `content.updated`; **no transaction** |
| `deleteContent` | EXISTS | Blocks if playlist_items; activity `content.deleted`; **does not check schedules.contentId** |
| `listContents` / `WithUsage` / `ForPreview` | EXISTS | Usage = playlist item count |
| `uploadMediaAsset` | EXISTS | Phase 3A — do not redesign |
| `duplicateContent` | **NOT IMPLEMENTED** | |
| `getContent(id, tenantId)` | **NOT IMPLEMENTED** as dedicated helper (inline selects in update/delete) | Useful for Studio page |

### MIME ↔ type compatibility

`createContent` / `updateContent` verify media **tenant** only.  
They do **not** assert:

- IMAGE → `mime.startsWith("image/")`
- VIDEO → `mime.startsWith("video/")`

**Phase 3B must add server-side authority** (frontend UX alone is insufficient).

### Transactions

Create / update+reattach / future duplicate: sequential awaits, **no `db.transaction`**.  
Schedules service already uses transactions — Content should follow that pattern for multi-table writes.

---

## 6. Admin UI routes

| Route | Status | Behaviour |
|-------|--------|-----------|
| `/admin/contents` | EXISTS | Create form + list/edit modal on same page |
| `/admin/contents/new` | NOT IMPLEMENTED | Create is inline |
| `/admin/contents/[id]` | NOT IMPLEMENTED | No detail Studio |

**Gate:** `requireAdminPage("manage_contents")`.

**Components:**

- `src/features/contents/content-create-form.tsx` — create; IMAGE/VIDEO upload **or** library; VIDEO forces `durationMs: 0`
- `src/features/contents/content-list-manager.tsx` — list; status toggle; edit title+duration only; delete
- `src/features/contents/content-picker.tsx` — playlist picker; client filter on caller-supplied list

---

## 7. APIs

| Route | Methods | Permission |
|-------|---------|------------|
| `/api/admin/contents` | GET, POST (JSON + multipart) | `manage_contents` |
| `/api/admin/contents/[id]` | PATCH, DELETE | `manage_contents` |

Missing for Studio:

- `GET /api/admin/contents/[id]` (optional if RSC loads via service)
- `POST /api/admin/contents/[id]/duplicate` or action equivalent

Pattern: **Route Handlers** (same as Media 3A) — do not introduce a third architecture.

---

## 8. Critical bug — VIDEO natural duration on edit

| Layer | VIDEO `durationMs = 0` |
|-------|------------------------|
| Zod | Allowed (`.nonnegative()`) |
| Create UI | Forces `0` (“duração automática”) |
| Edit UI | **Rejects** `durationMs <= 0` + input `min="1000"` |
| Runtime | Correct natural end when `0` — **do not change Player** |

**Evidence (`content-list-manager.tsx`):**

```157:160:src/features/contents/content-list-manager.tsx
    if (!title || durationMs <= 0) {
      setErrorMsg("Por favor, preencha todos os campos corretamente.");
```

Also: `min="1000"` on duration input.

**Fix scope (3B only):** form validation + Studio persistence rules.  
**Do not** alter `display-engine` / `tv.js` / manifest duration resolution.

### Duration ownership (preserve)

```
effectiveDuration = durationOverrideMs ?? content.durationMs
```

- Content Studio → `Content.durationMs`
- Playlist Editor → `PlaylistItem.durationOverrideMs`

---

## 9. Payloads (reuse existing — do not invent)

From `content-create-form.tsx` / `defaultPayloadForType`:

| Type | Payload shape (current) |
|------|-------------------------|
| TEXT | `{ body, align, fontSize }` |
| NOTICE | `{ message }` |
| EVENT | `{ description, date, time, location }` |
| NEWS | `{ body, source? }` |
| QR_CODE | `{ url, label, size }` — **no Player QR renderer** (out of 3B) |
| CLOCK | `{ showDate, showTime, format }` |
| IMAGE/VIDEO | typically `{}` + ContentAsset |

Studio editors must reuse these shapes.

---

## 10. Delete safety (current vs required)

| Reference | Current `deleteContent` |
|-----------|-------------------------|
| `playlist_items` | Blocks with English error → API **409** via `cannot delete` |
| `schedules.contentId` | **NOT checked** — risk of cascade wipe of schedule rows |
| `content_assets` | Cascade on content delete (associations removed; MediaAsset kept) |
| MediaAsset physical delete | Not triggered (correct) |

**3B requirement:** Portuguese (or clear) message; block playlist **and** schedule content refs; never `force=true`; never auto-delete MediaAsset.

---

## 11. Duplicate Content (spec for implementation)

**NOT IMPLEMENTED.** When built:

| Copy | Do not copy |
|------|-------------|
| New `Content.id` | PlaylistItems |
| type, title (e.g. “… — Cópia”), durationMs, status, payload | Schedules |
| ContentAsset rows → **same** `mediaAssetId`s | Devices / groups |
| Same tenant | Physical files / new MediaAsset |

Activity: prefer `CONTENT_DUPLICATED` or align with existing `content.*` naming — pick one style and document (Phase 2 mixed `MEDIA_DELETED` vs `content.created`).

---

## 12. ACTIVE / INACTIVE

Field `contents.status` already used; UI toggle via PATCH exists.

**Preserve:** INACTIVE must **not** auto-remove PlaylistItems, Schedules, or Device assignments in Phase 3B. Runtime behaviour of inactive content: document existing (manifest currently includes playlist items as built — confirm during implementation without changing Runtime unless already filtered; **prefer preserve**).

Quick note: audit of manifest filtering by content status should be verified in implementation Phase 0 of coding — if currently inactive contents still play, that is a known limitation, not a 3B Runtime change unless already gated.

---

## 13. RBAC

Permission: **`manage_contents`** only (no `manage_media`).

| Role | manage_contents |
|------|-----------------|
| VIEWER | DENIED |
| OPERATOR | DENIED |
| EDITOR | ALLOW |
| ADMIN / SUPER_ADMIN | ALLOW |

Playlist content attach remains `manage_playlists`.  
Backend `requireSession` is authority; UI hide is UX only.

---

## 14. Tenant isolation & pickers

| Surface | Isolation |
|---------|-----------|
| list/create/update/delete content | `session.tenantId` |
| mediaAssetId attach | lookup `id` + `tenantId` |
| ContentPicker | receives tenant-scoped list; `addPlaylistItem` re-checks tenant |
| Media library on create page | `listMediaAssets(session.tenantId)` |

**Gaps for 3B tests:** dedicated IDOR suite for Content Studio (open/edit/duplicate/delete foreign id; attach foreign media; picker). Soften API “not found” → **404** (already via `handleApiError`).

---

## 15. Media Library reuse

Do **not** create a second media catalogue.

```
Media Library → Media Picker (modal/reuse) → Content Studio → ContentAsset
```

Phase 3A owns upload/dedupe/delete physical. Studio only associates.

---

## 16. Preview (Phase 3F — preparation only)

Do not build Preview Renderer now.  
Avoid coupling Studio to PlaylistItem/Runtime.  
Optional: thin presentational slots / data shape for future Preview — no Player import.

---

## 17. What Phase 3B must implement (scope checklist)

1. Routes: consolidate `/admin/contents`, add `/admin/contents/new`, `/admin/contents/[id]`
2. List: search, filter type/status, usage, navigate to Studio, duplicate, delete
3. Create + Edit Studio: title, type, status, duration, payload (existing shapes), media upload/select
4. Server MIME ↔ type checks
5. Fix VIDEO edit allowing `durationMs = 0`
6. `duplicateContent` + API/action + activity
7. Harden `deleteContent` (playlists + schedules.contentId); PT/clear 409 messages
8. Transactions for multi-table mutations
9. Optional `getContent` for detail page
10. Tests CONTENT-001…027 (as specified in brief)
11. Docs `docs/CONTENT-STUDIO-3B-IMPLEMENTATION.md`
12. Deploy + production smoke before VALIDATED

### Explicit non-goals

Player, Runtime, Manifest, Sync, SW, IndexedDB, pairing, Auth, Membership, RBAC model, R2, Presentation/Transition, GIF Content type, Experience/HTML, full Preview, Schedule resolver changes.

---

## 18. Implementation order (recommended)

1. Service layer: getContent, MIME checks, transactions, duplicate, delete schedule guard, duration helpers  
2. API: duplicate endpoint; tighten errors  
3. Studio pages: `[id]` + `new`; refactor list  
4. Fix list/edit VIDEO duration bug (remove or retire broken modal in favour of Studio)  
5. Tests + regression + production smoke  

---

## 19. Risks

| Risk | Mitigation |
|------|------------|
| Edit VIDEO corrupts natural duration | Fix UI validation first |
| Orphan schedule rows / cascade | Check `schedules.contentId` before delete |
| Cross-type media attach | Server MIME gate |
| Non-atomic ContentAsset replace | `db.transaction` |
| Scope creep into Preview/Player | Hard refuse |

---

## 20. Audit conclusion

```
ARCHITECTURE AUDIT — APPROVED FOR PHASE 3B IMPLEMENTATION
```

Foundation is sufficient. Phase 3B is primarily **Content Studio UX + domain hardening**, not a redesign of playback.

**No product code was modified in this audit step.**

---

## Appendix — Evidence index

| Topic | Path |
|-------|------|
| Schema | `src/db/schema.ts` |
| Domain | `src/domain/types.ts` |
| Services | `src/services/contents.ts` |
| Admin page | `src/app/admin/contents/page.tsx` |
| APIs | `src/app/api/admin/contents/route.ts`, `[id]/route.ts` |
| Create UI | `src/features/contents/content-create-form.tsx` |
| List/edit UI | `src/features/contents/content-list-manager.tsx` |
| Picker | `src/features/contents/content-picker.tsx` |
| Playlist attach | `src/services/playlists.ts` `addPlaylistItem` |
| Phase 3A media | `docs/MEDIA-LIBRARY-3A-IMPLEMENTATION.md` |
| Parent audit | `docs/MEDIA-CONTENT-STUDIO-AUDIT.md` |
