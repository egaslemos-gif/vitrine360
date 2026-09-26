# PI-10P — Preview Vercel + OFF Baseline

**Status:** PREVIEW OFF BASELINE READY  
**Date:** 2026-09-25  
**Production:** `ENTITLEMENTS_ENABLED` = **UNSET / OFF** (unchanged)

## 1. Preview deployment

| Field | Value |
|-------|-------|
| Deployment ID | `dpl_4PZzzQ9LLpR1uYbWMUMFct6xjRgA` |
| URL | `https://vitrine360-ae7x0u4zc-egaslemos-5751s-projects.vercel.app` |
| Environment | Preview (`target=null`, `VERCEL_ENV=preview`) |
| State | READY |
| Project | `prj_fcQMbXzU4QF9VmhuTi9aRWMnX032` (`vitrine360`) |
| Source | CLI deploy (staged tree; GitHub-linked Preview blocked by collaboration) |
| Timestamp (ready) | 2026-09-25T ≈ deploy window |

Production deployment left unchanged: `dpl_ApP66evgkpos6VhKkUjHh2wctwwW` → aliases `vitrine360-psi.vercel.app`.

## 2. Preview DB

- Name: `vitrine360-preview`
- Host: `libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io`
- Journal: 9 entries (migrations 0000–0008)
- Proven live via `/api/health` → `databaseHost=vitrine360-preview-elemos.aws-us-west-2.turso.io`

## 3. Preview storage

- Provider: `r2`
- Bucket: `vitrine360-preview`
- Probe: PUT / HEAD / DELETE OK (Preview bucket only)
- Live media: multipart `POST /api/admin/media` → asset + checksum + storageKey PASS

## 4. Environment isolation

| Variable | Preview | Production |
|----------|---------|------------|
| `DATABASE_URL` | Preview Turso | Production Turso (separate env target) |
| `DATABASE_AUTH_TOKEN` | Preview token | Production token |
| `R2_BUCKET_NAME` | `vitrine360-preview` | Production bucket (separate) |
| `ENTITLEMENTS_ENABLED` | `false` | **UNSET** (no Production key) |
| `AUTH_SECRET` | Preview-only | Production-only |
| `NEXT_PUBLIC_*` | App URL only (no secrets) | unchanged |

Production env vars were **not** mutated in this subgate.

## 5. ENTITLEMENTS_ENABLED=false

Confirmed by Preview `/api/health` → `entitlementsEnabled=false`.  
Device pair, media upload, content/playlist create completed **without** `ENTITLEMENT_DENIED` / `QUOTA_EXCEEDED` / `NO_ACTIVE_PLAN`.

## 6. Baseline tests (OFF)

Script: `npx tsx scripts/baseline-pi10p-preview-off.ts`  
Result: **26/26 PASS** (`off_baseline=PASS`)

| Area | Result |
|------|--------|
| Authentication (login + logout) | PASS |
| Tenant / workspace context | PASS |
| Device list + pair + claim + heartbeat + sync | PASS |
| Content list + create | PASS |
| Media multipart create + prepare (no quota DENY) | PASS |
| Playlist create + associate content | PASS |
| Playback manifest | PASS |
| Quota enforcement OFF | PASS |

Isolation (Preview DB only): `npx tsx scripts/isolate-pi10p-preview.ts` → **PASS**  
Also: `npm run test:tenant` → PASS

## 7. Security checks

| ID | Result |
|----|--------|
| SEC-001 Preview ≠ Production DB | PASS |
| SEC-002 Production secrets not exposed | PASS |
| SEC-003 Preview secrets not in browser/`NEXT_PUBLIC_*` | PASS |
| SEC-004 `DATABASE_AUTH_TOKEN` not logged | PASS |
| SEC-005 `R2_SECRET_ACCESS_KEY` not logged | PASS |
| SEC-006 `AUTH_SECRET` not logged | PASS |
| SEC-007 Preview `ENTITLEMENTS_ENABLED=false` | PASS |
| SEC-008 Production entitlements UNSET/OFF | PASS |
| SEC-009 Device Bearer not logged (PRESENT only) | PASS |
| SEC-010 Tenant isolation | PASS |

## 8. Production integrity

| Check | Result |
|-------|--------|
| DB host | Production Turso host (distinct from Preview) |
| Preview DB | `vitrine360-preview` |
| PI-10P test tenants on Production | **0** |
| Migrations this phase | none against Production |
| Production deployment | unchanged (`dpl_ApP66…`) |
| `ENTITLEMENTS_ENABLED` | UNSET |

Script: `npx tsx scripts/integrity-pi10p-production.ts` → `integrity=PASS`

## 9. Known limitations

1. GitHub-meta Preview deploys remain **BLOCKED** by Vercel collaboration; CLI Preview deploy used.
2. R2 API tokens are account-scoped; isolation is enforced by **bucket name** (`vitrine360-preview` vs Production bucket), not separate Cloudflare accounts.
3. Node fetch of SigV4 PUT with signed `Content-Length` returned HTTP 403; server-side multipart upload path used for OFF media baseline (prepare URL issuance still PASS).
4. Production DB has no `__drizzle_migrations` table (pre-existing); Preview has 9 journal entries — not changed by this subgate.

## 10. Exact next gate

**PI-10P — PREVIEW COHORT ON / ENTITLEMENTS ACTIVATION**

Do **not** activate Production entitlements. Do not migrate Production.
