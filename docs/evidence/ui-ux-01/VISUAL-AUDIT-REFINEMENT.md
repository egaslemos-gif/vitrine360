# UI/UX-01 — Visual Refinement Audit (pre-iteration)

**Date:** 2026-09-23  
**Status:** Audit only — no VALIDATED claim  
**Reference:** attached SaaS composition (principles only; Vitrine360 identity retained)

## Principles extracted (not copied)

1. Light canvas + white surfaces; soft radius; restrained colour
2. Progressive disclosure — list ≠ detail
3. One primary action per context; secondary in overflow
4. Compact stats; value-dominant; low card height
5. Operational titles in UI sans (Inter), brand display sparingly
6. More space *between* sections; less padding waste *inside* cards
7. Subtle active nav; discrete section labels

## Page findings

### /admin (Dashboard)

| ID | Sev | Issue |
|----|-----|-------|
| D1 | P1 | Page titles use Fraunces + primary green — reads as brand marketing, not ops console |
| D2 | P2 | StatCards still taller than needed (icon + padding) |
| D3 | P2 | Device list OK as rows; footer meta still slightly dense |
| D4 | P3 | Section spacing uneven vs media/devices |

### /admin/devices

| ID | Sev | Issue |
|----|-----|-------|
| V1 | P1 | Cards still act as mini Device Detail (assign form + LivePresence + dual chrome) |
| V2 | P1 | Assign playlist + “Atribuir” compete with primary “Ver detalhes” |
| V3 | P2 | Footer strip + side column layout adds height and borders |
| V4 | P2 | Status appears twice (badge + LivePresence widget) |
| V5 | P3 | Help / pair sections visually heavier than list |

### /admin/devices/[id]

| ID | Sev | Issue |
|----|-----|-------|
| DD1 | P2 | Stack of Cards without clear section grouping / tabs |
| DD2 | P3 | Breadcrumb “Devices” EN vs “Ecrãs” PT |

### /admin/media · contents · playlists · schedules · users · logs

| ID | Sev | Issue |
|----|-----|-------|
| M1 | P2 | Media cards still ring/shadow inconsistent with surface+border language |
| M2 | P2 | Contents list dense; multiple outline buttons per row |
| M3 | P3 | Schedules / members / activity headers not fully on PageHeader pattern |
| M4 | P3 | Playlist editor chrome OK; PreviewViewport contract already sound |

### Shell / Sidebar

| ID | Sev | Issue |
|----|-----|-------|
| S1 | P1 | Active nav uses white “pill + shadow” — noisy vs subtle reference active |
| S2 | P2 | Section labels too bold (700 / strong tracking) |
| S3 | P2 | Main pane glass + ring feels heavy vs light canvas |
| S4 | P3 | Collapse control competes with content edge |

### Colour / type

| ID | Sev | Issue |
|----|-----|-------|
| C1 | P1 | Primary green overused on titles |
| C2 | P2 | Mixed elevation (shadow-subtle / elevated / glass) |

### /player

| ID | Sev | Issue |
|----|-----|-------|
| — | — | Out of scope for behaviour; no visual chrome changes planned |

## Iteration plan (this pass)

1. Operational PageHeader → Inter, text-primary, short descriptions  
2. Sidebar active/section polish  
3. Devices card → L1/L2 only; assign + diagnostics to menu/detail  
4. Compact StatCards + dashboard spacing  
5. Media/content surface consistency  
6. Device detail section headers  
7. Mandatory AFTER screenshots → evidence  
8. Gates → **VISUAL REFINEMENT COMPLETE — PENDING REGRESSION** (not VALIDATED)

## Non-goals

No DB/API/auth/playback/Experience/`tv.js` changes. No LIVE-MEDIA-01.
