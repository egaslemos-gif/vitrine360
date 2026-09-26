# ARCHITECTURE-FUTURE-01 — Bounded Contexts

## 1. Identity & Access

| | |
|--|--|
| **Owns** | User, Membership, Roles, Permissions, Authentication; future Platform Identity / Agency principals |
| **Today** | `lib/auth`, `domain/types` permissions, memberships services, Google identity |
| **Must not know** | Playback engine, media decode, Experience DOM, device slideshow |
| **Evolution** | Dual-axis PLATFORM vs TENANT (docs PLATFORM-IDENTITY-01/02). Do not overload membership `SUPER_ADMIN` as Platform Super Admin |

## 2. Tenant & Workspace

| | |
|--|--|
| **Owns** | Tenant, workspace settings, timezone, tenancy isolation, lifecycle |
| **Today** | `services/tenants`, workspace APIs/UI |
| **Must not control** | Browser renderer, media playback loops, experience iframe internals |

## 3. Device Management

| | |
|--|--|
| **Owns** | Device identity, pairing, tokens, configuration, groups, device lifecycle; **Locations** (today string → future entity) |
| **Today** | `services/devices`, device-groups, `/api/device/*` |
| **Must not contain** | Campaign business rules, renderer implementations, WebRTC stacks |

## 4. Content Domain

| | |
|--|--|
| **Owns** | Content, Content type, metadata, content↔asset links, Content Templates |
| **Today** | `services/contents`, `content-templates`, content studio features |
| **Must not know** | How the browser paints pixels; how bytes are streamed live; how Manifest JSON is shaped internally |

## 5. Media Domain

| | |
|--|--|
| **Owns** | MediaAsset, metadata, MediaStorageProvider, media lifecycle |
| **Today** | LocalFs, R2, Google Drive providers |
| **Hard split** | **Persistent media** (MediaAsset) vs **Live media** (future LiveBroadcast / LiveSession) |
| **Must not mix** | Live signalling state into MediaAsset rows |

## 6. Distribution Domain

| | |
|--|--|
| **Owns** | Playlists, Playlist Items, Schedules, Schedule Targets, Effective Playback, Manifest generation |
| **Today** | playlists, schedules, `playback-resolver`, `manifest` |
| **Answers** | “What should this Device reproduce *now*?” |
| **Does not answer** | “How does the browser render?” |

## 7. Experience Plane

| | |
|--|--|
| **Owns** | Experience packages, registry, validator, admission, origin/serving, sandbox, bridge, runtime lifecycle |
| **Today** | `src/domain/experience-*`, features sandbox/runtime, `/x/...`, in-memory package store |
| **Must not** | Mint device tokens; own global billing; bypass deny-by-default capabilities |

## 8. Device Runtime

| | |
|--|--|
| **Owns** | Sync, local cache, display engines (React + `tv.js`), runtime policy controllers, offline continuity |
| **Today** | `src/player/*`, `public/tv.js` |
| **Must not** | Define tenant RBAC; invent Content Types; own storage provider selection |

## 9. Telemetry Plane

| | |
|--|--|
| **Owns** | Presence, runtime diagnostics, activity audit; future Analytics events, Alerts, Automation triggers |
| **Today** | Heartbeat/`playerState`, device-observability, activity_logs |
| **Must not** | Be confused with product Analytics warehouse until a dedicated sink exists |

## 10. Business Plane [future]

| | |
|--|--|
| **Owns** | Plans, Subscriptions, Billing, commercial entitlements, Agency/Client commercial hierarchy |
| **Today** | Docs only |
| **Must not** | Live inside Playback or Manifest generation |

## Context map (allowed arrows)

```text
Identity ──► Tenant
Tenant   ──► Device / Content / Media / Distribution (scoping)
Content  ──► Media (asset refs)
Distribution ──► Content + Media URLs + Device/Group targets
Device Runtime ◄── Manifest + Policy
Experience ──► Policy (capabilities) ; ◄── Content EXPERIENCE refs
Telemetry ◄── Device Runtime / Devices (observations)
Business ──► Identity entitlements [future] ; never ──► Manifest directly
```
