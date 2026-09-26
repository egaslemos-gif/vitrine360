# ADR-PLATFORM-IDENTITY-010P — Preview provisioning & live cohort

## Status

Accepted — **BLOCKED** (PI-10P-RESUME: `TURSO_API_TOKEN` still absent; no workaround)

## Context

PI-10O closed ops logic on an isolated local DB but left O1 (no Preview DB on Vercel) and O2 (account-scoped R2 keys). PI-10P was to provision real Preview infrastructure and run a live cohort.

## Decision

1. Never copy Production `DATABASE_URL` / `TURSO_*` / R2 secrets into Preview.
2. Dedicated Preview Turso is mandatory before any live Preview entitlements cohort.
3. SQL database JWT is insufficient for Platform API create-database; require `TURSO_API_TOKEN`.
4. If Platform token is absent → **BLOCKED** (do not simulate live Preview deploy).
5. O2 remains ACCEPTED RESIDUAL RISK until bucket-scoped R2 credentials can be minted; Preview must still use bucket `vitrine360-preview` only.
6. Ship a provisioner script for the unblock path; keep Production `ENTITLEMENTS_ENABLED` UNSET.

## Consequences

- Live Preview OFF/ON cohort remains pending operator Platform token.
- Production activation remains **NOT READY**.
- Next actionable step is operator mint of Turso Platform API token, then re-run provisioner + Preview wiring.

## Production Closure (evidence pointer — decisions above unchanged)

Subsequent controlled Production activation and limited cohort (`egaslemos` + `demo`) were completed under PI-10P operational phases. Formal closure evidence:

- `docs/evidence/platform-identity-10p/PRODUCTION-ENTITLEMENT-PILOT-CLOSURE.md`
- `docs/PLATFORM-IDENTITY-10P.md` — status **PRODUCTION ENTITLEMENT PILOT CLOSED**

This addendum does **not** alter the Preview provisioning decisions above, nor claim general availability.
