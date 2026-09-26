# RUNTIME-PLAYBACK-07 — BROWSER QA

Date: 2026-09-26  
Surface: `/player/lab` (dev only) + Command Lab panel

## Checks

| Check | Result |
|-------|--------|
| Lab load with Command Lab | PASS (wired in `lab-client.tsx`) |
| LocalCommandTransport (no network) | PASS |
| PLAY / PAUSE / STOP / NEXT / PREVIOUS / RESTART | PASS (DISPATCH + lab buttons) |
| SEEK / VOLUME / MUTE / REPEAT | PASS |
| Result shows commandId, type, status, sessionId, TTL | PASS |
| No credentials in panel | PASS |
| Error QA: expired / stale / duplicate / invalid → safe reason | PASS (unit + lab result) |
| Production lab disabled | PASS (`NODE_ENV===production` gate unchanged) |
| No Admin Console command UI | PASS |

## Live checks (Chromium · localhost:3000/player/lab)

| Action | Result |
|--------|--------|
| NEXT (Command Lab) | APPLIED → advanced item (Audio visual / chrome synced) |
| PLAY | APPLIED → chrome Pause pressed |
| PAUSE | exercised |
| Session header | `session=ps_…` present |

## Console / runtime

- Command path does not call media APIs directly
- PlaybackController remains SoT for state changes
- LocalCommandTransport only (no network)

## Note

Lab wires dispatcher to `DisplayEngine` handle at send-time (no empty fallback controller). DEV-only; production lab remains disabled.
