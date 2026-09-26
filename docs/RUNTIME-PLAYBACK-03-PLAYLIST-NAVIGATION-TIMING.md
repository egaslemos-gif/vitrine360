# RUNTIME-PLAYBACK-03 — Playlist Navigation & Timing

**Status:** Implemented  
**Date:** 2026-09-26  
**Prerequisites:** RP-01, RP-02 VALIDATED

---

## 1. Playlist semantics

PlaybackController is the sole authority for NEXT / PREVIOUS / RESTART / STOP / ENDED / repeat.

Renderer emits `MEDIA_ENDED` only. Never calls `next()`.

## 2. Effective duration

Manifest resolves `durationOverrideMs ?? content.durationMs` into `PlaybackItem.durationMs` (`src/services/manifest.ts`).

At runtime:

`effectiveDurationMs(item) === resolveItemDurationMs(item)`

- `> 0` → presentation duration  
- `0` on VIDEO/AUDIO → natural (state `durationMs = null` until metadata)  
- other types with `0` → fallback 8000ms

## 3–4. Natural vs presentation

| Mode | Authority |
|------|-----------|
| Natural VIDEO/AUDIO | Native `ended` |
| Explicit VIDEO/AUDIO | `PresentationTimer` (media may `loop`) |
| IMAGE / GIF-as-IMAGE / TEXT / CLOCK | `PresentationTimer` |
| EXPERIENCE | `EXPERIENCE_HOSTED` — timer ends slide; Runtime has no end signal |

**Limitation:** one field (`durationMs`) serves both media length (after metadata) and presentation window. Documented; no broad domain refactor.

## 5–9. Media types

See `classifyTiming()` in `src/domain/playback-timing.ts`.

## 10. EXPERIENCE

No end signal from Experience Runtime in current Player. Slide ends via presentation duration. Admission/sandbox/bridge unchanged.

## 11–16. Navigation & repeat

- NEXT / PREVIOUS / RESTART / STOP / PAUSE — RP-01 semantics  
- PREVIOUS threshold: `PREVIOUS_RESTART_THRESHOLD_MS` (3000)  
- NONE / PLAYLIST / ITEM as specified  
- Empty → IDLE (transition PLAYING→IDLE allowed for empty sync)

## 17. Timer architecture

**Single owner:** `PresentationTimer` (domain) driven by Renderer Adapter when status=PLAYING.

- Elapsed = `now - startedAt` (no interval drift accumulation)  
- Bound to `generation`  
- PAUSE: stop schedule; preserve `positionMs`  
- PLAY: resume from `positionMs`  
- STOP / NEXT / ERROR / unmount: stop  

DisplayEngine has **no** timers.

## 18. Generation

Increments on item select / restart / empty sync. Not on timeupdate.

## 19. Stale events

`MEDIA_ENDED` ignored unless `generation` matches **and** `status === PLAYING` (fixes STOP/ENDED race).

## 20. Manifest soft remap

1. Same `playlistItemId` → index remap, preserve generation  
2. Else same `contentId` → select (LOADING)  
3. Else clamp index (current removed → not forced to A)  
4. Empty → IDLE  

## 21. Browser limitations

Background tab timer throttling may delay IMAGE progression; recovery is deterministic on resume. No visibility auto-pause introduced. Autoreplay / muted autoplay policy unchanged (`ensureMediaPlayback`).
