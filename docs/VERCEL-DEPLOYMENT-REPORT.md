# Vitrine360 — Vercel Deployment Report

Date: 2026-09-21  
Status: **DEPLOYED — PRODUCTION AUTH + R2 UPLOAD SMOKE PASS + PLAYLIST EDITOR INCIDENT FIXED**

## Vercel project

| Field | Value |
|---|---|
| Project | `vitrine360` |
| Project ID | `prj_fcQMbXzU4QF9VmhuTi9aRWMnX032` |
| Team | `egaslemos-5751s-projects` |
| Team ID | `team_zlb5wVNBDSFfaw25G2WS5Z7c` |
| Framework | Next.js |
| Vercel Node version | `24.x` |
| Production URL | `https://vitrine360-psi.vercel.app` |
| Deployment ID | `dpl_EW5gPgfuNzLsj7tqdv8X8iXW4J1S` |
| Commit / branch | **NOT RECORDED** — repository is not linked to a Git remote in this workspace |

## Actions completed

- Vercel CLI authentication confirmed as `egaslemos-5751`.
- New Vercel project created and linked.
- Preview project settings pulled into `.vercel/project.json`.
- `vercel build --yes` — **PASS**.
- Clean source deployment `vercel deploy --prod --yes` — **READY**; latest production redeploy `dpl_9PcwAfHeF2fT4a5iKGpEYVHV7oof`.
- Public route smoke: `/`, `/player`, `/tv.html` — **HTTP 200**.
- Removed stale `.tmp-chrome` (139 MB) from the deployment payload via `.vercelignore`.
- Disabled Vercel SSO protection required for unauthenticated Player/TV access.
- Local `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` — **PASS**.
- Production Admin login with `admin@vitrine360.local` — **HTTP 200**.
- Production `POST /api/admin/contents` multipart upload of `hw-sample.mp4` — **HTTP 200**.
- Production media listing confirms `storageProvider=r2` for the uploaded asset.

## Production configuration now verified

The deployment is reachable, connects to the migrated Turso database, and has the required session and media-storage configuration.

- `DATABASE_URL` and `DATABASE_AUTH_TOKEN` point to the migrated Turso database;
- `AUTH_SECRET` is configured as a Production-only sensitive variable;
- `MEDIA_STORAGE_PROVIDER=r2` is configured;
- R2 account, bucket, endpoint, access key, and secret are configured in Production;
- `POST /api/auth/login` returns `200` for the provisioned Admin account;
- multipart VIDEO upload returns `200` and persists through R2.

Admin/API authorization remains application-controlled; Vercel SSO is disabled so an Android TV Player can load without an interactive SSO login.

## Production incident — playlist editor 500 (`fit_mode`) — RESOLVED

- Symptom: authenticated `GET /admin/playlists/[id]` returned HTTP 500 in production.
- Root cause: runtime log showed `SQL_INPUT_ERROR: no such column: "fit_mode"` — the Turso database used by the running deployment had not received migration `0004_slide_fit_mode.sql` (local/preview pushes applied to a different database).
- Fix: self-healing idempotent schema guard `ensureSchema()` in `src/db/client.ts` (adds `playlist_items.fit_mode` once, ignores duplicate-column), awaited by `getPlaylistWithItems` (`src/services/playlists.ts`) and `buildDeviceManifest` (`src/services/manifest.ts`) so admin editor and device manifest both self-repair on first request.
- Deploy: `dpl_EW5gPgfuNzLsj7tqdv8X8iXW4J1S` aliased to `https://vitrine360-psi.vercel.app`.
- Verification (authenticated production session, 2026-09-21 14:38 UTC): `/admin/playlists/[id]` **200**, `/admin/playlists` **200**, `/admin/devices` **200**, `/admin` **200**; no new 5xx in Vercel runtime errors after the deploy.
- Learning: production database must be migrated with the same env binding the deployment uses; the in-app guard prevents recurrence for pilot-stage column additions.

## Production incident — new device stuck on "Aguardando playlist sincronizada" — RESOLVED

- Symptom: freshly paired device with an assigned playlist stayed on the waiting screen; admin showed "Versão v0".
- Root cause: version-handshake deadlock — `pairDevice` assigned the default playlist without bumping `manifestVersion` (stayed 0), and players with no local manifest reported `version=0`; `buildSyncDelta` computed `0 >= 0` → `upToDate` → manifest never delivered.
- Fix: `pairDevice` now sets `manifestVersion: device.manifestVersion + 1` on activation; players with no local manifest report `version=-1` (`public/tv.js` v0.1.12, `public/player-smarttv.js`, React `/player` sync engine + heartbeat trigger), guaranteeing first delivery even for devices already paired at v0 (no re-pairing needed).
- Regression coverage: `test:acceptance` Scenario 1 now asserts first sync at `version=-1` delivers the default playlist items.
- Deploy: `dpl_7a2MEFdPzPZg9f3G5pUC3zB4oT7Z` aliased to `https://vitrine360-psi.vercel.app`; `tv.js?v=037` confirmed serving `0.1.12-smarttv-static`.

## Remaining production validation

The following remain outside this smoke test:

- Full production device pairing and HDMI validation;
- production R2 playback through a paired device Bearer token;
- complete production E2E flow and observability review;
- Git commit/remote registration remains unavailable because this workspace has no Git remote.
