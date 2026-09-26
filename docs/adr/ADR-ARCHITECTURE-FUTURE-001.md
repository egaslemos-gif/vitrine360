# ADR-ARCHITECTURE-FUTURE-001 — Platform Evolution Planes & Extensibility

## Status

Accepted — ARCHITECTURE-FUTURE-01 (architecture only; no implementation in this ADR)

## Context

Vitrine360 already operates as a multi-tenant digital signage control plane with distribution (playlists, schedules, manifest), dual device runtimes, media storage abstraction, runtime policy, content templates (including CLOCK parity), and an Experience security/domain stack that is not fully wired into playback execution.

Product ambition expands toward Live Media, Campaigns, Remote Operations, Analytics, Automation, Billing, and Platform Identity. Without an explicit plane model, future agents risk:

- coupling Live Media into MediaAsset;
- putting Billing into Manifest/Playback;
- overloading tenant `SUPER_ADMIN` as platform admin;
- weakening Experience deny-by-default security;
- breaking Smart TV parity (`tv.js`).

## Decision

1. Organise the platform into planes: **Control, Experience, Media, Distribution, Device Runtime, Telemetry, Integration, Business**.  
2. Treat the listed **bounded contexts** as ownership boundaries (see evidence BOUNDED-CONTEXTS).  
3. Enforce **allowed/forbidden dependencies** (see DEPENDENCY-RULES).  
4. Keep **Persistent Media ≠ Live Media**.  
5. Keep **Distribution (“what”) ≠ Rendering (“how”)**.  
6. Keep **Entitlements ≠ RBAC** when Business plane arrives.  
7. Require **docs + ADR + evidence gate** before implementing Live Media, Campaigns, Billing, Platform Identity code, or Experience player execution beyond current ADRs.  
8. Do **not** change Playback Engine, Manifest behaviour, Device Runtime behaviour, Experience Runtime behaviour, Clock, or Storage Provider behaviour in the ARCHITECTURE-FUTURE-01 documentation phase.

## Consequences

### Positive

- Clear seams for future phases and agent guardrails.  
- Reduced risk of premature schema and security regressions.  
- Aligns with existing Experience and Platform Identity documentation.

### Negative / costs

- Some current hubs (`manifest`, `devices`, in-memory experience store) will need refactoring before Horizon C–E features.  
- Locations remain a string until an explicit entity phase.

### Non-goals of this ADR

Implementing any future product module; migrations; APIs; Streaming; WebRTC; Camera/Mic; Surveillance; Analytics pipelines; Billing.

## References

- `docs/ARCHITECTURE-FUTURE-01.md`  
- `docs/evidence/architecture-future-01/*`  
- `docs/adr/ADR-EXPERIENCE-001` … `010`  
- `docs/adr/ADR-PLATFORM-IDENTITY-001`, `002`  
- `docs/adr/ADR-CONTENT-TEMPLATES-001`
