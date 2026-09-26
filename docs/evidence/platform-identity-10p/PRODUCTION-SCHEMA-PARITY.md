# PI-10P — Production Schema Parity

**Date:** 2026-09-25  
**Verdict:** **PRODUCTION SCHEMA PARITY READY**  
**Production flag:** `ENTITLEMENTS_ENABLED` = **UNSET/OFF** (unchanged)

## Hard safety

| Check | Result |
|-------|--------|
| Production DB | `vitrine360` |
| Production host | `libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io` |
| Preview DB | `vitrine360-preview` |
| Preview host | `libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io` |
| Targets distinct | **PASS** |
| Script target guard | Production-only (`scripts/migrate-pi10p-production-schema.ts`) |

## Backup status

| Item | Status |
|------|--------|
| Turso CLI on Windows PATH | ABSENT |
| Turso CLI on WSL Ubuntu | ABSENT |
| Snapshot/dump executed this phase | **NOT AVAILABLE** — not invented |
| Clone Production → Preview | **NOT DONE** (forbidden) |

**BACKUP STATUS:** UNAVAILABLE via local CLI. Migration limited to additive 0007/0008; destructive 0001 not re-executed. Pre/post row counts verified identical.

## Pre-migration inventory

| Item | Value |
|------|-------|
| Tables | 18 |
| Indexes | 35 |
| Journal | ABSENT (`-1`) |
| Entitlement tables | MISSING |
| `storage_reservations` | MISSING |
| `media_assets_tenant_checksum_uidx` | MISSING |
| Duplicate tenant+checksum groups | **0** (index safe) |
| Row counts | tenants 20, users 35, memberships 37, devices 76, media_assets 27, contents 55, playlists 17, schedules 5 |

## Migration source audit

Existing SQL `0000`–`0008` used. No new SQL authored.

| File | Destructive? | Production action |
|------|--------------|-------------------|
| 0000 | no (but UNIQUE on live rows if re-exec) | **baseline recorded** (live schema attested) |
| 0001 | **YES** (`DROP TABLE`) | **baseline recorded** (never re-exec) |
| 0002–0006 | no (re-exec unsafe on live) | **baseline recorded** |
| 0007 | additive CREATE IF NOT EXISTS | **executed** |
| 0008 | additive + checksum uidx | **executed** |

First attempt re-executing 0000 **STOPPED** on `UNIQUE constraint failed: users.email` (correct fail-closed). No data loss. Strategy corrected to execute only 0007/0008.

## Post-migration

| Item | Production | Preview |
|------|------------|---------|
| Tables | **24** | 24 |
| Indexes | 51 | 50 |
| Journal rows | **9** | 9 |
| Journal duplicates | **0** | 0 |
| Entitlement tables | PRESENT | PRESENT |
| `storage_reservations` + `expected_bytes` | PRESENT | PRESENT |
| checksum uidx | PRESENT | PRESENT |
| Column drift (critical tables) | none | — |
| tables_only_* | none | none |

### Journal provenance

- 0000–0006: baseline hashes recorded after structural attestation (SQL not re-executed — required to avoid DROP/UNIQUE damage).
- 0007–0008: SQL executed then journaled.
- Hashes = SHA-256 of repository SQL file bodies (same files as Preview migrator).

### New table row counts (schema-only)

plans=0, entitlement_definitions=0, tenant_plans=0, storage_reservations=0  
No Production cohort, plans, or reservations seeded.

### Data integrity

Pre/post counts identical on all measured existing tables. `count_drift=none`.

## Feature flag

| Env | `ENTITLEMENTS_ENABLED` |
|-----|------------------------|
| Production (Vercel) | **UNSET** (no Production-target key) |
| Preview | `preview` target only (post-cohort false) |
| Local `.env.local` during migrate | UNSET |

## R2

**UNCHANGED.** Account-scoped keys residual remains MEDIUM (out of scope).

## Tests

| Suite | Result |
|-------|--------|
| 10B–10D, 10I–10L | PASS |
| 04 / 05B / 06B / 07 / 09 | PASS |
| typecheck | PASS (exit 0) |
| lint | PASS (0 errors / 90 warnings) |
| build | PASS (exit 0) |

## Findings

| Severity | Item |
|----------|------|
| INFO | 0000–0006 journal entries are baseline-attested (not re-executed) |
| INFO | Index count Prod 51 vs Preview 50 (required objects present) |
| INFO | Turso backup CLI unavailable locally |
| MEDIUM | R2 account-scoped keys (unchanged residual) |

## Release checklist

- [x] Production target confirmed
- [x] Backup/recovery status documented (UNAVAILABLE)
- [x] Migration source audited
- [x] 0007 applied correctly
- [x] 0008 applied correctly
- [x] Journal valid (9 / 0 dup)
- [x] Entitlement tables present
- [x] storage_reservations present (`expected_bytes`)
- [x] checksum unique index present
- [x] No duplicate tenant+checksum
- [x] Preview/Production structural parity PASS
- [x] ENTITLEMENTS_ENABLED remains OFF
- [x] R2 unchanged
- [x] Typecheck / lint / build PASS
- [x] Regression PASS
- [x] Documentation updated

## Commands

```bash
npx tsx scripts/inventory-pi10p-production-pre-migrate.ts
npx tsx scripts/migrate-pi10p-production-schema.ts
npx tsx scripts/review-pi10p-production-readiness.ts
```

## Next (do not execute)

**PI-10P — RE-RUN PRODUCTION READINESS REVIEW**  
Do **not** activate Production entitlements.
