# UI/UX-01 — Design System & Interface Standardization

**Status:** Visual refinement complete — **PENDING REGRESSION** (not VALIDATED)  
**Date:** 2026-09-23  
**Scope:** Admin chrome + shared UI primitives. No LIVE-MEDIA-01. No business-logic / DB / API / Player runtime behaviour changes.

## Goals

Professional, lightweight, clear, consistent, operational admin UI:

- Single source of truth for colour, type, spacing, badges, headers, cards
- Progressive disclosure on Devices (list ≠ detail)
- Sidebar grouped by OVERVIEW / MANAGEMENT / SYSTEM
- Consistent StatusBadge / TypeBadge across modules
- Stable Playlist `PreviewViewport`
- Operational titles in Inter; Fraunces reserved for brand mark

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

Typography utilities: `.ui-page-title`, `.ui-section-title`, `.ui-card-title`, `.ui-body`, `.ui-secondary`, `.ui-caption`, `.ui-sidebar-section`, `.ui-content-canvas`, `.ui-meta-grid`.

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

## Evidence

- Audit: `docs/evidence/ui-ux-01/VISUAL-AUDIT-REFINEMENT.md`
- Refinement report: `docs/evidence/ui-ux-01/VISUAL-REFINEMENT-REPORT.md`
- Screenshots: `docs/evidence/ui-ux-01/BEFORE/` · `AFTER/`
- ADR: `docs/adr/ADR-UI-UX-001.md`

## Verdict policy

Do **not** declare **UI/UX-01 — VALIDATED** until visual QA + screenshots reviewed + `npm test` / typecheck / build / lint / critical regressions PASS and product owner signs off.
