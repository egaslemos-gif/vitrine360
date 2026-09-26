# PI-10K Test Results

Generated: 2026-09-25T15:27:38.970Z
Passed: 36 / Failed: 0

| ID | Result | Detail |
|----|--------|--------|
| PI10K-ARCH-001 | PASS | quota paths use central resolver, not PlanEntitlement |
| PI10K-ARCH-002 | PASS | device allocation lock + no bare BEGIN |
| PI10K-ARCH-003 | PASS | heal paths reserve growth |
| PI10K-ARCH-004 | PASS | default flag OFF |
| PI10K-ENT-001 | PASS | effective entitlements resolve |
| PI10K-ENT-002 | PASS | devices.max + storage.maxBytes present |
| PI10K-CONC-STORAGE | PASS | ok=1 deny=1 committed=83886080 reserved=15728640 |
| PI10K-SEC-002 | PASS | cross-tenant same operationId independent |
| PI10K-SEC-013 | PASS | assets=1 uniqueIds=1 |
| PI10K-SEC-014 | PASS | cross-tenant checksum isolated assets |
| PI10K-FLAG-OFF | PASS | flag OFF: upload+pair without plan |
| PI10K-FLAG-ON-NOPLAN | PASS | flag ON no plan denies |
| PI10K-FLAG-ON-QUOTA | PASS | flag ON quota deny |
| PI10K-FC-NO-TENANT | PASS | empty tenant deny |
| PI10K-SEC-009 | PASS | SUSPENDED cannot allocate device or upload |
| PI10K-FC-WRONG-TENANT | PASS | cannot release other tenant reservation |
| PI10K-SEC-011 | PASS | actual > reserved cannot commit |
| PI10K-SEC-012 | PASS | same operationId idempotent |
| PI10K-RES-CONFLICT | PASS | incompatible operationId params conflict |
| PI10K-RES-EXPIRED-HELD | PASS | overdue still RESERVED until next reserve |
| PI10K-RES-LAZY-EXPIRE | PASS | lazy release frees overdue then allows new reserve |
| PI10K-SEC-003 | PASS | client cannot supply maxBytes/quotaApproved; tenant from session |
| PI10K-SEC-006 | PASS | quota services have no role bypass |
| PI10K-ERR-CONTRACT | PASS | error contract safe |
| PI10K-DEVICE-BOUND | PASS | heartbeat/sync do not allocate quota |
| PI10K-HEAL-OP | PASS | heal operationId helper |
| PI10K-SCHEMA-DEDUP | PASS | dedupe unique + reservations in schema |
| PI10K-SEC-001 | PASS | device quotas isolated per tenant |
| PI10K-SEC-004 | PASS | usage not client-approved on media route |
| PI10K-SEC-005 | PASS | no quotaApproved trust |
| PI10K-SEC-007 | PASS | no platform bypass hooks |
| PI10K-SEC-008 | PASS | device bearer APIs do not create media/pair/reserve |
| PI10K-SEC-010 | PASS | reserve before put on buffer path |
| PI10K-DOWNGRADE | PASS | BLOCK NEW + ALLOW EXISTING |
| PI10K-REACTIVATE | PASS | DISABLED→ACTIVE is NEW allocation under max=0 |
| PI10K-CONC-DEVICE | PASS | ok=1 deny=1 other=0 usage=1 |
