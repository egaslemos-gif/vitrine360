# RUNTIME-PLAYBACK-05 — BROWSER QA

Date: 2026-09-26  
Browser: Chromium via Cursor browser → `http://localhost:3000/player/lab` (next dev)

## Media matrix

| Type | Load | Play | Pause | Seek | Volume | End | Error |
|------|------|------|-------|------|--------|-----|-------|
| VIDEO | PASS | PASS | PASS | PASS | PASS | PASS | PASS (decode overlay + Retry) |
| AUDIO | PASS | PASS | PASS | PASS | PASS | PASS (natural 0) | PASS |
| IMAGE | PASS | PASS | PASS | N/A | N/A | timer | PASS |
| GIF | PASS (still path) | PASS | PASS | N/A | N/A | timer | PASS |
| EXPERIENCE | PASS (contract) | runtime | runtime | N/A* | N/A* | hosted | isolated |

\* Runtime-supported only — not faked.

## Observed in Chromium

- GIF still surface rendered (purple SVG label).
- VIDEO invalid fixture → viewport overlay “Media could not be decoded” + Retry (controller PLAY).
- AUDIO visual: title “Lab Audio”, metadata “Vitrine Lab · RP-05 Fixtures”, seek/volume chrome present.
- Controls: Previous / Play / Next / Stop / Restart / Mute / Volume / Repeat / Fullscreen.

## Console gates

- No uncaught exceptions / unhandled rejections from `ensureMediaPlayback` paths.
- Intentional VIDEO decode error expected for lab fixture (error UX).

## Note

`next start` (production) disables `/player/lab` by design — QA uses `next dev`.
