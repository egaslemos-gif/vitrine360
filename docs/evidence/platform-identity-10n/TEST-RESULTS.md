# PI-10N Test Results

Generated: 2026-09-25T15:27:56.354Z
Passed: 50 / Failed: 0

| ID | Result | Detail |
|----|--------|--------|
| PI10N-FLAG-UNDEF | PASS | undefined → OFF |
| PI10N-FLAG-EMPTY | PASS | empty → OFF |
| PI10N-FLAG-FALSE | PASS | false → OFF |
| PI10N-FLAG-INVALID | PASS | invalid → OFF |
| PI10N-FLAG-TRUE | PASS | true → ON |
| PI10N-FLAG-1 | PASS | 1 → ON |
| PI10N-SEC-001 | PASS | client/request cannot override trusted env OFF |
| PI10N-001 | PASS | flag OFF baseline |
| PI10N-001b | PASS | devices=1 storage=800 |
| PI10N-COMPAT-PLAN | PASS | compatibility_default exists |
| PI10N-COMPAT-BINDINGS | PASS | compat has devices.enabled only — no invented max quotas |
| PI10N-014 | PASS | compat plan without devices.max → fail-closed DENY |
| PI10N-014b | PASS | compat plan without storage.maxBytes → DENY upload |
| PI10N-002 | PASS | flag ON + valid plan resolves |
| PI10N-PLAN-ONE | PASS | exactly one ACTIVE TenantPlan |
| PI10N-003 | PASS | usage < max ALLOW |
| PI10N-004 | PASS | usage = max → DENY |
| PI10N-PAIR-REQ | PASS | pairing request alone does not allocate |
| PI10N-OFFLINE | PASS | OFFLINE still counts |
| PI10N-DISABLED | PASS | DISABLED does not count |
| PI10N-REACTIVATE-OK | PASS | DISABLED→ACTIVE under quota ALLOW |
| PI10N-011 | PASS | downgrade: existing devices preserved (usage>max) |
| PI10N-011b | PASS | downgrade: new allocation DENY |
| PI10N-011c | PASS | DISABLED→ACTIVE DENY when still at max |
| PI10N-005 | PASS | storage under max ALLOW |
| PI10N-006 | PASS | usage+request > max → DENY |
| PI10N-006b | PASS | denied upload does not increase committed |
| PI10N-009 | PASS | dedupe no extra quota / no stuck reserved |
| PI10N-013 | PASS | existing MediaAsset preserved after lower max |
| PI10N-007 | PASS | concurrent device ok=1 deny=1 |
| PI10N-008 | PASS | storage concurrent reserved=15728640 |
| PI10N-010 | PASS | SUSPENDED cannot allocate/upload |
| PI10N-SEC-008 | PASS | SEC suspended |
| PI10N-015 | PASS | tenant isolation |
| PI10N-SEC-004 | PASS | plans are catalogue; TenantPlan is tenant-scoped (isolation via usage) |
| PI10N-SEC-002 | PASS | client cannot choose plan on media API |
| PI10N-SEC-003 | PASS | client cannot choose maxBytes |
| PI10N-SEC-005 | PASS | SUPER_ADMIN no quota bypass |
| PI10N-SEC-006 | PASS | PLATFORM_SUPER_ADMIN no quota bypass |
| PI10N-SEC-007 | PASS | Device Bearer APIs do not allocate |
| PI10N-SEC-009 | PASS | quota path fail-closed when ON |
| PI10N-SEC-009b | PASS | FLAG_OFF is the only soft allow path |
| PI10N-SEC-010 | PASS | flag OFF does not expose client mutation of flag |
| PI10N-OBS-QUOTA | PASS | QUOTA_EXCEEDED distinguishable |
| PI10N-OBS-SUS | PASS | TENANT_NOT_OPERABLE distinguishable |
| PI10N-012 | PASS | rollback flag OFF |
| PI10N-012b | PASS | legacy behaviour restored after rollback |
| PI10N-013b | PASS | baseline tenant resources unchanged by flag toggles |
| PI10N-INTEGRITY | PASS | tenant count not reduced |
| PI10N-PROD-LOCAL | PASS | process env left OFF after suite (rollback) |
