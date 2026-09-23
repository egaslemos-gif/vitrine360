# Vitrine360 — Display Runtime Architecture Hardening Report

Status: **ARCHITECTURE HARDENING COMPLETE**  
Scope: audit, documentation, and the authorised React cursor CSS conflict fix only.

## 1. Cursor React

Evidence:

- `src/features/player/player-app.tsx`
  - `CURSOR_IDLE_TIMEOUT_MS = 3000`
  - listens to `mousemove`, `mousedown`, `touchstart`, and `keydown`;
  - shows the cursor on activity and hides it after three seconds;
  - cleans the timeout and listeners on unmount.
- `src/app/globals.css`
  - previously applied `cursor: none !important` to the complete player tree.

Finding:

The global `!important` rule overrode the React root's inline `cursor: auto`, so the implemented idle interaction could not reliably reveal the cursor.

Action:

Only the conflicting global CSS rule was removed. Playback, natural video duration, DisplayEngine, and Legacy Player were not changed.

Validation status:

The automated gates pass. The desktop browser reached the React player but remained in `PAIRING`/without a playback surface, so the complete `hidden -> visible -> hidden` interaction could not be observed. Therefore `CURSOR REGRESSION FIX — VALIDATED` is not declared.

## 2. Legacy players

### `public/tv.js`

Current primary legacy runtime. It contains pairing, claim polling, sync, heartbeat, slideshow, media fallback, cursor idle behavior, and Smart TV compatibility logic.

### `public/player-smarttv.js`

Older parallel static player. It has overlapping pairing and slideshow responsibilities but does not track the current behavior of `tv.js` consistently.

### References

- `public/tv.html` loads `tv.js`.
- `public/player-smarttv.html` loads `tv.js?v=013`, despite its older page/version identity.
- React routing redirects fragile browsers to `/tv.html` through:
  - `src/app/player/page.tsx`;
  - `src/features/player/player-app.tsx`.

Differences include versioning, expiry handling, claim behavior, cache strategy, offline behavior, and recent media recovery fixes.

Recommendation: **D — investigate more, then deprecate one deliberately**. Do not remove either file now. First choose one canonical legacy runtime, create a migration/evidence plan, and keep the other as an explicitly labelled compatibility fallback until replacement is proven.

## 3. User-Agent routing

### `src/player/device/fragile-tv.ts`

`isFragileSmartTvBrowser()` matches:

```text
Sraf, Web0S, Tizen, SmartTV, NetRange, HbbTV, Maple, Viera, Hisense, VIDAA
```

Purpose:

- avoid React/Next hydration on fragile TV browsers;
- skip IndexedDB on known problematic devices;
- skip Service Worker registration on those devices;
- route to the static player.

### `src/app/player/page.tsx`

An inline pre-hydration check matches the same browser family list and redirects to `/tv.html?v=015`. It also supports `?tv=1`.

### `src/features/player/player-app.tsx`

Repeats the fragile-browser decision after hydration and redirects to `/tv.html?v=013`.

Risks:

- multiple redirect versions are inconsistent;
- User-Agent can be absent, spoofed, or incomplete;
- a browser can match the family but support more or fewer features than expected;
- capability detection is not currently used to replace the routing decision.

Recommendation:

- retain User-Agent routing as an early safety fallback for known fragile browsers;
- complement it later with bounded feature probes;
- never use User-Agent alone to claim offline, video, fullscreen, touch, or remote-input support;
- do not alter routing in this hardening task.

## 4. Capability model

The conceptual probe contract is documented in:

`docs/runtime-capability-probe-contract.md`

Required result vocabulary:

```text
SUPPORTED | UNSUPPORTED | UNKNOWN | ERROR
```

Important rule:

```text
remoteInput != keyboard
```

A remote control may generate keyboard, pointer, vendor-specific, or no browser events. Support requires environment evidence.

## 5. Policy semantics

The conceptual semantics are documented in:

`docs/runtime-policy-semantics.md`

The audit distinguishes:

```text
REQUESTED
SUPPORTED
EFFECTIVE
ACTIVE
UNAVAILABLE
DENIED
FALLBACK
```

For example, requested fullscreen with no user activation is not `ACTIVE`; it is pending/denied/fallback depending on the browser result.

## 6. Precedence

The conceptual precedence is:

```text
Tenant Defaults
      ↓
Device Policy
      ↓
Experience Requirements
      ↓
Capability Evaluation
      ↓
Effective Runtime Policy
```

Experience requirements may be evaluated against Device policy, but cannot silently overwrite it.

Example:

```text
Device interaction = PASSIVE
Experience requires = TOUCH
Result = INCOMPATIBLE
```

The result must not silently become `interaction = TOUCH`.

Minimum outcomes:

- `SUPPORTED`
- `INCOMPATIBLE`
- `FALLBACK`

## 7. React/Legacy contract

The common conceptual contract is documented in:

`docs/display-runtime-common-contract.md`

Shared semantics:

- Presentation Policy;
- Cursor Policy;
- Interaction Policy;
- Orientation Policy;
- Capability Snapshot;
- Runtime State.

Implementation-specific details remain separate:

- React hooks, DisplayEngine, IndexedDB CURRENT/NEXT and PWA Service Worker;
- Legacy ES5 DOM, localStorage, XHR and conservative Smart TV fallback.

No shared runtime module is introduced now.

## 8. Remaining risks

1. React cursor conflict was corrected in CSS; it still requires functional validation.
2. Legacy player duplication can cause behavioral drift.
3. Redirect versions `v=013` / `v=015` are inconsistent with the current static player version.
4. Fullscreen is only a PWA/CSS request; Web Fullscreen API is not implemented.
5. `displayType`, `interactionMode`, and `orientation` are persisted metadata, not effective runtime policy.
6. Capability detection is primarily User-Agent based.
7. Offline schedule transitions are not evaluated locally.
8. Hisense/VIDAA offline reload remains a known platform limitation.
9. Video offline support depends on successful browser storage and asset persistence.
10. Heartbeat and sync failures are not represented by a durable offline event queue.
11. Heartbeat configuration naming requires a separate consistency cleanup.

## 9. Recommended next implementation phase

Do not start it as part of this task. When approved, the next phase should:

1. Define the policy/capability/state types without persisting them yet.
2. Build a non-invasive capability probe harness.
3. Add a browser matrix for Desktop, Android TV Chrome, and Hisense/VIDAA.
4. Define telemetry minimisation and retention.
5. Resolve the canonical Legacy runtime and deprecation plan.
6. Add tests for policy precedence and incompatibility.
7. Only after that, design Fullscreen behavior and user-activation fallback.

Explicitly excluded from this phase:

- Fullscreen API;
- Touch Runtime;
- Orientation API;
- Experience Runtime or sandbox;
- DeviceRuntimeConfig;
- EffectiveRuntimePolicy entity;
- migrations/schema/API/manifest/sync/playlist/storage changes.

## Final classification

**DISPLAY RUNTIME ARCHITECTURE HARDENING — COMPLETE**

Classification: **NEEDS FURTHER INVESTIGATION**, because the desktop Cursor Idle functional test still requires a paired playback session. This does not mean Fullscreen is implemented or that the Hisense/VIDAA offline limitation is resolved.
