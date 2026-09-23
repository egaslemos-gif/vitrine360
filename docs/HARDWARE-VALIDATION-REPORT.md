# Hardware validation report — Passive Runtime / Android TV

Date: 2026-09-21 (refresh)  
Environment: Cursor agent (Windows). Physical Android TV Box **not attached**. Prior SOFTWARE evidence includes phone AVD + Android TV AVD (`TV-AVD-287355`).

Status legend: **PASS** | **FAIL** | **NOT TESTED** | **KNOWN LIMITATION**

---

## 1. Hardware utilizado

| Item | Value |
|------|--------|
| Physical Android TV Box + HDMI + Smart TV | **NOT TESTED** |
| Emulator | `emulator-5554` (phone) + `emulator-5556` / AVD `Vitrine360_AndroidTV` (`sdk_google_atv64_x86_64`, 1920×1080) — **proxy for TV runtime**, not HDMI certification |
| Browser | Chrome on emulator + host CDP |
| Resolution target | 1920×1080 16:9 landscape (HDMI) — **NOT TESTED** on TV |
| Network | Lab LAN: `http://192.168.100.6:3000` when local server is UP; HDMI path: production HTTPS |

### Lab readiness for physical HDMI (operator)

| Check | Status |
|-------|--------|
| Server reachable on LAN Player/Admin | **PASS** (HTTP 200 on `192.168.100.5:3000`) |
| Firewall inbound Node/3000 | Present (`Node.js`, `NestJS Backend 3000`) |
| Operator quickstart | [smart-tv-quickstart.md](./smart-tv-quickstart.md) |
| Evidence template | [evidence/hw-pending/RESULTS-TEMPLATE.md](./evidence/hw-pending/RESULTS-TEMPLATE.md) |
| HTTPS for SW on LAN Box | **PASS** (produção) — `https://vitrine360-psi.vercel.app` (estável). Tunnel cloudflared histórico **não** usar. |
| Video fixture metadata | **PASS** (software) — mp4/avc1/960×540/5.055s / 1.1MB via `scripts/probe-mp4.ts` |
| Android TV Box + HDMI attached | **NOT TESTED** — awaiting operator |
| Evidence drop folder | `docs/evidence/hw-pending/` |
| Evidence gate | `npm run hardware:evidence` (exit 2 until HDMI screenshots present) |

---

## 2. Procedimento de instalação

Documented in [android-tv.md](./android-tv.md) (includes **secure context** + `adb reverse` for lab).

```bash
adb reverse tcp:3006 tcp:3006
# On device/emulator Chrome: http://127.0.0.1:3006/player — note activation code
ACTIVATION_CODE=###### BASE_URL=http://127.0.0.1:3006 VIDEO_FILE=./fixtures/hw-sample.mp4 npm run hardware:prep
```

Then execute [android-tv-checklist.md](./android-tv-checklist.md) HARDWARE rows on the physical box.

---

## 3–4. Testes executados e resultados

### SOFTWARE VERIFIED

| Test | Result | Evidence |
|------|--------|----------|
| Automated suite / typecheck / lint / build | **PASS** | `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` — re-verified 2026-09-21 |
| Local E2E checklist (E2E-008–025) | **PASS** | `npm run test:e2e-checklist` — re-verified 2026-09-21 |
| Passive Runtime + rate limits | **PASS** | ADR-006, `test:runtime` |
| Pair + playlist TEXT+IMAGE+VIDEO seed | **PASS** | `hardware:prep` — latest software re-verify `TV-AVD-287355` + `emu-tv-avd-play-v012.png` |
| Physical HDMI image playback | **NOT TESTED** | No physical HDMI media is archived in `docs/evidence/hw-pending/` |
| Physical HDMI offline text playback | **NOT TESTED** | No physical HDMI media is archived in `docs/evidence/hw-pending/` |
| Physical HDMI offline video playback | **NOT TESTED** | No physical HDMI media is archived in `docs/evidence/hw-pending/`; prior report is not sufficient evidence |
| Android TV AVD offline cold (remove reverse → force-stop → reopen) | **PASS** (software) | `emu-tv-avd-offline-cold.png` offline-boot v1 items=3 |
| Offline boot page (IDB) online | **PASS** | `emu-localhost-offline-html.png` — `offline-boot · manifest=v1 · items=3` |
| Host CDP offline reload | **PASS** | SW serves offline title; no permanent white screen |
| Emulator offline reload (server up, CDP offline) | **PASS** | CDP text HW Test Banner; SW caches shell-v6 |
| Emulator **cold start** (server killed + Chrome force-stop → `/player`) | **PASS** | CDP + `emu-cold-offline-25s.png` — `offline-boot · manifest=v1 · items=3` |
| Secure context requirement | **PASS** (diagnosed) | `10.0.2.2` SW fail; `127.0.0.1` + reverse **PASS** |
| Representative video matrix on TV | **NOT TESTED** | fixture seeded + probed (`fixtures/hw-sample.mp4` avc1 960×540 5.055s via `scripts/probe-mp4.ts`); HDMI decode **NOT TESTED** |
| HDMI / kiosk / auto-start / box reboot | **NOT TESTED** | no physical box |

### Video fixture (software seed + probe)

| Field | Value |
|-------|--------|
| file | `fixtures/hw-sample.mp4` |
| format | mp4 (mp42) |
| codec | avc1 (H.264) |
| resolution | 960×540 |
| duration | 5.055 s |
| size | 1 128 375 bytes |
| sha256 | `0cd83d944a6ca7822b4a8306cecc60a36e859b041f6702c6a1ad9ead78924451` |
| HDMI playback | **NOT TESTED** |

### Earlier FAIL → fix

| Issue | Fix |
|-------|-----|
| Offline cold navigate white (Next hydration) | SW v6 prefers `/v360-offline.html` + `v360-offline-boot.js` (IDB) |
| Emulator `10.0.2.2` no SW | Document secure context; use `adb reverse` + `127.0.0.1` |
| Brief white before SW wakes after Chrome kill | **KNOWN LIMITATION** — wait for SW; evidence at ~15–25 s shows recovery (not permanent white) |
| Precache `addAll` all-or-nothing | SW install precaches paths individually |

---

## 5. Problemas encontrados

- No Android TV Box attached (blocks DoD hardware rows).
- `http://10.0.2.2` is not a secure context → SW offline cold start fails on emulator unless reversed to localhost.
- After Chrome `force-stop`, first paint can be blank until SW intercepts (seconds).
- Rate limiter still in-memory only.
- Drive stub unchanged.
- Phone AVD ≠ Android TV image / HDMI.

## 6. Problemas corrigidos / entregues

- Passive Runtime + device `display_type` / `interaction_mode`
- Rate limits on login / bootstrap / sync / media
- ADR-006 / ADR-007
- Install docs + secure-context guidance + `hardware:prep`
- Player kiosk CSS + force-static player page
- SW **v13** offline boot + network-first `/_next`; Smart TV static `/tv.html` (v0.1.12)
- **2026-09-16→18 Smart TV Sraf:** React `/player` can hang on «A iniciar…». Mitigation: **`/tv.html`**. Evidence: `lab-smart-tv-browser/`. AVD pair+play: `TV-AVD-287355`. **≠** Box+HDMI DoD.
## 7. Limitações

| Item | Status |
|------|--------|
| Physical HDMI appliance validation | **NOT TESTED** |
| Kiosk depends on third-party browser/MDM | **KNOWN LIMITATION** |
| LAN HTTP without HTTPS may block SW | **KNOWN LIMITATION** |
| Brief blank until SW ready after process kill | **KNOWN LIMITATION** |
| Rate limit not distributed | **KNOWN LIMITATION** |
| Drive stub | **KNOWN LIMITATION** |
| Long offline soak (hours/days) | **NOT TESTED** |
| Large/representative video on real TV | **NOT TESTED** |

## 8. Evidências

Automated SOFTWARE gates (2026-09-21 17:45): `npm test`, `test:e2e-checklist`, `typecheck`, `probe:mp4` PASS.  
Cited historical emulator PNGs (`emu-cold-offline-25s.png`, `emu-soak-offline-t5m.png`, `usb-e2e-v3-*.png`, etc.) are **not present in the working tree** as of this recheck — do not treat those filenames as currently archived files. SOFTWARE PASS for pairing/offline/recovery therefore rests on the automated suite + acceptance Scenario 1 (first-sync default playlist), not on missing screenshots.

HDMI: `docs/evidence/hw-pending/` still has **0** media files. Checklist + ACCEPTANCE HARDWARE columns remain **NOT TESTED**.

## 9. Estado do Passive Player

**Software-ready** for Passive Runtime with offline cold boot via SW + IndexedDB when origin is a secure context.  
**Not hardware-certified** for Android TV Box / HDMI / kiosk auto-start.

## 10. Riscos restantes

- Field kiosk misconfiguration / non-secure HTTP origins
- Video decode on low-end boxes
- First install must register SW online once before offline reboot
- Multi-instance rate-limit bypass
- Emulator results do not substitute HDMI validation

## 11. Current readiness recheck (2026-09-21 17:45)

| Check | Result |
|------|--------|
| `adb devices -l` | **SM-A566B `RZGYC0CLGKE` attached** — `ro.build.characteristics=phone`, 1080×2340. **≠ Android TV Box** |
| Produção HTTPS | **200** — `/player`, `/tv.html`, `/admin/login`, `tv.js?v=037` (`v0.1.12-smarttv-static`) |
| LAN IPv4 | `192.168.100.6` (lab) |
| `docs/evidence/hw-pending/` | **0** media files; RESULTS-TEMPLATE unfilled (PASS/FAIL rows empty) |
| `npm run hardware:evidence` | expected **EXIT 2 — NOT TESTED** until HDMI screenshots exist |

## 12. Recomendações (não iniciar automaticamente)

1. Attach box → HDMI → run checklist HARDWARE rows  
2. Use HTTPS (or documented secure origin) on the box  
3. `npm run hardware:prep` with a real 1080p H.264 `VIDEO_FILE`; record codec/resolution/duration  
4. Offline reboot on the box (mandatory DoD)  
5. Distributed rate limit before public exposure  

---

## 13. Definition of Done (honest)

| DoD item | Status |
|----------|--------|
| Typecheck / automated tests | **PASS** (`npm test`, E2E checklist, typecheck 0, 2026-09-21). `hardware:evidence` exit 2 — hw-pending empty |
| Tenant isolation | **PASS** |
| Security / rate-limit / acceptance | **PASS** |
| Emulator offline cold boot | **PASS** |
| HTTPS tunnel pairing/playback (software) | **PASS** — USB phone E2E `USB-E2E-V2` (pair → play → playlist update); evidence `usb-e2e-v2-*.png` |
| Emulator 1920×1080 landscape display | **PASS** (software — `emu-display-1920x1080.png`) |
| Emulator offline soak (measured) | **PASS — 5 minutes** (`emu-soak-offline-t5m.png`); hours/days **NOT TESTED** |
| Emulator network recovery v1→v2 | **PASS** (`emu-recovery-offline-v1.png` → `emu-recovery-online-v2b.png` RECOVERY-V2) |
| Smart TV built-in browser (Sraf) | **KNOWN LIMITATION** — use `/tv.html` (v0.1.12 static); offline SW/IDB unsupported. **≠** Box+HDMI DoD |
| USB phone (SM-A566B) lab path | **PASS (software proxy)** — not a substitute for Box→HDMI |
| Physical HDMI Android TV Box suite | **NOT TESTED** — no box evidence in `docs/evidence/hw-pending/` |


**Goal remains open until physical HDMI hardware evidence is recorded.**  
Latest audit: [DOD-AUDIT-2026-09-16.md](./DOD-AUDIT-2026-09-16.md) (refresh 2026-09-18 ~20:42)

### BLOCKED ON OPERATOR (cannot auto-complete)

No **Android TV Box** attached for HDMI certification (`adb`: AVD + Samsung phone only). Phone / emulator / Sraf cannot substitute.

| Ready now | Still required from operator |
|-----------|------------------------------|
| Produção HTTPS `https://vitrine360-psi.vercel.app/player` | **Android TV Box** → HDMI → Smart TV |
| SOFTWARE matrix + first-sync default playlist | Pairing + playback screenshots from **Box** |
| USB E2E sync fixes (phone ≠ Box) | Offline reboot on box (**mandatory**) |
| Sync hardening (R2 auth, partial sync, IDB timeout) | Fill HARDWARE columns PASS/FAIL/… |

Operator path: [smart-tv-quickstart.md](./smart-tv-quickstart.md) → fill [evidence/hw-pending/RESULTS-TEMPLATE.md](./evidence/hw-pending/RESULTS-TEMPLATE.md).  
**One-pager unblock:** [OPERATOR-HDMI-UNBLOCK.md](./OPERATOR-HDMI-UNBLOCK.md) · gate: `npm run hardware:evidence`

Full SOFTWARE vs HARDWARE matrix: [ACCEPTANCE.md](./ACCEPTANCE.md).

**Do not auto-start next phase.**
