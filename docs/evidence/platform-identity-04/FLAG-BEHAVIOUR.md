# PLATFORM-IDENTITY-04 — FLAG BEHAVIOUR

## `PLATFORM_IDENTITY_ENABLED`

| Input | Result |
|-------|--------|
| undefined / absent | **false** |
| `""` | **false** |
| `false` / `0` / `no` / `off` | **false** |
| `true` / `1` / `yes` / `on` (case-insensitive) | **true** |

## Surfaces

- Reader: `src/lib/platform-identity-flag.ts`
- Repository gates on flag (`DISABLED` error when off)
- Not readable from request body/query/headers as authority
- Not exposed as a client-writable setting in PI-04

## Semantics

| Flag | Behaviour |
|------|-----------|
| **false** | App behaviour matches pre-PI-04. Repository refuses Platform ops. |
| **true** | Persistence + domain available. **No** automatic platform privileges. JWT/session/guards unchanged. |

Enabling ≠ granting. Assignments must be explicit; authz wiring is PI-05+.
