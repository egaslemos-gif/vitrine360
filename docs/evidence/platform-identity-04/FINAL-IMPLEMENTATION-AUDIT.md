# PLATFORM-IDENTITY-04 — FINAL IMPLEMENTATION AUDIT

**Date:** 2026-09-23  
**Auditor role:** Independent verification of prior VALIDATED claim  
**Scope:** Read-only inspection of code, schema, migration, tests, docs  
**Actions taken:** No production code/schema/JWT/session/API/UI changes. Temporary inspect helper removed after PRAGMA inspection.

---

## Verdict

**PLATFORM-IDENTITY-04 — VALIDATED (CONFIRMED)**

Technically sustainable as a **foundation-only** gate. Residual items are **PARTIAL** caveats, not acceptance blockers for PI-04 scope.

---

## Claim vs evidence matrix

| Claim (prior report) | Verdict | Evidence |
|----------------------|---------|----------|
| Feature flag exists, default false | **PASS** | `src/lib/platform-identity-flag.ts`; undefined/empty → false; `.env.example` documents OFF |
| Flag server-side only / not user-controlled | **PASS** | No API/UI wiring; `resolvePlatformIdentityFlagFromTrustedEnvOnly` ignores request-derived values; SEC-PI04-001 in suite |
| `platform_assignments` schema exists | **PASS** | `src/db/schema.ts`; live PRAGMA confirms table/FKs/indexes |
| Platform role ≠ tenant role | **PASS** | `PLATFORM_ROLES` vs `USER_ROLES`; `SUPER_ADMIN` not in platform enum; no platform import in `memberships.ts` / `auth.ts` |
| Status ACTIVE/SUSPENDED/REVOKED | **PASS** | Domain + repository; findActiveByUser filters ACTIVE |
| Integrity constraints | **PASS** (app+DB unique) / **PARTIAL** (no SQL CHECK on role/status) | UNIQUE `(user_id, role)`; FK user CASCADE; role/status validated in TS only (same pattern as memberships) |
| Migration additive, no SUPER_ADMIN backfill | **PASS** | `drizzle/0006_platform_identity.sql` has only CREATE; `ensureSchema` creates table without INSERT from memberships |
| Seed unchanged / no silent promotion | **PASS** | `scripts/seed.ts` has zero platform references |
| JWT / session / auth unchanged | **PASS** | `auth.ts` has zero platform references; claims remain sub/email/name/role/tenantId/activeTenantId |
| No Platform UI / APIs | **PASS** | No `src/app/api/platform`; no app imports of platform-identity outside db/domain/lib/services |
| No Billing / Entitlements / Campaigns / Live Media | **PASS** | No such modules introduced |
| Repository exists, not wired to authz | **PASS** | `src/services/platform-identity.ts`; not imported by auth/API/UI |
| Flag ON ≠ automatic access | **PASS** | Suite proves session role stays tenant ADMIN with active platform assignment |
| Existing SUPER_ADMIN remains tenant-scoped | **PASS** | Suite fixtures A/C; seed admin check |
| Explicit Platform fixture | **PASS** | `platform-admin-*@pi04.test` separate from seed admin |
| Security tests PASS | **PASS** | Suite implements SEC-PI04-001…010 |
| Full regression PASS | **PASS** | Documented in REGRESSION.md; suite included in `npm test` |
| Drizzle journal tracks 0006 | **PARTIAL** | `_journal.json` still only 0000–0002 (pre-existing lag); runtime relies on `ensureSchema` + SQL file (consistent with 0003–0005 pattern) |
| “Observably identical when flag OFF” | **PASS** for authz/API/UI; **PARTIAL** for DDL | Empty `platform_assignments` table may exist via `ensureSchema` even when flag OFF — additive, not behavioural privilege change |
| Re-grant after REVOKED | **PARTIAL** | UNIQUE `(user_id, role)` blocks second INSERT; must UPDATE status — correct for “one row per role”, not tested as re-activate path |
| SEC Device/Experience cannot create Platform | **PASS** with **PARTIAL** depth | Proven by absence of imports/routes (static), not runtime Device Bearer call attempting create |

---

## Schema inspection (live DB)

Confirmed via `PRAGMA table_info` / `foreign_key_list` / `sqlite_master`:

| Aspect | Finding |
|--------|---------|
| PK | `id` TEXT |
| Columns | user_id, role, status (default ACTIVE), created_by_user_id nullable, created_at, updated_at |
| `tenant_id` | **Absent** (global platform scope) |
| FK user_id → users | ON DELETE CASCADE |
| FK created_by_user_id → users | ON DELETE SET NULL |
| Unique | `(user_id, role)` |
| Indexes | user, status, unique user+role |
| SQL CHECK role/status | **None** (application validation) |

Model fidelity:

```text
User
├── platform_assignments (0..N)  → role + status   [global]
└── memberships (0..N)           → tenant role     [tenant-scoped]
```

**PASS** — matches PI-02 dual-axis and PI-03 additive plan naming flexibility (`platform_assignments` ≈ planned `platform_role_assignments`).

---

## Alignment to prior phases

| Source | Alignment |
|--------|-----------|
| PI-01 | Separate platform axis; SUPER_ADMIN ≠ platform — **PASS** |
| PI-02 | Minimum PLATFORM_SUPER_ADMIN; no platformRole on Membership — **PASS**; other platform roles deferred — expected |
| PI-03 | Flag OFF default; additive; zero backfill; JWT thin; authz later — **PASS** |
| PI-04 spec | Foundation only; no UI/API/JWT/authz/Billing — **PASS** |
| ARCHITECTURE-FUTURE | Control Plane; not Device/Experience/Playback — **PASS** |

---

## Residual risks (PI-03) — re-checked

| Risk | Blocker for PI-04? | Notes |
|------|--------------------|-------|
| `tenants.status` | NO | Untouched by PI-04 |
| seed | NO | Still tenant SUPER_ADMIN only |
| `/x/` | NO | No platform coupling |
| login home | NO | auth/JWT unchanged |

---

## Gate sustainability

**Validated claim is sustainable** because:

1. Dual-axis persistence exists and is isolated from Membership.  
2. Feature flag defaults OFF and gates repository.  
3. No privilege path consumes platform assignments yet.  
4. No automatic promotion.  
5. Auth/JWT/Device/Experience surfaces remain free of platform wiring.

**Before PI-05**, address PARTIALs as engineering hygiene (not PI-04 re-openers): journal entry for 0006, optional SQL CHECK, documented re-activate-after-revoke via status UPDATE, stronger runtime SEC probes if desired.

---

## Forbidden during this audit (confirmed not done)

No PI-05 implementation. No schema/JWT/session/RBAC/API/UI/login/`/x`/Device Bearer/Experience/Playback/deploy changes as part of this audit.
