# ADR-002: Media Storage Abstraction

## Decision

Introduce `MediaStorageProvider` interface:

- `GoogleDriveProvider` (MVP when credentials configured)  
- `LocalFsProvider` (dev / fallback for MVP without Drive)  
- Future: `ObjectStorageProvider` (S3/Blob)

Domain stores `storage_provider` + `storage_key` + optional `url`. Business logic never imports Drive SDK directly.

## Why

Spec requires Drive-first MVP without coupling; migration path to object storage.

## Consequences

Local provider for CI/dev; production swaps via env without schema redesign.
