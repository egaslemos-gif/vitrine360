# Vitrine360 — GIF Support Architecture Audit (Phase 3C-A)

**Date:** 2026-09-22  
**Phase:** 3C-A (audit only)  
**Prerequisites:** Phase 1 / 2 / 3A / 3B / 3F-B / 3E-B — Production Validated  
**Related:** `docs/MEDIA-CONTENT-STUDIO-AUDIT.md` §G3 / Phase 3C; `docs/MEDIA-LIBRARY-3A-IMPLEMENTATION.md`  

**Product code changes in this phase:** **NONE**  
**Schema / Player / Runtime / Manifest / Sync / SW / IndexedDB / Auth:** **NOT MODIFIED**

---

## 1. Executive Verdict

| Question | Verdict |
|----------|---------|
| Is `image/gif` accepted as MediaAsset? | **YES** |
| Is Media Library GIF filter live? | **YES** (Phase 3A) |
| Does `CONTENT_TYPES` include `GIF`? | **NO** |
| How does GIF play today? | As **IMAGE** via `<img>` (browser animation) + **timer** duration |
| Is there an explicit GIF playback policy? | **NO** — gap for 3C-B |
| Does architecture require a new Content type? | **NO** (recommended) |
| Can Phase 3C implement without Player redesign? | **YES** — evidence-first, minimal |

```
ARCHITECTURE AUDIT — APPROVED FOR PHASE 3C IMPLEMENTATION
```

**Recommended canonical policy (for 3C-B — do not implement here):**

> GIF is a **MediaAsset MIME** (`image/gif`) attached to Content type **`IMAGE`**.  
> Playback is **timer-based** (`durationMs` / PlaylistItem override), same as still images.  
> Animation is **browser-native** inside `<img>`.  
> Do **not** add `CONTENT_TYPE = "GIF"` in Phase 3C unless product later mandates loop-complete semantics (would reopen Player + Hisense risk).

---

## 2. Scope

### In scope

- Map real GIF handling across Media, Content, Studio, Preview, Manifest, React, Legacy, offline, Hisense evidence
- Answer the 15 policy questions with evidence
- Recommend Phase 3C-B implementation boundaries

### Out of scope (absolute)

- Product implementation  
- Schema migrations  
- Player / Runtime / Manifest / Sync / IndexedDB / SW / Auth changes  
- New GIF decoder / loop counter  
- Experience / HTML_APP  

---

## 3. Current State Map (evidence)

### 3.1 MediaAsset / upload

| Capability | Status | Evidence |
|------------|--------|----------|
| MIME allowlist includes `image/gif` | **YES** | `contents.ts` `ALLOWED_MIME` |
| Magic sniff GIF89a / GIF87a | **YES** | `sniffMime` in `media/paths.ts` (`GIF` bytes) |
| Local media route serves `.gif` | **YES** | `api/media/[...key]/route.ts` |
| SHA-256 dedupe | **YES** | Phase 3A (tenant-scoped) |
| R2 / storage abstraction | **YES** | unchanged; GIF is opaque bytes |
| `media_assets.durationMs` populated for GIF | **NO** | nullable; **never set on upload** (MEDIA audit) |

### 3.2 Media Library (3A)

| Capability | Status | Evidence |
|------------|--------|----------|
| Filter `gif` | **YES** | `media-library-filters.ts` `isGifMime` / `MediaTypeFilter` |
| GIF section in UI | **YES** | `media-library.tsx` |
| IMAGE filter excludes GIF | **YES** | `isImageMime` = `image/*` && !gif |
| Lightbox preview | **YES** | `<img>` — animates if browser supports |

### 3.3 Content domain

| Capability | Status | Evidence |
|------------|--------|----------|
| `CONTENT_TYPES` has `GIF` | **NO** | `types.ts`: IMAGE…CLOCK only |
| Attach GIF to IMAGE | **YES** | `assertMediaCompatibleWithType`: `image/*` |
| Attach GIF to VIDEO | **NO** | requires `video/*` |
| IMAGE `durationMs = 0` | **REJECTED** | `assertContentDuration` — IMAGE must be > 0 |
| VIDEO natural duration | **YES** | `durationMs = 0` — **not** applicable to GIF today |

### 3.4 Content Studio / Preview

| Capability | Status | Evidence |
|------------|--------|----------|
| Studio IMAGE picker includes GIF | **YES** | `media-asset-picker.tsx` `mime.startsWith("image/")` |
| Upload accept `image/*` | **YES** | `content-studio-form.tsx` |
| Deep-link `?mediaAssetId=` → IMAGE if not video | **YES** | treats non-video as IMAGE (GIF becomes IMAGE) |
| Dedicated GIF badge / copy | **NO** | gap |
| Content Preview for GIF | **PARTIAL** | `ContentVisual` IMAGE path uses `<img>` — animates; no GIF-specific chrome |

### 3.5 Manifest / Playlist / duration

| Capability | Status | Evidence |
|------------|--------|----------|
| Manifest type field | Content.type (`IMAGE` if GIF-backed) | `manifest.ts` |
| Assets include mimeType | **YES** | ManifestAsset |
| Duration resolution | `durationOverrideMs ?? content.durationMs` | always timer for IMAGE |
| GIF-specific duration policy | **NONE** | treated as IMAGE |

### 3.6 React Runtime

| Capability | Status | Evidence |
|------------|--------|----------|
| IMAGE branch | `<img src={url}>` | `display-engine.tsx` |
| MIME-aware branch for GIF | **NO** | type === `"IMAGE"` only |
| GIF “natural end” | **NO** | no decoder / no `ended` on img |
| Timer advance | DisplayEngine duration timer | same as still IMAGE |

### 3.7 Legacy Runtime (`tv.js` / Smart TV)

| Capability | Status | Evidence |
|------------|--------|----------|
| IMAGE branch | `<img>` + `hold(slideDuration)` | `tv.js` `renderSlide` |
| GIF-specific logic | **NO** | |
| Smart TV | same family / IMAGE as img | `player-smarttv.js` |
| Hisense GIF evidence | **NOT TESTED** | `HISENSE-PHYSICAL-VALIDATION.md` — no GIF cases |

### 3.8 Offline / IndexedDB

| Capability | Status | Evidence |
|------------|--------|----------|
| GIF bytes cached like other assets | **YES** (as IMAGE asset) | `downloadAsset` by asset id; mime-agnostic |
| Special GIF offline policy | **NO** | |
| Large animated GIF memory risk | **DOCUMENTED RISK** | MEDIA audit: GIF size peer of images |

---

## 4. Answers to the 15 Policy Questions

| # | Question | Answer (from code + evidence) |
|---|----------|-------------------------------|
| 1 | Own Content type `GIF`? | **Not required.** Recommend **no** for 3C. MIME under IMAGE is already operational. |
| 2 | Variant of IMAGE? | **YES — current and recommended.** |
| 3 | MediaAsset association? | ContentAsset primary → MediaAsset with `mimeType === "image/gif"`; Content.type = `IMAGE`. |
| 4 | Content Studio presentation? | IMAGE studio + optional **GIF badge** from `mimeType`; picker already lists GIFs. |
| 5 | Preview? | Reuse IMAGE `ContentVisual` (`<img>`); optional badge; no Player import. |
| 6 | Playlist/Manifest? | Type remains `IMAGE`; asset mime carried in assets[]; no new manifest field required. |
| 7 | React Runtime? | Keep `<img>`; timer from duration; **no** new type branch for MVP. |
| 8 | Legacy Runtime? | Keep `<img>` + hold(duration); same. |
| 9 | Own duration field? | Use existing Content.`durationMs` (+ PlaylistItem override). |
| 10 | Natural duration? | **Not supported** without a decoder. GIF has no video-like `ended`. Do not invent `durationMs=0` for IMAGE/GIF without Player work. |
| 11 | Animated image? | **YES** — browser animates GIF inside `<img>` while the slide timer runs. |
| 12 | Depend on timer? | **YES — canonical.** Slide advances on playlist/content duration, not on loop completion. |
| 13 | End naturally? | **NO** for MVP. Animation may loop/cut mid-cycle when timer fires. |
| 14 | Offline? | Same as IMAGE asset cache; no GIF-specific path. |
| 15 | Hisense / Sraf limits? | **UNKNOWN.** No GIF-specific physical tests. Risks: static first frame, CPU/memory on large GIFs, slow decode. **Must smoke on Hisense before claiming device VALIDATED.** |

---

## 5. Policy Options Compared

| Option | Description | Player impact | Pros | Cons |
|--------|-------------|---------------|------|------|
| **A. IMAGE + MIME (recommended)** | Keep type IMAGE; badge + docs + tests | Minimal / none | Matches code; low risk; Studio already works | No “play N loops then advance” |
| B. New Content type `GIF` | Add enum + Studio + Player branches | **High** | Explicit product surface | Duplicates IMAGE pipeline; migration; Hisense unknown |
| C. IMAGE + “natural” GIF duration | `durationMs=0` means wait for loops | **High** | Closer to VIDEO natural | Needs GIF decode/loop API; fragile on Sraf; MediaAsset.durationMs empty |

**Phase 3C-B should implement Option A.**

Option B/C only if product later requires loop-complete semantics **and** Hisense evidence supports it.

---

## 6. Duration Semantics (preserve vs change)

Current effective rule (unchanged by this audit):

```text
effectiveDuration = PlaylistItem.durationOverrideMs ?? Content.durationMs
```

| Type | Today | Recommended for GIF-backed IMAGE |
|------|-------|----------------------------------|
| IMAGE (still) | `durationMs > 0` required | unchanged |
| IMAGE (gif mime) | same timer | **same timer** — document that GIF may loop inside the window |
| VIDEO | `0` = natural | unchanged — **do not reuse for GIF** |

**Do not** allow IMAGE/GIF `durationMs = 0` in 3C without a separate Player design RFC.

---

## 7. Preview vs Playback

| Concern | Content Preview (3F) | Playback |
|---------|----------------------|----------|
| Renderer | `<img>` in ContentVisual | `<img>` in DisplayEngine / tv.js |
| Needs GIF type? | No | No |
| Timer | N/A (static stage) | Required |
| Badge “GIF” | Nice-to-have admin UX | Optional on diagnostics only |

---

## 8. Security / Storage

| Topic | Note |
|-------|------|
| MIME trust | Sniffed server-side; `image/gif` allowlisted |
| XSS | GIF is binary media via `<img src>`, not HTML |
| Tenant | Same MediaAsset isolation |
| Size | Subject to `MAX_UPLOAD_BYTES`; large animated GIFs are a **performance** risk, not a security one |

---

## 9. Hisense / VIDAA / Sraf

| Finding | Status |
|---------|--------|
| Physical IMAGE slides validated | YES (prior Hisense docs) |
| GIF-specific validation | **NOT TESTED** |
| Offline GIF | NOT TESTED (same as general Hisense offline gap) |
| Implication for 3C | Software can ship Option A; **device PRODUCTION VALIDATED for GIF** requires dedicated smoke |

---

## 10. Risks

| Risk | Severity | Mitigation in 3C-B |
|------|----------|--------------------|
| Operators expect “full animation then next” | Medium | Explicit UI copy: duração do slide; animação pode repetir |
| Huge GIFs stall Smart TV | High | Keep upload limit; document; optional future max dimension policy |
| Adding Content type `GIF` scopes creep into Player | High | Refuse in 3C unless Option B approved separately |
| Hisense shows static frame | Medium | Device smoke; fallback stay on IMAGE `<img>` |
| Confusing Media Library IMAGE vs GIF filters | Low | Already separated in 3A |

---

## 11. Gaps for Phase 3C-B (implementation backlog)

| ID | Gap | Player touch? |
|----|-----|---------------|
| G1 | No Studio GIF badge / helper text | No |
| G2 | No documented operator policy in-product | No |
| G3 | Content list does not surface mime (GIF vs PNG) | No |
| G4 | Preview has no GIF label | No |
| G5 | Automated tests: GIF→IMAGE create + preview + duration | No |
| G6 | Hisense GIF smoke | Device only |
| G7 | Optional: picker subtitle showing MIME | No |
| G8 | Loop-complete natural duration | **Yes — defer** |

---

## 12. Recommended 3C-B Implementation Order

1. Document operator policy in Studio (IMAGE + GIF MIME, timer semantics).  
2. Studio UX: badge when `mimeType === "image/gif"` on edit + list (optional).  
3. Ensure picker/upload paths remain IMAGE + `image/*` (already true).  
4. Tests: upload GIF → create IMAGE Content → preview `<img>` → duration > 0; reject VIDEO+gif.  
5. Regression: Media Library GIF filter, dedupe, 3B Studio, 3F Preview.  
6. Hisense smoke (evidence) before claiming device GIF validated.  
7. **Do not** add `GIF` to `CONTENT_TYPES`.  
8. **Do not** change DisplayEngine / tv.js unless a bug is found (none required for Option A).

---

## 13. Test Strategy (specify only)

| ID | Intent |
|----|--------|
| GIF-001 | sniffMime / upload `image/gif` |
| GIF-002 | Media Library filter GIF only |
| GIF-003 | create Content IMAGE + gif MediaAsset |
| GIF-004 | reject gif MediaAsset on VIDEO |
| GIF-005 | IMAGE duration must be > 0 for gif-backed content |
| GIF-006 | Content Preview renders mediaUrl for gif IMAGE |
| GIF-007 | Manifest type is IMAGE; asset mime image/gif |
| GIF-008 | Cross-tenant gif MediaAsset attach rejected |
| GIF-009 | Dedupe same gif bytes |
| GIF-010 | No `GIF` in CONTENT_TYPES (contract freeze) |
| GIF-011 | Hisense smoke (manual) — animate or note limitation |

---

## 14. Explicit Non-Goals (3C-A / 3C-B)

- New Content type `GIF` (unless future RFC)  
- GIF frame decoder / loop-complete advance  
- Changing VIDEO natural duration model  
- fitMode / transition work (done / separate)  
- Experience HTML  
- Schema migration  

---

## 15. Final Verdict

```
ARCHITECTURE AUDIT — APPROVED FOR PHASE 3C IMPLEMENTATION
```

### Preconditions for 3C-B

1. Policy frozen: **GIF = IMAGE + `image/gif` MediaAsset**, timer-based.  
2. No new Content type.  
3. Prefer Studio/UX/docs/tests over Player changes.  
4. Hisense GIF smoke before device-level VALIDATED claims.  
5. Preserve MediaAsset → ContentAsset → Content → PlaylistItem pipeline.

### If product rejects Option A

Escalate to a **separate RFC** for Option B/C (new type or natural GIF duration). That path is **not** approved as a silent part of 3C — it would re-open Player + Legacy + Hisense scope.

---

## Appendix A — Evidence index

| Topic | Path |
|-------|------|
| CONTENT_TYPES | `src/domain/types.ts` |
| ALLOWED_MIME / assertMedia* | `src/services/contents.ts` |
| sniffMime GIF | `src/services/media/paths.ts` |
| Library filters | `src/features/media/media-library-filters.ts` |
| Library UI | `src/features/media/media-library.tsx` |
| Studio picker | `src/features/contents/media-asset-picker.tsx` |
| Preview IMAGE | `src/features/contents/content-visual.tsx` |
| React IMAGE | `src/player/playback/display-engine.tsx` |
| Legacy IMAGE | `public/tv.js` |
| Media route | `src/app/api/media/[...key]/route.ts` |
| 3A tests | `scripts/test-media-library-3a.ts` |
| Prior GIF notes | `docs/MEDIA-CONTENT-STUDIO-AUDIT.md`, `MEDIA-LIBRARY-3A-IMPLEMENTATION.md` |
| Hisense | `docs/HISENSE-PHYSICAL-VALIDATION.md` |

## Appendix B — Answers snapshot

```text
GIF Content type?     NO (recommended)
GIF as IMAGE MIME?    YES
Studio?               IMAGE + badge (future 3C-B)
Preview?              IMAGE <img>
Manifest type?        IMAGE
React/Legacy?         <img> + timer
Natural duration?     NO for MVP
Hisense?              UNKNOWN — smoke required
```

---

**PHASE 3C-A STATUS: AUDIT COMPLETE**  
**PHASE 3C-B:** see `docs/GIF-SUPPORT-3C-IMPLEMENTATION.md`
