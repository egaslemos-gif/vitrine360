# RUNTIME-PLAYBACK-06 — TEST REPORT

Passed: 51/51

| ID | Name | Result |
|----|------|--------|
| SESSION-001 | session creation | PASS |
| SESSION-002 | unique sessionId | PASS |
| SESSION-003 | session lifecycle | PASS |
| SESSION-004 | session reload | PASS |
| SESSION-005 | session timestamp | PASS |
| SESSION-006 | deterministic hydration | PASS |
| OBS-001 | playback observation | PASS |
| OBS-002 | runtime observation | PASS |
| OBS-003 | presence separation | PASS |
| OBS-004 | sync separation | PASS |
| OBS-005 | current content | PASS |
| OBS-006 | playlist identity | PASS |
| OBS-007 | position | PASS |
| OBS-008 | duration | PASS |
| OBS-009 | generation | PASS |
| OBS-010 | repeat mode | PASS |
| TELEM-001 | session started | PASS |
| TELEM-002 | session ready | PASS |
| TELEM-003 | playback started | PASS |
| TELEM-004 | playback paused | PASS |
| TELEM-005 | playback stopped | PASS |
| TELEM-006 | item changed | PASS |
| TELEM-007 | playback error | PASS |
| TELEM-008 | sync completed | PASS |
| TELEM-009 | runtime error | PASS |
| TELEM-010 | event deduplication | PASS |
| TELEM-011 | event id | PASS |
| TELEM-012 | bounded queue | PASS |
| TELEM-013 | telemetry failure isolation | PASS |
| TELEM-014 | offline behavior | PASS |
| TELEM-015 | error sanitization | PASS |
| SEC-001 | no bearer | PASS |
| SEC-002 | no JWT | PASS |
| SEC-003 | no R2 credentials | PASS |
| SEC-004 | no signed URL leakage | PASS |
| SEC-005 | no tenant secret | PASS |
| SEC-006 | experience isolation | PASS |
| ADMIN-001 | now playing | PASS |
| ADMIN-002 | playback state | PASS |
| ADMIN-003 | sync state | PASS |
| ADMIN-004 | presence | PASS |
| ADMIN-005 | runtime state | PASS |
| ADMIN-006 | last error | PASS |
| PERF-001 | no timeupdate telemetry storm | PASS |
| PERF-002 | no 16ms re-render loop | PASS |
| PERF-003 | bounded telemetry queue | PASS |
| INV-001 | PlaybackController remains SoT | PASS |
| INV-002 | globals documented | PASS |
| INV-003 | project session | PASS |
| INV-004 | dedupe key | PASS |
| INV-005 | reset helper | PASS |
