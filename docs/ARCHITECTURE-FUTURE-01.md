# ARCHITECTURE-FUTURE-01 — Platform Evolution & Extensibility

**Status:** Architecture reference (Accepted as design intent)  
**Date:** 2026-09-23  
**Rule:** This phase does **not** implement features. It constrains future work.

Companion evidence:

- [CURRENT-ARCHITECTURE-AUDIT.md](./evidence/architecture-future-01/CURRENT-ARCHITECTURE-AUDIT.md)
- [BOUNDED-CONTEXTS.md](./evidence/architecture-future-01/BOUNDED-CONTEXTS.md)
- [DEPENDENCY-RULES.md](./evidence/architecture-future-01/DEPENDENCY-RULES.md)
- [ROADMAP.md](./evidence/architecture-future-01/ROADMAP.md)
- [AGENT-GUARDRAILS.md](./evidence/architecture-future-01/AGENT-GUARDRAILS.md)
- [ADR-ARCHITECTURE-FUTURE-001](./adr/ADR-ARCHITECTURE-FUTURE-001.md)

---

## 1. Objective

Evolve Vitrine360 into an extensible platform covering:

Digital Signage · Digital Experiences · Media Distribution · Live Media · Remote Operations · Campaign Management · Analytics · Automation  

**without** premature coupling to Billing, Streaming stacks, Camera/Mic, or Surveillance.

Preserve today’s validated foundations: multi-tenant RBAC, distribution (playlist/schedule/manifest), dual device runtimes, media storage abstraction, experience security stack, clock parity.

---

## 2. Platform planes (target)

```text
                         VITRINE360 PLATFORM
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
  CONTROL PLANE              EXPERIENCE PLANE            MEDIA PLANE
       │                          │                          │
  Tenant / Workspace        Experience Runtime        Media Assets
  Users / RBAC              Templates                 Storage
  Devices                   Interactive Apps          CDN / Processing
  Groups                    Runtime Policies          Streaming [future]
  Locations [evolve]        Renderers
  Schedules                 Capabilities / Permissions
  Campaigns [future]
       │                          │                          │
       └──────────────────────────┼──────────────────────────┘
                                  │
                           DISTRIBUTION PLANE
                                  │
                           Effective Playback
                                  │
                              Manifest
                                  │
                           DEVICE RUNTIME
                                  │
                  ┌───────────────┼───────────────┐
                 TV             KIOSK           LED / other
                                  │
                            TELEMETRY PLANE
                                  │
                 ┌────────────────┼────────────────┐
              Analytics        Alerts          Automation
                                  │
                         INTEGRATION / BUSINESS [future]
                         (webhooks, billing, agency)
```

| Plane | Answers |
|-------|---------|
| **CONTROL** | Who may manage what, for which tenant/devices? |
| **EXPERIENCE** | How is interactive/app content packaged, admitted, sandboxed? |
| **MEDIA** | How are persistent bytes stored and addressed? |
| **DISTRIBUTION** | What should this device play *now*? |
| **DEVICE RUNTIME** | How does the device sync, cache, and render? |
| **TELEMETRY** | What was observed? (presence, diagnostics → later analytics) |
| **INTEGRATION** | External systems (Drive, R2, future webhooks) |
| **BUSINESS** | Plans, subscriptions, commercial entitlements [future] |

---

## 3. Bounded contexts (summary)

Full definitions: [BOUNDED-CONTEXTS.md](./evidence/architecture-future-01/BOUNDED-CONTEXTS.md)

1. **Identity & Access** — User, Membership, Roles, Permissions, Authentication; future Platform Identity  
2. **Tenant & Workspace** — Tenant isolation, settings, timezone, lifecycle  
3. **Device Management** — Device identity, pairing, config, groups; Locations evolve here  
4. **Content Domain** — Content, types, metadata, templates (not browser how-to)  
5. **Media Domain** — MediaAsset + storage; **separate** from future LiveBroadcast  
6. **Distribution Domain** — Playlists, Schedules, Targets, Effective Playback, Manifest  
7. **Experience Plane** — Experience packages, registry, validator, admission, sandbox, bridge, runtime  
8. **Device Runtime** — React player + legacy `tv.js`, offline cache, policy controllers  
9. **Telemetry** — Presence, diagnostics, activity log; future Analytics/Automation sinks  
10. **Business** [future] — Billing, Plans, Subscriptions, Agency hierarchy  

---

## 4. Experience / rendering plane

Renderers are a **conceptual** taxonomy for Device Runtime + Experience Plane. They are not a mandate to invent new Content Types prematurely.

```text
Renderer
├── ImageRenderer
├── VideoRenderer
├── GifRenderer          (IMAGE + gif semantics today)
├── ClockRenderer        (native CLOCK — React + tv.js)
├── TextRenderer
├── NoticeRenderer
├── EventRenderer
├── QrRenderer
├── ExperienceRenderer   (sandbox + runtime — wire carefully)
├── AudioRenderer        [future]
└── LiveRenderer         [future]
```

Rules:

- CLOCK remains **native Content**, not Experience, not Image.  
- EXPERIENCE remains package + admission + sandbox; execution only after Runtime Integration gates.  
- Live / Audio renderers require new Distribution + Media contracts — **not** MIME hacks on MediaAsset.  
- Legacy `tv.js` and React Player must keep parity for native types that claim dual-runtime support.

---

## 5. Contracts (stable seams)

| Contract | Owner | Consumers | Must not absorb |
|----------|-------|-----------|-----------------|
| Content type enum | Content | Studio, Manifest, Players | Streaming protocols |
| Playlist item | Distribution | Manifest, Players | Campaign budgeting |
| Effective playback resolution | Distribution | Manifest, Sync | Renderer internals |
| Manifest document | Distribution | Device Runtime | Billing |
| MediaStorageProvider | Media | Media APIs, Manifest URLs | Live session signalling |
| Runtime Policy resolve | Device Runtime / Policy | Player shell, diagnostics | Content CRUD |
| Experience package + admission | Experience | Serving, future player host | Device pairing crypto |
| Heartbeat / presence | Telemetry (via Devices today) | Admin observability | Product analytics warehouse |

---

## 6. Dependency rules (short)

Allowed: Control → Content/Media/Device metadata; Distribution → Content refs + Media URLs + Schedule; Device Runtime → Manifest + Policy; Experience → Policy capabilities (read); Telemetry ← Runtime observations.

Forbidden: Media → Playback engine; Content → Manifest builder internals; Experience → Device token minting; Billing → Playback path; Live signalling → MediaAsset row as “file”; Analytics warehouse → write Content.

Detail: [DEPENDENCY-RULES.md](./evidence/architecture-future-01/DEPENDENCY-RULES.md)

---

## 7. Extensibility principles

1. **Separate planes** — do not grow Manifest into a kitchen sink of business features.  
2. **Persistent ≠ Live** — MediaAsset vs LiveBroadcast.  
3. **Distribution ≠ Rendering** — “what” vs “how”.  
4. **Deny by default** for Experience capabilities (existing ADRs).  
5. **Dual runtime parity** required before claiming Smart TV support.  
6. **Docs before schema** for Platform Identity, Billing, Live Media.  
7. **Offline-first** must remain valid for native signage types.  
8. **No silent Content Type inflation** — GIF stays IMAGE unless a dedicated RFC + Hisense evidence.  
9. **Entitlements ≠ RBAC** — commercial limits are Business plane.  
10. **Agency hierarchy** is Control/Business — not Device Runtime.

---

## 8. Architectural roadmap (phased)

See [ROADMAP.md](./evidence/architecture-future-01/ROADMAP.md). Headline order:

| Horizon | Themes |
|---------|--------|
| **Now (stable)** | Signage CRUD, Distribution, Dual runtime, Policy, Templates, Clock parity, Experience domain (unwired execution) |
| **Next** | Experience player integration (RUNTIME-EXPERIENCE-11+) under existing security ADRs; Locations entity; package persistence |
| **Later** | Live Media plane; Campaigns; Remote Ops; Analytics sinks |
| **Business** | Platform Identity implementation; Billing/Plans — only after identity dual-axis |

Non-goals until their gate: WebRTC product, Camera/Mic, Surveillance, Data Sources marketplace.

---

## 9. Explicit non-implementation (this phase)

Do **not** in ARCHITECTURE-FUTURE-01:

- migrations / new tables  
- Streaming / WebRTC / HLS / DASH / Camera / Microphone  
- Campaigns / Billing / Plans / Subscriptions  
- Analytics pipelines / Remote control product  
- Experience persistent storage implementation  
- Network/Camera/Microphone experience permissions expansion  
- Changes to Playback Engine, Manifest behaviour, Device Runtime, Experience Runtime behaviour, Clock, Storage Provider behaviour  

---

## 10. Verdict

**ARCHITECTURE-FUTURE-01 — DOCUMENTED**

Reference planes, bounded contexts, contracts, dependency rules, roadmap, ADR, and agent guardrails are established. Implementation remains gated by future phase documents.
