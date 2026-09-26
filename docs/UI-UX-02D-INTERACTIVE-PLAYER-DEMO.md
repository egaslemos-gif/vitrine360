# UI/UX-02D — Interactive Player Demo

**Status:** VALIDATED  
**Date:** 2026-09-25  
**Scope:** Local Landing Page InteractivePlayerDemo only.

## Objective

Replace the static hero mockup with a functional, isolated product demo of the Vitrine360 Player — soft glass application chrome inspired by modern media product UIs.

## Architecture

| Piece | Location |
|-------|----------|
| Demo data | `src/components/landing/demo-playlist.ts` |
| Player UI + state | `src/components/landing/interactive-player-demo.tsx` |
| Assets | `public/demo/media/*.svg` (local, lightweight) |
| Landing integration | `src/features/marketing/landing-page.tsx` |
| Shell token | `.ui-demo-app-shell` in `src/app/globals.css` |

## State model (local)

```
status: PLAYING | PAUSED | STOPPED
currentIndex, positionMs, durationMs, volume, muted
```

Starts **PAUSED** (no autoplay audio).

## Controls

Play / Pause / Resume / Stop / Next / Previous / Restart / Seek / Mute / Volume / Fullscreen  
Playlist selection (thumbnails + progress) · auto-advance · loop

## Security boundary

**Does NOT** call Device / Manifest / Playback APIs, mutate DB/R2, or send remote commands.  
**Does NOT** deploy Production in this phase.

**Is NOT** RUNTIME-PLAYBACK-01 / PlaybackSession / Command Bus.

## Evidence

`docs/evidence/ui-ux-02d/`
