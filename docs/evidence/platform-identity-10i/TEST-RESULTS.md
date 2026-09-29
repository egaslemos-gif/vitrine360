# PI-10I TEST RESULTS

| Test | Result | Detail |
|------|--------|--------|
| PI10I-FLAG-OFF | PASS | ENTITLEMENTS_ENABLED not forcing ON for this suite |
| PI10I-FOUNDATION-SEPARATE | PASS | contents does not import reservation service directly (quota layer) |
| PI10I-COMMITTED | PASS | committed usage via SUM(file_size) |
| PI10I-SEC-005 | PASS | negative expectedBytes rejected |
| PI10I-ACTUAL-GT | PASS | actual > reserved fail-closed |
| PI10I-ACTUAL-OK | PASS | actual <= reserved ok |
| PI10I-TX-REL-COMMIT | PASS | RELEASED → COMMITTED invalid |
| PI10I-TX-COMMIT-RES | PASS | COMMITTED → RESERVED invalid |
| PI10I-RESERVE | PASS | reserve creates RESERVED |
| PI10I-RESERVED-USAGE | PASS | active reserved = 15MB |
| PI10I-EFFECTIVE | PASS | effective = committed + reserved |
| PI10I-CONCUR-B | PASS | committed 80 + reserved 20 → 1MB DENY |
| PI10I-CONCUR-A | PASS | concurrent 15MB: ok=1 deny=1 reserved=15728640 |
| PI10I-SEC-009 | PASS | same tenant+operationId returns same reservation |
| PI10I-SEC-008 | PASS | cross-tenant same operationId independent |
| PI10I-SEC-002 | PASS | A reservation not releasable by B |
| PI10I-SEC-003 | PASS | A reservation not committable by B |
| PI10I-SEC-001 | PASS | B cannot read A reservation |
| PI10I-CONCUR-E | PASS | double release idempotent |
| PI10I-SEC-007 | PASS | released does not count as active reserved |
| PI10I-LIFE-COMMIT | PASS | commit |
| PI10I-LIFE-COMMIT-USAGE | PASS | COMMITTED no longer active reserved |
| PI10I-LIFE-BAD-COMMIT | PASS | RELEASED → COMMITTED fails |
| PI10I-LIFE-EXPIRED | PASS | mark expired |
| PI10I-LIFE-EXPIRED-USAGE | PASS | EXPIRED not RESERVED |
| PI10I-LIFE-EXP-REL | PASS | EXPIRED → RELEASED allowed |
| PI10I-CHECKSUM-UIDX | PASS | media_assets_tenant_checksum_uidx exists |
| PI10I-SCHEMA | PASS | storage_reservations table |
| PI10I-JOURNAL | PASS | 0008 journaled |
| PI10I-MIG-FILE | PASS | 0008 sql present |
| PI10I-SEC-004 | PASS | no client-facing reservation API |
| PI10I-SEC-006 | PASS | valid status transition known |
| PI10I-SEC-010 | PASS | reservation service has no storage credentials |

Generated: 2026-09-29T20:14:09.330Z
