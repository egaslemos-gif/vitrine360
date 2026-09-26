# SECURITY — PI-10H

| ID | Invariant | Status |
|---|---|---|
| SEC-STORAGE-001 | Storage usage tenant-scoped | Design: preserve (`getTenantStorageUsage` already scoped) |
| SEC-STORAGE-002 | Client cannot define usage | Design: server SUM / measured sizes |
| SEC-STORAGE-003 | Client cannot define quota | Design: PlanEntitlement only |
| SEC-STORAGE-004 | Client cannot release other tenant reservation | Design: future API tenant-bound |
| SEC-STORAGE-005 | Checksum dedupe tenant-scoped | Current code: yes |
| SEC-STORAGE-006 | R2 credentials never exposed | Current: server env; signed URLs only |
| SEC-STORAGE-007 | Reservation cannot cross tenant | Design |
| SEC-STORAGE-008 | Storage quota server-side | Design (like devices.max) |
| SEC-STORAGE-009 | Failed upload cannot permanently consume quota | Requires reservation expiry |
| SEC-STORAGE-010 | Races cannot bypass HARD_LIMIT | Requires atomic reserve |
| SEC-STORAGE-011 | Orphan cleanup cannot delete other tenant | Design: key prefix + tenant check |
| SEC-STORAGE-012 | Physical metadata cannot override DB authz | Design: RBAC/lifecycle remain first |

Gap today: direct path trusts client checksum (not re-hashed from object). Future enforcement should treat HEAD size as binding and prefer server-side hash when feasible.
