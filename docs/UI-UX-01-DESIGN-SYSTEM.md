# UI/UX-01 — Design System & Interface Standardization

**Status:** Implementation complete — pending regression gate  
**Date:** 2026-09-23  
**Scope:** Admin chrome + shared UI primitives. No LIVE-MEDIA-01. No business-logic / DB / API / Player runtime behaviour changes.

## Goals

Professional, lightweight, clear, consistent, operational admin UI:

- Single source of truth for colour, type, spacing, badges, headers, cards
- Lower visual density on Dashboard and Devices
- Sidebar grouped by OVERVIEW / MANAGEMENT / SYSTEM
- Consistent StatusBadge / TypeBadge across modules
- Stable Playlist `PreviewViewport`

## Tokens (`src/app/globals.css`)

| Token | Role |
|-------|------|
| `--color-background` | Page wash |
| `--color-surface` / `--color-surface-muted` | Cards / muted panels |
| `--color-border` | Borders |
| `--color-text-primary` / `secondary` / `muted` | Text hierarchy |
| `--color-primary` / `--color-primary-hover` | Brand accent (emerald) — not blanket green |
| `--color-success` / `warning` / `danger` / `info` | Semantic status |
| `--color-preview-bg` | Preview viewport fill |
| `--spacing-*` | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 |

Typography utilities: `.ui-page-title`, `.ui-section-title`, `.ui-card-title`, `.ui-body`, `.ui-secondary`, `.ui-caption`, `.ui-sidebar-section`.

Fonts unchanged: Inter (body) + Fraunces (display / brand).

## Components (SSoT)

| Component | Path |
|-----------|------|
| PageHeader | `src/components/ui/page-header.tsx` |
| SectionHeader | `src/components/ui/section-header.tsx` |
| StatCard | `src/components/ui/stat-card.tsx` |
| StatusBadge | `src/components/ui/status-badge.tsx` |
| TypeBadge | `src/components/ui/type-badge.tsx` |
| PreviewViewport | `src/components/ui/preview-viewport.tsx` |
| FilterBar / EmptyState / Card / Button / IconButton | existing + `icon-button.tsx` |
| Admin nav | `src/components/admin-nav.ts` (`navGroupedForRole`) |

## Sidebar

Sections: Overview → Dashboard; Management → Ecrãs, Grupos, Conteúdos, Media, Playlists, Agendamentos; System → Membros, Actividade, Workspace, Definições.

Routes unchanged (`/admin/users`, `/admin/logs`, etc.). Collapse + tooltip titles preserved.

## Page patterns

**Dashboard:** PageHeader + light StatCards + device rows (name, location, last contact, manifest, StatusBadge).

**Devices:** Identity → Status → metadata → compact playlist assign → primary “Ver detalhes”; overflow via `DeviceActions` “…”.

**Media / Contents:** TypeBadge on all kinds (GIF no longer exclusive).

**Templates:** TypeBadge + “Template” chip so templates ≠ existing contents.

**Player / tv.js:** Untouched behaviour (cursor idle, fullscreen, orientation, playback).

## Tests

`npm run test:ui-ux-01` → UI-UX-001 … UI-UX-012.

## Limitations

- Full dark mode not implemented; tokens prepared for extension.
- Visual screenshots are optional evidence under `docs/evidence/ui-ux-01/`.
- Some feature pages still mix residual local styles; adoption is progressive without logic changes.
- Hisense Analog CLOCK physical validation remains out of scope for this phase.

## Related

- Audit: `docs/evidence/ui-ux-01/AUDIT.md`
- ADR: `docs/adr/ADR-UI-UX-001.md`
- Prior notes: `docs/UI-UX-DESIGN-SYSTEM.md`
