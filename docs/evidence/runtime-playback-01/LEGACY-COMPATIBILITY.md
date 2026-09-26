# LEGACY-COMPATIBILITY — RUNTIME-PLAYBACK-01

## public/tv.js

**Not modified** in RP-01.

Continues to own:

- Pairing / manifest fetch (legacy path)
- Offline playback
- Hisense-oriented media loop
- Natural video duration (`durationMs === 0`)

## Integration stance

PlaybackController is **not** wired into tv.js yet. Future adapter may:

1. Mirror playlist index / status into PlaybackState snapshots for diagnostics, or
2. Gradually replace the clock with controller dispatches

Until then: dual-runtime coexistence — React Player can adopt controller in RP-02; legacy remains functional.

## Hisense

PHYSICAL VALIDATION: NOT PERFORMED  
No APK / firmware / browser hacks.
