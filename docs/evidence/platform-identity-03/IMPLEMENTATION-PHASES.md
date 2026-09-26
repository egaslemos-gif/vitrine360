# PLATFORM-IDENTITY-03 — Future Implementation Phases

Documentation only — naming for later gates.

| Phase | Deliverable | Touches | Must not |
|-------|-------------|---------|----------|
| **PI-04** | Schema + domain types + feature flag | db, domain | UI, billing, JWT permission catalogues |
| **PI-05** | `getAuthContext` dual resolve; platform API stubs | auth, APIs | Auto-promote SUPER_ADMIN |
| **PI-06** | Minimal platform console (tenant list read) | UI platform | Content CRUD shortcuts |
| **PI-07** | Support Session (time-bounded, audited) | platform + tenant bridge | Permanent cross-tenant membership |
| **PI-08** | Entitlements model | Business plane | Mixing into ROLE_PERMISSIONS |
| **PI-09** | Plans / Subscriptions / Billing | Business | Playback / Manifest |

### Ordering constraint (from PI-02)

```text
Platform Identity → Platform Authz → Tenant permission normalization
  → Entitlements → Plans → Subscriptions → Billing
```

### Relation to other programmes

| Programme | Relation |
|-----------|----------|
| RUNTIME-EXPERIENCE-* | Independent; Experience never receives platform JWT |
| LIVE-MEDIA / Campaigns | May later check entitlements — not roles |
| ARCHITECTURE-FUTURE-01 | Business / Control planes own this work |
