# CONTENT-TEMPLATES-01 / CLOCK RUNTIME PARITY — Regression Results

Date: 2026-09-23

## Scope

- Analog Clock live renderer in `public/tv.js` (parity with React)
- Digital Clock cadence unchanged (1s / 30s)
- Shell cache bump `tv.js?v=049` / `0.1.21-smarttv-static`
- Admin UI polish (Devices / Media / Playlist) — cosmetic only
- No Experience / Runtime Policy / Manifest / Scheduler changes

## Automated

| Suite | Result |
|-------|--------|
| `npm run test:content-templates-01` | PASS (incl. CLOCK-LEGACY-001…012) |
| `npm run test:content-3b` | PASS |
| `npm run test:preview-3f` | PASS |
| `npm run test:media-3a` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; pre-existing warnings only) |
| `npm run build` | PASS |

## CLOCK parity

| Path | Digital | Analog |
|------|---------|--------|
| Admin / ContentVisual | LIVE | LIVE |
| React Player display-engine | LIVE | LIVE |
| Legacy tv.js | LIVE | LIVE |

Hand math shared: `hour = h*30 + m*0.5`, `minute = m*6 + s*0.1`, `second = s*6`.

## Hisense

Legacy Chromium validated via source contracts + React Chromium.  
**Hisense physical Analog Clock validation: pending** — do not declare device VALIDATED without on-TV evidence.

## Verdict

**CONTENT-TEMPLATES-01 — CLOCK RUNTIME PARITY VALIDATED** (Chromium / source contracts)  
Hisense physical: pending
