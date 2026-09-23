# Operator unblock — Android TV Box + HDMI (mandatory for DoD)

This goal **cannot complete** without physical evidence. Emulator / SOFTWARE PASS / **Smart TV Sraf browser** do **not** substitute.

## Not DoD (lab only)

| Setup | Status |
|-------|--------|
| Smart TV **Sraf Open Browser** on LAN | Use **`/tv.html`** (v0.1.2 static pairing). Offline/SW **KNOWN LIMITATION**. **≠** HDMI Box certification |
| Android TV AVD emulator | SOFTWARE proxy only |

## Prerequisites (lab already ready)

| Item | Status |
|------|--------|
| Server LAN | Discover PC IPv4 (`ipconfig`) then `http://<IP>:3000` — lab often `192.168.100.6` |
| DEV Admin | `admin@vitrine360.local` / `Admin123!` (PC only) |
| Fixture video | `fixtures/hw-sample.mp4` (avc1 960×540) |
| Scripts | `npm run hardware:status` · `hardware:prep` · `hardware:evidence` |
| Docs | [smart-tv-quickstart.md](./smart-tv-quickstart.md) · [android-tv-checklist.md](./android-tv-checklist.md) · [android-tv.md](./android-tv.md) |
| USB ADB (2026-09-18) | Physical serial `RZGYC0CLGKE` seen as **unauthorized** — accept USB debugging dialog on the device, then `adb devices` must show `device` |

### Start lab server (PC)

```powershell
cd "E:\PROJECTOS IA\UNILICUNGO\PROJECTOS FCT2026\Vitrine360"
$env:HOSTNAME='0.0.0.0'; $env:PORT='3000'
npm run start
# optional HTTPS for SW offline reboot:
# npx cloudflared tunnel --url http://127.0.0.1:3000
```

Confirm: `npm run hardware:status` → `reachable: true`.

## 15-minute path (Box → HDMI)

1. **Box → HDMI → Smart TV**; same Wi‑Fi as the PC.
2. Install **Fully Kiosk Browser** on the Box (or Chrome if Fully unavailable).
3. **HTTPS (obrigatório para offline reboot — secure context):**
   - **Produção Vercel (recomendado, estável):** no Box abrir `https://vitrine360-psi.vercel.app/player`. Não depende do PC nem de tunnel; pairing fica registado na base de produção (Admin: `https://vitrine360-psi.vercel.app/admin/login`).
   - **Tunnel de lab (alternativa):** no PC correr cloudflared; no Box abrir `https://<tunnel>/player`. Hostname muda a cada restart — ver [smart-tv-quickstart.md](./smart-tv-quickstart.md).
   - **LAN online-only:** `http://192.168.100.6:3000/player` (offline reboot será **KNOWN LIMITATION** sem HTTPS).
4. Note **6-digit activation code** → Admin Devices pair, or:

   ```powershell
   $env:BASE_URL='https://vitrine360-psi.vercel.app'
   $env:ACTIVATION_CODE='######'
   npm run hardware:prep
   ```

   O script agora usa produção por omissão e inclui o vídeo `fixtures/hw-sample.mp4` (TEXT + IMAGE + VIDEO).
5. Confirm TEXT + IMAGE + VIDEO on the TV.
6. **Offline reboot (mandatory):** disconnect network → reboot box → Player resumes from local cache.
7. Drop screenshots into `docs/evidence/hw-pending/` (`hw-pairing.png`, `hw-play.png`, `hw-offline.png`, `hw-reboot-offline.png`, `hw-admin-heartbeat.png`).
8. Fill [evidence/hw-pending/RESULTS-TEMPLATE.md](./evidence/hw-pending/RESULTS-TEMPLATE.md).
9. Run `npm run hardware:evidence` (must exit 0) → update checklist HARDWARE columns + [HARDWARE-VALIDATION-REPORT.md](./HARDWARE-VALIDATION-REPORT.md).

## Fully Kiosk — settings to record

Configure and screenshot Settings for the hardware report:

| Setting | Target value |
|---------|----------------|
| Start URL / Homepage | `https://<host>/player` (or LAN URL) |
| Start on boot | **ON** |
| Kiosk mode / lock task | **ON** |
| Fullscreen | **ON** (hide status/nav bars) |
| Keep screen on | **ON** |
| Restart after crash | **ON** |
| Disable other apps / home | as available on device |
| Exit gesture | admin-only PIN |

If auto-start is impossible on the box model, mark kiosk row **KNOWN LIMITATION** and note the workaround.

## Smart TV Sraf (not DoD)

```text
http://<PC-IP>:3000/tv.html
```

Online pairing only. Do **not** put Sraf screenshots in `hw-pending/`.

**Same-origin rule:** pair the Box on the URL you will keep using (prefer the HTTPS tunnel). Switching between tunnel and LAN creates a different browser origin → no heartbeat for the paired device.

## What stays NOT TESTED until Box evidence

All HARDWARE rows in ACCEPTANCE / checklist: install, HDMI, pairing on box, playlist on box, offline, offline reboot, network recovery, heartbeat, kiosk/auto-start, long offline, 1080p on real TV.

**Do not auto-start next phase.**
