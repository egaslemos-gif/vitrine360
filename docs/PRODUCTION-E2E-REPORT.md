# Vitrine360 — Production E2E Report

Date: 2026-09-19  
Decision: **PRODUCTION VALIDATION — OPEN**

## Result matrix

| Area | Result | Evidence / blocker |
|---|---|---|
| Vercel project preparation | PASS | Project `vitrine360` linked |
| Vercel deployment | NOT TESTED | No deployment created |
| HTTPS | NOT TESTED | No production URL |
| Turso | BLOCKED pending smoke | Encrypted `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` configured; application alias support added, but no deployment smoke yet |
| R2 | BLOCKED | Vercel has no R2 environment variables |
| Authentication | NOT TESTED | Production `AUTH_SECRET` not configured |
| Device | NOT TESTED | Requires deployed application |
| Pairing | NOT TESTED | Requires deployed application |
| Content | NOT TESTED | Requires deployed app + R2 |
| Media Library | NOT TESTED | Requires deployed app + R2 |
| Playlist | NOT TESTED | Requires deployed application |
| Schedule | NOT TESTED | Requires deployed application |
| Resolver | NOT TESTED | Requires deployed application |
| Manifest | NOT TESTED | Requires deployed application |
| Sync | NOT TESTED | Requires deployed application |
| Atomic Activation | NOT TESTED | Requires deployed application |
| Player | NOT TESTED | Requires deployed HTTPS URL |
| Natural Video Duration | NOT TESTED | Local/service coverage only |
| Cursor | NOT TESTED | Production paired playback unavailable |
| Presence | NOT TESTED | Production heartbeat unavailable |
| Tenant Isolation | NOT TESTED in production | Local automated tests PASS |
| Offline Desktop | NOT TESTED in production | Local/browser evidence only |
| Android TV Box | NOT TESTED | Physical hardware remains unavailable |
| HDMI | NOT TESTED | Physical hardware remains unavailable |
| Offline Reboot | NOT TESTED | Physical hardware remains unavailable |
| Vercel Production | BLOCKED | Environment configuration missing |

## Local evidence retained

- Local regression suite: PASS.
- Local E2E service harness E2E-008–E2E-025: PASS on isolated SQLite.
- `vercel build --yes`: PASS using local `.env.local`, not production variables.
- Hardware evidence gate remains correctly blocked.

## Release decision

**PRODUCTION VALIDATION — OPEN**

This is not `PRODUCTION READY` and not Release Ready.

The 2026-09-19 matrix above is the historical snapshot from before production deploy. Later evidence in [VERCEL-DEPLOYMENT-REPORT.md](./VERCEL-DEPLOYMENT-REPORT.md) records `https://vitrine360-psi.vercel.app` as deployed. That does not close HDMI or Android TV Box.

No Touch, billing, IA, SSE, or unrelated runtime feature was started.

# Physical Runtime Evidence

Consolidation date: 2026-09-21. No Player or offline-engine code was changed for this section.

## Production Player

**PASS.** `https://vitrine360-psi.vercel.app`, recorded in [VERCEL-DEPLOYMENT-REPORT.md](./VERCEL-DEPLOYMENT-REPORT.md).

## Hisense

**PASS.** Physical Smart TV, player v0.1.16, slide inteiro com fundo preto. [HISENSE-PHYSICAL-VALIDATION.md](./HISENSE-PHYSICAL-VALIDATION.md). This is not Android TV.

## Android Physical Device

**PASS.** Phone SM-A566B, Chrome on `/player`. [ANDROID-PHYSICAL-RUNTIME-VALIDATION.md](./ANDROID-PHYSICAL-RUNTIME-VALIDATION.md). Chrome version and Android version: **NOT DOCUMENTED**. This is not an Android TV Box.

## Android Offline Runtime

**PASS** for offline playback, by operator statement on 2026-09-21. Archived log, duration, and screenshot: **NOT DOCUMENTED**.

Offline reload on that phone: **NOT TESTED**.  
Offline reboot: **NOT TESTED**.

## Android TV Box

**NOT TESTED — HARDWARE NOT AVAILABLE**

## HDMI

**NOT TESTED — HARDWARE NOT AVAILABLE**

## Android TV Offline Reboot

**NOT TESTED — HARDWARE NOT AVAILABLE**
