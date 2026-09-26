# PI-10O Deployment Evidence

## Production

| Field | Value |
|-------|--------|
| Latest READY | `dpl_ApP66evgkpos6VhKkUjHh2wctwwW` |
| Target | production |
| `ENTITLEMENTS_ENABLED` | UNSET |
| Mutated by PI-10O | No |

## Preview (Vercel)

| Field | Value |
|-------|--------|
| Live Preview deploy OFF | NOT EXECUTED |
| Live Preview deploy ON | NOT EXECUTED |
| Preview URL | N/A (no simulated deployment) |
| `ENTITLEMENTS_ENABLED` | SET = false (target=preview only) |

## Why no live Preview deploy

Preview env has `DATABASE_URL` / `AUTH_SECRET` / R2 keys **NOT SET**. Wiring Production secrets into Preview would violate isolation STOP rules. Spec forbids simulating deployment IDs.

## Local Preview ops harness

| Field | Value |
|-------|--------|
| DB | `data/pi10o-preview.db` |
| Media | `uploads/pi10o-preview` |
| Commit of suite evidence | working tree (this phase) |
