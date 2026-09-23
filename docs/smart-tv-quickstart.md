# Smart TV / Android TV Box — Quickstart (piloto)

> A **Smart TV é só o ecrã**. O Player corre no **Android TV Box** (HDMI).  
> Checklist completa: [android-tv-checklist.md](./android-tv-checklist.md) · Guia: [android-tv.md](./android-tv.md)

## Credenciais (DEVELOPMENT ONLY)

| Campo | Valor |
|-------|--------|
| Admin | `https://vitrine360-psi.vercel.app/admin/login` (produção) ou `http://<IP-DO-PC>:3000/admin/login` (lab) |
| Email | `admin@vitrine360.local` |
| Password | `Admin123!` |
| Tenant | `demo` |
| Player (no Box) | `https://vitrine360-psi.vercel.app/player` |

**Nunca** introduza estas credenciais no Box/TV. Pairing usa só o código de 6 dígitos.

---

## 1. PC — servidor na LAN

```powershell
cd "E:\PROJECTOS IA\UNILICUNGO\PROJECTOS FCT2026\Vitrine360"
npm run db:seed
npm run build
$env:HOSTNAME='0.0.0.0'
$env:PORT='3000'
npm run start
```

Verificar lab + DoD (não marca hardware PASS):

```powershell
npm run hardware:status
npm run hardware:evidence   # exit 2 enquanto hw-pending/ sem screenshots HDMI
# ou: $env:BASE_URL='http://192.168.100.5:3000'; npm run hardware:status
```

Descubra o IP do PC (`ipconfig` → IPv4 Wi‑Fi). Neste lab é **`192.168.100.6`**.  
Firewall Windows: permitir TCP **3000** na rede privada.

Confirme no PC: `http://127.0.0.1:3000/admin/login`  
No Box (mesma Wi‑Fi): `http://<IP-DO-PC>:3000/player`  
Admin no PC: `http://<IP-DO-PC>:3000/admin/login`
---

## 2. Hardware

1. Android TV Box → HDMI → Smart TV (entrada HDMI correcta).
2. Box e PC na **mesma rede** Wi‑Fi/Ethernet.
3. No Box: Chrome ou Fully Kiosk → `https://vitrine360-psi.vercel.app/player`
4. Anote o **código de activação** (6 dígitos).

> **Browser da Smart TV (Sraf Open Browser — não Android TV):** `/player` (React/Next) pode ficar no ecrã azul «A iniciar…» porque o browser congela IndexedDB / Service Worker / hidratação.  
> **Use sempre a página estática (sem React):**
>
> `https://vitrine360-psi.vercel.app/tv.html` (produção) ou `http://192.168.100.6:3000/tv.html` (lab)  
> (equivalente: `/player-smarttv.html`)
>
> Deve aparecer o código de activação com `v0.1.12-smarttv-static`. Se ainda vir «A iniciar…» sem contador, limpe a cache do Sraf, feche o separador e abra **só** o URL acima (não o mosaico «Vitrine360 Player» da home do browser).  
> `/player` redirecciona automaticamente nestes browsers; Box HDMI continua a usar `/player` no Chrome.
## Secure context (offline / reboot)

HTTP por IP LAN (`http://192.168.100.5:3000`) **pode não** registar Service Worker no Chrome do Box.

Opções para o piloto:

| Opção | Como |
|-------|------|
| **A — Produção Vercel (HTTPS estável — recomendado)** | No Box abrir `https://vitrine360-psi.vercel.app/player` (Sraf: `.../tv.html`). Origem HTTPS fixa: Service Worker + offline reboot suportados; não depende do PC ligado nem de tunnel efémero. Pairing cria o dispositivo na base de **produção** (Admin: `https://vitrine360-psi.vercel.app/admin/login`). Validado 2026-09-21 (auth + R2 + editor playlist HTTP 200). |
| **B — HTTPS tunnel (lab)** | No PC: `npx cloudflared tunnel --url http://127.0.0.1:3000`. No Box abrir o URL `https://…trycloudflare.com/player`. Hostname muda a cada restart. |
| **C — HTTP LAN (activo agora)** | Usar `http://192.168.100.5:3000/player` (Box) ou `/tv.html` (Sraf) para pairing + playback online. Offline reboot: **KNOWN LIMITATION** até haver HTTPS. |
| **D — Lab emulator** | `adb reverse` + `http://127.0.0.1` (já validado em software). |

### Sessão activa (produção 2026-09-21 — caminho HDMI recomendado)

| Campo | URL |
|-------|-----|
| **HTTPS Android TV Box (DoD)** | `https://vitrine360-psi.vercel.app/player` |
| **HTTPS Smart TV Sraf (≠ DoD)** | `https://vitrine360-psi.vercel.app/tv.html` |
| Admin (produção) | `https://vitrine360-psi.vercel.app/admin/login` |
| Player estático | `v0.1.12-smarttv-static` (`tv.js?v=037`) |
| LAN lab (online-only) | descobrir IPv4 com `ipconfig` — neste lab `192.168.100.6:3000` |

**Não usar** o tunnel Cloudflare histórico `managers-bbs-seasonal-contacts.trycloudflare.com` — era efémero e já não é a origem de certificação.

**USB E2E (software, ≠ HDMI DoD):** `USB-E2E-V3` — pair → sync → playlist update (`E2E UPDATE V3`). Evidence `docs/evidence/usb-e2e-v3-*.png`.

---

## 3. Pairing (no PC)

**Opção A — Admin UI**

1. Login admin (credenciais acima).
2. Devices → introduzir código → nome / localização / device code (`TV-SALA-01`).
3. Esperar claim → ACTIVE → sync → playback na TV.

**Opção B — script**

```powershell
$env:BASE_URL='https://vitrine360-psi.vercel.app'
$env:ACTIVATION_CODE='######'
$env:VIDEO_FILE='./fixtures/hw-sample.mp4'
npm run hardware:prep
```

---

## 4. Testes HARDWARE obrigatórios (DoD)

Preencher resultados em [android-tv-checklist.md](./android-tv-checklist.md) e [HARDWARE-VALIDATION-REPORT.md](./HARDWARE-VALIDATION-REPORT.md):

| # | Teste | Esperado |
|---|--------|----------|
| 1 | Playback TEXT / IMAGE / VIDEO | Sem ecrã branco |
| 2 | 1920×1080 landscape HDMI | Sem scrollbars / barras inesperadas |
| 3 | Heartbeat | Device ONLINE no Admin |
| 4 | Rede OFF | Playlist continua (cache) |
| 5 | Reboot Box com rede OFF | Player retoma manifesto local |
| 6 | Rede ON + manifesto v2 | Activa só após sync válido |
| 7 | Kiosk / auto-start (se configurado) | Boot → Player sem URL manual |

Legend: **PASS** | **FAIL** | **NOT TESTED** | **KNOWN LIMITATION**

---

## 5. O que NÃO colocar no Box

- Password admin, JWT admin, `AUTH_SECRET`, credenciais DB, master keys de storage.

O Box guarda apenas o Bearer do dispositivo (após pairing).
