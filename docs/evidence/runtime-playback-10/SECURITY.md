# SECURITY

## Tenant Isolation
All database access to `device_command_inbox` enforces `tenantId`:
```typescript
eq(deviceCommandInbox.tenantId, tenantId)
```

## Device Authority
The endpoints handling device communication (`POST /api/device/commands` and `POST /api/device/commands/:id/ack`) strictly enforce `authenticateDevice`, guaranteeing the Device Bearer token is validated.

## Secret Redaction
The system enforces that no credentials leak into command payloads.
```typescript
// From src/domain/device-command.ts
if (/Bearer\s+\S+|AUTH_SECRET|deviceToken|R2_|AWS_SECRET/i.test(blob)) {
  return { ok: false, reason: "INVALID_PAYLOAD" };
}
```

## User vs. Device Contexts
- Admin UI uses session-based authentication to read/write commands.
- Devices use Bearer tokens to poll and ack.
- These contexts do not cross. User UI never handles or returns Device Bearers.
