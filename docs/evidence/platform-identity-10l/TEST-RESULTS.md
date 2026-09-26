# PI-10L Test Results

Generated: 2026-09-25T15:27:47.274Z
Passed: 41 / Failed: 0
R2: exercised

| ID | Result | Detail |
|----|--------|--------|
| PI10L-FLAG-OFF | PASS | flag OFF default |
| PI10L-EXPECTED-1 | PASS | expectedBytes <= 0 reject |
| PI10L-EXPECTED-2 | PASS | negative reject |
| PI10L-EXPECTED-3 | PASS | NaN reject |
| PI10L-EXPECTED-4 | PASS | Infinity reject |
| PI10L-EXPECTED-5 | PASS | fractional reject |
| PI10L-EXPECTED-6 | PASS | > MAX reject |
| PI10L-EXPECTED-7 | PASS | valid integer ok |
| PI10L-EXPECTED-8 | PASS | string reject |
| PI10L-ACTUAL-LT | PASS | actual < reserved ok |
| PI10L-ACTUAL-GT | PASS | actual > reserved deny |
| PI10L-ACTUAL-LT-COMMIT | PASS | after commit with actual<reserved, reserved freed fully |
| PI10L-ACTUAL-LT-USAGE | PASS | committed=7000 reserved=0 |
| PI10L-SEC-004 | PASS | actual > reserved cannot commit |
| PI10L-SEC-004b | PASS | failed commit leaves RESERVED until release |
| PI10L-CL-1 | PASS | R2 signs ContentLength + ContentType |
| PI10L-CL-2 | PASS | provider contract requires contentLength |
| PI10L-CL-3 | PASS | prepare passes fileSize as signed contentLength |
| PI10L-CL-4 | PASS | browser PUT sends Content-Length |
| PI10L-SEC-007 | PASS | credentials never in browser path; only signed URL |
| PI10L-SEC-001 | PASS | complete key is tenant-scoped server-side |
| PI10L-SEC-002 | PASS | object key server-generated; not client storageKey |
| PI10L-EXPIRY | PASS | signed URL expiry 900s |
| PI10L-SEC-003 | PASS | client cannot set reservedBytes after prepare |
| PI10L-CL-R2-VALID | PASS | R2 rejects contentLength<=0 |
| PI10L-CL-R2-SIGNED | PASS | signed URL includes exact length |
| PI10L-R2-PUT-OK | PASS | within-limit PUT status=200 |
| PI10L-R2-PUT-OVER | PASS | oversized PUT rejected status=403 |
| PI10L-R2-ENV | PASS | real R2 credentials used |
| PI10L-SCHEMA-IDX | PASS | present=true unique=true |
| PI10L-SEC-010 | PASS | integrity status=OK (observable) |
| PI10L-HIST-DUP | PASS | no historical duplicates |
| PI10L-MIG | PASS | 0008 journaled with unique index |
| PI10L-SEC-005 | PASS | assets=1 ids=1 |
| PI10L-SEC-009 | PASS | dedupe does not inflate committed |
| PI10L-SEC-006 | PASS | cross-tenant checksum isolated |
| PI10L-DEDUPE-QUOTA | PASS | dedupe hit: one committed, no stuck reserved |
| PI10L-CLEANUP-A | PASS | PUT failure path: reservation released |
| PI10L-SEC-008 | PASS | failed upload creates no committed asset |
| PI10L-RESERVE-FIRST | PASS | quota still reservation-first |
| PI10L-ENSURE | PASS | ensureSchema uses integrity helper (no silent catch-as-OK) |
