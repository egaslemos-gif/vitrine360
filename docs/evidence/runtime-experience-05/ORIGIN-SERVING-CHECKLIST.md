# RUNTIME-EXPERIENCE-05 Origin + Serving Checklist

**Date:** 2026-09-29T22:07:12.981Z
**Verdict:** ORIGIN + SERVING VALIDATED

## Acceptance

- [x] Dedicated origin config documented
- [x] Host guard (proxy) only allows /x on Experience origin
- [x] Serve URL scheme /x/{tenant}/{exp}/{version}/…
- [x] Fail-closed admission VALID+PUBLISHED+tenant
- [x] Path traversal rejected
- [x] CSP / Permissions-Policy on responses
- [x] In-process store (no migration)
- [x] No iframe / bridge / Player wire
- [x] No HTML_APP / playback changes

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
| EXP-ORIG-001 | PASS | docs + ADR present |
| EXP-ORIG-002 | PASS | origin host guard helpers |
| EXP-ORIG-003 | PASS | serve URL scheme |
| EXP-ORIG-004 | PASS | store + fail-closed admission |
| EXP-ORIG-005 | PASS | security headers deny-by-default |
| EXP-ORIG-006 | PASS | serve route + proxy present |
| EXP-ORIG-007 | PASS | no HTML_APP / Player experience dir / migrations |
| EXP-ORIG-008 | PASS | prior EXPERIENCE artifacts intact |
