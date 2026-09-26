# ADR-PLATFORM-IDENTITY-006B — Platform Tenants API Hardening

**Status:** Accepted  
**Date:** 2026-09-23  
**Phase:** PLATFORM-IDENTITY-06B

## Context

PI-06A found the read stub authorization-safe but PARTIAL on pagination, rate limit, query validation, service boundary, and HTTP cookie tests.

## Decision

1. Introduce `platform-tenants` service with cursor pagination (default 20, max 100).  
2. Reject unknown query params and invalid limit/cursor with 400.  
3. Add GET by id (metadata only, id charset guard).  
4. Rate-limit `platform-tenants` at 60/min/IP.  
5. Pass `Request` into `requirePlatformPermission` for Cookie-header auth (testable + serverless-explicit).  
6. Log successful list/read to `activity_logs`.  
7. Keep surface read-only; no new permissions.

## Consequences

- Clients must handle `page.nextCursor`.  
- Unbounded full dumps via this API are no longer possible in one call.  
- UI remains a later phase.
