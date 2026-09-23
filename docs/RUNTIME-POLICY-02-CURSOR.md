# Vitrine360 — RUNTIME-POLICY-02 Cursor Contract Hardening

**Date:** 2026-09-22  
**Status:** IMPLEMENTATION VALIDATED (software)  
**Depends on:** RUNTIME-POLICY-01  

---

## 1. Contract

| Policy | Behaviour |
|--------|-----------|
| HIDDEN | Always `cursor: none` |
| AUTO_HIDE | Initial hidden → input visible → **3000 ms** idle → hidden |
| VISIBLE | Always `cursor: auto` |

AUTO_HIDE rules:

1. Cancel previous timeout on input  
2. Show cursor  
3. Start a **single** new timeout  

No concurrent timers. Remote ≠ keyboard; `keydown` → `KEYBOARD_LIKE`.

---

## 2. Canonical target

**Chosen:** `document.documentElement` (`<html>`)

**Why not React `rootRef` / shell div:** Cursor on an inner node left chrome, pairing, and areas outside the ref uncontrolled (POLICY-01 conflict).  

**Why not `body` alone:** `<html>` is the document root; CSS/`getComputedStyle` on `html` covers the full viewport including margins; legacy and React share one paint surface. Body cursor is cleared to avoid dual owners.

---

## 3. React implementation

- Controller: `src/player/runtime/cursor-idle.ts` (`CursorIdleController`)  
- Wired once in `PlayerRuntimeShell` (`useEffect` start/dispose) — covers boot, pairing, playback, error without phase remount leaks  
- Removed duplicate logic / `rootRef` cursor / pairing `cursor: none` from `player-app.tsx`  
- No `!important` CSS cursor rules  

---

## 4. Legacy implementation

- `public/tv.js` — same AUTO_HIDE contract on `document.documentElement`  
- ES5; Pointer Events preferred; `pagehide` → detach + clear timer  
- Cache bump: `tv.js?v=043` / redirect `?v=043`  

---

## 5. Event model

| When PointerEvent exists | Else |
|--------------------------|------|
| `pointermove`, `pointerdown` | `mousemove`, `mousedown` |
| + `touchstart`, `keydown` | + `touchstart`, `keydown` |

Avoid listening to both pointer and mouse (duplicate show for one gesture).

---

## 6. Timer model

Single `timerId` / `cursorTimeout`. `resetTimer` = clear + set. `dispose` / `detachCursorIdle` clears timer and listeners.

---

## 7. Pairing behavior

**Not an exception.** Pairing follows the same AUTO_HIDE on `<html>`. Local `cursor: none` on the pairing div was removed so it cannot fight the canonical controller.

---

## 8. Passive implications

`.player-media { pointer-events: none }` **unchanged** (PASSIVE). Cursor still reacts via window listeners. INTERACTIVE may revisit media hit-testing later — out of scope.

---

## 9. Tests

| Suite | Command |
|-------|---------|
| Unit CURSOR-001…013 | `npm run test:cursor-02` |
| POLICY-01 | `npm run test:runtime-policy-01` |
| Live E2E React + Legacy | `npm run test:cursor-live` |

---

## 10. Browser E2E

Evidence: `docs/evidence/runtime-policy-02/CURSOR-E2E-RESULTS.md`  

Reads `getComputedStyle(document.documentElement).cursor` — not screenshot-only.

---

## 11. Known limitations

- Hisense physical cursor **not** claimed PASS without observation.  
- Some engines map `auto` → `default` in computed style (E2E accepts both as visible).  
- Headless Chromium validates software contract; leanback TVs without a mouse still get keyboard/touch paths.  
- Capability Probe / Fullscreen / Orientation **not** in this phase.
