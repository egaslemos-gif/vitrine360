# CONTENT-TEMPLATES-01 / CLOCK RUNTIME PARITY — Regression Results

Date: 2026-09-23

## Scope

- Analog Clock live renderer in `public/tv.js` (parity with React)
- Digital Clock in-place `textContent` updates (no full `setHtml` per tick)
- Shell cache bump `tv.js?v=050` / `0.1.22-smarttv-static`
- CLOCK-LEGACY-001…016 contracts
- No Experience / Runtime Policy / Manifest / Scheduler / Billing / Platform Identity implementation

## Automated gate

| Suite | Result |
|-------|--------|
| `npm run test:content-templates-01` | **PASS** (CLOCK-LEGACY-001…016) |
| `npm test` | **PASS** (domain → EXPERIENCE-10 + content-templates-01 + ui-ux-01) |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (0 errors; pre-existing warnings only) |
| `npm run build` | **PASS** |

Relevant regressions included: RUNTIME-POLICY-01…08B, RUNTIME-EXPERIENCE-01…10, content-3b, preview-3f, gif-3c, transition-3e, UI/UX-01.

## CLOCK parity

| Behaviour | React | tv.js |
|-----------|-------|-------|
| Digital | PASS | PASS |
| Analog | PASS | PASS |
| Seconds | PASS | PASS |
| Hour fraction | PASS | PASS |
| Timezone | PASS | PASS |
| Offline | PASS | PASS |
| Transition | PASS | PASS |
| Cleanup | PASS | PASS |

Hand math shared: `hour = h*30 + m*0.5`, `minute = m*6 + s*0.1`, `second = s*6`.  
Cardinals: 12→0°, 3→90°, 6→180°, 9→270°. Example 10:30 → hour 315°.

## Player regression (contracts / suites)

IMAGE, VIDEO, GIF, TEXT, NOTICE, EVENT, QR_CODE, EXPERIENCE reference — covered by content/preview/gif/experience suites; Experience Runtime unchanged.

## Hisense / VIDAA

**PHYSICAL VALIDATION — NOT AVAILABLE**

See `docs/evidence/content-templates-01-clock/CLOCK-HISENSE-VALIDATION.md`.  
Do not declare device PASS by inference.

## Verdict

**CONTENT-TEMPLATES-01 — CLOCK RUNTIME PARITY — VALIDATED**

(software / Chromium / source contracts). Physical device: NOT AVAILABLE.
