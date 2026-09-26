# Vitrine360 — RUNTIME-EXPERIENCE-10  
# Experience Runtime Core + Lifecycle

**Date:** 2026-09-23  
**Status:** RUNTIME CORE VALIDATED (host lifecycle · no Player playlist wire)  
**Depends on:** EXPERIENCE-01 … 08 (sandbox, bridge, admission)  
**ADR:** [ADR-EXPERIENCE-010](./adr/ADR-EXPERIENCE-010.md)

**Not claimed:** HTML_APP · Playlist/Schedule auto-execution · Fullscreen/Orientation CONTROL · Production Ready · Network/Storage privileges  

EXPERIENCE Content type is defined in EXPERIENCE-09; this phase does not auto-wire Player playlist playback.

---

## 1. Purpose

Transform **ADMITTED** into **EXECUTABLE / RUNNING** inside existing security boundaries:

```text
Admission grant
    → plan entrypoint (Dedicated Origin /x/…)
    → sandboxed iframe
    → Controlled Bridge v1 (RUNTIME_READ)
    → lifecycle (LOAD → ACTIVE → STOP/KILL)
```

```text
EXECUTION ≠ PRIVILEGE
```

---

## 2. Lifecycle

```text
IDLE → ADMITTED → LOADING → INIT → READY → ACTIVE ⇄ PAUSED
                                              ↓
                                         STOPPING → STOPPED
                         ↘ ERROR → STOPPING / KILLED
```

| Phase | Meaning |
|-------|---------|
| ADMITTED | Grant bound; not yet navigating |
| LOADING | Entrypoint URL armed; watchdog running |
| INIT | Frame mounted |
| READY / ACTIVE | `onLoad` success; bridge may attach |
| PAUSED | Host-side pause (no Experience API) |
| STOPPING / STOPPED | Tear-down; bridge stopped |
| ERROR | Load timeout / invalid src / fatal |
| KILLED | Host kill switch (no cooperation required) |

Load watchdog: `EXPERIENCE_RUNTIME_LOAD_TIMEOUT_MS = 15000`.

---

## 3. Privilege matrix (fixed)

| Capability | Policy |
|------------|--------|
| NETWORK / STORAGE / CAMERA / MICROPHONE / GEO / … | **DENY** |
| FULLSCREEN / ORIENTATION CONTROL | **DEFERRED** |
| DEVICE / PLAYBACK / AUTH / ADMIN_API | **DENY** |

Bridge remains READ_ONLY (`RUNTIME_READ` only).

---

## 4. Components

| Module | Role |
|--------|------|
| `src/domain/experience-runtime.ts` | Phases, plan, controller (pure) |
| `src/features/experience-runtime/runtime-shell.tsx` | React host shell |
| `ExperienceSandboxFrame` | Sandbox + optional bridge (EX-06/07) |

---

## 5. Failure isolation

| Failure | Behaviour |
|---------|-----------|
| Invalid / unsafe src | ERROR · fallback UI · no iframe |
| Load timeout | `RUNTIME_LOAD_TIMEOUT` → ERROR |
| Rejected src host | `RUNTIME_INVALID_SRC` |
| Kill | Immediate `KILLED` · bridge off · frame unmounted |
| Experience JS throw | Contained in iframe; host continues |

Host / Player control plane must not crash.

---

## 6. Non-goals

- No `CONTENT_TYPES` / HTML_APP enum change  
- No Player `display-engine` / playlist / schedule mutation  
- No Device mutation  
- No token/cookie exposure  
- No Network/Storage/Camera bridge methods  
- EXPERIENCE-09 Content+Playback Integration is **not implemented** in-repo; this phase does not substitute it  

---

## 7. Security invariants

| ID | Invariant |
|----|-----------|
| RT-SEC-001 | Start requires admission grant |
| RT-SEC-002 | Src must pass sandbox allowlist |
| RT-SEC-003 | Privilege matrix never elevates |
| RT-SEC-004 | Bridge RUNTIME_READ only |
| RT-SEC-005 | Kill works without Experience |
| RT-SEC-006 | Timeout fail-closed |
| RT-SEC-007 | No Player/playlist/schedule imports |
| RT-SEC-008 | Snapshot has no secrets |

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-010.md`  
- Checklist: `docs/evidence/runtime-experience-10/RUNTIME-CORE-CHECKLIST.md`  
- `npm run test:runtime-experience-10`
