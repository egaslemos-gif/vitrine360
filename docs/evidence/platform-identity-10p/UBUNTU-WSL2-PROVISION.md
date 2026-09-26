# PI-10P — Ubuntu WSL2 + Preview Turso provision

**Date:** 2026-09-25  
**Verdict:** UNBLOCKED (Preview provisioned; cohort not started)

## WSL

| Distro | State | Version |
|--------|-------|---------|
| Ubuntu | Running | 2 |
| docker-desktop | Stopped | 2 (untouched) |

Ubuntu 26.04.1 LTS under WSL2. User `vitrine` created for non-interactive first boot.

## Turso Cloud CLI

- Installed via `curl -sSfL https://get.tur.so/install.sh | bash`
- Version: `v1.0.32`
- Commands confirmed: `turso auth`, `turso org`, `turso auth api-tokens`
- Auth: `turso auth login --headless` → browser → `turso config set token` (token never logged)
- whoami: `elemos`

## Credentials (presence only)

| Var | Status | Store |
|-----|--------|-------|
| TURSO_ORG | PRESENT | `elemos` (slug only) |
| TURSO_API_TOKEN | PRESENT | `%USERPROFILE%\.turso-pi10p.env` (unversioned) |

Token name: `vitrine360-preview-provisioner` (org-scoped `--org elemos`).

## Preview database

| Field | Value |
|-------|-------|
| Name | `vitrine360-preview` |
| Hostname | `libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io` |
| Region | `aws-us-west-2` |
| Organization | `elemos` |
| Group | `default` |

Wrote gitignored `.env.preview.local` (credentials REDACTED in logs).

## Production (unchanged)

| Field | Value |
|-------|-------|
| Name | `vitrine360` |
| Hostname | `libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io` |
| Region | `aws-us-east-1` |
| Organization | `vercel-icfg-rd8hoku6p0oaszo88ixdwcu4` |

## Isolation

- Preview DB name ≠ Production DB name: **PASS**
- Preview hostname ≠ Production hostname: **PASS**
- Preview org ≠ Production org: **PASS**

## Provisioner

`npm run provision:pi10p-preview-turso` → **SUCCESS** (`database_created=true`)

## Explicitly NOT done (next phase)

- Preview migrations / schema verification
- Vercel Preview env wiring / deploy
- Entitlements ON
- Live cohort (device/storage quota, concurrency, downgrade, suspension, rollback)
- Any Production mutation

## Next step

Resume PI-10P with Preview DB migration and schema verification.
