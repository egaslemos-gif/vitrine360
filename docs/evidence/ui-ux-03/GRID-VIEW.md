# GRID-VIEW

## Purpose

Visual discovery — thumbnail-first cards.

## Primitive

`GridView` in `src/components/ui/data-view.tsx`

- Media: 1 → 2 → 3 → 4 columns
- Devices: 1 → 2 → 3 columns (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)

## Media Grid

- 16:9 preview (`PreviewViewport`)
- Type badge overlay
- Title + size + date + usage
- Compact footer actions

## Devices Grid

- Identity + StatusBadge
- Type · location
- Meta grid (last seen, manifest)
- Playlist + “Ver detalhes”

## View switcher

`ViewSwitcher` — purple active (`aria-pressed`).
