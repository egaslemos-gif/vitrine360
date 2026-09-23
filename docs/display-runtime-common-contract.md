# Display Runtime Common Contract

Status: conceptual contract only. React and Legacy implementations remain separate.

## Purpose

Both runtimes must express the same architectural concepts even when their browser APIs, storage, rendering, and compatibility behavior differ.

## Common concepts

### Presentation Policy

```text
presentation: VIEWPORT | FULLSCREEN_REQUESTED
```

This is desired policy, not proof that the browser entered fullscreen.

### Cursor Policy

```text
cursor: ALWAYS_VISIBLE | AUTO_HIDE | ALWAYS_HIDDEN
idleTimeoutMs: optional number
```

The current implementation supports the `AUTO_HIDE` behavior conceptually in both runtimes. The React CSS conflict is a separate implementation defect.

### Interaction Policy

```text
interaction: PASSIVE | TOUCH | QR | HYBRID
```

`PASSIVE` is the only implemented runtime mode. Remote input must not be inferred from keyboard support.

### Orientation Policy

```text
orientation: LANDSCAPE | PORTRAIT | AUTO
```

This expresses desired presentation. Actual device orientation and Screen Orientation API support remain runtime observations.

### Capability Snapshot

A timestamped set of probe results using:

```text
SUPPORTED | UNSUPPORTED | UNKNOWN | ERROR
```

The snapshot is diagnostic and should not silently overwrite Device policy.

### Runtime State

At minimum:

```text
phase: BOOT | PAIRING | CLAIMING | PLAYING | ERROR
network: ONLINE | OFFLINE | UNKNOWN
playback: IDLE | PLAYING | PAUSED | ERROR
cursor: VISIBLE | HIDDEN
fullscreen: ACTIVE | INACTIVE | DENIED | UNAVAILABLE
currentContentId: optional identifier
manifestVersion: number
```

## Runtime-specific responsibilities

### React implementation

May retain:

- React lifecycle and hooks;
- `DisplayEngine`;
- IndexedDB `CURRENT`/`NEXT` activation;
- Service Worker offline shell;
- browser feature probes;
- React-specific diagnostics.

### Legacy implementation

May retain:

- ES5-compatible DOM rendering;
- localStorage pairing configuration;
- XHR transport;
- Smart TV-specific fallback behavior;
- Cache API/IndexedDB only when safely supported;
- independent static shell.

## Compatibility rule

The two runtimes must agree on semantics, not on implementation details. A capability unavailable in Legacy must produce a defined fallback rather than silently claiming parity with React.

## Known divergence to manage

- `public/tv.js` is the current static fallback.
- `public/player-smarttv.js` is an older parallel implementation.
- Their versions, cache behavior, pairing details, and feature coverage differ.
- No consolidation is proposed in this phase; one canonical runtime should be selected in a future migration decision.

## Non-goals

No shared code module, API, manifest field, schema change, sync change, or runtime feature is introduced by this contract.
