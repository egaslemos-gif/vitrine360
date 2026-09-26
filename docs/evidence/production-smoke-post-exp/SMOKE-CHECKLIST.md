# Production Smoke + Deployment Validation

**Date:** 2026-09-23T10:35:00Z  
**Alias under test:** https://vitrine360-psi.vercel.app  
**Active deployment:** `dpl_6vZJH9RpJPSd2GcRzMnRdJ58zHkt`  
**Deployment URL:** https://vitrine360-fri594536-egaslemos-5751s-projects.vercel.app  
**State:** READY  
**Source:** CLI redeploy of prior READY build  

## Deployment identity (important)

| Deployment | State | Role |
|------------|-------|------|
| `dpl_6vZJH9RpJPSd2GcRzMnRdJ58zHkt` | READY | **Current production** (aliased to `vitrine360-psi.vercel.app`) |
| `dpl_AdNJYCzwHvaGgGZBspUdJxY6edKe` | BLOCKED | Not production — Hobby/Git collaboration block |
| `dpl_538SgnVCEt52KHRdN2ucgkPv4fGa` | BLOCKED | Not production — archive force deploy blocked |

BLOCKED deployments are **ignored** for this validation.

## Smoke results

| ID | Result | Detail |
|----|--------|--------|
| HOME | PASS | `307` → `/admin` |
| LOGIN_PAGE | PASS | 200 · “Continuar com Google” present |
| GOOGLE_AUTH | PASS | 307 → `accounts.google.com` · production callback in `redirect_uri` |
| PASSWORD_LOGIN | PASS | 200 · `v360_session` HttpOnly+Secure+SameSite=Lax · role `SUPER_ADMIN` |
| DASHBOARD | PASS | 200 authenticated (`totalCount`/`onlineCount`/…) |
| WORKSPACES | PASS | 200 with session |
| WORKSPACES_UNAUTH | PASS | 401 |
| ADMIN_DEVICES_UNAUTH | PASS | 401 |
| PLAYER | PASS | 200 · Player runtime shell present |
| PAIR_START | PASS | 200 · `deviceId` + `activationCode` |
| EXPERIENCE_X | PASS* | `/x/...` → 308 then **404** (no 5xx) |

\* `/x` 404 is consistent with fail-closed missing package **or** EXPERIENCE-05+ routes not present in this redeployed build. No claim that EXPERIENCE-05…09 are live in production.

## Runtime errors (24h)

- 1 historical cluster on `/api/device/bootstrap`: missing column `effective_playback_key`  
- `lastDeployment`: `dpl_GUeu2yMmAZipgtgWD2gP8Lme5A2q` (older)  
- `last` seen: 2026-09-22 — **not** observed against current READY during this smoke (`PAIR_START` 200)

## Scope notes

- Title referenced “POST RUNTIME-EXPERIENCE-09”; **EXPERIENCE-09 is not present** in the local tree, and this production alias serves a redeploy of a **prior** READY build — not necessarily local EXPERIENCE-07/08 uncommitted work.
- Full Google interactive login (consent UI) not re-run in this automated pass; authorize redirect validated.
- Full device claim → heartbeat → manifest chain not expanded beyond `pair_start`.

## Verdict

**PRODUCTION SMOKE — OPERATIONAL**

Core admin auth, workspaces, dashboard, player shell, and device pair-start are healthy on the active READY alias. BLOCKED CLI deploys are not serving traffic.
