# RUNTIME-PLAYBACK-08 — Security Model

## Authentication (Device Runtime)

| Allowed | Forbidden |
|---------|-----------|
| Device Bearer (existing) | Tenant admin JWT |
| Future short-lived **device-scoped** connection token derived from Device Bearer | Admin session cookies |
| HTTPS / TLS | Cleartext command channels |

`sessionId` is **not** a secret and **not** an authentication credential — correlation / stale protection only.

## Authorization (Server-side only)

```
Admin Session → RBAC (manage_devices) → Tenant → Device ownership
  → Command creation → Transport → Device → Dispatcher → PlaybackController
```

Device Runtime **must not** decide whether the admin is authorized.

## Tenant isolation

| Case | Result |
|------|--------|
| Tenant A → Device A | ALLOW (if authz ok) |
| Tenant A → Device B | DENY |
| Tenant B → Device A | DENY |
| Cross-tenant broadcast | DENY |

Server validates `tenantId` / `deviceId`; client-supplied fields are never trusted as authority.

## Replay protection

`commandId` + `expiresAt` + device/session binding + server authorization.

Do not rely on timestamp alone.

## Transport security checklist

| Control | Requirement |
|---------|-------------|
| HTTPS / TLS | Required |
| CORS | Device same-origin primary; no broad public command CORS |
| CSRF | Prefer Authorization header Bearer (not cookie-auth for device) |
| Cache-Control | `no-store` on command inbox responses |
| Proxy caching | Commands must not be cacheable |
| Secrets in envelopes | Forbidden (no Bearer/JWT/R2/signed URLs inside Command) |
| R2 | **Not** a command bus (media only) |

## Envelope (future wire)

```json
{
  "commandId": "cmd_…",
  "tenantId": "…",
  "deviceId": "…",
  "sessionId": "…",
  "type": "PAUSE",
  "payload": {},
  "issuedAt": 0,
  "expiresAt": 0,
  "correlationId": "…"
}
```

Server re-validates identity against Device Bearer subject, not envelope trust.

## Privacy / telemetry fields (future)

Prefer: commandId, deviceId, tenant-scoped ids, type, status, latency.  
Never: JWT, bearer, signed URL, secrets, arbitrary media blobs, unnecessary PII.
