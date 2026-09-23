# Objective status — Hardware Validation (2026-09-21)

**Verdict: GOAL OPEN.** Final release **OPEN**.

Android Physical Runtime and Hisense physical playback are recorded. They do not certify Android TV Box, HDMI, or an external display.

Android TV Box, HDMI, external display, and Android TV offline reboot are **NOT TESTED — HARDWARE NOT AVAILABLE**. That is absence of the box, not a system or configuration block.

Do not mark complete. Do not start next phase.

## Requirement matrix

| # | Objective requirement | Status | Proof |
|---|----------------------|--------|-------|
| 1 | Validate Passive Player on **Android TV Box via HDMI** | **NOT TESTED — HARDWARE NOT AVAILABLE** | `hw-pending/` **0** media; `hardware:evidence` exit **2**; no TV Box on ADB (phone SM-A566B ≠ Box). Not a configuration block |
| 2 | Document kiosk / auto-start install | **PASS** | `android-tv.md` + Fully Kiosk in `OPERATOR-HDMI-UNBLOCK.md` |
| 3 | Offline / reboot / network-recovery / video / display / heartbeat **software** tests | **PASS** | ACCEPTANCE + emu evidence + USB HTTPS E2E |
| 4 | Same tests on **physical Box** | **NOT TESTED** | RESULTS-TEMPLATE empty |
| 5 | `display_type` / `interaction_mode` readiness | **PASS** | ADR-006; TV / PASSIVE defaults |
| 6 | Rate limiting eval / impl | **PASS** | `rate-limit.ts`; in-memory **KNOWN LIMITATION** |
| 7 | Signed media URL decision | **PASS** | ADR-007; R2 signed URLs for video (+ Bearer fix for downloads) |
| 8 | Tenant isolation recheck | **PASS** | `test:tenant` + `test:security` |
| 9 | Update ACCEPTANCE + checklist SOFTWARE vs HARDWARE | **PASS** | HARDWARE columns remain NOT TESTED |
| 10 | All automated gates green | **PASS** | `npm test` **0**, `test:e2e-checklist` **0**, `typecheck` **0**, `lint` **0 errors**, `build` **0**, `probe:mp4` **0** (2026-09-21 17:45). `hardware:evidence` **exit 2** is expected until HDMI media exists |
| 11 | Final report PASS/FAIL/NOT TESTED/KNOWN LIMITATION | **PASS** (structure) | `HARDWARE-VALIDATION-REPORT.md` |
| 12 | No touch / billing / IA | **PASS** | scope held |
| 13 | Do not auto-start next phase | **PASS** | held |
| 14 | Smart TV URL/help, presence visibility, duplicate pairing prevention | **PASS (software)** | Admin Devices help panel; heartbeat timestamp; persisted pairing identity; Production reuse smoke PASS |
| 15 | Produção Vercel validada (auth + R2 + playlist editor) | **PASS (software)** | `dpl_EW5gPgfuNzLsj7tqdv8X8iXW4J1S` → `vitrine360-psi.vercel.app`; login 200; editor `/admin/playlists/[id]` 200 após fix `fit_mode` (`ensureSchema` self-healing); ver `VERCEL-DEPLOYMENT-REPORT.md` |
| 16 | Playlist padrão entregue no 1º sync (dispositivo novo) | **PASS (software)** | `pairDevice` agora faz bump de `manifestVersion`; players sem manifest local reportam `version=-1` (tv.js `0.1.12`, player React); regressão coberta em `test:acceptance` ("first sync delivers default playlist"); deploy `dpl_7a2MEFdPzPZg9f3G5pUC3zB4oT7Z` |
| 17 | Caminho HDMI de produção (`hardware:prep` + `/player`) | **PASS (software)** | `hardware:prep` default `https://vitrine360-psi.vercel.app` + `fixtures/hw-sample.mp4`; login produção 200; `/player` emite código de activação. HDMI físico **NOT TESTED** |

## What the agent cannot finish alone

Physical **Android TV Box + HDMI + Smart TV**, operator screenshots in `hw-pending/`, filled RESULTS-TEMPLATE including **offline reboot**.

## Lab snapshot (agent, 2026-09-18 ~21:34)

| Check | Result |
|-------|--------|
| Server `:3000` | **200** (`npm start`) |
| USB path | `adb reverse tcp:3000` → `http://127.0.0.1:3000/player` |
| HTTPS tunnel | **200** — `https://managers-bbs-seasonal-contacts.trycloudflare.com` |
| ADB | AVD + phone SM-A566B `RZGYC0CLGKE` — **≠ Box** |
| `hw-pending/` | **0** media |
| `hardware:evidence` | exit **2** |
| USB E2E V3 (software) | **PASS** — `USB-E2E-V3` pair `303238` → sync `HW Text Banner` → update `E2E UPDATE V3` (`usb-e2e-v3-*.png`); presence **ONLINE**, `manifestVersion` **3** |
| Smart TV static E2E (software) | **PASS** — HTTPS `/tv.html` pairing → TEXT/IMAGE/VIDEO playlist playback; expired pairing cache fix applied |
| Smart TV empty-manifest recovery | **IMPLEMENTED (`v=022`)** — full sync retry when cached state has no playlist; physical retest pending |
| Smart TV legacy-browser compatibility | **FIXED (`v=022`)** — media loading falls back from unavailable `fetch` to XHR; physical retest pending |
| Smart TV bounded media preload | **IMPLEMENTED (`v=024`)** — playlist activates after 3s max per media cache attempt and falls back to original URL |
| Physical HDMI playback at `v=022` | **NOT TESTED** — historical operator report was not archived as HDMI evidence; later software fix is not hardware certification |
| Smart TV immediate playback | **IMPLEMENTED (`v=025`)** — first slide no longer waits for cache/XHR completion |
| Smart TV persistent media cache | **IMPLEMENTED (`v=027`)** — IndexedDB blob cache keyed by stable `asset.id`, with Cache API fallback; retest required |
| Physical HDMI playback at `v=027` online | **NOT TESTED** — no physical HDMI media is archived in `docs/evidence/hw-pending/` |
| Same-origin device media cache path | **IMPLEMENTED (`v=028`)** — authenticated proxy fetches R2 server-side and seeds IndexedDB/Cache API without external CORS dependency |
| Smart TV offline shell | **IMPLEMENTED (`v=029`)** — Service Worker caches `/tv.html` and `tv.js`; offline navigation no longer depends on tunnel DNS |
| Hisense/VIDAA built-in browser offline navigation | **KNOWN LIMITATION** — fragile browser cannot guarantee offline reload/404 recovery; use external Android TV Box for the offline DoD |
| Automated gates | **PASS** — `npm test` 0, `typecheck` 0, `lint` 0 errors (warnings only), `build` 0 (2026-09-19) |
| Offline recovery hardening | **PASS (software)** — cached CURRENT remains playable on sync timeout/failure; sync retries on timer and `online` event |

## Operator next action

1. **Android TV Box → HDMI → Smart TV** (DoD). Smart TV Sraf alone ≠ Box certification. Phone SM-A566B ≠ Box.
2. **URLs agora (produção HTTPS — caminho HDMI):**  
   - **Box:** `https://vitrine360-psi.vercel.app/player`  
   - **Sraf (≠ DoD):** `https://vitrine360-psi.vercel.app/tv.html`  
   - **Admin:** `https://vitrine360-psi.vercel.app/admin/login`  
   - **LAN lab (se o servidor local estiver UP):** `http://192.168.100.6:3000/player`
3. Pair → `hardware:prep` → screenshots in `hw-pending/` + RESULTS-TEMPLATE (offline reboot **mandatory**)
4. `npm run hardware:evidence` exit **0**

## Latest hardware recheck (2026-09-21 17:45)

| Check | Result |
|-------|--------|
| `adb devices -l` | **SM-A566B `RZGYC0CLGKE`** — phone, 1080×2340. **≠ Box HDMI** |
| `npm run hardware:status` | Produção **200**; localhost:3000 **200**; tunnel histórico `trycloudflare` **stale / 0**; `hw-pending` **0** media |
| `docs/evidence/hw-pending/` | **0** HDMI media files; template remains unfilled |
| `npm run hardware:evidence` | **EXIT 2 — NOT TESTED**, correctly blocked |

No emulator or phone evidence is promoted to physical Box/HDMI certification.

Guide: [OPERATOR-HDMI-UNBLOCK.md](./OPERATOR-HDMI-UNBLOCK.md) · [smart-tv-quickstart.md](./smart-tv-quickstart.md)

## Gate reclassification — 2026-09-21 (evidence consolidation)

No runtime, Player, offline engine, or deployment was changed in this pass. Historical rows above stay as recorded. This section only separates platforms.

| Capability | Evidence | Result |
|---|---|---|
| Vercel Production | `https://vitrine360-psi.vercel.app` in [VERCEL-DEPLOYMENT-REPORT.md](./VERCEL-DEPLOYMENT-REPORT.md) | **PASS** |
| Player Production | Same URL; `/player` and `/tv.html` HTTP 200 in that report | **PASS** |
| Hisense Playback | Operator observation, player **v0.1.16**, 2026-09-21. Report: [HISENSE-PHYSICAL-VALIDATION.md](./HISENSE-PHYSICAL-VALIDATION.md). Archived media file | **PASS**; file **NOT DOCUMENTED** |
| Slide Rendering | Same Hisense session: portrait centered on black, landscape filled the screen | **PASS** |
| Android Physical Runtime | Physical phone **SM-A566B** `RZGYC0CLGKE`, USB E2E pair → play → playlist update. Report: [ANDROID-PHYSICAL-RUNTIME-VALIDATION.md](./ANDROID-PHYSICAL-RUNTIME-VALIDATION.md) | **PASS** |
| Android Offline Playback | Operator statement, 2026-09-21, that the physical phone kept playing with the network off. Dated log, duration, and screenshot | **PASS** (operator); artefact **NOT DOCUMENTED** |
| Android Offline Reload | No physical-phone reload-without-network record. Emulator/CDP reload remains a software result in [HARDWARE-VALIDATION-REPORT.md](./HARDWARE-VALIDATION-REPORT.md) | **NOT TESTED** on the phone |
| Android Offline Reboot | No physical reboot without network | **NOT TESTED** |
| Android TV Emulator | AVD `Vitrine360_AndroidTV` / `TV-AVD-287355`, including emulator offline cold, in the hardware report. Cited PNGs are not in the tree | **PASS (software / emulator)** |
| Android TV Box | No box on ADB | **NOT TESTED — HARDWARE NOT AVAILABLE** |
| HDMI | `docs/evidence/hw-pending/` has 0 media files | **NOT TESTED — HARDWARE NOT AVAILABLE** |
| External Display | No Box + HDMI + display record | **NOT TESTED — HARDWARE NOT AVAILABLE** |
| Android TV Boot | No physical box boot | **NOT TESTED — HARDWARE NOT AVAILABLE** |
| Android TV Offline Reboot | No physical box reboot without network | **NOT TESTED — HARDWARE NOT AVAILABLE** |
| Kiosk / auto-start on a box | Procedure documented in `android-tv.md`; physical box run | **NOT TESTED — HARDWARE NOT AVAILABLE** |

Phone, emulator, and Hisense Sraf do not close the Box or HDMI rows.

Related: [DOD-AUDIT-2026-09-16.md](./DOD-AUDIT-2026-09-16.md) · [ACCEPTANCE.md](./ACCEPTANCE.md) · [ANDROID-PHYSICAL-RUNTIME-VALIDATION.md](./ANDROID-PHYSICAL-RUNTIME-VALIDATION.md) · [HISENSE-PHYSICAL-VALIDATION.md](./HISENSE-PHYSICAL-VALIDATION.md)
