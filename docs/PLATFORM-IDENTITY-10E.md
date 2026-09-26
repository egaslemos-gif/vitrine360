# PLATFORM-IDENTITY-10E — Usage & Quota Architecture Audit

**Status:** **VALIDATED** (architecture; product decisions closed in later PI-10 phases).  
**Type:** DESIGN ONLY — no quantitative enforcement, no usage tables created, no behaviour change.  
**Depends on:** PI-10A…PI-10D  
**Flag:** `ENTITLEMENTS_ENABLED` remains **OFF** by default (do not activate in this phase).

## Principle

| Dimension | Question |
|-----------|----------|
| RBAC | Who may perform the action? |
| Entitlement | What does the plan allow? |
| Usage | How much is currently / historically used? |
| Quota | What is the numeric limit? |
| Enforcement | What happens at the limit? |
| Billing | What is the commercial relationship? |

These must not be mixed. Payment never grants resource permission directly.

## Current state (audit)

- Entitlements persist Definition → Plan → PlanEntitlement → TenantPlan → EffectiveEntitlements.
- Enforcement pilot: `devices.enabled` FEATURE_GATE only (`pairDevice`).
- **No** usage meters, period counters, `devices.max`, storage SUM enforcement.
- Natural sources exist: `devices` rows, `media_assets.file_size` + checksum dedupe, content/playlist/schedule counts.
- Activity logs are **audit events**, not Usage.
- Experiences package store is in-memory — weak durable meter source today.
- Tenant `SUSPENDED` blocks access; does **not** purge resources or alter entitlement resolution.

## Recommended direction (summary)

1. Model quantitative limits as **EntitlementDefinitions** with `INTEGER`/`BYTES` + `HARD_LIMIT`/`SOFT_LIMIT` (reuse PlanEntitlement), not a parallel Quota table in PI-10F.
2. Prefer **hybrid Usage**: authoritative **derived** reads from resource tables for RESOURCE_COUNT / STORAGE; optional materialized projections later for hot paths; event ledger for temporal bandwidth/ops.
3. Enforce future HARD_LIMIT via **atomic check+write** in the same DB transaction as the mutation (not SELECT-then-INSERT).
4. Storage Usage = **logical unique assets per tenant** (`SUM(file_size)` over `media_assets` rows) given existing `(tenant_id, checksum)` dedupe — physical shared blobs across tenants are out of scope today.
5. Periods: UTC calendar month for future temporal meters unless Billing defines otherwise (**OPEN** if commercial periods differ).
6. Downgrade with usage over new max: **BLOCK NEW**, allow existing (**OPEN** on grace/force).

## Explicit non-goals of this phase

No migrations, counters, `devices.max` wiring, Media/Content/Experience enforcement, Plan UI, Billing, or flag activation.

## Evidence

See `docs/evidence/platform-identity-10e/` and `docs/adr/ADR-PLATFORM-IDENTITY-010E.md`.

## Next

**PI-10F — Usage & Quota Foundation** after resolving critical OPEN decisions in `DECISIONS.md` (especially device count semantics and downgrade policy).
