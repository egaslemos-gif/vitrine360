# RUNTIME-PLAYBACK-05 — Pre-Implementation Audit

Date: 2026-09-26  
Scope: `src/player/`, `src/player/playback/`, `src/features/player/`, domain playback modules, Experience slide/shell.

**Rule:** No RP-05 implementation changes were applied before this document was written.

---

## 1. Architecture (current, RP-01…04)

```
Manifest → DisplayEngine → PlaybackController → PlaybackState
                ↓
         PlaybackRendererAdapter → Slide (VIDEO|AUDIO|IMAGE|CLOCK|TEXT|EXPERIENCE)
                ↓
         MEDIA_* events (generation-gated) → Controller
```

- **SoT:** `PlaybackController` / `PlaybackState` (`src/domain/playback-state.ts`).
- **Presentation timer:** single `PresentationTimer` owned by `PlaybackRendererAdapter` (RP-03).
- **Controls:** `PlaybackControls` / `PlaybackChrome` dispatch `PlaybackAction` only (RP-04).
- **Fullscreen / cursor:** reused RP-08A / RP-02 — not reimplemented.

---

## 2. Renderer ownership (as found)

| Type | Current renderer | Element | Notes |
|------|------------------|---------|-------|
| VIDEO | `Slide` in `playback-renderer-adapter.tsx` | `HTMLVideoElement` | play/pause/seek/volume/mute via state mirror; native `ended` when `durationMs===0`; loop + PresentationTimer when `durationMs>0` |
| AUDIO | same `Slide` | `HTMLAudioElement` | same event contract as VIDEO; visual is minimal title + hidden controls |
| IMAGE | same `Slide` | `<img>` | PresentationTimer; **no `onError`** |
| GIF | **gap** | — | `CONTENT_TYPES` has no `GIF`; adapter only branches `type==="IMAGE"`. A `type:"GIF"` item falls through to TEXT fallback. Mime `image/gif` with `type:IMAGE` works as IMAGE. |
| EXPERIENCE | `ExperiencePlaybackSlide` → `ExperienceRuntimeShell` | iframe sandbox | Admit API + safe-fallback; does **not** emit MEDIA_* to controller on failure today (isolation OK; progress/controls limited) |
| CLOCK / TEXT | `LiveClockSlide` / text layout | — | PresentationTimer via non-media READY path |

---

## 3. Timing ownership

| Concern | Owner | Status |
|---------|-------|--------|
| Natural VIDEO/AUDIO (`durationMs===0`) | native `ended` → `MEDIA_ENDED` | OK (RP-03) |
| Explicit VIDEO/AUDIO (`durationMs>0`) | PresentationTimer + `loop`; `onEnded` gated | OK |
| IMAGE / GIF / TEXT / CLOCK / EXPERIENCE hosted | PresentationTimer | OK for IMAGE; GIF only if typed as IMAGE |
| DisplayEngine timers | none (controller SoT) | OK |
| Race native ended + timer | gated `nativeEnded` | OK |

---

## 4. Duration semantics

- **Item `durationMs===0`:** natural media; `state.durationMs` filled from metadata.
- **Item `durationMs>0`:** presentation duration (may differ from native media length).
- `effectiveDurationMs` / `classifyTiming` in `src/domain/playback-timing.ts` — preserve; do not invent parallel fields.

---

## 5. Media events & generation

Emitted by adapter: `MEDIA_LOADING`, `MEDIA_READY`, `MEDIA_TIME_UPDATE`, `MEDIA_ENDED`, `MEDIA_ERROR`.

Controller rejects stale events when `generation !== state.generation`.

**Gaps:**

- Error code is almost always generic `"MEDIA_ERROR"`.
- VIDEO/AUDIO `onError` also schedules `MEDIA_ENDED` after 2s when natural — can mask ERROR UX / double-advance risk if status already ERROR (controller ignores ENDED unless PLAYING — OK).
- `ensureMediaPlayback` swallows play() rejection after muted fallback; **no MEDIA_ERROR** if even muted play fails.
- IMAGE/GIF: no load error path.

---

## 6. Controls matrix (as implemented vs RP-05 target)

`resolveControlAvailability` (`control-availability.ts`):

| Control | VIDEO | AUDIO | IMAGE | GIF | EXPERIENCE |
|---------|-------|-------|-------|-----|------------|
| Play/Pause | YES | YES | YES | (as IMAGE if typed IMAGE) | YES (generic) |
| Seek | YES | YES | **YES (wrong)** | same | NO (not VIDEO/AUDIO/IMAGE… wait IMAGE yes) |
| Volume/Mute | YES | YES | NO | NO | NO |
| Fullscreen | YES | YES | YES | YES | YES |
| Next/Prev/Stop/Restart | YES | YES | YES | YES | YES |

**RP-05 required:** IMAGE/GIF → **no seek**; EXPERIENCE → runtime-supported only (no fake seek/volume).

Seek is currently visible for IMAGE (presentation progress) — **misaligned** with §25 (IMAGE: no Seek).

---

## 7. Error / Retry UX

- Controls chrome: small alert + Retry → `dispatch({ type: "PLAY" })` (controller path) — OK.
- **Missing:** viewport-level professional “Media unavailable” overlay (no stack/URL/token).
- No dedicated `RETRY` action — PLAY from ERROR is the recovery path (`PLAYBACK_TRANSITIONS.ERROR` includes LOADING via play()).

---

## 8. Audio UX gaps

- No static waveform / artwork placeholder / album-artist metadata layout.
- Progress relies on chrome seek bar when AUDIO + duration known.
- Payload metadata (`artist`, `album`) not surfaced.

---

## 9. Visual / fitMode

- `mediaStyle.objectFit` hard-coded `"contain"`.
- `EnginePlaybackItem.fitMode` exists but **unused** in adapter.

---

## 10. Cleanup

- Object URLs: revoked on Slide unmount when `blob:` — OK.
- PresentationTimer stopped on status≠PLAYING and unmount — OK.
- Error timeout cleared on unmount — OK.
- Media listeners are React synthetic — remount via `key=…:g{generation}` — OK.

---

## 11. Experience boundary

- Tokens stay in device fetch headers; not passed into iframe — OK.
- Fail-closed SafeFallback — OK.
- RP-05 must **not** weaken sandbox/CSP/admission.
- Gap: Experience failures do not set PlaybackState ERROR (slide-local only). Acceptable if documented; optional MEDIA_ERROR bridge is out of scope unless needed for controls consistency.

---

## 12. Lab

`/player/lab` — IMAGE ×2 + TEXT only. Missing VIDEO, AUDIO, GIF fixtures for RP-05 QA.

---

## 13. Security (current)

- Renderer uses device Bearer only for `/api/device/media/…` fetch (existing).
- Must not expose token/URL/tenant in error UI.
- Experience sandbox unchanged.

---

## 14. Findings (pre-impl)

| Sev | ID | Finding |
|-----|-----|---------|
| HIGH | A-01 | `type:"GIF"` does not use IMAGE renderer (TEXT fallback) |
| HIGH | A-02 | IMAGE seek enabled — conflicts with RP-05 control matrix |
| MEDIUM | A-03 | IMAGE/GIF have no load `onError` → MEDIA_ERROR |
| MEDIUM | A-04 | Audio visual is not a professional presentation surface |
| MEDIUM | A-05 | Error UX only in chrome strip; no viewport overlay |
| MEDIUM | A-06 | Play() total failure does not emit MEDIA_ERROR |
| LOW | A-07 | Error codes not specialized (LOAD/PLAY/DECODE/UNSUPPORTED) |
| LOW | A-08 | `fitMode` unused |
| LOW | A-09 | Lab lacks VIDEO/AUDIO/GIF fixtures |
| INFO | A-10 | GIF not in `CONTENT_TYPES` — treat as IMAGE path / mime without schema change |
| INFO | A-11 | `ensureMediaPlayback` muted fallback is existing Smart-TV policy — keep; only escalate when muted play also fails |

---

## 15. Implementation plan (post-audit)

1. Treat IMAGE+GIF (+ image/gif mime) as one still-media path with PresentationTimer + img onError.
2. Fix control availability matrix (no seek IMAGE/GIF; no seek/volume EXPERIENCE).
3. Professional AudioVisual surface (static waveform CSS, metadata, progress from state).
4. Viewport MediaUnavailable overlay + Retry via PLAY.
5. Specialized MEDIA_* error codes; play() rejection → MEDIA_PLAY_ERROR when unrecoverable.
6. Expand lab fixtures; add `test:runtime-playback-05` (≥50 MEDIA-* tests).
7. Docs + ADR + evidence; run full release gate.

**Non-goals respected:** no new PlaybackController / state domain / timer / fullscreen / cursor / production deploy.
