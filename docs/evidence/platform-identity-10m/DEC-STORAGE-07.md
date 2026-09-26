# DEC-STORAGE-07 — Decision Record

## Decision

**CLOSED — MODEL A: Delta reservation with stable MediaAsset identity.**

`reserveBytes = max(0, size(B) - size(A))`  
MediaAsset.id unchanged; object may swap; ContentAsset/Playlist refs preserved.

## Context

No first-class replace API today (PI-10H). Upload is multi-step across DB and object storage. DEC-07 requires reservation before HARD_LIMIT growth. Content links MediaAsset via `content_assets` with `ON DELETE CASCADE`.

## Options

| ID | Model | Summary |
|----|--------|---------|
| A | Delta reserve | Reserve growth only; A still committed until update |
| B | Full B then delete A | Reserve size(B) while A counts |
| C | Upload then reconcile | No pre-reserve |

## Security impact

- Tenant-scoped load of A and reserve/operationId
- No client `reservedBytes` / expiry / status
- Stable id avoids CASCADE wipe of Content links on naive delete-A-first

## Quota impact

Effective during replace (B ≥ A): `committed + max(0,B−A) = …` peaks at max(A’s peers + B).  
Does not require A+B ≤ max.  
MODEL B falsely denies when A+B > max but B ≤ max.

## Operational impact

- Future API only; no ops change now
- Possible orphan objects on crash → GC later (not this DEC)

## Failure behaviour

| Failure | Outcome |
|---------|---------|
| Reserve deny | A unchanged |
| PUT / HEAD / validation fail | Release reservation; A unchanged; optional delete orphan B |
| DB update fail after PUT | A unchanged; orphan B; reservation released or TTL |
| Delete old object fail after success | Logical B OK; physical orphan; quota DB-correct |

## Recommended model

**A**

## Rejected alternatives

- **B:** over-deny; double-count risk on insert-then-delete  
- **C:** violates DEC-07; race over-allocation  

## Consequences

Bind future replace implementation; PI-10M does not ship code.
