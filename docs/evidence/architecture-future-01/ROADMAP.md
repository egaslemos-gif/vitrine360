# ARCHITECTURE-FUTURE-01 — Architectural Roadmap

Non-binding product order. Each row needs its own phase gate before code.

## Horizon A — Stabilize (current)

| Theme | State |
|-------|--------|
| Multi-tenant + membership RBAC | Implemented |
| Devices / groups / schedules / playlists | Implemented |
| Manifest + effective playback | Implemented |
| MediaStorageProvider (Local / R2 / Drive) | Implemented |
| Runtime Policy + observability | Implemented |
| Content Templates + CLOCK parity | Implemented / production CLOCK 0.1.22 |
| Experience domain 01–10 | Domain VALIDATED; player execution not fully wired |
| Platform Identity | Docs / ADRs only |

## Horizon B — Experience & structure

| Phase theme | Intent | Blockers / notes |
|-------------|--------|------------------|
| RUNTIME-EXPERIENCE-11 | Controlled Experience execution in React Player | **DONE** (software); tv.js non-exec; package store still in-memory |
| Experience package persistence | Replace in-memory store | Schema + multi-instance |
| Locations entity | Promote string field | Migration; Device Management owns it |
| Manifest adapter cleanup | Reduce hub coupling | Prep for Live/Campaign refs |

## Horizon C — Media & live

| Phase theme | Intent | Rules |
|-------------|--------|--------|
| LIVE-MEDIA-01 (future) | LiveBroadcast / LiveSession plane | Never as MediaAsset file; new contracts |
| Audio renderer | Native or Experience-assisted audio | Offline + TV evidence required |
| ObjectStorageProvider | Optional backend behind existing interface | No player coupling |

## Horizon D — Operations & campaigns

| Phase theme | Intent | Rules |
|-------------|--------|--------|
| Campaigns | Control/Distribution planning layer | Not a Playlist rename |
| Remote Operations / Monitoring | Ops plane over Devices + Telemetry | No firmware/APK/root |
| Automation / Alerts | Telemetry sinks | Separate from heartbeat schema creep |

## Horizon E — Business & identity

| Phase theme | Intent | Rules |
|-------------|--------|--------|
| Platform Identity implementation | Dual-axis PLATFORM/TENANT | Follow PI-01/02 ADRs |
| Billing / Plans / Subscriptions | Business plane | Entitlements ≠ RBAC |
| Agency / Client hierarchy | Commercial orgs | Not Device Runtime |

## Explicit deferrals

Do not start without a dedicated gate:

- WebRTC / HLS / DASH product modules  
- Camera / Microphone permissions for Experiences  
- Surveillance / Sensors  
- Data Sources marketplace  
- Analytics warehouse  

## Suggested sequencing principle

```text
Security & tenancy intact
    → Distribution stable
        → Native renderers parity (TV)
            → Experience execution (controlled)
                → Persistence for Experiences
                    → Live / Campaigns / Business
```
