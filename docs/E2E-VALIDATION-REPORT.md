# Vitrine360 — E2E Validation Report

Date: 2026-09-19  
Checklist: [E2E-VALIDATION-CHECKLIST.md](./E2E-VALIDATION-CHECKLIST.md)

## Execution scope

This report records what can be proven in the repository environment. It does not promote emulator, phone, or browser evidence to physical HDMI certification, and it does not claim Vercel production validation without deployment evidence.

## Local automated execution

| Scenario | Result | Evidence |
|---|---|---|
| E2E-002 Quality Gate | PASS | `npm run typecheck`, `npm run lint`, `npm run build` |
| E2E-004 Tenant isolation | PASS | `npm run test:tenant`, `npm run test:security` |
| E2E-006 Pairing security | PASS | `npm run test:security` |
| E2E-008 Media deduplication | PASS | `npm run test:e2e-checklist` on isolated SQLite |
| E2E-009/E2E-010 Content/media safety | PASS | `npm run test:e2e-checklist` |
| E2E-011–E2E-016 Playlist lifecycle | PASS | reorder, duration override, duplicate and dependency safety |
| E2E-017–E2E-022 Distribution/schedule | PASS | default, ALL, GROUP, DEVICE, priority and fallback |
| E2E-023–E2E-025 Effective manifest | PASS | order, natural duration, tenant-scoped device manifest |
| E2E-024 Manifest version | PASS | `npm test` acceptance scenarios |
| E2E-026/E2E-027 Atomic update helpers | PASS | `npm run test:security`, `npm test` acceptance |
| E2E-032 Presence | PASS | `npm test` acceptance Scenario 7 |

The deterministic local harness is:

```text
npm run db:push
DATABASE_URL=file:./data/e2e-checklist.db npm run test:e2e-checklist
```

The isolated database is used to avoid contaminating the lab database and to avoid concurrent SQLite locks.

## Software/browser evidence

| Area | Result | Evidence |
|---|---|---|
| Pairing, playlist, manifest and incremental update | PASS | `docs/ACCEPTANCE.md` and `npm test` |
| Offline continuity/recovery | PASS (software) | emulator/CDP evidence in `docs/evidence/` |
| Video fixture and manifest duration | PASS (software) | `fixtures/hw-sample.mp4`, manifest tests |
| Cursor Idle | IMPLEMENTED; desktop functional validation pending paired playback | React idle logic plus CSS conflict correction |
| Legacy Smart TV browser | KNOWN LIMITATION | `/tv.html` fallback; Hisense/VIDAA offline reload is not reliable |

## Physical hardware

| Scenario | Result | Reason |
|---|---|---|
| E2E-037 Android TV Box | NOT TESTED | `adb devices -l` has no attached devices |
| E2E-038 Full physical flow | BLOCKED | no Box + HDMI evidence |
| E2E-039 Hardware evidence gate | BLOCKED | `npm run hardware:evidence` exits 2; evidence directory has no media |
| Offline reboot/video/display/heartbeat on Box | NOT TESTED | requires physical Box and HDMI |
| Kiosk/auto-start/power-cycle | NOT TESTED | depends on selected Box/kiosk app |

## Vercel / production

| Scenario | Result | Reason |
|---|---|---|
| E2E-040 Production configuration | NOT TESTED | production credentials/configuration not supplied |
| E2E-041 Production build | NOT TESTED as Vercel build | local build PASS |
| E2E-042 Deployment | NOT TESTED | no deployment evidence in this execution |
| E2E-043 Production API smoke | NOT TESTED | no production target evidence |

## Release decision

**NEEDS FURTHER VALIDATION**

The local software gates and E2E service scenarios pass. Release readiness is not proven because the physical HDMI gate and Vercel production gates remain `BLOCKED`/`NOT TESTED`.

No Fullscreen, Touch Runtime, billing, or IA phase was started.
