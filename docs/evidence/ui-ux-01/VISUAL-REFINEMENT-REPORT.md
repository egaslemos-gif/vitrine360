# UI/UX-01 — Visual Refinement Report

**Date:** 2026-09-23  
**Status:** **UI/UX-01 — VALIDATED**  
**Commits evaluated:**
- `d5d9648` — visual refinement (progressive disclosure, lighter shell)
- `0421931` — QA fix: restore `max-w-*` containers broken by spacing theme collision

## Environment

| Campo | Valor |
|-------|--------|
| Production URL | https://vitrine360-psi.vercel.app |
| Deployment | `dpl_5NhztLaQ9N3gMRZhb99Qa5rwatP7` (READY) |
| Deployed SHA | `042193165021770a7bc6acea34dcf864a893f1b5` |
| Alias | `vitrine360-psi.vercel.app` |
| Workspace | Demo Organization (seed admin) |
| Disk (E:) after cleanup | ~0.97 GB free (ENOSPC cleared enough for AFTER capture) |

## QA-critical correction (0421931)

During AFTER visual QA on production (`d5d9648`), PageHeader descriptions collapsed to **32px** width.

**Root cause:** named `@theme` tokens `--spacing-sm/md/xl/2xl` collided with Tailwind v4 `max-w-*` (which falls back to spacing). Measured: `max-w-xl` → 32px, `max-w-md` → 16px, `max-w-sm` → 8px.

**Fix (admin chrome only):**
- Remove colliding named spacing tokens; keep numeric `--spacing-3/5/10`
- Add `--container-sm` … `--container-7xl`
- PageHeader title column: `min-w-0 flex-1`
- Regression assertions in `scripts/test-ui-ux-01.ts`

**Post-fix measure (production):** `max-w-xl` = **576px**; devices subtitle height = 18px (single line).

No DB / API / Auth / RBAC / Playback / Manifest / Sync / Runtime Policy / Experience / Templates / Player / `tv.js` / LIVE-MEDIA changes.

## Screenshots

| Set | Path |
|-----|------|
| BEFORE | `docs/evidence/ui-ux-01/BEFORE/` (unchanged) |
| AFTER | `docs/evidence/ui-ux-01/AFTER/` |

### AFTER coverage (production, commit 0421931)

| Route | 1280×720 | 1440×900 | 1920×1080 | Notes |
|-------|----------|----------|-----------|--------|
| `/admin` | ✓ | ✓ | ✓ | + tablet 768×1024, mobile 390×844 |
| `/admin/devices` | cards ✓ | ✓ (+ cards) | ✓ | L1/L2 + StatusBadge + `…` menu |
| `/admin/contents` | ✓ | ✓ | ✓ | TypeBadge + StatusBadge |
| `/admin/media` | ✓ | ✓ | ✓ | TypeBadge on GIF / IMAGE / VIDEO |
| `/admin/playlists` | ✓ | ✓ | ✓ | list + editor PreviewViewport |

## Visual QA

| Check | Result |
|-------|--------|
| Hierarchy / typography / spacing / density | PASS |
| Sidebar active (subtle primary) | PASS |
| PageHeader SSoT (readable description) | PASS (after 0421931) |
| StatCards compact; no green flood | PASS |
| Devices: not compressed detail; L1/L2 clear; diagnosis not forced; secondary in `…`; status recognizable | PASS |
| Media: TypeBadge on types; GIF not privileged | PASS |
| Playlist PreviewViewport aspect stable (16:9, 397×223 before/after slide) | PASS |
| Responsive tablet / mobile | PASS |

## Automated gates (fresh run this session)

| Gate | Result |
|------|--------|
| `npm run test:ui-ux-01` | PASS |
| `npm test` (includes RUNTIME-POLICY, RUNTIME-EXPERIENCE-01…10, CONTENT-TEMPLATES-01) | PASS (exit 0) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS (exit 0) |
| `npm run lint` | PASS (0 errors; existing warnings in `public/tv.js` etc.) |

Logs: `docs/evidence/ui-ux-01/npm-test-gate.log`, `npm-build-gate.log`.

## Player regression

| Surface | Result |
|---------|--------|
| Diff `d5d9648..0421931` vs `public/tv.js`, `src/player`, `/player` | **no files changed** |
| `/player` loads | PASS — activation wait (`v 0.1.2-smarttv`) |
| `/tv.html` loads | PASS — activation UI (`v0.1.21-smarttv-static`) |
| Business behaviour of playback / idle / fullscreen / orientation / policy / Experience / CLOCK / natural video duration | **not modified** by UI/UX-01 commits |

## Limitations (non-blocking)

- Devices pairing form + Smart TV help still dominate above-the-fold (P2 polish).
- E: disk remains tight (~1 GB); AFTER capture succeeded after cache cleanup.
- Full interactive playback proof on physical TV was out of scope for this admin visual gate; player surfaces smoke-loaded only.

## Decision gate

| Criterion | |
|-----------|--|
| AFTER screenshots available | PASS |
| Visual QA | PASS |
| UI-UX tests | PASS |
| `npm test` | PASS |
| typecheck / build / lint | PASS |
| Critical regressions (policy / experience / templates) | PASS |
| Player regression | PASS |
| No business behaviour change | PASS |

### **UI/UX-01 — VALIDATED**

Do **not** auto-start RUNTIME-EXPERIENCE-11 or LIVE-MEDIA-01. Next sequence is a human decision.
