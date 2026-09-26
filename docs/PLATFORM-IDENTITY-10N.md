# PLATFORM-IDENTITY-10N — Entitlements Non-Production Activation Readiness

**Status:** **VALIDATED WITH ENVIRONMENT LIMITATION** / superseded by later Preview validation  
**Scope:** Controlled activation readiness for `ENTITLEMENTS_ENABLED=true` in **non-production only**  
**Production:** remains **OFF** (key absent on Vercel production → defaults OFF)  
**Billing / Stripe / commercial UI:** not in scope

## 1. Flag resolution

| Input | Result |
|-------|--------|
| undefined / null | OFF |
| empty / whitespace | OFF |
| `false`, `0`, `maybe`, other | OFF |
| `true`, `1`, `yes`, `on` (case-insensitive) | ON |

Source: server `process.env` only (`src/lib/entitlements-flag.ts`). Request/client values cannot override.

## 2. Staging activation procedure

```
1. Baseline FLAG OFF — capture tenants, usage, plans
2. Plan integrity audit (exactly one ACTIVE TenantPlan; valid values)
3. Assign staging TenantPlans that include devices.max + storage.maxBytes
   (compatibility_default alone is NOT enough — see §3)
4. Set ENTITLEMENTS_ENABLED=true on Preview/Staging only
5. Controlled ops: pair, upload, deny at limit, concurrency
6. Verify existing resources unchanged
7. Set FLAG OFF — verify legacy recovery
8. Never touch Production env
```

## 3. Compatibility plan (PI-10B)

`compatibility_default` binds **only** `devices.enabled=true`.

It does **not** bind `devices.max` or `storage.maxBytes`.

Under fail-closed (flag ON): tenants with only this plan **DENY** quantitative allocation/upload (`ENTITLEMENT_NOT_FOUND`).

**Activation recommendation:** before flipping ON for a staging cohort, assign an explicit technical staging plan with integer/bytes HARD_LIMIT bindings. Do **not** invent commercial Free/Pro SKUs or auto-backfill production.

## 4. Production safety

| Check | Evidence |
|-------|----------|
| Vercel production `ENTITLEMENTS_ENABLED` | **Absent** (filter_project_envs 2026-09-25) → OFF |
| This phase mutates production env | **No** |
| Production deploy | **No** |

## 5. Environment limitation

No dedicated Vercel Preview/Staging target currently holds `ENTITLEMENTS_ENABLED`. Readiness is proven via **controlled local/non-prod simulation** (`scripts/test-platform-identity-10n.ts`) exercising the same code paths.

Remote staging flip remains an ops step following §2 after Preview env exists.

## 6. Evidence

`docs/evidence/platform-identity-10n/` · ADR `docs/adr/ADR-PLATFORM-IDENTITY-010N.md`

## Next

Ops: create Preview env + staging plans → flip ON for cohort → observe → OFF.  
Product: commercial plans / Billing remain later phases — **not** next by default.
