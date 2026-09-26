# ARCHITECTURE-AUDIT — RUNTIME-PLAYBACK-01

## Surfaces audited (read-only)

| Component | Path | Role |
|-----------|------|------|
| DisplayEngine | `src/player/playback/display-engine.tsx` | React playlist renderer + timers + natural video end |
| ExperiencePlaybackController | `src/player/runtime/experience-controller.ts` | Experience host only (not playlist) |
| RuntimeState | `src/player/runtime/state.ts` | Policy/sync/fullscreen/orientation diagnostics |
| Sync engine | `src/player/sync/engine.ts` | Manifest fetch / offline |
| Legacy player | `public/tv.js` | Standalone Hisense-compatible loop |
| Landing demo | UI/UX-02D Interactive Player | Isolated mock |

## CURRENT PLAYBACK FLOW

```
Device sync → Manifest items
  → DisplayEngine useState(index)
  → render VIDEO|IMAGE|AUDIO|EXPERIENCE
  → setTimeout(duration) OR video.onEnded (natural durationMs===0)
  → index = (index+1) % length
```

No typed PlaybackState. Pause/seek/volume not centralized. No generation token for stale events.

## TARGET PLAYBACK FLOW

```
Manifest → PlaybackController → PlaybackState snapshots
  → Renderer Adapter (events + generation)
  → Media element / slide / Experience shell
```

Remote commands (future) enter above the controller only.

## Gaps closed by RP-01

- Explicit PlaybackState / Status / Action / RepeatMode / Error
- Transition table + stale generation
- Unit-tested navigation / seek / volume

## Deferred to RP-02

- Wire DisplayEngine to PlaybackController
- Extract timers fully out of React components
- Optional tv.js snapshot adapter
