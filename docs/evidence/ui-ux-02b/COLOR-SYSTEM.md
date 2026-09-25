# UI/UX-02B — Color System

**Source of truth:** `src/app/globals.css`

## Light console

| Semantic | Hex | CSS token |
|----------|-----|-----------|
| Background | `#F7F7FB` | `--color-background` |
| Surface | `#FFFFFF` | `--color-surface` / `--color-card` |
| Primary | `#6D4AFF` | `--color-primary` |
| Primary soft | `#EEE9FF` | `--color-primary-soft` |
| Primary dark / hover | `#4F35C8` | `--color-primary-hover` |
| Text | `#18181B` | `--color-foreground` |
| Muted | `#71717A` | `--color-muted-foreground` |
| Border | `#E7E5EA` | `--color-border` |
| Success | `#16A34A` | `--color-success` |
| Warning | `#F59E0B` | `--color-warning` |
| Danger | `#EF4444` | `--color-destructive` / `--color-danger` |
| Info | `#3B82F6` | `--color-info` |

## Player

| Semantic | Hex | Token |
|----------|-----|-------|
| Background | `#111318` | `--color-player` |
| Surface | `#1B1E26` | `--color-player-surface` |
| Text | `#F4F4F5` | `--color-player-text` |
| Muted | `#A1A1AA` | `--color-player-muted` |
| Primary | `#8B6FF7` | `--color-player-primary` |

Utilities: `.ui-player-surface`, `.ui-player-canvas`.

## Media accents

| Kind | Approx | Token |
|------|--------|-------|
| VIDEO | indigo | `--color-type-video` |
| AUDIO | amber | `--color-type-audio` |
| IMAGE | blue | `--color-type-image` |
| GIF | pink | `--color-type-gif` |
| EXPERIENCE | violet | `--color-type-experience` |
| NOTICE | orange | `--color-type-notice` |
| EVENT | cyan | `--color-type-event` |
| CLOCK | teal | `--color-type-clock` |

Usage: TypeBadge, media card top accent, small icons — not full-page rainbow.

## Dark mode (`html.dark`)

Graphite backgrounds (`#12131A` / `#1B1E26`), purple primary `#8B6FF7`, success `#22C55E`, readable muted `#A1A1AA`. Not a naive invert.
