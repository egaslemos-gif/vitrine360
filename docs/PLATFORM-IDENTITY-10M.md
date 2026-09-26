# PLATFORM-IDENTITY-10M — Storage Decision Closure

**Status:** VALIDATED  
**Phase type:** DECISION + ARCHITECTURE ONLY  
**Code / schema / API / upload / enforcement:** **unchanged**  
**Flag:** `ENTITLEMENTS_ENABLED` remains OFF  
**Deployment:** none

## Objective

Close the two remaining open product decisions from PI-10H:

| ID | Topic | Prior status | This phase |
|----|--------|--------------|------------|
| DEC-STORAGE-07 | Replacement accounting | OPEN | **CLOSED** |
| DEC-STORAGE-08 | Reservation TTL | OPEN | **CLOSED** |

Preserved closed decisions (not reopened): DEC-07 (reservation required), DEC-STORAGE-01 (DB committed authority), DEC-STORAGE-04 (dedupe once), DEC-STORAGE-10 / DEC-08 (BLOCK NEW + ALLOW EXISTING), PI-10L ContentLength + HEAD authority.

---

## DEC-STORAGE-07 — Replacement — CLOSED

### Decision

**MODEL A — Delta reservation with stable MediaAsset identity (in-place logical replace).**

When replacing existing asset **A** with candidate **B**:

```
reserveBytes = max(0, size(B) - size(A))
```

Quota check (inside `withTenantAllocationLock`):

```
committed + activeReserved + reserveBytes  ≤  storage.maxBytes
```

While A remains committed, this is equivalent to:

```
(committed - size(A)) + size(B) + otherReserved  ≤  max
```

**MediaAsset.id stays stable.** Object key may change; DB row is updated after B is validated. ContentAsset / Content / PlaylistItem references keep working without FK rewrite.

### Recommended flow (future implementation — not built in PI-10M)

```
1. Auth + RBAC + tenant operable + entitlement
2. Load A (tenant-scoped); fail if missing
3. reserveStorage(operationId=media.replace:{assetId}:{nonce}, expectedBytes=delta)
     — if delta=0, skip reserve (shrink / same size)
4. storage.put / signed PUT for B (ContentLength bound to size(B) when direct)
5. HEAD → actualBytes; fail-closed if unknown or actual > size(B) intent / reservation math
6. Allocation lock + TX:
     - UPDATE media_assets SET file_size, storage_key, checksum, … WHERE id=A AND tenant_id=…
     - finish reservation (release if delta reserved; committed grew via file_size)
7. Best-effort delete previous object if storage_key changed
8. Activity log
```

### Scenario analysis

#### quota=100, A=40, B=70

| Phase | committed | reserved | effective |
|-------|-----------|----------|-----------|
| Before | 40 | 0 | 40 |
| After reserve delta=30 | 40 | 30 | 70 ≤ 100 → ALLOW |
| After DB update to B | 70 | 0 | 70 |
| A counting | Stops when file_size updated (same row) | | |

Crash after PUT before DB: A intact (40); orphan B object; reservation expires (DEC-STORAGE-08).  
B invalid / HEAD fail: release reservation; delete orphan B if present; **A preserved**.  
Delete old object fails after DB update: logical asset is B; physical orphan old key → GC later; **quota correct** (DB authority).

#### quota=100, A=40, B=80

| Phase | effective |
|-------|-----------|
| Reserve delta=40 | 40+40=80 ≤ 100 → **ALLOW** |
| Final | committed=80 |

#### quota=100, A=40, B=70 vs full-reserve MODEL B

MODEL B would reserve 70 while A still counts → effective 110 > 100 → **false DENY**. Rejected.

### Content references

```
MediaAsset (stable id)
  ← content_assets.media_asset_id (ON DELETE CASCADE)
      ← contents
          ← playlist_items.content_id
```

Stable MediaAsset id preserves Content and Playlist links. Creating a new MediaAsset id would require rewriting `content_assets` and risk CASCADE if old row deleted first — **rejected as default**.

### Dedupe

`UNIQUE(tenant_id, checksum)` remains. If B’s checksum already belongs to **another** asset in the same tenant: conflict / refuse replace (or future product: retarget to existing asset without upload). Never share cross-tenant.

### Concurrency

Same-tenant replace serialized by `withTenantAllocationLock(tenantId)`. Concurrent replaces of same asset: second re-reads current size after lock. Cross-tenant independent.

### Rejected alternatives

| Model | Why rejected |
|-------|----------------|
| **B — Reserve full B then delete A** | Over-denies when A+B>max but B≤max; brief double-commit if insert-then-delete without credit |
| **C — Upload without reservation** | Violates DEC-07; race over-allocation |
| New MediaAsset id as default | Breaks/complicates ContentAsset; CASCADE hazard |

### Consequences

- Future replace API must use delta reserve + stable id.
- No first-class replace API in this phase.
- Orphan GC still out of scope (DEC-STORAGE future / not 07).

---

## DEC-STORAGE-08 — Reservation TTL — CLOSED

### Decision

**HYBRID: Lazy expiry is mandatory and sufficient for correctness; scheduled worker is optional capacity optimization (not required for quota safety).**

### Lifecycle

```
RESERVED
   │  expiresAt < now (server UTC)
   ▼
EXPIRED   (optional observability mark)
   │
   ▼
RELEASED  (capacity freed; active reserved excludes both EXPIRED and RELEASED)

Also valid (already in domain): RESERVED → RELEASED directly (lazy path).
Invalid: COMMITTED/RELEASED → RESERVED; EXPIRED → COMMITTED.
```

### TTL parameters (normative for future code)

| Parameter | Value | Authority |
|-----------|--------|-----------|
| Default TTL | **900 seconds** | Align with signed upload URL (PI-10L) |
| Maximum TTL | **3600 seconds** | Server clamp; never trust client |
| `expiresAt` | `now_utc + TTL` ISO-8601 | **Server only** |
| Clock | UTC (`Date` / ISO Z) | App server at reserve time |
| Client `expiresAt` / `reservedBytes` / status | **Forbidden** | |

Prepare already uses ~900s (PI-10K/L). Close that as the **default**.

### Cleanup model

| Mode | Role |
|------|------|
| **A. Lazy expiry** | **REQUIRED.** On `reserveStorage` (and recommended on complete/lookup): if `status=RESERVED` and `expiresAt < now`, transition to RELEASED (or EXPIRED then RELEASED). Frees stuck capacity without a daemon. |
| **B. Scheduled worker** | **OPTIONAL.** Future Vercel Cron / external scheduler calling tenant-scoped expire+release batch. Improves recovery when a tenant has no further reserves. |
| **C. Periodic reconciliation** | Subsumed by B for reservations; object GC separate. |
| **D. Hybrid** | **ADOPTED** = A mandatory + B optional. |

### Serverless constraints (Vercel)

Do **not** rely on: long-lived process, `setInterval`, single-process memory, in-process EventEmitter as scheduler.

Lazy cleanup runs inside existing request paths (reserve/complete) — **compatible with serverless**.

Future worker placement (if implemented): **Vercel Cron** hitting an authenticated internal/admin route, or external cron → same service functions. Must be idempotent and tenant-scoped.

### Commit / revive rules

- **Expired (or overdue RESERVED past expiresAt) must not COMMIT.**
- complete/upload must not revive an expired row; use new `operationId` / fresh reserve.
- Double release remains idempotent.
- Abandoned browser upload: reservation holds until TTL then lazy/worker release; object may be orphan (not quota).

### Security

- `expiresAt` server-set only  
- No client status transitions  
- `operationId` + `tenantId` ownership unchanged  
- Worker (if any) must not cross tenants without authz  

### Rejected as sole strategy

| Option | Why not sole |
|--------|----------------|
| Worker-only | Serverless miss / cron gap leaves sticky RESERVED until deploy fix |
| Lazy-only forever without documented optional worker | OK for correctness; hybrid documents ops path for stranded tenants |
| Client-supplied TTL | Trust boundary violation |

### Consequences

- PI-10K lazy RELEASE on reserve remains the correctness backbone — **ratified**.
- Future worker is enhancement, not a blocker for entitlements enablement.
- Exact defaults: 900s / max 3600s.

---

## Production impact

| Item | Impact |
|------|--------|
| Production code | **None** |
| Schema | **None** |
| APIs / upload / enforcement | **None** |
| ENTITLEMENTS_ENABLED | **OFF** (unchanged) |
| Deployment | **None** |
| Behaviour today | Unchanged; decisions bind future implementers |

## Evidence

`docs/evidence/platform-identity-10m/` · ADR `docs/adr/ADR-PLATFORM-IDENTITY-010M.md`

## Open decisions after PI-10M

None for storage quota product params previously marked OPEN (07/08).

Still out of scope (not “open DEC-STORAGE-07/08”):

- Object GC / orphan reconciliation implementation  
- First-class replace API implementation  
- TTL worker implementation  
- Billing  

## Next

Implementation phase only when product schedules replace API and/or cron worker — **not** Billing.
