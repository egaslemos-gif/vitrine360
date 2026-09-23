# Vitrine360 — SCHEDULE-MANAGEMENT-SCHED-02B

**Date:** 2026-09-22  
**Status:** Implemented + test suite (`npm run test:sched-mgmt`)  
**Depends on:** SCHED-02 (execution / wall-clock / invalidation on create·activate·delete)

---

## 1. Model

```text
Schedule
  + schedule_targets (ALL | GROUP | DEVICE)
       ↓
resolveEffectivePlayback(deviceId, now)
       ↓
Manifest / Sync (effectivePlaybackKey)
       ↓
Runtime (Device CURRENT playlist from sync — no admin rewrite of Device.currentPlaylistId)
```

- `Device.currentPlaylistId` = **default** playlist.
- An applicable Schedule is a **temporary override**.
- When no Schedule applies → effective playlist = default.

No schema migration in SCHED-02B (tables already existed).

---

## 2. CRUD & lifecycle

| Op | Service | API | Activity |
|----|---------|-----|----------|
| Create | `createSchedule` | `POST /api/admin/schedules` | `SCHEDULE_CREATED` |
| Read | `getSchedule` / `listSchedules` | `GET …` / `GET …/[id]` | — |
| Update | `updateSchedule` (TX) | `PATCH …/[id]` full body | `SCHEDULE_UPDATED` |
| Activate | `setScheduleActive(true)` | `PATCH { active: true }` | `SCHEDULE_ACTIVATED` |
| Deactivate | `setScheduleActive(false)` | `PATCH { active: false }` | `SCHEDULE_DEACTIVATED` |
| Delete | `deleteSchedule` | `DELETE …/[id]` | `SCHEDULE_DELETED` |

Update is transactional: schedule row + replace `schedule_targets` atomically. On failure → rollback, no partial targets.

---

## 3. Invalidation (affected devices)

`bumpManifestForScheduleTargets(tenantId, targets)`:

- increments `manifestVersion`
- clears `effectivePlaybackKey`
- does **not** change `currentPlaylistId`

**Update** invalidates **old ∪ new** targets (e.g. GROUP-A devices 1–3 and GROUP-B devices 4–5).

Activate / deactivate / delete invalidate current (pre-delete) targets.

---

## 4. Timezone

Policy unchanged:

```text
Device.timezone → Tenant.timezone → UTC
```

Never the Node server local TZ. Admin list shows tenant TZ and the Device→Tenant→UTC policy. “Effective now” is derived via `resolveEffectivePlayback` (not a second frontend resolver).

---

## 5. Daily window (half-open)

```text
start <= now < end
```

Normal `08:00 → 18:00`: 08:00 YES · 17:59 YES · **18:00 NO**  
Overnight `22:00 → 02:00`: 22:30 YES · 00:30 YES · 01:59 YES · **02:00 NO**

Open-ended: missing start/end = open on that side. Identical start/end = empty window.

---

## 6. Priority

`EMERGENCY > HIGH > NORMAL`, then deterministic `createdAt` tie-break (existing resolver).

---

## 7. RBAC

Mutations and admin page require `manage_schedules`.

| Role | manage_schedules |
|------|------------------|
| VIEWER | no |
| EDITOR / OPERATOR / ADMIN / SUPER_ADMIN | yes |

Enforced in API (`requireSession`) and page (`requireAdminPage`) — not UI-only.

---

## 8. Tenant isolation

Playlist, Device, and Group targets must belong to the schedule’s tenant. Cross-tenant IDs are rejected at the service boundary.

---

## 9. UI (`/admin/schedules`)

List fields: name, playlist, priority, ACTIVE/INACTIVE, targets, days, start/end, timezone policy, **Effective now YES/NO** (derived), actions Edit / Activate|Deactivate / Delete.

---

## 10. Tests

| Suite | Command |
|-------|---------|
| Execution | `npm run test:sched-02` |
| Management | `npm run test:sched-mgmt` (`scripts/test-schedule-management-02b.ts`) |

SCHED-MGMT-001…023 cover CRUD, union invalidation, activate/deactivate/delete → default playlist, RBAC matrix, tenant isolation, windows, timezone, priority, plus E2E:

```text
DEFAULT → create → sync → scheduled effective
→ edit (old∪new invalidation) → sync → new effective
→ deactivate → sync → DEFAULT
→ (delete path) → sync → DEFAULT
```

---

## 11. Limitations

- “Effective now” scans ACTIVE devices and calls `resolveEffectivePlayback` (fine for pilot scale).
- Overnight / half-open change may require re-checking schedules that relied on inclusive end (e.g. end=`23:59` no longer includes 23:59; prefer open end or next-minute end).
- No new Server Actions (API routes only).
- Production Validated for management requires E2E sync evidence from `test:sched-mgmt` + green regression suite.

---

## 12. Out of scope (unchanged)

Runtime Cache, Player, IndexedDB, Service Worker, Manifest architecture, Media storage, Auth/Membership architecture.
