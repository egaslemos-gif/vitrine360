# LIST-VIEW

## Purpose

Operational density — **true rows**, not reused grid cards.

## Target height

64–84px (`.ui-list-row` min-height ~68px).

## Primitive

- `ListView` — white shell (`role="table"`)
- `ListRow` — compact row (`role="row"`, `aria-selected` when selected)

## Media List columns

Thumb · Name · Type · Size · Updated · Usage · Actions

## Devices List columns

Checkbox · Identity · Status · Type/Location · Playlist · Last seen · Actions

## Selection

- Selected row: `--color-row-selected` (soft lavender)
- Checkbox accent: primary purple
- No strong purple row fill

## Mobile

Two-line compact rows (primary + secondary meta). Not giant cards.
