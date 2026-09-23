# Security & production readiness — audit report

Date: 2026-09-16  
Scope: Vitrine360 MVP hardening (no new product features)

## 1. What was audited

- Multi-tenant isolation (contents, playlists, devices, groups, schedules, media)
- Admin auth (bcrypt, JWT cookie, DB revalidation, logout)
- Device pairing / claim / token expiry / disable / rotate
- Player credentials surface (device token only)
- Offline sync (CURRENT/NEXT, checksum, incomplete activate)
- Service Worker shell cache versioning
- Media uploads (path traversal, magic-byte MIME)
- API error handling (no stack/secret leakage)
- Drizzle schema constraints & device token columns
- Docs: README, ACCEPTANCE, android-tv checklist, architecture ADRs

## 2. Issues found

| Severity | Issue |
|----------|--------|
| P0 | Device claim by `deviceId` alone (token theft race) |
| P0 | Unauthenticated `GET /api/media/*` |
| P0 | Path join for uploads without safe root resolve |
| P1 | Group/schedule assign without playlist tenant check |
| P1 | MIME trusted from client without magic sniff |
| P1 | Login form prefilled with seed credentials |
| P1 | Sync activate without verifying all assets present |
| P2 | ESLint flat-config broken (Next 16) |
| P2 | TypeScript 7 incompatible with eslint tooling |

## 3. Issues fixed

- Pairing: `pairingSecret` at `pair_start`; claim requires secret; one-shot token issue
- Media GET: admin session or device Bearer + tenant ownership
- `resolveUnderRoot` + extension sanitisation; magic-byte MIME gate
- Playlist tenant checks on schedules & group assign
- Sync: checksum verify + `canActivateAssetSet` before CURRENT swap; keep previous on failure
- Device disable/rotate API (`PATCH /api/admin/devices/[id]`)
- Login defaults cleared; seed marked DEVELOPMENT ONLY
- SW cache bumped to `vitrine360-shell-v3`
- Security test suite `npm run test:security`
- ESLint flat config + TS 5.9 pin

## 4. Tests run

```text
npm run test          # domain + tenant + security + acceptance
npm run test:tenant
npm run test:acceptance
npm run test:security
npm run typecheck
npm run lint
npm run build
```

## 5. Results

| Gate | Result |
|------|--------|
| test:domain | pass |
| test:tenant | pass |
| test:security | pass |
| test:acceptance | pass |
| typecheck | pass |
| lint | pass (0 errors) |
| build | pass |

## 6. Remaining risks

- Rate limiting not implemented (login / claim / upload)
- Device token rotation UX for field devices is manual
- Google Drive provider still a stub
- Media auth requires Authorization header — browser `<img>`/`<video>` without SW fetch rewrite rely on IndexedDB blobs (intended for Player)
- SQLite single-node; production HA not addressed
- No automated browser E2E in CI for offline SW lifecycle

## 7. Physical Android TV Box validation still required

Software-validated only (PWA `/player` + kiosk path). Still needs on-site:

- Boot → local playback without network
- HDMI output / overscan / keep-screen-on
- Kiosk browser auto-start & crash recovery
- Long offline then reconnect delta sync
- Performance with large video assets

Do **not** claim Android TV production-ready without that hardware pass.  
Checklist: [android-tv-checklist.md](./android-tv-checklist.md)

## 8. Recommendations for next phase (do not auto-start)

1. Rate limits + lockout on auth/claim
2. Optional signed media URLs with short TTL for non-Player clients
3. Hardware Android TV acceptance day
4. Backup/restore + Turso production cutover
5. Observability dashboards (pairing/sync failure rates) without PII/tokens
