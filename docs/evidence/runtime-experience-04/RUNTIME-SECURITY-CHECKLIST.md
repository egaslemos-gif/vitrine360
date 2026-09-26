# RUNTIME-EXPERIENCE-04 Runtime Security Checklist

**Date:** 2026-09-24T08:19:22.240Z
**Verdict:** RUNTIME SECURITY DESIGN VALIDATED

## Acceptance

- [x] Trust model documented
- [x] Security boundary documented
- [x] Origin model evaluated; Dedicated Origin preferred
- [x] Same-origin scripts+same-origin rejected as default
- [x] Sandbox deny-by-default documented
- [x] CSP conceptual policy documented
- [x] Permissions Policy default deny documented
- [x] Network / storage / navigation boundaries documented
- [x] Input / fullscreen / orientation boundaries documented
- [x] Bridge security principles documented (not implemented)
- [x] Admission control pipeline documented
- [x] Lifecycle / failure isolation / limits / kill switch documented
- [x] Observability / offline / tenant isolation documented
- [x] Security invariants listed
- [x] Threat model T1–T14 mapped
- [x] Phased implementation boundary documented
- [x] No Experience Runtime / iframe / bridge code
- [x] No HTML_APP / migrations / playback changes

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
| EXP-SEC-001 | PASS | docs present |
| EXP-SEC-002 | PASS | trust model + security boundary |
| EXP-SEC-003 | PASS | origin model decision |
| EXP-SEC-004 | PASS | sandbox + CSP + Permissions-Policy |
| EXP-SEC-005 | PASS | network/storage/navigation boundaries |
| EXP-SEC-006 | PASS | fullscreen/orientation/bridge principles |
| EXP-SEC-007 | PASS | admission + lifecycle + kill switch |
| EXP-SEC-008 | PASS | invariants + T1–T14 + phased boundary |
| EXP-SEC-009 | PASS | ADR coherent |
| EXP-SEC-010 | PASS | no HTML_APP / executor / bridge / migrations |
| EXP-SEC-011 | PASS | EXPERIENCE-01..03 artifacts intact |

## Docs
- docs/RUNTIME-EXPERIENCE-04-RUNTIME-SECURITY.md
- docs/adr/ADR-EXPERIENCE-004.md
