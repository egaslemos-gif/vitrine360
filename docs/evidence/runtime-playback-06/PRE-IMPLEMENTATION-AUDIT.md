# RUNTIME-PLAYBACK-06 — Pre-Implementation Audit

Date: 2026-09-26  
Scope: PlaybackState, RuntimeState, Presence, Sync, Heartbeat, Device Observability, diagnostics globals, Experience.

**Rule:** No RP-06 implementation changes were applied before this document was written.

---

## A. Sources of truth

| Domain | Authority | Path |
|--------|-----------|------|
| Playback | `PlaybackController` → `PlaybackState` | `src/domain/playback-state.ts`, `src/player/playback/playback-controller.ts` |
| Runtime | `RuntimeStateContract` store | `src/domain/runtime-policy.ts`, `src/player/runtime/state.ts` |
| Presence | `devices.lastSeenAt` + `derivePresence` | `src/services/devices.ts`, `src/domain/types.ts` |
| Sync | `RuntimeState.syncState` (`IDLE\|SYNCING\|READY\|ERROR`) | set in `src/player/sync/engine.ts` |
| Policy | resolved runtime policy | `src/player/runtime/resolve-policy.ts` |

**Invariant:** These four dimensions must not merge into `PlayerMegaState`.

---

## B. Derived data

- Admin `DeviceRuntimeObservability` (`src/domain/device-observability.ts`) from heartbeat `playerState` JSON.
- Presence ONLINE/AWAY/OFFLINE from `lastSeenAt`.
- Lossy bridge in `player-app.tsx`: `isPlaying = status === "PLAYING"`, `currentContentId` → RuntimeState.
- Coarse heartbeat `playerState` string: `"PLAYING"|"IDLE"` — **not** full PlaybackStatus.

---

## C. Transported (heartbeat)

Client `sendHeartbeat` (`src/player/sync/engine.ts`) → `POST /api/device/heartbeat`.

Payload today: `timestamp`, `playerVersion`, `runtimeState` subset, `observedAt`, optional policy/diagnostics, `playlistId`, `contentId`, `playerState`, `resolution`.

**Not transported:** `sessionId`, full `PlaybackStatus`, `positionMs`, `durationMs`, `generation`, `volume`/`mute`/`repeat`, `playlistItemId`, `PlaybackError`, experience phase.

---

## D. Persisted

- `devices.lastSeenAt`, `devices.playerState` (last-write-wins JSON), softwareVersion, screenResolution, manifestVersion.
- **No** player session table, **no** playback event warehouse, **no** telemetry history.

---

## E. Local-only

- Full `PlaybackState`, IndexedDB manifests/assets, `__v360_runtime_state` / `__v360_runtime_policy` / `__v360_runtime_capabilities`, experience bridge state, fullscreen/orientation controllers.

---

## F. Sent to server

Heartbeat observation only. Server must treat as **OBSERVED**, never as playback command authority.

---

## G. Admin-displayed

`DeviceObservabilityPanel` + device detail: presence, coarse PLAYING/IDLE, content, manifest, sync, network, fullscreen/orientation, diagnostics. Live preview placeholder. Remote control **disabled**.

---

## H. Gaps (RP-06)

| ID | Gap | Sev |
|----|-----|-----|
| G-01 | No `PlayerSession` / `sessionId` | HIGH |
| G-02 | No `PlaybackObservation` projection | HIGH |
| G-03 | No essential telemetry events (local bounded queue) | HIGH |
| G-04 | Heartbeat lacks compact observed playback (status/generation/item) | MEDIUM |
| G-05 | Admin cannot show rich status beyond PLAYING/IDLE | MEDIUM |
| G-06 | No sanitization helper for telemetry payloads | MEDIUM |
| G-07 | No `__v360_player_session` / `__v360_playback_observation` diagnostics | LOW |
| G-08 | Experience SEND_EVENT not in scope — keep isolation | INFO |
| G-09 | No remote command APIs (must stay absent) | INFO |

---

## Implementation plan (post-audit)

1. Domain projections: `PlayerSession`, `PlaybackObservation`, telemetry event types — **not** SoT.
2. Client session store (client-only after hydration) + observation from PlaybackState subscription.
3. Bounded in-memory telemetry queue; emit on transitions only (no timeupdate storm).
4. Sanitize errors/URLs before enqueue.
5. Optional compact `playbackObservation` on heartbeat (status, ids, generation, error code — **not** per-tick position).
6. Dev globals for diagnostics; extend admin observability when payload present.
7. Tests ≥30; docs/ADR/evidence; full release gate.
8. **No** DB migration, **no** remote control, **no** production deploy.

## Non-goals confirmed

No WebSocket/SSE, no `/play|/pause|/next` APIs, no PlaybackController authority change, no persistent telemetry warehouse.
