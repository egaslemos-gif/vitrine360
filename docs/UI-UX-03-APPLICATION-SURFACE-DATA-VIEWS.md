# UI/UX-03 — Application Surface & Data Views

**Status:** VALIDATED  
**Date:** 2026-09-25  
**Scope:** Authenticated application visual language only (no domain/API/DB changes).

## Objective

Fix two visual failures:

1. **List View** reused large vertical Grid cards.
2. **Surface hierarchy** was too flat (background ≈ workspace ≈ cards).

Result: professional SaaS console with clear depth, compact operational lists, and rich visual grids.

## Surface architecture

| Level | Role | Token | Value |
|-------|------|-------|-------|
| L0 | App background | `--color-app-bg` / `--color-background` | `#F4F1FA` |
| L1 | Workspace | `--color-workspace` | `#F9F8FC` |
| L1b | Sidebar | `--color-sidebar` | `#F1EEFA` |
| L2 | Card / surface | `--color-surface` | `#FFFFFF` |
| L3 | Elevated | `--color-surface-elevated` + `--shadow-elevated` | white + stronger shadow |
| L4 | Glass / floating | `.glass-control` / `.glass-overlay` | translucent + blur |

## Grid vs List

| Mode | Purpose | Primitive |
|------|---------|-----------|
| **Grid** | Visual discovery | `GridView` + media/device cards |
| **List** | Operational density | `ListView` + `ListRow` (64–84px) |

List **must not** reuse Grid cards.

## Components

| File | Role |
|------|------|
| `src/components/ui/data-view.tsx` | `ListView`, `ListRow`, `GridView` |
| `src/components/ui/view-switcher.tsx` | Grid/List toggle (`aria-pressed`) |
| `src/components/ui/filter-bar.tsx` | White toolbar surface |
| `src/app/globals.css` | Surface tokens + `.ui-list-*` / `.ui-workspace` / `.ui-sidebar-panel` |

## Applied pages

- Media — grid cards + compact list rows
- Devices — grid cards + compact list rows
- Contents — compact list rows + FilterBar
- Playlists — compact list rows + FilterBar
- Admin shell — app-bg / sidebar / workspace separation

## Security / production

No DB, schema, API, RBAC, entitlements, R2, or Production deploy.

## Evidence

`docs/evidence/ui-ux-03/`
