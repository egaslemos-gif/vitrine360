# Vitrine360 — SaaS foundation, phase 1

Date: 2026-09-21

PHASE 1 STATUS: **PRODUCTION CONFIGURED — PARTIAL PRODUCTION VALIDATION (Google login PASS; remaining multi-workspace / logout / IDOR operator checks)**

| Gate | Result |
| --- | --- |
| IMPLEMENTED | Yes |
| SOFTWARE VALIDATED | Yes (`npm test`, typecheck, build) |
| PRODUCTION CONFIGURED | Yes. Vercel Production has `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`. `AUTH_SECRET` unchanged |
| PRODUCTION VALIDATED | Partial. Deploy, password regression, and real Google login → session → dashboard PASS. Multi-workspace UI, logout cycle, and production IDOR still to confirm |

## PRODUCTION OAUTH VALIDATION

Date: 2026-09-21. Secrets are not recorded here.

### Google Cloud

- OAuth client type: Web application
- Client id present on the authorize URL (suffix `.apps.googleusercontent.com`)
- Authorized redirect URIs required:
  - `https://vitrine360-psi.vercel.app/api/auth/google/callback`
  - `http://localhost:3000/api/auth/google/callback`
- After the production URI was saved, a follow of `/api/auth/google` no longer returned `redirect_uri_mismatch` and showed the Google sign-in page
- Scopes requested: `openid email profile` only

### Vercel configuration

- Project: `vitrine360` (`prj_fcQMbXzU4QF9VmhuTi9aRWMnX032`)
- Production variables added: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` (= `https://vitrine360-psi.vercel.app`)
- `AUTH_SECRET` left in place (not regenerated)
- No `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET`

### Production deployment

- Deploy id: `dpl_Ctwf4prSBLyRRsHGFAGBPmNQK8Fh`
- Alias: https://vitrine360-psi.vercel.app
- Build includes `/api/auth/google` and `/api/auth/google/callback`

### Automated production smoke

| Check | Result |
| --- | --- |
| Login page shows “Continuar com Google” | PASS |
| `GET /api/auth/google` → 307 to `accounts.google.com` | PASS |
| `redirect_uri` = production callback | PASS |
| PKCE (`code_challenge`), `state`, `nonce` | PASS |
| Scopes `openid email profile` | PASS |
| Password login `admin@vitrine360.local` → 200, `SUPER_ADMIN`, `activeTenantId` | PASS |
| Session cookie `v360_session` HttpOnly + Secure + SameSite=Lax + Path=/ | PASS |
| Google authorize page reachable after console fix | PASS |
| Real Google callback on **production** origin → session → dashboard | PASS (operator 2026-09-21: new Google user, ADMIN, workspace criado, dashboard) |
| Existing Google user second login / new Google user / logout / multi-workspace IDOR in production UI | PENDING |

### Operator mistake recorded (not a production failure)

A Google consent completed while the authorize request had been started with `redirect_uri=http://localhost:3000/...` (local `.env` / local tab). Google returned to `http://localhost:3000/api/auth/google/callback`, which hit an old local process without that route → browser 404. Production never received that callback. Validation of the production round-trip must start from https://vitrine360-psi.vercel.app/admin/login only.

## 1. Executive summary

The admin identity layer now has an explicit membership between a user and a tenant. The tenant remains the workspace. The existing JWT cookie `v360_session` carries the active workspace and the role taken from that membership. Password login is unchanged in its endpoint and still uses bcrypt. Google sign-in is a separate authorization-code flow on the same JWT, with PKCE, state, and nonce. It does not use Auth.js or Better Auth.

Player, runtime, sync, manifest, service worker, and IndexedDB were not modified.

## 2. Existing architecture

Re-audit of the code before this phase:

**Current auth flow.** `POST /api/auth/login` checks the password with bcrypt. `src/lib/auth.ts` signs an HS256 JWT with `jose` and stores it in `v360_session` for 12 hours (`httpOnly`, `sameSite=lax`, `secure` in production, `path=/`). `getSession()` verifies the token and reloads the user. There was no Google login, no Auth.js, and no `middleware.ts`. The `better-auth` package is installed and still has no imports under `src/`.

**Current tenant flow.** `tenants` is the workspace. Each user had one `users.tenantId`. The JWT copied that id. Admin services filtered by `session.tenantId`.

**Current authorization flow.** `requireSession(permission)` uses `ROLE_PERMISSIONS` in `src/domain/types.ts`. Roles are `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `OPERATOR`, `VIEWER`. Most pages only checked that a session existed. The users page also required `ADMIN` or `SUPER_ADMIN`. `SUPER_ADMIN` was stored on the user row and was not a cross-tenant bypass: queries still used that user's `tenantId`.

## 3. Changes implemented

- Tables `memberships` and `user_identities`.
- SQL file `drizzle/0005_memberships_identities.sql`.
- Runtime self-heal in `ensureSchema()` (`src/db/client.ts`), including a one-time backfill. Production today relies on this path; the Drizzle journal is not the deploy path.
- Session resolution through the active membership (`src/lib/auth.ts`).
- `GET /api/workspaces` and `POST /api/workspaces/switch`.
- `GET /api/auth/google` and `GET /api/auth/google/callback`.
- Password login still `POST /api/auth/login`. Logout still clears `v360_session`.
- Login page button “Continuar com Google”.
- `WorkspaceSwitcher` in the existing sidebar and mobile drawer.
- Navigation entries hidden with `hasPermission`. The API remains the authority.
- Seed writes a home membership for the demo admin.
- Tests in `scripts/test-saas-phase1.ts` (`npm run test:saas`).

`users.tenantId` is kept and marked **LEGACY / TRANSITIONAL** in `src/db/schema.ts`. New authorization does not read it as the source of truth. It is still written when a user is created, so the old column and the email uniqueness `(tenantId, email)` stay intact.

## 4. Membership model

`memberships`: `id`, `userId`, `tenantId`, `role`, `status`, `createdAt`, `updatedAt`.

Status values: `ACTIVE`, `INVITED`, `SUSPENDED`.

Unique index on `(userId, tenantId)`.

Role uses the existing `USER_ROLES` enum. There is no `OWNER` role. A new Google workspace is created with `ADMIN`.

Backfill: `INSERT OR IGNORE` copies each existing `users` row into a membership `id = userId || ':home'`, with the same role and status `ACTIVE`. Passwords, tenants, content, playlists, schedules, devices, and activity logs are not deleted.

`createMembership` updates the existing row when the legacy backfill already inserted that pair, so creating a user does not fail on the unique index. A second row for the same pair is still rejected by SQLite.

**INVITED and SUSPENDED cannot open a session and cannot be the target of a workspace switch.** There is no invite-accept screen in this phase.

## 5. Session model

The JWT claims are `sub`, `email`, `name`, `role`, `tenantId`, `activeTenantId`, `iat`, and `exp` (12 hours).

`tenantId` and `activeTenantId` are the same value: the workspace that `resolveActiveMembership` accepted. Existing services that read `session.tenantId` therefore stay inside the active workspace without a rewrite of devices, contents, media, playlists, schedules, or the player.

`getSession()` loads the user by id, then requires an `ACTIVE` membership for the tenant in the token. The role in the session is `membership.role`. A role sent by the browser is never trusted.

If the user has several active memberships and no valid preference, the oldest row (`createdAt`, then `id`) is chosen. Password login uses that rule. A still-valid `activeTenantId` is kept when `sessionFromUser` is called with that preference (workspace switch, and session reload).

## 6. Google OAuth flow

Endpoints:

- `GET /api/auth/google`
- `GET /api/auth/google/callback`

Scopes: `openid email profile` only.

The start route stores a 10-minute HttpOnly cookie `v360_oauth` (HS256, `AUTH_SECRET`) with `state`, `nonce`, and the PKCE verifier. The authorize URL uses `code_challenge` S256. The callback rejects a missing cookie, a state mismatch, a token-endpoint failure, a bad ID token, and `email_verified !== true`.

The ID token is checked with `jose` against Google's JWKS (`https://www.googleapis.com/oauth2/v3/certs`): issuer `https://accounts.google.com` or `accounts.google.com`, audience equal to `GOOGLE_CLIENT_ID`, nonce equal to the cookie, signature via JWKS, clock tolerance 60 seconds.

The redirect URI is `{APP_URL or NEXT_PUBLIC_APP_URL or request origin}/api/auth/google/callback`.

Production value that must be registered:

`https://vitrine360-psi.vercel.app/api/auth/google/callback`

Local value, separate from production:

`http://localhost:3000/api/auth/google/callback`

If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing, the browser is sent to `/admin/login?error=config`. No stack trace and no secret is returned.

## 7. Account linking policy

`user_identities` stores `provider` + `providerAccountId`, unique together. The first provider is `google`.

A returning Google subject reuses the same user. It does not create a second account.

If the Google email matches an existing user and there is no identity row yet, the server does **not** link on email alone. It sets a 15-minute HttpOnly cookie `v360_google_link` and redirects to `/admin/login?link=google`. The password login links the identity only when the password user's email matches the email inside that signed cookie. If that Google subject is already linked to someone else, the response is 409 and the link cookie is cleared. The password session is not created on that attempt; the next password login proceeds normally.

There is no self-serve “set a password” flow. A Google-only user receives a random bcrypt hash because `password_hash` is `NOT NULL`. They sign in with Google. They cannot use the password form until a future password-reset feature exists.

## 8. New user flow

Validated Google identity with no matching subject and no matching email:

1. Create one tenant. The name is the Google profile name. The slug comes from the email local part.
2. Create one user with role `ADMIN` on the legacy home column.
3. Create one `ACTIVE` membership with role `ADMIN`.
4. Store the Google identity.
5. Issue `v360_session` and enter `/admin`.

No extra workspaces are created.

## 9. Workspace switching

`GET /api/workspaces` returns only `ACTIVE` memberships for the signed-in user.

`POST /api/workspaces/switch` body is `{ tenantId }`. The server loads the membership, requires `ACTIVE`, resolves the role from that row, and replaces the JWT. Any other tenant, including a missing id, `INVITED`, or `SUSPENDED`, returns 403 `Workspace não autorizado`.

The sidebar select appears when the user has two or more active workspaces. With one workspace it shows the name only.

## 10. RBAC

`SUPER_ADMIN` is a **membership role**, not a global role. That matches the previous code: the permission set equals `ADMIN` inside one tenant, and nothing walked every tenant. A `SUPER_ADMIN` membership on tenant A does not authorize tenant B. An `ADMIN` membership is not treated as `SUPER_ADMIN`.

Server helpers, same module as before:

- `requireSession(permission?)`
- `requireRole(roles)`
- `hasPermission(role, permission)` — this is the permission check; a second `requirePermission` was not added

The sidebar and mobile nav hide entries the role cannot use. Hiding is not authorization. Admin APIs still call `requireSession` with the existing permission.

The users list and user create/update now follow memberships in the active workspace, not `users.tenantId` alone.

## 11. Security

Protected admin APIs keep using `session.tenantId`, which is now the validated `activeTenantId`. Switching to tenant B makes later calls use tenant B. A user without an active membership gets 403 on password login (`Sem workspace activo`) and no session from Google (`error=membership`).

Tests cover: switch to a tenant without membership, suspended, invited, content created in A absent from a list scoped to B, and a `SUPER_ADMIN` of A rejected for B.

Cookie `v360_session` is still not written to `localStorage`, `sessionStorage`, or IndexedDB. `GOOGLE_CLIENT_SECRET` is read only on the server. There is no `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET`.

Activity log (existing `logActivity`, not a new system):

- `LOGIN_PASSWORD`
- `LOGIN_GOOGLE`
- `LOGOUT` (API `DELETE /api/auth/login` and the sidebar logout actions)
- `WORKSPACE_SWITCH`
- `ACCOUNT_LINK`

## 12. Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Development, Preview, Production | Server only |
| `GOOGLE_CLIENT_SECRET` | Development, Preview, Production | Server only |
| `AUTH_SECRET` | Already required | Signs the session and the OAuth state/link cookies |
| `APP_URL` or `NEXT_PUBLIC_APP_URL` | Recommended in every environment | Fixes the redirect URI. Local `http://localhost:3000`. Production `https://vitrine360-psi.vercel.app` |

OAuth state does not need a separate secret. It uses `AUTH_SECRET`.

**Production environment variables to add on the Vercel project** `vitrine360` (`prj_fcQMbXzU4QF9VmhuTi9aRWMnX032`), target Production, and Preview if preview URLs should sign in with Google (each preview origin needs its own authorized redirect; this document does not invent those URIs):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_URL` = `https://vitrine360-psi.vercel.app`

Checked on 2026-09-21: production env names present include `AUTH_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, Turso aliases, and R2 variables. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are absent. Changing `.env.local` does not update Vercel. A new deployment is required after the variables are saved. No deployment was made in this phase.

## 13. Google Cloud configuration

OAuth client type: **Web application**.

Authorized redirect URI (production only):

`https://vitrine360-psi.vercel.app/api/auth/google/callback`

Authorized redirect URI (local only, a different client or an additional URI that is not mixed into the production checklist):

`http://localhost:3000/api/auth/google/callback`

Authorized JavaScript origins, if the console asks: the site origin only (`https://vitrine360-psi.vercel.app` and, for local, `http://localhost:3000`). No Drive, Sheets, Calendar, Gmail, or Contacts scopes.

## 14. Tests

`npm run test:saas` (`scripts/test-saas-phase1.ts`) talks to the configured database and mocks Google with a local RS256 key. It does not call Google.

Covered:

1. Password authentication still succeeds.
2. JWT contains `activeTenantId` and the membership role.
3. Membership creation, including the role used by the session when `users.role` differs.
4. Unique `(userId, tenantId)` rejected by the database.
5. One user, two workspaces.
6. Switch selects the other workspace and its role.
7. Switch to a tenant without membership returns null.
8. Content in tenant A is absent from tenant B's content list.
9. `SUSPENDED` cannot form a session.
10. `INVITED` cannot form a session.
11. OAuth state cookie round-trip; a garbage token is rejected.
12. Callback validation is the state compare plus claim checks (no live Google redirect).
13. ID token signature, issuer, audience, and nonce.
14. Second login with the same Google subject returns the existing user.
15. First login creates one user, one tenant, one `ADMIN` membership.
16. The same subject does not create a second identity.
17. Wrong issuer is rejected.
18. `email_verified: false` is rejected.
19. Session token is issued from `sessionFromUser` after the membership exists (Google callback uses that same function).
20. The original password user still authenticates after a Google link.
21. `VIEWER` lacks `manage_devices`; `ADMIN` is not `SUPER_ADMIN`.
22. `SUPER_ADMIN` on tenant A is not a session for tenant B.

A live Google smoke test was not run.

## 15. Regression results

| Command | Result |
| --- | --- |
| `npm test` | Pass. Domain, tenant isolation, security audit, rate limit, acceptance (pairing, default playlist, manifest, incremental sync, offline current-manifest keep), and phase 1 |
| `npm run typecheck` | Pass |
| `npm run lint` | The full tree still fails on two pre-existing errors in `src/features/player/player-app.tsx` (`react-hooks/refs`). That file was not edited. ESLint on the phase 1 auth, membership, workspace, and login files exits 0 |
| `npm run build` | Pass (`next build`, exit 0) |

Devices, contents, media, playlists, schedules, pairing, manifest, and sync were not edited. Acceptance tests exercised pairing, playlist, manifest, and sync helpers. The Hisense player and a physical offline reboot were not run again.

## 16. Known limitations

- `users.tenantId` still exists (legacy). Email uniqueness is still per tenant, so the same email in two tenants still needs `tenantSlug` on password login.
- `INVITED` is stored and denied. Nobody can accept an invite in the UI.
- Google-only users have no usable password.
- Account link requires the password form. There is no separate “Ligar conta Google” screen beyond the login notice.
- Admin pages other than Users still render for any signed-in role. The nav is filtered; the route is not. APIs enforce permissions.
- `better-auth` remains an unused dependency.
- `system_settings` stays global, as in the architecture audit.
- Workspace switch failure in the select has no toast.
- Drizzle's `_journal.json` does not list `0005`. Boot uses `ensureSchema()`.

## 17. Remaining work

- Complete one real Google login starting from https://vitrine360-psi.vercel.app/admin/login (not localhost). Confirm callback host is `vitrine360-psi.vercel.app`, then session, workspace, and role.
- Repeat Google login twice on the same account; exercise logout; exercise a second Google account for the new-user path; multi-workspace switch + IDOR on production APIs.
- Invite acceptance, password reset, and a dedicated link screen.
- Page-level permission checks aligned with the API.
- Remove `users.tenantId` only after every reader has moved to memberships.
- Do not start billing, Stripe, plans, usage metering, or player/runtime work in this phase.
