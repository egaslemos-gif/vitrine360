# RUNTIME-EXPERIENCE-03 Validator & Registry Checklist

**Date:** 2026-09-30T09:45:42.602Z
**Verdict:** VALIDATOR ARCHITECTURE VALIDATED

## Acceptance

- [x] validation pipeline documented + implemented
- [x] manifest parser (schema 1.0)
- [x] path / entrypoint / asset / integrity checks
- [x] dependency + network + storage policy checks
- [x] compatibility / effective capabilities
- [x] registry publication states (conceptual)
- [x] tenant isolation guards
- [x] ZIP inventory reader (no execute)
- [x] no Experience Runtime / iframe / bridge
- [x] no HTML_APP / migrations / playback changes

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
| EXP-VAL-001 | PASS | docs + ADR present |
| EXP-VAL-002 | PASS | path normalization rejects traversal |
| EXP-VAL-003 | PASS | valid package → VALID |
| EXP-VAL-004 | PASS | bad paths rejected |
| EXP-VAL-005 | PASS | hash mismatch → INVALID |
| EXP-VAL-006 | PASS | unsupported schema → INCOMPATIBLE |
| EXP-VAL-007 | PASS | network/storage policy enforced |
| EXP-VAL-008 | PASS | Device ∩ Requested ∩ Permission |
| EXP-VAL-009 | PASS | ZIP inventory validates |
| EXP-VAL-010 | PASS | registry lifecycle + tenant guard |
| EXP-VAL-011 | PASS | malformed JSON rejected |
| EXP-VAL-012 | PASS | no executor / HTML_APP / migrations |
| EXP-VAL-013 | PASS | security principles documented |

## Modules
- src/domain/experience-manifest.ts
- src/domain/experience-validator.ts
- src/domain/experience-registry.ts
