# RUNTIME-EXPERIENCE-06 Sandbox Host Checklist

**Date:** 2026-09-27T18:48:28.705Z
**Verdict:** SANDBOX HOST VALIDATED

## Acceptance

- [x] Sandbox deny-by-default documented + implemented
- [x] allow-same-origin only on dedicated origin
- [x] iframe allow Permissions-Policy deny defaults
- [x] frame-ancestors includes app origin
- [x] ExperienceSandboxFrame without postMessage bridge
- [x] Safe src checks
- [x] No Player playback wire
- [x] No HTML_APP / migrations

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
| EXP-SBX-001 | PASS | docs present |
| EXP-SBX-002 | PASS | dedicated origin sandbox policy |
| EXP-SBX-003 | PASS | allow-same-origin denied on privileged origin |
| EXP-SBX-004 | PASS | iframe src allowlist |
| EXP-SBX-005 | PASS | CSP frame-ancestors for embed |
| EXP-SBX-006 | PASS | SandboxFrame without bridge |
| EXP-SBX-007 | PASS | no Player wire / HTML_APP / migrations |
| EXP-SBX-008 | PASS | serve route uses frame-ancestors |
