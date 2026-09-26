# CURRENT-USAGE-AUDIT — PI-10E

## Inventory

| Métrica candidata | Origem atual | Unidade | Escopo | Tenant isolation | Precisão | Temporalidade | Adequada p/ enforcement? |
|-------------------|--------------|---------|--------|------------------|----------|---------------|--------------------------|
| Device rows | `devices` | count | tenant (após pair) | `tenant_id` | Exact row count | Current | **Yes** after status semantics defined |
| Devices ONLINE | `last_seen_at` + windows | count | tenant | yes | Derived presence | Current ephemeral | Poor for HARD_LIMIT (churn) |
| Media assets | `media_assets` | count / bytes | tenant | `tenant_id` | Exact | Current | **Yes** (bytes via `file_size`) |
| Storage bytes | `SUM(file_size)` | BYTES | tenant | yes | Declared DB size | Current | **Yes** if post-commit only |
| Contents | `contents` | count | tenant | yes | Exact | Current | Optional |
| Playlists | `playlists` | count | tenant | yes | Exact | Current | Optional |
| Schedules | `schedules` | count | tenant | yes | Exact | Current | Low priority |
| Experiences packages | in-memory `experience-package-store` | count | tenant key | process-local | **Not durable** | Ephemeral | **No** until persisted |
| Experience content refs | `contents` type EXPERIENCE | count | tenant | yes | Exact | Current | Partial |
| Uploads | activity `media.uploaded` | events | tenant | yes | Audit only | Historical | **No** as authority |
| Heartbeats | `last_seen_at` / `player_state` | presence | device | yes | Latest | Current | Not quota |
| Sync / bandwidth | player sync engine | — | client | — | Not server-metered | — | **Absent** |
| API rate | `rate-limit.ts` | requests | IP bucket | **not tenant usage** | In-memory | Window | Not entitlement usage |
| Per-file upload cap | `MAX_UPLOAD_BYTES` (50MiB) | bytes | request | — | Hard cap | Per upload | Not tenant quota |
| Package limits | experience validator `storageBytes` | bytes | package | — | Manifest | Package | Not tenant plan |

## Explicit non-sources

- **Activity log** ≠ Usage authority.
- **UI `.length` filters** ≠ enforcement.
- **Playlist “in use” counts** are UX joins, not plan meters.

## Gaps

1. No `Usage*` tables.
2. No `SUM(file_size)` service for tenants.
3. No bandwidth egress accounting (R2/CDN).
4. Experiences not durable for quotas.
5. PENDING devices have `tenant_id=null` — must not count until paired.
