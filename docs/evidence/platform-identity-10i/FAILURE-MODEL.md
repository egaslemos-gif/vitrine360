# FAILURE-MODEL — PI-10I

| Failure | Behavior |
|---|---|
| Invalid expectedBytes | VALIDATION error |
| Tenant missing | NOT_FOUND |
| Over conceptual max | QUOTA_EXCEEDED |
| Duplicate operationId (terminal status) | CONFLICT |
| Duplicate operationId (RESERVED) | Idempotent return |
| Cross-tenant mutate | NOT_FOUND |
| Invalid transition | INVALID_TRANSITION |
| actualBytes > reserved on commit | VALIDATION |

No upload impact. No entitlement flag coupling.
