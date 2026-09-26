# RUNTIME-EXPERIENCE-11 — Pre-Implementation Audit

Date: 2026-09-23  
Phase gate: **AUDIT ONLY** (this document precedes code changes)  
Planes: Experience · Distribution · Device Runtime  
Architecture: ARCHITECTURE-FUTURE-01 DOCUMENTED

## 1. Current flow

```text
Content (EXPERIENCE pin)
  → Playlist item (contentId only)
  → Manifest finalizeManifestItem
       payload.experience { experienceId, version }
       experienceExecutable / experienceBlockReason
  → Device sync
  → DisplayEngine / tv.js
```

### React today (`display-engine.tsx` ~237–277)

- Renders **safe-fallback** UI only (`data-experience-playback="safe-fallback"`).
- Blocked → `EXPERIENCE_UNAVAILABLE`.
- Executable pin → `PENDING_RUNTIME` / “awaiting Runtime admission”.
- **Does not** call admission, mount iframe, or `ExperienceRuntimeShell`.
- Slide still advances on `durationMs` like other non-VIDEO types.

### Legacy today (`public/tv.js`)

- Branded fallback `EXPERIENCE_UNSUPPORTED`.
- **Must remain non-executing** in EX-11 (Smart TV / dual-runtime rule).

## 2. Exact integration point

| Runtime | File | Lines / marker |
|---------|------|----------------|
| React Player | `src/player/playback/display-engine.tsx` | EXPERIENCE branch (~237–277) |
| Player host | `src/features/player/player-app.tsx` | Passes `PlaybackItem[]` into `DisplayEngine` |
| Policy shell | `src/player/runtime/shell.tsx` | Fullscreen/orientation/cursor — separate from Experience |

**Decision:** Replace the React EXPERIENCE safe-fallback *execution path* with an Experience Playback Controller that admits then hosts Runtime Shell. Keep fallback UI when admission fails or flags block execution.

## 3. Modules to reuse (do not duplicate)

| Concern | Module |
|---------|--------|
| Pin / sanitize | `src/domain/experience-content-ref.ts` |
| Package record | `src/services/experience-package-store.ts` |
| Admission | `admitExperienceForDevice` — `experience-admission.ts` |
| Runtime lifecycle | `ExperienceRuntimeController` — `experience-runtime.ts` |
| UI host | `ExperienceRuntimeShell` — `features/experience-runtime/` |
| Sandbox + bridge | `ExperienceSandboxFrame`, `ExperienceBridgeHost` |
| Origin URL | `experience-origin.ts`, `/x/...` route |
| Player capabilities | `probeRuntimeCapabilities`, `resolvePlayerRuntimePolicy` |

## 4. Modules that must not be duplicated

- Second registry / publication state machine  
- Second sandbox/CSP builder  
- Second bridge protocol / privilege matrix  
- Parallel lifecycle phases outside `ExperienceRuntimeController`  
- Manifest “execution URL” field  
- Legacy `tv.js` HTML/iframe execution path  

## 5. Recommended new abstraction

| Item | Path |
|------|------|
| Controller (adapter) | `src/player/runtime/experience-controller.ts` (or `src/player/playback/experience-playback.tsx` host) |
| Role | Orchestrate **admit → shell → stop/cleanup**; expose player-friendly API |
| Must not | Re-implement Runtime Core internals |

Conceptual API (EX-11):

```typescript
interface ExperiencePlaybackController {
  start(input: ExperiencePlaybackInput): Promise<ExperienceRuntimeHandle>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isRunning(): boolean;
  getState(): ExperienceRuntimeState;
}
```

`start` obtains `ExperienceAdmissionGranted` then delegates to existing Runtime Core / Shell.

## 6. Risks

| Risk | Mitigation |
|------|------------|
| Skip admission | Always `admitExperienceForDevice` before shell |
| In-memory package store | Document limitation; no persistent store in EX-11 |
| Origin misconfig | Fail closed → safe-fallback |
| durationMs cuts interactive session | Keep existing duration semantics unless phase says otherwise; document |
| Dual instance | Single controller; cleanup on slide change / unmount |
| Tokens to iframe | Forbidden — bridge/read-only only |
| Legacy parity pressure | Explicit: tv.js stays unsupported execution |
| Guardrail violation | This audit + phase doc authorize wire-up |

## 7. Decisions (before code)

1. **Playback Engine knows `type === EXPERIENCE` only** — details live in Experience Playback Controller / Shell.  
2. **Admission is mandatory** — PUBLISHED ≠ ADMITTED.  
3. **Reuse EX-10 Shell** — do not fork lifecycle.  
4. **tv.js remains non-exec** — EXPERIENCE_UNSUPPORTED.  
5. **No Live Media / Network FULL / Camera / Billing** in this phase.  
6. **No Experience persistent storage** — keep package store as-is.  
7. **Manifest unchanged** for credentials / execution URLs.  
8. Offline native types (IMAGE/VIDEO/CLOCK/…) must not regress.

## 8. Non-goals (confirm)

Live Media, Streaming, WebRTC, HLS/DASH, Camera/Mic, Surveillance, Campaigns, Billing, Entitlements, Analytics pipeline, Experience network permissions, Fullscreen/Orientation bridge methods, arbitrary fetch.

## 9. Evidence / next

After this audit: implement controller + React wire-up + tests + `docs/RUNTIME-EXPERIENCE-11-*.md` + evidence checklist.

**PRE-IMPLEMENTATION AUDIT — COMPLETE**  
Code changes may proceed under RUNTIME-EXPERIENCE-11.
