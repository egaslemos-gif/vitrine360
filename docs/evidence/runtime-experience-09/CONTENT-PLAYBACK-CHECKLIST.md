# RUNTIME-EXPERIENCE-09 Content + Playback Checklist

**Date:** 2026-09-27T18:50:38.599Z
**Verdict:** CONTENT MODEL + PLAYBACK INTEGRATION VALIDATED

## Acceptance

- [x] EXPERIENCE Content type (not HTML_APP)
- [x] Version-pinned experienceId + version
- [x] No latest/current/stable
- [x] PlaylistItem generic
- [x] Manifest typed sanitized ref
- [x] Tenant isolation
- [x] Registry/store reused
- [x] Admission boundary preserved
- [x] React/Legacy safe non-execution
- [x] No eval/new Function/srcDoc in EX-09 surface
- [x] EX-10 runtime intact

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
| CONTENT-EXP-001 | PASS | EXPERIENCE type + valid ref |
| CONTENT-EXP-002 | PASS | missing DENY |
| CONTENT-EXP-003 | PASS | version missing DENY |
| CONTENT-EXP-004 | PASS | wrong experience DENY |
| CONTENT-EXP-005 | PASS | cross-tenant DENY |
| CONTENT-EXP-006 | PASS | cross-tenant version DENY |
| CONTENT-EXP-007 | PASS | exact version preserved |
| CONTENT-EXP-008 | PASS | no latest/current |
| CONTENT-EXP-009 | PASS | PlaylistItem generic |
| CONTENT-EXP-010 | PASS | typed EXPERIENCE ref |
| CONTENT-EXP-011 | PASS | preserves experienceId |
| CONTENT-EXP-012 | PASS | preserves version |
| CONTENT-EXP-013 | PASS | no arbitrary URL |
| CONTENT-EXP-014 | PASS | admission still separate |
| CONTENT-EXP-015 | PASS | VALID ≠ PUBLISHED |
| CONTENT-EXP-016 | PASS | PUBLISHED ≠ ADMITTED (runtime separate) |
| CONTENT-EXP-017 | PASS | Legacy safe fallback |
| CONTENT-EXP-018 | PASS | React EXPERIENCE via PlaybackSlide + admit (EX-11) |
| CONTENT-EXP-019 | PASS | no eval |
| CONTENT-EXP-020 | PASS | no new Function |
| CONTENT-EXP-021 | PASS | no srcDoc |
| CONTENT-EXP-022 | PASS | no blob/data exec in surface |
| CONTENT-EXP-023 | PASS | tenant isolation |
| CONTENT-EXP-024 | PASS | MEDIA types remain |
| CONTENT-EXP-025 | PASS | Playlist schema intact |
| CONTENT-EXP-026 | PASS | Manifest builder intact |
| CONTENT-EXP-027 | PASS | Scheduler resolver intact |
| CONTENT-EXP-028 | PASS | Device sync path intact |
| CONTENT-EXP-029 | PASS | EX-10 runtime still works |
| CONTENT-EXP-030 | PASS | safe unavailable fallback |
| EXP-09-docs | PASS | docs + ADR |
