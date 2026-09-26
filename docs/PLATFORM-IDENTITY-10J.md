# PLATFORM-IDENTITY-10J — Storage Quota Enforcement

**Status:** VALIDATED  
**Entitlement:** `storage.maxBytes` (HARD_LIMIT, BYTES)  
**Flag:** `ENTITLEMENTS_ENABLED` (default OFF)

## Flow

```
Auth → RBAC → lifecycle
  → resolveEffectiveEntitlements(storage.maxBytes)
  → reserveStorage (committed+reserved+requested ≤ max)
  → storage put
  → validate actual ≤ reserved
  → INSERT media_assets + commit reservation
```

Flag OFF → legacy (no reserve). Dedupe hit → no new reservation. Fail-closed when ON and entitlement/plan missing.

## Open (unchanged)

DEC-STORAGE-07 replacement · DEC-STORAGE-08 TTL worker

## Evidence

`docs/evidence/platform-identity-10j/` · ADR `docs/adr/ADR-PLATFORM-IDENTITY-010J.md`
