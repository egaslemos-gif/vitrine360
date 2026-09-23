# Android TV Box — Operational Checklist

Use the Web Player PWA at `/player` (Passive Runtime). Full install: [android-tv.md](./android-tv.md)

Legend for results: **PASS** | **FAIL** | **NOT TESTED** | **KNOWN LIMITATION**

Separate evidence:

- **SOFTWARE VERIFIED** — automated tests / browser / server in this repo environment
- **HARDWARE VERIFIED** — physical Android TV Box + HDMI + Smart TV

---

## Hardware under test (fill on site)

| Field | Value |
|-------|--------|
| Box model | _NOT TESTED — no physical box; lab: AVD `emulator-5554` + USB phone SM-A566B (software only)_ |
| Android version | API 36 (emulator); phone Android 16; TV box — |
| Browser / WebView / kiosk app | Chrome (AVD/phone); Sraf on Smart TV (lab); box kiosk — |
| App version | Player **v0.1.12-smarttv-static** / SW **v13** · Smart TV Sraf → `/tv.html` |
| TV model | — |
| HDMI resolution | target 1920×1080 16:9 landscape |
| Network | Produção HTTPS `https://vitrine360-psi.vercel.app` (caminho HDMI); LAN lab `192.168.100.6:3000` (online-only) |
| Vitrine360 host URL | **Box DoD:** `https://vitrine360-psi.vercel.app/player` · Sraf ≠ DoD: `/tv.html` |
| Test date / operator | 2026-09-21 SOFTWARE re-verified (automated suite + first-sync default playlist + production 200); hardware operator — |
| Long-offline duration actually run | — (do not claim multi-day) |
| Video under test | `fixtures/hw-sample.mp4` ~1.1MB; codec/res/duration **NOT TESTED** on HDMI site |

**Quickstart:** [smart-tv-quickstart.md](./smart-tv-quickstart.md)

---

## Hardware prep

- [ ] Android TV Box with HDMI connected to Smart TV — **NOT TESTED**
- [ ] Ethernet or stable Wi‑Fi — **NOT TESTED**
- [ ] Browser capable of PWA / kiosk — **NOT TESTED**
- [ ] Platform URL reachable — **NOT TESTED** (software: localhost Player OK)

## Kiosk configuration

- [ ] Homepage locked to `/player` — **NOT TESTED**
- [ ] Fullscreen / hide system bars — **NOT TESTED**
- [ ] Auto-start on boot — **NOT TESTED**
- [ ] Keep screen on — **NOT TESTED**
- [ ] Restart on crash — **NOT TESTED**
- [ ] Disable accidental exit — **NOT TESTED**

**KNOWN LIMITATION:** kiosk depends on third-party app/MDM; not universal across all boxes.

## Admin console support

- The Admin → Devices panel shows the current-origin Smart TV and Android TV URLs, LAN URL guidance, pairing steps, heartbeat windows, and recovery tips.
- Device cards refresh presence every 10 seconds and show `ONLINE`, `INSTÁVEL`, or `OFFLINE` together with the last heartbeat timestamp.
- The player persists a browser-scoped pairing identity. Repeated reloads or retry calls reuse the same pending device and activation code instead of creating another console record.
- If a second Player tab sees `ACTIVE_NO_TOKEN`, it stops with guidance instead of clearing storage and entering a new-code loop.
- Clearing browser storage or changing the origin (LAN, tunnel, and `127.0.0.1` are different origins) is a new identity and requires operator review before pairing again.

## First pairing (Scenario 1)

1. Open `/player` → activation code
2. Admin → Devices → pair into correct tenant
3. Player claims with pairing secret → ACTIVE
4. Assign playlist → sync + play

| Check | Software | Hardware |
|-------|----------|----------|
| Pair + claim | PASS (`test:acceptance`, `test:security`) | NOT TESTED |
| Correct tenant | PASS (`test:tenant`) | NOT TESTED |
| Playlist plays | PASS (acceptance + prior browser + first-sync default playlist) | **NOT TESTED** — no physical HDMI evidence is archived in `docs/evidence/hw-pending/` |

## Security notes (software)

- Player stores only device Bearer (+ ephemeral pairing secret during claim)
- Never put admin JWT / DB secrets / `AUTH_SECRET` on the Player
- Media downloads require device Authorization; blobs then live in IndexedDB
- Rate limits: login 20/min, bootstrap 30/min, sync 120/min, media 300/min per IP (in-memory; **KNOWN LIMITATION** not distributed)

## Offline check (Scenario 5)

1. Sync content (images, text, video)
2. Disconnect network
3. Expected: playlist continues; no white screen

| Check | Software | Hardware |
|-------|----------|----------|
| Offline continue | PASS (acceptance Scenario 5 + browser CDP) | NOT TESTED |
| Offline reload / “reboot” simulation | PASS (SW **v13** offline-boot; server kill + Chrome force-stop → `emu-cold-offline-25s.png`; `?reset=1` → `emu-fail-reset1.png`) | NOT TESTED on box |
| Images / text offline | PASS (`offline-boot · manifest=v1 · items=3`) | **NOT TESTED** — no physical HDMI evidence is archived |
| Video offline | PASS path seeded (`hw-sample.mp4`); visual decode on TV NOT TESTED | **NOT TESTED** — no physical HDMI evidence is archived; prior report was not reproducible evidence |
| Loop continuous | SOFTWARE: DisplayEngine / offline-boot loop; long soak NOT TESTED | NOT TESTED |
| Secure origin for SW | PASS with `127.0.0.1` + reverse; FAIL/`KNOWN LIMITATION` on plain `10.0.2.2` | Use HTTPS on box |

## Long offline

| Check | Software | Hardware |
|-------|----------|----------|
| Measured soak | **PASS — 5 minutes** continuous offline playback (CDP emulate offline; `emu-soak-offline-t5m.png`) | NOT TESTED |
| Multi-hour/day stability | NOT TESTED | NOT TESTED |

Do **not** claim long-term stability beyond the measured 5-minute software soak.

## Reboot offline (mandatory)

```text
Network OFF → Box reboot → Player → local manifest → playback
```

| Check | Software | Hardware |
|-------|----------|----------|
| Boot prefers local cache | PASS (PlayerApp loads IndexedDB before sync) | NOT TESTED on box |

## Network recovery / atomic update

| Check | Software | Hardware |
|-------|----------|----------|
| Keep v1 until v2 valid | PASS (`test:security` atomic helpers + acceptance) | NOT TESTED |
| Emulator network recovery (offline v1 → online RECOVERY-V2) | PASS (`emu-recovery-offline-v1.png` → `emu-recovery-online-v2b.png`) | NOT TESTED on box |
| Checksum / incomplete reject | PASS | NOT TESTED |

## Display 1920×1080

| Check | Software | Hardware |
|-------|----------|----------|
| Display 1920×1080 landscape (emulator override) | **PASS** (software) — `wm size 1920x1080`; Player pairing UI landscape (`emu-display-1920x1080.png`); no scrollbars noted |
| HDMI 1920×1080 on Smart TV | **NOT TESTED** |

## Heartbeat → Admin

| Check | Software | Hardware |
|-------|----------|----------|
| Heartbeat + presence window 90s | PASS (acceptance Scenario 7) | NOT TESTED |
| ONLINE → OFFLINE after network loss | SOFTWARE logic PASS | NOT TESTED physically |

## Auto-start / power cycle

| Check | Result |
|-------|--------|
| TV OFF→ON → box → Player | NOT TESTED |
| Box reboot → Player | NOT TESTED |

## Tenant isolation on Player

| Check | Software | Hardware |
|-------|----------|----------|
| Device A cannot read tenant B media | PASS (`test:tenant`, `test:security`) | NOT TESTED |

---

## Video material log (fill when tested)

| format | resolution | codec | size | duration | result |
|--------|------------|-------|------|----------|--------|
| mp4 (mp42) software fixture `fixtures/hw-sample.mp4` | 960×540 | avc1 (H.264) | 1 128 375 B | 5.055 s | SOFTWARE probed (`npm run` / `npx tsx scripts/probe-mp4.ts`); HDMI playback **NOT TESTED** |

See also: [android-tv.md](./android-tv.md) · [ACCEPTANCE.md](./ACCEPTANCE.md) · [smart-tv-quickstart.md](./smart-tv-quickstart.md)
