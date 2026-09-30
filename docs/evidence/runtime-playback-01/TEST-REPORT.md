# RUNTIME-PLAYBACK-01 — TEST REPORT

Generated: 2026-09-30T09:46:33.776Z

Passed: 36 / 36
Failed: 0

| ID | Name | Result |
|----|------|--------|
| 001 | Initial state IDLE | PASS |
| 002 | IDLE → LOADING | PASS |
| 003 | LOADING → PLAYING | PASS |
| 004 | PLAYING → PAUSED | PASS |
| 005 | PAUSED → PLAYING | PASS |
| 006 | PLAYING → STOPPED | PASS |
| 007 | PLAYING → ENDED | PASS |
| 008 | PLAYING → ERROR | PASS |
| 009 | NEXT increments item | PASS |
| 010 | NEXT last + repeat PLAYLIST wraps | PASS |
| 011 | NEXT last + repeat NONE → ENDED | PASS |
| 012 | PREVIOUS goes to prior item | PASS |
| 013 | PREVIOUS with position > 3s restarts | PASS |
| 014 | RESTART | PASS |
| 015 | SEEK valid | PASS |
| 016 | SEEK negative rejected/clamped | PASS |
| 017 | SEEK > duration clamped | PASS |
| 018 | Volume clamp | PASS |
| 019 | Mute preserves volume | PASS |
| 020 | Subscribe/unsubscribe | PASS |
| 021 | Stale event ignored | PASS |
| 022 | NEXT during LOAD | PASS |
| 023 | STOP during LOAD | PASS |
| 024 | ERROR then retry/loading | PASS |
| 025 | Playlist content reused in multiple items | PASS |
| 026 | currentIndex != content identity | PASS |
| 027 | Manifest version preserved | PASS |
| 028 | Natural video duration | PASS |
| 029 | IMAGE timing | PASS |
| 030 | VIDEO error fallback | PASS |
| X01 | Transition table covers all statuses | PASS |
| X02 | getState returns snapshot not live ref | PASS |
| X03 | STOP from PLAY then PLAY resumes from 0 | PASS |
| X04 | AUDIO model fields | PASS |
| X05 | EXPERIENCE type represented without runtime change | PASS |
| X06 | GIF slide semantics via IMAGE mime path | PASS |
