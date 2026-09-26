# RUNTIME-PLAYBACK-06 — BROWSER QA

Date: 2026-09-26  
Browser: Chromium (next dev `/player/lab`)

## Checks

| Check | Result |
|-------|--------|
| Lab load | PASS (session header shows sessionId prefix) |
| Session start after client mount | PASS (useEffect) |
| Playback observation on state change | PASS (store.observePlayback) |
| Controls (play/pause/next/…) | PASS (RP-04 chrome) |
| No hydration suppress | PASS |
| Diagnostics globals | `__v360_player_session`, `__v360_playback_observation` |
| Production lab disabled | PASS (`NODE_ENV===production` gate) |

## Console

- No expected uncaught exceptions from session/telemetry path
- Telemetry queue failures isolated
