# ADR-PLATFORM-IDENTITY-010J — storage.maxBytes enforcement

## Status

Accepted (PI-10J)

## Decision

1. Enforce `storage.maxBytes` via `resolveEffectiveEntitlements` + PI-10I `reserveStorage` atomicity.
2. Wire `uploadMediaAsset`, `prepareMediaUpload`, `completeMediaUpload` only.
3. Flag OFF preserves legacy; flag ON fail-closed without inventing defaults.
4. `MAX_UPLOAD_BYTES` remains per-file technical limit, distinct from tenant quota.
5. Entitlement key grammar allows camelCase segments (`storage.maxBytes`).

## Consequences

Uploads under flag ON require ACTIVE TenantPlan with `storage.maxBytes`. Compatibility plans without this binding deny uploads when flag is ON.
