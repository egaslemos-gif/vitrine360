# Vitrine360 — Vercel Pre-deploy Audit

Date: 2026-09-19  
Scope: read-only audit before deployment  
Decision: **BLOCKED pending production configuration and Vercel scope**

## Status vocabulary

- `PASS`: verified from repository evidence.
- `WARNING`: known risk or operational dependency that does not by itself prove failure.
- `BLOCKER`: deployment/validation cannot be honestly completed yet.
- `NOT APPLICABLE`: outside this application or phase.

## Audit matrix

| Area | Status | Evidence / finding |
|---|---|---|
| `package.json` | PASS | Next 16.3.5 scripts exist for build, tests, migrations and local E2E |
| `next.config.ts` | PASS | Minimal config; no incompatible custom server or filesystem build hook |
| TypeScript / client boundaries | PASS | No Node-only imports found in `"use client"` modules |
| Local SQLite fallback | WARNING | `src/db/client.ts` falls back to `file:./data/vitrine360.db`; production must override with Turso |
| Turso production URL/token | PASS (names configured) / BLOCKER (smoke pending) | Vercel Preview/Production contain encrypted `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`; code now accepts these aliases |
| Migration process | WARNING | `npm run db:push` exists; no explicit non-destructive production migration command or rollback record |
| Local filesystem media | BLOCKER | `LocalFsProvider` writes under `process.cwd()`/`uploads`; unsuitable for Vercel persistence |
| R2 provider | PASS (code) | Server-side S3-compatible client, presigned GET, tenant-prefixed key |
| R2 production configuration | BLOCKER | No verified Vercel values for account, access key, secret, bucket and provider selection |
| `/api/media` local route | WARNING | Route reads local filesystem directly; R2 production traffic must use provider URL/device proxy path |
| Authentication secret | PASS (code) / BLOCKER (environment) | `AUTH_SECRET` enforces minimum 32 chars, but production value is not verified |
| HTTPS session cookie | PASS (code) | `secure` is enabled when `NODE_ENV=production`; `httpOnly`, `sameSite=lax`, and `path=/` are set |
| `NEXT_PUBLIC_APP_URL` | WARNING | Present in example as localhost but not consumed by application code; production URL still needs operational record |
| Service Worker / PWA | PASS (code) | `/player` manifest and `/sw.js` registration/precache exist |
| Service Worker production smoke | BLOCKER | Requires real HTTPS deployment and browser evidence |
| CORS / CSP | WARNING | No explicit application CORS/CSP policy was found in the audited source; verify platform defaults and browser behavior |
| Serverless runtime | WARNING | API routes use async server handlers and no custom server; in-memory rate limiting is not distributed |
| Hardcoded local URLs | WARNING | Local/test scripts contain localhost/LAN defaults; production code does not use them for API calls |
| Seed/dev credentials | WARNING | `scripts/seed.ts` and development auth defaults exist; must not run seed or use default credentials in production |
| Hardware validation | NOT APPLICABLE | Must remain a separate physical Android TV Box + HDMI gate |

## Environment variable matrix

| Variable | Required | Server/Client | Secret | Source / status |
|---|---:|---|---:|---|
| `DATABASE_URL` | yes | Server | no* | `src/db/client.ts`, `drizzle.config.ts`; production must be Turso/libSQL |
| `DATABASE_AUTH_TOKEN` | yes for Turso | Server | yes | `src/db/client.ts`, `drizzle.config.ts`, `.env.example`; production value still missing |
| `TURSO_DATABASE_URL` | yes with Vercel Turso integration | Server | no | Vercel integration name; accepted as fallback by `src/db/client.ts` and `drizzle.config.ts` |
| `TURSO_AUTH_TOKEN` | yes with Vercel Turso integration | Server | yes | Vercel integration name; accepted as fallback by `src/db/client.ts` and `drizzle.config.ts` |
| `AUTH_SECRET` | yes | Server | yes | `src/lib/auth.ts`; minimum 32 chars enforced |
| `NEXT_PUBLIC_APP_URL` | operational | Client-readable if exposed | no | `.env.example`; currently not referenced in `src` |
| `MEDIA_STORAGE_PROVIDER` | yes | Server | no | `src/services/media/index.ts`; production must be `r2` |
| `MEDIA_LOCAL_DIR` | local only | Server | no | `src/services/media/paths.ts`; must not be the production persistence path |
| `R2_ACCOUNT_ID` | yes with R2 | Server | no | `src/services/media/r2-provider.ts` |
| `R2_ACCESS_KEY_ID` | yes with R2 | Server | yes | `src/services/media/r2-provider.ts` |
| `R2_SECRET_ACCESS_KEY` | yes with R2 | Server | yes | `src/services/media/r2-provider.ts` |
| `R2_BUCKET_NAME` | yes with R2 | Server | no | `src/services/media/r2-provider.ts` |
| `R2_ENDPOINT` | optional in code; recommended operationally | Server | no | `src/services/media/r2-provider.ts` |
| `MAX_UPLOAD_BYTES` | optional | Server | no | `src/services/contents.ts` |
| `HEARTBEAT_OFFLINE_AFTER_MS` | legacy/operational | Server | no | `.env.example` |
| `HEARTBEAT_ONLINE_WINDOW_MS` | optional | Server | no | `src/services/devices.ts`, `.env.example` |
| `HEARTBEAT_AWAY_WINDOW_MS` | optional | Server | no | `src/services/devices.ts`, `.env.example` |
| `GOOGLE_DRIVE_*` | no, R2 selected | Server | mixed | Optional provider only; do not configure unless selected |
| `BASE_URL`, `HTTPS_URL` | no | Test scripts | no | Local smoke/hardware scripts only |

\* `DATABASE_URL` is not a secret by itself, but database host information should not be logged unnecessarily.

No `NEXT_PUBLIC_*` variable may contain a secret. Do not place any R2 credential, database token, or `AUTH_SECRET` in a client-exposed variable.

## Storage and tenant-prefix findings

The R2 provider transforms the application key:

```text
application key: {tenantId}/{assetId}.{extension}
R2 key:         tenants/{tenantId}/{assetId}.{extension}
```

The application creates this key server-side from the authenticated tenant and generated asset ID. The client must not supply an arbitrary storage key.

The local `/api/media/[...key]` route validates tenant ownership but reads from local filesystem. It is not evidence of R2 delivery. Production validation must exercise the R2/presigned URL or authenticated device media proxy path.

## Migration and data safety

- Do not run `scripts/seed.ts` against production.
- Do not run `scripts/reset-db.ts` against production.
- `npm run db:push` is present but requires an explicit target and a recorded backup/rollback decision before use.
- Existing Turso data must be inspected before any migration; no destructive migration is authorised by this audit.

## Required actions before deploy

1. Discover or connect the intended Vercel team/project.
2. Confirm the target Turso database and migration/rollback strategy.
3. Configure Production, Preview, and Development variables by name and environment.
4. Set `MEDIA_STORAGE_PROVIDER=r2`; do not use `local` in Production.
5. Confirm R2 bucket access with a non-destructive smoke plan and cleanup scope.
6. Deploy only after Vercel build and environment checks are available.
7. Record the real deployment URL, deployment ID, commit and timestamp.

Until these actions are evidenced, the correct release state is **PRODUCTION VALIDATION — OPEN**, not Production Ready.
