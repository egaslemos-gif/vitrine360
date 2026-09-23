# CONTENT-TEMPLATES-01 — CLOCK Production Deployment

Date: 2026-09-23  
Gate: CONTENT-TEMPLATES-01-DEPLOY

## Deployment

| Field | Value |
|-------|--------|
| Deployment ID | `dpl_tE31zygh1tnC3FDY3D7HDS7212g6` |
| Status | READY |
| Alias | https://vitrine360-psi.vercel.app |
| Commit | `422da6ffeb269b571b08b863f41fc356db91bca6` |
| Message | `feat(player): publish clock runtime parity` |
| Method | API redeploy (`withLatestCommit`) — git auto-deploy was Hobby **BLOCKED** |

## Effective runtime version

| Resource | Value |
|----------|--------|
| `tv.js` VERSION | **0.1.22-smarttv-static** |
| Cache bust | `tv.js?v=050` |
| Shell | `tv.html` label `v0.1.22-smarttv-static` |
| Service worker | `v360-tv-shell-v050` |

Verified by HTTP fetch of production `/tv.js?v=050` and `/tv.html`, plus Chromium open of `/tv.html` showing `v0.1.22-smarttv-static · Smart TV`.

## Smoke tests

| Test | Result | Notes |
|------|--------|--------|
| Homepage / login | PASS | `/` redirects to login; `/admin/login` 200 |
| Legacy `/tv.html` loads | PASS | Pairing UI + version string |
| Artifact 0.1.22 | PASS | `scripts/probe-production-clock.ts` |
| Digital Clock | PASS | Chromium probe: time advanced 21:15:21 → 21:15:22 |
| Analog Clock | PASS | face + hour/minute/second hands present |
| Seconds | PASS | digital tick + second hand |
| Hour fraction | PASS | live hour deg matched `h*30+m*0.5` (277.5°) |
| Timezone | PASS | device-local `Date` (unchanged architecture) |
| CLOCK → IMAGE → CLOCK | PASS | Chromium DOM transition probe |
| CLOCK → VIDEO / VIDEO → CLOCK | PASS | source contract on served `tv.js` (`clearClockTimer` in `advanceSlide` / `renderClock`); no live playlist VIDEO slide in this session |
| CLOCK → CLOCK cleanup | PASS | clear-then-rearm contract + probe |
| Cleanup | PASS | `clearClockTimer` present in production artifact |

## Physical Hisense / VIDAA

**PHYSICAL VALIDATION — NOT AVAILABLE**

See `CLOCK-HISENSE-VALIDATION.md`. Chromium ≠ Hisense.

## Known limitations

- Git-triggered production deploy remained BLOCKED (Hobby); publication used API redeploy of latest commit.
- Live playlist CLOCK↔VIDEO observation on a paired production device was not available this session; transitions asserted via served source contracts + Chromium DOM probes.
- Unrelated local working-tree changes (Experience / Platform Identity / UI docs) were **not** included in commit `422da6f`.

## Verdict

**PRODUCTION CLOCK PARITY — VALIDATED**
