# UI/UX-01 — Pre-implementation Audit

Date: 2026-09-23  
Scope: Admin + Player chrome only. No LIVE-MEDIA-01. No business-logic changes.

## Verdict of current state

The app already has a partial design system (`globals.css` tokens, `PageHeader`, `StatCard`, `StatusBadge`, `TypeBadge`, `FilterBar`, `EmptyState`, `PreviewViewport`, `ModalShell`). Gaps are **consistency of adoption** and **visual density**, not missing foundations.

## Findings

| Area | Issue |
|------|--------|
| Tokens | Semantic colours exist; aliases `surface` / `text-*` incomplete; spacing scale missing 12/20/40/48 |
| Typography | PageHeader uses display font; Dashboard/Users still hand-roll headers |
| TypeBadge | CLOCK/TEXT/NOTICE/EVENT/QR_CODE collapse to OTHER — only media kinds differentiated |
| StatusBadge | Exists and maps ONLINE/AWAY/OFFLINE; Dashboard still uses raw `Badge` |
| Sidebar | Flat list; no OVERVIEW / MANAGEMENT / SYSTEM grouping; PT/EN mix |
| Dashboard | Local `Stat` instead of `StatCard`; dense device rows; mixed Badge |
| Devices | Cards overloaded (assign playlist + observability + dual actions) |
| Preview | `PreviewViewport` is aspect-stable; playlist chrome OK |
| Hardcoded | Some `bg-white`, `bg-blue-50`, `#070b14` remain in features |
| Form collapse | Fixed earlier (`block` fields + definite flex card widths) |

## Implementation plan (this phase)

1. Extend tokens + typography utility classes  
2. Expand TypeBadge for content types  
3. Sidebar section groups (routes unchanged)  
4. Dashboard → PageHeader + StatCard + StatusBadge  
5. Devices → lighter card hierarchy (actions secondary)  
6. Docs + `test:ui-ux-01` + regressions  

## Out of scope

DB, APIs, auth, RBAC, playback, sync, Experience Runtime, `tv.js` behaviour, LIVE-MEDIA-01.
