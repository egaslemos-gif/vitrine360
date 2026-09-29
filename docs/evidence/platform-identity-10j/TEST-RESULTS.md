# PI-10J TEST RESULTS

| Test | Result | Detail |
|------|--------|--------|
| PI10J-FLAG-OFF | PASS | flag OFF |
| PI10J-FLAG-OFF-UP | PASS | flag OFF upload works |
| PI10J-FLAG-ON | PASS | flag ON |
| PI10J-NO-PLAN | PASS | no plan → DENY |
| PI10J-UNDER | PASS | under quota ALLOW |
| PI10J-COMMITTED | PASS | committed 2000 |
| PI10J-RESERVED-0 | PASS | no active reserved after commit |
| PI10J-OVER | PASS | 2000+4000 > 5000 → DENY |
| PI10J-STILL-2000 | PASS | denied upload does not increase committed |
| PI10J-FIT | PASS | 2000+3000 <= 5000 ALLOW |
| PI10J-CONCUR | PASS | concurrent: ok=1 deny=1 usage=9500 |
| PI10J-SEC-001 | PASS | tenant isolation |
| PI10J-ERROR | PASS | 403 QUOTA_EXCEEDED contract |
| PI10J-DEDUPE | PASS | checksum reuse does not double committed |
| PI10J-FLAG-OFF-2 | PASS | flag OFF no plan upload |
| PI10J-WIRED | PASS | upload paths call storage quota |

Generated: 2026-09-29T20:14:18.542Z
