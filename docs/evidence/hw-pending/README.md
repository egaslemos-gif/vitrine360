# HDMI evidence drop folder

Put **Android TV Box → HDMI → Smart TV** screenshots/videos here.  
Emulator / Sraf Smart TV browser photos belong in `docs/evidence/` or `lab-smart-tv-browser/` — **not** here.

## Required media (png/jpg/webp/mp4)

| File | What to capture |
|------|-----------------|
| `hw-pairing.png` | Box Player showing activation code **or** Admin after pair |
| `hw-play.png` | Playlist playing on the TV (TEXT/IMAGE visible) |
| `hw-video.png` | Video item playing (optional but preferred) |
| `hw-offline.png` | Playback continues with network OFF |
| `hw-reboot-offline.png` | **Mandatory** — after reboot with network still OFF, Player resumes |
| `hw-admin-heartbeat.png` | Admin Devices showing this box ONLINE |

## Fill results

1. Edit [RESULTS-TEMPLATE.md](./RESULTS-TEMPLATE.md) — set Result column to `PASS` / `FAIL` / `KNOWN LIMITATION` (not empty).
2. Offline reboot row must be PASS or KNOWN LIMITATION.
3. Run: `npm run hardware:evidence` (must exit 0).
4. Copy into `docs/android-tv-checklist.md` HARDWARE columns + `docs/HARDWARE-VALIDATION-REPORT.md`.

## Preferred Player URL on the Box

- **Produção HTTPS (DoD / offline reboot):** `https://vitrine360-psi.vercel.app/player`
- LAN lab (online-only): `http://<PC-IPv4>:3000/player` — discover with `ipconfig` (this lab is often `192.168.100.6`)

## Not accepted as DoD

- Phone / TV AVD emulator screenshots alone  
- Built-in Smart TV browser (Sraf) alone  
- SOFTWARE-only PASS without files in this folder
