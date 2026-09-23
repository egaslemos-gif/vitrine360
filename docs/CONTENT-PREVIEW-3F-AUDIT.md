# Vitrine360 — Content Preview Architecture Audit

**Date:** 2026-09-22  
**Phase:** 3F-A (audit only)  
**Prerequisite:** Phase 3B Content Studio — PRODUCTION VALIDATED (`docs/CONTENT-STUDIO-3B-IMPLEMENTATION.md`)  
**Related:** `docs/MEDIA-CONTENT-STUDIO-AUDIT.md` §10 / §27 Phase 3F; `docs/CONTENT-STUDIO-3B-AUDIT.md` §16  

**Product code changes in this phase:** **NONE**

---

## 1. Executive Verdict

| Question | Verdict |
|----------|---------|
| Can Content Preview be built without Player / Manifest / Sync / Device? | **YES** |
| Does a Content-scoped data shape already exist? | **YES** — `listContentsForPreview` / `ContentPreviewRow` |
| Does an admin visual renderer already exist (without IndexedDB)? | **YES** — `playlist-timed-preview.tsx` `Slide` (playlist-hosted today) |
| Is there a dedicated Content Studio Preview? | **NOT IMPLEMENTED** |
| Is QR visually rendered anywhere? | **NOT IMPLEMENTED** (text-card fallback) |
| Do payload fields (align, fontSize, EVENT meta, CLOCK flags, NEWS source) drive Player UI? | **MOSTLY IGNORED** (Player Technical Debt) |
| Architecture gate for Phase 3F implementation | **APPROVED** |

```
ARCHITECTURE AUDIT — APPROVED FOR PHASE 3F IMPLEMENTATION
```

There is **no architectural blocker**. Gaps (QR, unused payload fields, duplicated Slide logic, `fitMode` unused in runtime) are implementation / debt items, not reasons to block Preview.

---

## 2. Scope

### In scope (this audit)

- Content domain & payloads
- Existing renderers (React Player, Legacy `tv.js`, Playlist timed preview)
- Preview vs Playback separation
- Security, media URLs, VIDEO/IMAGE, CLOCK, QR
- Proposed architecture, host options, tests, risks
- Player/Runtime study only — **no fixes**

### Out of scope (absolute)

- Implementing Preview / new renderers / QR library
- Player, Runtime, Manifest, Sync, SW, IndexedDB changes
- Auth / Membership / RBAC model changes
- R2 / storage / new permanent URLs
- Experience Runtime / executable HTML/CSS/JS
- Database migrations
- Fixing `player-app.tsx` ESLint `react-hooks/refs` (Player Technical Debt)

### Architectural principle (non-negotiable)

```
Content → Preview Renderer → Preview UI
```

**Not:**

```
Content → PlaylistItem → Playback Runtime → Player
```

Preview represents the **logical Content**. It must not depend on Device, Playlist, Schedule, Manifest, Sync, pairing, heartbeat, IndexedDB, Service Worker, device token, or the schedule/playback resolver.

---

## 3. Current Content Model

### Pipeline (preserved)

```
MediaAsset → ContentAsset → Content → PlaylistItem → Playlist
                                              ↓
                                    Schedule / Device.currentPlaylistId
                                              ↓
                                    Manifest → Sync → Runtime → Renderer
```

### Schema evidence (`src/db/schema.ts`)

| Entity | Relevant fields |
|--------|-----------------|
| `contents` | `id`, `type`, `title`, `description`, `status` (ACTIVE/INACTIVE), `payload` (JSON text), `durationMs`, `version`, `validFrom`, `validTo`, `tenantId` |
| `content_assets` | `(contentId, mediaAssetId)` PK, `role` default `primary` |
| `media_assets` | `storageKey`, `mimeType`, `fileName`, `checksum`, dimensions, `durationMs`, `tenantId` |
| `playlist_items` | `contentId`, `durationOverrideMs`, `transition`, `fitMode` — **presentation lives here** |

### Domain enums (`src/domain/types.ts`)

**CONTENT_TYPES:** `IMAGE`, `VIDEO`, `TEXT`, `NOTICE`, `EVENT`, `NEWS`, `QR_CODE`, `CLOCK`  
**CONTENT_STATUSES:** `ACTIVE`, `INACTIVE`

### Existing admin data helper (important for 3F)

`listContentsForPreview(tenantId)` in `src/services/contents.ts` already returns:

```ts
ContentPreviewRow {
  id, title, type, durationMs,
  payload: Record<string, unknown>,
  mediaUrl: string | null   // via MediaStorageProvider.getUrl(storageKey)
}
```

Used today by `/admin/playlists/[id]` for **playlist** timed preview — **not** by Content Studio.  
This is the closest existing **ResolvedContentPreviewModel** and does **not** require PlaylistItem.

### Manifest eligibility (playback only)

`buildContentManifestItem` / playlist manifest join filter: `contents.status === "ACTIVE"`.  
`validFrom` / `validTo` are **stored** but **not applied** in `playback-resolver.ts` or `manifest.ts` (grep: no matches).

---

## 4. Content Type Matrix

Evidence sources: `defaultPayloadForType` / Studio form; `display-engine.tsx` `Slide`; `public/tv.js` `renderSlide`; `playlist-timed-preview.tsx` `Slide`.

| Content Type | Payload | MediaAsset | Runtime Renderer | Preview Renderer (Content Studio) | Estado |
|--------------|---------|------------|------------------|-----------------------------------|--------|
| IMAGE | `{}` | Required via ContentAsset | React + Legacy `<img>` | **NOT IMPLEMENTED** (playlist Slide only) | PARTIAL |
| VIDEO | `{}` | Required via ContentAsset | React + Legacy `<video>` (autoplay muted, natural end if durationMs=0) | **NOT IMPLEMENTED** (playlist Slide only) | PARTIAL |
| TEXT | `{ body, align, fontSize }` | No | Text card (title + body); **align/fontSize ignored** | **NOT IMPLEMENTED** | PARTIAL |
| NOTICE | `{ message }` | No | Text card (`message` as body) | **NOT IMPLEMENTED** | PARTIAL |
| EVENT | `{ description, date, time, location }` | No | Text card (`description` only); **date/time/location ignored** | **NOT IMPLEMENTED** | PARTIAL |
| NEWS | `{ body, source? }` | No | Text card (`body` only); **source ignored** | **NOT IMPLEMENTED** | PARTIAL |
| QR_CODE | `{ url, label, size }` | No | Text card fallback; **no QR draw**; `url` not in body fields | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** (visual QR) |
| CLOCK | `{ showDate, showTime, format }` | No | Clock UI; **payload flags ignored**; browser local time | **NOT IMPLEMENTED** | PARTIAL |

**Legend**

- **PARTIAL** = some visual exists in Player / playlist preview, but payload fidelity or Content Studio host is incomplete.  
- **NOT IMPLEMENTED** = no dedicated Content Studio preview; QR has no matrix/barcode renderer anywhere.

---

## 5. Payload Matrix

Confirmed against `defaultPayloadForType` (`contents.ts`) and `buildPayload()` (`content-studio-form.tsx`). **No new payloads invented.**

| Type | Canonical payload (Studio / defaults) | Player / Legacy uses | Gap |
|------|---------------------------------------|----------------------|-----|
| IMAGE / VIDEO | `{}` + ContentAsset | Asset URL only | — |
| TEXT | `body`, `align` (default `center`), `fontSize` (default `large`) | `body` only | align, fontSize unused |
| NOTICE | `message` | `message` via body fallback | — |
| EVENT | `description`, `date`, `time`, `location` | `description` only | date/time/location unused |
| NEWS | `body`, `source` | `body` only | source unused |
| QR_CODE | `url`, `label`, `size` (`md`) | title only (url not in body/message/description) | **no QR; label/size unused** |
| CLOCK | `showDate`, `showTime`, `format` (`24h`) | always time + date | flags/format unused |

**TEXT note:** Studio currently hardcodes `align: "center"` and `fontSize: "large"` on save (fields exist in default payload but UI does not yet expose editors for them). Preview should still treat them as schema fields.

---

## 6. Existing Renderers

### 6.1 Inventory

| Location | Kind | Role |
|----------|------|------|
| `src/player/playback/display-engine.tsx` | React | Device Player slide + **playback orchestration** (index, timers, transitions) |
| `src/features/player/player-app.tsx` | React | Pairing, sync, heartbeat, IndexedDB wiring → DisplayEngine |
| `public/tv.js` | Legacy JS | Smart TV / static player: `renderSlide`, `showVideo`, `renderClock`, sync |
| `public/player-smarttv.js` | Legacy JS | Smart TV variant (same family; not re-audited line-by-line) |
| `src/features/playlists/playlist-timed-preview.tsx` | React (admin) | Playlist sequence preview + local `Slide` |
| `src/features/media/media-library.tsx` `ImagePreview` | React (admin) | **File** lightbox — **not** Content Preview |

### 6.2 Domain rendering vs playback orchestration

| Concern | Where it lives today |
|---------|----------------------|
| **A. Domain rendering** (“how does this Content look?”) | Inner `Slide` in display-engine; `Slide` in playlist-timed-preview; `renderSlide` / `renderClock` / video helpers in `tv.js` |
| **B. Playback orchestration** (“when does it start/end?”) | DisplayEngine timers / VIDEO onEnded; player-app sync; tv.js `advanceSlide` / `hold` / generation; playlist-timed-preview play/pause/interval |

### 6.3 Reuse answers (per renderer family)

#### A. `display-engine.tsx` `Slide`

| # | Question | Answer |
|---|----------|--------|
| 1 | Reusable by Preview as-is? | **No** — imports `@/player/cache/indexed-db` (`createObjectUrl`, `getConfig`) |
| 2 | Coupled to PlaylistItem? | **Yes** — `playlistItemId` on `PlaybackItem`; transitions |
| 3 | Coupled to Device? | **Yes** — device token fetch path for media |
| 4 | Coupled to playback clock? | Parent DisplayEngine owns timers |
| 5 | Coupled to Manifest? | Indirectly (item shape from sync) |
| 6 | Blob URLs? | **Yes** — createObjectURL + revoke on cleanup |
| 7 | IndexedDB? | **Yes** |
| 8 | Runtime state? | **Yes** |
| 9 | Browser APIs? | video, Date, fetch |
| 10 | Safe shared component today? | **No** — extract pure visual first |

#### B. `playlist-timed-preview.tsx` `Slide`

| # | Question | Answer |
|---|----------|--------|
| 1 | Reusable by Content Preview? | **Best starting point** — takes `mediaUrl` + payload; no IDB |
| 2 | PlaylistItem? | Host is playlist-oriented; Slide itself only needs PreviewItem |
| 3 | Device? | **No** |
| 4 | Playback clock? | Host has play/pause; Slide is mostly presentational |
| 5 | Manifest? | **No** |
| 6 | Blob URLs? | **No** (uses storage URL string) |
| 7 | IndexedDB? | **No** |
| 8 | Runtime state? | Minimal (video ref for sequence) |
| 9 | Browser APIs? | `<img>` / `<video>` / `Date` |
| 10 | Safe to extract? | **Yes** — recommend extract `ContentVisual` from this Slide |

#### C. `public/tv.js` `renderSlide`

| # | Question | Answer |
|---|----------|--------|
| 1 | Reusable by admin Preview? | **No** — DOM string templates + playState |
| 2–5 | Playlist / Device / clock / manifest | **Yes** (runtime) |
| 6–8 | Blobs / IDB / runtime | Device media / cache paths |
| 9 | Browser APIs | Heavy |
| 10 | Shared React component? | **No** — keep as Player Technical Debt / parity reference only |

### 6.4 Media Library lightbox ≠ Content Preview

| | Media Library | Content Preview (future) |
|--|---------------|--------------------------|
| Object | Physical file | Logical Content experience |
| Types | image/video assets | All CONTENT_TYPES |
| Payload | N/A | Required for text-like / QR / CLOCK |
| Duration semantics | N/A | Content.durationMs (incl. VIDEO=0) |
| Location | `/admin/media` | Content Studio `/new` & `/[id]` (recommended) |

---

## 7. Player/Runtime Dependency Analysis

### Flow today

```
Manifest item (PlaylistItem fields + Content + assets[])
        ↓
player-app / tv.js playback loop
        ↓
DisplayEngine / renderSlide
        ↓
Slide / video / clock / text card
```

### Files studied (no modifications)

| File | Finding |
|------|---------|
| `display-engine.tsx` | Combines orchestration + Slide; IMAGE/VIDEO/CLOCK + generic text; **fitMode unused** |
| `player-app.tsx` | Orchestration + sync; known ESLint `react-hooks/refs` debt |
| `public/tv.js` | Parallel renderer; QR→text card; CLOCK ignores payload; `escapeHtml` for XSS |
| `playlist-timed-preview.tsx` | Admin sequence preview; proves online mediaUrl rendering |

### PLAYER TECHNICAL DEBT (record only — do not fix in 3F)

1. ESLint `react-hooks/refs` in `player-app.tsx` (2 errors).  
2. `fitMode` stored on PlaylistItem / manifest / UI — **not applied** in React Slide or Legacy (also noted in MEDIA-CONTENT-STUDIO-AUDIT).  
3. Payload fields unused (TEXT align/fontSize, EVENT meta, NEWS source, CLOCK flags, QR).  
4. Duplicated Slide visual logic (display-engine vs playlist-timed-preview vs tv.js).  
5. QR_CODE has no QR matrix renderer.

**Phase 3F must not import Player stack to “fix” these.** Preview may **improve admin fidelity** for payloads without changing Device Runtime.

---

## 8. Preview vs Playback

| Concern | Preview (target) | Playback (current) |
|---------|------------------|--------------------|
| Content rendering | YES | YES |
| Playlist | **NO** | YES |
| PlaylistItem presentation | **NO** (optional later visual hint only) | YES (`transition`, `fitMode`, override) |
| Schedule | **NO** | YES |
| Device | **NO** | YES |
| Manifest | **NO** | YES |
| Sync | **NO** | YES |
| Playback clock | NO / optional local demo only | YES |
| IndexedDB | **NO** | YES (React player) |
| Service Worker | **NO** | YES |
| Device token | **NO** | YES |
| Admin session cookie | YES | N/A |
| Media URL | `MediaStorageProvider.getUrl` (same as `listContentsForPreview`) | Signed / device media / IDB blob |
| User interaction | Local (play mute, scrub optional) | Runtime-dependent |
| Mutates Content | **NO** (read-only) | N/A |

---

## 9. Proposed Renderer Architecture

Based on **code found**, not an abstract ideal.

### Recommended shape

```
Content (+ primary MediaAsset URL)
        ↓
ResolvedContentPreviewModel   // extend ContentPreviewRow; optional status, valid*, media mime
        ↓
ContentVisual (shared presentational)     ← extract from playlist-timed-preview Slide
   ├── ImageContentVisual
   ├── VideoContentVisual
   ├── TextLikeContentVisual   // TEXT / NOTICE / NEWS / EVENT (payload-aware)
   ├── QRCodeContentVisual      // NEW in 3F or later; stub until then
   └── ClockContentVisual       // Preview Time; respect payload flags
        ↓
   ├── PreviewHost (Content Studio)     // single Content, no sequence
   └── PlaylistTimedPreview (existing)  // may later consume same ContentVisual
```

**Explicitly out of Preview Host:** Device Runtime Host (`DisplayEngine` / `tv.js`).  
Do **not** force Player to import Preview in Phase 3F. Optional later convergence is a separate debt phase.

### Agnostic rules for `ContentVisual`

Must **not** accept / depend on: Device, Playlist, Schedule, Manifest, Sync, deviceToken, IndexedDB APIs.

May accept: `type`, `title`, `payload`, `durationMs`, `mediaUrl`, optional `mimeType`, optional `previewNow: Date` for CLOCK.

### Data model recommendation

Prefer extending existing **`ContentPreviewRow`** (or `getContentForPreview(id, tenantId)`) over inventing a second parallel type.  
Do **not** require PlaylistItem for Content Studio preview.

---

## 10. Preview Host

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. Inline on Studio page** | Simple | CSS bleed with admin chrome | Acceptable for MVP if staged in aspect box |
| **B. Isolated container** (aspect-video / PreviewViewport shell) | Matches playlist preview; CSS controllable; video lifecycle clear | Slightly more structure | **RECOMMENDED** |
| **C. Sandboxed iframe** | Strong isolation for future HTML_APP | Overkill now; no executable HTML in scope; signed URL / cookie complexity | **Defer** until Experience Runtime |

**Recommendation:** **B** — PreviewHost as a bordered aspect-ratio stage inside `/admin/contents/[id]` (and optionally `/new` draft state). Reuse visual language of `playlist-timed-preview` stage (`bg-[#070b14]`, object-contain), without playlists controls unless needed for VIDEO demo.

**Fullscreen (future, not 3F-A):** prefer **modal / stage expand** over browser Fullscreen API and over a dedicated route; do not touch PWA manifest.

**PreviewViewport (future API — do not implement now):** `{ width, height, aspectRatio, orientation }` for desktop/tablet/mobile chrome around the stage. Not DeviceRuntimeConfig.

---

## 11. Security

| Topic | Evidence / recommendation |
|-------|---------------------------|
| Tenant isolation | Preview data via `getContent` / `listContentsForPreview` + session `tenantId` only |
| MediaAsset ownership | `getUrl` only after tenant-scoped ContentAsset join (already in listContentsForPreview) |
| Signed URLs (R2) | 7d TTL (`r2-provider.ts`); admin preview can go stale — refresh on page load; **no new permanent URL** |
| Local `/api/media/...` | Requires admin session **or** device Bearer (`api/media/[...key]`) — Preview uses admin session |
| XSS / HTML | Player text uses React text nodes / `escapeHtml` in tv.js; **no** `dangerouslySetInnerHTML` for Content payloads |
| TEXT/NOTICE/NEWS | Treat as **plain text**; do not interpret HTML |
| QR_CODE `url` | Data only; render as QR target / link text; **never** `eval` / script injection |
| iframe | Not required for 3F; forbid arbitrary HTML Experience in Content Preview |
| External content | No live NEWS feeds today — static payload only |

---

## 12. Media Handling

| Path | Mechanism |
|------|-----------|
| Admin preview URL | `storage.getUrl(storageKey)` — R2 presign **or** `/api/media/...` (local) |
| Device playback | Manifest `url` + `offlineUrl` `/api/device/media/:id` + IndexedDB blobs |

**Phase 3F:** reuse existing `getUrl` / `ContentPreviewRow.mediaUrl`.  
Do not add storage endpoints. Do not proxy through device media routes.

---

## 13. Video

| Topic | Current behaviour | Preview implication |
|-------|-------------------|---------------------|
| URL | Same as IMAGE (storage URL) | Use `mediaUrl` |
| durationMs = 0 | Natural end in Player | Show metadata “natural”; optional muted autoplay with controls for admin |
| durationMs > 0 | Fixed slide / loop in Player | Show fixed duration badge; looping optional |
| autoplay | Player: muted + playsInline | Preview: muted; respect browser autoplay policies |
| controls | Player: none | Preview: **recommend controls=true** for admin usability |
| object-fit | `contain` | Match Player semantic (contain on black) |
| errors | Player advances after timeout on natural video | Preview: error state UI |
| cleanup | display-engine revokes blob URLs | Preview: unmount pause + clear `src` if blob ever used; prefer non-blob URLs |

**Do not** download entire large videos into memory for preview when URL streaming works.

---

## 14. Clock

| Topic | Evidence |
|-------|----------|
| Payload | `showDate`, `showTime`, `format` |
| Runtime | `new Date()` / `toLocaleTimeString` / `toLocaleDateString` — **browser/device local TZ** |
| Workspace timezone | Exists on `tenants.timezone`; used by playback-resolver for schedules — **not** by CLOCK renderer |
| Device timezone | Optional on device; schedule resolver prefers device then tenant |

**Preview Time recommendation (do not implement in audit):**

- Inject optional `previewNow: Date` (default `new Date()`).  
- Respect `showDate` / `showTime` / `format` in Preview even if Player still ignores them (admin truthfulness).  
- Document that Device Runtime CLOCK parity is **Player Technical Debt**, not a Preview blocker.  
- Do not bind Preview CLOCK to Device timezone.

---

## 15. QR Code

| Classification | **NOT IMPLEMENTED** (visual QR) |
|----------------|----------------------------------|
| Payload | AVAILABLE (`url`, `label`, `size`) |
| Player | PARTIAL text card (title; URL not shown via body fallback) |
| Library | None installed |

**Phase 3F options (document only):**

1. Stub visual: title + escaped URL + label (no matrix).  
2. Later: add a small QR dependency (e.g. `qrcode` / similar) — **not in this audit**.  

Do not hide absence. Do not implement here.

---

## 16. Presentation

| Attribute | Owner | Preview dependency? |
|-----------|-------|---------------------|
| `fitMode` | PlaylistItem | **No** — Content Preview must work without it; default black + contain matches current Player behaviour |
| `transition` | PlaylistItem | **No** — sequence concern |
| `durationOverrideMs` | PlaylistItem | **No** — Preview uses Content.durationMs |

**Technical dependency check:** Neither playlist-timed-preview Slide nor display-engine Slide **requires** PlaylistItem fields to paint IMAGE/VIDEO/text. `fitMode` is unused even when present. **No blocker.**

---

## 17. Offline

Admin Content Preview is an **online** console feature.

| Dependency | Required for Preview? |
|------------|----------------------|
| IndexedDB offline runtime | **NO** |
| Service Worker | **NO** |
| Manifest cache | **NO** |

Requires: authenticated admin session + reachable media URL (R2 or `/api/media` with cookie).

---

## 18. Performance

| Risk | Notes |
|------|-------|
| Large video | Prefer stream via URL; avoid blob download in admin |
| Large image | Same; Media Library already loads full images in lightbox |
| Object URLs | Display-engine pattern: always revoke on unmount if blob used |
| Repeated open/close Studio | Unmount must pause `<video>` |
| R2 TTL expiry | Refresh URL on each server render of Studio page |

No optimisations in this phase — document for implementers.

---

## 19. RBAC

| Role | `manage_contents` | Content Studio today | Preview recommendation |
|------|-------------------|----------------------|------------------------|
| VIEWER | DENIED | Cannot open Studio APIs | **Defer** VIEWER preview (would need read permission / page gate change) |
| OPERATOR | DENIED | Same | Same |
| EDITOR+ | ALLOWED | Full Studio | Preview under **existing** `manage_contents` |

**Do not** create `preview_contents` in Phase 3F.  
Preview is read-only UI, but data loading still requires content access — reuse `manage_contents` for MVP consistency with Studio routes.

---

## 20. Test Strategy (specify only — do not implement product tests here)

| ID | Intent |
|----|--------|
| PREVIEW-001 | IMAGE renders from mediaUrl |
| PREVIEW-002 | VIDEO renders from mediaUrl |
| PREVIEW-003 | VIDEO durationMs=0 shows natural metadata |
| PREVIEW-004 | TEXT renders body (plain text) |
| PREVIEW-005 | NOTICE renders message |
| PREVIEW-006 | EVENT renders description (+ ideally date/time/location if Preview implements fidelity) |
| PREVIEW-007 | NEWS renders body (+ source if implemented) |
| PREVIEW-008 | QR_CODE — stub or matrix per implementation choice; never executes URL as script |
| PREVIEW-009 | CLOCK respects showDate/showTime/format with Preview Time |
| PREVIEW-010 | Foreign tenant Content → 404 / no preview |
| PREVIEW-011 | Foreign tenant MediaAsset not reachable |
| PREVIEW-012 | INACTIVE Content previewable in admin with status indicator |
| PREVIEW-013 | validFrom/validTo — warning only (see §22); not playback gate |
| PREVIEW-014 | Video cleanup on unmount |
| PREVIEW-015 | Image unmount safe |
| PREVIEW-016 | No import from `player-app` / device sync modules |
| PREVIEW-017 | No Playlist / PlaylistItem required |
| PREVIEW-018 | No Schedule required |
| PREVIEW-019 | No Manifest required |
| PREVIEW-020 | No IndexedDB required |

---

## 21. Risks

| Risk | Severity | Mitigation in 3F |
|------|----------|------------------|
| Extracting shared visual accidentally pulls Player/IDB | High | Start from `playlist-timed-preview` Slide, not display-engine |
| QR expectation vs stub | Medium | Explicit UI “QR visual ainda não disponível” if no library |
| Payload fidelity > Player | Medium | Document as Preview-first improvement; no Player change |
| R2 signed URL expiry in long-lived SPA tab | Medium | Refresh on navigation / soft reload |
| Large VIDEO memory | Medium | Stream + controls; no blob |
| Scope creep into Playlist presentation | High | Hard refuse fitMode/transition in Content Preview MVP |
| Scope creep into Experience HTML | Critical | Hard refuse |

---

## 22. Gaps

| ID | Gap | Blocks 3F? |
|----|-----|------------|
| G1 | No Content Studio Preview host | **No** — this is the deliverable of 3F |
| G2 | QR renderer missing | **No** — stub allowed |
| G3 | Payload fields ignored by Player | **No** — Player debt |
| G4 | fitMode unused in Runtime | **No** — PlaylistItem concern |
| G5 | validFrom/validTo unused in resolver/manifest | **No** — recommend admin warning only |
| G6 | Duplicated Slide implementations | **No** — 3F can start shared visual |
| G7 | VIEWER cannot preview | **No** — out of MVP permission change |
| G8 | player-app ESLint refs | **No** — Player debt |
| G9 | Playlist preview `mediaUrl` already exists | Opportunity, not gap |

### Content status / validity recommendations

| Field | Playback today | Admin Preview recommendation |
|-------|----------------|------------------------------|
| ACTIVE | Eligible for manifest | Normal preview |
| INACTIVE | Excluded from manifest | **Allow** preview with clear INACTIVE badge (admin ≠ eligibility) |
| validFrom / validTo | **Not enforced** | Show informational warning if outside window; **do not block** preview |

---

## 23. Recommended Implementation Order

1. **`getContentForPreview(id, tenantId)`** — single Content + primary mediaUrl (+ status, valid*, mime). Reuse storage URL pattern from `listContentsForPreview`.  
2. **Extract `ContentVisual`** from `playlist-timed-preview` Slide (shared module under e.g. `src/features/contents/` or `src/features/preview/`).  
3. **PreviewHost** aspect-stage on `/admin/contents/[id]` (read-only; no form writes from host).  
4. **IMAGE + VIDEO** first (highest value).  
5. **TEXT / NOTICE / NEWS / EVENT** payload-aware text layouts (plain text).  
6. **CLOCK** with payload flags + Preview Time.  
7. **QR_CODE** stub (or library in a follow-up if product insists).  
8. Optional: refactor PlaylistTimedPreview to consume `ContentVisual` (regression-sensitive — after Studio preview stable).  
9. Tests PREVIEW-001..020 (automated where practical without Player).  

**Still forbidden during 3F implementation:** Player / Runtime / Manifest / Sync / SW / IndexedDB / Auth / Membership / RBAC model / R2 redesign / Experience HTML.

---

## 24. Explicit Non-Goals

- Modifying Player, `display-engine`, `tv.js`, sync, manifest, SW, IndexedDB  
- Making Preview depend on PlaylistItem  
- Implementing Experience / HTML_APP sandbox  
- Installing QR libraries in the audit phase  
- Creating `preview_contents` permission  
- Enforcing validFrom/validTo in playback  
- Fixing fitMode in Runtime  
- Fullscreen / PWA changes  
- DeviceRuntimeConfig  

---

## 25. Final Verdict

```
ARCHITECTURE AUDIT — APPROVED FOR PHASE 3F IMPLEMENTATION
```

### Preconditions

1. Phase 3B Content Studio remains production-validated.  
2. Implementation stays on Content → PreviewRenderer → Preview UI.  
3. No Player / Runtime product changes in Phase 3F.  
4. Media URLs continue via existing `MediaStorageProvider.getUrl`.  

### Necessary changes (implementation phase — not this audit)

- PreviewHost + ContentVisual extraction  
- Optional `getContentForPreview`  
- Studio UI wire-up (read-only)  
- Automated PREVIEW tests  

### Recommended order

See §23.

### Risks

See §21 — none are architectural blockers.

### If this were BLOCKED (it is not)

No blocker identified. Closest risks (QR absence, payload/Player drift) are classified as **gaps with stubs**, not architecture failure.

---

## Appendix A — Evidence map

| Claim | Evidence |
|-------|----------|
| Content types enum | `src/domain/types.ts` CONTENT_TYPES |
| Payload defaults | `defaultPayloadForType` in `src/services/contents.ts` |
| Studio payload builders | `buildPayload` in `content-studio-form.tsx` |
| ContentPreviewRow | `listContentsForPreview` in `contents.ts` |
| React Player Slide | `display-engine.tsx` |
| Admin playlist Slide | `playlist-timed-preview.tsx` |
| Legacy Slide | `public/tv.js` `renderSlide` / `renderClock` |
| ACTIVE filter in manifest | `manifest.ts` `eq(contents.status, "ACTIVE")` |
| validFrom unused in resolver | no matches in `playback-resolver.ts` / `manifest.ts` |
| Media GET auth | `src/app/api/media/[...key]/route.ts` |
| R2 URL TTL | `r2-provider.ts` comment 7 days |
| RBAC | `ROLE_PERMISSIONS` VIEWER lacks `manage_contents` |
| Media Library lightbox | `media-library.tsx` `ImagePreview` |
| fitMode unused in Slide | display-engine + playlist-timed-preview (prop present, not applied to layout) |

## Appendix B — PLAYER TECHNICAL DEBT register (3F-A)

| Debt | Location | Action in 3F |
|------|----------|--------------|
| react-hooks/refs | `player-app.tsx` | None |
| fitMode not applied | display-engine / tv.js | None |
| Payload field ignore | display-engine / tv.js / playlist preview | Preview may honour; Player untouched |
| QR missing | all runtimes | Stub in Preview only |
| Slide duplication | 3 implementations | Prefer extract from admin Slide |

---

**PHASE 3F-A STATUS: AUDIT COMPLETE**
