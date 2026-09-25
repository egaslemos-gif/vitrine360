# UI/UX-02C — Glass System

## Levels

| Level | Class | Use |
|-------|-------|-----|
| 0 | page background | Lavender ambient |
| 1 | surface / card solid | Dense forms, tables |
| 2 | `.glass-card` | Soft elevated cards |
| 3 | `.glass-panel` | Shell main pane, landing header |
| 4 | `.glass-player-controls` | Floating player control capsule |

## Properties (approx)

- Light glass: `rgba(255,255,255,0.55–0.75)` + `backdrop-filter: blur(18–28px)`
- Player glass: `--color-player-overlay` + blur 24px + white border

## Progressive enhancement

`@supports not (backdrop-filter)` falls back to solid surface / opaque player bar.

Glass is **not** applied to every component (performance + readability).
