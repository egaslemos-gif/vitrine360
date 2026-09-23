# SaaS Foundation — Architecture Audit

Date: 2026-09-21  
Status: **AUDIT COMPLETE**  
Implementation: **NOT STARTED**

This pass did not change the Player, runtime, sync, manifest, or offline engine. No Google credentials were created. No secret values are recorded here.

Production origin used below: `https://vitrine360-psi.vercel.app`.

---

## 1. Current Authentication

The admin session is a custom implementation in `src/lib/auth.ts`. It is not Auth.js and it is not NextAuth.

| Question | Finding |
|---|---|
| Library actually used | `jose` (HS256 JWT) + `bcryptjs` (password hashes) |
| `better-auth` | Present in `package.json` (`^1.7.5`). **No import in `src/`.** It does not handle login. |
| Auth.js / NextAuth | **Not installed.** `docs/architecture/adr/003-auth.md` names them as an option. The code did not take that option. |
| How a user is identified | `users.id`. Email is unique per tenant (`users_tenant_email_uidx`), not globally. |
| How `tenantId` is obtained | Copied into the JWT at login from `users.tenantId`. `getSession()` loads the user again with `id` + `tenantId` and returns the database row. |
| How the session is built | `SignJWT` claims: `sub`, `email`, `name`, `role`, `tenantId`. TTL `12h`. Cookie `v360_session`, `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`. |
| Where permissions are checked | `requireSession(permission)` on admin API routes, using `hasPermission` in `src/domain/types.ts`. Most admin pages only call `getSession()` and redirect if missing. The users page also rejects roles other than `ADMIN` and `SUPER_ADMIN`. |
| Local login | **Yes.** `POST /api/auth/login` with `email`, `password`, optional `tenantSlug`. |
| OAuth provider for users | **None.** |
| Partial Google login | **None.** Google appears only as an optional media backend (`GoogleDriveProvider`, service account, Drive scope). That is storage, not sign-in. |
| Middleware / proxy | **No** `middleware.ts` or `proxy.ts`. Protection is per page and per route handler. |
| Logout | Server action in `src/app/admin/layout.tsx` clears the cookie. `DELETE /api/auth/login` does the same. |

`authenticateUser` looks up the email. If more than one tenant has that email and `tenantSlug` is omitted, login returns 400 (`tenantSlug required`). Password compare uses bcrypt.

There is no Google callback in the repository. `/api/auth/callback/google` does not exist and must not be assumed.

Routes that depend on the admin session:

- Pages under `src/app/admin/` except the login screen, which renders when `getSession()` is null.
- `src/app/api/admin/**` via `requireSession(...)`.
- Playlist server actions in `src/app/admin/playlists/actions.ts`.

Device APIs (`/api/device/**`) use a separate device bearer token. They are not admin sessions. This audit does not change them.

---

## 2. Google Auth Architecture

Proposed flow, not implemented:

```text
Google
  → OAuth (authorization code, identity scopes only)
  → Application callback (new route; see section 17)
  → Identity (Google subject + verified email)
  → User
  → Session (existing v360_session cookie)
  → Workspace membership
  → Admin application
```

| Topic | Decision for a later implementation |
|---|---|
| Provider | Google OAuth 2.0 / OpenID Connect. Not the Drive service account. |
| Callback | Does not exist today. Plan a new route under the current auth namespace: `/api/auth/google/callback`. Do not reuse an Auth.js path that the code does not have. |
| Scopes | `openid`, `email`, `profile` only. |
| Session strategy | Keep the current HS256 cookie. Google login ends by calling the existing `setSessionCookie`. Do not introduce a second session format in the first phase. |
| Account linking | New `identities` table (`provider`, `providerSubject`, `email`, `userId`). Do not overload `passwordHash`. |
| First login | No identity and no user → onboarding, create workspace, then session. |
| Existing user | Verified Google email matches exactly one user → link only after an explicit confirm. If the same email exists in more than one tenant, do not pick one automatically. |
| New user | Create `users` row plus one `memberships` row. `passwordHash` stays unused for that account (column must become nullable; see migration). |
| Revoked Google account | Local session remains valid until the 12h JWT expires or logout, unless a later phase re-checks Google. Document this; do not pretend revocation is instant. |
| Unauthorized workspace | Membership missing or not `ACTIVE` → no session for that workspace. |

---

## 3. Current Tenant Model

`tenants` is the workspace. Columns: `id`, `name`, `slug` (unique), `timezone`, `status`, timestamps.

A user belongs to exactly one tenant:

```text
users.tenantId  →  tenants.id
users.role      on the user row, not on a membership
```

There is no `memberships` table.

Owned by `tenantId` today: devices (nullable until paired), device groups, media assets, contents, playlists, schedules, activity logs.

Not directly tenant-scoped: `content_assets` (scoped through content), `playlist_items` (through playlist), `schedule_targets` (through schedule), `device_group_members`, deprecated `device_assignments`, `system_settings` (global key/value).

**Workspace can be the existing `tenants` row.** A second entity is not required. The admin UI can say Workspace while the table remains `tenants`.

---

## 4. Proposed Workspace Model

```text
User
  → Membership
    → Workspace (existing tenants row)
```

Keep `tenants` as the storage name in the first migration. Rename only in the product language.

A user may later belong to several workspaces. The session then carries the active `tenantId`, chosen from an `ACTIVE` membership, not from a single column as the only source of truth.

During migration, keep writing `users.tenantId` and `users.role` so current queries keep working. Membership is the new source of truth after phase C.

---

## 5. Membership

Proposed table `memberships` (not created in this audit):

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `userId` | `users.id` |
| `tenantId` | `tenants.id` |
| `role` | Role inside that workspace |
| `status` | `ACTIVE`, `INVITED`, `SUSPENDED` |
| `createdAt` / `updatedAt` | Audit |

Unique `(userId, tenantId)`.

Backfill: one `ACTIVE` membership per existing user, copying `users.role` and `users.tenantId`. No row deletes.

---

## 6. Roles

Roles already in `src/domain/types.ts`:

`SUPER_ADMIN`, `ADMIN`, `EDITOR`, `OPERATOR`, `VIEWER`.

`SUPER_ADMIN` and `ADMIN` currently receive every permission. `SUPER_ADMIN` is still bound to one `tenantId`. The name suggests a platform operator; the schema does not grant cross-tenant access. Do not treat it as a global SaaS owner.

Recommended mapping for a later review, not a final decision:

| Product language | Existing role | Note |
|---|---|---|
| Owner | Keep `ADMIN` for the creator of a workspace | A separate `OWNER` is only needed when billing must have a single payer. Not now. |
| Admin | `ADMIN` | |
| Editor | `EDITOR` | Contents, playlists, schedules. No devices, no users. |
| Operator | `OPERATOR` | Devices, playlists, schedules. No contents library, no users. |
| Viewer | `VIEWER` | Dashboard and activity. |

Do not add roles in the first Google-login phase.

---

## 7. Permissions

Checked server-side today:

| Permission | Who |
|---|---|
| `manage_users` | `SUPER_ADMIN`, `ADMIN` |
| `manage_devices` | those, plus `OPERATOR` |
| `manage_contents` | those, plus `EDITOR` (media routes use this permission) |
| `manage_playlists` | `ADMIN`, `EDITOR`, `OPERATOR` |
| `manage_schedules` | same |
| `view_logs` | all five roles |
| `view_dashboard` | all five roles |

Gap: the sidebar shows every area to every role. Only the users page enforces a role in the UI. A `VIEWER` can open Media or Devices screens; mutations should fail with 403 at the API. That is an enforcement gap in the interface, not a missing permission list.

There is no permission for workspace settings, invites, or billing. Do not invent them until those features exist.

---

## 8. Multi-Tenancy

`scripts/test-tenant-isolation.ts` covers tenant A versus tenant B for the service layer. This audit did not re-run it.

| Area | Result | Why |
|---|---|---|
| Users | **PASS** | Listed and created with `session.tenantId`. Email unique per tenant. |
| Devices | **PASS** | Admin queries filter `tenantId`. `tenantId` is nullable on the row until pairing; unpaired rows must stay out of other tenants' lists. |
| Device groups | **PASS** | `tenantId` required. |
| Media assets | **PASS** | `tenantId` plus unique `(tenantId, checksum)` for SHA-256 dedup. Dedup does not cross tenants. |
| Contents | **PASS** | `tenantId` required. |
| Content assets | **WARNING** | No `tenantId`. Safe only while every query joins a content row in the same tenant. |
| Playlists | **PASS** | `tenantId` required. Editor loads with `getPlaylistWithItems(id, tenantId)`. |
| Playlist items | **WARNING** | No `tenantId`. Safe only through the parent playlist. |
| Schedules | **PASS** | `tenantId` required on the schedule. |
| Schedule targets | **WARNING** | No `tenantId`. A target id from another tenant could be attached if a write checks only `targetType` and not that the device or group belongs to `schedules.tenantId`. |
| Activity logs | **PASS** | Read path filters `tenantId`. |
| System settings | **RISK** | Global table, not per workspace. Do not store tenant options here. |
| Session role name `SUPER_ADMIN` | **WARNING** | Same powers as `ADMIN` inside one tenant. Not a cross-tenant bypass today, but the name will be misread in a SaaS UI. |

No **BLOCKER** was found that lets tenant A read tenant B through the admin services reviewed. The warnings are missing tenant columns on child tables and the global settings table.

Device bearer routes resolve the device first, then its `tenantId`. That path stays as it is.

---

## 9. Admin Panel

Navigation in `src/components/desktop-sidebar.tsx` matches the current information architecture. The sidebar label is Activity; the route is `/admin/logs`.

| Area | Current | CRUD | Permission | UX gap |
|---|---|---|---|---|
| Dashboard | Counts of devices, contents, playlists | Read | Page: session only. API `view_dashboard` | No onboarding. Tenant shown as an id, not a name, in the mobile nav comment path. |
| Devices | List, presence, pair, assign playlist | Create, update, delete via API | API `manage_devices`. Page: any role | Sidebar visible to viewers. |
| Device groups | Group membership | Create, update, delete | API `manage_devices` | Same |
| Contents | Logical items, types, duration | Create, update, delete | API `manage_contents` | Type list is wider than the SaaS MEDIA/NOTICE split (see section 15). |
| Media | Library, usage, upload, dedup | Create, delete | API `manage_contents` | No separate media permission. |
| Playlists | List and editor: order, duration, transition, fit | Create, update, delete, reorder | API `manage_playlists` | Both fit options now share one label. |
| Schedules | Targets and windows | Create, update | API `manage_schedules` | Confirm delete coverage in the UI before calling it complete. |
| Users | List, invite/edit for admins | Create, update | Page: `ADMIN` or `SUPER_ADMIN`. API `manage_users` | Password-only accounts. No invite link. |
| Activity | Last 100 rows for the tenant | Read | Page: any session. API permission `view_logs` is not what the page calls | No filters. Login and logout are not written. |
| Settings | Read-only env echo | Read | Any session | Placeholder. Not workspace settings. |

Redesign priority after auth: hide nav by permission, show workspace name, empty states for a new workspace. Do not redesign the Player.

---

## 10. Media Domain

`media_assets` is the physical file: name, MIME, size, storage provider, storage key, URL, dimensions, `durationMs`, SHA-256 `checksum`.

Dedup is `(tenantId, checksum)`. Preserve it. A second upload of the same bytes in the same workspace reuses the asset.

`content_assets` links a content id to a media asset id with a `role` (default `primary`).

MIME `image/gif` is accepted by the content/media services. There is no content type named `GIF`. A GIF is an image file behind an `IMAGE` content, unless a later phase splits it. Do not add an HTML/Experience runtime here.

Production storage is R2 (`MEDIA_STORAGE_PROVIDER`). Local disk and Google Drive remain code paths. Drive credentials are a service account (`GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID`). They are not the login client.

---

## 11. Content Domain

`contents` is the logical item: `type`, `title`, `status`, JSON `payload`, `durationMs` (default 10000), `version`, optional validity window, `tenantId`.

Current types in code: `IMAGE`, `VIDEO`, `TEXT`, `NOTICE`, `EVENT`, `NEWS`, `QR_CODE`, `CLOCK`.

Product split to document, not to migrate now:

| Group | Types |
|---|---|
| MEDIA | `IMAGE`, `VIDEO`, and GIF files stored as image assets |
| NOTICE | `NOTICE`. `TEXT`, `EVENT`, `NEWS`, `QR_CODE`, and `CLOCK` already exist and should stay valid for current playlists. |
| Future | `EXPERIENCE` (HTML/CSS/JS). Out of scope. No runtime work in that direction in this programme until a later decision. |

Duration on the content is the default. A playlist item may override it.

---

## 12. Playlist Domain

```text
Playlist
  → PlaylistItem (position, durationOverrideMs, active, transition, fitMode)
    → Content
      → ContentAsset
        → MediaAsset
```

Confirmed in `playlist_items` and the editor (`playlist-builder.tsx`):

- Ordering is `position`, with drag-and-drop in the editor.
- Duration override in seconds in the UI, stored as milliseconds. Empty override uses the content duration. `0` means natural length for video.
- Transition and fit are saved on the item.
- Preview exists (`playlist-timed-preview.tsx`).
- Create, update, delete, and reorder go through playlist services and are activity-logged.
- Distribution is not a field on the playlist. Devices and schedules point at a playlist. Pairing assigns "Playlist Padrão" when a device has none.

Publishing is implicit: saving a playlist bumps versions for linked devices through the existing playlist service. There is no separate publish button.

---

## 13. Presentation

Stored on the playlist item, column `fit_mode` (default `black`).

UI label "Ajuste do conteúdo":

| Stored value | Label now | Runtime |
|---|---|---|
| `black` | Slide inteiro, fundo preto | Contain on black. Confirmed on Hisense v0.1.16. |
| `adaptive` | Same label | The blurred second copy was removed. Both values render as contain on black. |

Recommendation: keep presentation on `PlaylistItem`. The same content can sit in two playlists with two framings. Do not move `fitMode` onto `Content`.

Do not add new fit modes until the Hisense player can render them. `adaptive` should stay an alias of `black` or be retired in a later UX phase, not reintroduced as a cover image.

---

## 14. Transitions

Stored on the playlist item, column `transition` (default `fade`). The domain constant `TRANSITIONS` lists `fade`, `slide`, `cut`. The editor actually saves `fade`, `slide-left`, `zoom`, `cut`. There is no stored duration, direction, or easing. Timings are fixed in CSS.

| Transition | React Player | Legacy static player (`tv.js`) | Hisense v0.1.16 | Safe to offer |
|---|---|---|---|---|
| `fade` | Opacity class `player-slide-fade` | CSS class exists; image slides in v0.1.16 are drawn without that class | Not relied on for the confirmed layout | Yes, as the default, if the player actually applies it |
| `cut` | Skips the 280ms fade | Class `cut` disables animation | Instant replace is safe | Yes |
| `slide-left` | Class name only if CSS defines it | CSS animation in `tv.html`; not applied on the current image path | Not part of the confirmed playback | No, until both players apply it |
| `zoom` | Same | CSS exists; not applied on the current image path | Not confirmed | No |
| `slide` (domain enum) | Not in the editor | Falls through to fade-in | Untested as a distinct effect | Do not add |

No new effects. A later phase should make the editor list match what both players apply, starting with `cut` and `fade` only.

---

## 15. Content Types

See section 11. GIF is a file type, not a content enum. Experience/HTML is future and out of this foundation's implementation phases until phase G is explicitly extended. It is not in phases A–F.

---

## 16. SaaS Onboarding

Not implemented. Proposed path:

```text
Google login
  → first login (no membership)
  → create workspace (name → tenants.name and slug)
  → workspace created
  → dashboard
  → create first device
  → pair
  → upload media
  → create content
  → create playlist
  → assign / the existing default playlist already attaches on pair
```

Empty states on Dashboard, Devices, Media, and Playlists are the UX dependency. The current dashboard assumes data.

Returning user with one membership skips creation and opens that workspace. Several memberships: chooser, then set the session `tenantId`.

---

## 17. Google Cloud Configuration

Configure later, in Google Cloud Console. Do not create the client during the audit.

1. Branding: app name **Vitrine360**.
2. Support email: the operator's address. **NOT DOCUMENTED** in the repo.
3. Audience: external, testing mode until the consent screen is verified. Production users who are not test users cannot sign in while the app is in testing.
4. Contact information: same support email plus a privacy policy URL on the production domain before verification.
5. Data access: scopes `openid`, `email`, `profile` only. Do not enable Drive, Gmail, Calendar, Contacts, or Sheets.
6. OAuth client type: Web application.
7. Authorized JavaScript origins, if the Google client requires them: `https://vitrine360-psi.vercel.app` and `http://localhost:3000`.
8. Authorized redirect URI, production: `https://vitrine360-psi.vercel.app/api/auth/google/callback`.
9. Authorized redirect URI, local: `http://localhost:3000/api/auth/google/callback`.
10. This callback path is a plan. It is not in the code today.

`NEXT_PUBLIC_APP_URL` is `http://localhost:3000` in `.env.example`. Production must use the Vercel origin, not a guessed host.

---

## 18. Vercel Environment Variables

Names below are the ones the code reads, plus the two new names to add when Google login is implemented. No values.

| Variable | Purpose | Server / client | Secret | Environment |
|---|---|---|---|---|
| `AUTH_SECRET` | Signs `v360_session`. Minimum 32 characters. | Server | Yes | Production, and local |
| `GOOGLE_CLIENT_ID` | OAuth client id. Not in code yet. | Server | No (still do not publish casually) | Production and local when phase A starts |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret. Not in code yet. | Server | Yes | Production and local when phase A starts |
| `NEXT_PUBLIC_APP_URL` | Absolute origin for links. Already in `.env.example`. | Client and server | No | Production: the real origin |
| `DATABASE_URL` | Turso / libSQL | Server | Yes | Production |
| `DATABASE_AUTH_TOKEN` | Database auth | Server | Yes | Production |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Aliases if `DATABASE_*` is absent | Server | Yes | Production |
| `MEDIA_STORAGE_PROVIDER` | `r2` in production | Server | No | Production |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT` | Object storage | Server | Secrets: key and secret | Production |
| `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | Optional Drive storage. Not login. | Server | Yes | Only if that provider is selected |
| `HEARTBEAT_OFFLINE_AFTER_MS` | Presence window | Server | No | Production |
| `MAX_UPLOAD_BYTES` | Upload cap | Server | No | Production |

Do not put the Google secret in `NEXT_PUBLIC_*`.

---

## 19. Database Migration Plan

Non-destructive.

| Existing | Action |
|---|---|
| Users | Keep. Add nullable `passwordHash` only when a Google-only user must be inserted. Existing hashes stay. |
| Identity | Add `identities`. Link `provider=google` and the Google subject to `users.id`. |
| Tenant | Keep every row. UI may call it Workspace. |
| Membership | Add table. Backfill from `users.tenantId` and `users.role`. |
| Devices, playlists, contents, schedules, media | No rewrite. Foreign keys stay on `tenants.id`. |
| Sessions | No session table today. JWT stays. Optional later: session id for revocation. |

Order:

1. Add `identities` and `memberships`.
2. Backfill memberships.
3. Deploy code that reads membership but still writes the old user columns.
4. Only then allow a user with more than one membership.
5. Never drop `users.tenantId` in the same release as Google login.

Existing local admin (`admin@vitrine360.local` in production smoke notes) keeps password login. Google link is optional for that account.

---

## 20. Security Risks

| Risk | Severity | Note |
|---|---|---|
| JWT not revoked until expiry | Medium | Logout clears the cookie. A stolen cookie works until 12h. Role changes are seen on the next request because `getSession` reloads the user. |
| `passwordHash` required | Medium for Google users | Insert will fail until the column is nullable or a placeholder is forbidden. Prefer nullable plus identities. |
| Email match auto-link | High if done blindly | Same email in two tenants already exists as a supported case. Never attach Google to all of them. |
| `better-auth` unused dependency | Low | Remove or adopt in a later phase. Do not configure both. |
| Drive scope confused with login | High if mis-configured | Login scopes must not include `drive`. |
| Child tables without `tenantId` | Medium | See section 8. Fix writes in phase B/C, not by a destructive migration. |
| Global `system_settings` | Medium when settings become per workspace | Keep heartbeat env on the server. Do not put workspace data in that table. |
| Sidebar without permission checks | Low confidentiality inside one tenant | A viewer can see management screens. APIs reject the mutation. Still a product bug. |
| No login audit | Low | Activity does not record login, logout, or failed login (failed login is a console warning). |

---

## 21. Implementation Phases

Not started.

| Phase | Scope | Touches Player? |
|---|---|---|
| A. Google Authentication | Callback route, identity link, existing cookie. Password login remains. | No |
| B. User + Workspace + Membership | Table, backfill, session chooses active workspace. | No |
| C. RBAC | Enforce current permissions in the UI. Resolve `SUPER_ADMIN` naming. | No |
| D. SaaS onboarding | First-login workspace create and empty dashboard. | No |
| E. Admin UX | Nav by role, workspace name, confirmations already partly present. | No |
| F. Media / content UX | Library and content flows. Keep SHA-256 dedup. | No |
| G. Playlist presentation and transitions | Align editor options with players. No new effects. | Only if a player change is separately approved. Default: editor-only. |
| H. Activity | Login, logout, invite, role change, beside the events already logged. | No |
| I. Usage / plans | Counters on the workspace. No charges. | No |
| J. Billing | Future. No Stripe in this programme. | No |

Suggested build order: A → B → C → D, then E and F. G, H, I wait. J stays future.

Billing touchpoints, not to build: Workspace → plan id → usage (devices, storage bytes, screens) → limits → billing customer. None of these columns exist.

---

## Current validation state (unchanged by this audit)

Software, production, Android physical runtime, and Hisense playback stay as recorded in `docs/OBJECTIVE-STATUS.md`. Android TV Box, HDMI, and Android TV offline reboot stay **NOT TESTED — HARDWARE NOT AVAILABLE**. Final release stays **OPEN**.
