# Acceptance evidence — Vitrine360

Date: 2026-09-21  
Phase: Android TV Hardware Validation + Runtime Hardening

## SOFTWARE VERIFIED

| Gate | Command / evidence | Result |
|------|-------------------|--------|
| Domain | `npm run test:domain` | PASS (re-verified 2026-09-21) |
| Tenant isolation | `npm run test:tenant` | PASS (re-verified 2026-09-21) |
| Security audit | `npm run test:security` | PASS (re-verified 2026-09-21) |
| Rate limit + Passive Runtime | `npm run test:runtime` | PASS (re-verified 2026-09-21) |
| Scenarios 1–7 (pair, content, playlist, offline keep, delta, heartbeat) | `npm run test:acceptance` | PASS (re-verified 2026-09-21; Scenario 1 now asserts first sync at `version=-1` delivers default playlist) |
| Typecheck | `npm run typecheck` | PASS (re-verified 2026-09-21) |
| Lint | `npm run lint` | PASS (0 errors; warnings OK; re-verified 2026-09-21) |
| Build | `npm run build` | PASS (re-verified 2026-09-21) |
| Local E2E checklist (E2E-008–025) | `npm run test:e2e-checklist` | PASS (re-verified 2026-09-21) |

### Architecture / decisions

| Item | Result | Evidence |
|------|--------|----------|
| Passive Runtime (not Interactive) | PASS | `src/player/runtime/passive.ts`, ADR-006 |
| `display_type` / `interaction_mode` model readiness | PASS | `src/domain/types.ts`, schema defaults TV / PASSIVE |
| Rate limiting (login/bootstrap/sync/media) | PASS | `src/lib/rate-limit.ts`, `test:runtime` |
| Signed media URL decision (pilot keeps session/Bearer) | PASS | ADR-007 — migration deferred |
| Storage: LocalFs now; Drive stub; future object+signed | PASS | ADR-007, ACCEPTANCE Storage |
| Multi-tenant preserved; no billing/AI/touch | PASS | product scope |
| Display runtime hardening contracts | PASS | `runtime-capability-probe-contract.md`, `runtime-policy-semantics.md`, `display-runtime-common-contract.md` |
| Smart TV configuration/help and stable pairing identity | PASS (software) | Admin Devices help panel; `pair_start` reuses the same pending device for the same persisted TV identity |
| Admin presence visibility | PASS (software) | ONLINE / INSTÁVEL / OFFLINE polling with last heartbeat timestamp |
| Fresh device first sync delivers default playlist | PASS | `pairDevice` bumps `manifestVersion`; players with no local manifest report `version=-1`; acceptance Scenario 1 |

### Player runtime (emulator / browser — not HDMI)

| Item | Result | Evidence |
|------|--------|----------|
| Pairing + playlist playback | PASS | `hardware:prep`, emu screenshots |
| Images / text / video seed | PASS | fixture `hw-sample.mp4` avc1 960×540 5.055s |
| Offline reload (CDP) | PASS | IndexedDB + SW |
| Offline cold start (localhost secure context) | PASS | SW v6 + `emu-cold-offline-25s.png` |
| HTTPS origin pair + play + offline reload | PASS | cloudflared session evidence |
| HTTPS same-origin → Admin ONLINE (phone USB lab, 2026-09-18) | **PASS** (software) | `PHONE-HTTPS-V2` ONLINE/PLAYING via trycloudflare; **≠ Box HDMI** |
| Boot timeout (no permanent “A iniciar…”) | PASS | v0.1.2: localStorage boot + watchdog; Sraf → static `/tv.html` |
| Smart TV Sraf (NetRange) built-in browser | KNOWN LIMITATION | Use `/tv.html` (vanilla pairing). Offline/SW/IDB unsupported. **≠ HDMI Box DoD** |
| Android TV AVD pair + prep + play (re-verified) | PASS (software) | `TV-AVD-287355` + video seed; `emu-tv-avd-boot-v012b.png` → `emu-tv-avd-play-v012.png` |
| HTTPS same-origin pair → claim → ONLINE (USB phone lab) | **PASS** (software) | `PHONE-HTTPS-V2` / `USB-E2E-V2` via trycloudflare; Admin ONLINE + PLAYING; **≠ HDMI Box DoD** |
| USB E2E: connect → pair → sync → playlist update | **PASS** (software) | `USB-E2E-V2`: pairing → `HW Text Banner` → PATCH/reassign → `E2E UPDATE V2` / `PLAYLIST UPDATE OK`; evidence `usb-e2e-v2-*.png`. Fixes: R2 download without Bearer; partial sync; IDB timeout no wipe |

| `?reset=1` failure-recovery | **PASS** (software) | SW **v9** + offline-boot clears IDB; evidence `emu-fail-reset1.png` → “NO CONTENT AVAILABLE / Aguardando playlist” (was RECOVERY-V2 / HW Banner) |
| Android TV AVD offline cold start (no adb reverse) | **PASS** (software) | SW offline-boot on Firefox TV AVD — `emu-tv-avd-offline-cold.png` (`offline-boot · manifest=v1 · items=3`). **Not** physical box reboot |
| Offline continuous soak (measured) | PASS | **5 minutes** offline (CDP) still playing — `emu-soak-offline-t0.png` → `emu-soak-offline-t5m.png`; multi-hour/day **NOT TESTED** |
| Heartbeat ONLINE→OFFLINE logic | PASS | acceptance Scenario 7 |
| Network recovery / atomic manifest | PASS | acceptance Scenario 5–6 + emulator: offline v1 (HW Test Banner) → publish RECOVERY-V2 → online sync (`emu-recovery-online-v2.png`) |
| Kiosk CSS shell | PASS | `html.player-runtime` |
| Secure-context requirement documented | PASS | `android-tv.md`, quickstart |

**KNOWN LIMITATION (software):** brief blank until SW wakes after Chrome process kill; LAN HTTP IP may block SW (use HTTPS tunnel). Device credentials are **origin-scoped** — pair and play on the same host (tunnel vs LAN vs `127.0.0.1` are different devices).

## HARDWARE VERIFIED

| DoD item (§24) | Result |
|----------------|--------|
| Android TV Box installed | **NOT TESTED** |
| HDMI validated | **NOT TESTED** |
| Player starts (on box) | **NOT TESTED** |
| Device pairing works (on box) | **NOT TESTED** |
| Playlist plays (on box) | **NOT TESTED** |
| Images / video on box | **NOT TESTED** |
| Offline playback on box | **NOT TESTED** |
| Offline reboot on box | **NOT TESTED** |
| Network recovery on box | **NOT TESTED** |
| Manifest atomic update on box | **NOT TESTED** |
| Heartbeat observed on Admin from box | **NOT TESTED** |
| Device status on box | **NOT TESTED** |
| Tenant isolation on box | **NOT TESTED** |
| Kiosk / auto-start / power cycle | **NOT TESTED** |
| Long offline (hours/days) | **NOT TESTED** |
| Representative 1080p video on real TV | **NOT TESTED** |

**Reason:** no Android TV Box + HDMI + Smart TV evidence in `docs/evidence/hw-pending/`. Emulator ≠ hardware certification.

**Lab ready:** [smart-tv-quickstart.md](./smart-tv-quickstart.md) — produção `https://vitrine360-psi.vercel.app` (caminho HDMI) + LAN `http://192.168.100.6:3000` quando o servidor local está UP.

## Storage

- **Lab:** LocalFs (`MEDIA_STORAGE_PROVIDER=local`)
- **Produção:** Cloudflare R2 (`MEDIA_STORAGE_PROVIDER=r2`) — smoke 2026-09-21 PASS
- **Signed URLs:** ADR-007 — Bearer/session for downloads in pilot; R2 signed URLs for video playback
- **Drive:** stub — does not block pilot Player validation

## Do not claim

Android TV **production-ready** / DoD complete until HARDWARE rows above are PASS with recorded model, browser, video samples, and offline reboot evidence.

**Goal remains open. Do not auto-start next phase.**
