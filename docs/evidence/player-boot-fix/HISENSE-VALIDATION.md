# HISENSE-VALIDATION — Player Boot Fix

**Status:** Automated + production URL validated. Physical Hisense confirmation **pending operator**.

## Production publish (2026-09-24)

- Deployment: `dpl_HmT4ocwd1saKGLk1S845BuMUSw6o` **READY**
- Alias: https://vitrine360-psi.vercel.app
- `/tv.js?v=051` → `0.1.23-smarttv-static`
- Trailing `setInterval` call comma: **absent** on production payload

## Checklist (operator on TV)

| Test | Expected | Result |
|------|----------|--------|
| A — Power on | Player starts, no SyntaxError | _pending physical_ |
| B — Power off → on | No new pairing if already paired | _pending physical_ |
| C — Online | Sync + playback | _pending physical_ |
| D — Offline reboot | No forced pairing solely due to network | _pending physical_ |
| E — `/player?reset=1` | Identity cleared; pairing requested | _pending physical_ |

## Notes for TV

1. Open once: `https://vitrine360-psi.vercel.app/tv.html?v=051` (force shell)
2. Or clear browser cache / SW if still seeing L1199
3. Confirm footer version `0.1.23` when visible
