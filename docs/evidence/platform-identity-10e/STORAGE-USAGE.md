# STORAGE-USAGE — PI-10E

## Providers today

| Provider | Path | Notes |
|----------|------|-------|
| LocalFs | `services/media/local-fs-provider.ts` | Default |
| Google Drive | `google-drive-provider.ts` | |
| R2 | `r2-provider.ts` | Direct PUT prepare/complete |

Keys typically tenant-scoped (`tenants/{tenantId}/...` on R2).

## Authoritative current storage

**Recommended:** `SUM(media_assets.file_size) WHERE tenant_id = ?`

- Count **logical assets** (DB rows), which already dedupe via unique `(tenant_id, checksum)`.
- Do **not** charge Usage on prepare alone — only after successful `complete` / insert commit.
- Failed / aborted uploads: no row → no usage.
- Delete: hard delete media when unlinked → SUM decreases after DB commit; R2 delete best-effort (reconcile orphans later).

## States (conceptual)

| State | Counts toward storage? |
|-------|------------------------|
| RESERVED (prepare only) | Optional soft reservation — **OPEN** if using reserveQuota |
| UPLOADING | No (until complete) |
| ACTIVE (row exists) | **Yes** |
| FAILED | No |
| DELETED | No |

## Duplication interpretations

| Model | Meaning |
|-------|---------|
| **A Logical** | Each `media_assets` row counts `file_size` | **Chosen** — matches tenant isolation + unique checksum |
| **B Physical** | Shared blob bytes once | Not applicable cross-tenant today; same-tenant dedupe already collapses to one row |

## Consistency (DB vs R2)

| Question | Authority |
|----------|-----------|
| Resource count / storage for quota | **Database** `media_assets` |
| Blob existence | Object store — heal/reconcile jobs |
| Bandwidth | Absent — future CDN/R2 logs → UsageEvent |

Never mark Usage definitive before DB commit of the asset row.
