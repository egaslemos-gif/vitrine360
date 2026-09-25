# UI/UX-02C — Player Design

## Surfaces

- Canvas: `--color-player` (`#111318`)
- Surface: `--color-player-surface` (`#181B23`)
- Overlay / glass: `--color-player-overlay`, `--color-player-glass`
- Primary accent: `--color-player-primary` (`#8B6FF7`)

## Control bar

Component: `src/components/ui/player-glass-controls.tsx`

- Floating capsule over media
- Circular icon buttons (44px+ touch targets)
- Primary Play highlighted
- All disabled + “Coming soon” labels
- No remote command execution

## Timeline

`.ui-player-timeline` + fill + white thumb. Decorative progress only (no seek API).

## Device Control

`device-control-concept.tsx` — light console card hosting dark preview with embedded glass bar + playlist.
