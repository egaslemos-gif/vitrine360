# PI-10O Preview Topology

## Vercel

| Field | Value |
|-------|--------|
| Project | vitrine360 |
| Project ID | prj_fcQMbXzU4QF9VmhuTi9aRWMnX032 |
| Custom envs | none |
| Production `ENTITLEMENTS_ENABLED` | UNSET |
| Preview `ENTITLEMENTS_ENABLED` | SET = false (plain) |
| Preview `DATABASE_URL` | NOT SET |
| Preview `DATABASE_AUTH_TOKEN` | NOT SET |
| Preview R2_* | NOT SET |

## Database

| Env | Namespace | Evidence |
|-----|-----------|----------|
| Production | Turso (production target) | SET (value REDACTED) |
| PI-10O suite | `file:data/pi10o-preview.db` | migrations 0000–0008 applied |
| Vercel Preview | — | NOT SET → not safe for live deploy |

## Storage

| Env | Namespace | Evidence |
|-----|-----------|----------|
| Production | R2 bucket (production target) | SET (name REDACTED in logs; known prod bucket `vitrine360`) |
| Preview namespace | `vitrine360-preview` | created 2026-09-25; probe PUT/HEAD/DELETE OK |
| Suite media | `uploads/pi10o-preview` local | no Production R2 writes |

## Isolation rule

If Preview cannot use a separate DB, STOP — do not point Preview at Production Turso.
