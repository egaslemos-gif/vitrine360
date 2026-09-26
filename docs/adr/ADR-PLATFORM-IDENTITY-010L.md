# ADR-PLATFORM-IDENTITY-010L — Storage Hardening

## Status

Accepted (VALIDATED)

## Context

PI-10K left F4 (unique index ensureSchema masking) and F5 (signed PUT without ContentLength) open.

## Decision

1. Bind exact `ContentLength` (+ `ContentType`) into R2/S3 SigV4 signed PUT URLs.
2. Keep `completeMediaUpload` + provider HEAD as final size authority.
3. Reject `expectedBytes <= 0`; reconcile `actual < reserved` by committing actual and freeing the whole reservation from RESERVED.
4. Diagnose historical checksum duplicates; create unique index only when safe; never auto-delete; surface integrity status explicitly.
5. Leave DEC-STORAGE-07 / DEC-STORAGE-08 OPEN. Do not flip `ENTITLEMENTS_ENABLED`. No production deploy.

## Consequences

- Oversized direct uploads fail at storage edge when Content-Length differs from signed value.
- Browser clients must send matching `Content-Type` and `Content-Length` headers.
- Ops can observe checksum unique integrity without silent false confidence.
