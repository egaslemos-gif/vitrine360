# PI-10G TEST RESULTS

| Test | Result | Detail |
|------|--------|--------|
| PI10G-FLAG-OFF | PASS | flag OFF |
| PI10G-FLAG-OFF-PAIR | PASS | flag OFF pair works without plan |
| PI10G-FLAG-ON | PASS | flag ON |
| PI10G-NO-PLAN | PASS | no ACTIVE plan → DENY |
| PI10G-UNDER | PASS | usage 0 max 1 → ALLOW |
| PI10G-AT-LIMIT | PASS | usage 1 max 1 → DENY QUOTA_EXCEEDED |
| PI10G-USAGE-1 | PASS | final usage = 1 |
| PI10G-EVAL-0 | PASS | max=0 usage=0 DENY |
| PI10G-EVAL-ALLOW | PASS | max=1 usage=0 ALLOW |
| PI10G-EVAL-EQ | PASS | max=1 usage=1 DENY |
| PI10G-SEC-009 | PASS | OFFLINE still consumes capacity |
| PI10G-SEC-008 | PASS | DISABLED does not consume capacity |
| PI10G-REACTIVATE-OK | PASS | reactivate under quota ALLOW |
| PI10G-DOWNGRADE-USAGE | PASS | after downgrade usage stays 5 > max 2 |
| PI10G-DOWNGRADE-BLOCK | PASS | new allocation DENY after downgrade |
| PI10G-SEC-010 | PASS | DELETE allowed under overage |
| PI10G-SEC-011 | PASS | DISABLE allowed under overage |
| PI10G-REACTIVATE-DENY | PASS | reactivate when still over quota DENY |
| PI10G-AFTER-FREE | PASS | usage 1 after deletes (1 disabled not counted) |
| PI10G-REACTIVATE-AFTER | PASS | reactivate ALLOW when usage < max |
| PI10G-UPGRADE | PASS | upgrade then create ALLOW |
| PI10G-SEC-001 | PASS | tenant isolation |
| PI10G-ERROR | PASS | 403 QUOTA_EXCEEDED contract |
| PI10G-SEC-002 | PASS | client cannot override usage |
| PI10G-SEC-003 | PASS | client cannot override max |
| PI10G-SEC-007 | PASS | Suspended tenant not operable (API gate) |
| PI10G-PENDING | PASS | PENDING unpaired does not inflate tenant B count |
| PI10G-FLAG-OFF-2 | PASS | flag OFF bypasses quota |
| PI10G-SEC-012 | PASS | allocation paths use quota lock |
| PI10G-NO-STORAGE | PASS | no storage quota in devices |
| PI10G-CONCUR-1 | PASS | concurrent max=1: success=1 deny=1 usage=1 |
| PI10G-CONCUR-10 | PASS | burst: ok=1 deny=9 other=0 usage=10 |

Generated: 2026-09-29T20:14:07.781Z

ENTITLEMENTS_ENABLED remains OFF by default in production.
