# ADR-UI-UX-001 — Admin Design System SSoT

**Status:** Accepted  
**Phase:** UI/UX-01  
**Date:** 2026-09-23  
**Related:** `docs/UI-UX-01-DESIGN-SYSTEM.md`, `docs/evidence/ui-ux-01/AUDIT.md`

---

## Context

Admin UI worked functionally but showed inconsistent badges, dense device cards, flat sidebar, and mixed typography/colour usage. LIVE-MEDIA-01 must not start until the console feels professional and operationally clear.

## Decision

1. Keep **CSS variables in `globals.css`** as the colour/type/spacing SSoT; avoid scattered hex for status/surface.
2. Treat **brand emerald as primary/accent only** — success/warning/danger/info remain distinct.
3. Standardise presence via **StatusBadge** and media/content kinds via **TypeBadge** (including CLOCK/TEXT/NOTICE/EVENT/QR_CODE/EXPERIENCE).
4. Group sidebar into **OVERVIEW / MANAGEMENT / SYSTEM** without changing routes.
5. Prefer **border + surface** cards over heavy shadows; reduce StatCard and Device card density.
6. Keep **PreviewViewport** aspect-locked; playlist preview must not resize with content.
7. **Do not** change DB, APIs, auth, RBAC, playback, sync, Experience Runtime, or `tv.js` behaviour in this phase.
8. Defer full dark mode; keep token aliases ready.

## Consequences

- Feature pages gradually consume shared primitives.
- UI-UX-001…012 static tests guard token/component contracts.
- Visual QA + `npm test` / typecheck / build / lint remain the validation gate.
