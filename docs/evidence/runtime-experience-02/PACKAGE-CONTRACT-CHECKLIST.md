# RUNTIME-EXPERIENCE-02 Package Contract Checklist

**Date:** 2026-09-24T08:19:20.193Z
**Verdict:** CONTRACT VALIDATED

## Acceptance checklist (§21)

- [x] manifest contract documentado
- [x] package structure documentada
- [x] schemaVersion definido
- [x] Experience version separada do schema
- [x] entrypoint definido
- [x] assets definidos
- [x] integrity definida
- [x] dependencies definidas
- [x] capabilities separadas de permissions
- [x] network policy definida
- [x] storage policy definida
- [x] offline requirements definidos
- [x] runtime limits definidos ou explicitamente UNSPECIFIED
- [x] lifecycle definido
- [x] validation states definidos
- [x] compatibility definida
- [x] multi-tenancy definida
- [x] error model definido
- [x] threat mapping concluído
- [x] nenhum executor criado
- [x] nenhum iframe executor criado
- [x] nenhuma migration criada
- [x] nenhum HTML_APP criado
- [x] nenhum playback alterado

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
| EXP-CONTRACT-001 | PASS | docs present |
| EXP-CONTRACT-002 | PASS | manifest fields documented |
| EXP-CONTRACT-003 | PASS | package structure documented |
| EXP-CONTRACT-004 | PASS | deny-by-default documented |
| EXP-CONTRACT-005 | PASS | capability ≠ permission documented |
| EXP-CONTRACT-006 | PASS | integrity model documented |
| EXP-CONTRACT-007 | PASS | multi-tenancy documented |
| EXP-CONTRACT-008 | PASS | lifecycle + validation states documented |
| EXP-CONTRACT-009 | PASS | error model documented |
| EXP-CONTRACT-010 | PASS | version axes + UNSPECIFIED limits |
| EXP-CONTRACT-011 | PASS | threat mapping T1–T14 present |
| EXP-CONTRACT-012 | PASS | ADR coherent |
| EXP-CONTRACT-013 | PASS | no HTML_APP / executor / Experience schema |
| EXP-CONTRACT-014 | PASS | trust principles documented |

## Confirmed absences
- HTML_APP not in CONTENT_TYPES; EXPERIENCE added in EXPERIENCE-09
- No Experience Runtime / sandbox executor under src/
- No Experience tables in schema

## Docs
- docs/RUNTIME-EXPERIENCE-02-PACKAGE-CONTRACT.md
- docs/adr/ADR-EXPERIENCE-002.md
