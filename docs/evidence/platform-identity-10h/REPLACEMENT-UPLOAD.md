# REPLACEMENT-UPLOAD — PI-10H

## Current product surface

There is **no** first-class “replace media asset bytes in place” API. Workflow today:

- Upload new asset (new id / or dedupe hit)
- Point content at new `mediaAssetId`
- Optionally delete old asset if unreferenced

## DEC-STORAGE-07 — OPEN (product)

Options for a future replace API:

| Approach | Reservation | Temporary peak |
|---|---|---|
| Reserve `new` fully; commit; then delete old | Safe, simple | Peak = old+new until delete |
| Reserve `max(0, new−old)` | Efficient | Needs atomic replace transaction |
| Overwrite same storageKey | Complex with R2 + checksum uniqueness | Risky |

**Recommendation for PI-10I docs:** default to reserve **full `new`** until product defines in-place replace; do not implement either path in 10H.

Double-count must not persist after successful replace+delete of old.
