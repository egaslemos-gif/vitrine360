# DoD audit snapshot — Android TV Hardware Validation

Date: 2026-09-16  
Goal: Passive Player on **Android TV Box via HDMI** + runtime hardening  
Legend: **PASS** | **FAIL** | **NOT TESTED** | **KNOWN LIMITATION**

## SOFTWARE (automatable / lab)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Automated gates (domain/tenant/security/runtime/acceptance) | **PASS** | `npm run test` exit 0 |
| Typecheck | **PASS** | `npm run typecheck` |
| Lint | **PASS** | `npm run lint` (clean after 2026-09-16 fixes) |
| Build | **PASS** | `npm run build` |
| Passive Runtime boundary | **PASS** | ADR-006, `passive.ts` |
| `display_type` / `interaction_mode` readiness | **PASS** | schema defaults TV / PASSIVE |
| Rate limiting (login/bootstrap/sync/media) | **PASS** | `rate-limit.ts`, `test:runtime` |
| Signed media URL decision | **PASS** | ADR-007 (Bearer GET for pilot) |
| Tenant isolation | **PASS** | `test:tenant` / security audit |
| Emulator pairing + playback + offline cold | **PASS** | `docs/evidence/emu-*.png`, TV AVD |
| Network recovery / atomic manifest (software) | **PASS** | acceptance + emu recovery screenshots |
| Heartbeat ONLINE→OFFLINE logic | **PASS** | acceptance Scenario 7 |
| Kiosk/auto-start **documented** | **PASS** | `android-tv.md` Fully Kiosk / MDM |
| ACCEPTANCE SOFTWARE vs HARDWARE split | **PASS** | `docs/ACCEPTANCE.md` |
| Final report structure | **PASS** | `HARDWARE-VALIDATION-REPORT.md` |

## HARDWARE (physical Box + HDMI — blocking)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Android TV Box installed | **NOT TESTED** | `hw-pending/` empty |
| HDMI validated | **NOT TESTED** | — |
| Player starts on box | **NOT TESTED** | — |
| Pairing on box | **NOT TESTED** | — |
| Playlist / image / video on box | **NOT TESTED** | — |
| Offline playback on box | **NOT TESTED** | — |
| Offline reboot on box (mandatory) | **NOT TESTED** | — |
| Network recovery on box | **NOT TESTED** | — |
| Heartbeat from box on Admin | **NOT TESTED** | — |
| Kiosk / auto-start on box | **NOT TESTED** or **KNOWN LIMITATION** when proven impossible | — |
| Long offline (hours/days) | **NOT TESTED** | — |
| Representative 1080p on real TV | **NOT TESTED** | fixture seeded only |

Gate: `npm run hardware:evidence` → exit **2** until media in `docs/evidence/hw-pending/`.

## Explicit non-substitutes

| Lab item | Why it is not DoD |
|----------|-------------------|
| Android TV AVD | Emulator ≠ HDMI appliance |
| Smart TV **Sraf** browser | Not Android TV Box; offline/SW limited (v0.1.1 mitigates online pairing only) |

## Blocker

No Android TV Box is available to this agent (`adb` = emulators only). Operator must attach Box → HDMI → TV and follow [OPERATOR-HDMI-UNBLOCK.md](./OPERATOR-HDMI-UNBLOCK.md).

**Goal remains open. Do not auto-start next phase.**
