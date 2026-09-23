# Runtime Policy Semantics

Status: conceptual semantics only. No state machine or policy implementation is introduced here.

## Separate meanings

| Term | Meaning |
|---|---|
| `REQUESTED` | The desired behavior expressed by configuration or an experience requirement |
| `SUPPORTED` | The relevant capability probe succeeded |
| `EFFECTIVE` | The policy selected after precedence and compatibility evaluation |
| `ACTIVE` | The runtime is currently applying the effective behavior |
| `UNAVAILABLE` | The requested behavior cannot be provided in this environment |
| `DENIED` | The browser/OS rejected an otherwise possible request |
| `FALLBACK` | A defined alternative behavior is being used |

These states are not interchangeable. `SUPPORTED` does not mean `ACTIVE`; `REQUESTED` does not mean `EFFECTIVE`.

## Fullscreen examples

### Unsupported

```text
requested: FULLSCREEN
capability: UNSUPPORTED
effective: VIEWPORT
status: FALLBACK
```

### Requires activation

```text
requested: FULLSCREEN
capability: SUPPORTED
request: not yet user-activated
status: PENDING_USER_ACTIVATION
```

`PENDING_USER_ACTIVATION` is a diagnostic sub-state, not a replacement for the core vocabulary. After a user gesture, the result becomes `ACTIVE` or `DENIED`.

### Denied

```text
requested: FULLSCREEN
capability: SUPPORTED
request: rejected by browser or policy
effective: VIEWPORT
status: DENIED
```

## Interaction example

```text
device policy: PASSIVE
experience requirement: TOUCH
touch capability: UNSUPPORTED
result: INCOMPATIBLE
effective policy: PASSIVE or operator-selected fallback
```

The experience requirement must not silently mutate the device policy to `TOUCH`.

## Offline example

```text
requested: OFFLINE_CONTINUITY
capability: indexedDB=SUPPORTED, mediaBlobStorage=UNKNOWN
effective: TEXT_CONTINUITY_ONLY
status: FALLBACK
```

This is preferable to claiming full offline support when the manifest exists but video assets are not safely persisted.

## State transition principle

```text
REQUESTED
  -> capability evaluation
  -> EFFECTIVE or INCOMPATIBLE
  -> ACTIVE, FALLBACK, DENIED, or UNAVAILABLE
```

The runtime may report `UNKNOWN` capability without changing domain configuration.

## Non-goals

This document does not implement Fullscreen API, Touch Runtime, Orientation API, policy entities, migrations, or state persistence.
