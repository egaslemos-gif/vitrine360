# Phase 0 — Architecture (Vitrine360)

**Status:** Complete  
**Date:** 2026-09-16  
**Repo state:** Greenfield (empty workspace). No prior stack or reusable code.

## Findings

| Item | Result |
|------|--------|
| Existing structure | Empty directory |
| Installed technologies | None |
| Reusable code | N/A |
| Architectural conflicts | None |
| Risk | Starting from scratch — prioritize MVP path |

## Principle

> The TV is only a playback device. The platform is the product.

```
DIGITAL SIGNAGE PLATFORM
├── Admin Console
├── Backend / API
├── Database
├── Media Storage (abstracted)
└── Player Runtime (device-agnostic client)
       ├── Android TV Box (first target)
       ├── Smart TV Browser
       ├── Mini PC / Raspberry Pi
       └── other Web Player hosts
```

## Layering

| Layer | Responsibility |
|-------|----------------|
| **Domain** | Entities, invariants, status transitions, RBAC permissions |
| **Application** | Use cases (pair device, sync manifest, assign playlist) |
| **Infrastructure** | Drizzle, Turso, MediaStorageProvider, auth adapters |
| **Admin UI** | Next.js App Router under `/admin` |
| **Player** | Independent client under `/player` + `src/player/*` |

Business rules must not live in React components.

## Phase plan (execution order)

| Phase | Scope | Exit gate |
|-------|--------|-----------|
| 0 | Domain, schema, APIs, lifecycle, sync, ADRs | This document + linked ADRs |
| 1 | Next.js, TS strict, Tailwind, shadcn, Drizzle, Turso-ready, auth, migrations | `npm run build` + migrate |
| 2 | Device pairing, heartbeat, status, admin devices UI | Pairing + ONLINE/OFFLINE |
| 3 | Contents + MediaAsset + library | Upload + typed contents |
| 4 | Playlists CRUD, order, preview, assignment | Assign playlist to device |
| 5 | Player bootstrap, manifest, IndexedDB, playback | Continuous playback |
| 6 | Incremental sync, checksums, atomic swap | Offline + delta update |
| 7 | Schedules + priorities (incl. EMERGENCY) | Time-window playlist switch |
| 8 | Android TV kiosk / TWA guidance | Documented deploy path |
| 9 | Hardening, tests, docs | Acceptance scenarios 1–7 |

## Explicit non-goals (MVP)

IA, social, Moodle, weather, advanced analytics, face recognition, programmatic ads, Canva-like editor, multi-storage vendors, native apps for every platform.

## Acceptance scenarios (final MVP)

1. Device pairing via activation code  
2. Content create (image, text, notice, video)  
3. Playlist create / reorder / assign  
4. Playback with local assets  
5. Offline continuity  
6. Incremental atomic update after reconnect  
7. Dashboard ONLINE/OFFLINE monitoring  

## Documents in this phase

- [01-domain.md](./01-domain.md) — domain model  
- [02-schema.md](./02-schema.md) — Drizzle/SQLite schema  
- [03-apis.md](./03-apis.md) — Admin vs Device APIs  
- [04-device-lifecycle.md](./04-device-lifecycle.md) — pairing & status  
- [05-sync.md](./05-sync.md) — offline-first sync  
- [adr/](./adr/) — architecture decision records  
