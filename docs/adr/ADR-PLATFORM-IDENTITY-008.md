# ADR-PLATFORM-IDENTITY-008 — Tenant Lifecycle Semantics

**Status:** Accepted (architecture)  
**Date:** 2026-09-23  
**Phase:** PLATFORM-IDENTITY-08  
**Follow-on:** PI-09 enforcement (not this ADR)

## Context

`tenants.status` exists and is shown in the Platform Console, but no authz or runtime path reads it. Implementing suspend/create/delete without agreed semantics would create false security.

## Decision

1. Day-1 lifecycle states: **ACTIVE** | **SUSPENDED**.  
2. Suspend/reactivate are Platform-axis operations (`platform.tenants.suspend`), not Membership operations.  
3. Enforcement (future) is a **tenant operable gate** on session, device bearer, experience, and media — not mass membership mutation.  
4. Hard delete is forbidden until a dedicated ADR; FK cascades make it destructive.  
5. PI-08 ships **documentation only** — zero runtime changes.

## Consequences

- Operators must not treat Console status as enforced until PI-09.  
- PI-09 must close R1 with tests TL-I1…I10 before production enablement of mutations.

**Follow-up:** PI-09 shipped enforcement + suspend/reactivate; see ADR-PLATFORM-IDENTITY-009.
