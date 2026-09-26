# ADR-PLATFORM-IDENTITY-004 — Platform Identity Schema Foundation

**Status:** Accepted  
**Date:** 2026-09-23  
**Phase:** PLATFORM-IDENTITY-04

## Context

Platform and Tenant are distinct authority axes. Tenant `SUPER_ADMIN` must not become platform authority by migration or naming. PI-03 approved an additive, feature-flagged foundation before authorization (PI-05).

## Decision

1. Introduce table `platform_assignments` (global; no `tenant_id`).
2. Minimum platform role: `PLATFORM_SUPER_ADMIN` (app-validated; not a Membership role).
3. Status: `ACTIVE` | `SUSPENDED` | `REVOKED` — only ACTIVE is “active” for future authz.
4. Unique `(user_id, role)` prevents duplicate semantic assignments.
5. Feature flag `PLATFORM_IDENTITY_ENABLED` defaults OFF; repository refuses work when disabled.
6. No JWT/session/auth middleware/UI/API changes in this ADR.
7. No backfill from `memberships`.

## Consequences

- Existing tenants/memberships/devices unchanged.
- Rollback = drop `platform_assignments` (+ indexes); membership data intact.
- Authority remains ineffective until PI-05 wires server-side resolution.

## Compliance

Control Plane only. Not Device Runtime, Manifest, Experience iframe, Playback, Billing, Entitlements, Campaigns, or Live Media.
