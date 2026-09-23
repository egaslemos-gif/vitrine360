# CLOCK — Hisense / VIDAA Physical Validation

Date: 2026-09-23  
Phase: CONTENT-TEMPLATES-01 — CLOCK RUNTIME PARITY HARDENING

## Status

**PHYSICAL VALIDATION — NOT AVAILABLE**

No powered Hisense/VIDAA device with operator observation was available in this session.  
No device PASS is claimed by inference from desktop Chromium or source contracts.

## Device (intended DUT — not observed this session)

| Field | Value |
|-------|--------|
| Device | Hisense Smart TV (prior sessions: VIDAA / Sraf) |
| Browser | Built-in Sraf / VIDAA browser |
| Software | Not observed this session |
| Player shell | Target: `tv.js` `0.1.22-smarttv-static` / `tv.html?v=050` |

## Tests planned (not executed physically)

1. Digital Clock  
2. Analog Clock  
3. CLOCK → VIDEO  
4. VIDEO → CLOCK  
5. CLOCK → IMAGE  
6. Reload  
7. Offline  
8. Playlist transition  

| Test | Result |
|------|--------|
| Digital Clock | NOT RUN |
| Analog Clock | NOT RUN |
| CLOCK → VIDEO | NOT RUN |
| VIDEO → CLOCK | NOT RUN |
| CLOCK → IMAGE | NOT RUN |
| Reload | NOT RUN |
| Offline | NOT RUN |
| Playlist transition | NOT RUN |

## Known limitations

- Physical observation required before claiming Hisense/VIDAA CLOCK PASS.
- Firmware / APK / browser configuration must not be altered for validation.
- Software gate (React + tv.js contracts + CLOCK-LEGACY-001…016) is documented separately under `docs/evidence/content-templates-01/`.

## Operator finish (when device is available)

1. Open production `/tv.html` on the Hisense Sraf browser.  
2. Confirm player version string includes `0.1.22`.  
3. Play a playlist with digital + analog CLOCK, VIDEO, and IMAGE slides.  
4. Record model, browser UA, firmware, and PASS/FAIL per row above into this file.
