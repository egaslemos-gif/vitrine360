# CONTENT-TEMPLATES-01 — Validation Checklist

Date: 2026-09-23 (CLOCK RUNTIME PARITY HARDENING)

## Acceptance

- [x] Template Registry
- [x] Stable IDs (9)
- [x] Categories
- [x] TEXT / CLOCK / NOTICE / EVENT / QR templates
- [x] Template Picker + chooser
- [x] PreviewViewport + ContentVisual preview
- [x] Template → Content Studio seed
- [x] Deep clone / independence
- [x] No new Content Types
- [x] No EXPERIENCE templates
- [x] Design System reused
- [x] CLOCK Digital React LIVE
- [x] CLOCK Digital Legacy LIVE
- [x] CLOCK Analog React LIVE
- [x] CLOCK Analog Legacy LIVE (`tv.js` DOM+CSS hands)
- [x] Timer cleanup / no duplicate timers (CLOCK-LEGACY-010…013, 016)
- [x] Cardinal angles 12/3/6/9 + hour fraction (CLOCK-LEGACY-005…009)
- [x] Offline / timezone contracts (CLOCK-LEGACY-014…015)
- [x] Docs + ADR
- [x] `test:content-templates-01` + CLOCK-LEGACY-001…016
- [x] Full gate: `npm test` / typecheck / lint / build — see REGRESSION-RESULTS.md
- [ ] Hisense physical — **PHYSICAL VALIDATION — NOT AVAILABLE** (do not claim device PASS)

## Manual UI (optional operator)

- [ ] Novo → Começar do zero
- [ ] Novo → Usar template → filtrar categoria → Usar → editor com defaults
- [ ] CLOCK digital ticks seconds in preview
- [ ] CLOCK analog hands move in admin preview + React player
- [ ] Legacy `/tv.html` digital + analog on Chromium
