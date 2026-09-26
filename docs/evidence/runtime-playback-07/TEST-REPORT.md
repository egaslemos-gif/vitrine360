# RUNTIME-PLAYBACK-07 — TEST REPORT

Passed: 66/66

| ID | Name | Result |
|----|------|--------|
| CMD-001 | command creation | PASS |
| CMD-002 | command id | PASS |
| CMD-003 | command serialization | PASS |
| CMD-004 | command type validation | PASS |
| CMD-005 | payload validation | PASS |
| CMD-006 | seek validation | PASS |
| CMD-007 | volume validation | PASS |
| CMD-008 | mute validation | PASS |
| CMD-009 | repeat validation | PASS |
| TARGET-001 | device target | PASS |
| TARGET-002 | wrong device | PASS |
| TARGET-003 | tenant match | PASS |
| TARGET-004 | cross-tenant deny | PASS |
| SESSION-001 | session match | PASS |
| SESSION-002 | stale session | PASS |
| SESSION-003 | reload/new session | PASS |
| SESSION-004 | device/session mismatch | PASS |
| TTL-001 | valid command | PASS |
| TTL-002 | expired command | PASS |
| TTL-003 | zero TTL | PASS |
| TTL-004 | max TTL | PASS |
| TTL-005 | no infinite TTL | PASS |
| IDEMP-001 | first command | PASS |
| IDEMP-002 | duplicate command | PASS |
| IDEMP-003 | duplicate does not re-dispatch | PASS |
| IDEMP-004 | bounded idempotency | PASS |
| IDEMP-005 | idempotency expiry | PASS |
| DISPATCH-001 | PLAY | PASS |
| DISPATCH-002 | PAUSE | PASS |
| DISPATCH-003 | STOP | PASS |
| DISPATCH-004 | NEXT | PASS |
| DISPATCH-005 | PREVIOUS | PASS |
| DISPATCH-006 | RESTART | PASS |
| DISPATCH-007 | SEEK | PASS |
| DISPATCH-008 | VOLUME | PASS |
| DISPATCH-009 | MUTED | PASS |
| DISPATCH-010 | REPEAT | PASS |
| RACE-001 | rapid NEXT | PASS |
| RACE-002 | PAUSE/PLAY | PASS |
| RACE-003 | STOP/NEXT | PASS |
| RACE-004 | stale command | PASS |
| RACE-005 | duplicate NEXT | PASS |
| SEC-001 | no bearer | PASS |
| SEC-002 | no JWT | PASS |
| SEC-003 | no R2 | PASS |
| SEC-004 | no tenant secret | PASS |
| SEC-005 | cross-tenant denial | PASS |
| SEC-006 | unknown command denial | PASS |
| SEC-007 | invalid payload denial | PASS |
| SEC-008 | expired denial | PASS |
| FAIL-001 | fail closed | PASS |
| FAIL-002 | safe error codes | PASS |
| FAIL-003 | controller defensive validation | PASS |
| FAIL-004 | no direct media access | PASS |
| OBS-001 | command result | PASS |
| OBS-002 | correlationId | PASS |
| OBS-003 | command telemetry | PASS |
| OBS-004 | no telemetry storm | PASS |
| MAP-001 | mapping centralized | PASS |
| MAP-002 | empty payload helper | PASS |
| MAP-003 | permission documented | PASS |
| MAP-004 | max bytes | PASS |
| MAP-005 | star device denied | PASS |
| MAP-006 | viewer role denied | PASS |
| MAP-007 | lab exists | PASS |
| MAP-008 | no production API routes | PASS |
