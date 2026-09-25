# UI/UX-02B — Player Visual Language

## Distinction

| Console | Player |
|---------|--------|
| Light soft lavender | Dark graphite |
| Information dense | Media-first / minimal |
| Purple primary actions | Lavender progress / focus on dark |

## Surfaces

- `.ui-player-surface` → `--color-player-surface`
- `.ui-player-canvas` → `--color-player` (+ optional radial primary wash)

Applied on:

- Device Control concept (`device-control-concept.tsx`)
- Device Detail live preview
- Dashboard Now Playing preview
- Landing product visualization (display + control mock)

## Controls (visual only)

Play / Pause / Previous / Next / Stop / Seek(progress) / Volume / playlist current item.

- Buttons `disabled` + “Coming soon”
- No remote command APIs
- Existing behaviour preserved (none execute)

## Progress / volume

Decorative progress (~28–40% fill with `--color-player-primary`); volume range disabled.
