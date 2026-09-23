# Vitrine360 — SCHED-01 Schedule Execution / Effective Playback Audit

**Date:** 2026-09-22  
**Phase:** SCHED-01 (audit only)  
**Trigger:** Schedules UI creates rows successfully, but devices do not switch playlist at the configured day/time.  
**Product code changes in this phase:** **NONE**

---

## 1. Executive Verdict

| Question | Verdict |
|----------|---------|
| Does Schedule UI persist to DB + `schedule_targets`? | **YES** |
| Does `resolveEffectivePlayback()` exist and select a schedule playlist? | **YES** |
| Does `buildDeviceManifest()` use the resolver? | **YES** |
| Does creating a Schedule invalidate device sync? | **NO — root gap** |
| Does Player/Sync re-resolve on wall-clock window entry? | **NO — root gap** |
| Does Admin Devices UI show *effective* playlist? | **NO** — shows static `currentPlaylistId` |
| Can HH:mm:ss from the form break time matching? | **YES — contributing bug** |

```
ARCHITECTURE AUDIT — APPROVED FOR SCHED-02 IMPLEMENTATION
PRIMARY ROOT CAUSE: Schedule wins in resolver, but Sync is version-gated
and schedule create / window transitions never bump device.manifestVersion.
```

Secondary: UI stores `startTime`/`endTime` as `HH:mm:ss` while resolver compares against `HH:mm` with lexicographic string compare (first-minute exclusion + format fragility).

---

## 2. Reported problem (mapped)

Operator creates Schedule with:

- Nome, Playlist, Priority  
- Target: Todos / Grupo / Ecrã  
- Início / Fim (time inputs)

Expectation: at the defined day+time, the Device plays that Playlist.

Observation: playlist on Device **does not change/publish**.

---

## 3. End-to-end flow (as implemented)

```text
ScheduleForm (client)
    POST /api/admin/schedules
        createSchedule() + schedule_targets  [DB write OK]
            ✗ does NOT bump devices.manifestVersion
            ✗ does NOT update devices.currentPlaylistId

Device heartbeat / sync (every ~60s)
    GET /api/device/sync?version=N
        buildSyncDelta(device, N)
            if N >= device.manifestVersion → upToDate, manifest=null  ← STUCK
            else buildDeviceManifest()
                resolveEffectivePlayback(deviceId)  ← would pick schedule
                buildPlaylistBlock(effective.playlistId)
                    → Player applies playlist
```

**Intended design (correct):** Schedule is *resolved at manifest build time*; Player does not evaluate schedules locally (React Sync + Legacy `tv.js` consume playlist from manifest).

**Broken link:** Manifest is rarely rebuilt for schedule events because Sync short-circuits on unchanged `manifestVersion`.

---

## 4. Layer-by-layer evidence

### 4.1 Schedule UI

| Item | Evidence |
|------|----------|
| Form | `src/features/schedules/schedule-form.tsx` |
| Fields sent | `name`, `playlistId`, `startTime`, `endTime`, `daysOfWeek`, `priority`, `targets[]` |
| Defaults | `startTime="08:00:00"`, `endTime="12:00:00"`, days Mon–Fri |
| Not sent | `startAt`, `endAt` (absolute window unused by UI) |
| Labels | “Início” / “Fim” are **daily clock times** (`type="time"`), not calendar dates |

### 4.2 API / service

| Item | Evidence |
|------|----------|
| Route | `POST /api/admin/schedules` → `createScheduleSchema` + `createSchedule` |
| Persist | Transaction: `schedules` + `schedule_targets` |
| Tenant checks | Playlist / Device / Group validated |
| Side effects missing | **No** `manifestVersion++` on affected devices  
| Side effects missing | **No** write to `devices.currentPlaylistId` (by design for resolver model) |

### 4.3 Database

| Table | Role |
|-------|------|
| `schedules` | name, playlistId, contentId, daysOfWeek, startTime/endTime, startAt/endAt, priority, active, tenantId |
| `schedule_targets` | ALL \| GROUP \| DEVICE + targetId |
| `devices.currentPlaylistId` | **Default / manual** assignment only |
| `devices.manifestVersion` | Sync gate — bumped on assign playlist, playlist edit, pairing, groups — **not on schedule CRUD** |

### 4.4 `resolveEffectivePlayback()`

Path: `src/domain/playback-resolver.ts`

1. Load device + tenant + group memberships  
2. Timezone: `device.timezone \|\| tenant.timezone \|\| "UTC"`  
3. Local `dayOfWeek` + `hhmm = format(zonedNow, "HH:mm")`  
4. Join active schedules × targets; filter:
   - `startAt` / `endAt` vs ISO now  
   - `daysOfWeek` includes today  
   - `hhmm` vs `startTime` / `endTime` (**string compare**)  
   - Target ALL / DEVICE / GROUP  
5. Rank EMERGENCY > HIGH > NORMAL; tie-break `createdAt`  
6. Return `source: SCHEDULE` + `playlistId` **or** DEFAULT → `device.currentPlaylistId`

**Does not persist** the winner onto the device row.

### 4.5 Manifest / Sync

| Function | Behaviour |
|----------|-----------|
| `buildDeviceManifest` | Calls resolver; builds playlist from `effectiveState.playlistId` |
| `buildSyncDelta` | **If** `clientVersion >= device.manifestVersion` → `{ upToDate: true, manifest: null }` — **no resolve** |
| Heartbeat | Returns `device.manifestVersion` only |
| Legacy `tv.js` | Sync ~60s; refetch only when heartbeat version **>** local |

Comment in `manifest.ts` (line ~110): Phase 3 engine **stores** schedules in payload but **does not process them** client-side. Playback depends on server-resolved playlist.

### 4.6 Player

| Runtime | Schedule awareness |
|---------|-------------------|
| React Sync engine | Applies remote playlist from sync delta |
| Legacy `tv.js` | Same — playlist from sync; no local schedule clock |

Creating a schedule alone never raises version → Player keeps previous playlist indefinitely (until unrelated bump).

### 4.7 Admin UX illusion

Devices UI / assign form show `currentPlaylistId`. Schedule never updates that field. Operator looking at Devices concludes “nothing published,” even if (after a forced rebuild) effective playback would differ.

---

## 5. Root causes (ranked)

### RC-1 — Sync invalidation gap (**PRIMARY**)

| Fact | Detail |
|------|--------|
| Symptom | Create schedule → DB OK → Device playlist unchanged |
| Mechanism | Sync gated by `manifestVersion`; schedule create/update/activate does not bump targeted devices |
| Window entry | When clock enters `startTime`, nothing bumps version either — **no scheduler/cron** |
| Proof paths | `createSchedule` (no device update); `buildSyncDelta` early return; playlist edit *does* bump only devices whose **currentPlaylistId** equals edited playlist — not schedule targets |

### RC-2 — Time string format mismatch (**CONTRIBUTING**)

| Side | Format |
|------|--------|
| ScheduleForm default / `<input type="time" step="1">` | typically `HH:mm:ss` (e.g. `08:00:00`) |
| Resolver | `format(..., "HH:mm")` → `08:00` |

Lexicographic compare:

| Comparison | Result | Effect |
|------------|--------|--------|
| `"08:00" < "08:00:00"` | **true** | At the start minute, schedule is skipped |
| Same-length `HH:mm` vs `HH:mm` | OK | Unit tests use `08:55`/`09:05` — **mask the bug** |

Fragile for overnight windows and mixed formats.

### RC-3 — Operator model mismatch (**CONTRIBUTING**)

- “Publish” mental model ≈ change `currentPlaylistId`  
- Actual model ≈ resolve at sync build time  
- UI does not show effective source (`DEFAULT` \| `SCHEDULE` \| `EMERGENCY`)

### RC-4 — Secondary gaps

| Gap | Impact |
|-----|--------|
| No `startAt`/`endAt` in form | Absolute campaigns unused |
| Days default Mon–Fri | Weekend tests silently miss |
| Overnight `startTime > endTime` | Not supported by simple compare |
| EMERGENCY needs `contentId` | Form never sets contentId → EMERGENCY priority without interrupt content |
| List badges show raw targetId UUIDs | Hard to verify DEVICE/GROUP targeting |
| Form POST ignores HTTP errors | Silent failure possible (separate UX bug) |

---

## 6. What is *not* broken

- Domain pipeline Media → Content → Playlist → Schedule targets is coherent.  
- Resolver ranking and ALL/GROUP/DEVICE matching logic are structurally sound.  
- Manifest *can* serve schedule playlists when it is actually rebuilt.  
- Tenant isolation on create is present.  
- Player ignoring client-side schedules is intentional and correct for Hisense simplicity.

---

## 7. Answers to investigation questions

| # | Question | Answer |
|---|----------|--------|
| 1 | UI → API → DB works? | **Yes** (assuming 200; form does not surface errors) |
| 2 | Targets written? | **Yes** (`schedule_targets`) |
| 3 | Resolver used at playback build? | **Yes** (`buildDeviceManifest`) |
| 4 | Why Device doesn’t change? | Sync never rebuilds: **version not bumped**; optional time-format skip at start minute |
| 5 | Does `currentPlaylistId` change? | **No** — by design; not the effective source of truth |
| 6 | When would it ever work today? | After an unrelated version bump *during* an active matching window (playlist edit on default playlist, re-assign, pair, etc.) |

---

## 8. Recommended SCHED-02 fix order (do not implement here)

1. **Normalize times** to `HH:mm` (UI + Zod + resolver) — deterministic compare or numeric minutes.  
2. **Invalidate devices on schedule write** (create / update / activate / deactivate / delete): bump `manifestVersion` for all devices matching targets (ALL → tenant devices; GROUP → members; DEVICE → one).  
3. **Wall-clock freshness** (pick one):  
   - **A (preferred MVP):** Sync always re-resolves effective playlist hash/id; return delta if effective playlist/source changed even when version equal; *or*  
   - **B:** Lightweight “schedule epoch” / `playbackGeneration` bumped by cron every minute; *or*  
   - **C:** Client forces sync periodically with `version=-1` / `force=1` (costly on TV).  
4. **Admin visibility:** show Effective Playback (source + playlist + schedule name) on Devices / Schedule detail.  
5. **EMERGENCY:** either require `contentId` in UI or hide EMERGENCY until content picker exists.  
6. **Tests:** resolver with `HH:mm:ss` inputs; createSchedule bumps versions; sync returns new playlist when schedule becomes active without manual assign.

---

## 9. Test strategy (specify only)

| ID | Intent |
|----|--------|
| SCHED-001 | createSchedule writes targets |
| SCHED-002 | ALL target matches any tenant device in resolver |
| SCHED-003 | DEVICE / GROUP targeting |
| SCHED-004 | Priority HIGH > NORMAL |
| SCHED-005 | Time window HH:mm and HH:mm:ss both match |
| SCHED-006 | Outside window → DEFAULT |
| SCHED-007 | createSchedule bumps manifestVersion of targeted devices |
| SCHED-008 | Sync after create returns new playlist without manual assign |
| SCHED-009 | Window entry without bump still refreshes (if design A) |
| SCHED-010 | Days-of-week exclusion |
| SCHED-011 | Timezone device vs tenant |
| SCHED-012 | Form/API reject EMERGENCY without contentId (if policy) |

---

## 10. Explicit non-goals (SCHED-01)

- No product code / schema / Player / Sync implementation in this phase  
- No Hisense physical run in this audit  
- No change to Content Studio / GIF / Transition contracts  

---

## 11. Final gate

```
ARCHITECTURE AUDIT — APPROVED FOR SCHED-02 IMPLEMENTATION
```

**Preconditions for claiming “Schedules work” in production:**

1. RC-1 invalidation (or force re-resolve) shipped.  
2. RC-2 time normalization shipped.  
3. Automated SCHED-00x PASS.  
4. Optional: Admin shows effective playback so operators stop trusting only `currentPlaylistId`.

---

## Appendix — Evidence index

| Topic | Path |
|-------|------|
| Form | `src/features/schedules/schedule-form.tsx` |
| API | `src/app/api/admin/schedules/route.ts` |
| Service | `src/services/schedules.ts` |
| Resolver | `src/domain/playback-resolver.ts` |
| Manifest/Sync | `src/services/manifest.ts` (`buildDeviceManifest`, `buildSyncDelta`) |
| Schema | `src/db/schema.ts` (`schedules`, `schedule_targets`, `devices`) |
| Legacy sync | `public/tv.js` (`doSync`, heartbeat version check) |
| Resolver tests (HH:mm only) | `scripts/test-resolver.ts` |
| Assign bumps version | `src/services/devices.ts` |
| Playlist edit bumps linked devices | `src/services/playlists.ts` |

---

**PHASE SCHED-01 STATUS: AUDIT COMPLETE**  
**PHASE SCHED-02:** see `docs/SCHEDULE-EXECUTION-SCHED-02-IMPLEMENTATION.md`
