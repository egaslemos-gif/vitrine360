# Cursor E2E Results

**Date:** 2026-09-22T20:59:21.475Z
**Base:** http://127.0.0.1:3001
**Canonical target:** document.documentElement

## React /player
PASS — initial none → move auto → idle none → key reset → idle none

## Legacy /tv.html
PASS — equivalent contract

## Verdict
**IMPLEMENTATION VALIDATED** (software E2E; Hisense physical not required)

### Notes
- Target: `document.documentElement`
- Pairing: same AUTO_HIDE (not exception)
- Measured via `getComputedStyle(document.documentElement).cursor`
- Hisense physical cursor: not claimed
