# STORAGE-LIFECYCLE — PI-10H

## Explicit states in code today

**None.** `media_assets` has no status column for upload lifecycle. A row either exists (committed metadata) or does not.

Conceptual mapping of current behavior:

| Conceptual state | Reality today |
|---|---|
| REQUESTED | prepare accepted; signed URL issued; **no DB row** |
| UPLOADING | client PUT in flight; **no DB row** |
| STORED | object exists in provider; still **no DB row** until complete |
| VALIDATED | complete: head + size + MIME sniff |
| COMMITTED / ACTIVE | `media_assets` row inserted |
| FAILED | throw after optional `storage.delete` (bad MIME); prepare abandon leaves blob |
| ORPHANED | blob without row, or row without blob (stale) |
| DELETED | storage.delete then DB delete (if unlinked from contents) |

## Failure paths observed

```
UPLOADING → abandon → physical orphan (no cleanup)
STORED → complete MIME fail → storage.delete → throw
STORED → complete DB fail → physical orphan
COMMITTED → delete blocked if content_assets links exist
COMMITTED → storage.delete OK, DB delete FAIL → physical orphan (commented)
```

## Implication for quota

Without an explicit REQUESTED/RESERVED row, bytes in flight are invisible to `SUM(media_assets.file_size)`. Concurrent completes can overshoot HARD_LIMIT if checked only after persist.
