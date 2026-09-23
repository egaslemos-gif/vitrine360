# Phase progress — Vitrine360

| Phase | Status | Evidence |
|-------|--------|----------|
| 0 Architecture | Done | `docs/architecture/*` |
| 1 Foundation | Done | Next.js 16, TS, Tailwind, Drizzle, auth, seed |
| 2 Devices | Done | Pairing, token, heartbeat, presence |
| 3 Content | Done | IMAGE/TEXT/NOTICE/CLOCK/… + media upload |
| 4 Playlists | Done | CRUD, reorder, **faithful** Itens·Preview (TEXT/IMAGE/VIDEO) |
| 5 Player | Done | `/player`, pairing, DisplayEngine, `?reset=1` |
| 6 Offline Sync | Done | IndexedDB CURRENT/NEXT + SW v6 offline-boot |
| 7 Scheduling | Done | Priorities + EMERGENCY prepend |
| 8 Android TV | Software ready; hardware pending | [android-tv.md](../android-tv.md) + checklist + quickstart |
| 9 Hardening | Done (audit) | [AUDIT-REPORT.md](../AUDIT-REPORT.md) |
| 10 Passive Runtime + TV validation | Software PASS; **HDMI NOT TESTED** | ADR-006/007 + [ACCEPTANCE.md](../ACCEPTANCE.md) + HARDWARE report |

See [ACCEPTANCE.md](../ACCEPTANCE.md) for scenario evidence.  
Security / production readiness: [AUDIT-REPORT.md](../AUDIT-REPORT.md).
