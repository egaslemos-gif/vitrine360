# PI-10P — Preview Database Migration & Schema Verification

**Date:** 2026-09-25  
**Verdict:** **PREVIEW DB READY**  
**Note:** This is NOT “PI-10P VALIDATED”. Cohort / Vercel Preview / Entitlements ON still pending.

## Prior unlock (not repeated)

| Step | Result |
|------|--------|
| Ubuntu WSL2 | PASS |
| Turso Cloud CLI v1.0.32 | PASS |
| Auth | PASS |
| Provisioning | PASS (`vitrine360-preview` exists) |
| Preview ≠ Production | PASS |
| `npm run provision:pi10p-preview-turso` this phase | **NOT RUN** |

## Target guard

| | Value |
|--|-------|
| Preview host | `libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io` |
| Production host | `libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io` |
| Guard | **PASS** (script refuses Production / mismatched host) |
| Credentials | `DATABASE_URL`/`DATABASE_AUTH_TOKEN` = PRESENT (from `.env.preview.local`, never logged) |

## Migrations applied (Preview only)

Tool: `scripts/migrate-pi10p-preview.ts` → `npm run migrate:pi10p-preview`

| File | Status |
|------|--------|
| `0000_known_leopardon.sql` | applied |
| `0001_stale_mole_man.sql` | applied |
| `0002_mute_captain_america.sql` | applied |
| `0003_friendly_tv_pairing.sql` | applied |
| `0004_slide_fit_mode.sql` | applied |
| `0005_memberships_identities.sql` | applied |
| `0006_platform_identity.sql` | applied |
| `0007_entitlements.sql` | applied |
| `0008_storage_reservations.sql` | applied |

Journal (`__drizzle_migrations`): **9 rows, 0 duplicates → PASS**

Pending: **none**

Note: historic `drizzle/meta/_journal.json` lists only 0000/0001/0002/0008; Preview migrator applies all existing SQL files on disk and records hashes. No new migrations authored.

## Schema validation (read-only)

Tool: `scripts/validate-pi10p-preview-schema.ts`

| Area | Result |
|------|--------|
| Identity (`users`,`tenants`,`memberships`,`platform_assignments`) | PASS |
| Devices (+ groups/members; `device_assignments` legacy) | PASS |
| Content | PASS |
| Distribution | PASS |
| Entitlements (10B tables) | PASS |
| Storage reservations | PASS (`expected_bytes`; not `reserved_bytes`) |
| `media_assets_tenant_checksum_uidx` | PASS (unique) |
| Indexes / FKs / tenant_id structure | PASS |
| Device quota columns (`status`,`tenant_id`) | PASS |
| Preview clean (tenant_rows=0) | PASS |
| `ENTITLEMENTS_ENABLED` Preview | `false` |

## Production integrity

| Check | Result |
|-------|--------|
| Name | `vitrine360` unchanged |
| Host | Production host unchanged |
| Size | **524 kB** unchanged (pre/post) |
| Migrations on Production | **NONE** |
| Cohort data on Production | not created by this phase |
| `ENTITLEMENTS_ENABLED` Production | UNSET/OFF (local + prior Vercel audit) |

## Tests (local file DB `file:./data/vitrine360-mt.db` — not Preview)

| Suite | Result |
|-------|--------|
| 10B–10D, 10I–10L | PASS (exit 0) |
| Regression 04, 05b, 06b, 07, 09 | PASS (exit 0) |
| typecheck | PASS |
| lint | PASS (0 errors; existing warnings) |
| build | PASS |

## Security

- No secrets printed
- Provisioner not re-run
- Preview credentials only for migrate/validate
- Tests forced to local sqlite file

## Next

Resume PI-10P with Preview Vercel environment + OFF baseline.
