# ADR-RUNTIME-PLAYBACK-005 — Media Types via Renderer Adapter

## Status

Accepted — 2026-09-26

## Context

RP-01…04 established PlaybackController as SoT and PlaybackControls as the action UI. Media types still needed consistent renderers, error UX, audio presentation, and a control matrix that matches real capabilities (especially IMAGE/GIF vs VIDEO/AUDIO).

## Decision

1. Keep a single `PlaybackRendererAdapter` as the only media DOM owner; emit `MEDIA_*` with generation gating.
2. Treat GIF as still media (same `<img>` + PresentationTimer path as IMAGE); do not use `HTMLVideoElement` for GIF.
3. Seek/volume/mute only for VIDEO/AUDIO; IMAGE/GIF expose read-only presentation progress; EXPERIENCE does not fake AV controls.
4. Professional AUDIO uses a static visual surface (`AudioVisual`) — no Web Audio API.
5. Errors use specialized codes + viewport overlay; Retry recovers via `PLAY` on the controller (no parallel retry API).
6. `ensureMediaPlayback` may fall back to muted autoplay (existing Smart-TV policy); unrecoverable rejection emits `MEDIA_PLAY_ERROR`.

## Consequences

- Control availability stays derived from `PlaybackState`, not element state.
- Duration semantics (media vs presentation) remain in RP-03 timing helpers.
- Experience sandbox/admission boundaries are unchanged.
