# ARCHITECTURE-FUTURE-01 — Current Architecture Audit

Date: 2026-09-23  
Phase: architecture only — no code changes in this gate  
Scope: factual inventory of the repository as found

## 0. Layout facts

| Area | Path | Notes |
|------|------|--------|
| Application | `src/` | App Router, domain, services, features, player |
| Legacy / offline player | `public/` | `tv.js`, `tv.html`, SW, offline boot |
| Schema | `src/db/schema.ts` + `drizzle/` | **No** `database/` directory |
| Docs / ADRs | `docs/`, `docs/adr/`, `docs/architecture/` | Phase docs + ADRs |
| Scripts / gates | `scripts/` | Domain and phase test suites |

---

## 1. Modules found

### Identity & access

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Auth | `src/lib/auth.ts`, `src/lib/google-oauth.ts`, `src/services/google-identity.ts`, `src/app/api/auth/*` | Password JWT session; Google OIDC; device token helpers |
| Authorization | `src/domain/types.ts` (roles/permissions), `src/lib/admin-access.ts` | Tenant RBAC matrix; page/API gates |
| Membership | `src/services/memberships.ts`, `src/services/members.ts`, `src/app/admin/users` | User↔tenant membership SoT |

### Tenant & workspace

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Tenants | `src/services/tenants.ts`, workspace settings API/UI | Tenant settings (name, timezone), switch workspace |

### Device management

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Devices | `src/services/devices.ts`, `src/app/api/device/*`, admin devices | Pairing, tokens, assign playlist, heartbeat/presence, policy wire |
| Device groups | `src/services/device-groups.ts`, admin device-groups | Groups for schedule targets |
| Locations | **Not a first-class module** | Free-text `devices.location` (+ EVENT payload field only) |

### Content & templates

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Contents | `src/services/contents.ts`, `src/features/contents/*` | Content CRUD, media attach, EXPERIENCE refs |
| Templates | `src/domain/content-templates.ts`, template-picker | Static system presets (TEXT/CLOCK/NOTICE/EVENT/QR) |
| Clock | `use-live-clock.ts`, display-engine CLOCK, `public/tv.js` CLOCK | Native CLOCK runtime (React + legacy parity) |

### Media & storage

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Media library | `src/services/media/*`, admin media APIs | Upload, list, dedupe, usage |
| `MediaStorageProvider` | `src/services/media/types.ts` + `index.ts` | Abstraction |
| LocalFs | `local-fs-provider.ts` | Local disk |
| R2 | `r2-provider.ts` | Cloudflare R2 |
| Google Drive | `google-drive-provider.ts` | Drive |
| ObjectStorageProvider | **Docs only** | Not implemented in `src/` |

### Distribution

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Playlists | `src/services/playlists.ts` | Ordered playlist items + transitions |
| Schedules | `src/services/schedules.ts`, `schedule-time.ts` | Windows, targets, priority |
| Effective playback | `src/domain/playback-resolver.ts`, `effective-playback-key.ts` | What plays now (DEFAULT/SCHEDULE/EMERGENCY) |
| Manifest | `src/services/manifest.ts`, `/api/device/manifest` | Device playback package |

### Runtime policy & observability

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Runtime policy | `src/domain/runtime-policy.ts`, `src/player/runtime/*` | Capabilities, cursor, fullscreen, orientation, state |
| Observability | `src/domain/device-observability.ts`, device panel | Requested vs resolved vs actual diagnostics |
| Activity log | `src/services/activity-log.ts`, admin logs | Admin audit trail |
| Telemetry | Heartbeat + `playerState` on devices | Presence / runtime uplink — **not** product analytics |

### Experience plane (domain + features)

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Manifest / registry / validator | `experience-manifest|registry|validator.ts` | Package contract |
| Admission | `experience-admission.ts` | Admit/deny for device |
| Origin / serving | `experience-origin|serving.ts`, `/x/...`, `proxy.ts` | Dedicated origin + file serve |
| Sandbox / bridge | `experience-sandbox|bridge.ts`, features | iframe policy + controlled postMessage |
| Runtime core | `experience-runtime.ts`, `features/experience-runtime/` | Lifecycle domain + shell UI |
| Package store | `experience-package-store.ts` | **In-memory** Map (no experience tables) |

**Fact:** Experience Runtime Shell is **not** wired into main `player-app` / `display-engine` playback path; EXPERIENCE shows safe-fallback in engine.

### Playback / device runtime

| Module | Paths | Responsibility |
|--------|-------|----------------|
| React player | `src/player/*`, `src/features/player/player-app.tsx` | Sync, cache, display-engine |
| Legacy Smart TV | `public/tv.js`, `tv.html`, `tv-sw.js` | ES5 slideshow + pairing |
| Offline | `v360-offline.html`, `v360-offline-boot.js`, IndexedDB cache | Offline-first continuity |

### UI

| Module | Paths | Responsibility |
|--------|-------|----------------|
| Admin console | `src/app/admin/**`, `src/components/**`, `src/features/**` | Design-system admin |
| Docs | UI/UX-01 ADRs + evidence | Standardization |

### Schema tables (SoT)

`tenants`, `users`, `memberships`, `user_identities`, `devices`, `device_groups`, `device_group_members`, `media_assets`, `contents`, `content_assets`, `playlists`, `playlist_items`, `device_assignments` (deprecated), `schedules`, `schedule_targets`, `activity_logs`, `system_settings`.

**Absent tables:** Experience, Campaign, Billing, Analytics, Location entity, LiveBroadcast.

---

## 2. Responsibilities (summary)

| Plane (as-is) | What exists today |
|---------------|-------------------|
| Control | Tenant, membership RBAC, devices, groups, schedules admin |
| Content / Media | Contents, templates, media assets, storage providers |
| Distribution | Playlists → schedules → resolver → manifest |
| Device runtime | React player + legacy `tv.js`, offline cache, heartbeat |
| Experience | Domain stack through Runtime Core; serving origin; **not** full player execution wire-up |
| Telemetry | Presence + diagnostics + activity log |

---

## 3. Dependencies (observed)

```
Admin UI → services / APIs → domain helpers → db
Device APIs → devices + manifest + media URLs
Manifest → playback-resolver + media + experience refs
Player → sync → manifest → display-engine / tv.js
Experience serve → package store + origin policy
```

Critical hubs:

1. `services/manifest.ts` — schedule + media + experience + device  
2. `services/devices.ts` — pairing + presence + policy + observability  
3. `services/contents.ts` — media + experience validation (+ feature-layer import)  
4. `domain/playback-resolver.ts` — domain folder with Drizzle I/O  

---

## 4. Coupling points

| Point | Risk |
|-------|------|
| Dual player (React + `tv.js`) | Feature parity debt (mitigated for CLOCK) |
| Manifest builder as hub | New content kinds force hub edits |
| Devices as mega-service | Hard to isolate Campaign/Remote Ops later |
| Experience without persistence | Process Map ≠ multi-instance production store |
| Auth module mixes admin session + device crypto | Identity evolution friction |
| Locations not modeled | Future geo/campaign targeting needs new entity |
| `SUPER_ADMIN` = tenant role | Platform Identity must not overload this |

---

## 5. Evolution risks

| Risk | Why it matters |
|------|----------------|
| Premature Live Media on MediaAsset | Mixing persistent asset with live session |
| Campaigns bolted onto playlists | Blurs Distribution vs Control marketing plane |
| Billing inside tenant RBAC | Platform vs tenant scope collision |
| Analytics = heartbeat | Wrong fidelity / retention / product meaning |
| Experience Network/Camera permissions | Violates current deny-by-default security ADRs |
| Changing Manifest for Streaming | Breaks offline-first contract |

---

## 6. Extensions already prepared

| Extension | Preparation |
|-----------|-------------|
| Storage backends | `MediaStorageProvider` + Local / R2 / Drive |
| Content types | `CONTENT_TYPES` + templates registry |
| EXPERIENCE type | Content ref + admission + sandbox + bridge + runtime domain |
| Runtime policy | Capability probe + resolve + diagnostics |
| Dual-axis identity (future) | Docs: PLATFORM-IDENTITY-01/02 + ADRs (no code) |
| Clock as native renderer | React + `tv.js` parity validated |
| Schedule targets | Device + group targeting |

---

## 7. Extensions that require refactoring (before implementation)

| Desired capability | Likely refactor first |
|--------------------|----------------------|
| Live Media / WebRTC | Separate LiveBroadcast from MediaAsset; new Distribution/Runtime contracts — **not** MediaAsset MIME hacks |
| Campaigns | New Control/Distribution entities; do not overload Playlist |
| Platform Super Admin | Dual-axis identity (docs already); do not reuse membership `SUPER_ADMIN` |
| Billing / Plans | New Business plane; entitlements separate from RBAC |
| Product Analytics | New Telemetry plane sinks; do not overload heartbeat |
| First-class Locations | New entity + migrate `devices.location` string |
| Experience production store | Replace in-memory package store; schema + multi-instance |
| Experience in player | Wire Runtime Core into playback without breaking legacy |
| ObjectStorageProvider | Implement behind existing media interface (docs foreshadow) |

---

## 8. Confirmed absences (do not invent)

No implementation in `src/` for:

- Campaigns  
- Billing / Plans / Subscriptions  
- Live Media / WebRTC / HLS / DASH product modules  
- Camera / Microphone permission product surfaces  
- Surveillance / Sensors  
- Product Analytics pipelines  
- Platform Identity code  
- Experience persistent DB  

These appear only as future docs / non-goals in phase documents.

---

## 9. Audit verdict

**CURRENT ARCHITECTURE AUDIT — COMPLETE**

Inventory is sufficient to define ARCHITECTURE-FUTURE-01 reference planes, bounded contexts, dependency rules, and agent guardrails without changing runtime behaviour.
