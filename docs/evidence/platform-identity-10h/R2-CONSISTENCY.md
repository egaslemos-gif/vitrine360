# R2-CONSISTENCY — PI-10H

## Observed failure modes

| Case | Sequence | Result today |
|---|---|---|
| A | R2 PUT success → DB insert fail | **Orphan object** |
| B | DB insert success → R2 missing | **Invalid/stale MediaAsset**; heal on next same-checksum upload |
| C | DB delete success after R2 delete | OK |
| C′ | R2 delete fail | **DB retained**; delete aborted (fail-closed for delete) |
| D | R2 delete OK → DB delete fail | **Orphan object** (documented in code comments) |
| E | prepare + PUT, never complete | **Orphan object** |
| F | UNIQUE race loser | Best-effort `storage.delete` of loser’s blob |

## No cross-system transaction

Storage `put`/`delete` and Drizzle inserts/deletes are independent. Quota must not assume atomic R2+DB.

## Authority

| Concern | Authority |
|---|---|
| Quota / committed bytes | **DB** |
| Object existence / GC | **Provider (R2)** + future reconciler |
| Authorization / tenant | **DB + session RBAC** |

## Provider matrix

| Provider | Quota authority | Physical consistency | Notes |
|---|---|---|---|
| LocalFs | DB | Local orphan files possible | Dev |
| GoogleDrive | DB | Drive file id as key | No direct upload |
| R2 | DB | Orphans via abandoned prepare/races | Production target |

Quota domain stays provider-agnostic via `MediaStorageProvider`.
