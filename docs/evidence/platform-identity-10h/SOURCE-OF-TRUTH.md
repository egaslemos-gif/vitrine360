# Source of Truth Matrix (excerpt)

| Estado | DB | R2 / provider | Authority |
|---|---|---|---|
| Upload intent (prepare) | No row today | Signed URL / none | Server session + prepare params |
| Reserved bytes | Future reservation row | — | **DB** (future) |
| Committed asset | `media_assets` | Object should exist | **DB** for quota |
| Physical object | May be absent | Object key | **Provider** for existence |
| Deleted asset | Row gone | Delete attempted | **DB** for quota release |
| Orphan object | No row | Object present | Provider + reconciler; **not** quota |

See USAGE-SEMANTICS.md and R2-CONSISTENCY.md.
