# RUNTIME-PLAYBACK-07 — Command Schema Evidence

## Types

`PLAY | PAUSE | STOP | NEXT | PREVIOUS | RESTART | SEEK | SET_VOLUME | SET_MUTED | SET_REPEAT_MODE`

## TTL

MIN=1000ms DEFAULT=10000ms MAX=60000ms — infinite denied.

## Size

MAX_COMMAND_BYTES = 8192

## Mapping (single file)

`src/domain/command-mapping.ts` — DeviceCommandType → PlaybackAction

## Binding

- SESSION_BOUND: requires matching active PlayerSession
- DEVICE_BOUND: device/tenant only (not used for lab playback buttons)

## Reject reasons (safe codes)

INVALID_STRUCTURE, UNSUPPORTED_COMMAND, INVALID_PAYLOAD, WRONG_TENANT, UNKNOWN_DEVICE, DEVICE_MISMATCH, STALE_SESSION, EXPIRED, UNAUTHORIZED, COMMAND_TOO_LARGE, NOT_AUTHORIZED
