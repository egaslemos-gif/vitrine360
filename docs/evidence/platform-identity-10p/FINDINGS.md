# PI-10P Findings — Preview OFF Baseline

## Real findings

1. **Vercel Git collaboration BLOCKED** GitHub-linked Preview deploys. Mitigated with CLI deploy from staged tree (no `.git` meta). Not a Production risk.
2. **R2 keys are account-scoped.** Preview isolation relies on bucket `vitrine360-preview` vs Production bucket env target — not separate Cloudflare accounts.
3. **Presigned PUT via Node `fetch` returned 403** (signed Content-Length). OFF media baseline used multipart `POST /api/admin/media` (server-side R2 put). Prepare still issued upload URL under OFF without quota DENY.
4. **Production lacks `__drizzle_migrations` table** (pre-existing; 18 tables). Preview has 9 journal entries. No Production migration run in this subgate.

## Non-findings

- No Production env mutation.
- No Production entitlement activation.
- No Preview → Production DB leakage (`/api/health` host proof).
