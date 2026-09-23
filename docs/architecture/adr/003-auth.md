# ADR-003: Authentication Model

## Decision

- **Admin:** session-based auth (Auth.js / NextAuth credentials or better-auth) with hashed passwords; RBAC server-side.  
- **Device:** opaque long-lived device token issued at pairing; store only hash in DB; Bearer on Device API.  
- Rotation: admin can revoke/reissue; expired activation codes for pairing only.

## Why

Separation of concerns; never embed admin credentials in Player.

## Consequences

Two auth middlewares; device token compromise scoped to one device.
