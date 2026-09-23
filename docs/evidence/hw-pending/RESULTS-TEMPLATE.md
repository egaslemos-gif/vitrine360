# Hardware evidence results — fill on site

Date: _______________  
Operator: _______________  
Box model / Android: _______________  
Browser / kiosk app: _______________  
TV / HDMI resolution: _______________  
Player URL used (Box): `https://vitrine360-psi.vercel.app/player` (produção HTTPS — recomendado)  
Smart TV Sraf only (not DoD): `https://vitrine360-psi.vercel.app/tv.html`  
LAN lab fallback (online-only): `http://<PC-IPv4>:3000/player` — discover with `ipconfig` (this lab is often `192.168.100.6`)  
Kiosk app (if used): Fully Kiosk / other — version: _______________

Legend: **PASS** | **FAIL** | **NOT TESTED** | **KNOWN LIMITATION**

| DoD item | Result | Evidence file | Notes |
|----------|--------|---------------|-------|
| Android TV Box installed | | hw-pairing.png | |
| HDMI validated | | | |
| Player starts | | | |
| Device pairing works | | | |
| Playlist plays | | | |
| Images work | | | |
| Video works (format/codec/res/size/duration) | | | |
| Offline playback | | hw-offline.png | |
| Offline reboot | | hw-reboot-offline.png | **mandatory** |
| Network recovery / atomic v2 | | | |
| Heartbeat → Admin ONLINE | | hw-admin-heartbeat.png | |
| Device status correct | | | |
| Tenant isolation (spot check) | | | |
| Kiosk / auto-start | | | or KNOWN LIMITATION |
| Long offline duration (record minutes) | | | do not claim days without evidence |

After filling: copy values into `docs/android-tv-checklist.md` and `docs/HARDWARE-VALIDATION-REPORT.md`.

**Secure context note:** plain `http://192.168.x.x` may block Service Worker. Prefer production HTTPS (`https://vitrine360-psi.vercel.app/player`) for offline reboot tests — see `docs/smart-tv-quickstart.md`.
