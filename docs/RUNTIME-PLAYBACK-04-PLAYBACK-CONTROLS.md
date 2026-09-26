# RUNTIME-PLAYBACK-04 — Playback Controls & Interaction

**Status:** Implemented  
**Date:** 2026-09-26  
**Prerequisites:** RP-01, RP-02, RP-03 VALIDATED

---

## 1. Control architecture

```
UI / INPUT (PlaybackControls, keyboard, touch, pointer)
        ↓
   PlaybackAction
        ↓
   PlaybackController  (SoT)
        ↓
   PlaybackState
        ↓
   Renderer Adapter
```

Controls emit **intentions** only. They never call `HTMLMediaElement.play()`, `setIndex()`, or `next()` directly.

| Module | Role |
|--------|------|
| `playback-controls.tsx` | Glass control bar; dispatch + reflect state |
| `playback-chrome.tsx` | Viewport overlay, keyboard scope, auto-hide, fullscreen install |
| `use-playback-keyboard.ts` | Scoped shortcuts → actions / fullscreen |
| `control-availability.ts` | Pure enable/visible matrix from state + type |
| `format-time.ts` | Single time formatter |

`PlaybackControls` does **not** import `DisplayEngine`.

---

## 2. Control actions

Reuses RP-01 `PlaybackAction` (no second API):

| Action | UI |
|--------|-----|
| `PLAY` / `PAUSE` | Primary toggle |
| `STOP` | Stop |
| `NEXT` / `PREVIOUS` | Navigation |
| `RESTART` | Restart current |
| `SEEK` | Seek bar / keyboard |
| `SET_VOLUME` | Slider / ↑↓ |
| `SET_MUTED` | Mute / M |
| `SET_REPEAT_MODE` | Repeat cycle NONE → PLAYLIST → ITEM |

**Not implemented:** shuffle, remote APIs, `PLAY_ITEM(index)` (documented as future).

---

## 3. Control state

UI derives labels/enablement from `PlaybackState.status` only:

- `PLAYING` → Pause
- `PAUSED` / `STOPPED` → Play
- `LOADING` → incompatible actions disabled
- `ERROR` → Retry when `error.recoverable`

No parallel `isPlaying` source of truth (local `isPlaying` is a derived alias of `status === "PLAYING"`).

---

## 4. Keyboard

Scoped to player chrome focus / fullscreen descendant. Skips `input` / `textarea` / `select` / `contenteditable`.

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| ArrowLeft | Previous |
| ArrowRight | Next |
| ArrowUp / Down | Volume ±0.05 |
| Home / End | Seek 0 / duration |
| M | Mute toggle |
| F | FullscreenController request/exit |
| R | Restart |

Seek bar focused: ArrowLeft/Right, Home, End → `SEEK`.

---

## 5. Mouse / pointer

- Click buttons → actions
- Seek: click + drag; commit on pointer up
- Hover reveals tooltips (`title` / accessible name)
- Core controls do not require hover

---

## 6. Touch

- Minimum targets **44×44px**
- Tap shows controls (via chrome pointer handler + CursorIdle)
- No double-tap seek, no swipe gestures

---

## 7. Seek

- Custom track / progress / thumb (not native range appearance for seek)
- Drag **preview** uses local `previewMs` only; one `SEEK` on release
- Rejects NaN / non-finite; Controller clamps duration (RP-01)
- Unknown duration → seek disabled / `--:--`

---

## 8. Volume / mute

- UI 0–100; controller contract **0–1**
- Icons from `volume` + `muted`
- Visible for VIDEO / AUDIO only

---

## 9. Fullscreen

Uses `getFullscreenController()` / `FullscreenController` (RP-08A).  
Lab chrome installs a local controller when the shell has not.  
Never calls `document.documentElement.requestFullscreen()` from controls.

---

## 10. Auto-hide

Reuses `CursorIdleController` or Runtime State `cursorVisible`.  
Pointer / keyboard activity shows controls; idle hides. No second idle timer design.

---

## 11. Accessibility

- Every button: `aria-label` (+ `title` tooltip on desktop)
- Play/Pause / Mute: `aria-pressed` when applicable
- Seek & Volume: `aria-valuemin/max/now/valuetext`, `role="slider"` (seek)
- Visible `:focus-visible` outline (purple)

---

## 12. Responsive

| Viewport | Layout |
|----------|--------|
| Desktop | Horizontal glass bar, full utility row |
| ≤768px (`compact`) | Stop/Restart hidden from primary row; tighter padding |
| Mobile priority | Previous, Play/Pause, Next, Volume (when applicable), Fullscreen |

---

## 13. Media-specific controls

| Type | Controls |
|------|----------|
| VIDEO | play, pause, seek, volume, mute, fullscreen, nav, stop, restart, repeat |
| AUDIO | play, pause, seek, volume, mute (+ nav/stop/restart/repeat) |
| IMAGE | play, pause, seek (presentation), nav, restart, stop, repeat, fullscreen |
| GIF | same as IMAGE path |
| EXPERIENCE | play/pause/nav/repeat/fullscreen; volume/mute/seek hidden |
| TEXT / CLOCK | no seek/volume; transport + repeat + fullscreen |

---

## 14. Future remote compatibility

```
Remote Command  →  PlaybackAction  →  PlaybackController
```

No `POST /api/device/play|pause|next|…` in RP-04.

Future: `PLAY_ITEM(index)` if arbitrary playlist pick is required (mini-panel deferred).

---

## 14b. Hydration safety

**Hydration warning: RESOLVED**

Causes addressed:
1. `useSyncExternalStore` pristine IDLE seeded with `Date.now()` vs server `EMPTY` → fixed with `createInitialPlaybackState(0)` + `isPristinePlaybackSnapshot` → shared `EMPTY`.
2. SSR controls/viewport vs post-load PLAYING tree → `PlaybackChrome` defers viewport + controls until after hydrate (`controlsReady` + pending placeholders).
3. Soft-nav stale client state vs fresh RSC → lab interactive tree loaded via `dynamic(..., { ssr: false })` from a Client Component.

No `suppressHydrationWarning`. Regression: CONTROL-041.

---

## 15. Integration

- `/player/lab` — DisplayEngine + PlaybackChrome (dev)
- `/player` (player-app) — PlaybackChrome when not fragile TV
- Landing interactive demo remains isolated (no PlaybackControls import)

---

## 16. Tests

`npm run test:runtime-playback-04` — CONTROL-001…040
