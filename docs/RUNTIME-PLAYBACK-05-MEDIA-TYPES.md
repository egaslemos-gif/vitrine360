# RUNTIME-PLAYBACK-05 — Media Types & Professional Player Experience

Date: 2026-09-26  
Status: Implementation complete — see evidence VALIDATION.md for gate.

## Goal

Professional playback for VIDEO, AUDIO, IMAGE, GIF, and EXPERIENCE without new domains — Renderer Adapter + PlaybackController remain SoT.

## Capability matrix (implemented)

| Type | Play | Pause | Seek | Volume | Mute | Natural End | Presentation Timer |
|------|------|-------|------|--------|------|-------------|--------------------|
| VIDEO | YES | YES | YES | YES | YES | durationMs===0 | durationMs>0 |
| AUDIO | YES | YES | YES | YES | YES | durationMs===0 | durationMs>0 |
| IMAGE | YES | YES | NO | NO | NO | NO | YES |
| GIF | YES | YES | NO | NO | NO | NO | YES (IMAGE path) |
| EXPERIENCE | runtime | runtime | NO | NO | NO | hosted timer | EXPERIENCE_HOSTED |

Still media progress: read-only presentation bar in controls (not seek).

## Renderer ownership

| Type | Component | Element |
|------|-----------|---------|
| VIDEO | Slide | HTMLVideoElement |
| AUDIO | Slide + AudioVisual | HTMLAudioElement (hidden) |
| IMAGE / GIF | Slide still path | `<img>` |
| EXPERIENCE | ExperiencePlaybackSlide | Runtime shell / sandbox |

## Timing

- Single `PresentationTimer` in `PlaybackRendererAdapter`.
- Natural AV: native `ended` → `MEDIA_ENDED` (no concurrent timer).
- Explicit AV: loop + PresentationTimer; `onEnded` gated by `nativeEnded`.

## Errors

Codes: `MEDIA_LOAD_ERROR`, `MEDIA_PLAY_ERROR`, `MEDIA_DECODE_ERROR`, `MEDIA_UNSUPPORTED`, `MEDIA_TIMEOUT` (+ legacy `MEDIA_ERROR`).

Viewport: `MediaErrorOverlay` — user-facing copy only; Retry → `dispatch({ type: "PLAY" })`.

Play() rejection after muted fallback → `MEDIA_PLAY_ERROR`.

## Audio UX

Static waveform (CSS), artwork placeholder, title / optional artist·album from payload, elapsed/duration — no Web Audio API.

## Controls

`resolveControlAvailability` + `showPresentationProgress` — RP-04 keyboard/touch/fullscreen/cursor unchanged.

## Lab

`/player/lab` fixtures: IMAGE, GIF, AUDIO (silent WAV data URI), VIDEO (error path), TEXT. Dev-only.

## Non-goals preserved

No live/WebRTC/remote control; no new PlaybackController/state/timer/fullscreen/cursor; no production deploy.
