# UI/UX-02 — Design System Audit

**Date:** 2026-09-25

## Existing (UI/UX-01)

- Tokens in `src/app/globals.css` (`@theme inline`)
- Components: PageHeader, SectionHeader, StatCard, StatusBadge, TypeBadge, EmptyState, Card, Button, FilterBar, PreviewViewport
- Fonts: Inter + Fraunces
- Admin shell: desktop sidebar + mobile nav

## Changes this phase

| Area | Action |
|------|--------|
| Tokens | Added `html.dark` semantic overrides; `.ui-display` / `.ui-mono` |
| Nav IA | OVERVIEW / CONTENT / DEVICES / PLAYBACK / SYSTEM |
| Brand copy | Digital Display & Presentation |
| Duplication | No new parallel token system |

## Preserved

Emerald primary, spacing numeric scale, container scale, ui-* typography utilities, StatusBadge/TypeBadge semantics.
