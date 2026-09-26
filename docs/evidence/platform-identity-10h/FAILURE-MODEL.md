# FAILURE-MODEL — PI-10H

| Failure | Quota impact (future with reservation) | Today |
|---|---|---|
| Reservation create fails | No reserve; upload must not proceed | N/A |
| R2 upload fails | Release reservation | No DB row |
| DB commit fails | Release reservation; orphan blob possible | Orphan blob |
| Checksum/MIME validation fails | Release; delete blob if possible | Delete blob + throw |
| actualBytes > reserved | **FAIL CLOSED** reject; release | HEAD mismatch throws |
| R2 delete fails | Committed unchanged | Delete aborted |
| DB delete fails after R2 delete | Orphan; committed may still count until fixed | Orphan |
| Timeout / crash mid-upload | Reservation EXPIRED→RELEASED (future) | Orphan blob |
| Retry same operationId | Reuse reservation; no double reserve | Checksum reuse only |

## HARD_LIMIT posture

**Fail closed** on uncertainty: missing entitlement, invalid size, reservation conflict, actual > reserved.

**Fail open is forbidden** for quota decisions when `ENTITLEMENTS_ENABLED=ON`.

Flag OFF: current behavior preserved (no storage quota).
