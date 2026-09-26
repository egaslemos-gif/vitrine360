# ADR-PLATFORM-IDENTITY-006A — Platform Tenants API Security Gate

**Status:** Accepted (audit)  
**Date:** 2026-09-23  
**Phase:** PLATFORM-IDENTITY-06A

## Context

PI-05B shipped `GET /api/platform/tenants` gated by `platform.tenants.read`. Before UI or mutation APIs, the surface needed an explicit security audit.

## Decision

1. Affirm the current read-only metadata stub as **authorization-safe** under flag + platform permission.  
2. Forbid using `platform.tenants.read` for tenant resource access (content, devices, media, experiences).  
3. Defer `platform.tenants.manage` / `suspend` until status semantics and SoD are specified.  
4. Treat PARTIAL findings (rate limit, pagination, service auth boundary, audit log, HTTP tests) as **PI-06B hygiene**, not 06A blockers.  
5. Keep JWT / tenant RBAC / Device / Experience unchanged.

## Consequences

- Console UI may consume the read API only after 06B (or accepted stub) go-ahead.  
- Mutation APIs remain unapproved.  
- Support Session remains PI-07.
