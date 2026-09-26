# ARCHITECTURE-FUTURE-01 — Dependency Rules

## Allowed dependencies

| From | To | Why |
|------|-----|-----|
| Admin UI | Control / Content / Media / Distribution APIs | Operator surfaces |
| Distribution | Content IDs, Media URLs, Schedule/Device/Group | Build effective playback |
| Device Runtime | Manifest, Runtime Policy, local cache | Play offline-capable slideshow |
| Experience serving | Package store, Origin policy | Serve admitted packages |
| Experience admission | Runtime Policy capabilities (read) | Soft/hard capability checks |
| Telemetry ingest | Device identity | Attribute observations |
| Media APIs | MediaStorageProvider | Bytes in/out |

## Forbidden dependencies

| From | To | Why forbidden |
|------|-----|----------------|
| Media Domain | Display engine / `tv.js` | Storage must not know renderers |
| Content Domain | Manifest builder internals | Content is data; Distribution owns packaging |
| Experience Runtime | Device pairing / token mint | Security boundary |
| Experience package | Arbitrary network/camera/mic by default | Deny-by-default ADRs |
| Billing / Plans | Manifest or Playback path | Commercial plane separate |
| Live signalling | MediaAsset as file row | Persistent ≠ Live |
| Analytics warehouse | Direct Content mutation | Observe, don’t own CRUD |
| Platform Identity | Membership `SUPER_ADMIN` as platform admin | Dual-axis required |
| Campaigns | Hard-coded inside Playlist item schema without RFC | Separate Control/Distribution concept |
| Legacy `tv.js` | ES modules / React | Smart TV compatibility |

## Coupling hotspots (refactor before expanding)

1. `services/manifest.ts` — extract adapters when adding Live/Campaign refs  
2. `services/devices.ts` — split presence/policy/observability when Telemetry plane solidifies  
3. `domain/playback-resolver.ts` — keep resolution pure; push DB IO to services if splitting  
4. Dual player — any new native Content Type claiming TV support needs CLOCK-style parity gate  
5. Experience package store — persistence before multi-instance production claims  

## Change control

A future phase may only introduce a **forbidden** dependency if:

1. An ADR updates this table explicitly; and  
2. Evidence shows migration path; and  
3. Offline / security invariants remain tested.
