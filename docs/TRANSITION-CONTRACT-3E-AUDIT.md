# Vitrine360 — Transition Contract Architecture Audit (Phase 3E-A)

**Date:** 2026-09-22  
**Phase:** 3E-A (audit only)  
**Prerequisites:** Phase 1 / 2 / 3A / 3B / 3F-B — Production Validated  
**Related:** `docs/MEDIA-CONTENT-STUDIO-AUDIT.md` §12 / G5 / Phase 3E  

**Product code changes in this phase:** **NONE**

---

## 1. Executive Verdict

| Question | Verdict |
|----------|---------|
| Does `transition` belong on PlaylistItem? | **YES** — preserve |
| Is there contract drift Domain ↔ UI ↔ CSS ↔ Legacy? | **YES — confirmed** |
| Is DB column constrained to an enum? | **NO** — free `text`, default `"fade"` |
| Is write-path Zod/enum validation present? | **NO** |
| Does Legacy apply PlaylistItem.transition today? | **NO** — `transitionClass` is **dead code** |
| Does React apply transition tokens? | **PARTIAL** — CSS classes wired; opacity also forced inline |
| Can Phase 3E implement safely without redesign? | **YES** |

```
ARCHITECTURE AUDIT — APPROVED FOR PHASE 3E IMPLEMENTATION
```

**Blockers for implementation:** none architectural.  
**Work type:** contract unification + validation + controlled runtime wire-up — **not** a domain remodel.

---

## 2. Scope

### In scope (this audit)

- Map transition tokens across schema, domain, UI, API, Manifest, React Player, Legacy Player, CSS, docs, DB samples
- Document end-to-end flow and drift
- Recommend canonical contract for Phase 3E-B (implementation)

### Out of scope (absolute)

- Changing product code
- Migrating DB values
- Altering Player/Runtime/Manifest/Sync/SW/IndexedDB/Auth/Membership/RBAC
- Adding new transition effects beyond existing tokens
- Moving transition onto Content / MediaAsset / Device / Schedule

### Architectural principle (non-negotiable)

```
Content  (logical unit — no transition)
   ↓
PlaylistItem.transition  ← presentation ownership
   ↓
Playlist → Manifest → Runtime
```

Same Content may appear as `fade` in Playlist A and `cut` in Playlist B.

---

## 3. Current Content Model Ownership

| Concern | Owner | Evidence |
|---------|-------|----------|
| Transition | **PlaylistItem** | `playlist_items.transition` (`src/db/schema.ts`) |
| Duration override | PlaylistItem | `durationOverrideMs` |
| Fit / presentation | PlaylistItem | `fitMode` |
| Content type / payload / durationMs | Content | `contents` |
| Physical file | MediaAsset | `media_assets` |

Content Studio / Content Preview (3B / 3F) correctly **do not** edit transition.

---

## 4. Contract Matrix by Layer

| Camada | Valores aceites / referidos | Fonte | Observação |
|--------|----------------------------|-------|------------|
| Domain enum | `fade`, `slide`, `cut` | `src/domain/types.ts` `TRANSITIONS` | **Never imported for validation** anywhere in `src/` |
| Docs schema | `fade\|slide\|cut` | `docs/architecture/02-schema.md` | Matches domain, not UI |
| Drizzle column | any `text`, default `"fade"`, NOT NULL | `schema.ts` / `drizzle/0000_*.sql` | No CHECK / enum |
| Server write | free `string` | `updatePlaylistItem`, `addPlaylistItem`, server action | No Zod enum |
| Playlist UI | `fade`, `slide-left`, `zoom`, `cut` | `playlist-builder.tsx` `<option>` | **De facto write contract** |
| Admin timed preview | whatever is stored | `playlist-timed-preview.tsx` → `player-slide-${transition}` | Uses CSS classes |
| Manifest | passthrough string | `manifest.ts` | Emergency items hardcode `"cut"` |
| Default playlist seed | `"fade"` | `devices.ts` `getOrCreateDefaultPlaylistId` | |
| React DisplayEngine | string + special-case `"cut"` | `display-engine.tsx` | Class `player-slide-${t}` + inline opacity |
| React CSS | `fade`, `slide-left`, `zoom`, `cut` | `globals.css` `.player-slide-*` | **No** `.player-slide-slide` |
| Legacy `tv.html` CSS | `.fade-in`, `.slide-left`, `.zoom`, `.cut` | `public/tv.html` | Tokens exist |
| Legacy `tv.js` mapper | `slide-left`→`slide-left`, `zoom`, `cut`, else `fade-in` | `transitionClass()` | **Defined, never called** |
| Legacy render paths | hardcoded `fade-in` or bare `.slide` | `renderSlide` / video / clock | **Ignores PlaylistItem.transition** |
| Smart TV JS | hardcoded `fade-in` | `player-smarttv.js` | No transition mapping |
| Tests / seed | no transition fixtures | scripts | No enum tests |
| Live DB sample (Turso via `.env.local`) | only `fade` (n=481) | read-only GROUP BY | UI can still write others |

---

## 5. Real Variants — Answers

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | DB allows values outside expected set? | **YES** | Column is unconstrained `text` |
| 2 | Legacy values? | **Domain `slide` is documentary legacy** — UI never writes it; no CSS for `player-slide-slide` | types.ts vs globals.css |
| 3 | NULL allowed? | **NO** at schema (`notNull` + default `fade`) | schema / migration |
| 4 | Exists `slide`? | **In domain docs/enum only** — not in UI; not in CSS; not in sampled DB | |
| 5 | Exists `slide-left`? | **In UI + React CSS + Legacy CSS/mapper** — not in domain enum; not in sampled DB | |
| 6 | Exists `zoom`? | **In UI + React CSS + Legacy CSS/mapper** — not in domain enum; not in sampled DB | |
| 7 | Other values? | **Possible** (free string). Sampled DB: only `fade`. Manifest emergency uses literal `"cut"` when written | |

**Sampled production-connected DB (2026-09-22, read-only):**

```json
[{ "transition": "fade", "n": 481 }]
```

Interpretation: operators have mostly left the default; UI options `slide-left` / `zoom` / `cut` are rare or unused in this dataset, but **writable today without validation**.

---

## 6. End-to-End Flow (as implemented)

```text
Playlist Editor (playlist-builder.tsx)
  options: fade | slide-left | zoom | cut
      ↓  (no client enum check beyond <select>)
updatePlaylistItemAction / updatePlaylistItem
  transition?: string   ← unconstrained
      ↓
playlist_items.transition  (TEXT NOT NULL DEFAULT 'fade')
      ↓
buildDeviceManifest / buildPlaylistBlock
  item.transition passthrough
  (emergency Content → transition: "cut")
      ↓
React /player
  PlaybackItem.transition
  DisplayEngine:
    - className = player-slide-${transition||"fade"}
    - inline opacity 300ms (always)
    - if transition === "cut" OR VIDEO involved → skip opacity hide
      ↓
Legacy /tv.html + tv.js
  Manifest items available in playState
  renderSlide: hardcoded "fade-in" OR no animation class
  transitionClass(value): UNUSED (dead)
```

### Validation gap

There is **no** Zod `z.enum(TRANSITIONS)` (or UI token enum) on:

- `updatePlaylistItemAction`
- `updatePlaylistItem`
- `addPlaylistItem`
- API playlist PATCH body (if any free-form path)

Any string can be persisted and will reach the Manifest.

---

## 7. Domain Rendering vs Playback Orchestration

| Concern | Location | Role of `transition` |
|---------|----------|----------------------|
| **Visual effect** | CSS class / animation | How the next slide appears |
| **Orchestration** | DisplayEngine timers | `"cut"` (and VIDEO) skips opacity crossfade delay |
| **Legacy visual** | Should use `transitionClass` | Currently **not applied** |
| **Content Preview (3F)** | No PlaylistItem | Correctly out of scope |

---

## 8. Drift Summary (critical)

```text
Domain / docs:     fade | slide | cut
UI / React CSS:    fade | slide-left | zoom | cut
Legacy CSS/mapper: fade-in | slide-left | zoom | cut
Legacy applied:    mostly fade-in only (hardcoded)
DB:                unconstrained text (default fade)
```

| Token | Domain | UI write | React CSS | Legacy CSS | Legacy applied | Sampled DB |
|-------|--------|----------|-----------|------------|----------------|------------|
| `fade` | YES | YES | YES (`player-slide-fade`) | as `fade-in` | hardcoded often | YES |
| `slide` | YES | **NO** | **NO** | **NO** | NO | NO |
| `slide-left` | **NO** | YES | YES | YES | mapper unused | NO |
| `zoom` | **NO** | YES | YES | YES | mapper unused | NO |
| `cut` | YES | YES | YES | YES | mapper unused | NO* |

\* `"cut"` is hardcoded for emergency manifest items when those rows are generated; may not appear as a stored PlaylistItem value in the sample.

---

## 9. React Player Behaviour (study only)

**File:** `src/player/playback/display-engine.tsx`

1. Applies `className={`player-slide-${item.transition || "fade"}`}`.  
2. **Also** sets `style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms" }}`.  
3. For `transition === "cut"` (or VIDEO current/next): skips the opacity hide path (`keepFrame` / immediate index bump).

**Implication:** Even when CSS animation classes exist, the inline opacity orchestration dominates much of the perceived effect. Unifying the contract in 3E must decide whether:

- CSS animation is the source of truth, or  
- opacity orchestration is the source of truth,

without changing behaviour accidentally.

**CSS:** `src/app/globals.css`

- `.player-slide-fade`
- `.player-slide-slide-left`
- `.player-slide-zoom`
- `.player-slide-cut`

There is **no** `.player-slide-slide` — domain token `slide` is **NOT WIRED**.

---

## 10. Legacy Player Behaviour (study only)

| File | Finding |
|------|---------|
| `public/tv.js` `transitionClass` | Maps UI tokens → CSS classes; **never called** (also flagged unused by ESLint) |
| `public/tv.js` `renderSlide` | IMAGE: bare `.slide`; text-like: hardcoded `fade-in`; CLOCK: bare `.slide` |
| `public/tv.html` | Defines `.fade-in`, `.slide-left`, `.zoom`, `.cut` |
| `public/player-smarttv.js` | Hardcoded `fade-in`; no transition mapping |

**Conclusion:** Legacy transition CSS is **prepared but not driven by PlaylistItem.transition**. This is Player Technical Debt for Phase 3E-B (controlled wire-up), not a reason to move ownership off PlaylistItem.

---

## 11. Manifest & Defaults

| Path | Transition behaviour |
|------|----------------------|
| Normal playlist items | Copy `playlist_items.transition` into manifest item |
| Emergency / interrupt content | `transition: "cut"` literal in `buildContentManifestItem` |
| Default playlist item creation | `transition: "fade"` |
| `addPlaylistItem` without param | `params.transition ?? "fade"` |

Manifest does **not** validate tokens.

---

## 12. Preview Surfaces

| Surface | Uses transition? | Notes |
|---------|------------------|-------|
| Content Preview (3F) | **NO** | Correct — Content-only |
| Playlist timed preview | **YES** | Applies `player-slide-${transition}` class; no Legacy path |

---

## 13. Recommended Canonical Contract (for 3E-B — do not implement here)

Align **all** layers to the **UI + CSS** tokens already shipped:

```ts
export const TRANSITIONS = ["fade", "slide-left", "zoom", "cut"] as const;
```

| Action | Rationale |
|--------|-----------|
| **Drop** domain/docs `slide` | No CSS, no UI, never sampled in DB |
| **Keep** `slide-left`, `zoom` | Already in UI + React CSS + Legacy CSS |
| **Keep** `fade`, `cut` | Universal |
| Add Zod / service validation on write | Prevent free-string pollution |
| Map Legacy `fade` → `fade-in` class | Existing Legacy CSS name |
| Wire or delete `transitionClass` | Dead code today |
| Do **not** invent new effects | Out of scope for 3E |

### Explicit non-goals for 3E-B

- Do not move transition to Content  
- Do not add transition duration / easing columns unless separately approved  
- Do not change Sync / IndexedDB / pairing  
- Do not “fix” fitMode in the same phase unless scoped separately (Phase 3D)  
- Do not require Content Preview to show transitions  

---

## 14. Risks

| Risk | Severity | Mitigation in 3E-B |
|------|----------|---------------------|
| Tightening enum rejects unknown DB rows | Medium | Sample first; migrate unknown → `fade`; sampled DB currently clean |
| Wiring Legacy suddenly changes Hisense visuals | High | Feature-flag or parity tests; apply class only where safe |
| React dual opacity + CSS animation confusion | Medium | Document single behaviour decision before coding |
| Domain `slide` leftover in docs | Low | Update docs with enum |
| Operators already saved `slide-left`/`zoom` in other envs | Medium | Include those tokens in canonical set (recommended) |

---

## 15. Gaps (Phase 3E backlog)

| ID | Gap | Blocks 3E-A? |
|----|-----|--------------|
| G1 | Domain `TRANSITIONS` ≠ UI tokens | **No** — defines 3E-B work |
| G2 | No Zod/write validation | No |
| G3 | Legacy `transitionClass` unused | No |
| G4 | Domain `slide` unwired | No |
| G5 | Docs `02-schema.md` outdated | No |
| G6 | React opacity orchestration vs CSS animation | No — decide in 3E-B |
| G7 | Smart TV player ignores transition | No — document as debt / optional wire |

---

## 16. Recommended Implementation Order (3E-B)

1. Freeze canonical enum: `fade | slide-left | zoom | cut`.  
2. Update `TRANSITIONS` + docs (`02-schema.md`, audits).  
3. Add Zod validation on playlist item create/update paths.  
4. Reject / coerce unknown values on write (prefer reject with clear PT error).  
5. Optional read-time normalize for unknown legacy strings → `fade`.  
6. React: confirm CSS class application; decide opacity orchestration interaction.  
7. Legacy: wire `transitionClass` into `renderSlide` **or** explicitly mark unsupported — with Hisense smoke.  
8. Tests: enum round-trip, invalid reject, manifest passthrough, CSS class presence.  
9. **Do not** change Content / Preview / Media / Auth.

---

## 17. Test Strategy (specify only)

| ID | Intent |
|----|--------|
| TRANS-001 | Canonical enum matches UI options |
| TRANS-002 | Zod rejects unknown transition on update |
| TRANS-003 | Default create uses `fade` |
| TRANS-004 | Manifest includes PlaylistItem.transition |
| TRANS-005 | Emergency manifest uses `cut` |
| TRANS-006 | React class `player-slide-slide-left` exists in CSS |
| TRANS-007 | Domain no longer lists unwired `slide` |
| TRANS-008 | Cross-playlist same Content, different transitions persist independently |
| TRANS-009 | Legacy applies class **or** documented skip with reason |
| TRANS-010 | No Content / MediaAsset column for transition |

---

## 18. Explicit Non-Goals (3E-A)

- No product code changes  
- No DB writes / migrations in this audit  
- No Player behaviour changes  
- No new transition designs  
- No fitMode / durationOverride changes  

---

## 19. Final Verdict

```
ARCHITECTURE AUDIT — APPROVED FOR PHASE 3E IMPLEMENTATION
```

### Preconditions

1. Keep transition on **PlaylistItem** only.  
2. Canonical tokens = UI/CSS set: `fade`, `slide-left`, `zoom`, `cut`.  
3. Retire domain/docs token `slide`.  
4. Add write validation; optionally wire Legacy mapper.  
5. Do not touch Auth, Sync, SW, IndexedDB, Content Studio Preview contract.

### If this were BLOCKED (it is not)

No architectural blocker. Closest risk is Legacy/React behavioural surprise when wiring — manageable with phased 3E-B and smoke tests.

---

## Appendix A — Evidence map

| Claim | Evidence |
|-------|----------|
| Column definition | `src/db/schema.ts` `playlistItems.transition` |
| Migration default | `drizzle/0000_known_leopardon.sql` |
| Domain enum | `src/domain/types.ts` `TRANSITIONS` |
| Domain unused for validation | Grep: no imports of `TRANSITIONS` for writes |
| UI options | `playlist-builder.tsx` lines ~182–185 |
| Unconstrained service update | `playlists.ts` `updatePlaylistItem` |
| Server action free string | `playlists/actions.ts` |
| React class + cut special-case | `display-engine.tsx` |
| React CSS | `globals.css` `.player-slide-*` |
| Legacy mapper dead | `tv.js` `transitionClass` — no call sites |
| Legacy hardcoded fade-in | `tv.js` `renderSlide` text path |
| Legacy CSS | `tv.html` |
| Manifest passthrough / emergency cut | `manifest.ts` |
| Default fade | `devices.ts`, `addPlaylistItem` |
| Docs drift | `docs/architecture/02-schema.md`, MEDIA audit §12 |
| DB sample | read-only GROUP BY → only `fade` (481) |

## Appendix B — PLAYER TECHNICAL DEBT (record only)

| Debt | Notes |
|------|-------|
| Legacy ignores PlaylistItem.transition | CSS ready; mapper unused |
| Smart TV no transition mapping | Hardcoded fade-in |
| React dual opacity + CSS animation | Behavioural ambiguity |
| ESLint unused `transitionClass` | Confirms dead code |
| Preexisting player-app refs lint | Unrelated; out of 3E scope unless touched |

---

**PHASE 3E-A STATUS: AUDIT COMPLETE**
