# ERROR-CONTRACT — PI-10D

```json
{
  "error": "Entitlement denied",
  "code": "ENTITLEMENT_DENIED",
  "entitlement": "devices.enabled"
}
```

- HTTP status: **403**
- No SQL, stack traces, tokens, secrets, or cross-tenant data
- Implemented in `handleApiError` for `EntitlementDeniedError`
